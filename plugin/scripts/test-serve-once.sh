#!/bin/bash
# Self-test for the overlay helper .pandacorp/serve-once.sh (BL-0223).
#
# The incident (bench FM-10): a gate agent stopped its own `next start` with a host-wide pkill by pattern, which
# also killed an unrelated Next.js server on the machine. The helper exists so an agent never needs a pattern kill:
# it starts the server on a free ephemeral port in its OWN process group and kills exactly that group on exit.
#
# Exercises the REAL script against a trivial node http server (fast, no Next.js). Covers:
#   (a) two concurrent instances get different ports and are independent: stop one, the other still answers 200
#       (the exact failure mode of FM-10), and the stopped one's whole group is gone (server + grandchild);
#   (b) --run executes a command against the live URL, returns its exit status and leaves no server behind;
#   (c) a command that dies at startup fails loud (non-zero), never a silent "ready";
#   (d) a bare `--` form with an explicit directory starts the command in that directory.
#
# Run from the repo root: bash plugin/scripts/test-serve-once.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$HERE/plugin/templates/shared/.pandacorp/serve-once.sh"
pass=0; fail=0

ok() { if [ "$1" = "1" ]; then echo "  ✓ $2"; pass=$((pass+1)); else echo "  ✗ $2"; fail=$((fail+1)); fi; }

TMP=$(mktemp -d)
TMP=$(cd "$TMP" && pwd -P)
HELPER_PIDS=()
cleanup() {
  for p in "${HELPER_PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done
  rm -rf "$TMP"
}
trap cleanup EXIT

SERVER_JS='require("http").createServer((q,r)=>r.end("ok:"+process.env.PORT)).listen(process.env.PORT,"127.0.0.1")'

http_code() { curl -s -o /dev/null -m 3 -w '%{http_code}' "$1" 2>/dev/null; }

wait_for_file() { # $1 = file, waits up to ~15 s for it to be non-empty
  local i=0
  while [ ! -s "$1" ] && [ "$i" -lt 150 ]; do sleep 0.1; i=$((i+1)); done
  [ -s "$1" ]
}

wait_gone() { # $1 = url, waits up to ~8 s for connection refusal (http code 000)
  local i=0
  while [ "$(http_code "$1")" != "000" ] && [ "$i" -lt 80 ]; do sleep 0.1; i=$((i+1)); done
  [ "$(http_code "$1")" = "000" ]
}

if [ ! -f "$SCRIPT" ]; then
  echo "  ✗ helper missing: $SCRIPT"
  echo "RESULT: 0 passed, 1 failed"
  exit 1
fi

echo "== (a) two concurrent instances are independent =="
# Instance A wraps the server in a shell so the listener is a GRANDCHILD: only a process-group kill removes it.
bash "$SCRIPT" --url-file "$TMP/a.url" --timeout 30 -- bash -c "node -e '$SERVER_JS' & wait" >"$TMP/a.log" 2>&1 &
A_PID=$!; HELPER_PIDS+=("$A_PID")
bash "$SCRIPT" --url-file "$TMP/b.url" --timeout 30 -- node -e "$SERVER_JS" >"$TMP/b.log" 2>&1 &
B_PID=$!; HELPER_PIDS+=("$B_PID")

wait_for_file "$TMP/a.url"; wait_for_file "$TMP/b.url"
A_URL=$(cat "$TMP/a.url" 2>/dev/null); B_URL=$(cat "$TMP/b.url" 2>/dev/null)
ok "$([ -n "$A_URL" ] && [ -n "$B_URL" ] && [ "$A_URL" != "$B_URL" ] && echo 1 || echo 0)" "each instance prints its own URL on its own ephemeral port ($A_URL vs $B_URL)"
ok "$([ "$(http_code "$A_URL")" = "200" ] && [ "$(http_code "$B_URL")" = "200" ] && echo 1 || echo 0)" "both answer HTTP 200"

kill -TERM "$A_PID" 2>/dev/null; wait "$A_PID" 2>/dev/null
ok "$(wait_gone "$A_URL" && echo 1 || echo 0)" "stopping A takes its whole process group down (incl. the grandchild listener)"
ok "$([ "$(http_code "$B_URL")" = "200" ] && echo 1 || echo 0)" "B still answers 200 after A was stopped (FM-10 failure mode)"

kill -TERM "$B_PID" 2>/dev/null; wait "$B_PID" 2>/dev/null
ok "$(wait_gone "$B_URL" && echo 1 || echo 0)" "stopping B takes it down too"

echo "== (b) --run: exercises the live URL, returns its status, leaves nothing behind =="
out=$(bash "$SCRIPT" --timeout 30 --run 'curl -s -o /dev/null -m 3 -w "%{http_code}" "$SERVE_URL"' -- node -e "$SERVER_JS" 2>"$TMP/run.err")
rc=$?
ok "$([ "$rc" = "0" ] && echo 1 || echo 0)" "--run returns the run command's exit status (0)"
ok "$(echo "$out" | grep -q '200' && echo 1 || echo 0)" "--run saw HTTP 200 on \$SERVE_URL"
RUN_URL=$(grep -Eo 'http://127\.0\.0\.1:[0-9]+' "$TMP/run.err" | head -1)
ok "$([ -n "$RUN_URL" ] && wait_gone "$RUN_URL" && echo 1 || echo 0)" "the server is gone once --run finishes (${RUN_URL:-no url on stderr})"
bash "$SCRIPT" --timeout 30 --run 'exit 7' -- node -e "$SERVER_JS" >/dev/null 2>&1
ok "$([ "$?" = "7" ] && echo 1 || echo 0)" "--run propagates a non-zero exit status"

echo "== (c) a command that dies at startup fails loud =="
bash "$SCRIPT" --timeout 10 -- node -e 'process.exit(3)' >"$TMP/dead.log" 2>&1
ok "$([ "$?" != "0" ] && echo 1 || echo 0)" "non-zero exit when the server never becomes ready"

echo "== (d) explicit directory before -- =="
mkdir -p "$TMP/app"
printf 'require("http").createServer((q,r)=>r.end(process.cwd())).listen(process.env.PORT,"127.0.0.1")\n' > "$TMP/app/server.js"
got=$(bash "$SCRIPT" "$TMP/app" --timeout 30 --run 'curl -s -m 3 "$SERVE_URL"' -- node server.js 2>/dev/null)
ok "$([ "$got" = "$TMP/app" ] && echo 1 || echo 0)" "the command ran inside the given directory ($got)"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
