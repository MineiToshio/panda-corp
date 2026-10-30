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
  while ! mkdir "$LOCK" 2>/dev/null; do
    # reclaim a stale lock (its owner crashed) — mtime older than STALE_MIN
    if [ -z "$(find "$LOCK" -mmin -"$STALE_MIN" 2>/dev/null)" ]; then
      echo "merge-queue: reclaiming stale lock ($(cat "$LOCK/owner" 2>/dev/null || echo unknown))" >&2
      rm -rf "$LOCK"; continue
    fi
    [ "$waited" -ge 600 ] && fail "merge lock held for >10min by $(cat "$LOCK/owner" 2>/dev/null) — try again" 20
    sleep 5; waited=$((waited + 5))
  done
  echo "$BRANCH @ $WORKTREE" > "$LOCK/owner"
}
release() { rm -rf "$LOCK"; }
# BL-0288: restore local config only on nonzero post-restore exits; successful landing drops
# the manifest permanently. Unlock BEFORE bootstrap (install/hooks need no queue lock), and
# preserve the original status even if bootstrap fails or leaves committed PORT/unset index bits.
RESTORE_LOCAL=0
cleanup() {
  local result=$?
  release
  if [ "$result" -ne 0 ] && [ "$RESTORE_LOCAL" = 1 ] && [ -x ".pandacorp/worktree-bootstrap.sh" ]; then
    if ! bash .pandacorp/worktree-bootstrap.sh; then
      echo "merge-queue: WARNING: bootstrap failed; worktree may be left on the committed PORT without skip-worktree; re-run bash .pandacorp/worktree-bootstrap.sh manually" >&2
    fi
  fi
  return "$result"
}
trap cleanup EXIT
acquire

# ── Preflight: is the main checkout quiescent? (fast early hand-back, DR-096) ──────────────────────
# The ff-merge at the very end fails when the main checkout has conflicting uncommitted WIP (another
# session). Detecting that NOW — before the multi-minute rebase + integration gate — avoids burning all
# that work only to fail at the last step. This is an EARLY hand-back; the authoritative check is still
# the `git merge --ff-only` below (state can change between here and there), so the recheck is never
# skipped. Same exit 12 ("busy main") — the work is preserved on the branch, nothing is lost.
if [ -n "$(git -C "$MAIN_WT" status --porcelain 2>/dev/null)" ]; then
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
if ! git rebase "$DEFAULT_BRANCH"; then
  git rebase --abort 2>/dev/null || true
  # BL-0288: EXIT re-bootstraps after abort too, leaving a usable clean worktree.
  fail "rebase onto $DEFAULT_BRANCH hit a conflict git can't auto-resolve — resolve on the branch or escalate" 10
fi

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
  # BL-0288: refuse to gate against a dev server / another gate already owning the committed
  # origin. Same loopback /dev/tcp probe as bootstrap; projects without the file skip this check.
  if (exec 3<>"/dev/tcp/127.0.0.1/$COMMITTED_PORT") 2>/dev/null; then
    fail "committed e2e PORT :$COMMITTED_PORT is busy — stop the dev server / other gate on :$COMMITTED_PORT, then re-run" 14
  fi
fi
if [ -x ".pandacorp/verify.sh" ]; then
  if ! bash .pandacorp/verify.sh; then
    fail "integration gate RED on the rebased result — fix on $BRANCH and re-run (NOT a semantic-conflict pass)" 11
  fi
fi

# ── Launched project: main is production (DR-138) — land only on the owner's explicit order ───────
STATUS="$MAIN_WT/.pandacorp/status.yaml"
LAUNCHED=0
if [ -f "$STATUS" ] && grep -Eq '^phase:[[:space:]]*release([[:space:]]|#|$)' "$STATUS" \
   && ! grep -Eq '^deploy_target:[[:space:]]*internal([[:space:]]|#|$)' "$STATUS"; then
  LAUNCHED=1
fi
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
  fail "the $DEFAULT_BRANCH checkout is busy (uncommitted changes block the ff-merge) — land when quiescent" 12
fi

# The worktree is deliberately NOT removed here. The session that invoked this script is
# standing INSIDE it: deleting the directory under a live Claude session leaves its cwd
# dangling — the next user message fails with "Path ... does not exist" and every background
# task dies with the forced session restart (owner-reported, recurring, 2026-07-02). A `cd`
# here only moves THIS script's cwd, never the session's. Removal belongs to the harness,
# which also restores the session cwd: the agent calls ExitWorktree(action: "remove") right
# after this script succeeds. If ExitWorktree no-ops (the session restarted and lost the
# worktree binding), clean from OUTSIDE the worktree instead:
#   cd "$MAIN_WT" && git worktree remove --force "$WORKTREE" && git branch -D "$BRANCH"
rm -f "$MAIN_WT/.pandacorp/run/worktrees/$BRANCH.json" 2>/dev/null || true   # drop the manifest entry (worktree-bootstrap writes <branch>.json) (DR-096 §7)

echo "merge-queue: merged $BRANCH → $DEFAULT_BRANCH"

# Launched + owner's order: publishing main IS the production release (Vercel's GitHub integration).
if [ "$LAUNCHED" = 1 ]; then
  if ! git -C "$MAIN_WT" push origin "$DEFAULT_BRANCH"; then
    fail "merged into $DEFAULT_BRANCH locally but 'git push origin $DEFAULT_BRANCH' failed — production is NOT updated; fix the remote and push again" 13
  fi
  echo "merge-queue: pushed $DEFAULT_BRANCH to origin — Vercel deploys it to production"
fi
echo "merge-queue: worktree KEPT (your session is inside it) — call ExitWorktree(action: remove) now to clean it AND restore the session cwd; if that no-ops, run: cd $MAIN_WT && git worktree remove --force $WORKTREE && git branch -D $BRANCH"
exit 0
