#!/bin/bash
# Proposal 43 phase 0.5: synthetic repositories only; fixture owns cleanup.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
need() { if ! "$@"; then echo "FAIL: $*" >&2; [ ! -f "$FX/output" ] || cat "$FX/output" >&2; exit 1; fi; }
commit_wt() { git -C "$WT" add .; git -C "$WT" commit -qm "fixture contract"; }

fixture exact
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$APP" add .pandacorp/status.yaml; git -C "$APP" commit -qm launched
# Move the branch after the gate starts. Only the pre-gate sha may land/push.
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
set -e
git rev-parse HEAD > "$TEST_OUT/gated"
echo extra > extra.txt
git add extra.txt; git commit -qm 'arrived during gate'
GATE
commit_wt
export TEST_OUT="$FX" PANDACORP_OWNER_RELEASE_OK=1
run_queue
need test "$RC" = 0
need test "$(git -C "$APP" rev-parse HEAD)" = "$(cat "$FX/gated")"
need test "$(git -C "$FX/origin.git" rev-parse main)" = "$(cat "$FX/gated")"
need test "$(git -C "$WT" rev-parse HEAD)" != "$(cat "$FX/gated")"
unset PANDACORP_OWNER_RELEASE_OK
fixture advance
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
set -e
echo other > "$TEST_MAIN/other.txt"
git -C "$TEST_MAIN" add other.txt; git -C "$TEST_MAIN" commit -qm 'main advanced'
GATE
commit_wt
export TEST_MAIN="$APP"
run_queue
need test "$RC" = 17
need grep -q 'main advanced during the gate' "$FX/output"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads,open(sys.argv[1])))
assert any(e['event']=='ff' and e['result']=='failed' for e in r)
assert r[-1]['exit']==17
CHECK
# git merge itself says "already up to date" if main contains gated SHA plus more.
fixture descendant
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
set -e
gated=$(git rev-parse HEAD)
git -C "$TEST_MAIN" merge --ff-only "$gated" >/dev/null
echo more > "$TEST_MAIN/more.txt"
git -C "$TEST_MAIN" add more.txt; git -C "$TEST_MAIN" commit -qm 'main beyond gated sha'
GATE
commit_wt
export TEST_MAIN="$APP"
run_queue
need test "$RC" = 17
need test -f "$APP/more.txt"
# Nested project ignores unrelated factory edits; reconciler resolves inside project.
fixture nested product/
echo base > "$FX/app/unrelated.txt"; git -C "$FX/app" add .; git -C "$FX/app" commit -qm unrelated
git -C "$FX/wt" cherry-pick main >/dev/null
echo dirty >> "$FX/app/unrelated.txt"
cat > "$WT/.pandacorp/change-reconcile.mjs" <<'RECONCILE'
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[process.argv.indexOf('--project')+1];
if (!root.endsWith('/product')) process.exit(9);
fs.writeFileSync(path.join(root,'.pandacorp/run/reconciled'), 'ok');
RECONCILE
commit_wt
run_queue
need test "$RC" = 0
need test -f "$APP/.pandacorp/run/reconciled"
# A timed-out client may already have published. The reread must confirm before retry.
fixture push-timeout
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$APP" add .pandacorp/status.yaml; git -C "$APP" commit -qm launched
export P43_REAL_GIT
P43_REAL_GIT=$(command -v git)
cat > "$WT/bin/git" <<'GIT'
#!/bin/bash
for arg in "$@"; do
  if [ "$arg" = push ]; then
    "$P43_REAL_GIT" "$@" || exit $?
    # Simulate a client stuck after remote acceptance, with no leaked child.
    exec sleep 4
  fi
  if [ "$arg" = ls-remote ]; then echo reread > "$P43_REREAD"; fi
done
exec "$P43_REAL_GIT" "$@"
GIT
chmod +x "$WT/bin/git"
commit_wt
export PANDACORP_OWNER_RELEASE_OK=1 PANDACORP_PUSH_TIMEOUT_SECS=1 P43_REREAD="$FX/reread"
run_queue
need test "$RC" = 0
need test -f "$FX/reread"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads,open(sys.argv[1])))
assert [e['result'] for e in r if e['event']=='push']==['unknown','ok']
CHECK
unset PANDACORP_OWNER_RELEASE_OK PANDACORP_PUSH_TIMEOUT_SECS
fixture no-gate
chmod -x "$WT/.pandacorp/verify.sh"; commit_wt
run_queue
need test "$RC" = 20
need grep -q 'no gate:' "$FX/output"
# Required reads are authoritative: an error must not look like clean main or a skip.
fixture required-read
cat > "$WT/bin/git" <<'GIT'
#!/bin/bash
case "$*" in *'rev-parse --verify'*) exit 97;; esac
exec "$P43_REAL_GIT" "$@"
GIT
chmod +x "$WT/bin/git"; commit_wt
run_queue
need test "$RC" = 20
need grep -q 'cannot inspect main checkout' "$FX/output"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads,open(sys.argv[1])))
assert not any(e['event']=='gate_start' for e in r)
assert r[-1]['exit']==20
CHECK

# A push AND its confirmation query can stall; neither may retain the merge lock.
fixture confirmation-timeout
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$APP" add .; git -C "$APP" commit -qm launched
cat > "$WT/bin/git" <<'GIT'
#!/bin/bash
for arg in "$@"; do
  case "$arg" in push|ls-remote) exec sleep 8;; esac
done
exec "$P43_REAL_GIT" "$@"
GIT
chmod +x "$WT/bin/git"; commit_wt
export PANDACORP_OWNER_RELEASE_OK=1 PANDACORP_PUSH_TIMEOUT_SECS=0 PANDACORP_REMOTE_TIMEOUT_SECS=0
started=$SECONDS
run_queue
elapsed=$((SECONDS-started))
need test "$RC" = 13
need test "$elapsed" -lt 6
need test ! -d "$FX/app/.git/pandacorp-merge.lock"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads,open(sys.argv[1])))
assert [e['result'] for e in r if e['event']=='push']==['unknown']
assert r[-1]['exit']==13
CHECK
unset PANDACORP_OWNER_RELEASE_OK PANDACORP_PUSH_TIMEOUT_SECS PANDACORP_REMOTE_TIMEOUT_SECS
echo 'RESULT: 9 passed, 0 failed (exact SHA, main advance, bounded push AND confirmation, required reads)'
