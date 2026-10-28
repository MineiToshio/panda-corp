#!/bin/bash
# DR-141 manual batch recipe against the real, unchanged merge queue.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
fx=$(mktemp -d)
echo "Batch fixture retained for inspection: $fx"
git init -q -b main "$fx/app"
cd "$fx/app"
git config user.name 'Batch canary'
git config user.email 'batch@example.invalid'
mkdir -p .pandacorp
cp "$ROOT/plugin/templates/shared/.pandacorp/merge-queue.sh" .pandacorp/
printf 'phase: implementation\n' > .pandacorp/status.yaml
cat > .pandacorp/verify.sh <<'GATE'
#!/bin/bash
set -euo pipefail
printf 'gate\n' >> "$BATCH_GATE_LOG"
test "$(cat first.txt)" = first
test "$(cat second.txt)" = second
test "$(cat shared.txt)" = resolved-both
test ! -f broken.txt
GATE
chmod +x .pandacorp/verify.sh
printf 'base\n' > shared.txt
git add .pandacorp shared.txt
git commit -qm 'chore(test): initialize batch fixture'
base=$(git rev-parse HEAD)
git worktree add -qb first "$fx/first" main
git -C "$fx/first" commit --allow-empty -qm 'chore(test): first source'
printf 'first\n' > "$fx/first/first.txt"
printf 'first-intent\n' > "$fx/first/shared.txt"
git -C "$fx/first" add first.txt shared.txt
git -C "$fx/first" commit -qm 'feat(test): first change'
first=$(git -C "$fx/first" rev-parse HEAD)
git worktree add -qb second "$fx/second" main
printf 'second\n' > "$fx/second/second.txt"
printf 'second-intent\n' > "$fx/second/shared.txt"
git -C "$fx/second" add second.txt shared.txt
git -C "$fx/second" commit -qm 'feat(test): second change'
second=$(git -C "$fx/second" rev-parse HEAD)
git worktree add -qb integration/batch "$fx/batch" main
cd "$fx/batch"
git merge --squash "$first" >/dev/null
git commit -qm 'chore(integration): first source'
if git merge --squash "$second" > "$fx/conflict.log" 2>&1; then
  echo 'FAIL: expected the shared source conflict' >&2
  exit 1
fi
test -n "$(git diff --name-only --diff-filter=U)"
printf 'resolved-both\n' > shared.txt
git add shared.txt
git commit -qm 'chore(integration): second source'
# Advance main after assembly so the queue must actually rebase the batch.
printf 'new-main\n' > "$fx/app/main-advanced.txt"
git -C "$fx/app" add main-advanced.txt
git -C "$fx/app" commit -qm 'chore(test): advance main before landing'
export BATCH_GATE_LOG="$fx/gates.log"
bash .pandacorp/merge-queue.sh > "$fx/green.log" 2>&1
test "$(wc -l < "$BATCH_GATE_LOG" | tr -d ' ')" = 1
git -C "$fx/app" show main:first.txt | cmp - first.txt
git -C "$fx/app" show main:second.txt | cmp - second.txt
test "$(cat shared.txt)" = resolved-both
test "$(cat main-advanced.txt)" = new-main
git -C "$fx/app" show main:shared.txt | cmp - shared.txt
echo 'PASS: both sources and conflict resolution survive real rebase with one combined gate'

# A new batch RED cannot advance main; a scoped fix gets one full retry.
green=$(git -C "$fx/app" rev-parse main)
git worktree add -qb integration/red "$fx/red" main
cd "$fx/red"
printf 'failure owned by second change\n' > broken.txt
git add broken.txt
git commit -qm 'test(integration): introduce owned failure'
set +e
bash .pandacorp/merge-queue.sh > "$fx/red.log" 2>&1
rc=$?
set -e
test "$rc" = 11
test "$(git -C "$fx/app" rev-parse main)" = "$green"
test "$(wc -l < "$BATCH_GATE_LOG" | tr -d ' ')" = 2
git rm -q broken.txt
git commit -qm 'fix(integration): repair only the owned failure'
bash .pandacorp/merge-queue.sh > "$fx/repaired.log" 2>&1
test "$(wc -l < "$BATCH_GATE_LOG" | tr -d ' ')" = 3
test "$(git -C "$fx/app" rev-parse main)" = "$(git rev-parse HEAD)"
test "$(git -C "$fx/first" rev-parse HEAD)" = "$first"
test "$(git -C "$fx/second" rev-parse HEAD)" = "$second"
git merge-base --is-ancestor "$base" HEAD
echo 'PASS: red blocks main; scoped repair retries once; source tips retained'
