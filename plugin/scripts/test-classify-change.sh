#!/bin/bash
# Pandacorp — unit tests for classify-change.sh (the rigor classifier).
#
# Contract under test (memo 37 §A.2 + j1 §3.b/§4.2): a deterministic script derives
# rigor ∈ {micro, normal, critical} from a diff, and its ONLY unacceptable failure is a
# FALSE NEGATIVE on the floor (auth / money / PII / persistence / irreversible / secrets /
# oracles / factory machinery classified below `critical`). Every case below is therefore
# written as "does the floor hold", not "is the output pretty".
#
# Run: bash plugin/scripts/test-classify-change.sh

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CLS="$HERE/classify-change.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v jq >/dev/null 2>&1 || { echo "FATAL: jq is required to run these tests"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "FATAL: node is required to run these tests"; exit 1; }

pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

REPO="$TMP/repo"
G() { git -C "$REPO" -c user.email=t@example.com -c user.name=Tester -c commit.gpgsign=false "$@"; }

# --- Fixture repo -------------------------------------------------------------------------
mkdir -p "$REPO"/src/{lib,app/api/x,components/_tests,app/reports} "$REPO"/styles "$REPO"/plugin/agents
git -C "$REPO" init -q -b main

printf '.card {\n  color: red;\n}\n' > "$REPO/styles/main.css"
for f in alpha beta gamma delta; do printf 'export const %s = 1;\n' "$f" > "$REPO/src/lib/$f.ts"; done
printf 'export async function GET() {\n  return new Response("ok");\n}\n' > "$REPO/src/app/api/x/route.ts"
printf 'export function clean(): string {\n  return "noop";\n}\n' > "$REPO/src/lib/cleanup.ts"
printf 'plain notes\nsecond line\n' > "$REPO/notes.xyz"
{
  echo 'import { describe, it } from "vitest";'
  echo 'describe("suite", () => {'
  for i in 1 2 3 4 5 6 7 8 9 10; do echo "  it(\"case $i\", () => {});"; done
  echo '});'
} > "$REPO/src/components/_tests/foo.test.ts"
G add -A >/dev/null && G commit -qm "chore: base fixture" >/dev/null
BASE=$(G rev-parse HEAD)

mkcommit() { # <msg> -> echoes sha
  G add -A >/dev/null
  G commit -qm "$1" >/dev/null
  G rev-parse HEAD
}
rng() { echo "$1^..$1"; }

# C1 — 8 lines of CSS appended (micro)
for i in 1 2 3 4 5 6 7 8; do printf '.u%s { margin: 0; }\n' "$i" >> "$REPO/styles/main.css"; done
C_CSS=$(mkcommit "style: tweak cards")

# C2 — 47 added lines spread over 4 pre-existing lib .ts files (normal)
n=0
for f in alpha beta gamma; do
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do printf 'export const %s_%s = %s;\n' "$f" "$i" "$i" >> "$REPO/src/lib/$f.ts"; n=$((n+1)); done
done
for i in 1 2 3 4 5 6 7 8 9 10 11; do printf 'export const delta_%s = %s;\n' "$i" "$i" >> "$REPO/src/lib/delta.ts"; n=$((n+1)); done
C_LIB=$(mkcommit "refactor: add lib constants ($n lines)")

# C3 — modifies an existing API route (floor: auth/data)
printf 'export async function POST() {\n  return new Response("done");\n}\n' >> "$REPO/src/app/api/x/route.ts"
C_API=$(mkcommit "feat: add POST handler")

# C4 — adds a destructive SQL statement inside a lib file (floor: data loss)
printf 'export const PURGE = "%s FROM users WHERE id = $1";\n' "DELETE" >> "$REPO/src/lib/cleanup.ts"
C_SQL=$(mkcommit "chore: add purge statement")

# C5 — brand new route file
printf 'export default function Page() {\n  return null;\n}\n' > "$REPO/src/app/reports/page.tsx"
C_ROUTE=$(mkcommit "feat: reports page")

# C6 — deletes 3 test cases from a _tests file (net deletion → floor: oracles)
grep -v 'case 8\|case 9\|case 10' "$REPO/src/components/_tests/foo.test.ts" > "$TMP/t" && mv "$TMP/t" "$REPO/src/components/_tests/foo.test.ts"
C_TESTS=$(mkcommit "test: drop three cases")

# C7 — touches .env.example (floor: secrets/infra)
printf '# NEXT_PUBLIC_BASE_URL — the public origin\nNEXT_PUBLIC_BASE_URL=\n' > "$REPO/.env.example"
C_ENV=$(mkcommit "chore: document base url var")

# C8 — touches plugin/agents/** (floor: factory machinery)
printf -- '---\nname: x\n---\n\nAgent body.\n' > "$REPO/plugin/agents/x.md"
C_PLUGIN=$(mkcommit "chore: add agent x")

# C9 — unknown extension only
printf 'third line\n' >> "$REPO/notes.xyz"
C_XYZ=$(mkcommit "chore: note")

# --- Cards / work orders ------------------------------------------------------------------
CARD_REBUILD="$TMP/card-rebuild.md"
printf -- '---\ntype: change\nstatus: ready\nrebuilds_verified: true\nsupersedes:\n---\n\n# Rehacer algo ya verificado\n' > "$CARD_REBUILD"
CARD_PLAIN="$TMP/card-plain.md"
printf -- '---\ntype: change\nstatus: ready\nrebuilds_verified: false\nsupersedes:\n---\n\n# Un cambio normal\n' > "$CARD_PLAIN"
CARD_SUPERSEDES="$TMP/card-supersedes.md"
printf -- '---\ntype: change\nstatus: ready\nrebuilds_verified: false\nsupersedes: DR-042\n---\n\n# Reemplaza una regla\n' > "$CARD_SUPERSEDES"
WO_HARD="$TMP/wo-hard.md"
printf -- '---\nid: WO-01-001\ndifficulty: high\nreopen_count: 0\n---\n\n# Work order\n' > "$WO_HARD"
WO_REOPEN="$TMP/wo-reopen.md"
printf -- '---\nid: WO-01-002\ndifficulty: low\nreopen_count: 2\n---\n\n# Work order\n' > "$WO_REOPEN"

# --- Helpers ------------------------------------------------------------------------------
OUT=""; RC=0
run() { OUT=$(bash "$CLS" "$@" 2>/dev/null); RC=$?; }
rigor()   { printf '%s' "$OUT" | jq -r '.rigor // "PARSE_ERROR"'; }
has_sig() { printf '%s' "$OUT" | jq -e --arg s "$1" '[.reasons[].signal] | index($s) != null' >/dev/null 2>&1; }
has_floor(){ printf '%s' "$OUT" | jq -e --arg s "$1" '[.floor_hits[].signal] | index($s) != null' >/dev/null 2>&1; }
expect_rigor() { # <expected> <label>
  local got; got=$(rigor)
  [ "$got" = "$1" ] && ok "$2 → $1" || bad "$2: expected $1, got '$got' (rc=$RC) :: $OUT"
}

echo "== classify-change.sh =="

# (1)
echo "Case 1 — 8 lines of CSS"
run --repo "$REPO" --range "$(rng "$C_CSS")"
expect_rigor micro "css-only micro"
has_sig S13 && ok "S13 (presentation-only) reported" || bad "S13 missing :: $OUT"
[ "$RC" -eq 0 ] && ok "exit 0" || bad "expected exit 0, got $RC"

# (2)
echo "Case 2 — 47 lines across 4 lib .ts files"
run --repo "$REPO" --range "$(rng "$C_LIB")"
expect_rigor normal "mid-size code change"
has_sig S2 && ok "S2 (normal size band) reported" || bad "S2 missing :: $OUT"
printf '%s' "$OUT" | jq -e '.stats.files == 4' >/dev/null && ok "stats.files == 4" || bad "stats.files wrong :: $OUT"

# (3)
echo "Case 3 — src/app/api/x/route.ts"
run --repo "$REPO" --range "$(rng "$C_API")"
expect_rigor critical "api route touched"
has_floor S5 && ok "S5 in floor_hits" || bad "S5 not in floor_hits :: $OUT"

# (4)
echo "Case 4 — diff adds a destructive SQL statement"
run --repo "$REPO" --range "$(rng "$C_SQL")"
expect_rigor critical "data-loss statement"
has_floor S8 && ok "S8 in floor_hits" || bad "S8 not in floor_hits :: $OUT"

# (5)
echo "Case 5 — new page.tsx"
run --repo "$REPO" --range "$(rng "$C_ROUTE")"
expect_rigor critical "new route"
has_sig S4 && ok "S4 reported" || bad "S4 missing :: $OUT"
printf '%s' "$OUT" | jq -e '.stats.new_files >= 1' >/dev/null && ok "stats.new_files >= 1" || bad "new_files wrong :: $OUT"

# (6)
echo "Case 6 — net deletion of test cases under _tests/"
run --repo "$REPO" --range "$(rng "$C_TESTS")"
expect_rigor critical "oracle erosion"
has_floor S9 && ok "S9 in floor_hits" || bad "S9 not in floor_hits :: $OUT"

# (7)
echo "Case 7 — .env.example"
run --repo "$REPO" --range "$(rng "$C_ENV")"
expect_rigor critical "secrets/infra surface"
has_floor S7 && ok "S7 in floor_hits" || bad "S7 not in floor_hits :: $OUT"

# (8)
echo "Case 8 — plugin/agents/x.md"
run --repo "$REPO" --range "$(rng "$C_PLUGIN")"
expect_rigor critical "factory machinery"
has_floor S7 && ok "S7 in floor_hits" || bad "S7 not in floor_hits :: $OUT"

# (9)
echo "Case 9 — card with rebuilds_verified: true over a micro diff"
run --repo "$REPO" --range "$(rng "$C_CSS")" --card "$CARD_REBUILD"
expect_rigor critical "rebuilds_verified escalates"
has_sig S10 && ok "S10 reported" || bad "S10 missing :: $OUT"
run --repo "$REPO" --range "$(rng "$C_CSS")" --card "$CARD_PLAIN"
expect_rigor micro "plain card does not escalate"

# (10)
echo "Case 10 — --attempts 1 over a micro diff"
run --repo "$REPO" --range "$(rng "$C_CSS")" --attempts 1
expect_rigor normal "S16 raises one level"
has_sig S16 && ok "S16 reported" || bad "S16 missing :: $OUT"
run --repo "$REPO" --range "$(rng "$C_API")" --attempts 1
expect_rigor critical "S16 cannot exceed critical"

# (11)
echo "Case 11 — nonexistent repo"
run --repo "$TMP/definitely-not-a-repo" --range "$(rng "$C_CSS")"
[ "$RC" -ne 0 ] && ok "exit != 0 ($RC)" || bad "expected nonzero exit"
expect_rigor critical "fail-closed rigor"
has_sig FAILCLOSED && ok "FAILCLOSED reason" || bad "FAILCLOSED missing :: $OUT"

# (12)
echo "Case 12 — unknown extension (.xyz)"
run --repo "$REPO" --range "$(rng "$C_XYZ")"
expect_rigor normal "unclassifiable never micro"
has_sig S15 && ok "S15 reported" || bad "S15 missing :: $OUT"

# --- Beyond the mandated twelve: the remaining signals and modes --------------------------

echo "Case 13 — S11 (supersedes) floors at normal"
run --repo "$REPO" --range "$(rng "$C_CSS")" --card "$CARD_SUPERSEDES"
expect_rigor normal "supersedes → >= normal"
has_sig S11 && ok "S11 reported" || bad "S11 missing :: $OUT"

echo "Case 14 — S12 (work order difficulty / reopen_count)"
run --repo "$REPO" --range "$(rng "$C_CSS")" --wo "$WO_HARD"
expect_rigor critical "difficulty: high → critical"
run --repo "$REPO" --range "$(rng "$C_CSS")" --wo "$WO_REOPEN"
expect_rigor critical "reopen_count >= 1 → critical"

echo "Case 15 — --files never returns micro (line counts unavailable)"
run --repo "$REPO" --files "styles/main.css"
expect_rigor normal "css via --files floors at normal"
run --repo "$REPO" --files "src/app/api/x/route.ts"
expect_rigor critical "floor path via --files"

echo "Case 16 — --worktree and --staged see uncommitted work"
printf '.late { color: blue; }\n' >> "$REPO/styles/main.css"
run --repo "$REPO" --worktree
expect_rigor micro "uncommitted css"
printf 'export const middleware = 1;\n' > "$REPO/src/lib/auth-helper.ts"
mkdir -p "$REPO/src/lib/auth" && printf 'export const guard = 1;\n' > "$REPO/src/lib/auth/guard.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "staged lib/auth/** hits the floor"
has_floor S5 && ok "S5 in floor_hits" || bad "S5 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -f "$REPO/src/lib/auth/guard.ts" "$REPO/src/lib/auth-helper.ts"
G checkout -q -- styles/main.css 2>/dev/null

echo "Case 17 — empty diff is an error, not a micro"
run --repo "$REPO" --range "$BASE..$BASE"
[ "$RC" -ne 0 ] && ok "exit != 0 ($RC)" || bad "expected nonzero exit"
expect_rigor critical "empty diff fails closed"

echo "Case 18 — unknown flag fails closed"
run --repo "$REPO" --range "$(rng "$C_CSS")" --bogus
[ "$RC" -ne 0 ] && ok "exit != 0 ($RC)" || bad "expected nonzero exit"
expect_rigor critical "bad usage fails closed"

echo "Case 19 — unreadable card fails closed"
run --repo "$REPO" --range "$(rng "$C_CSS")" --card "$TMP/no-such-card.md"
[ "$RC" -ne 0 ] && ok "exit != 0 ($RC)" || bad "expected nonzero exit"
expect_rigor critical "missing card fails closed"

echo "Case 20 — S17 reverse dependency via madge"
mkdir -p "$REPO/node_modules/.bin"
{
  echo '#!/bin/bash'
  echo 'echo "{\"app/api/x/route.ts\":[\"lib/formatting.ts\"],\"lib/formatting.ts\":[]}"'
} > "$REPO/node_modules/.bin/madge"
chmod +x "$REPO/node_modules/.bin/madge"
printf 'export const fmt = (s: string) => s.trim();\n' > "$REPO/src/lib/formatting.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "floor file transitively imports the touched file"
has_floor S17 && ok "S17 in floor_hits" || bad "S17 not in floor_hits :: $OUT"
rm -rf "$REPO/node_modules"
run --repo "$REPO" --staged
printf '%s' "$OUT" | jq -e '[.notes[]] | map(test("S17")) | any' >/dev/null && ok "S17 skipped, noted, level not lowered" || bad "S17 skip note missing :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -f "$REPO/src/lib/formatting.ts"

echo "Case 21 — the floor beats a pile of micro signals (max wins)"
printf '.x { color: red; }\n' >> "$REPO/styles/main.css"
printf 'DUMMY=1\n' >> "$REPO/.env.example"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "one floor hit outranks every micro signal"
G reset -q --mixed HEAD >/dev/null 2>&1
G checkout -q -- styles/main.css .env.example 2>/dev/null

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ] || exit 1
