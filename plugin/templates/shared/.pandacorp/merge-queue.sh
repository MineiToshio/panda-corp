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
#   13 LAUNCHED project: merged into main but the push to origin failed (production NOT updated yet)
#   14 handed back: committed e2e PORT busy (stop the dev server / other gate, then re-run) (BL-0288)
#   20 precondition failed (dirty/uncommitted worktree, on main, not a worktree, lock timeout)
#   21 LAUNCHED project: branch rebased + gate green, but main is production (DR-138) — waiting for the
#      owner's explicit order; re-run as `PANDACORP_OWNER_RELEASE_OK=1 bash .pandacorp/merge-queue.sh`
#
# LAUNCHED projects (status.yaml `phase: release`, deploy_target not `internal`; DR-138/INFRA-8): GitHub
# main is production and Vercel deploys every push to it, so landing = releasing. Without the owner's
# order the script stops at exit 21 with the branch ready; with it, it ff-merges AND pushes main.
#
# It NEVER force-merges and NEVER touches another session's WIP (DR-093). A non-auto-resolvable
# conflict or a red gate is HANDED BACK, never papered over.
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
  status="$MAIN_WT/.pandacorp/status.yaml"
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

# ── Acquire the serialized merge lock (atomic mkdir; stale-reclaim like build.lock, DR-063) ────────
LOCK="$COMMON_DIR/pandacorp-merge.lock"     # in the shared git dir → every worktree sees the same lock
STALE_MIN=15                                  # a holder that died leaves a lock; reclaim after N minutes
acquire() {
  local waited=0
  queue_event lock_wait waited_s json 0
  while ! mkdir "$LOCK" 2>/dev/null; do
    # reclaim a stale lock (its owner crashed) — mtime older than STALE_MIN
    if [ -z "$(find "$LOCK" -mmin -"$STALE_MIN" 2>/dev/null)" ]; then
      echo "merge-queue: reclaiming stale lock ($(cat "$LOCK/owner" 2>/dev/null || echo unknown))" >&2
      rm -rf "$LOCK"; continue
    fi
    [ "$waited" -ge 600 ] && fail "merge lock held for >10min by $(cat "$LOCK/owner" 2>/dev/null) — try again" 20
    queue_event lock_wait waited_s json "$waited"
    sleep 5; waited=$((waited + 5))
  done
  echo "$BRANCH @ $WORKTREE" > "$LOCK/owner"
  queue_event lock_acquired waited_s json "$waited"
}
release() { rm -rf "$LOCK"; }

# ── Lock refresh (engine v10, A1): a long gate must not let a concurrent waiter reclaim a LIVE lock ──
# The stale rule above reclaims on mtime > STALE_MIN, and a heavy verify.sh (plus the wait for a host
# heavy-job slot) can outlast it. A background loop touches the lock dir every 60 s while we hold it.
# It never recreates a missing lock (`-d` guard) and holds no stdout/stderr, so a caller capturing our
# output is not kept waiting by it. PANDACORP_LOCK_REFRESH_SECS is a test hook only.
REFRESH_PID=""
start_lock_refresh() {
  local every="${PANDACORP_LOCK_REFRESH_SECS:-60}"
  (
    sp=""
    trap '[ -n "$sp" ] && kill "$sp" 2>/dev/null; exit 0' TERM
    while :; do
      sleep "$every" & sp=$!
      wait "$sp" 2>/dev/null || true
      if [ -d "$LOCK" ]; then touch "$LOCK" 2>/dev/null || true; fi
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

# ── Host heavy-job (H) slot (engine v10, A1): same protocol as the Node admission.acquireHostSlot ──
# Slots are dirs <host>/h-slots/slot-<i>, i = 0..H_max-1, host = $PANDACORP_HOST_DIR or ~/.pandacorp/host,
# H_max = max(1, min(2, floor(ncpu/4))). Acquire = mkdir in index order then owner.json
# {"pid","kind":"merge-queue","project","at"}; a slot whose owner pid fails `kill -0`, or with no
# owner.json and an mtime older than 60 s, is reclaimed (remove, retry); release = remove by its owner;
# waiters poll every 5 s. Taken only around the full verify.sh, never around a certified-tree skip.
HSLOT=""
host_slot_max() {
  local n h
  n="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
  case "$n" in ''|*[!0-9]*) n=1 ;; esac
  h=$((n / 4)); [ "$h" -gt 2 ] && h=2; [ "$h" -lt 1 ] && h=1
  echo "$h"
}
path_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
host_slot_reclaimable() {
  local slot="$1" pid
  if [ -f "$slot/owner.json" ]; then
    pid="$(sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$slot/owner.json" 2>/dev/null | head -1)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then return 1; fi
    return 0
  fi
  [ $(( $(date +%s) - $(path_mtime "$slot") )) -gt 60 ]
}
acquire_host_slot() {
  local host="${PANDACORP_HOST_DIR:-$HOME/.pandacorp/host}" max i slot project at
  local root="$host/h-slots"
  local slot_started=$SECONDS
  max="$(host_slot_max)"
  mkdir -p "$root" 2>/dev/null || return 0     # unusable host dir: never block the landing on the optional semaphore
  project="$WORKTREE/$(git rev-parse --show-prefix)"; project="${project%/}"
  project="${project//\\/\\\\}"; project="${project//\"/\\\"}"
  while :; do
    i=0
    while [ "$i" -lt "$max" ]; do
      slot="$root/slot-$i"
      if mkdir "$slot" 2>/dev/null; then
        at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf '{"pid":%s,"kind":"merge-queue","project":"%s","at":"%s"}\n' "$$" "$project" "$at" > "$slot/owner.json.tmp" \
          && mv "$slot/owner.json.tmp" "$slot/owner.json"
        HSLOT="$slot"
        queue_event slot_acquired slot str "$HSLOT" waited_s json "$((SECONDS - slot_started))"
        return 0
      fi
      if host_slot_reclaimable "$slot"; then
        echo "merge-queue: reclaiming dead host slot $slot" >&2
        rm -rf "$slot"
        continue                                 # retry the same index
      fi
      i=$((i + 1))
    done
    echo "merge-queue: waiting for a host heavy-job slot (all $max busy)" >&2
    sleep 5
  done
}
release_host_slot() {
  if [ -n "$HSLOT" ]; then
    rm -rf "$HSLOT"
    queue_event slot_released slot str "$HSLOT"
  fi
  HSLOT=""
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

# ── Preflight: is the main checkout quiescent? (fast early hand-back, DR-096) ──────────────────────
# The ff-merge at the very end fails when the main checkout has conflicting uncommitted WIP (another
# session). Detecting that NOW — before the multi-minute rebase + integration gate — avoids burning all
# that work only to fail at the last step. This is an EARLY hand-back; the authoritative check is still
# the `git merge --ff-only` below (state can change between here and there), so the recheck is never
# skipped. Same exit 12 ("busy main") — the work is preserved on the branch, nothing is lost.
# Legacy checkouts may lack runtime ignores; our own measurement must not make main busy.
if [ -n "$(git -C "$MAIN_WT" status --porcelain --untracked-files=no 2>/dev/null)" ] ||
   [ -n "$(git -C "$MAIN_WT" status --porcelain -- . \
  ":(top,exclude,literal)${QUEUE_PREFIX}.pandacorp/run/queue-log.jsonl" \
  ":(top,exclude,literal)${QUEUE_PREFIX}.pandacorp/run/gate-reports" 2>/dev/null)" ]; then
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

# ── Integration gate on the MERGED result (the arbiter; a textual merge can still fail to compile) ─
# BL-0288: keep the committed e2e/server-env.json byte-identical to HEAD after restore/rebase;
# no pre-gate bootstrap and no URL rewriting. Auth and media share an origin with 400 seeded
# :4037 media identities (localFixture); a per-worktree DB was rejected by the owner. This queue's
# shared lock serializes integration gates, so the shared gate DB never sees two gates at once.
# Resolve e2e/ relative to verify.sh's project CWD, including nested mission-control invocation.
if [ -f "e2e/server-env.json" ]; then
  git diff --quiet HEAD -- e2e/server-env.json ||
    fail "integration gate RED on the rebased result — e2e/server-env.json differs from HEAD" 11
  command -v jq >/dev/null 2>&1 || fail "jq is required to read the committed e2e PORT — install jq and re-run" 20 # BL-0288
  COMMITTED_PORT="$(jq -r '.PORT|tostring' e2e/server-env.json)"
fi
# DR-146 certified tree: verify.sh is a function of the tree it judges, so when the rebased result is
# byte-identical (same HEAD^{tree}, clean, no skip-worktree/assume-unchanged entries, same verify.sh,
# stamp < 12 h old) to a tree a FULL verify.sh already passed in THIS checkout, a second run proves
# nothing new. green-stamp.sh is the only judge; ANY doubt (no/corrupt stamp, other tree, dirty,
# changed gate, old stamp) runs the full gate exactly as before. The DR-138 owner check below is
# untouched: a skip never lands a launched project without PANDACORP_OWNER_RELEASE_OK=1.
if [ -x ".pandacorp/verify.sh" ]; then
  if [ -f ".pandacorp/green-stamp.sh" ] && stamp_note=$(bash .pandacorp/green-stamp.sh check 2>&1); then
    queue_event stamp_check result str match reason str ""
    echo "merge-queue: integration gate SKIPPED [certified-tree] — rebased tree is identical to one a full verify.sh passed ($stamp_note)"
  else
    QUEUE_STAMP_REASON="${stamp_note:-no green-stamp.sh in this overlay}"
    QUEUE_STAMP_REASON="${QUEUE_STAMP_REASON%%$'\n'*}"
    queue_event stamp_check result str miss reason str "${QUEUE_STAMP_REASON:0:500}"
    echo "merge-queue: running the full integration gate [full-gate] (${stamp_note:-no green-stamp.sh in this overlay})"
    # A certified identical tree needs no port. Probe only when a full gate is necessary.
    if [ -n "${COMMITTED_PORT:-}" ]; then
      # BL-0288: refuse to gate against a dev server / another gate already owning the committed
      # origin. Same loopback /dev/tcp probe as bootstrap; projects without the file skip this check.
      if (exec 3<>"/dev/tcp/127.0.0.1/$COMMITTED_PORT") 2>/dev/null; then
        fail "committed e2e PORT :$COMMITTED_PORT is busy — stop the dev server / other gate on :$COMMITTED_PORT, then re-run" 14
      fi
    fi
    start_lock_refresh
    acquire_host_slot
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
    stop_lock_refresh
    if [ "$GATE_RC" -ne 0 ]; then
      fail "integration gate RED on the rebased result — fix on $BRANCH and re-run (NOT a semantic-conflict pass)" 11
    fi
  fi
fi

# ── Launched project: main is production (DR-138) — land only on the owner's explicit order ───────
STATUS="$MAIN_WT/.pandacorp/status.yaml"
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
if ! git -C "$MAIN_WT" merge --ff-only "$BRANCH" 2>/dev/null; then
  queue_read_sha -C "$MAIN_WT" rev-parse HEAD
  queue_event ff sha str "$QUEUE_SHA" result str failed
  fail "the $DEFAULT_BRANCH checkout is busy (uncommitted changes block the ff-merge) — land when quiescent" 12
fi

queue_read_sha -C "$MAIN_WT" rev-parse HEAD
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
  QUEUE_PUSH_SHA=$(git -C "$MAIN_WT" rev-parse "$DEFAULT_BRANCH" 2>/dev/null) || { QUEUE_PUSH_SHA=""; queue_log_warning; }
  if ! git -C "$MAIN_WT" push origin "$DEFAULT_BRANCH"; then
    queue_event push sha str "$QUEUE_PUSH_SHA" result str failed
    fail "merged into $DEFAULT_BRANCH locally but 'git push origin $DEFAULT_BRANCH' failed — production is NOT updated; fix the remote and push again" 13
  fi
  queue_event push sha str "$QUEUE_PUSH_SHA" result str ok
  echo "merge-queue: pushed $DEFAULT_BRANCH to origin — Vercel deploys it to production"
fi

# DR-147: whatever door this work came through, the change queue must now match main. The reconciler
# reads the landed history (a `Change: <slug>` trailer, all-VERIFIED `source_change` WOs) and archives
# the cards it answers; doubtful cards are only flagged for the owner. It runs on the MAIN checkout —
# the inbox is gitignored and lives only there. Best-effort: the landing already succeeded, so a
# reconciler failure (or a live build, exit 3) is reported, never turned into a failed merge.
if [ -f "$MAIN_WT/.pandacorp/change-reconcile.mjs" ] && command -v node >/dev/null 2>&1; then
  QUEUE_RECONCILE_RC=0
  node "$MAIN_WT/.pandacorp/change-reconcile.mjs" --apply --project "$MAIN_WT" || QUEUE_RECONCILE_RC=$?
  queue_event reconcile rc json "$QUEUE_RECONCILE_RC"
  if [ "$QUEUE_RECONCILE_RC" -ne 0 ]; then
    echo "merge-queue: change-reconcile did not complete (exit $QUEUE_RECONCILE_RC) — run it on $DEFAULT_BRANCH: node .pandacorp/change-reconcile.mjs --apply" >&2
  fi
fi
echo "merge-queue: worktree KEPT (your session is inside it) — restore the session cwd WITHOUT removal, stop owned writers, then run the validated DR-145 cleanup: cd $MAIN_WT && bash .pandacorp/session-cleanup.sh finish --session <session-root>"
exit 0
