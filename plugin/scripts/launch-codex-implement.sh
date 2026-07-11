#!/usr/bin/env bash
set -euo pipefail
PROJ="${1:-.}"; MAX_SPEND="${2:-12}"; MAX_DURATION="${3:-21600}"; MAX_RETRIES="${4:-2}"; MAX_BLOCKS="${5:-3}"; CHANGE="${6:-}"; FRDS="${7:-}"; RUN_MODE="${8:-auto}"; ROOT=$(cd "$(dirname "$0")/.." && pwd); PROJECT=$(cd "$PROJ" && pwd -P)
for pair in "max-spend:$MAX_SPEND" "max-duration:$MAX_DURATION" "max-retries:$MAX_RETRIES" "max-blocks:$MAX_BLOCKS"; do value=${pair#*:}; [[ "$value" =~ ^[0-9]+$ ]] || { echo "ERROR: ${pair%%:*} must be an integer" >&2; exit 3; }; done
command -v codex >/dev/null || { echo "ERROR: codex CLI missing" >&2; exit 3; }
codex login status >/dev/null 2>&1 || { echo "ERROR: Codex is not authenticated" >&2; exit 3; }
NEW_RUN_ID="codex-$(date -u +%Y%m%dT%H%M%SZ)-$$"
RESOLUTION=$(node "$ROOT/scripts/resolve-build-run-id.mjs" --project "$PROJECT" --runtime codex --mode "$RUN_MODE" --new-id "$NEW_RUN_ID") || exit $?
RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]);if(!v.run_id)process.exit(3);process.stdout.write(v.run_id)' "$RESOLUTION") || exit $?
IS_CONTINUATION=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).continuation?"1":"0")' "$RESOLUTION") || exit $?
PREFLIGHT_ARGS=("$PROJECT" --target-runtime codex --run-mode "$RUN_MODE")
if [ "$IS_CONTINUATION" = "1" ]; then PREFLIGHT_ARGS+=(--continue-runtime codex --continue-run-id "$RUN_ID"); fi
bash "$ROOT/scripts/preflight-implement.sh" "${PREFLIGHT_ARGS[@]}"
node "$ROOT/scripts/preflight-codex-unattended.mjs" "$PROJECT"
LOG="$PROJECT/.pandacorp/run/codex-executor.log"; mkdir -p "$PROJECT/.pandacorp/run"
CMD=(node "$ROOT/runtime/codex/supervisor.mjs" --project "$PROJECT" --run-id "$RUN_ID" --max-spend "$MAX_SPEND" --max-duration "$MAX_DURATION" --max-retries "$MAX_RETRIES" --max-blocks "$MAX_BLOCKS")
[ -n "$CHANGE" ] && CMD+=(--change "$CHANGE")
[ -n "$FRDS" ] && CMD+=(--frds "$FRDS")
nohup "${CMD[@]}" >>"$LOG" 2>&1 &
SUPERVISOR_PID=$!
if [ "$(uname -s)" = "Darwin" ]; then
  nohup caffeinate -dimsu -w "$SUPERVISOR_PID" >>"$LOG" 2>&1 & INHIBITOR_PID=$!
elif command -v systemd-inhibit >/dev/null 2>&1; then
  nohup systemd-inhibit --what=sleep --why="Pandacorp Codex unattended build" sh -c 'while kill -0 "$1" 2>/dev/null; do sleep 1; done' -- "$SUPERVISOR_PID" >>"$LOG" 2>&1 & INHIBITOR_PID=$!
else
  kill -TERM "$SUPERVISOR_PID" 2>/dev/null || true; echo "ERROR: no certified sleep-prevention command for this host" >&2; exit 3
fi
sleep 1
if ! kill -0 "$SUPERVISOR_PID" 2>/dev/null || ! kill -0 "$INHIBITOR_PID" 2>/dev/null; then
  kill -TERM "$SUPERVISOR_PID" "$INHIBITOR_PID" 2>/dev/null || true; wait "$SUPERVISOR_PID" 2>/dev/null || true; wait "$INHIBITOR_PID" 2>/dev/null || true
  echo "ERROR: Codex supervisor or sleep inhibitor failed during launch; see $LOG" >&2; exit 3
fi
RECEIPT="$PROJECT/.pandacorp/run/codex-launch.json"
RESUME_ARGV=(bash "$ROOT/scripts/launch-codex-implement.sh" "$PROJECT" "$MAX_SPEND" "$MAX_DURATION" "$MAX_RETRIES" "$MAX_BLOCKS" "$CHANGE" "$FRDS" "$RUN_ID")
node -e 'const fs=require("node:fs");const [file,runId,supervisorPid,inhibitorPid,started,...rest]=process.argv.slice(1);const resumeArgv=rest.slice(0,10),supervisorArgv=rest.slice(10);const value={run_id:runId,pid:Number(supervisorPid),supervisor_pid:Number(supervisorPid),sleep_inhibitor_pid:Number(inhibitorPid),runtime:"codex",started_at:started,resume_argv:resumeArgv,supervisor_argv:supervisorArgv};const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});fs.renameSync(tmp,file);' "$RECEIPT" "$RUN_ID" "$SUPERVISOR_PID" "$INHIBITOR_PID" "$(date -u +%FT%TZ)" "${RESUME_ARGV[@]}" "${CMD[@]}"
echo "Codex executor started: run=$RUN_ID resolution=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).reason)' "$RESOLUTION") supervisor=$SUPERVISOR_PID sleep-inhibitor=$INHIBITOR_PID log=$LOG"
