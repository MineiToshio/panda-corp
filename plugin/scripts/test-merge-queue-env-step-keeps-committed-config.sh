#!/bin/bash
# Proposal 43 phase 0.5: synthetic repositories only; fixture owns cleanup.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
need() { if ! "$@"; then echo "FAIL: $*" >&2; [ ! -f "$FX/output" ] || cat "$FX/output" >&2; exit 1; fi; }
commit_wt() { git -C "$WT" add .; git -C "$WT" commit -qm "fixture contract"; }

fixture config
mkdir -p "$WT/e2e" "$WT/.claude"
cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/green-stamp.sh" "$WT/.pandacorp/"
printf '{"PORT":61997}\n' > "$WT/e2e/server-env.json"
echo '{"servers":[]}' > "$WT/.claude/launch.json"
# Record a real stamp inside the gate, after observing committed config and index flags.
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
set -euo pipefail
git diff --exit-code HEAD -- e2e/server-env.json .claude/launch.json
! git ls-files -v | grep -q '^S '
start=$(bash .pandacorp/green-stamp.sh start)
bash .pandacorp/green-stamp.sh record "$start"
GATE
commit_wt
# Reproduce the local bootstrap override that must be restored before rebase.
git -C "$WT" update-index --skip-worktree e2e/server-env.json .claude/launch.json
echo '{"PORT":61998}' > "$WT/e2e/server-env.json"
echo '{"local":true}' > "$WT/.claude/launch.json"
run_queue
need test "$RC" = 0
need git -C "$WT" diff --exit-code HEAD -- e2e/server-env.json .claude/launch.json
need test -f "$WT/.pandacorp/run/green-stamp"
need bash -c '! git -C "$1" ls-files -v | grep -q "^S "' _ "$WT"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads,open(sys.argv[1])))
assert next(i for i,e in enumerate(r) if e['event']=='env_step') < next(i for i,e in enumerate(r) if e['event']=='gate_start')
assert r[-1]['exit']==0
CHECK
fixture legacy-explain
cat > "$WT/.pandacorp/green-stamp.sh" <<'STAMP'
#!/bin/bash
if [ "$*" = 'check --explain' ]; then echo 'usage: green-stamp.sh check' >&2; exit 2; fi
[ "$*" = check ] || exit 1
echo 'legacy stamp matched'
STAMP
commit_wt
export MQ_GATE_RC=1
run_queue
unset MQ_GATE_RC
need test "$RC" = 0
need grep -q 'SKIPPED.*certified-tree' "$FX/output"
fixture explain-lines
cat > "$WT/.pandacorp/green-stamp.sh" <<'STAMP'
#!/bin/bash
printf 'tree changed\nenvironment names: PATH\n' >&2
exit 1
STAMP
commit_wt
run_queue
need test "$RC" = 0
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads, open(sys.argv[1])))
assert next(e for e in r if e['event']=='stamp_check')['reason']=='tree changed\nenvironment names: PATH'
CHECK
echo 'RESULT: 6 passed, 0 failed (committed configs, index, stamp, event order, legacy fallback, full explain output)'
