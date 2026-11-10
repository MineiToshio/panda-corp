#!/bin/bash
# DR-146: merge-queue.sh skips its integration gate ONLY on a tree the real verify.sh already
# certified (real template verify.sh + real green-stamp.sh + real merge-queue.sh; only `pnpm` is a
# stub that logs each call, so "a full gate ran" is observable as one `pnpm tsc` line). Proves:
#   - skip on the identical certified tree (no new gate run), stamp handed to the main checkout;
#   - full gate on: an advanced main (different tree), no stamp, a partial/--light-only stamp,
#     a corrupt stamp, a stamp older than 12 h;
#   - DR-138 intact: a certified launched project still stops at exit 21 without the owner's order,
#     and lands + pushes with it.
# Run from the factory repo root:  bash plugin/scripts/test-merge-queue-certified-tree.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
T="$HERE/plugin/templates"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

# $1 = status.yaml body -> fixture root with origin.git, app (main) and wt (branch feature-x, 1 commit).
fixture() {
  local root; root=$(cd "$(mktemp -d)" && pwd -P)
  git init -q --bare -b main "$root/origin.git"
  git clone -q "$root/origin.git" "$root/app" 2>/dev/null
  local a="$root/app"
  mkdir -p "$a/.pandacorp" "$a/src/_tests" "$a/e2e" "$a/bin"
  printf '%b' "$1" > "$a/.pandacorp/status.yaml"
  cp "$T/shared/.pandacorp/merge-queue.sh" "$T/shared/.pandacorp/green-stamp.sh" "$a/.pandacorp/"
  cp "$T/stack-a-nextjs/verify.sh" "$a/.pandacorp/verify.sh"
  chmod +x "$a/.pandacorp/verify.sh"
  : > "$a/playwright.config.ts"
  for f in smoke visual responsive shell headers; do : > "$a/e2e/$f.spec.ts"; done
  echo '{"name":"mq-fixture"}' > "$a/package.json"
  printf '#!/bin/bash\nprintf "pnpm %%s\\n" "$*" >> "$MQ_PNPM_LOG"\n[ "$1" = tsc ] && [ -f fail-tsc ] && exit 1\nexit 0\n' > "$a/bin/pnpm"
  chmod +x "$a/bin/pnpm"
  printf '.pandacorp/run/\n' > "$a/.gitignore"
  ( cd "$a" && git add -A && git commit -q -m init && git push -q origin main 2>/dev/null \
    && git worktree add -q "$root/wt" -b feature-x && cd "$root/wt" && echo x > feature.txt \
    && git add feature.txt && git commit -q -m "feat: x" )
  echo "$root"
}
export MQ_PNPM_LOG
gates() { grep -c '^pnpm tsc' "$MQ_PNPM_LOG" 2>/dev/null || true; }
verify_in() { ( cd "$1" && PATH="$1/bin:$PATH" bash .pandacorp/verify.sh "${@:2}" >/dev/null 2>&1 ); }
run_mq() { # $1 dir, $2 env -> sets rc, log
  log=$( cd "$1" && env PATH="$1/bin:$PATH" ${2:-} bash .pandacorp/merge-queue.sh 2>&1 ); rc=$?
}
main_has() { git -C "$1/app" cat-file -e main:feature.txt 2>/dev/null; }

echo "== identical certified tree -> skip =="
fx=$(fixture 'phase: implementation\n'); MQ_PNPM_LOG="$fx/pnpm.log"
verify_in "$fx/wt"
before=$(gates)
run_mq "$fx/wt"
if [ "$rc" = 0 ] && [ "$before" = 1 ] && [ "$(gates)" = 1 ] && echo "$log" | grep -q 'SKIPPED \[certified-tree\]' && main_has "$fx"; then
  ok "branch verified green on its committed tree, main unchanged -> no second gate, merged"
else bad "expected a certified skip (rc=$rc gates $before->$(gates)): $log"; fi
if ( cd "$fx/app" && bash .pandacorp/green-stamp.sh check >/dev/null 2>&1 ); then
  ok "main checkout received the stamp and its own check accepts it (Stop hooks on main fast-path)"
else bad "main checkout stamp missing or rejected"; fi
rm -rf "$fx"

echo "== any doubt -> the full gate runs exactly once =="
for case in advanced-main no-stamp light-only corrupt stale; do
  fx=$(fixture 'phase: implementation\n'); MQ_PNPM_LOG="$fx/pnpm.log"
  case "$case" in
    advanced-main)
      verify_in "$fx/wt"
      echo y > "$fx/app/other.txt"; git -C "$fx/app" add other.txt; git -C "$fx/app" commit -qm "main moves" ;;
    no-stamp) : ;;
    light-only) verify_in "$fx/wt" --light ;;
    corrupt) verify_in "$fx/wt"; printf 'version=1\ntree=zz\n' > "$fx/wt/.pandacorp/run/green-stamp" ;;
    stale) verify_in "$fx/wt"; sed -i.bak "s/^at_epoch=.*/at_epoch=$(( $(date +%s) - 13 * 3600 ))/" "$fx/wt/.pandacorp/run/green-stamp" ;;
  esac
  before=$(gates)
  run_mq "$fx/wt"
  if [ "$rc" = 0 ] && [ "$(( $(gates) - before ))" = 1 ] && echo "$log" | grep -q '\[full-gate\]' && main_has "$fx"; then
    ok "$case -> full integration gate ran once, then merged"
  else bad "$case: expected exactly one full gate (rc=$rc gates $before->$(gates)): $log"; fi
  rm -rf "$fx"
done

echo "== a red full gate still hands back (exit 11) and certifies nothing =="
fx=$(fixture 'phase: implementation\n'); MQ_PNPM_LOG="$fx/pnpm.log"
( cd "$fx/wt" && touch fail-tsc && printf 'fail-tsc\n' >> .gitignore && git add .gitignore && git commit -qm "ignore marker" )
run_mq "$fx/wt"
if [ "$rc" = 11 ] && ! main_has "$fx" && [ ! -f "$fx/wt/.pandacorp/run/green-stamp" ]; then
  ok "red integration gate -> exit 11, main untouched, no stamp"
else bad "red gate: rc=$rc: $log"; fi
rm -rf "$fx"

echo "== DR-138: a certified tree never bypasses the owner's release order =="
fx=$(fixture 'phase: release\ndeploy_target: external\n'); MQ_PNPM_LOG="$fx/pnpm.log"
run_mq "$fx/wt"
first_gates=$(gates)
if [ "$rc" = 21 ] && ! main_has "$fx" && [ "$first_gates" = 1 ]; then
  ok "launched: first pass runs the full gate and stops at exit 21"
else bad "launched first pass: rc=$rc gates=$first_gates: $log"; fi
run_mq "$fx/wt"
if [ "$rc" = 21 ] && ! main_has "$fx"; then ok "launched + certified tree, no order -> still exit 21, main untouched"
else bad "certified tree bypassed DR-138 (rc=$rc)"; fi
run_mq "$fx/wt" PANDACORP_OWNER_RELEASE_OK=1
if [ "$rc" = 0 ] && main_has "$fx" && git -C "$fx/origin.git" cat-file -e main:feature.txt 2>/dev/null \
   && [ "$(gates)" = "$first_gates" ] && echo "$log" | grep -q '\[certified-tree\]'; then
  ok "owner's order on the unchanged rebased tree -> lands + pushes without re-running the gate"
else bad "authorized retry: rc=$rc gates=$(gates): $log"; fi
rm -rf "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = 0 ]
