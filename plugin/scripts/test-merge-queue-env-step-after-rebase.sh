#!/bin/bash
# Proposal 43 phase 0.5: synthetic repositories only; fixture owns cleanup.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
need() { if ! "$@"; then echo "FAIL: $*" >&2; [ ! -f "$FX/output" ] || cat "$FX/output" >&2; exit 1; fi; }
commit_wt() { git -C "$WT" add .; git -C "$WT" commit -qm "fixture contract"; }

fixture env
mkdir -p "$WT/node_modules/.bin" "$WT/node_modules/next/dist/cli"
printf 'node_modules/\n.next/\n' >> "$WT/.gitignore"
# Synthetic installed Next declares typegen support; no network/process server needed.
touch "$WT/node_modules/next/dist/cli/next-typegen.js"
cat > "$WT/node_modules/.bin/next" <<'NEXT'
#!/bin/bash
[ "$1" = typegen ] || exit 1
echo typegen >> "$ENV_TRACE"
mkdir -p .next/types
NEXT
cat > "$WT/bin/npm" <<'NPM'
#!/bin/bash
[ "$1" = ci ] || exit 1
grep -q new package-lock.json || exit 2
echo install >> "$ENV_TRACE"
NPM
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
test -d .next/types || exit 1
echo gate >> "$ENV_TRACE"
GATE
chmod +x "$WT/node_modules/.bin/next" "$WT/bin/npm"
commit_wt
# Main changed the lockfile after this feature forked.
echo new > "$APP/package-lock.json"
git -C "$APP" add package-lock.json; git -C "$APP" commit -qm 'main dependencies'
export ENV_TRACE="$FX/trace"
run_queue
need test "$RC" = 0
need test "$(cat "$ENV_TRACE")" = "$(printf 'install\ntypegen\ngate')"
# A second fixture has Next but no supported typegen: fail before gate time.
fixture unsupported
mkdir -p "$WT/node_modules/.bin"
printf 'node_modules/\n.next/\n' >> "$WT/.gitignore"
printf '#!/bin/bash\nexit 0\n' > "$WT/node_modules/.bin/next"
chmod +x "$WT/node_modules/.bin/next"
commit_wt
run_queue
need test "$RC" = 16
need grep -q 'environment not ready: installed Next' "$FX/output"
python3 - "$QLOG" <<'CHECK'
import json, sys
r=list(map(json.loads, open(sys.argv[1])))
assert not any(e['event']=='gate_start' for e in r)
assert any(e['event']=='env_step' and e['result']=='failed' for e in r)
assert r[-1]['exit']==16
CHECK

# The build engine already rebased: HEAD no longer reveals the install's old lock.
fixture pre-rebased
printf 'node_modules/\n' >> "$WT/.gitignore"
mkdir -p "$WT/node_modules"
echo old > "$WT/node_modules/.package-lock.json"
cat > "$WT/bin/npm" <<'NPM'
#!/bin/bash
set -e
[ "$1" = ci ]
mkdir -p node_modules
cp package-lock.json node_modules/.package-lock.json
echo install >> "$ENV_TRACE"
NPM
chmod +x "$WT/bin/npm"
printf '#!/bin/bash\ncmp package-lock.json node_modules/.package-lock.json || exit 1\necho gate >> "$ENV_TRACE"\n' > "$WT/.pandacorp/verify.sh"
commit_wt
echo new > "$APP/package-lock.json"
git -C "$APP" add .; git -C "$APP" commit -qm 'main lock changed'
git -C "$WT" rebase main >/dev/null 2>&1
export ENV_TRACE="$FX/prerebased-trace"
run_queue
need test "$RC" = 0
need test "$(cat "$ENV_TRACE")" = "$(printf 'install\ngate')"
run_queue
need test "$RC" = 0
need test "$(grep -c '^install$' "$ENV_TRACE")" = 1
# Even with the same target lock, replacing installed metadata invalidates the receipt.
echo stale > "$WT/node_modules/.package-lock.json"
run_queue
need test "$RC" = 0
need test "$(grep -c '^install$' "$ENV_TRACE")" = 2
echo 'RESULT: 5 passed, 0 failed (post-rebase tools, pre-rebased stale installation, metadata identity)'
