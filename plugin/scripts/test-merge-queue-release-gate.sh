#!/bin/bash
# Canary for merge-queue.sh's launched-project gate (DR-138 / INFRA-8): once a project is launched
# externally, GitHub main is production, so the queue must hand back (exit 21) instead of landing,
# and land + push only with PANDACORP_OWNER_RELEASE_OK=1. Pre-launch and internal projects land as
# before, without pushing. Run from the factory repo root: bash plugin/scripts/test-merge-queue-release-gate.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
MQ="$HERE/plugin/templates/shared/.pandacorp/merge-queue.sh"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

# $1 = status.yaml body → echoes the fixture root (origin.git + app checkout + wt worktree)
fixture() {
  local root; root=$(mktemp -d)
  git init -q --bare -b main "$root/origin.git"
  git clone -q "$root/origin.git" "$root/app" 2>/dev/null
  mkdir -p "$root/app/.pandacorp"
  printf '%b' "$1" > "$root/app/.pandacorp/status.yaml"
  cp "$MQ" "$root/app/.pandacorp/merge-queue.sh"
  ( cd "$root/app" && git add -A && git commit -q -m init && git push -q origin main 2>/dev/null \
    && git worktree add -q "$root/wt" -b feature-x && cd "$root/wt" && echo x > feature.txt \
    && git add feature.txt && git commit -q -m "feat: x" )
  echo "$root"
}
run_mq() { ( cd "$1/wt" && env ${2:+$2} bash .pandacorp/merge-queue.sh >/dev/null 2>&1 ); echo $?; }
origin_has_feature() { git -C "$1/origin.git" cat-file -e main:feature.txt 2>/dev/null; }
main_has_feature()   { git -C "$1/app" cat-file -e main:feature.txt 2>/dev/null; }

echo "== launched (external): hand back without the owner's order =="
fx=$(fixture 'project: demo\nphase: release\ndeploy_target: external\n')
rc=$(run_mq "$fx")
[ "$rc" = 21 ] && ok "exit 21 without PANDACORP_OWNER_RELEASE_OK" || bad "expected 21, got $rc"
main_has_feature "$fx" && bad "main moved without the owner's order" || ok "local main untouched"
origin_has_feature "$fx" && bad "origin main moved without the owner's order" || ok "origin main untouched"
echo "== launched (external): land + push with the owner's order =="
rc=$(run_mq "$fx" PANDACORP_OWNER_RELEASE_OK=1)
[ "$rc" = 0 ] && ok "exit 0 with the release token" || bad "expected 0, got $rc"
main_has_feature "$fx" && ok "local main has the change" || bad "local main missing the change"
origin_has_feature "$fx" && ok "origin main pushed (production deploy trigger)" || bad "origin main not pushed"
rm -rf "$fx"

echo "== launched with no deploy_target: treated as external (fail-safe) =="
fx=$(fixture 'project: demo\nphase: release\n')
rc=$(run_mq "$fx")
[ "$rc" = 21 ] && ok "exit 21" || bad "expected 21, got $rc"
rm -rf "$fx"

echo "== pre-launch project: lands as before, no push =="
fx=$(fixture 'project: demo\nphase: implementation\n')
rc=$(run_mq "$fx")
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc"
main_has_feature "$fx" && ok "local main has the change" || bad "local main missing the change"
origin_has_feature "$fx" && bad "pre-launch landing pushed to origin" || ok "origin untouched"
rm -rf "$fx"

echo "== internal tool in release: lands as before, no push =="
fx=$(fixture 'project: demo\nphase: release\ndeploy_target: internal  # local\n')
rc=$(run_mq "$fx")
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc"
origin_has_feature "$fx" && bad "internal landing pushed to origin" || ok "origin untouched"
rm -rf "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
