#!/bin/bash
# Pandacorp serve-once (BL-0223) — run a dev/prod server for ONE check, on a port nobody else uses, and stop
# exactly that server and nothing else.
#
# Why: stopping an ad-hoc server with `pkill -f "next start"` / `killall node` matches the command line of EVERY
# process on the machine and kills the owner's other servers (a parallel session's preview, a benchmark oracle,
# Mission Control). A fixed port (3000) additionally collides between two concurrent gates. This helper removes
# the need for either: it picks a free ephemeral port, starts the command in its OWN process group with PORT set,
# waits until HTTP answers, and on exit/trap kills that process group only (the server and everything it spawned,
# e.g. pnpm -> next -> next-server). The safety gate (block-dangerous.sh) refuses the host-wide forms and points here.
#
# Usage:
#   serve-once.sh [<dir>] [--url-file FILE] [--timeout SECONDS] [--run '<shell command>'] -- <server command...>
#
#   <dir>           directory to start the server in (default: the current directory)
#   --url-file F    also write the URL to F (for an agent that backgrounds this script and reads it back)
#   --timeout S     seconds to wait for HTTP readiness (default 90); never waits forever
#   --run CMD       once ready, run CMD (sh -c) with SERVE_URL and PORT exported, then stop the server and exit with
#                   CMD's status — the whole smoke in one self-cleaning call. Without --run the server stays up in
#                   the foreground until this script is stopped (kill <its PID>, or Ctrl-C); stopping it stops the group.
#
# Output: the URL (http://127.0.0.1:<port>) is the only line on stdout in foreground mode; with --run it goes to
# stderr so stdout stays the run command's own output. Ready = any HTTP response (a 404 or 500 still proves the
# listener is up). Exit: the server's own status in foreground mode, CMD's with --run, 1 if it never became ready.
set -u

DIR="."
URL_FILE=""
TIMEOUT=90
RUN_CMD=""
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then DIR="$1"; shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --url-file) URL_FILE="${2:-}"; shift 2 ;;
    --timeout)  TIMEOUT="${2:-90}"; shift 2 ;;
    --run)      RUN_CMD="${2:-}"; shift 2 ;;
    --)         shift; break ;;
    *)          echo "serve-once: unknown argument '$1' (usage: serve-once.sh [<dir>] [--url-file F] [--timeout S] [--run CMD] -- <command...>)" >&2; exit 2 ;;
  esac
done
[ $# -gt 0 ] || { echo "serve-once: missing server command after --" >&2; exit 2; }
[ -d "$DIR" ] || { echo "serve-once: directory not found: $DIR" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "serve-once: node is required to pick a free port" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "serve-once: curl is required for the readiness probe" >&2; exit 2; }

PORT=$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})') \
  || { echo "serve-once: could not pick a free port" >&2; exit 2; }
URL="http://127.0.0.1:$PORT"

# Job control gives the background server its OWN process group (pgid == pid), so one signal reaches the server
# and every descendant, and nothing outside it.
set -m
PID=""
cleanup() {
  trap - EXIT INT TERM HUP
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill -TERM -- "-$PID" 2>/dev/null
    local i=0
    while kill -0 "$PID" 2>/dev/null && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
    kill -KILL -- "-$PID" 2>/dev/null
    wait "$PID" 2>/dev/null
  elif [ -n "$PID" ]; then
    # the leader already exited; sweep any descendant still holding the group
    kill -TERM -- "-$PID" 2>/dev/null
  fi
}
trap 'cleanup; exit 143' INT TERM HUP
trap cleanup EXIT

( cd "$DIR" && exec env PORT="$PORT" "$@" ) </dev/null &
PID=$!

DEADLINE=$(( $(date +%s) + TIMEOUT ))
READY=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if ! kill -0 "$PID" 2>/dev/null; then
    wait "$PID" 2>/dev/null
    echo "serve-once: the server command exited before answering HTTP on $URL" >&2
    exit 1
  fi
  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$URL/" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ]; then READY=1; break; fi
  sleep 0.2
done
if [ "$READY" != "1" ]; then
  echo "serve-once: $URL did not answer HTTP within ${TIMEOUT}s; stopping the server (process group $PID)" >&2
  exit 1
fi

[ -z "$URL_FILE" ] || printf '%s\n' "$URL" > "$URL_FILE"

if [ -n "$RUN_CMD" ]; then
  echo "serve-once: $URL (process group $PID)" >&2
  SERVE_URL="$URL" PORT="$PORT" sh -c "$RUN_CMD"
  rc=$?
  exit "$rc"
fi

printf '%s\n' "$URL"
wait "$PID"
exit $?
