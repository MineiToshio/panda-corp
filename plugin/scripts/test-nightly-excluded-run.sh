#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture nightly nested/
# The script must choose main, even when invoked from a feature worktree.
printf '[]\n' > "$APP/.pandacorp/test-exclusions.json"
cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/green-stamp.sh" "$APP/.pandacorp/"
cat > "$APP/.pandacorp/verify.sh" <<'VERIFY'
#!/bin/bash
set -eu
[ "$PANDACORP_DISABLE_TEST_EXCLUSIONS" = 1 ]
[ "$PANDACORP_VERIFY_NO_BAIL" = 1 ]
[ -z "${PANDACORP_OWNER_RELEASE_OK:-}" ]
[ "$(cat value.txt)" = base ]
if bash .pandacorp/green-stamp.sh record bogus > /dev/null 2>&1; then exit 3; fi
main=$(git worktree list --porcelain | awk '/^worktree /{p=substr($0,10)} /^branch refs\/heads\/main$/{print p}')
mkdir -p "$main/nested/.pandacorp/run"
printf 'nightly observation\n' >> "$main/nested/.pandacorp/run/test-outcomes.jsonl"
exit "${NIGHTLY_TEST_RC:-0}"
VERIFY
git -C "$APP" add .; git -C "$APP" commit -qm nightly
before=$(git -C "$APP" worktree list --porcelain)
PANDACORP_OWNER_RELEASE_OK=1 bash "$QUEUE_FACTORY/plugin/scripts/nightly-excluded-run.sh" "$WT"
test "$(git -C "$APP" worktree list --porcelain)" = "$before"
test "$(wc -l < "$APP/.pandacorp/run/test-outcomes.jsonl" | tr -d ' ')" = 1
test ! -f "$APP/.pandacorp/run/green-stamp"
if NIGHTLY_TEST_RC=1 bash "$QUEUE_FACTORY/plugin/scripts/nightly-excluded-run.sh" "$WT"; then exit 1; fi
test "$(git -C "$APP" worktree list --porcelain)" = "$before"
test "$(wc -l < "$APP/.pandacorp/run/test-outcomes.jsonl" | tr -d ' ')" = 2
echo 'RESULT: nightly worktree cases passed, 0 failed'
