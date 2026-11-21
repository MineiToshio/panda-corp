#!/bin/bash
# Proposal 43 phase 0.5: synthetic repositories only; fixture owns cleanup.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
need() { if ! "$@"; then echo "FAIL: $*" >&2; [ ! -f "$FX/output" ] || cat "$FX/output" >&2; exit 1; fi; }
commit_wt() { git -C "$WT" add .; git -C "$WT" commit -qm "fixture contract"; }

fixture ownership
WRAPPER="$QUEUE_FACTORY/plugin/scripts/with-merge-lock.sh"
COMMON="$FX/app/.git"
# Hold the queue's very same protocol from a direct-main writer.
(cd "$FX/app" && bash "$WRAPPER" bash -c 'touch "$1"; while [ ! -f "$2" ]; do sleep .1; done' _ "$FX/held" "$FX/release") > "$FX/holder-log" 2>&1 &
holder=$!
# A failing assertion must release our synthetic holder and join every waiter too.
cleanup_ownership() {
  touch "$FX/release" 2>/dev/null || true
  for pid in "$holder" "${a:-}" "${b:-}"; do [ -z "$pid" ] || kill "$pid" 2>/dev/null || true; done
  for pid in "$holder" "${a:-}" "${b:-}"; do [ -z "$pid" ] || wait "$pid" 2>/dev/null || true; done
  rm -rf "$QUEUE_TEST_ROOT"
}
trap cleanup_ownership EXIT
for i in {1..100}; do [ ! -e "$FX/held" ] || break; sleep .1; done
need test -f "$FX/held"
cp "$COMMON/pandacorp-merge.lock/owner.json" "$FX/original-owner"
rc=0
(cd "$FX/app" && PANDACORP_MERGE_LOCK_TIMEOUT_SECS=1 PANDACORP_MERGE_LOCK_POLL_SECS=.1 bash "$WRAPPER" true) > "$FX/waiter-log" 2>&1 || rc=$?
need test "$rc" = 20
need cmp "$COMMON/pandacorp-merge.lock/owner.json" "$FX/original-owner"
# Publish waiter A before B and verify admission, not merely completion order.
(cd "$FX/app" && PANDACORP_MERGE_LOCK_POLL_SECS=.1 bash "$WRAPPER" bash -c 'echo A >> "$1"' _ "$FX/order") > "$FX/a-log" 2>&1 &
a=$!
for i in {1..100}; do [ "$(find "$COMMON/pandacorp-merge.waiters" -name '*.json' | wc -l | tr -d ' ')" = 1 ] && break; sleep .1; done
(cd "$FX/app" && PANDACORP_MERGE_LOCK_POLL_SECS=.1 bash "$WRAPPER" bash -c 'echo B >> "$1"' _ "$FX/order") > "$FX/b-log" 2>&1 &
b=$!
for i in {1..100}; do [ "$(find "$COMMON/pandacorp-merge.waiters" -name '*.json' | wc -l | tr -d ' ')" = 2 ] && break; sleep .1; done
touch "$FX/release"
wait "$holder"; wait "$a"; wait "$b"
holder=""; a=""; b=""
need test "$(cat "$FX/order")" = "$(printf 'A\nB')"
need grep -q 'position=2.*holder-start=.*expected-gate=' "$FX/b-log"
# A known dead holder on this host is reclaimable even before the age threshold.
mkdir "$COMMON/pandacorp-merge.lock"
python3 - "$COMMON/pandacorp-merge.lock/owner.json" <<'OWNER'
import json, socket, sys
json.dump(dict(pid=2147483647, hostname=socket.gethostname(), token='dead'), open(sys.argv[1], 'w'))
OWNER
(cd "$FX/app" && bash "$WRAPPER" true)
need test ! -d "$COMMON/pandacorp-merge.lock"
# Legacy/remote owner metadata cannot prove a dead local pid; age still permits reclaim.
mkdir "$COMMON/pandacorp-merge.lock"
python3 - "$COMMON/pandacorp-merge.lock" <<'AGE'
import os, sys, time
os.utime(sys.argv[1], (time.time()-3600, time.time()-3600))
AGE
(cd "$FX/app" && bash "$WRAPPER" true)
need test ! -d "$COMMON/pandacorp-merge.lock"
rc=0
(cd "$FX/app" && bash "$WRAPPER" bash -c 'exit 37') || rc=$?
need test "$rc" = 37
need test ! -d "$COMMON/pandacorp-merge.lock"
echo 'RESULT: 6 passed, 0 failed (waiter ownership, FIFO, position, dead/aged reclaim, exit propagation)'
