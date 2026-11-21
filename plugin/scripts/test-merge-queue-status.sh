#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture status
state() { (cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/merge-queue.sh --status); }
check() { got=$(state); test "${got%%$'\n'*}" = "$1" || { echo "expected $1: $got"; exit 1; }; }
check implemented-uncertified
test ! -e "$QLOG"
test ! -d "$FX/app/.git/pandacorp-merge.lock"
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$APP" add .; git -C "$APP" commit -qm launched
run_queue
test "$RC" = 21
check certified-awaiting-order
rm -f "$WT/.pandacorp/run/verify.lock"
before=$(shasum "$QLOG" "$WT/.pandacorp/run/green-stamp")
check certified-awaiting-order
test ! -e "$WT/.pandacorp/run/verify.lock"
test "$before" = "$(shasum "$QLOG" "$WT/.pandacorp/run/green-stamp")"
# Fresh plain verification is not a queue exit 21.
cp "$QLOG" "$FX/log"
: > "$QLOG"
check implemented-uncertified
cp "$FX/log" "$QLOG"
cp "$WT/.pandacorp/run/green-stamp" "$FX/stamp"
sed -i.bak 's/^at_epoch=.*/at_epoch=1/' "$WT/.pandacorp/run/green-stamp"
check certified-stale
cp "$FX/stamp" "$WT/.pandacorp/run/green-stamp"
# An equal-tree base refresh may not renew the 12-hour certificate lifetime.
old_epoch=$(( $(date +%s) - 11 * 3600 ))
sed -i.bak "s/^at_epoch=.*/at_epoch=$old_epoch/" "$WT/.pandacorp/run/green-stamp"
git -C "$APP" commit --allow-empty -qm 'metadata-only main advance' 
check certified-stale
run_queue
test "$RC" = 21
check certified-awaiting-order
test "$(sed -n 's/^at_epoch=//p' "$WT/.pandacorp/run/green-stamp")" = "$old_epoch"
echo newer > "$APP/new.txt"; git -C "$APP" add .; git -C "$APP" commit -qm newer
check certified-stale
run_queue
test "$RC" = 21
check certified-awaiting-order
export PANDACORP_OWNER_RELEASE_OK=1
run_queue
test "$RC" = 0
check landed
unset PANDACORP_OWNER_RELEASE_OK
echo dirty >> "$WT/value.txt"
check implemented-uncertified
git -C "$WT" restore value.txt
printf '{bad\n' >> "$QLOG"
rc=0; state > "$FX/status-error" 2>&1 || rc=$?
test "$rc" != 0
# Nested main path including whitespace uses the same read-only computation.
fixture 'nested space' product/
check implemented-uncertified
run_queue
test "$RC" = 0
check landed
echo 'RESULT: 10 passed, 0 failed (states, queue evidence, staleness, dirty, malformed, nested read-only)'
