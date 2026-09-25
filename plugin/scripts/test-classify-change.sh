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

pass=0; fail=0; xfail=0
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
xf() { # <label> <bl-id> — a documented, non-blocking known gap (does not fail the suite)
  local got; got=$(rigor)
  xfail=$((xfail+1))
  echo "  ~ xfail $1 (known gap, $2, got '$got')"
}

echo "== classify-change.sh =="

# (1)
echo "Case 1 — 8 lines of CSS"
run --repo "$REPO" --range "$(rng "$C_CSS")"
# D3: this fixture repo has no node_modules/.bin/madge, so S17 floors every case at >= normal
# (never micro — see reverseDependency's "unavailable" branch); S1 still reports underneath it.
expect_rigor normal "css-only, floored to normal by S17 (madge unavailable)"
has_sig S13 && ok "S13 (presentation-only) reported" || bad "S13 missing :: $OUT"
has_sig S1 && ok "S1 (micro-size) still reported underneath the S17 floor" || bad "S1 missing :: $OUT"
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
# D3: floored to normal by S17 (madge unavailable), same as Case 1 — the point of this check (a
# plain card does not ITSELF escalate, unlike CARD_REBUILD above) still holds at this level.
expect_rigor normal "plain card does not escalate (floored to normal by S17, not by the card)"

# (10)
echo "Case 10 — --attempts 1 over a micro diff"
run --repo "$REPO" --range "$(rng "$C_CSS")" --attempts 1
# D3: the S17 floor means this diff's own base is already `normal` (not `micro`) before --attempts
# is even applied, so S16 raises it exactly one level further, to `critical` — still proving S16
# raises exactly one level, just from a different floored starting point.
expect_rigor critical "S16 raises one level (normal → critical, base floored by S17)"
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
expect_rigor normal "uncommitted css (floored to normal by S17, not by the worktree mode)"
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

echo "Case 20b — BL-0161: S17 finds a NESTED project's own madge, not the git toplevel's"
# A project without its own .git (shares its parent's, like Mission Control inside panda-corp):
# `git rev-parse --show-toplevel` resolves to the OUTER repo, which has no node_modules of its
# own — before the projectRoot/repoRoot split, S17 looked for madge there and always "skipped
# (madge unavailable)", so this project could never certify `micro`. Re-run Case 20's exact
# graph, but with the project one directory below the git toplevel and madge installed only
# in the PROJECT (never the outer repo), to prove the lookup now follows `--repo`.
OUTER="$TMP/outer"
mkdir -p "$OUTER"
git -C "$OUTER" init -q -b main
OUTER_G() { git -C "$OUTER" -c user.email=t@example.com -c user.name=Tester -c commit.gpgsign=false "$@"; }
NESTED="$OUTER/project"
mkdir -p "$NESTED/src/app/api/x" "$NESTED/src/lib"
printf 'export async function GET() { return null; }\n' > "$NESTED/src/app/api/x/route.ts"
printf 'export const fmt = (s) => s.trim();\n' > "$NESTED/src/lib/formatting.ts"
OUTER_G add -A >/dev/null && OUTER_G commit -qm "chore: nested project seed" >/dev/null
mkdir -p "$NESTED/node_modules/.bin"
{
  echo '#!/bin/bash'
  echo 'echo "{\"app/api/x/route.ts\":[\"lib/formatting.ts\"],\"lib/formatting.ts\":[]}"'
} > "$NESTED/node_modules/.bin/madge"
chmod +x "$NESTED/node_modules/.bin/madge"
[ ! -d "$OUTER/node_modules" ] || { echo "FATAL: test setup leaked madge to the outer repo"; exit 1; }
printf '\nexport const fmt2 = (s) => s.trimEnd();\n' >> "$NESTED/src/lib/formatting.ts"
OUTER_G add -A >/dev/null
run --repo "$NESTED" --staged
expect_rigor critical "BL-0161: nested project — S17 certifies via the project's own madge"
has_floor S17 && ok "S17 in floor_hits (projectRoot madge lookup, not repoRoot/git-toplevel)" || bad "S17 not in floor_hits :: $OUT"
printf '%s' "$OUT" | jq -e '[.notes[]] | map(test("madge unavailable")) | any | not' >/dev/null \
  && ok "S17 not skipped as 'madge unavailable' for the nested project" || bad "S17 wrongly skipped :: $OUT"

echo "Case 21 — the floor beats a pile of micro signals (max wins)"
printf '.x { color: red; }\n' >> "$REPO/styles/main.css"
printf 'DUMMY=1\n' >> "$REPO/.env.example"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "one floor hit outranks every micro signal"
G reset -q --mixed HEAD >/dev/null 2>&1
G checkout -q -- styles/main.css .env.example 2>/dev/null

# --- Regression cases, each anchored in a FLOOR FALSE NEGATIVE found by the 600-commit backtest --
# Every one of these came out below `critical` before the signal that now catches it existed.

floor_case() { # <relative path> <label> <line to append>
  local rel="$1" label="$2" line="$3"
  mkdir -p "$REPO/$(dirname "$rel")"
  printf '%s\n' "$line" >> "$REPO/$rel"
  G add -A >/dev/null
  run --repo "$REPO" --staged
  expect_rigor critical "$label"
  G reset -q --mixed HEAD >/dev/null 2>&1
  git -C "$REPO" checkout -q -- "$rel" 2>/dev/null || rm -f "$REPO/$rel"
}

echo "Case 22 — backtest regressions: machinery, oracles, supply chain"
floor_case ".claude/engines/pandacorp-backlog.js" "build engine under .claude/ (panda-corp d61a4a3d)" "const retries = 2;"
floor_case "knip.json" "knip gate config (personal-page-v2 e6bffe85)" '{ "ignore": ["src/generated/**"] }'
floor_case "eslint.config.mjs" "eslint gate config (pandatrack 9db726b6)" "export default [];"
floor_case "tsconfig.json" "typecheck gate config" '{ "compilerOptions": { "strict": true } }'
floor_case "vitest.setup.ts" "test harness setup (panda-corp 6db939f8)" "globalThis.localStorage = undefined;"
floor_case "package.json" "supply chain manifest (personal-page-v2 4cbdc45f)" '{ "packageManager": "pnpm@10.0.0" }'
floor_case "pnpm-lock.yaml" "lockfile" "lockfileVersion: '9.0'"

echo "Case 23 — backtest regressions: the data layer and its money vocabulary"
floor_case "src/lib/data/stores/storeGovernanceMutations.ts" "data-layer mutations (pandatrack b887a07b)" "export const NOOP = 1;"
floor_case "src/lib/data/dashboard/dashboardTypes.ts" "camelCase money identifier (pandatrack 2643ca5a)" "// sums OrderPayment.amount over cancelled orders"
floor_case "scripts/backfill-store-visibility.ts" "one-off data backfill (pandatrack fd6fd291)" "export const ROWS = 43;"
floor_case "src/app/settings/_components/PasswordModal.tsx" "credential surface (pandatrack eb6c9c54)" "export const X = 1;"

echo "Case 24 — backtest regressions: authorization written without the word 'auth'"
floor_case "src/components/StoreDetail.tsx" "optional-chained session read (pandatrack 22234497)" "const id = session?.user?.id ?? null;"
floor_case "src/components/Banner.tsx" "ownership check vocabulary" "const mine = store.createdByUserId === viewerId;"
floor_case "src/components/Redaction.tsx" "PII redaction announced in prose" "// redact the real-looking address before shipping the asset"
floor_case "docs/decision-log.md" "real e-mail literal in a diff (personal-page-v2 51522d66)" "Replaced the address ukg-sandbox-manager@jobleap.ai in the cover."

echo "Case 24b — RFC 2606 placeholder addresses stay cheap"
printf 'const FIXTURE_USER = "tester@example.com";\n' >> "$REPO/src/lib/alpha.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "example.com fixture is not PII (floored to normal by S17, not by S6)"
has_floor S6 && bad "example.com should not itself hit the S6 PII floor :: $OUT" || ok "no S6 floor hit from the example.com fixture"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/alpha.ts 2>/dev/null

echo "Case 25 — the prose carve-out does not open a hole"
# A markdown page that MENTIONS a destructive statement is prose, not a data-loss change...
mkdir -p "$REPO/docs"
printf 'Run the purge by hand only after a backup.\n' > "$REPO/docs/runbook.md"
printf 'Historically we wrote `%s FROM orders`.\n' "DELETE" >> "$REPO/docs/runbook.md"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "prose mentioning a destructive statement does not hit the floor"
# D3: floor_hits is no longer necessarily EMPTY here — S17 (madge unavailable) floors every case in
# this fixture repo at >= normal — so the real invariant under test is narrower: S8 specifically
# must not fire from prose (the whole point of Case 25).
printf '%s' "$OUT" | jq -e '[.floor_hits[].signal] | index("S8") == null' >/dev/null && ok "no S8 floor hit from prose" || bad "prose tripped the S8 floor :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; rm -rf "$REPO/docs"
# ...but a leaked key or a PII term in that same prose still hits the floor.
mkdir -p "$REPO/docs"
printf 'Token for staging: sk-abcd1234efgh5678ijkl\n' > "$REPO/docs/runbook.md"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "key-shaped literal in prose still hits the floor"
has_floor S7 && ok "S7 in floor_hits" || bad "S7 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; rm -rf "$REPO/docs"
mkdir -p "$REPO/docs"
printf 'We must anonymize the exported rows before sharing them.\n' > "$REPO/docs/privacy.md"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "high-signal PII term in prose still hits the floor"
G reset -q --mixed HEAD >/dev/null 2>&1; rm -rf "$REPO/docs"

echo "Case 26 — 'author' must not read as 'auth'"
printf 'export const AUTHOR = "Toshio"; // authored by the owner\n' >> "$REPO/src/lib/alpha.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "author/authored do not trip the auth floor (floored to normal by S17, not by S5)"
has_floor S5 && bad "author/authored should not itself hit the S5 auth floor :: $OUT" || ok "no S5 floor hit from author/authored"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/alpha.ts 2>/dev/null

echo "Case 26b — precision fixes the backtest demanded (false positives, not floor changes)"
printf 'export const NOTE = "the authoritative source has authority here";\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "authoritative/authority are not authentication (floored to normal by S17, not by S5)"
has_floor S5 && bad "authoritative/authority should not itself hit the S5 auth floor :: $OUT" || ok "no S5 floor hit from authoritative/authority"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null
printf '# copy files into the MAIN checkout so the worktree serves its own copy\n' >> "$REPO/styles/main.css"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "a git checkout is not a commerce checkout (floored to normal by S17, not by S6)"
has_floor S6 && bad "a git checkout should not itself hit the S6 money floor :: $OUT" || ok "no S6 floor hit from a git checkout"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- styles/main.css 2>/dev/null
printf 'export const URL = "/checkout/session";\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "a commerce checkout still hits the money floor"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null
printf 'export const ROLE = "we must authorize the request";\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "authorize still hits the auth floor"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null

echo "Case 27 — CSS visibility is not access-control visibility"
printf '.hidden { visibility: hidden; }\n' >> "$REPO/styles/main.css"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "CSS visibility stays cheap (floored to normal by S17, not by S5)"
has_floor S5 && bad "CSS visibility should not itself hit the S5 auth floor :: $OUT" || ok "no S5 floor hit from CSS visibility"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- styles/main.css 2>/dev/null

non_critical_case() { # <relative path> <label> <line to append> — BL-0134: factory DATA must NOT floor at S7
  local rel="$1" label="$2" line="$3"
  mkdir -p "$REPO/$(dirname "$rel")"
  printf '%s\n' "$line" >> "$REPO/$rel"
  G add -A >/dev/null
  run --repo "$REPO" --staged
  local got; got=$(rigor)
  if [ "$got" != "critical" ]; then ok "$label → $got (not critical)"; else bad "$label: expected non-critical, got critical :: $OUT"; fi
  has_floor S7 && bad "$label: should not hit the S7 floor :: $OUT" || ok "$label: no S7 floor hit"
  G reset -q --mixed HEAD >/dev/null 2>&1
  git -C "$REPO" checkout -q -- "$rel" 2>/dev/null || rm -f "$REPO/$rel"
}

echo "Case 28 — BL-0134: factory DATA subtrees (append-only bookkeeping) do not floor at S7"
non_critical_case "factory/memory/LESSON-9999.md" "factory/memory/ lesson append" "times_applied: 3"
non_critical_case "factory/backlog/BL-9999-example.md" "factory/backlog/ status flip" "status: doing"
non_critical_case "factory/ideas/example-idea.md" "factory/ideas/ card edit" "score: 7"
non_critical_case "factory/inbox/changes/drain-2026-09-23.md" "factory/inbox/ drain" "processed: true"
non_critical_case "factory/portfolio.md" "factory/portfolio.md rollup" "- example: on track"

echo "Case 29 — BL-0134 control: factory MACHINERY subtrees still floor at S7 (no false negative introduced)"
floor_case "factory/standards/example-standard.md" "factory/standards/ still critical (machinery)" "## New rule"
floor_case "factory/decisions/registry.yaml" "factory/decisions/ still critical (machinery)" "- id: DR-999"
floor_case "factory/templates/example-template.md" "factory/templates/ still critical (machinery)" "# Template"
floor_case "plugin/scripts/example-script.sh" "plugin/** still critical (machinery, unaffected by the factory/** split)" "echo hi"

# ═══════════════════════════════════════════════════════════════════════════════════════════
# REV2 — INDEPENDENT REVIEW (DR-015). Three FLOOR-EVASION attacks the classifier's own suite
# does not try. Each one is an EDIT to a pre-existing, already-recognised file, so the S1/S3
# size ladder cannot rescue the verdict and the floor is tested alone — which is the only
# failure the classifier's own header calls unacceptable ("a false negative on the floor").
# ═══════════════════════════════════════════════════════════════════════════════════════════

echo "Case REV2-A — a destructive SQL statement SPLIT over two added lines"
printf 'export const STMT = [\n' >> "$REPO/src/lib/cleanup.ts"
printf '  "%s",\n' "DELETE" >> "$REPO/src/lib/cleanup.ts"
printf '  "FROM sessions WHERE stale = true",\n].join(" ");\n' >> "$REPO/src/lib/cleanup.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "REV2-A: S8 is matched per added LINE, so splitting the statement across two lines evades the floor"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/cleanup.ts 2>/dev/null

echo "Case REV2-A2 — control: the SAME statement on ONE line must still hit the floor"
printf 'export const STMT2 = "%s FROM sessions";\n' "DELETE" >> "$REPO/src/lib/cleanup.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "REV2-A2 control: single-line destructive statement"
has_floor S8 && ok "REV2-A2: S8 in floor_hits (the control proves the detector works at all)" || bad "REV2-A2: S8 missing :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/cleanup.ts 2>/dev/null

echo "Case REV2-B — a base64-encoded secret under an innocuous identifier"
printf 'export const BLOB = "c2stcHJvai1BQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OTA=";\n' >> "$REPO/src/lib/alpha.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "REV2-B: S7 only matches PLAINTEXT key shapes (sk-/AKIA/ghp_/PEM), so a base64 blob carries a secret past the floor"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/alpha.ts 2>/dev/null

echo "Case REV2-C — a real authorization decision written without a single auth term"
printf 'export function pick(ctx: { u: { id: string } }, row: { o: string; body: string }) {\n' >> "$REPO/src/lib/beta.ts"
printf '  if (ctx.u.id !== row.o) return null;\n  return row.body;\n}\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
# BL-0140 FIXED: S5 now also matches the STRUCTURAL shape (a `!==` comparison between two member
# expressions immediately guarding an early return/throw), independent of vocabulary. See
# classify-change.mjs's OWNERSHIP_GUARD / S5_STRUCTURAL_JOINED.
expect_rigor critical "REV2-C: an ownership-equality guard with no auth vocabulary and no auth path now hits the S5 floor"
has_floor S5 && ok "REV2-C: S5 in floor_hits" || bad "REV2-C: S5 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null

echo "Case REV2-C-neg1 — control: a bare-identifier inequality guard is NOT an ownership check"
printf 'export function isOpen(status: string) {\n  if (status !== "done") return false;\n  return true;\n}\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "REV2-C-neg1: bare-identifier guard stays cheap (floored to normal by S17, not by S5)"
has_floor S5 && bad "REV2-C-neg1: bare-identifier guard should not hit the S5 floor :: $OUT" || ok "REV2-C-neg1: no S5 floor hit"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null

echo "Case REV2-C-neg2 — control: an === equality check (list dedup) is a MATCH guard, not a denial guard"
printf 'export function dedupe(a: { id: string }, b: { id: string }) {\n  if (a.id === b.id) return true;\n  return false;\n}\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "REV2-C-neg2: === dedup check stays cheap (floored to normal by S17, not by S5)"
has_floor S5 && bad "REV2-C-neg2: === dedup should not hit the S5 floor :: $OUT" || ok "REV2-C-neg2: no S5 floor hit"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null

echo "Case REV2-C-neg3 — control: an enum-style switch over member expressions is not a guard clause"
printf 'export function label(x: { kind: string }) {\n  switch (x.kind) {\n    case "a": return "A";\n    default: return "B";\n  }\n}\n' >> "$REPO/src/lib/beta.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "REV2-C-neg3: enum switch stays cheap (floored to normal by S17, not by S5)"
has_floor S5 && bad "REV2-C-neg3: enum switch should not hit the S5 floor :: $OUT" || ok "REV2-C-neg3: no S5 floor hit"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/beta.ts 2>/dev/null

echo "Case REV2-D — --files mode (no diff body) can never certify micro, and says so in notes"
run --repo "$REPO" --files "src/lib/alpha.ts"
[ "$(rigor)" != "micro" ] && ok "REV2-D: --files never certifies micro (got $(rigor))" || bad "REV2-D: --files certified micro without a diff body :: $OUT"
printf '%s' "$OUT" | jq -e '.notes | any(test("content signals not evaluated"))' >/dev/null 2>&1 \
  && ok "REV2-D: the missing-content degradation is declared in notes" || bad "REV2-D: the degradation is silent :: $OUT"

# ---- BL-0170 ----
# `--files` mode has no diff body: every entry is synthesized with `added:0, deleted:0, status:"M"`
# (collectFromFileList). S9's net-deletion arm used to fire `critical` from `!ctx.linesKnown` alone,
# so listing a NOT-YET-EXISTING test path (e.g. a work order enumerating its planned `_tests/*.test.ts`
# artifacts before they exist) misread as a net deletion of test coverage. The fix: in `--files` mode,
# S9's net-deletion arm does not evaluate at all (no counts to evaluate) and instead leaves an
# advisory note; only a REAL diff (`ctx.linesKnown`) can certify a genuine net deletion.

echo "Case BL-0170-neg — --files listing a NOT-YET-EXISTING test path does not escalate via S9"
run --repo "$REPO" --files "src/lib/_tests/new-planned.test.ts"
[ "$(rigor)" != "critical" ] && ok "BL-0170: --files test-path listing does not floor to critical (got $(rigor))" || bad "BL-0170: --files test-path listing wrongly floored to critical :: $OUT"
has_floor S9 && bad "BL-0170: S9 should not be in floor_hits for a --files-mode test path :: $OUT" || ok "BL-0170: no S9 floor hit in --files mode"
printf '%s' "$OUT" | jq -e '.notes | any(test("S9 not certifiable in --files mode"))' >/dev/null 2>&1 \
  && ok "BL-0170: the S9 --files-mode degradation is declared in notes" || bad "BL-0170: the degradation note is missing :: $OUT"

echo "Case BL-0170-pos — control: a real diff net-DELETING a test file's lines still hits the S9 floor"
grep -v -e 'case 5"' -e 'case 6"' -e 'case 7"' "$REPO/src/components/_tests/foo.test.ts" > "$REPO/src/components/_tests/foo.test.ts.tmp"
mv "$REPO/src/components/_tests/foo.test.ts.tmp" "$REPO/src/components/_tests/foo.test.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "BL-0170: control - net deletion in a real diff test file still floors critical"
has_floor S9 && ok "BL-0170: S9 in floor_hits for a genuine net deletion" || bad "BL-0170: S9 not in floor_hits for a genuine net deletion :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/components/_tests/foo.test.ts 2>/dev/null

# ---- BL-0164/BL-0165 ----
# Canary 2 (`change-now-canary-2-report.md` §4.1/§4.2): S3 escalated ANY new file under src/ to
# `critical` regardless of content — TDD makes a new test/helper file the norm for almost any real
# change, so this made a hand-back near-guaranteed. S8 floored ANY rmSync/rmdirSync regardless of
# context, including cleanup of a directory the test itself created via mkdtempSync — a pattern
# already used, unflagged, in 66 existing test files in this repo.

echo "Case BL-0164-neg — a new component test + a new pure helper under src/ do NOT escalate on their own"
mkdir -p "$REPO/src/app/projects/[slug]/_party/event-vm/_tests"
printf 'export function formatEvent(kind: string): string {\n  return kind.toUpperCase();\n}\n' \
  > "$REPO/src/app/projects/[slug]/_party/event-vm/formatEvent.ts"
{
  echo 'import { describe, it, expect } from "vitest";'
  echo 'import { formatEvent } from "../formatEvent";'
  echo 'describe("formatEvent", () => {'
  echo '  it("uppercases", () => { expect(formatEvent("x")).toBe("X"); });'
  echo '});'
} > "$REPO/src/app/projects/[slug]/_party/event-vm/_tests/formatEvent.test.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "BL-0164: new test + new pure helper under src/ stay at normal (floored by S17, not by S3)"
has_sig S3 && bad "BL-0164: S3 should not fire for a plain new test/helper pair :: $OUT" || ok "BL-0164: no S3 signal from a plain new test/helper pair"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -rf "$REPO/src/app/projects"

echo "Case BL-0164-pos — control: a brand-new API route file still escalates (via S5, not S3)"
mkdir -p "$REPO/src/app/api/newendpoint"
printf 'export async function GET() {\n  return new Response("ok");\n}\n' > "$REPO/src/app/api/newendpoint/route.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "BL-0164: a new app/api/** route still escalates"
has_floor S5 && ok "BL-0164: S5 in floor_hits (path-based, independent of S3)" || bad "BL-0164: S5 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -rf "$REPO/src/app/api/newendpoint"

echo "Case BL-0165-neg — rmSync of a mkdtempSync-created dir, cleaned up inside a test file, is not floor"
mkdir -p "$REPO/src/lib/_tests"
{
  echo 'import { mkdtempSync, rmSync } from "node:fs";'
  echo 'import { tmpdir } from "node:os";'
  echo 'import path from "node:path";'
  echo 'import { afterEach, describe, it } from "vitest";'
  echo 'describe("reader", () => {'
  echo '  afterEach(() => {'
  echo '    const tmpDir = mkdtempSync(path.join(tmpdir(), "reader-"));'
  echo '    rmSync(tmpDir, { recursive: true, force: true });'
  echo '  });'
  echo '  it("works", () => {});'
  echo '});'
} > "$REPO/src/lib/_tests/reader.test.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "BL-0165: rmSync on a traced mkdtempSync dir inside a test file stays at normal (floored by S17, not by S8)"
has_floor S8 && bad "BL-0165: rmSync tmpdir cleanup in a test should not hit the S8 floor :: $OUT" || ok "BL-0165: no S8 floor hit from traced tmpdir cleanup"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -rf "$REPO/src/lib/_tests"

echo "Case BL-0165-pos — control: rmSync outside a test surface still hits the floor"
printf 'export function wipeProject(projectDir: string) {\n  rmSync(projectDir, { recursive: true, force: true });\n}\n' \
  >> "$REPO/src/lib/cleanup.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "BL-0165: rmSync outside a test file still hits the floor"
has_floor S8 && ok "BL-0165: S8 in floor_hits" || bad "BL-0165: S8 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/cleanup.ts 2>/dev/null

echo "Case BL-0165-pos2 — control: an UNTRACED rmSync target inside a test file still fails closed"
mkdir -p "$REPO/src/lib/_tests"
{
  echo 'import { rmSync } from "node:fs";'
  echo 'import { afterEach, describe, it } from "vitest";'
  echo 'describe("reader", () => {'
  echo '  afterEach(() => {'
  echo '    rmSync("/Users/shared/real-project-dir", { recursive: true, force: true });'
  echo '  });'
  echo '  it("works", () => {});'
  echo '});'
} > "$REPO/src/lib/_tests/untraced.test.ts"
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "BL-0165: an rmSync target this cannot trace to a temp source still floors, even inside a test file"
has_floor S8 && ok "BL-0165: S8 in floor_hits (fail-closed on an untraced target)" || bad "BL-0165: S8 not in floor_hits :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1
rm -rf "$REPO/src/lib/_tests"

echo "Case BL-0164-churn-neg — a big test-only diff on an EXISTING test file does not hit the S3 size floor"
for i in $(seq 1 160); do printf '  it("generated case %s", () => {});\n' "$i" >> "$REPO/src/components/_tests/foo.test.ts"; done
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor normal "BL-0164: 160 added test-only lines stay at normal (floored by S17, not by S3)"
has_sig S3 && bad "BL-0164: S3 should not fire from test-only churn :: $OUT" || ok "BL-0164: no S3 signal from test-only churn"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/components/_tests/foo.test.ts 2>/dev/null

echo "Case BL-0164-churn-pos — control: the SAME line count in PRODUCTION code still hits the S3 size floor"
for i in $(seq 1 160); do printf 'export const generated_%s = %s;\n' "$i" "$i" >> "$REPO/src/lib/alpha.ts"; done
G add -A >/dev/null
run --repo "$REPO" --staged
expect_rigor critical "BL-0164: 160 added production lines still hit the S3 size floor"
has_sig S3 && ok "BL-0164: S3 reported for production-only churn" || bad "BL-0164: S3 missing for production churn :: $OUT"
G reset -q --mixed HEAD >/dev/null 2>&1; G checkout -q -- src/lib/alpha.ts 2>/dev/null

echo
echo "passed: $pass   failed: $fail   xfail: $xfail"
[ "$fail" -eq 0 ] || exit 1
