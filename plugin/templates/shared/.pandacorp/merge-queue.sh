#!/bin/bash
# Pandacorp merge queue (DR-096) — land a manual parallel session's worktree branch into main,
# serialized so two sessions never race the merge. The single-writer principle of build-orchestration
# §2 (DR-060/086) applied at MERGE granularity instead of COMMIT granularity.
#
# Run it FROM INSIDE the worktree once the work is committed and the worktree's own gate is green.
# It: acquires one shared lock → rebases the branch onto the CURRENT main tip → runs the integration
# gate on the merged result → fast-forward-merges into main → removes the worktree + branch → releases.
#
# Exit codes (so the calling agent can act):
#   0  merged + cleaned up      (done — tell the owner "merged")
#   10 handed back: rebase conflict git can't auto-resolve (the agent resolves, or escalates to owner)
#   11 handed back: integration gate RED on the merged result (fix on the branch, re-run)
#   12 handed back: main checkout busy (uncommitted changes block the ff-merge — land when it's quiescent)
#   13 LAUNCHED project: merged into main but the push to origin failed or remains unconfirmed
#   14 handed back: committed e2e PORT busy (stop the dev server / other gate, then re-run) (BL-0288)
#   16 environment not ready (dependencies, typegen or tools); bootstrap, retry once
#   17 main advanced during the gate — re-run the land job
#   20 precondition failed (dirty worktree, wrong checkout, lock timeout, missing executable gate)
#   21 LAUNCHED project: branch rebased + gate green, but main is production (DR-138) — waiting for the
#      owner's explicit order; re-run as `PANDACORP_OWNER_RELEASE_OK=1 bash .pandacorp/merge-queue.sh`
#
# LAUNCHED projects (status.yaml `phase: release`, deploy_target not `internal`; DR-138/INFRA-8): GitHub
# main is production and Vercel deploys every push to it, so landing = releasing. Without the owner's
# order the script stops at exit 21 with the branch ready; with it, it ff-merges AND pushes main.
#
# It NEVER force-merges and NEVER touches another session's WIP (DR-093). A non-auto-resolvable
# conflict or a red gate is HANDED BACK, never papered over.
# This self-contained library is also sourced by with-merge-lock.sh. Keeping the protocol
# here lets older fixtures/installations copy the queue as a single executable.
merge_lock_action() {
  python3 - "$COMMON_DIR" "$LOCK_TOKEN" "$$" "${BRANCH:-command}" "${WORKTREE:-$PWD}" "$1" <<'LOCKPY'
import datetime, fcntl, json, os, shutil, socket, sys, time, uuid
common, token, pid, branch, worktree, action = sys.argv[1:]
pid = int(pid)
host = socket.gethostname()
lock = os.path.join(common, 'pandacorp-merge.lock')
waiters = os.path.join(common, 'pandacorp-merge.waiters')
def read(file):
    try:
        with open(file) as f: value = json.load(f)
        return value if isinstance(value, dict) else {}
    except (ValueError, OSError): return {}
def alive(pid):
    if not isinstance(pid, int) or pid <= 0: return False
    try: os.kill(pid, 0); return True
    except PermissionError: return True
    except ProcessLookupError: return False
def stale(directory):
    owner = read(os.path.join(directory, 'owner.json'))
    if owner.get('hostname') == host and not alive(owner.get('pid')): return True
    try: return time.time() - os.stat(directory).st_mtime > 15 * 60
    except FileNotFoundError: return False
def remove_owned(directory, predicate):
    if not os.path.isdir(directory) or not predicate(directory): return False
    tomb = directory + '.tomb-' + uuid.uuid4().hex
    os.rename(directory, tomb)
    # Recheck the moved identity, never delete a new directory at the canonical name.
    if not predicate(tomb):
        os.rename(tomb, directory)
        return False
    shutil.rmtree(tomb)
    return True
def owns(directory): return read(os.path.join(directory, 'owner.json')).get('token') == token
# flock is an OS-released, short metadata mutex, not the long gate lock. It prevents
# ABA between stale observation/rename and admission, including wrapper callers.
with open(os.path.join(common, 'pandacorp-merge.guard'), 'a') as guard:
    fcntl.flock(guard, fcntl.LOCK_EX)
    os.makedirs(waiters, exist_ok=True)
    tickets = []
    for name in sorted(os.listdir(waiters)):
        file = os.path.join(waiters, name)
        # Temporary publications are not FIFO participants. Old partial files
        # from interrupted older publishers expire after a bounded grace.
        if not name.endswith('.json'):
            if time.time() - os.stat(file).st_mtime > 60: os.unlink(file)
            continue
        owner = read(file)
        if (not isinstance(owner.get('token'), str) or not owner['token']
                or type(owner.get('pid')) is not int or owner['pid'] <= 0
                or not isinstance(owner.get('hostname'), str)
                or not name.split('-', 1)[0].isdigit()):
            if time.time() - os.stat(file).st_mtime > 60: os.unlink(file)
            continue
        if owner.get('hostname') == host and not alive(owner.get('pid')):
            os.unlink(file)
        else: tickets.append((file, owner))
    own = next((file for file, o in tickets if o.get('token') == token), None)
    if action in ('release', 'cancel'):
        if own: os.unlink(own)
        if action == 'release': remove_owned(lock, owns)
    elif action == 'refresh':
        if owns(lock): os.utime(lock, None)
    elif action == 'acquire':
        if own is None:
            sequence = max([int(os.path.basename(file).split('-', 1)[0]) for file, _ in tickets] or [0])
            own = os.path.join(waiters, '%020d-%s.json' % (max(time.time_ns(), sequence + 1), token))
            owner = dict(pid=pid, hostname=host, token=token)
            temporary = os.path.join(waiters, '.ticket-new-' + token)
            with open(temporary, 'x') as f:
                json.dump(owner, f)
                f.flush()
                os.fsync(f.fileno())
            os.rename(temporary, own)
            tickets.append((own, owner))
            tickets.sort()
        position = next(i + 1 for i, (file, _) in enumerate(tickets) if file == own)
        if os.path.isdir(lock): remove_owned(lock, stale)
        if position == 1 and not os.path.exists(lock):
            os.mkdir(lock)
            owner = dict(pid=pid, hostname=host, token=token, branch=branch, worktree=worktree,
                         at=datetime.datetime.now(datetime.timezone.utc).isoformat())
            with open(os.path.join(lock, 'owner.json'), 'x') as f: json.dump(owner, f)
            with open(os.path.join(lock, 'owner'), 'w') as f: f.write(branch + ' @ ' + worktree + '\n')
            os.unlink(own)
            print('acquired|1|' + owner['at'])
        else:
            print('waiting|%s|%s' % (position, read(os.path.join(lock, 'owner.json')).get('at', 'unknown')))
LOCKPY
}
acquire() {
  local started=$SECONDS state position holder info expected
  LOCK_TOKEN=$(python3 -c 'import uuid; print(uuid.uuid4().hex)') || fail "cannot create merge lock token" 20
  expected=$(python3 - "${QUEUE_LOG:-}" <<'MEDIANPY'
import json, statistics, sys
try:
    values = [r['duration_s'] for r in map(json.loads, open(sys.argv[1]))
              if r.get('event') == 'gate_end' and isinstance(r.get('duration_s'), (int, float))]
    print('%ss' % int(statistics.median(values)) if values else 'unknown')
except (OSError, ValueError): print('unknown')
MEDIANPY
  )
  while :; do
    info=$(merge_lock_action acquire) || fail "merge lock metadata is unusable" 20
    IFS='|' read -r state position holder <<< "$info"
    if [ "$state" = acquired ]; then
      queue_event lock_wait waited_s json "$((SECONDS - started))" position json "$position"
      queue_event lock_acquired waited_s json "$((SECONDS - started))" position json "$position"
      return 0
    fi
    queue_event lock_wait waited_s json "$((SECONDS - started))" position json "$position" holder_start str "$holder" expected str "$expected"
    echo "merge-queue: waiting position=$position holder-start=$holder expected-gate=$expected" >&2
    [ "$((SECONDS - started))" -lt "${PANDACORP_MERGE_LOCK_TIMEOUT_SECS:-600}" ] || fail "merge lock timeout — try again" 20
    sleep "${PANDACORP_MERGE_LOCK_POLL_SECS:-5}"
  done
}
release() { [ -z "${LOCK_TOKEN:-}" ] || merge_lock_action release; }
REFRESH_PID=""
LOCK_TOKEN=""
start_lock_refresh() {
  local every="${PANDACORP_LOCK_REFRESH_SECS:-60}"
  (
    sp=""
    trap '[ -z "$sp" ] || kill "$sp" 2>/dev/null; exit 0' TERM
    while :; do
      sleep "$every" & sp=$!
      wait "$sp" 2>/dev/null || true
      merge_lock_action refresh || true
    done
  ) >/dev/null 2>&1 </dev/null &
  REFRESH_PID=$!
}
stop_lock_refresh() {
  if [ -n "$REFRESH_PID" ]; then
    kill "$REFRESH_PID" 2>/dev/null || true
    wait "$REFRESH_PID" 2>/dev/null || true
    REFRESH_PID=""
  fi
}
# Sourcing exposes functions only; it never resolves topology, mutates Git or installs traps.
if [ "${1:-}" = --lock-library ]; then return 0; fi

set -euo pipefail

# ── Resolve topology ─────────────────────────────────────────────────────────────────────────────
WORKTREE="$(git rev-parse --show-toplevel)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"          # shared across ALL worktrees
DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main)"
# The working tree where the default branch is checked out (where we ff-merge into).
MAIN_WT="$(git worktree list --porcelain | awk -v b="refs/heads/$DEFAULT_BRANCH" '
  /^worktree /{wt=$2} /^branch /{if($2==b) print wt}' | head -1)"

# Telemetry must survive a rejected invocation without becoming another landing gate.
QUEUE_PROJECT=""
QUEUE_PREFIX=""
QUEUE_LOG=""
QUEUE_ATTEMPT=""
QUEUE_LOG_WARNED=0
QUEUE_SIGNAL_STATUS=0
QUEUE_EXIT_RUNNING=0
QUEUE_CLEANUP_READY=0
queue_log_warning() {
  if [ "$QUEUE_LOG_WARNED" = 0 ]; then
    echo "merge-queue: WARNING: queue telemetry could not be written" >&2 || true
    QUEUE_LOG_WARNED=1
  fi
  return 0
}
queue_event() {
  local line
  if [ -z "$QUEUE_LOG" ] || [ -z "$QUEUE_ATTEMPT" ]; then queue_log_warning; return 0; fi
  if line=$(python3 - "$QUEUE_ATTEMPT" "$BRANCH" "$QUEUE_PROJECT" "$@" 2>/dev/null <<'LOGPY'
import datetime, json, os, sys
attempt, branch, project, event, *fields = sys.argv[1:]
record = dict(v=1, attempt=attempt,
              ts=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
              event=event, branch=branch, project=project)
for i in range(0, len(fields), 3):
    key, kind, value = fields[i:i+3]
    record[key] = json.loads(value) if kind == 'json' else value
if event in ('gate_start', 'gate_end'):
    record['load'] = os.getloadavg()[0]
    record['ncpu'] = os.cpu_count() or 1
line = json.dumps(record, ensure_ascii=True, separators=(',', ':'))
if len(line.encode()) + 1 >= 4096:
    raise ValueError('event exceeds atomic append bound')
print(line)
LOGPY
  ); then
    # One bounded O_APPEND write keeps concurrent attempts' records separate.
    (printf '%s\n' "$line" >> "$QUEUE_LOG") 2>/dev/null || queue_log_warning
  else
    queue_log_warning
  fi
  return 0
}
queue_log_init() {
  local prefix status head owner=0
  prefix=$(git rev-parse --show-prefix 2>/dev/null) || return 1
  [ -n "$MAIN_WT" ] || return 1
  QUEUE_PREFIX="$prefix"
  QUEUE_PROJECT="${MAIN_WT}/${prefix}"; QUEUE_PROJECT="${QUEUE_PROJECT%/}"
  QUEUE_LOG="$QUEUE_PROJECT/.pandacorp/run/queue-log.jsonl"
  QUEUE_ATTEMPT=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]') || QUEUE_ATTEMPT=""
  [ -n "$QUEUE_ATTEMPT" ] || QUEUE_ATTEMPT=$(python3 -c 'import uuid; print(uuid.uuid4())' 2>/dev/null) || return 1
  mkdir -p "$QUEUE_PROJECT/.pandacorp/run" 2>/dev/null || return 1
  status="$QUEUE_PROJECT/.pandacorp/status.yaml"
  QUEUE_START_LAUNCHED=0
  if [ -f "$status" ] && grep -Eq '^phase:[[:space:]]*release([[:space:]]|#|$)' "$status" \
     && ! grep -Eq '^deploy_target:[[:space:]]*internal([[:space:]]|#|$)' "$status"; then
    QUEUE_START_LAUNCHED=1
  fi
  [ "${PANDACORP_OWNER_RELEASE_OK:-}" != 1 ] || owner=1
  head=$(git rev-parse HEAD 2>/dev/null) || { head=""; queue_log_warning; }
  queue_event start head str "$head" launched json "$QUEUE_START_LAUNCHED" owner_release_ok json "$owner" pid json "$$"
}
queue_end() { queue_event end exit json "$1"; }
queue_signal_exit() {
  QUEUE_SIGNAL_STATUS="$1"
  if [ "$QUEUE_EXIT_RUNNING" = 0 ]; then exit "$QUEUE_SIGNAL_STATUS"; fi
  return 0
}
queue_finish() {
  local result="$1"
  QUEUE_EXIT_RUNNING=1
  if [ "$QUEUE_CLEANUP_READY" = 1 ]; then cleanup "$result" || true; fi
  # Once the terminal record is committed, a later signal must not change its exit status.
  trap '' TERM INT HUP
  [ "$QUEUE_SIGNAL_STATUS" = 0 ] || result="$QUEUE_SIGNAL_STATUS"
  queue_end "$result"
  trap - EXIT
  exit "$result"
}
queue_read_sha() {
  QUEUE_SHA=$(git "$@" 2>/dev/null) || { QUEUE_SHA=""; queue_log_warning; }
  return 0
}
trap 'queue_signal_exit 143' TERM
trap 'queue_signal_exit 130' INT
trap 'queue_signal_exit 129' HUP
trap 'queue_finish "$?"' EXIT
queue_log_init || queue_log_warning

queue_report_snapshot() {
  python3 - <<'SNAPSHOTPY'
import hashlib, json, os, subprocess, time
try:
    with open('.pandacorp/run/gate-report.json', 'rb') as report:
        data = report.read()
        stat = os.fstat(report.fileno())
    identity = [stat.st_dev, stat.st_ino, stat.st_mtime_ns, stat.st_ctime_ns,
                stat.st_size, hashlib.sha256(data).hexdigest()]
except FileNotFoundError:
    identity = None
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
print(json.dumps(dict(identity=identity, sha=sha, at_ns=time.time_ns())))
SNAPSHOTPY
}

# A UUID collision must preserve the first report, even across concurrent writers.
archive_gate_report() {
  QUEUE_ARCHIVED_REPORT=""
  [ -n "$QUEUE_PROJECT" ] && [ -n "$QUEUE_ATTEMPT" ] || { queue_log_warning; return 0; }
  local target="$QUEUE_PROJECT/.pandacorp/run/gate-reports/$QUEUE_ATTEMPT.json"
  [ -f .pandacorp/run/gate-report.json ] || return 0
  [ -n "$QUEUE_REPORT_BEFORE" ] || { queue_log_warning; return 0; }
  if mkdir -p "$QUEUE_PROJECT/.pandacorp/run/gate-reports" 2>/dev/null &&
     python3 - "$QUEUE_REPORT_BEFORE" "$target" 2>/dev/null <<'ARCHIVEPY'
import datetime, hashlib, json, os, sys, time
before = json.loads(sys.argv[1])
with open('.pandacorp/run/gate-report.json', 'rb') as source:
    data = source.read()
    stat = os.fstat(source.fileno())
identity = [stat.st_dev, stat.st_ino, stat.st_mtime_ns, stat.st_ctime_ns,
            stat.st_size, hashlib.sha256(data).hexdigest()]
report = json.loads(data)
at = datetime.datetime.fromisoformat(report['at'].replace('Z', '+00:00'))
previous = before['identity']
# Touch/chmod cannot turn an existing report into new verification evidence.
same_generation_and_bytes = (previous is not None and identity[:2] == previous[:2]
                             and identity[5] == previous[5])
if (same_generation_and_bytes or stat.st_mtime_ns < before['at_ns']
        or not before['at_ns'] // 1_000_000_000 <= at.timestamp() <= time.time()
        or report['sha'] != before['sha'] or report['scope'] != 'full'):
    raise ValueError('report is not from this full-gate invocation')
# O_EXCL preserves an earlier UUID archive; copy the exact bytes whose provenance was checked.
with open(sys.argv[2], 'xb') as target:
    target.write(data)
ARCHIVEPY
  then
    QUEUE_ARCHIVED_REPORT="$target"
  else
    queue_event archive_error path str "$target" reason str "report archive failed (stale/invalid report, existing UUID or write error)"
    queue_log_warning
  fi
  return 0
}

# Loud hand-back (DR-099, #2): a merge that can't LAND (rebase conflict 10 / red gate 11 / busy main 12)
# must never be silent — fire a desktop notification so the owner sees it even if the message scrolls
# past. Precondition errors (20, the caller's own setup mistake) stay quiet (the agent reads stderr).
# The AGENT must ALSO surface the hand-back IN THE CONVERSATION (a desktop notification is easily missed).
fail() {
  echo "merge-queue: $1" >&2
  if [ "$2" -ge 10 ] && [ "$2" -le 14 ] && command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"${1//\"/\'}\" with title \"Pandacorp: merge sin aterrizar — ${BRANCH:-?}\"" 2>/dev/null || true
  fi
  exit "$2"
}

[ "$BRANCH" = "$DEFAULT_BRANCH" ] && fail "run this from the WORKTREE branch, not $DEFAULT_BRANCH" 20
[ "$WORKTREE" = "$MAIN_WT" ] && fail "this is the main checkout, not a worktree" 20
[ -z "$(git status --porcelain)" ] || fail "worktree has uncommitted changes — commit first (never merge WIP)" 20
[ -n "$MAIN_WT" ] || fail "could not locate the $DEFAULT_BRANCH checkout" 20

# The holder token is empty until admission; EXIT may safely run even on a timed-out waiter.
LOCK="$COMMON_DIR/pandacorp-merge.lock"
# ── Host heavy-job (H) slot (engine v10, A1): same protocol as the Node admission.acquireHostSlot ──
# Slots are dirs <host>/h-slots/slot-<i>, i = 0..H_max-1, host = $PANDACORP_HOST_DIR or ~/.pandacorp/host,
# H_max = max(1, min(2, floor(ncpu/4))). Acquire = mkdir in index order then owner.json
# {"pid","kind":"merge-queue","project","at","hostname","token"}; a dead local owner, or no
# owner.json and an mtime older than 60 s, is reclaimed (rename, re-check); release is token-owned;
# waiters poll every 5 s. Taken only around the full verify.sh, never around a certified-tree skip.
HSLOT=""
host_slot_max() {
  local n h
  n="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
  case "$n" in ''|*[!0-9]*) n=1 ;; esac
  h=$((n / 4)); [ "$h" -gt 2 ] && h=2; [ "$h" -lt 1 ] && h=1
  echo "$h"
}
host_slot_action() {
  python3 - "$1" "${2:-}" "${3:-}" "$$" "$PWD" <<'SLOTPY'
import datetime, json, os, shutil, socket, sys, time, uuid
act, root, token, pid, project = sys.argv[1:]
def owner(slot):
    try:
        with open(os.path.join(slot, 'owner.json')) as f: return json.load(f)
    except (OSError, ValueError): return None
def stale(slot):
    o = owner(slot)
    if o and isinstance(o.get('pid'), int) and o['pid'] > 0:
        if o.get('hostname', socket.gethostname()) != socket.gethostname(): return False
        try: os.kill(o['pid'], 0); return False
        except PermissionError: return False
        except ProcessLookupError: return True
    try: return time.time() - os.stat(slot).st_mtime > 60
    except FileNotFoundError: return False
def remove(slot, predicate):
    if not predicate(slot): return False
    tomb = slot + '.tomb-' + uuid.uuid4().hex
    try: os.rename(slot, tomb)
    except FileNotFoundError: return False
    if not predicate(tomb):
        # A replacement live owner must survive, even if a stale observer raced it.
        os.rename(tomb, slot)
        return False
    shutil.rmtree(tomb)
    return True
# Same initialized-directory/unique-owner protocol as hostSlotMutex.mjs.
import contextlib
@contextlib.contextmanager
def admission_mutex(root):
    root = str(root)
    os.makedirs(root, exist_ok=True)
    token = uuid.uuid4().hex
    name = 'owner-%s-%s.json' % (os.getpid(), token)
    lock = os.path.join(root, '.admission.lock')
    staging = os.path.join(root, '.admission.new-%s-%s' % (os.getpid(), token))
    timeout = float(os.environ.get('PANDACORP_HOST_MUTEX_WAIT_S', '1'))
    if not 0 <= timeout <= 60: raise ValueError('invalid host mutex wait limit')
    started = time.monotonic()
    held = False
    def clear(directory):
        try: os.unlink(os.path.join(directory, name))
        except FileNotFoundError: pass
        try: os.rmdir(directory)
        except OSError as error:
            if error.errno not in (2, 17, 39, 66): raise
    try:
        os.mkdir(staging)
        with open(os.path.join(staging, name), 'x') as f:
            json.dump(dict(pid=os.getpid(), token=token), f)
        while True:
            try:
                os.rename(staging, lock)
                held = True
                break
            except OSError as error:
                if error.errno not in (17, 21, 39, 66): raise
            try: entries = os.listdir(lock)
            except FileNotFoundError: continue
            for entry in entries:
                parts = entry.split('-', 2)
                if len(parts) != 3 or parts[0] != 'owner' or not parts[1].isdigit() or not entry.endswith('.json'): continue
                try: os.kill(int(parts[1]), 0)
                except ProcessLookupError:
                    try: os.unlink(os.path.join(lock, entry))
                    except FileNotFoundError: pass
                except PermissionError: pass
            try: os.rmdir(lock)
            except OSError as error:
                if error.errno not in (2, 17, 39, 66): raise
            if time.monotonic() - started >= timeout: raise TimeoutError('host admission mutex busy')
            time.sleep(.01)
        yield
    finally:
        clear(lock if held else staging)

try:
    with admission_mutex(os.path.dirname(root) if act == 'release' else root):
        if act == 'release':
            remove(root, lambda p: (owner(p) or {}).get('token') == token)
        else:
            os.makedirs(root, exist_ok=True)
            maximum = int(token)
            for i in range(maximum):
                slot = os.path.join(root, 'slot-%s' % i)
                for attempt in range(3):
                    try: os.mkdir(slot)
                    except FileExistsError:
                        if remove(slot, stale): continue
                        break
                    token = uuid.uuid4().hex
                    o = dict(pid=int(pid), kind='merge-queue', project=project,
                             at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                             hostname=socket.gethostname(), token=token)
                    try:
                        with open(os.path.join(slot, 'owner.json.tmp'), 'x') as f: json.dump(o, f)
                        os.rename(os.path.join(slot, 'owner.json.tmp'), os.path.join(slot, 'owner.json'))
                    except Exception:
                        # This is the directory just created here, not a foreign semaphore.
                        os.rmdir(slot) if not os.listdir(slot) else None
                        raise
                    print(slot + '|' + token)
                    sys.exit(0)
            sys.exit(75)
except TimeoutError:
    sys.exit(75)
SLOTPY
}
acquire_host_slot() {
  local host="${PANDACORP_HOST_DIR:-$HOME/.pandacorp/host}" max rc inherited
  local slot_started=$SECONDS
  max="$(host_slot_max)"
  while :; do
    rc=0
    inherited=$(host_slot_action acquire "$host/h-slots" "$max") || rc=$?
    if [ "$rc" = 0 ]; then
      HSLOT="${inherited%%|*}"
      HSLOT_TOKEN="${inherited#*|}"
      export PANDACORP_HOST_SLOT_TOKEN="$inherited"
      queue_event slot_acquired slot str "$HSLOT" waited_s json "$((SECONDS - slot_started))"
      return 0
    fi
    [ "$rc" = 75 ] || environment_not_ready "host slot directory is unusable"
    echo "merge-queue: waiting for a host heavy-job slot (position=1 in this project; all $max host slots busy)" >&2
    [ "$((SECONDS - slot_started))" -lt "${PANDACORP_HOST_SLOT_TIMEOUT_SECS:-600}" ] || environment_not_ready "host slot wait timed out"
    sleep "${PANDACORP_HOST_SLOT_POLL_SECS:-5}"
  done
}
HSLOT_TOKEN=""
release_host_slot() {
  if [ -n "$HSLOT" ]; then
    host_slot_action release "$HSLOT" "$HSLOT_TOKEN" || true
    queue_event slot_released slot str "$HSLOT"
  fi
  HSLOT=""
  HSLOT_TOKEN=""
  unset PANDACORP_HOST_SLOT_TOKEN
  return 0
}
# BL-0288: restore local config only on nonzero post-restore exits; successful landing drops
# the manifest permanently. Unlock BEFORE bootstrap (install/hooks need no queue lock), and
# preserve the original status even if bootstrap fails or leaves committed PORT/unset index bits.
RESTORE_LOCAL=0
cleanup() {
  local result="$1"
  stop_lock_refresh
  release_host_slot
  release
  if [ "$result" -ne 0 ] && [ "$RESTORE_LOCAL" = 1 ] && [ -x ".pandacorp/worktree-bootstrap.sh" ]; then
    if ! bash .pandacorp/worktree-bootstrap.sh; then
      echo "merge-queue: WARNING: bootstrap failed; worktree may be left on the committed PORT without skip-worktree; re-run bash .pandacorp/worktree-bootstrap.sh manually" >&2
    fi
  fi
  return "$result"
}
QUEUE_CLEANUP_READY=1
acquire
start_lock_refresh

# ── Preflight: is the main checkout quiescent? (fast early hand-back, DR-096) ──────────────────────
# The ff-merge at the very end fails when the main checkout has conflicting uncommitted WIP (another
# session). Detecting that NOW — before the multi-minute rebase + integration gate — avoids burning all
# that work only to fail at the last step. This is an EARLY hand-back; the authoritative check is still
# the `git merge --ff-only` below (state can change between here and there), so the recheck is never
# skipped. Same exit 12 ("busy main") — the work is preserved on the branch, nothing is lost.
# Legacy checkouts may lack runtime ignores; our own measurement must not make main busy.
main_busy() {
  python3 - "$MAIN_WT" "$QUEUE_PREFIX" "${1:-HEAD}" <<'BUSYPY'
import subprocess, sys
root, prefix, target = sys.argv[1:]
def read_git(args):
    try: return subprocess.check_output(['git', *args])
    except (OSError, subprocess.CalledProcessError): sys.exit(2)
def git(*args): return read_git(['-C', root, *args])
# --no-renames gives both old/new paths and -z preserves whitespace/metacharacters.
# target is an immutable sha at ff time, HEAD in the invoking checkout at preflight.
head = read_git(['rev-parse', '--verify', target + '^{commit}']).strip().decode()
base = git('rev-parse', '--verify', 'HEAD^{commit}').strip().decode()
touched = set(git('diff', '--name-only', '--no-renames', '-z', base + '..' + head).split(b'\0'))
entries = git('status', '--porcelain', '-z', '--untracked-files=all').split(b'\0')
ignored = [(prefix + '.pandacorp/run/queue-log.jsonl').encode(),
           (prefix + '.pandacorp/run/gate-reports/').encode()]
i = 0
while i < len(entries):
    entry = entries[i]; i += 1
    if not entry: continue
    paths = [entry[3:]]
    if b'R' in entry[:2] or b'C' in entry[:2]:
        paths.append(entries[i]); i += 1
    for path in paths:
        # Only untracked runtime output is exempt; tracked owner edits remain WIP.
        if entry[:2] == b'??' and (path == ignored[0] or path.startswith(ignored[1])): continue
        if not prefix or path in touched: sys.exit(0)
sys.exit(1)
BUSYPY
}
QUEUE_BUSY_RC=0
main_busy || QUEUE_BUSY_RC=$?
[ "$QUEUE_BUSY_RC" -le 1 ] || fail "cannot inspect main checkout" 20
if [ "$QUEUE_BUSY_RC" = 0 ]; then
  fail "the $DEFAULT_BRANCH checkout has uncommitted changes (busy) — land when quiescent [preflight, re-checked at merge]" 12
fi

# ── Rebase onto the CURRENT main tip (the merge-queue invariant: frozen + up-to-date target) ───────
git fetch --quiet "$MAIN_WT" "$DEFAULT_BRANCH" 2>/dev/null || true
# BL-0288: only bootstrap-owned skip-worktree overrides may be discarded after the clean-tree
# check; preserve user/sparse entries. Resolve the project's env from CWD, root launch from repo
# root; literal pathspecs + NUL records also preserve spaces and pathspec metacharacters.
RESTORE_LOCAL=1
PROJECT_PREFIX="$(git rev-parse --show-prefix)"
while IFS= read -r -d '' entry; do
  if [[ "$entry" == "S "* ]]; then
    file="${entry#S }"
    git -C "$WORKTREE" update-index --no-skip-worktree -- "$file"
    git -C "$WORKTREE" checkout -- "$file"
  fi
done < <(git -C "$WORKTREE" ls-files -v -z -- ':(literal).claude/launch.json' \
  ":(literal)${PROJECT_PREFIX}e2e/server-env.json")
# Required landing facts use verified commit reads, separate from best-effort telemetry.
QUEUE_PRE_REBASE_SHA=$(git rev-parse --verify 'HEAD^{commit}') || fail "cannot read pre-rebase commit" 20
QUEUE_STAMP_BASE=$(git rev-parse --verify "refs/heads/$DEFAULT_BRANCH") || fail "cannot read rebase target commit" 20
QUEUE_REBASE_STARTED=$SECONDS
QUEUE_REBASE_BASE=$(git rev-parse "$DEFAULT_BRANCH" 2>/dev/null) || { QUEUE_REBASE_BASE=""; queue_log_warning; }
if ! git rebase "$DEFAULT_BRANCH"; then
  git rebase --abort 2>/dev/null || true
  queue_read_sha rev-parse HEAD
  queue_event rebase result str conflict base str "$QUEUE_REBASE_BASE" head str "$QUEUE_SHA" duration_s json "$((SECONDS - QUEUE_REBASE_STARTED))"
  # BL-0288: EXIT re-bootstraps after abort too, leaving a usable clean worktree.
  fail "rebase onto $DEFAULT_BRANCH hit a conflict git can't auto-resolve — resolve on the branch or escalate" 10
fi

queue_read_sha rev-parse HEAD
queue_event rebase result str ok base str "$QUEUE_REBASE_BASE" head str "$QUEUE_SHA" duration_s json "$((SECONDS - QUEUE_REBASE_STARTED))"

[ -x .pandacorp/verify.sh ] || fail "no gate: .pandacorp/verify.sh is missing or not executable" 20

# Prepare only dependencies/generated types. Full bootstrap rewrites tracked ports and
# skip-worktree bits, which would invalidate both the committed gate inputs and its stamp.
environment_not_ready() {
  queue_event env_step result str failed reason str "$1" duration_s json "$((SECONDS - QUEUE_ENV_STARTED))"
  fail "environment not ready: $1" 16
}
QUEUE_ENV_STARTED=$SECONDS
dependency_identity() {
  python3 - "$1" <<'DEPSPY'
import hashlib, json, os, pathlib, subprocess, sys, tempfile
locks = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']
metadata = ['node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml', 'node_modules/.package-lock.json']
def digest(name):
    path = pathlib.Path(name)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
identity = dict(package=digest('package.json'), locks={name: digest(name) for name in locks}, metadata={name: digest(name) for name in metadata},
                node=subprocess.check_output(['node', '--version'], text=True).strip())
receipt = pathlib.Path('node_modules/.pandacorp-lock-id.json')
if sys.argv[1] == 'check':
    try: stored = json.loads(receipt.read_text())
    except (OSError, ValueError): sys.exit(1)
    sys.exit(0 if stored == identity else 1)
receipt.parent.mkdir(parents=True, exist_ok=True)
fd, temporary = tempfile.mkstemp(prefix='.pandacorp-lock-id-', dir=receipt.parent)
try:
    with os.fdopen(fd, 'w') as f: json.dump(identity, f)
    os.replace(temporary, receipt)
finally:
    if os.path.exists(temporary): os.unlink(temporary)
DEPSPY
}
if [ -f pnpm-lock.yaml ] || [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
  if ! dependency_identity check; then
    if [ -f pnpm-lock.yaml ]; then
      command -v pnpm >/dev/null 2>&1 || environment_not_ready "pnpm is required"
      pnpm install --frozen-lockfile || environment_not_ready "pnpm install failed"
    else
      command -v npm >/dev/null 2>&1 || environment_not_ready "npm is required"
      npm ci || environment_not_ready "npm ci failed"
    fi
    dependency_identity record || environment_not_ready "cannot record dependency installation identity"
  fi
fi
command -v jq >/dev/null 2>&1 || environment_not_ready "jq is required"
if [ -f package.json ]; then
  QUEUE_USES_BIOME=$(python3 - <<'BIOMEPY'
import json
p = json.load(open('package.json'))
uses = '@biomejs/biome' in {**p.get('dependencies', {}), **p.get('devDependencies', {})}
uses = uses or any('biome' in s for s in p.get('scripts', {}).values())
print(1 if uses else 0)
BIOMEPY
  ) || environment_not_ready "cannot read package.json"
  if [ "$QUEUE_USES_BIOME" = 1 ]; then
    [ -x node_modules/.bin/biome ] || command -v biome >/dev/null 2>&1 || environment_not_ready "biome is required"
  fi
fi
if [ -x node_modules/.bin/next ] && [ ! -d .next/types ]; then
  if [ ! -f node_modules/next/dist/cli/next-typegen.js ] &&
     ! node_modules/.bin/next --help 2>/dev/null | grep -q typegen; then
    environment_not_ready "installed Next does not support typegen"
  fi
  node_modules/.bin/next typegen || environment_not_ready "next typegen failed"
fi
export PANDACORP_STAMP_BASE="$QUEUE_STAMP_BASE"
queue_event env_step result str ok duration_s json "$((SECONDS - QUEUE_ENV_STARTED))"
# Pin before invoking any gate; concurrent commits by branch name cannot ride along.
QUEUE_GATED_SHA=$(git rev-parse --verify 'HEAD^{commit}') || fail "cannot pin gated commit" 20

# ── Integration gate on the MERGED result (the arbiter; a textual merge can still fail to compile) ─
# BL-0288: keep the committed e2e/server-env.json byte-identical to HEAD after restore/rebase;
# no pre-gate bootstrap and no URL rewriting. Auth and media share an origin with 400 seeded
# :4037 media identities (localFixture); a per-worktree DB was rejected by the owner. This queue's
# shared lock serializes integration gates, so the shared gate DB never sees two gates at once.
# Resolve e2e/ relative to verify.sh's project CWD, including nested mission-control invocation.
if [ -f "e2e/server-env.json" ]; then
  git diff --quiet HEAD -- e2e/server-env.json ||
    fail "integration gate RED on the rebased result — e2e/server-env.json differs from HEAD" 11
  command -v jq >/dev/null 2>&1 || environment_not_ready "jq is required to read the committed e2e PORT"
  COMMITTED_PORT="$(jq -r '.PORT|tostring' e2e/server-env.json)"
fi
# DR-146 certified tree: verify.sh is a function of the tree it judges, so when the rebased result is
# byte-identical (same HEAD^{tree}, clean, no skip-worktree/assume-unchanged entries, same verify.sh,
# stamp < 12 h old) to a tree a FULL verify.sh already passed in THIS checkout, a second run proves
# nothing new. green-stamp.sh is the only judge; ANY doubt (no/corrupt stamp, other tree, dirty,
# changed gate, old stamp) runs the full gate exactly as before. The DR-138 owner check below is
# untouched: a skip never lands a launched project without PANDACORP_OWNER_RELEASE_OK=1.
if [ -x ".pandacorp/verify.sh" ]; then
  stamp_check() {
    local rc=0
    stamp_note=$(bash .pandacorp/green-stamp.sh check --explain 2>&1) || rc=$?
    # Older overlays reject unknown options. Fall back only for an unsupported flag,
    # never replace a useful mismatch explanation with an empty plain-check result.
    if [ "$rc" -ne 0 ] && printf '%s' "$stamp_note" | grep -Eiq 'usage:|unknown.*(option|argument)|unsupported.*explain'; then
      rc=0
      stamp_note=$(bash .pandacorp/green-stamp.sh check 2>&1) || rc=$?
    fi
    return "$rc"
  }
  if [ -f ".pandacorp/green-stamp.sh" ] && stamp_check; then
    queue_event stamp_check result str match reason str "${stamp_note:0:1500}"
    echo "merge-queue: integration gate SKIPPED [certified-tree] — rebased tree is identical to one a full verify.sh passed ($stamp_note)"
  else
    QUEUE_STAMP_REASON="${stamp_note:-no green-stamp.sh in this overlay}"
    queue_event stamp_check result str miss reason str "${QUEUE_STAMP_REASON:0:1500}"
    echo "merge-queue: running the full integration gate [full-gate] (${stamp_note:-no green-stamp.sh in this overlay})"
    acquire_host_slot
    # A certified identical tree needs no port. Probe only when a full gate is necessary.
    if [ -n "${COMMITTED_PORT:-}" ]; then
      # BL-0288: refuse to gate against a dev server / another gate already owning the committed
      # origin. Same loopback /dev/tcp probe as bootstrap; projects without the file skip this check.
      if (exec 3<>"/dev/tcp/127.0.0.1/$COMMITTED_PORT") 2>/dev/null; then
        fail "committed e2e PORT :$COMMITTED_PORT is busy — stop the dev server / other gate on :$COMMITTED_PORT, then re-run" 14
      fi
    fi
    GATE_RC=0
    QUEUE_GATE_STARTED=$SECONDS
    QUEUE_REPORT_BEFORE=$(queue_report_snapshot 2>/dev/null) || { QUEUE_REPORT_BEFORE=""; queue_log_warning; }
    queue_event gate_start
    bash .pandacorp/verify.sh || GATE_RC=$?
    QUEUE_GATE_DURATION=$((SECONDS - QUEUE_GATE_STARTED))
    QUEUE_ARCHIVED_REPORT=""
    if [ "$GATE_RC" -ne 75 ]; then archive_gate_report; fi
    queue_event gate_end rc json "$GATE_RC" duration_s json "$QUEUE_GATE_DURATION" report str "$QUEUE_ARCHIVED_REPORT"
    release_host_slot
    [ "$GATE_RC" -ne 75 ] || fail "verification owner busy in this checkout; wait and retry (no project verdict)" 14
    # Generated gate output belongs to this integration checkout only. Release the heavy
    # slot first, on both green and red; preserve the gate verdict after cleanup.
    rm -rf -- .next .next-fidelity test-results
    if [ "$GATE_RC" -ne 0 ]; then
      fail "integration gate RED on the rebased result — fix on $BRANCH and re-run (NOT a semantic-conflict pass)" 11
    fi
  fi
fi

# ── Launched project: main is production (DR-138) — land only on the owner's explicit order ───────
STATUS="$QUEUE_PROJECT/.pandacorp/status.yaml"
LAUNCHED=0
if [ -f "$STATUS" ] && grep -Eq '^phase:[[:space:]]*release([[:space:]]|#|$)' "$STATUS" \
   && ! grep -Eq '^deploy_target:[[:space:]]*internal([[:space:]]|#|$)' "$STATUS"; then
  LAUNCHED=1
fi
QUEUE_ORDER_PRESENT=0
[ "${PANDACORP_OWNER_RELEASE_OK:-}" != 1 ] || QUEUE_ORDER_PRESENT=1
queue_event order_check launched json "$LAUNCHED" order_present json "$QUEUE_ORDER_PRESENT"
if [ "$LAUNCHED" = 1 ] && [ "${PANDACORP_OWNER_RELEASE_OK:-}" != "1" ]; then
  echo "merge-queue: $BRANCH is rebased on $DEFAULT_BRANCH and its gate is green, but this project is LAUNCHED:" >&2
  echo "merge-queue: $DEFAULT_BRANCH is production (Vercel deploys every push). Ask the owner; on their explicit order run:" >&2
  echo "merge-queue:   PANDACORP_OWNER_RELEASE_OK=1 bash .pandacorp/merge-queue.sh" >&2
  echo "merge-queue: for a preview first: git push -u origin $BRANCH (Vercel builds a preview URL)" >&2
  exit 21
fi

# ── Fast-forward merge into main, then clean up ────────────────────────────────────────────────────
# ff-only so main only ever moves forward to an already-gated, linear history; if the main checkout has
# conflicting uncommitted WIP from another session, git refuses → hand back (land when it's quiescent).
QUEUE_BUSY_RC=0
main_busy "$QUEUE_GATED_SHA" || QUEUE_BUSY_RC=$?
[ "$QUEUE_BUSY_RC" -le 1 ] || fail "cannot inspect main checkout before ff" 20
if [ "$QUEUE_BUSY_RC" = 0 ]; then
  fail "the $DEFAULT_BRANCH checkout is busy (uncommitted changes block the ff-merge) — land when quiescent" 12
fi
# Git reports success for an old ancestor too; that must not certify a newer main.
QUEUE_SHA=$(git -C "$MAIN_WT" rev-parse --verify 'HEAD^{commit}') || fail "cannot read main commit" 20
if ! git merge-base --is-ancestor "$QUEUE_SHA" "$QUEUE_GATED_SHA"; then
  queue_event ff sha str "$QUEUE_SHA" result str failed
  fail "main advanced during the gate — re-run" 17
fi
if ! git -C "$MAIN_WT" merge --ff-only "$QUEUE_GATED_SHA" 2>/dev/null; then
  QUEUE_SHA=$(git -C "$MAIN_WT" rev-parse --verify 'HEAD^{commit}') || fail "cannot read main commit" 20
  queue_event ff sha str "$QUEUE_SHA" result str failed
  if ! git merge-base --is-ancestor "$QUEUE_SHA" "$QUEUE_GATED_SHA"; then
    fail "main advanced during the gate — re-run" 17
  fi
  fail "the $DEFAULT_BRANCH checkout is busy (uncommitted changes block the ff-merge) — land when quiescent" 12
fi

QUEUE_SHA=$(git -C "$MAIN_WT" rev-parse --verify 'HEAD^{commit}') || fail "cannot read main commit" 20
if [ "$QUEUE_SHA" != "$QUEUE_GATED_SHA" ]; then
  queue_event ff sha str "$QUEUE_SHA" result str failed
  fail "main advanced during the gate — re-run" 17
fi
queue_event ff sha str "$QUEUE_SHA" result str ok

# The worktree is deliberately NOT removed here. The session that invoked this script is
# standing INSIDE it: deleting the directory under a live Claude session leaves its cwd
# dangling — the next user message fails with "Path ... does not exist" and every background
# task dies with the forced session restart (owner-reported, recurring, 2026-07-02). A `cd`
# here only moves THIS script's cwd, never the session's. Removal belongs to the harness,
# which first restores the session cwd without removal; the coordinator calls session-cleanup right
# after this script succeeds. If the harness cannot switch cwd (the session restarted and lost the
# worktree binding), keep the worktree and report the cwd blocker. Once outside, run:
#   cd "$MAIN_WT" && bash .pandacorp/session-cleanup.sh finish --session "$PANDACORP_CLEANUP_SESSION"
rm -f "$MAIN_WT/.pandacorp/run/worktrees/$BRANCH.json" 2>/dev/null || true   # drop the manifest entry (worktree-bootstrap writes <branch>.json) (DR-096 §7)

# DR-146: main now holds exactly the tree this queue certified, so hand the main checkout the same
# stamp (its own green-stamp.sh check still re-verifies tree, cleanliness, verify.sh and age there).
# Best-effort: without it, sessions parked on main just run their normal Stop gate.
if [ -f ".pandacorp/green-stamp.sh" ] && bash .pandacorp/green-stamp.sh check >/dev/null 2>&1; then
  MAIN_RUN_DIR="$MAIN_WT/$(git rev-parse --show-prefix).pandacorp/run"
  mkdir -p "$MAIN_RUN_DIR" 2>/dev/null \
    && cp .pandacorp/run/green-stamp "$MAIN_RUN_DIR/.green-stamp.tmp" 2>/dev/null \
    && mv "$MAIN_RUN_DIR/.green-stamp.tmp" "$MAIN_RUN_DIR/green-stamp" 2>/dev/null || true
fi

echo "merge-queue: merged $BRANCH → $DEFAULT_BRANCH"

# Launched + owner's order: publishing main IS the production release (Vercel's GitHub integration).
if [ "$LAUNCHED" = 1 ]; then
  QUEUE_PUSH_SHA="$QUEUE_GATED_SHA"
  bounded_git() {
    python3 - "$@" <<'TIMEOUTPY'
import os, signal, subprocess, sys
seconds = float(sys.argv[1])
if not 0 <= seconds <= 3600: raise ValueError('invalid Git timeout')
process = subprocess.Popen(sys.argv[2:], stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
timed_out = False
try:
    output, errors = process.communicate(timeout=seconds)
except subprocess.TimeoutExpired:
    timed_out = True
    try: os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError: pass
    try: output, errors = process.communicate(timeout=.5)
    except subprocess.TimeoutExpired:
        try: os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError: pass
        try: output, errors = process.communicate(timeout=.5)
        except subprocess.TimeoutExpired as error:
            output, errors = error.output or b'', error.stderr or b''
            process.stdout.close()
            process.stderr.close()
            try: process.wait(timeout=.5)
            except subprocess.TimeoutExpired: pass  # Still unknown; never turn a timeout into a failed-push claim.
sys.stdout.buffer.write(output)
sys.stderr.buffer.write(errors)
sys.exit(124 if timed_out else process.returncode)
TIMEOUTPY
  }
  QUEUE_PUSH_RC=0
  bounded_git "${PANDACORP_PUSH_TIMEOUT_SECS:-120}" git -C "$MAIN_WT" push origin "$QUEUE_PUSH_SHA:refs/heads/$DEFAULT_BRANCH" || QUEUE_PUSH_RC=$?
  QUEUE_PUSH_UNKNOWN=0
  [ "$QUEUE_PUSH_RC" -ne 124 ] || QUEUE_PUSH_UNKNOWN=1
  if [ "$QUEUE_PUSH_UNKNOWN" = 1 ]; then
    queue_event push sha str "$QUEUE_PUSH_SHA" result str unknown
    # Killing the client cannot undo an accepted remote update. Read before retrying.
    QUEUE_REMOTE_SHA=$(bounded_git "${PANDACORP_REMOTE_TIMEOUT_SECS:-30}" git -C "$MAIN_WT" ls-remote origin "refs/heads/$DEFAULT_BRANCH" | awk '{print $1}') || QUEUE_REMOTE_SHA=""
    [ "$QUEUE_REMOTE_SHA" = "$QUEUE_PUSH_SHA" ] || fail "push result unknown; origin/main could not confirm the gated sha — inspect the remote before retrying" 13
  elif [ "$QUEUE_PUSH_RC" -ne 0 ]; then
    queue_event push sha str "$QUEUE_PUSH_SHA" result str failed
    fail "merged into $DEFAULT_BRANCH locally but push of gated sha failed — inspect the remote and retry" 13
  fi
  queue_event push sha str "$QUEUE_PUSH_SHA" result str ok
  echo "merge-queue: pushed $QUEUE_PUSH_SHA to origin — Vercel deploys it to production"
fi

# DR-147: whatever door this work came through, the change queue must now match main. The reconciler
# reads the landed history (a `Change: <slug>` trailer, all-VERIFIED `source_change` WOs) and archives
# the cards it answers; doubtful cards are only flagged for the owner. It runs on the MAIN checkout —
# the inbox is gitignored and lives only there. Best-effort: the landing already succeeded, so a
# reconciler failure (or a live build, exit 3) is reported, never turned into a failed merge.
stop_lock_refresh
release
QUEUE_MAIN_PROJECT="${MAIN_WT}/${QUEUE_PREFIX}"; QUEUE_MAIN_PROJECT="${QUEUE_MAIN_PROJECT%/}"
if [ -f "$QUEUE_MAIN_PROJECT/.pandacorp/change-reconcile.mjs" ] && command -v node >/dev/null 2>&1; then
  QUEUE_RECONCILE_RC=0
  node "$QUEUE_MAIN_PROJECT/.pandacorp/change-reconcile.mjs" --apply --project "$QUEUE_MAIN_PROJECT" || QUEUE_RECONCILE_RC=$?
  queue_event reconcile rc json "$QUEUE_RECONCILE_RC"
  if [ "$QUEUE_RECONCILE_RC" -ne 0 ]; then
    echo "merge-queue: change-reconcile did not complete (exit $QUEUE_RECONCILE_RC) — run it on $DEFAULT_BRANCH: node .pandacorp/change-reconcile.mjs --apply" >&2
  fi
fi
echo "merge-queue: worktree KEPT (your session is inside it) — restore the session cwd WITHOUT removal, stop owned writers, then run the validated DR-145 cleanup: cd $MAIN_WT && bash .pandacorp/session-cleanup.sh finish --session <session-root>"
exit 0
