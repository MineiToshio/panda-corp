#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
test_signals() {
  local name
  for name in TERM INT HUP; do
    fixture "signal-$name"
    python3 - "$WT" "$FX/output" "$QLOG" "$name" "$QUEUE_FACTORY" <<'PY'
import json, os, pathlib, signal, subprocess, sys, time
wt, output, log, name, factory = sys.argv[1:]
sig = getattr(signal, 'SIG' + name)
with open(output, 'w') as out:
    process = subprocess.Popen(['/bin/bash', '.pandacorp/merge-queue.sh'], cwd=wt,
                               env={**os.environ, 'MQ_SLEEP':'1'}, stdout=out, stderr=out,
                               start_new_session=True)
    try:
        for _ in range(200):
            if pathlib.Path(wt, '.pandacorp/run/gate-started').exists(): break
            if process.poll() is not None: raise AssertionError(pathlib.Path(output).read_text())
            time.sleep(.05)
        else: raise AssertionError('gate never started')
        os.killpg(process.pid, sig)
        status = process.wait(timeout=10)
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
events = [json.loads(line) for line in open(log)]
assert [e['exit'] for e in events if e['event'] == 'end'] == [128 + sig], (status, events)
assert status == 128 + sig, status
assert not any(e['event'] == 'ff' for e in events)
metrics = subprocess.run(['node', str(pathlib.Path(factory, 'plugin/scripts/queue-metrics.mjs')), log],
                         text=True, capture_output=True, check=True)
assert json.loads(metrics.stdout)['projects'][0]['done_to_main']['Q_s']['n'] == 0
PY
    echo "PASS SIG$name records one nonzero end and no landed episode (Bash 3.2)"
  done
}
test_signals
if [ "${1:-}" = --signals-only ]; then echo 'RESULT: 3 passed, 0 failed'; exit 0; fi
run_exit_case() {
  local expected="$1"
  fixture "exit-$expected"
  listener=""
  case "$expected" in
    10)
      echo conflict > "$APP/value.txt"
      git -C "$FX/app" commit -qam conflict ;;
    11) export MQ_GATE_RC=1 ;;
    12) echo dirty > "$APP/value.txt" ;;
    13|21)
      printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
      git -C "$FX/app" commit -qam launched
      if [ "$expected" = 13 ]; then
        printf '#!/bin/bash\nexit 1\n' > "$FX/origin.git/hooks/pre-receive"
        chmod +x "$FX/origin.git/hooks/pre-receive"
        export PANDACORP_OWNER_RELEASE_OK=1
      fi ;;
    14)
      mkdir -p "$WT/e2e"
      python3 - "$FX/port" <<'PY' &
import http.server, pathlib, sys
server = http.server.HTTPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler)
pathlib.Path(sys.argv[1]).write_text(str(server.server_port))
server.serve_forever()
PY
      listener=$!
      for i in {1..100}; do [ ! -f "$FX/port" ] || break; sleep 0.05; done
      [ -f "$FX/port" ]
      printf '{"PORT":%s}\n' "$(cat "$FX/port")" > "$WT/e2e/server-env.json"
      git -C "$FX/wt" add .
      git -C "$FX/wt" commit -qm port ;;
    20) echo dirty > "$WT/value.txt" ;;
  esac
  run_queue
  [ -z "$listener" ] || { kill "$listener"; wait "$listener" 2>/dev/null || true; }
  unset MQ_GATE_RC PANDACORP_OWNER_RELEASE_OK
  if [ "$RC" != "$expected" ]; then cat "$FX/output"; echo "expected $expected, got $RC"; exit 1; fi
  python3 - "$QLOG" "$expected" "$FX/app" <<'PY'
import json, re, subprocess, sys
path, code, main = sys.argv[1:]
events = [json.loads(line) for line in open(path)]
assert sum(e['event'] == 'start' for e in events) == 1
assert [e['exit'] for e in events if e['event'] == 'end'] == [int(code)]
assert len({e['attempt'] for e in events}) == 1
for e in events:
    assert e['v'] == 1 and e['branch'] and e['project'] == main
    assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', e['ts'])
    assert len(json.dumps(e).encode()) < 4096
for e in events:
    if e['event'] == 'ff' and e['result'] == 'ok':
        tip = subprocess.check_output(['git', '-C', main, 'rev-parse', 'main'], text=True).strip()
        assert e['sha'] == tip
        reflog = subprocess.check_output(['git', '-C', main, 'reflog', 'show', '--format=%H %gs', 'main'], text=True)
        assert any(line.startswith(tip + ' ') and 'Fast-forward' in line for line in reflog.splitlines())
names = {e['event'] for e in events}
if code == '0':
    assert {'lock_wait','lock_acquired','slot_acquired','slot_released','rebase','stamp_check','gate_start','gate_end','order_check','ff'} <= names
if code == '13':
    assert [e['result'] for e in events if e['event'] == 'push'] == ['failed']
PY
  echo "PASS exit $expected: one start/end, valid events and landing SHA"
}
for expected in 0 10 11 12 13 20 21; do run_exit_case "$expected"; done

fixture nested 'nested/app/'
run_queue
[ "$RC" = 0 ]
[ -f "$QLOG" ] && [ ! -f "$FX/app/.pandacorp/run/queue-log.jsonl" ]
echo 'PASS nested project resolves the shared main project log'

fixture logging-failure
mkdir -p "$APP/.pandacorp/run/queue-log.jsonl"
run_queue
[ "$RC" = 0 ]
[ "$(grep -c 'WARNING: queue telemetry' "$FX/output")" = 1 ]
echo 'PASS logging failure warns once and preserves landing'

fixture killed
python3 - "$WT" "$FX/output" "$QLOG" <<'PY'
import json, os, pathlib, signal, subprocess, sys, time
wt, output, log = sys.argv[1:]
with open(output, 'w') as out:
    process = subprocess.Popen(['bash', '.pandacorp/merge-queue.sh'], cwd=wt,
                               env={**os.environ, 'MQ_SLEEP':'1'}, stdout=out, stderr=out,
                               start_new_session=True)
    try:
        for _ in range(200):
            if pathlib.Path(wt, '.pandacorp/run/gate-started').exists(): break
            if process.poll() is not None: raise AssertionError(pathlib.Path(output).read_text())
            time.sleep(.05)
        else: raise AssertionError('gate never started')
    finally:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
events = [json.loads(line) for line in open(log)]
assert sum(e['event'] == 'start' for e in events) == 1
assert not any(e['event'] == 'end' for e in events)
PY
echo 'PASS SIGKILL during the gate preserves the durable start'
fixture telemetry-git-failure
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$FX/app" commit -qam launched
real_git=$(command -v git)
cat > "$WT/bin/git" <<GIT
#!/bin/bash
case "\$*" in
  'rev-parse main'|*' rev-parse main'|'rev-parse HEAD'|*' rev-parse HEAD') exit 97 ;;
esac
exec "$real_git" "\$@"
GIT
chmod +x "$WT/bin/git"
git -C "$FX/wt" add .
git -C "$FX/wt" commit -qm telemetry-failure
export PANDACORP_OWNER_RELEASE_OK=1
run_queue
unset PANDACORP_OWNER_RELEASE_OK
[ "$RC" = 0 ]
[ "$(grep -c 'WARNING: queue telemetry' "$FX/output")" = 1 ]
git -C "$FX/origin.git" cat-file -e main:value.txt
python3 - "$QLOG" <<'PY'
import json, sys
events = [json.loads(line) for line in open(sys.argv[1])]
assert [e['exit'] for e in events if e['event'] == 'end'] == [0]
assert [e['base'] for e in events if e['event'] == 'rebase'] == ['']
PY
echo 'PASS failed telemetry-only Git read preserves landing and exit'
fixture tracked-telemetry-wip
mkdir -p "$APP/.pandacorp/run/gate-reports"
echo original > "$APP/.pandacorp/run/gate-reports/owner.json"
git -C "$FX/app" add -f .pandacorp/run/gate-reports/owner.json
git -C "$FX/app" commit -qm tracked-state
echo dirty > "$APP/.pandacorp/run/gate-reports/owner.json"
run_queue
[ "$RC" = 12 ]
[ "$(cat "$APP/.pandacorp/run/gate-reports/owner.json")" = dirty ]
echo 'PASS tracked WIP remains protected under telemetry paths'
run_exit_case 14
echo 'RESULT: 16 passed, 0 failed'
