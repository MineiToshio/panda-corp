#!/bin/bash
# Self-test for verify-before-stop.sh's BL-0044 fast-path: proves the Stop gate SKIPS the
# whole-program `.pandacorp/verify.sh` run when (a) the tree is clean, (b) HEAD matches the last
# GREEN commit recorded in last-green.json, AND (c) this session's own .touched marker (DR-099)
# is absent or empty — and that ANY of those three failing still runs the gate exactly as before
# (fail-closed). Also proves last-green.json is written ONLY after a GREEN run, at the commit that
# run verified, and that the pre-existing active-build guards still short-circuit first (constitution
# §24: a check that cannot fail proves nothing). Run from the factory repo root:
#   bash plugin/scripts/test-verify-before-stop.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$HERE/plugin/scripts/verify-before-stop.sh"
pass=0; fail=0

# F2's StopGate telemetry (memo docs/proposals/37 §A.1) is fire-and-forget NDJSON appended to the
# REAL, shared ~/.claude/dashboard-events.ndjson in production. A test must never write shared
# mutable state (quality-and-testing.md), so every hook invocation below is pointed at this scratch
# file instead via PANDACORP_EVENTS_LOG — the real stream is never touched by this suite.
EVENTS_LOG_SCRATCH=$(mktemp)
trap 'rm -f "$EVENTS_LOG_SCRATCH"' EXIT

make_fixture() { # git repo with a stub .pandacorp/verify.sh that records whether it ran
  local d
  # Resolve to the canonical (symlink-free) path: macOS' mktemp -d returns a path under
  # /var/folders/..., itself a symlink to /private/var/folders/...; `git rev-parse --show-toplevel`
  # resolves it, so a `.touched` marker written against the UNRESOLVED path (as F2's own
  # touch_and_dirty helper does, matching how a real session records its own edits) would never
  # string-match the resolved repo_root the DR-099 attribution logic strips against. Fixing the
  # fixture's own path — not the hook's attribution logic, which this only exercises — is correct
  # here: real sessions run against real (non-tmp) project directories, never a symlinked alias.
  d=$(cd "$(mktemp -d)" && pwd -P)
  mkdir -p "$d/.pandacorp/run/sessions"
  cat > "$d/.pandacorp/verify.sh" <<'EOF'
#!/bin/bash
run_dir="$(cd "$(dirname "$0")" && pwd)/run"
mkdir -p "$run_dir"
echo invoked >> "$run_dir/verify-invocations"
printf '%s\n' "$*" >> "$run_dir/verify-args"
code_file="$run_dir/verify-exit-code"
[ -f "$code_file" ] && exit "$(cat "$code_file")"
exit 0
EOF
  chmod +x "$d/.pandacorp/verify.sh"
  # .pandacorp/ (run/ + verify.sh) must be gitignored, exactly like the real projects (see
  # mission-control/.gitignore, root .gitignore), so touched markers and the invocation log
  # never register as "dirty" to condition (a) — only a REAL working-tree change should.
  printf '.pandacorp/\n' > "$d/.gitignore"
  ( cd "$d" && git init -q \
      && git add .gitignore \
      && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" commit -q -m "fixture baseline" )
  echo "$d"
}

run_hook() { # $1 fixture dir, $2 session_id -> sets $rc and $out
  local payload
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$1")" "$(jq -Rs . <<< "$2")")
  out=$(PANDACORP_EVENTS_LOG="$EVENTS_LOG_SCRATCH" bash "$HOOK" <<< "$payload" 2>&1)
  rc=$?
}

check() { # $1 label, $2 expected rc, $3 expect_verify_invoked(0/1), $4 fixture dir, $5 session_id
  rm -f "$4/.pandacorp/run/verify-invocations"
  run_hook "$4" "$5"
  local invoked=0
  [ -s "$4/.pandacorp/run/verify-invocations" ] && invoked=1
  local ok=1
  [ "$rc" = "$2" ] || ok=0
  [ "$invoked" = "$3" ] || ok=0
  if [ "$ok" = "1" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2 invoked=$3, got rc=$rc invoked=$invoked): $out"; fail=$((fail+1))
  fi
}

echo "== verify-before-stop.sh BL-0044 fast-path self-test =="

# --- F2 helpers: rigor-scoped gate (memo docs/proposals/37 §A.1) --------------------------------
# These scenarios use the REAL classify-change.sh (and its node engine) against synthetic diffs —
# not a stubbed classifier — so the mapping is proven against the actual signal logic, not a
# fixture's assumption about it (constitution §24: a check that cannot fail proves nothing).

last_verify_args() { tail -1 "$1/.pandacorp/run/verify-args" 2>/dev/null; } # $1 fixture dir

run_hook_with() { # $1 env assignments ("KEY=VAL ..." or ""), $2 fixture dir, $3 session_id -> $rc/$out
  local payload
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$2")" "$(jq -Rs . <<< "$3")")
  out=$(env $1 PANDACORP_EVENTS_LOG="$EVENTS_LOG_SCRATCH" bash "$HOOK" <<< "$payload" 2>&1)
  rc=$?
}

# A PATH containing git/jq/bash/timeout/coreutils but NO node, built from individual symlinks
# (never a whole real bin dir) — on this class of machine git and node can share a directory
# (e.g. both live in /opt/homebrew/bin), so only a per-binary allowlist can hide node reliably.
make_node_blind_path() {
  local d
  d=$(mktemp -d)
  for tool in git jq bash sh timeout gtimeout dirname basename mkdir mktemp mv date sed grep comm cat rm env printf head tail sort comm; do
    local src
    src=$(command -v "$tool" 2>/dev/null) || continue
    ln -sf "$src" "$d/$tool" 2>/dev/null
  done
  echo "$d"
}

run_hook_node_blind() { # $1 fixture dir, $2 session_id -> $rc/$out; classify-change.sh sees no `node`
  local payload blind_bin
  blind_bin=$(make_node_blind_path)
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$1")" "$(jq -Rs . <<< "$2")")
  out=$(env -i PATH="$blind_bin" HOME="$HOME" PANDACORP_EVENTS_LOG="$EVENTS_LOG_SCRATCH" bash "$HOOK" <<< "$payload" 2>&1)
  rc=$?
  rm -rf "$blind_bin"
}

# Writes $4 to path $3 (relative to fixture $1, parent dir must already exist) AND records it as
# THIS session's own edit (DR-099 `.touched` marker) — the two-part eligibility gate (dirty tree +
# non-empty .touched) the F2 rigor classification requires before it runs at all.
touch_and_dirty() { # $1 fixture dir, $2 session_id, $3 relative path, $4 content
  printf '%s\n' "$4" > "$1/$3"
  printf '%s/%s\n' "$1" "$3" > "$1/.pandacorp/run/sessions/$2.touched"
}

# A fresh fixture with a certified FULL-green anchor already recorded (a clean-tree, nothing-touched
# run: the classify block never engages, so scope defaults to "full" by construction) -> prints its dir.
seed_fixture_with_green() {
  local d
  d=$(make_fixture)
  run_hook_with "" "$d" "sid-f2-seed-$RANDOM"
  echo "$d"
}

NON_FLOOR_DIFF='body { color: red; }
body { margin: 1px; }
body { padding: 2px; }
.a { color: blue; }
.b { color: green; }
.c { color: yellow; }
.d { color: pink; }
.e { color: purple; }'

echo
echo "== F2: rigor-scoped Stop gate self-test (memo docs/proposals/37 §A.1) =="

fx=$(make_fixture)
head_sha=$(git -C "$fx" rev-parse HEAD)

# 1. No last-green.json yet -> doubt -> gate runs (GREEN, so it also writes last-green.json)
check "no last-green.json yet -> gate runs" 0 1 "$fx" "sid-a"

if [ -f "$fx/.pandacorp/run/last-green.json" ] && [ "$(jq -r .sha "$fx/.pandacorp/run/last-green.json")" = "$head_sha" ]; then
  echo "  ✓ GREEN run wrote last-green.json with HEAD"; pass=$((pass+1))
else
  echo "  ✗ GREEN run did not write last-green.json correctly"; fail=$((fail+1))
fi

# 2. Clean tree + HEAD==last-green + no touched marker at all -> FAST-PATH, verify.sh NOT invoked
check "clean + HEAD==last-green + no touched marker -> fast-path" 0 0 "$fx" "sid-b"

# 3. Dirty tree -> gate runs even though HEAD==last-green
echo "dirty" > "$fx/dirty.md"
check "dirty tree -> gate runs" 0 1 "$fx" "sid-c"
rm -f "$fx/dirty.md"

# 4. Non-empty touched marker -> gate runs even on an otherwise clean, HEAD-matching tree
printf '%s/some/file.ts\n' "$fx" > "$fx/.pandacorp/run/sessions/sid-d.touched"
check "non-empty touched marker -> gate runs" 0 1 "$fx" "sid-d"

# 5. touched marker EXISTS but is EMPTY -> still eligible for fast-path
: > "$fx/.pandacorp/run/sessions/sid-e.touched"
check "empty touched marker -> fast-path" 0 0 "$fx" "sid-e"

# 5b. D8: an EMPTY session_id -> the hook cannot name a .touched marker to check, so it cannot
# know this session wrote nothing -> fail-closed, gate runs (never a fast-path on a missing sid),
# even though the tree is otherwise clean and HEAD == last-green (the exact condition that gave
# check 2/5 above a fast-path with a real sid).
check "empty session_id -> gate runs (fail-closed, no fast-path)" 0 1 "$fx" ""

# 6. A new commit moves HEAD away from the recorded green sha -> doubt -> gate runs
git -C "$fx" commit -q --allow-empty -m "advance HEAD"
new_sha=$(git -C "$fx" rev-parse HEAD)
check "HEAD != last-green -> gate runs" 0 1 "$fx" "sid-f"
if [ "$(jq -r .sha "$fx/.pandacorp/run/last-green.json")" = "$new_sha" ]; then
  echo "  ✓ last-green.json advanced to the new HEAD after the fresh GREEN run"; pass=$((pass+1))
else
  echo "  ✗ last-green.json did not advance to the new HEAD"; fail=$((fail+1))
fi

# 7. Fast-path re-engages once clean + HEAD == the newly recorded green sha again
check "fast-path re-engages after HEAD/last-green realign" 0 0 "$fx" "sid-g"

rm -rf "$fx"

# 8. RED verify.sh: last-green.json must NOT be written; exit code stays 2 (unchanged contract)
fy=$(make_fixture)
mkdir -p "$fy/.pandacorp/run"
echo 2 > "$fy/.pandacorp/run/verify-exit-code"
check "RED verify.sh -> gate blocks (rc=2), no last-green.json written" 2 1 "$fy" "sid-h"
if [ ! -f "$fy/.pandacorp/run/last-green.json" ]; then
  echo "  ✓ RED run did not write last-green.json"; pass=$((pass+1))
else
  echo "  ✗ RED run incorrectly wrote last-green.json"; fail=$((fail+1))
fi
rm -rf "$fy"

# 9. Regression: the pre-existing active-build guard (build.lock, DR-063) still short-circuits
# BEFORE the fast-path logic is even evaluated — a fresh lock skips verify.sh regardless of a
# dirty tree, exactly as before this change (guards intact).
fz=$(make_fixture)
mkdir -p "$fz/.pandacorp/run"
: > "$fz/.pandacorp/run/build.lock"
echo "dirty-during-build" > "$fz/dirty.md"
check "active build.lock still skips verify.sh (guard intact)" 0 0 "$fz" "sid-i"
rm -rf "$fz"


# (a) a small non-floor diff (classifies micro/normal), WITH a reachable last-green anchor
# -> verify.sh must be invoked scoped `--since <anchor_sha>`.
fa=$(seed_fixture_with_green)
anchor_a=$(git -C "$fa" rev-parse HEAD)
touch_and_dirty "$fa" "sid-a" "styles.css" "$NON_FLOOR_DIFF"
rm -f "$fa/.pandacorp/run/verify-args"
run_hook_with "" "$fa" "sid-a"
args_a=$(last_verify_args "$fa")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_a" in *"--since $anchor_a"*) : ;; *) ok=0 ;; esac
if [ "$ok" = "1" ]; then
  echo "  ✓ (a) non-floor diff + valid last-green -> verify.sh --since $anchor_a"; pass=$((pass+1))
else
  echo "  ✗ (a) expected verify.sh --since $anchor_a, got args=[$args_a] rc=$rc: $out"; fail=$((fail+1))
fi

# StopGate telemetry: the run above must have appended one well-shaped event (proj resolvable,
# scope=since, green=true, a numeric duration_ms) to the SCRATCH log, never the real one.
stopgate_line=$(grep '"event":"StopGate"' "$EVENTS_LOG_SCRATCH" | tail -1)
ok=1
[ -n "$stopgate_line" ] || ok=0
[ "$(printf '%s' "$stopgate_line" | jq -r '.scope' 2>/dev/null)" = "since" ] || ok=0
[ "$(printf '%s' "$stopgate_line" | jq -r '.green' 2>/dev/null)" = "true" ] || ok=0
printf '%s' "$stopgate_line" | jq -e '.duration_ms | type == "number"' >/dev/null 2>&1 || ok=0
if [ "$ok" = "1" ]; then
  echo "  ✓ (a2) StopGate event emitted to the scratch log with rigor/scope/green/duration_ms"; pass=$((pass+1))
else
  echo "  ✗ (a2) StopGate event missing or malformed: [$stopgate_line]"; fail=$((fail+1))
fi
rm -rf "$fa"

# (b) a diff touching src/app/api (the S5 auth/data floor -> critical) -> verify.sh invoked
# UNSCOPED even though a valid last-green anchor exists (max-wins, critical always gets the full gate).
fb=$(seed_fixture_with_green)
mkdir -p "$fb/src/app/api/widgets"
touch_and_dirty "$fb" "sid-b" "src/app/api/widgets/route.ts" 'export async function GET() { return new Response("ok"); }'
rm -f "$fb/.pandacorp/run/verify-args"
run_hook_with "" "$fb" "sid-b"
args_b=$(last_verify_args "$fb")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_b" in *"--since"*) ok=0 ;; esac
if [ "$ok" = "1" ]; then
  echo "  ✓ (b) src/app/api diff (critical floor) -> verify.sh unscoped"; pass=$((pass+1))
else
  echo "  ✗ (b) expected verify.sh with NO --since, got args=[$args_b] rc=$rc: $out"; fail=$((fail+1))
fi
rm -rf "$fb"

# (c) a non-floor diff but NO last-green.json exists yet -> no anchor to scope from -> full gate.
fc=$(make_fixture)
touch_and_dirty "$fc" "sid-c" "notes.md" "just docs, nothing special"
rm -f "$fc/.pandacorp/run/verify-args"
run_hook_with "" "$fc" "sid-c"
args_c=$(last_verify_args "$fc")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_c" in *"--since"*) ok=0 ;; esac
if [ "$ok" = "1" ]; then
  echo "  ✓ (c) non-floor diff, no last-green.json -> verify.sh unscoped"; pass=$((pass+1))
else
  echo "  ✗ (c) expected verify.sh with NO --since, got args=[$args_c] rc=$rc: $out"; fail=$((fail+1))
fi
rm -rf "$fc"

# (d) the classifier cannot run at all (no `node` reachable) -> fails closed to the full gate,
# with an auditable log line explaining why (never a silent full — a broken classifier must be
# visibly the reason, memo §A.2).
fd=$(seed_fixture_with_green)
touch_and_dirty "$fd" "sid-d" "notes2.md" "trivial change"
rm -f "$fd/.pandacorp/run/verify-args"
run_hook_node_blind "$fd" "sid-d"
args_d=$(last_verify_args "$fd")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_d" in *"--since"*) ok=0 ;; esac
case "$out" in *"failing closed"*) : ;; *) ok=0 ;; esac
if [ "$ok" = "1" ]; then
  echo "  ✓ (d) classifier unreachable (no node) -> fails closed to the full gate, logged"; pass=$((pass+1))
else
  echo "  ✗ (d) expected unscoped verify.sh + a fail-closed log line, got args=[$args_d] rc=$rc: $out"; fail=$((fail+1))
fi
rm -rf "$fd"

# (e) a GREEN `--since`-scoped run must NOT rewrite last-green.json — the anchor stays whatever the
# last FULL green certified, so a later scoped run never anchors off a commit that was never itself
# fully verified.
fe=$(seed_fixture_with_green)
anchor_e=$(git -C "$fe" rev-parse HEAD)
before_lg=$(cat "$fe/.pandacorp/run/last-green.json")
touch_and_dirty "$fe" "sid-e" "styles2.css" "$NON_FLOOR_DIFF"
run_hook_with "" "$fe" "sid-e"
after_lg=$(cat "$fe/.pandacorp/run/last-green.json" 2>/dev/null)
args_e=$(last_verify_args "$fe")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_e" in *"--since $anchor_e"*) : ;; *) ok=0 ;; esac   # confirm this run WAS scoped
[ "$before_lg" = "$after_lg" ] || ok=0                          # ...yet last-green.json is untouched
if [ "$ok" = "1" ]; then
  echo "  ✓ (e) GREEN --since run does NOT rewrite last-green.json"; pass=$((pass+1))
else
  echo "  ✗ (e) last-green.json changed by a --since run (before=[$before_lg] after=[$after_lg] args=[$args_e])"; fail=$((fail+1))
fi
rm -rf "$fe"

# (f) a GREEN full-scope run DOES write/advance last-green.json to the commit it verified (this is
# also exercised by seed_fixture_with_green itself in every scenario above; asserted explicitly here).
ff=$(make_fixture)
run_hook_with "" "$ff" "sid-f"
head_f=$(git -C "$ff" rev-parse HEAD)
lg_sha_f=$(jq -r .sha "$ff/.pandacorp/run/last-green.json" 2>/dev/null)
ok=1
[ "$rc" = "0" ] || ok=0
[ "$lg_sha_f" = "$head_f" ] || ok=0
if [ "$ok" = "1" ]; then
  echo "  ✓ (f) GREEN full-scope run writes last-green.json at HEAD"; pass=$((pass+1))
else
  echo "  ✗ (f) expected last-green.json.sha=$head_f, got [$lg_sha_f]"; fail=$((fail+1))
fi
rm -rf "$ff"

# (g) PANDACORP_STOP_GATE=full forces the full gate even for an otherwise --since-eligible diff.
fg=$(seed_fixture_with_green)
touch_and_dirty "$fg" "sid-g" "styles3.css" "$NON_FLOOR_DIFF"
rm -f "$fg/.pandacorp/run/verify-args"
run_hook_with "PANDACORP_STOP_GATE=full" "$fg" "sid-g"
args_g=$(last_verify_args "$fg")
ok=1
[ "$rc" = "0" ] || ok=0
case "$args_g" in *"--since"*) ok=0 ;; esac
case "$out" in *"scope=full"*) : ;; *) ok=0 ;; esac
if [ "$ok" = "1" ]; then
  echo "  ✓ (g) PANDACORP_STOP_GATE=full overrides an eligible --since -> full gate"; pass=$((pass+1))
else
  echo "  ✗ (g) expected forced full gate, got args=[$args_g] rc=$rc: $out"; fail=$((fail+1))
fi
rm -rf "$fg"

# (h) a RED `--since`-scoped run still blocks (exit 2) and DR-099 own-red attribution stays intact
# (loud block, never silenced as foreign) — scoping the SUITE never scopes what counts as a block.
fh=$(seed_fixture_with_green)
anchor_h=$(git -C "$fh" rev-parse HEAD)
touch_and_dirty "$fh" "sid-h" "styles4.css" "$NON_FLOOR_DIFF"
mkdir -p "$fh/.pandacorp/run"
echo 2 > "$fh/.pandacorp/run/verify-exit-code"
rm -f "$fh/.pandacorp/run/verify-args"
run_hook_with "" "$fh" "sid-h"
args_h=$(last_verify_args "$fh")
after_lg_h=$(jq -r .sha "$fh/.pandacorp/run/last-green.json" 2>/dev/null)
ok=1
[ "$rc" = "2" ] || ok=0
case "$args_h" in *"--since $anchor_h"*) : ;; *) ok=0 ;; esac
case "$out" in *"Pandacorp verify gate FAILED"*) : ;; *) ok=0 ;; esac
[ "$after_lg_h" = "$anchor_h" ] || ok=0   # RED run must not advance/touch last-green.json
if [ "$ok" = "1" ]; then
  echo "  ✓ (h) RED --since run -> exit 2, blocked loudly, DR-099 attribution intact"; pass=$((pass+1))
else
  echo "  ✗ (h) expected rc=2 + loud block + untouched last-green.json, got rc=$rc args=[$args_h]: $out"; fail=$((fail+1))
fi
rm -rf "$fh"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
