#!/bin/bash
# Proposal 43 phase 0.5: synthetic repositories only; fixture owns cleanup.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
need() { if ! "$@"; then echo "FAIL: $*" >&2; [ ! -f "$FX/output" ] || cat "$FX/output" >&2; exit 1; fi; }
commit_wt() { git -C "$WT" add .; git -C "$WT" commit -qm "fixture contract"; }

fixture slot
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
set -euo pipefail
python3 - "$PANDACORP_HOST_SLOT_TOKEN" <<'CHECK'
import glob, json, os, sys
slot, token = sys.argv[1].split('|')
o = json.load(open(slot+'/owner.json'))
assert o['token']==token and o['kind']=='merge-queue'
assert len(glob.glob(os.environ['PANDACORP_HOST_DIR']+'/h-slots/slot-*'))==1
os.kill(o['pid'],0)
CHECK
GATE
commit_wt
run_queue
need test "$RC" = 0
need test "$(find "$PANDACORP_HOST_DIR/h-slots" -name 'slot-*' | wc -l | tr -d ' ')" = 0
# Use the real full verifier too: when it starts acquiring its own slots, this
# contract catches a second acquisition/deadlock rather than testing only a gate stub.
fixture inherited-verifier
cp "$QUEUE_FACTORY/plugin/templates/stack-a-nextjs/verify.sh" "$WT/.pandacorp/verify.sh"
mkdir -p "$WT/src/_tests" "$WT/e2e"
touch "$WT/playwright.config.ts"
for name in smoke visual responsive shell headers; do touch "$WT/e2e/$name.spec.ts"; done
echo '{"name":"slot-fixture"}' > "$WT/package.json"
cat > "$WT/bin/pnpm" <<'PNPM'
#!/bin/bash
set -euo pipefail
python3 - "$PANDACORP_HOST_SLOT_TOKEN" <<'CHECK'
import glob, json, os, sys
slot, token=sys.argv[1].split('|')
o=json.load(open(slot+'/owner.json'))
assert o['token']==token
assert len(glob.glob(os.environ['PANDACORP_HOST_DIR']+'/h-slots/slot-*'))==1
CHECK
# At least one static stage must reach the real verifier's command boundary.
touch .pandacorp/run/inherited-observed
PNPM
chmod +x "$WT/bin/pnpm"
commit_wt
export PANDACORP_HOST_SLOT_TIMEOUT_SECS=5
run_queue
need test "$RC" = 0
need test -f "$WT/.pandacorp/run/inherited-observed"
unset PANDACORP_HOST_SLOT_TIMEOUT_SECS
# Closed admission: a regular file cannot become the slot directory.
fixture closed
echo file > "$FX/not-directory"
export PANDACORP_HOST_DIR="$FX/not-directory"
run_queue
need test "$RC" = 16
need grep -q 'environment not ready: host slot directory is unusable' "$FX/output"
# Two queues in distinct repos compete for the same host. Force Hmax=1 through getconf.
fixture one
FIRST_FX="$FX"; FIRST_WT="$WT"
cat > "$WT/bin/getconf" <<'CPU'
#!/bin/bash
echo 1
CPU
chmod +x "$WT/bin/getconf"
printf '#!/bin/bash\nsleep 1\n' > "$WT/.pandacorp/verify.sh"
commit_wt
fixture two
cp "$FIRST_WT/bin/getconf" "$WT/bin/getconf"
printf '#!/bin/bash\nsleep 1\n' > "$WT/.pandacorp/verify.sh"
commit_wt
export PANDACORP_HOST_DIR="$QUEUE_TEST_ROOT/shared-host" PANDACORP_HOST_SLOT_POLL_SECS=.1 PANDACORP_HOST_SLOT_TIMEOUT_SECS=10
(cd "$FIRST_WT" && PATH="$FIRST_WT/bin:$PATH" bash .pandacorp/merge-queue.sh) > "$FIRST_FX/output" 2>&1 &
a=$!
run_queue
wait "$a"
need test "$RC" = 0
need test "$(find "$PANDACORP_HOST_DIR/h-slots" -name 'slot-*' | wc -l | tr -d ' ')" = 0
echo 'RESULT: 5 passed, 0 failed (one token, real verify inheritance, release, fail closed, two queues)'
