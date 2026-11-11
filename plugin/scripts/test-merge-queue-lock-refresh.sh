#!/bin/bash
# Canary for the engine-v10 additions to the template merge-queue.sh (PLAN 3.16 A1, row B09):
#   - the shared merge lock (<git-common-dir>/pandacorp-merge.lock) is kept fresh while a long
#     verify.sh runs (test hook PANDACORP_LOCK_REFRESH_SECS), so a waiter never reclaims a LIVE lock;
#   - one host heavy-job slot (<host>/h-slots/slot-<i>, owner.json {pid,kind:"merge-queue",project,at})
#     is held around verify.sh and released on success, on a red verify (11) and on exit 21
#     (launched project without PANDACORP_OWNER_RELEASE_OK: the production gate is unchanged);
#   - a slot whose owner pid is dead (or an ownerless slot older than 60 s) is reclaimed; a slot that is
#     live (or ownerless and fresh) is respected: with the limit reached the queue waits, then proceeds;
#   - the host dir comes from PANDACORP_HOST_DIR (default ~/.pandacorp/host).
# merge-queue.sh is driven as a black box; verify.sh is a probe that records what it observes.
# Run from the factory repo root: bash plugin/scripts/test-merge-queue-lock-refresh.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
MQ="$HERE/plugin/templates/shared/.pandacorp/merge-queue.sh"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

SCRATCH=$(cd "$(mktemp -d)" && pwd -P)
BG_PIDS=""
cleanup() {
  local p
  for p in $BG_PIDS; do kill "$p" 2>/dev/null || true; done
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

if [ ! -f "$MQ" ]; then echo "template merge-queue.sh not found at $MQ"; echo "RESULT: 0 passed, 1 failed"; exit 1; fi
command -v jq >/dev/null || { echo "jq is required"; echo "RESULT: 0 passed, 1 failed"; exit 1; }

# H_max per A1: max(1, min(2, floor(ncpu/4))), ncpu from getconf in bash.
NCPU=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)
HMAX=$((NCPU / 4)); [ "$HMAX" -gt 2 ] && HMAX=2; [ "$HMAX" -lt 1 ] && HMAX=1

# The probe verify.sh. Controlled by env: VERIFY_OUT (dir, required), VERIFY_EXIT, VERIFY_SLEEP (s),
# VERIFY_AGE_LOCK (1 = backdate the merge lock to 10 minutes ago, then sleep, then record its age).
PROBE='#!/bin/bash
out="$VERIFY_OUT"; mkdir -p "$out"
common=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
lock="$common/pandacorp-merge.lock"
host="${PANDACORP_HOST_DIR:-$HOME/.pandacorp/host}"
echo 1 > "$out/started"
date +%s > "$out/started-at"
[ -d "$lock" ] && echo 1 > "$out/lock-exists-at-start"
ls "$host/h-slots" 2>/dev/null | grep "^slot-" | sort > "$out/slots"
for s in "$host"/h-slots/slot-*; do
  [ -f "$s/owner.json" ] || continue
  cp "$s/owner.json" "$out/owner-$(basename "$s").json"
  pid=$(jq -r ".pid" "$s/owner.json" 2>/dev/null)
  if kill -0 "$pid" 2>/dev/null; then echo "$pid alive" >> "$out/owner-liveness"; else echo "$pid dead" >> "$out/owner-liveness"; fi
done
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1"; }
if [ "${VERIFY_AGE_LOCK:-0}" = 1 ]; then
  stamp=$(date -v-10M +%Y%m%d%H%M.%S 2>/dev/null || date -d "10 minutes ago" +%Y%m%d%H%M.%S)
  touch -t "$stamp" "$lock"
  echo "$(( $(date +%s) - $(mtime "$lock") ))" > "$out/lock-age-before"
fi
[ -n "${VERIFY_SLEEP:-}" ] && sleep "$VERIFY_SLEEP"
if [ -d "$lock" ]; then echo "$(( $(date +%s) - $(mtime "$lock") ))" > "$out/lock-age-after"; fi
exit "${VERIFY_EXIT:-0}"
'

# $1 = status.yaml body -> echoes the fixture root (origin.git + app checkout + wt worktree)
fixture() {
  local root; root=$(cd "$(mktemp -d "$SCRATCH/fx.XXXXXX")" && pwd -P)
  git init -q --bare -b main "$root/origin.git"
  git clone -q "$root/origin.git" "$root/app" 2>/dev/null
  mkdir -p "$root/app/.pandacorp"
  printf '%b' "$1" > "$root/app/.pandacorp/status.yaml"
  cp "$MQ" "$root/app/.pandacorp/merge-queue.sh"
  printf '%s' "$PROBE" > "$root/app/.pandacorp/verify.sh"
  chmod +x "$root/app/.pandacorp/verify.sh"
  ( cd "$root/app" && git add -A && git commit -q -m init && git push -q origin main 2>/dev/null \
    && git worktree add -q "$root/wt" -b feature-x && cd "$root/wt" && echo x > feature.txt \
    && git add feature.txt && git commit -q -m "feat: x" )
  echo "$root"
}
IMPL='project: demo\nphase: implementation\n'
LAUNCHED='project: demo\nphase: release\ndeploy_target: external\n'

# run_mq <fx> [ENV=VAL ...] -> sets rc, log (foreground)
run_mq() {
  local fx="$1"; shift
  log=$( cd "$fx/wt" && env PANDACORP_HOST_DIR="$fx/host" VERIFY_OUT="$fx/out" "$@" bash .pandacorp/merge-queue.sh 2>&1 ); rc=$?
}
main_has_feature() { git -C "$1/app" cat-file -e main:feature.txt 2>/dev/null; }
slots_left() { ls "$1/host/h-slots" 2>/dev/null | grep -c '^slot-' || true; }
backdate() { # $1 path, $2 minutes
  local stamp; stamp=$(date -v-"$2"M +%Y%m%d%H%M.%S 2>/dev/null || date -d "$2 minutes ago" +%Y%m%d%H%M.%S)
  touch -t "$stamp" "$1"
}
mkslot() { # $1 host, $2 index, $3 pid (empty = no owner.json)
  mkdir -p "$1/h-slots/slot-$2"
  [ -n "$3" ] && printf '{"pid":%s,"kind":"g2","project":"/tmp/other","at":"2026-01-01T00:00:00Z"}\n' "$3" > "$1/h-slots/slot-$2/owner.json"
  return 0
}
wait_for() { # $1 file, $2 max tenths of a second
  local i=0; while [ ! -e "$1" ] && [ "$i" -lt "$2" ]; do sleep 0.1; i=$((i+1)); done; [ -e "$1" ]
}

echo "== lock refresh: a backdated lock stays fresh during a long verify =="
fx=$(fixture "$IMPL")
run_mq "$fx" PANDACORP_LOCK_REFRESH_SECS=1 VERIFY_AGE_LOCK=1 VERIFY_SLEEP=3
[ "$rc" = 0 ] && ok "queue lands (exit 0)" || bad "expected 0, got $rc: $log"
[ "$(cat "$fx/out/lock-exists-at-start" 2>/dev/null)" = 1 ] && ok "merge lock is held while verify runs" || bad "lock not held during verify"
before=$(cat "$fx/out/lock-age-before" 2>/dev/null || echo "")
after=$(cat "$fx/out/lock-age-after" 2>/dev/null || echo "")
if [ -n "$before" ] && [ "$before" -ge 500 ] && [ -n "$after" ] && [ "$after" -le 120 ]; then
  ok "lock mtime refreshed during verify (age ${before}s -> ${after}s, stale limit is 15 min)"
else bad "lock mtime not refreshed (age before='$before' after='$after')"; fi
main_has_feature "$fx" && ok "change landed on main" || bad "main missing the change"
sleep 2
[ ! -d "$fx/app/.git/pandacorp-merge.lock" ] && ok "lock released and not recreated by the refresher afterwards" || bad "lock present after the queue exited (refresher leaked or lock not released)"
rm -rf "$fx"

echo "== host slot: taken around verify, owner.json per A1, released on success =="
fx=$(fixture "$IMPL")
start=$SECONDS
run_mq "$fx"
elapsed=$((SECONDS - start))
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc: $log"
[ "$elapsed" -lt 15 ] && ok "queue returns promptly with captured output and the default refresh interval (${elapsed}s)" || bad "queue held its output open for ${elapsed}s (background refresher keeps the pipe)"
[ "$(cat "$fx/out/slots" 2>/dev/null)" = "slot-0" ] && ok "exactly slot-0 (lowest free index) held during verify, under PANDACORP_HOST_DIR" || bad "slots during verify: '$(cat "$fx/out/slots" 2>/dev/null)'"
oj="$fx/out/owner-slot-0.json"
if [ -f "$oj" ] && jq -e '(.pid|type)=="number" and .pid>0 and .kind=="merge-queue" and (.project|type)=="string" and (.project|startswith("/")) and (.at|type)=="string" and (.at|test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"))' "$oj" >/dev/null 2>&1; then
  ok "owner.json shape: integer pid, kind merge-queue, absolute project, ISO at"
else bad "owner.json missing or wrong shape: $(cat "$oj" 2>/dev/null)"; fi
grep -q alive "$fx/out/owner-liveness" 2>/dev/null && ok "owner pid is alive while verify runs" || bad "owner pid not alive during verify: $(cat "$fx/out/owner-liveness" 2>/dev/null)"
[ "$(slots_left "$fx")" = 0 ] && ok "slot released after success" || bad "slot left behind after success"
[ -d "$fx/host/h-slots" ] && ok "slots live under PANDACORP_HOST_DIR/h-slots" || bad "no h-slots dir in PANDACORP_HOST_DIR"
rm -rf "$fx"

echo "== host slot: default host dir is \$HOME/.pandacorp/host when the hook is unset =="
fx=$(fixture "$IMPL")
fake_home="$fx/home"; mkdir -p "$fake_home"
log=$( cd "$fx/wt" && env -u PANDACORP_HOST_DIR HOME="$fake_home" VERIFY_OUT="$fx/out" \
  GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t bash .pandacorp/merge-queue.sh 2>&1 ); rc=$?
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc: $log"
[ "$(cat "$fx/out/slots" 2>/dev/null)" = "slot-0" ] && ok "slot taken under \$HOME/.pandacorp/host/h-slots" || bad "default host dir not used (slots seen: '$(cat "$fx/out/slots" 2>/dev/null)')"
[ -d "$fake_home/.pandacorp/host/h-slots" ] && [ "$(ls "$fake_home/.pandacorp/host/h-slots" | grep -c '^slot-' || true)" = 0 ] && ok "released in the default dir too" || bad "default host dir missing or slot left"
rm -rf "$fx"

echo "== host slot: released on a red verify (exit 11) =="
fx=$(fixture "$IMPL")
run_mq "$fx" VERIFY_EXIT=1
[ "$rc" = 11 ] && ok "red verify -> exit 11" || bad "expected 11, got $rc: $log"
[ "$(cat "$fx/out/slots" 2>/dev/null)" = "slot-0" ] && ok "slot held while the red verify ran" || bad "slot not held during verify"
[ "$(slots_left "$fx")" = 0 ] && ok "slot released after a red verify" || bad "slot left behind after a red verify"
main_has_feature "$fx" && bad "a red verify landed the change" || ok "main untouched"
[ ! -d "$fx/app/.git/pandacorp-merge.lock" ] && ok "lock released" || bad "lock left behind"
rm -rf "$fx"

echo "== host slot: released on exit 21 (launched, no owner flag); production gate unchanged =="
fx=$(fixture "$LAUNCHED")
run_mq "$fx"
[ "$rc" = 21 ] && ok "exit 21 without PANDACORP_OWNER_RELEASE_OK" || bad "expected 21, got $rc: $log"
[ "$(cat "$fx/out/slots" 2>/dev/null)" = "slot-0" ] && ok "slot was held around the gate" || bad "slot not held during verify"
[ "$(slots_left "$fx")" = 0 ] && ok "slot released on exit 21" || bad "slot left behind after exit 21"
main_has_feature "$fx" && bad "local main moved without the owner's order" || ok "local main untouched"
git -C "$fx/origin.git" cat-file -e main:feature.txt 2>/dev/null && bad "origin main moved without the owner's order" || ok "origin main untouched"
[ ! -d "$fx/app/.git/pandacorp-merge.lock" ] && ok "lock released" || bad "lock left behind"
run_mq "$fx" PANDACORP_OWNER_RELEASE_OK=1
[ "$rc" = 0 ] && ok "with the owner flag: lands (exit 0)" || bad "expected 0 with the flag, got $rc: $log"
git -C "$fx/origin.git" cat-file -e main:feature.txt 2>/dev/null && ok "with the flag: origin pushed" || bad "origin not pushed with the flag"
[ "$(slots_left "$fx")" = 0 ] && ok "slot released after the authorized landing" || bad "slot left behind after the authorized landing"
rm -rf "$fx"

echo "== reclaim: slots whose owner pid is dead =="
fx=$(fixture "$IMPL")
sh -c 'exit 0' & dead=$!; wait "$dead" 2>/dev/null
for i in $(seq 0 $((HMAX - 1))); do mkslot "$fx/host" "$i" "$dead"; done
start=$SECONDS
run_mq "$fx"
elapsed=$((SECONDS - start))
[ "$rc" = 0 ] && ok "queue proceeds (exit 0)" || bad "expected 0, got $rc: $log"
[ "$elapsed" -lt 5 ] && ok "no wait for a dead owner (${elapsed}s, below the 5 s poll)" || bad "queue waited ${elapsed}s on dead slots"
if [ "$(head -1 "$fx/out/slots" 2>/dev/null)" = slot-0 ] && [ "$(jq -r .pid "$fx/out/owner-slot-0.json" 2>/dev/null)" != "$dead" ] && [ "$(jq -r .kind "$fx/out/owner-slot-0.json" 2>/dev/null)" = merge-queue ]; then
  ok "dead slot reclaimed: slot-0 now owned by the merge-queue"
else bad "dead slots not reclaimed (slots '$(cat "$fx/out/slots" 2>/dev/null)', owner '$(cat "$fx/out/owner-slot-0.json" 2>/dev/null)')"; fi
[ ! -e "$fx/host/h-slots/slot-0" ] && ok "the queue's slot released (a second dead slot, if any, may remain: it was not needed)" || bad "slot-0 left behind"
rm -rf "$fx"

echo "== reclaim: ownerless slot older than 60 s =="
fx=$(fixture "$IMPL")
for i in $(seq 0 $((HMAX - 1))); do mkslot "$fx/host" "$i" ""; backdate "$fx/host/h-slots/slot-$i" 5; done
start=$SECONDS
run_mq "$fx"
elapsed=$((SECONDS - start))
[ "$rc" = 0 ] && [ "$elapsed" -lt 5 ] && ok "old ownerless slot reclaimed without waiting (${elapsed}s)" || bad "ownerless old slot not reclaimed (rc=$rc, ${elapsed}s): $log"
[ "$(cat "$fx/out/owner-slot-0.json" 2>/dev/null | jq -r .kind 2>/dev/null)" = merge-queue ] && ok "slot-0 owned by the merge-queue" || bad "slot-0 not taken"
rm -rf "$fx"

echo "== limit reached: the queue waits, then proceeds when a slot frees =="
fx=$(fixture "$IMPL")
sleep 300 & holder=$!; BG_PIDS="$BG_PIDS $holder"
for i in $(seq 0 $((HMAX - 1))); do mkslot "$fx/host" "$i" "$holder"; done
( cd "$fx/wt" && env PANDACORP_HOST_DIR="$fx/host" VERIFY_OUT="$fx/out" bash .pandacorp/merge-queue.sh >"$fx/queue.log" 2>&1; echo $? > "$fx/queue.rc" ) &
qpid=$!; BG_PIDS="$BG_PIDS $qpid"
sleep 1.5
if [ ! -e "$fx/out/started" ] && kill -0 "$qpid" 2>/dev/null; then ok "all $HMAX slot(s) live: queue is waiting, verify has not started"; else bad "queue did not wait for a free slot (verify started: $([ -e "$fx/out/started" ] && echo yes || echo no))"; fi
[ -f "$fx/host/h-slots/slot-0/owner.json" ] && [ "$(jq -r .kind "$fx/host/h-slots/slot-0/owner.json")" = g2 ] && ok "live holder's slot untouched while waiting" || bad "live slot was reclaimed or modified"
git -C "$fx/app" cat-file -e main:feature.txt 2>/dev/null && bad "landed while waiting" || ok "nothing landed while waiting"
rm -rf "$fx/host/h-slots/slot-0"
if wait_for "$fx/out/started" 150; then ok "queue proceeded within the poll cadence after the slot was released"; else bad "queue never proceeded after a slot was freed"; fi
wait "$qpid" 2>/dev/null
[ "$(cat "$fx/queue.rc" 2>/dev/null)" = 0 ] && ok "waiting queue finished green (exit 0)" || bad "waiting queue exit $(cat "$fx/queue.rc" 2>/dev/null): $(cat "$fx/queue.log")"
[ "$(cat "$fx/out/slots" 2>/dev/null | head -1)" = "slot-0" ] && ok "it took the freed slot-0" || bad "unexpected slot taken: '$(cat "$fx/out/slots" 2>/dev/null)'"
if [ "$HMAX" = 2 ]; then
  [ -f "$fx/host/h-slots/slot-1/owner.json" ] && [ "$(jq -r .kind "$fx/host/h-slots/slot-1/owner.json")" = g2 ] && ok "the other live holder's slot-1 survived the queue's release" || bad "foreign slot-1 was removed"
fi
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null
rm -rf "$fx"

echo "== limit reached by a fresh ownerless slot (mid-acquire): not reclaimed until older than 60 s =="
fx=$(fixture "$IMPL")
for i in $(seq 0 $((HMAX - 1))); do mkslot "$fx/host" "$i" ""; done
( cd "$fx/wt" && env PANDACORP_HOST_DIR="$fx/host" VERIFY_OUT="$fx/out" bash .pandacorp/merge-queue.sh >"$fx/queue.log" 2>&1; echo $? > "$fx/queue.rc" ) &
qpid=$!; BG_PIDS="$BG_PIDS $qpid"
sleep 1.5
if [ ! -e "$fx/out/started" ] && kill -0 "$qpid" 2>/dev/null; then ok "fresh ownerless slots respected: queue waits"; else bad "fresh ownerless slot was reclaimed or queue ended early"; fi
for i in $(seq 0 $((HMAX - 1))); do backdate "$fx/host/h-slots/slot-$i" 5; done
if wait_for "$fx/out/started" 150; then ok "reclaimed once the slot aged past 60 s"; else bad "queue never proceeded after the ownerless slot aged"; fi
wait "$qpid" 2>/dev/null
[ "$(cat "$fx/queue.rc" 2>/dev/null)" = 0 ] && ok "finished green" || bad "exit $(cat "$fx/queue.rc" 2>/dev/null): $(cat "$fx/queue.log")"
rm -rf "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
