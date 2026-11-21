#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture archives
export MQ_GATE_RC=1 MQ_REPORT_ID=red
run_queue
[ "$RC" = 11 ]
cp "$WT/.pandacorp/run/gate-report.json" "$FX/report-red.json"
export MQ_GATE_RC=0 MQ_REPORT_ID=green
run_queue
[ "$RC" = 0 ]
cp "$WT/.pandacorp/run/gate-report.json" "$FX/report-green.json"
python3 - "$QLOG" "$APP" "$FX" <<'PY'
import json, pathlib, sys
log, app, fixture = sys.argv[1:]
events = [json.loads(line) for line in open(log)]
gates = [e for e in events if e['event'] == 'gate_end']
assert len(gates) == 2 and gates[0]['attempt'] != gates[1]['attempt']
for e, content in zip(gates, ['red', 'green']):
    path = pathlib.Path(e['report'])
    assert path == pathlib.Path(app, '.pandacorp/run/gate-reports', e['attempt'] + '.json')
    assert path.read_bytes() == pathlib.Path(fixture, 'report-' + content + '.json').read_bytes()
assert len(list(pathlib.Path(app, '.pandacorp/run/gate-reports').glob('*.json'))) == 2
PY
echo 'PASS consecutive red/green gates archive distinct UUID reports unchanged'

fixture collision
mkdir -p "$APP/.pandacorp/run/gate-reports"
uuid=11111111-1111-4111-8111-111111111111
printf '#!/bin/bash\necho %s\n' "$uuid" > "$WT/bin/uuidgen"
chmod +x "$WT/bin/uuidgen"
git -C "$FX/wt" add .
git -C "$FX/wt" commit -qm uuid-fixture
printf 'preserve me\n' > "$APP/.pandacorp/run/gate-reports/$uuid.json"
run_queue
[ "$RC" = 0 ]
python3 - "$QLOG" "$APP/.pandacorp/run/gate-reports/$uuid.json" <<'PY'
import json, pathlib, sys
events = [json.loads(line) for line in open(sys.argv[1])]
assert pathlib.Path(sys.argv[2]).read_bytes() == b'preserve me\n'
assert any(e['event'] == 'archive_error' for e in events)
assert [e['report'] for e in events if e['event'] == 'gate_end'] == ['']
PY
echo 'PASS existing UUID archive is preserved and collision is logged'

for scenario in contention unchanged touched; do
  fixture "$scenario"
  mkdir -p "$WT/.pandacorp/run"
  printf '{"run":"stale","at":"2000-01-01T00:00:00Z","scope":"full","sha":"old"}\n' > "$WT/.pandacorp/run/gate-report.json"
  if [ "$scenario" = touched ]; then
    python3 - "$WT" <<'PY'
import datetime, json, pathlib, subprocess, sys
wt = sys.argv[1]
at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3)).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = subprocess.check_output(['git', '-C', wt, 'rev-parse', 'HEAD'], text=True).strip()
pathlib.Path(wt, '.pandacorp/run/gate-report.json').write_text(json.dumps(dict(at=at, sha=sha, scope='full', run='old')))
PY
  fi
  cp "$WT/.pandacorp/run/gate-report.json" "$FX/stale.json"
  if [ "$scenario" = contention ]; then
    cp "$QUEUE_FACTORY/plugin/templates/stack-a-nextjs/verify.sh" "$WT/.pandacorp/verify.sh"
    git -C "$FX/wt" add .pandacorp/verify.sh
    git -C "$FX/wt" commit -qm real-verification-owner
    python3 - "$WT" "$FX" <<'PY'
import fcntl, os, pathlib, subprocess, sys, time
wt, fixture = sys.argv[1:]
with open(pathlib.Path(wt, '.pandacorp/run/verify.lock'), 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    with open(pathlib.Path(fixture, 'output'), 'w') as output:
        result = subprocess.run(['/bin/bash', '.pandacorp/merge-queue.sh'], cwd=wt,
                                stdout=output, stderr=output, timeout=20)
    assert result.returncode == 14, pathlib.Path(fixture, 'output').read_text()
PY
  else
    if [ "$scenario" = touched ]; then export MQ_TOUCH_REPORT=1; else export MQ_NO_REPORT=1; fi
    run_queue
    unset MQ_NO_REPORT MQ_TOUCH_REPORT
    [ "$RC" = 0 ]
  fi
  python3 - "$QLOG" "$APP" "$WT" "$FX" "$scenario" <<'PY'
import json, pathlib, sys
log, app, wt, fixture, scenario = sys.argv[1:]
events = [json.loads(line) for line in open(log)]
assert pathlib.Path(wt, '.pandacorp/run/gate-report.json').read_bytes() == pathlib.Path(fixture, 'stale.json').read_bytes()
assert not list(pathlib.Path(app, '.pandacorp/run/gate-reports').glob('*.json'))
gate = [e for e in events if e['event'] == 'gate_end']
assert len(gate) == 1 and gate[0]['report'] == ''
assert gate[0]['rc'] == (75 if scenario == 'contention' else 0)
PY
  echo "PASS $scenario gate never archives the previous invocation's report"
done
echo 'RESULT: 5 passed, 0 failed'
