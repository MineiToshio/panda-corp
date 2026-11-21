#!/bin/bash
# Fixtures keep queue telemetry and host admission away from real projects.
QUEUE_FACTORY=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
QUEUE_TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/p43-queue.XXXXXX")
QUEUE_TEST_ROOT=$(cd "$QUEUE_TEST_ROOT" && pwd -P)
export PANDACORP_HOST_DIR="$QUEUE_TEST_ROOT/host"
export GIT_AUTHOR_NAME=QueueTest GIT_AUTHOR_EMAIL=queue@example.invalid
export GIT_COMMITTER_NAME=QueueTest GIT_COMMITTER_EMAIL=queue@example.invalid
trap 'rm -rf "$QUEUE_TEST_ROOT"' EXIT
fixture() {
  local name="$1" prefix="${2:-}"
  FX="$QUEUE_TEST_ROOT/$name"
  git init -q --bare -b main "$FX/origin.git"
  git clone -q "$FX/origin.git" "$FX/app" 2>/dev/null
  git -C "$FX/app" config commit.gpgsign false
  APP="$FX/app/${prefix}"
  mkdir -p "$APP/.pandacorp" "$APP/bin"
  printf '#!/bin/bash\nexit 0\n' > "$APP/bin/osascript"
  chmod +x "$APP/bin/osascript"
  cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/merge-queue.sh" "$APP/.pandacorp/"
  cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/green-stamp.sh" "$APP/.pandacorp/"
  printf 'phase: implementation\n' > "$APP/.pandacorp/status.yaml"
  cat > "$APP/.pandacorp/verify.sh" <<'VERIFY'
#!/bin/bash
if [ "${MQ_NO_REPORT:-0}" = 1 ]; then exit "${MQ_GATE_RC:-0}"; fi
if [ "${MQ_TOUCH_REPORT:-0}" = 1 ]; then
  python3 - <<'PY'
import datetime, json, os, time
path = '.pandacorp/run/gate-report.json'
at = datetime.datetime.fromisoformat(json.load(open(path))['at'].replace('Z', '+00:00')).timestamp()
time.sleep(max(0, at - time.time()))
os.utime(path, None)
PY
  exit 0
fi
mkdir -p .pandacorp/run
rm -f .pandacorp/run/gate-report.json
printf '{"run":"%s","at":"%s","scope":"full","sha":"%s"}\n' \
  "${MQ_REPORT_ID:-first}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json
if [ "${MQ_SLEEP:-0}" = 1 ]; then
  touch .pandacorp/run/gate-started
  sleep 60
fi
exit "${MQ_GATE_RC:-0}"
VERIFY
  chmod +x "$APP/.pandacorp/verify.sh"
  printf '.pandacorp/run/\n' > "$APP/.gitignore"
  echo base > "$APP/value.txt"
  git -C "$FX/app" add .
  git -C "$FX/app" commit -qm init
  git -C "$FX/app" push -q origin main
  git -C "$FX/app" worktree add -q "$FX/wt" -b "feature-${name// /-}"
  WT="$FX/wt/${prefix}"
  echo feature > "$WT/value.txt"
  git -C "$FX/wt" add .
  git -C "$FX/wt" commit -qm feature
  QLOG="$APP/.pandacorp/run/queue-log.jsonl"
}
run_queue() {
  RC=0
  (cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/merge-queue.sh) > "$FX/output" 2>&1 || RC=$?
}
