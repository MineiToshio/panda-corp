#!/bin/bash
# Self-test for verify-before-stop.sh (DR-146 light Stop gate + certified-tree fast path; DR-063
# active-build guard; DR-099 attribution; StopGate telemetry). Proves:
#   - the fast path fires ONLY on a tree green-stamp.sh certifies (same tree, clean, same verify.sh,
#     fresh stamp) — a missing, stale, corrupt, foreign-tree or changed-gate stamp runs the gate;
#   - the default gate is `verify.sh --light` plus `--tests=` exactly the test files that belong to
#     this session's own edits — never Playwright, never the whole vitest suite, never `--since`;
#   - an overlay whose verify.sh predates `--light` keeps the full gate (fail-closed);
#   - reds still block (own) or stay silent (foreign, DR-099); the hook never certifies anything.
# Run from the factory repo root:  bash plugin/scripts/test-verify-before-stop.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$HERE/plugin/scripts/verify-before-stop.sh"
STAMP_SH="$HERE/plugin/templates/shared/.pandacorp/green-stamp.sh"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

# StopGate telemetry goes to a scratch file — a test never writes the real shared stream.
EVENTS_LOG_SCRATCH=$(mktemp)
trap 'rm -f "$EVENTS_LOG_SCRATCH"' EXIT

# A git repo with a stub .pandacorp/verify.sh that records each invocation's argv. LIGHT=1 makes the
# stub advertise the DR-146 flags (the hook detects them by text, as in a real verify.sh).
make_fixture() { # $1 = light-capable (1/0)
  local d
  d=$(cd "$(mktemp -d)" && pwd -P)   # canonical path, as git rev-parse --show-toplevel reports it
  mkdir -p "$d/.pandacorp/run/sessions" "$d/src/lib/_tests" "$d/e2e"
  {
    echo '#!/bin/bash'
    [ "${1:-1}" = "1" ] && printf '%s\n' '# flags:  --light)  --tests=*)'
    cat <<'EOF'
run_dir="$(cd "$(dirname "$0")" && pwd)/run"
mkdir -p "$run_dir"
echo invoked >> "$run_dir/verify-invocations"
printf '%s\n' "$*" >> "$run_dir/verify-args"
[ -f "$run_dir/verify-output" ] && cat "$run_dir/verify-output"
code_file="$run_dir/verify-exit-code"
[ -f "$code_file" ] && exit "$(cat "$code_file")"
exit 0
EOF
  } > "$d/.pandacorp/verify.sh"
  chmod +x "$d/.pandacorp/verify.sh"
  cp "$STAMP_SH" "$d/.pandacorp/green-stamp.sh"
  printf 'export const foo = 1\n' > "$d/src/lib/foo.ts"
  printf 'test("foo")\n' > "$d/src/lib/_tests/foo.test.ts"
  printf 'test("foo extra")\n' > "$d/src/lib/_tests/foo.extra.test.ts"
  printf 'test("bar")\n' > "$d/src/lib/_tests/bar.test.ts"
  printf 'export const bar = 2\n' > "$d/src/lib/bar.ts"
  printf 'test("e2e")\n' > "$d/e2e/smoke.spec.ts"
  printf '.pandacorp/\n' > "$d/.gitignore"   # like real projects: run state never dirties the tree
  ( cd "$d" && git init -q && git add -A \
      && git -c user.email=t@pandacorp.local -c user.name=T -c commit.gpgsign=false commit -qm base )
  echo "$d"
}

run_hook() { # $1 fixture, $2 session_id, $3 extra env ("" or "K=V") -> $rc $out
  local payload
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$1")" "$(jq -Rs . <<< "$2")")
  rm -f "$1/.pandacorp/run/verify-invocations" "$1/.pandacorp/run/verify-args"
  out=$(env ${3:-} PANDACORP_EVENTS_LOG="$EVENTS_LOG_SCRATCH" bash "$HOOK" <<< "$payload" 2>&1)
  rc=$?
  [ -f "$1/.pandacorp/run/verify-args" ] && cat "$1/.pandacorp/run/verify-args" >> "$1/.pandacorp/run/all-args"
  return 0
}
invoked() { [ -s "$1/.pandacorp/run/verify-invocations" ]; }
args_of() { tail -1 "$1/.pandacorp/run/verify-args" 2>/dev/null; }
certify() { ( cd "$1" && bash .pandacorp/green-stamp.sh record "$(git rev-parse 'HEAD^{tree}')" >/dev/null ); }
mark_touched() { # $1 fixture, $2 sid, rest = repo-relative paths
  local d="$1" s="$2"; shift 2
  for p in "$@"; do printf '%s/%s\n' "$d" "$p" >> "$d/.pandacorp/run/sessions/$s.touched"; done
}

echo "== verify-before-stop.sh: certified-tree fast path (DR-146) =="

fx=$(make_fixture 1)
run_hook "$fx" "sid-a" ""
if [ "$rc" = 0 ] && invoked "$fx" && [ "$(args_of "$fx")" = "--light" ]; then
  ok "no stamp -> the light gate runs (verify.sh --light)"
else bad "no stamp: expected verify.sh --light, got rc=$rc args=[$(args_of "$fx")]: $out"; fi

certify "$fx"
run_hook "$fx" "sid-b" ""
if [ "$rc" = 0 ] && ! invoked "$fx" && echo "$out" | grep -q 'fast-path \[certified-tree\]'; then
  ok "clean tree == certified tree -> fast path, verify.sh not invoked"
else bad "certified tree: expected fast path, got rc=$rc invoked=$(invoked "$fx" && echo y || echo n): $out"; fi

mark_touched "$fx" "sid-c" src/lib/foo.ts
run_hook "$fx" "sid-c" ""
if [ "$rc" = 0 ] && ! invoked "$fx"; then
  ok "a session that edited files but left the certified tree byte-identical still fast-paths"
else bad "touched-but-identical tree should fast-path (rc=$rc): $out"; fi

echo "dirty" > "$fx/notes.md"
run_hook "$fx" "sid-d" ""
if [ "$rc" = 0 ] && invoked "$fx"; then ok "dirty tree (untracked file) -> gate runs"
else bad "dirty tree must run the gate (rc=$rc): $out"; fi
rm -f "$fx/notes.md"

git -C "$fx" update-index --skip-worktree src/lib/bar.ts
run_hook "$fx" "sid-d2" ""
if invoked "$fx"; then ok "skip-worktree entry hides local edits -> not certified, gate runs"
else bad "skip-worktree entry must defeat the fast path: $out"; fi
git -C "$fx" update-index --no-skip-worktree src/lib/bar.ts

sed -i.bak 's/^tree=.*/tree=0123456789abcdef0123456789abcdef01234567/' "$fx/.pandacorp/run/green-stamp"
run_hook "$fx" "sid-e" ""
if invoked "$fx"; then ok "stamp for another tree -> gate runs"; else bad "foreign-tree stamp trusted: $out"; fi

printf 'garbage\n' > "$fx/.pandacorp/run/green-stamp"
run_hook "$fx" "sid-f" ""
if invoked "$fx"; then ok "corrupt stamp -> gate runs"; else bad "corrupt stamp trusted: $out"; fi

certify "$fx"
sed -i.bak "s/^at_epoch=.*/at_epoch=$(( $(date +%s) - 13 * 3600 ))/" "$fx/.pandacorp/run/green-stamp"
run_hook "$fx" "sid-g" ""
if invoked "$fx"; then ok "stamp older than 12 h -> gate runs"; else bad "stale stamp trusted: $out"; fi

certify "$fx"
echo '# gate edited' >> "$fx/.pandacorp/verify.sh"
run_hook "$fx" "sid-h" ""
if invoked "$fx"; then ok "verify.sh changed since the certifying run -> gate runs"; else bad "changed-gate stamp trusted: $out"; fi

certify "$fx"
git -C "$fx" commit -q --allow-empty -m "same tree, new commit"
run_hook "$fx" "sid-i" ""
if ! invoked "$fx"; then ok "a new commit with the SAME tree keeps the fast path (keyed by tree, not HEAD)"
else bad "same-tree commit lost the fast path: $out"; fi
echo 'export const baz = 3' > "$fx/src/lib/baz.ts"; git -C "$fx" add -A; git -C "$fx" -c user.email=t@x -c user.name=T commit -qm "new tree"
run_hook "$fx" "sid-j" ""
if invoked "$fx"; then ok "a commit that changes the tree -> gate runs"; else bad "changed tree fast-pathed: $out"; fi
if [ ! -f "$fx/.pandacorp/run/last-green.json" ]; then ok "the hook never writes the retired last-green.json"
else bad "last-green.json was written"; fi
rm -rf "$fx"

echo
echo "== light gate: related tests from this session's own edits =="

fx=$(make_fixture 1)
echo 'export const foo = 2' > "$fx/src/lib/foo.ts"
mark_touched "$fx" "sid-k" src/lib/foo.ts e2e/smoke.spec.ts
printf '%s\n' "/elsewhere/project/src/lib/foo.ts" >> "$fx/.pandacorp/run/sessions/sid-k.touched"
run_hook "$fx" "sid-k" ""
if [ "$rc" = 0 ] && [ "$(args_of "$fx")" = "--light --tests=src/lib/_tests/foo.extra.test.ts,src/lib/_tests/foo.test.ts" ]; then
  ok "edited source -> its _tests siblings only (unrelated bar.test, e2e spec and out-of-project paths excluded)"
else bad "related tests wrong: args=[$(args_of "$fx")]: $out"; fi

mark_touched "$fx" "sid-l" src/lib/_tests/bar.test.ts
run_hook "$fx" "sid-l" ""
if [ "$(args_of "$fx")" = "--light --tests=src/lib/_tests/bar.test.ts" ]; then
  ok "an edited test file runs itself"
else bad "edited test file not run: args=[$(args_of "$fx")]"; fi

run_hook "$fx" "" ""
if [ "$(args_of "$fx")" = "--light" ]; then ok "no session id -> static stages only (never the whole suite)"
else bad "no-sid run args=[$(args_of "$fx")]"; fi

for i in $(seq 1 51); do printf 'test("x")\n' > "$fx/src/lib/_tests/m$i.test.ts"; mark_touched "$fx" "sid-cap" "src/lib/_tests/m$i.test.ts"; done
run_hook "$fx" "sid-cap" ""
if [ "$(args_of "$fx")" = "--light" ] && echo "$out" | grep -q 'cap 50'; then
  ok "over 50 related test files -> static stages only, logged (never an unbounded vitest run)"
else bad "cap not honoured: args=[$(args_of "$fx")]: $out"; fi

# Across every scenario: the Stop gate never passed --since/--only/--files and never ran without --light.
all_args=$(cat "$fx/.pandacorp/run/all-args" 2>/dev/null)
if ! printf '%s\n' "$all_args" | grep -qE -- '--since|--only|--files' && ! printf '%s\n' "$all_args" | grep -qv -- '--light'; then
  ok "every default Stop-gate run is --light (no --since/--only/--files, never the full suite)"
else bad "a default Stop-gate run left the light gate: [$all_args]"; fi
rm -rf "$fx"

echo
echo "== fail-closed fallbacks and escape hatch =="

fx=$(make_fixture 0)
run_hook "$fx" "sid-m" ""
if [ "$rc" = 0 ] && invoked "$fx" && [ -z "$(args_of "$fx")" ] && echo "$out" | grep -q 'predates the light Stop gate'; then
  ok "verify.sh without --light (older overlay) -> full gate, logged"
else bad "legacy overlay: expected unscoped full gate, args=[$(args_of "$fx")]: $out"; fi
rm -rf "$fx"

fx=$(make_fixture 1)
run_hook "$fx" "sid-n" "PANDACORP_STOP_GATE=full"
if [ -z "$(args_of "$fx")" ] && echo "$out" | grep -q 'scope=full'; then ok "PANDACORP_STOP_GATE=full forces the full gate"
else bad "forced full ignored: args=[$(args_of "$fx")]"; fi
for junk in off 0 none skip FULL; do
  run_hook "$fx" "sid-o" "PANDACORP_STOP_GATE=$junk"
  if [ "$rc" = 0 ] && invoked "$fx"; then ok "PANDACORP_STOP_GATE=$junk still runs the gate (no 'off' value)"
  else bad "PANDACORP_STOP_GATE=$junk skipped the gate"; fi
done
rm -rf "$fx"

fx=$(make_fixture 1)
: > "$fx/.pandacorp/run/build.lock"
echo dirty > "$fx/dirty.md"
run_hook "$fx" "sid-p" ""
if [ "$rc" = 0 ] && ! invoked "$fx"; then ok "fresh build.lock still stands the hook aside (DR-063)"
else bad "build.lock guard broken"; fi
rm -rf "$fx"

payload=$(printf '{"cwd":"/nonexistent","session_id":"s","stop_hook_active":true}')
if bash "$HOOK" <<< "$payload" >/dev/null 2>&1; then ok "stop_hook_active=true -> allow (no loop)"; else bad "stop_hook_active loop guard broken"; fi

echo
echo "== reds: own blocks, foreign stays silent (DR-099), telemetry honest =="

fx=$(make_fixture 1)
echo 'export const foo = 9' > "$fx/src/lib/foo.ts"
mark_touched "$fx" "sid-q" src/lib/foo.ts
echo 2 > "$fx/.pandacorp/run/verify-exit-code"
: > "$EVENTS_LOG_SCRATCH"
run_hook "$fx" "sid-q" ""
line=$(grep '"event":"StopGate"' "$EVENTS_LOG_SCRATCH" | tail -1)
if [ "$rc" = 2 ] && echo "$out" | grep -q 'verify gate FAILED' && echo "$out" | grep -q 'reproduce with: bash .pandacorp/verify.sh --light' \
   && [ "$(printf '%s' "$line" | jq -r .green)" = false ] && [ "$(printf '%s' "$line" | jq -r .scope)" = light ]; then
  ok "own red (touched file dirty) -> exit 2 with reproduce line; StopGate{green:false,scope:light}"
else bad "own red not blocked/logged (rc=$rc line=[$line]): $out"; fi
git -C "$fx" checkout -q -- src/lib/foo.ts
echo 'broken' > "$fx/src/lib/bar.ts"
echo 'src/lib/bar.ts:1:1 lint error' > "$fx/.pandacorp/run/verify-output"
run_hook "$fx" "sid-q" ""
if [ "$rc" = 0 ] && ! echo "$out" | grep -q FAILED && grep -q 'foreign-red' "$fx/.pandacorp/run/foreign-red.log" 2>/dev/null; then
  ok "foreign red (only another session's file dirty/blamed) -> silent allow, logged for PULL"
else bad "foreign red not handled silently (rc=$rc): $out"; fi
rm -rf "$fx"

real_stream="$HOME/.claude/dashboard-events.ndjson"
leaked=0
[ -f "$real_stream" ] && leaked=$(tail -500 "$real_stream" | grep '"event":"StopGate"' | grep -c '"project":"tmp\.' || true)
if [ "${leaked:-0}" = 0 ]; then ok "no StopGate event from a scratch fixture reached the real stream"
else bad "$leaked scratch StopGate events leaked into $real_stream"; fi

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
