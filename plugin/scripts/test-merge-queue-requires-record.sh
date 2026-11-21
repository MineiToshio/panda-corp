#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture record
cat > "$WT/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
# A full green whose ignored inputs changed must never fast-forward.
start=$(bash .pandacorp/green-stamp.sh start)
echo changed >> .env.local
rc=0
reason=$(bash .pandacorp/green-stamp.sh record "$start" 2>&1) || rc=$?
python3 - "$rc" "$reason" <<'PY'
import json,sys
json.dump(dict(ok=sys.argv[1]=='0',reason=sys.argv[2]),open('.pandacorp/run/stamp-record-result.json','w'))
PY
exit 0
GATE
printf '.env.local\n' >> "$WT/.gitignore"
git -C "$WT" add .; git -C "$WT" commit -qm 'fixture record refusal'
base=$(git -C "$APP" rev-parse HEAD)
run_queue
test "$RC" = 11
grep -q 'green but uncertifiable:' "$FX/output"
test "$(git -C "$APP" rev-parse HEAD)" = "$base"
python3 - "$QLOG" <<'PY'
import json,sys
rows=list(map(json.loads,open(sys.argv[1])))
assert not any(r['event']=='ff' for r in rows)
assert rows[-1]['exit']==11
PY
# Missing helper also cannot turn a green script into landing evidence.
fixture missing-record
rm "$WT/.pandacorp/green-stamp.sh"
git -C "$WT" add .; git -C "$WT" commit -qm 'fixture missing helper'
run_queue
test "$RC" = 11
grep -q 'missing green-stamp.sh' "$FX/output"
# Exercise the actual verify template: record refusal is observable but keeps diagnosis green.
fixture real-record
cp "$QUEUE_FACTORY/plugin/templates/stack-a-nextjs/verify.sh" "$WT/.pandacorp/verify.sh"
mkdir -p "$WT/src/_tests" "$WT/e2e"
printf '.env.local\n' >> "$WT/.gitignore"
echo '{"name":"record-fixture"}' > "$WT/package.json"
touch "$WT/playwright.config.ts"
for name in smoke visual responsive shell headers; do touch "$WT/e2e/$name.spec.ts"; done
cat > "$WT/bin/pnpm" <<'PNPM'
#!/bin/bash
[ "$1" != biome ] || echo changed >> .env.local
if [ "$1" = vitest ]; then
  for arg in "$@"; do case "$arg" in --outputFile=*) printf '{"testResults":[]}' > "${arg#--outputFile=}";; esac; done
fi
if [ "${2:-}" = playwright ] && [ -n "${PLAYWRIGHT_JSON_OUTPUT_FILE:-}" ]; then
  printf '{"suites":[{"title":"smoke.spec.ts","specs":[{"file":"smoke.spec.ts","title":"renders","tests":[{"projectName":"desktop","results":[{"status":"passed","workerIndex":2,"retry":0}]}]}]}]}' > "$PLAYWRIGHT_JSON_OUTPUT_FILE"
fi
exit 0
PNPM
chmod +x "$WT/bin/pnpm"
git -C "$WT" add .; git -C "$WT" commit -qm 'real template record refusal'
(cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/verify.sh) > "$FX/diagnosis" 2>&1
python3 - "$WT" <<'PY_RECORD'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])/'.pandacorp/run'
assert json.loads((root/'gate-report.json').read_text())['green'] is True
assert json.loads((root/'stamp-record-result.json').read_text())['ok'] is False
PY_RECORD
base=$(git -C "$APP" rev-parse HEAD)
run_queue
test "$RC" = 11
test "$(git -C "$APP" rev-parse HEAD)" = "$base"
grep -q 'green but uncertifiable:' "$FX/output"
python3 - "$APP" <<'PY_LEDGER'
import json,pathlib,sys
rows=list(map(json.loads,(pathlib.Path(sys.argv[1])/'.pandacorp/run/test-outcomes.jsonl').read_text().splitlines()))
assert len(rows)==1 and rows[0]['runner']=='playwright' and rows[0]['worker']==2 and rows[0]['status']=='passed'
assert 'renders' in rows[0]['test_id'] and rows[0]['attempt']
PY_LEDGER
# Deterministic high-load timeout observation, without changing real host load.
fixture timeout-load
export P43_REAL_PYTHON
P43_REAL_PYTHON=$(command -v python3)
cat > "$WT/bin/python3" <<'PYTHON'
#!/bin/bash
if [ "$1" = -c ] && [[ "$2" == *os.getloadavg* ]]; then echo 100000; exit 0; fi
if [ "$1" = - ]; then
  code=$(cat)
  case "$code" in
    *"record['load'] = os.getloadavg()[0]"*) code="import os; os.getloadavg = lambda: (100000, 0, 0)"$'\n'"$code" ;;
  esac
  printf '%s\n' "$code" | "$P43_REAL_PYTHON" "$@"
  exit $?
fi
exec "$P43_REAL_PYTHON" "$@"
PYTHON
chmod +x "$WT/bin/python3"
cat > "$WT/.pandacorp/verify.sh" <<'TIMEOUT'
#!/bin/bash
mkdir -p .pandacorp/run
printf '{"at":"%s","scope":"full","sha":"%s","subgates":[{"failures":[{"msg":"Test timed out in 20000ms"}]}]}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json
exit 1
TIMEOUT
git -C "$WT" add .; git -C "$WT" commit -qm 'high-load timeout fixture'
run_queue
test "$RC" = 11
python3 - "$QLOG" <<'PY_LOAD'
import json,sys
rows=list(map(json.loads,open(sys.argv[1])))
gate=next(r for r in rows if r['event']=='gate_end')
assert gate['classification']=='environment-suspect' and gate['load']>gate['ncpu']
assert next(r for r in rows if r['event']=='gate_start')['load']==100000
PY_LOAD
echo 'RESULT: 5 passed, 0 failed (required record, real receipt, browser ledger, high-load timeout classification)'
