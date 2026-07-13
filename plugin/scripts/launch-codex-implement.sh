#!/usr/bin/env bash
set -euo pipefail
PROJ="${1:-.}"; MAX_SPEND="${2:-12}"; MAX_DURATION="${3:-21600}"; MAX_RETRIES="${4:-2}"; MAX_BLOCKS="${5:-3}"; CHANGE="${6:-}"; FRDS="${7:-}"; RUN_MODE="${8:-auto}"; LAUNCH_MODE="${9:-${PANDACORP_CODEX_LAUNCH_MODE:-background}}"; CERT_AUTH="${10:-}"; ROOT=$(cd "$(dirname "$0")/.." && pwd); PROJECT=$(cd "$PROJ" && pwd -P)
CERT_CONSUMED=0
revoke_certification() { if [ "$CERT_CONSUMED" = "1" ]; then if node "$ROOT/runtime/codex/certification-permit.mjs" --mode terminal "${CERT_ARGS[@]}" --run-id "$RUN_ID" --terminal-reason "launcher-exit-${result:-3}" >/dev/null; then CERT_CONSUMED=0; else return 1; fi; fi; }
trap revoke_certification EXIT
for pair in "max-spend:$MAX_SPEND" "max-duration:$MAX_DURATION" "max-retries:$MAX_RETRIES" "max-blocks:$MAX_BLOCKS"; do value=${pair#*:}; [[ "$value" =~ ^[0-9]+$ ]] || { echo "ERROR: ${pair%%:*} must be an integer" >&2; exit 3; }; done
IMPLEMENT_STATUS=$(node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const s=p.overrides?.implement?.codex?.status||p.defaults?.codex?.status;if(!s)process.exit(3);process.stdout.write(s)' "$ROOT/runtime/skill-runtime-policy.json") || { echo "ERROR: cannot resolve Codex implement capability policy" >&2; exit 3; }
if [ "$IMPLEMENT_STATUS" != "PROVEN" ] && [ -z "$CERT_AUTH" ]; then
  echo "ERROR: Codex implement is $IMPLEMENT_STATUS; a valid one-shot R10/R11 certification authorization is required" >&2
  exit 3
fi
command -v codex >/dev/null || { echo "ERROR: codex CLI missing" >&2; exit 3; }
codex login status >/dev/null 2>&1 || { echo "ERROR: Codex is not authenticated" >&2; exit 3; }
case "$LAUNCH_MODE" in background|foreground) ;; *) echo "ERROR: launch mode must be background or foreground" >&2; exit 3;; esac
if [ -n "$CERT_AUTH" ]; then
  [ "$LAUNCH_MODE" = "foreground" ] || { echo "ERROR: certification launch must be foreground" >&2; exit 3; }
  [ -z "$CHANGE" ] && [ -n "$FRDS" ] || { echo "ERROR: certification launch requires an exact FRD target and no change target" >&2; exit 3; }
  CERT_ARGS=(--project "$PROJECT" --authorization "$CERT_AUTH" --frds "$FRDS" --max-spend "$MAX_SPEND" --max-duration "$MAX_DURATION" --max-retries "$MAX_RETRIES" --max-blocks "$MAX_BLOCKS")
  CERT_CHECK=$(node "$ROOT/runtime/codex/certification-permit.mjs" --mode check "${CERT_ARGS[@]}")
  CERT_RECEIPT=$(node -e 'const v=JSON.parse(process.argv[1]);if(!v.receipt)process.exit(3);process.stdout.write(v.receipt)' "$CERT_CHECK") || exit $?
fi
NEW_RUN_ID="codex-$(date -u +%Y%m%dT%H%M%SZ)-$$"
RESOLUTION=$(node "$ROOT/scripts/resolve-build-run-id.mjs" --project "$PROJECT" --runtime codex --mode "$RUN_MODE" --new-id "$NEW_RUN_ID") || exit $?
RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]);if(!v.run_id)process.exit(3);process.stdout.write(v.run_id)' "$RESOLUTION") || exit $?
IS_CONTINUATION=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).continuation?"1":"0")' "$RESOLUTION") || exit $?
PREFLIGHT_ARGS=("$PROJECT" --target-runtime codex --run-mode "$RUN_MODE")
if [ "$IS_CONTINUATION" = "1" ]; then PREFLIGHT_ARGS+=(--continue-runtime codex --continue-run-id "$RUN_ID"); fi
if [ -n "$CERT_AUTH" ]; then PREFLIGHT_ARGS+=(--certification-only); fi
bash "$ROOT/scripts/preflight-implement.sh" "${PREFLIGHT_ARGS[@]}"
node "$ROOT/scripts/preflight-codex-unattended.mjs" "$PROJECT"
if [ -n "$CERT_AUTH" ]; then node "$ROOT/runtime/codex/certification-permit.mjs" --mode consume "${CERT_ARGS[@]}" --run-id "$RUN_ID" >/dev/null; CERT_CONSUMED=1; fi
LOG="$PROJECT/.pandacorp/run/codex-executor.log"; mkdir -p "$PROJECT/.pandacorp/run"
CMD=(node "$ROOT/runtime/codex/supervisor.mjs" --project "$PROJECT" --run-id "$RUN_ID" --max-spend "$MAX_SPEND" --max-duration "$MAX_DURATION" --max-retries "$MAX_RETRIES" --max-blocks "$MAX_BLOCKS")
[ -n "$CHANGE" ] && CMD+=(--change "$CHANGE")
[ -n "$FRDS" ] && CMD+=(--frds "$FRDS")
if [ -n "$CERT_AUTH" ]; then CMD+=(--certification-receipt "$CERT_RECEIPT"); fi
if [ "$LAUNCH_MODE" = "background" ]; then nohup "${CMD[@]}" >>"$LOG" 2>&1 & else "${CMD[@]}" >>"$LOG" 2>&1 & fi
SUPERVISOR_PID=$!
if [ "$(uname -s)" = "Darwin" ]; then
  if [ "$LAUNCH_MODE" = "background" ]; then nohup caffeinate -dimsu -w "$SUPERVISOR_PID" >>"$LOG" 2>&1 & else caffeinate -dimsu -w "$SUPERVISOR_PID" >>"$LOG" 2>&1 & fi; INHIBITOR_PID=$!
elif command -v systemd-inhibit >/dev/null 2>&1; then
  if [ "$LAUNCH_MODE" = "background" ]; then nohup systemd-inhibit --what=sleep --why="Pandacorp Codex unattended build" sh -c 'while kill -0 "$1" 2>/dev/null; do sleep 1; done' -- "$SUPERVISOR_PID" >>"$LOG" 2>&1 & else systemd-inhibit --what=sleep --why="Pandacorp Codex unattended build" sh -c 'while kill -0 "$1" 2>/dev/null; do sleep 1; done' -- "$SUPERVISOR_PID" >>"$LOG" 2>&1 & fi; INHIBITOR_PID=$!
else
  kill -TERM "$SUPERVISOR_PID" 2>/dev/null || true; echo "ERROR: no certified sleep-prevention command for this host" >&2; exit 3
fi
sleep 1
if ! kill -0 "$SUPERVISOR_PID" 2>/dev/null || ! kill -0 "$INHIBITOR_PID" 2>/dev/null; then
  kill -TERM "$SUPERVISOR_PID" "$INHIBITOR_PID" 2>/dev/null || true; wait "$SUPERVISOR_PID" 2>/dev/null || true; wait "$INHIBITOR_PID" 2>/dev/null || true
  echo "ERROR: Codex supervisor or sleep inhibitor failed during launch; see $LOG" >&2; exit 3
fi
RECEIPT="$PROJECT/.pandacorp/run/codex-launch.json"
if [ "$LAUNCH_MODE" = "foreground" ]; then
  stopping=0
  stop_children() {
    [ "$stopping" = "1" ] && return; stopping=1
    kill -TERM "$SUPERVISOR_PID" "$INHIBITOR_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do kill -0 "$SUPERVISOR_PID" 2>/dev/null || break; sleep 0.1; done
    kill -KILL "$SUPERVISOR_PID" "$INHIBITOR_PID" 2>/dev/null || true
  }
  trap 'stop_children' INT TERM HUP
fi
RESUME_ARGV=(bash "$ROOT/scripts/launch-codex-implement.sh" "$PROJECT" "$MAX_SPEND" "$MAX_DURATION" "$MAX_RETRIES" "$MAX_BLOCKS" "$CHANGE" "$FRDS" "$RUN_ID" "$LAUNCH_MODE")
[ -n "$CERT_AUTH" ] && RESUME_ARGV+=("$CERT_AUTH")
node -e 'const fs=require("node:fs");const [file,runId,supervisorPid,inhibitorPid,launcherPid,launchMode,started,...rest]=process.argv.slice(1);const split=rest.indexOf("--supervisor-argv");if(split<0)process.exit(3);const resumeArgv=rest.slice(0,split),supervisorArgv=rest.slice(split+1);const value={run_id:runId,pid:Number(supervisorPid),supervisor_pid:Number(supervisorPid),sleep_inhibitor_pid:Number(inhibitorPid),launcher_pid:Number(launcherPid),launch_mode:launchMode,runtime:"codex",started_at:started,resume_argv:resumeArgv,supervisor_argv:supervisorArgv};const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});fs.renameSync(tmp,file);' "$RECEIPT" "$RUN_ID" "$SUPERVISOR_PID" "$INHIBITOR_PID" "$$" "$LAUNCH_MODE" "$(date -u +%FT%TZ)" "${RESUME_ARGV[@]}" --supervisor-argv "${CMD[@]}"
echo "Codex executor started: run=$RUN_ID mode=$LAUNCH_MODE resolution=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).reason)' "$RESOLUTION") supervisor=$SUPERVISOR_PID sleep-inhibitor=$INHIBITOR_PID log=$LOG"
if [ "$LAUNCH_MODE" = "foreground" ]; then
  set +e; wait "$SUPERVISOR_PID"; result=$?; set -e
  if [ "$stopping" = "1" ]; then set +e; wait "$SUPERVISOR_PID"; result=$?; set -e; fi
  kill -TERM "$INHIBITOR_PID" 2>/dev/null || true
  wait "$INHIBITOR_PID" 2>/dev/null || true
  if [ -n "$CERT_AUTH" ]; then
    if node "$ROOT/runtime/codex/certification-permit.mjs" --mode terminal "${CERT_ARGS[@]}" --run-id "$RUN_ID" --terminal-reason "exit-$result" >/dev/null; then CERT_CONSUMED=0; else result=3; fi
  fi
  exit "$result"
fi
