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
#   20 precondition failed (dirty/uncommitted worktree, on main, not a worktree, lock timeout)
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

fail() { echo "merge-queue: $1" >&2; exit "$2"; }

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
trap release EXIT
acquire

# ── Rebase onto the CURRENT main tip (the merge-queue invariant: frozen + up-to-date target) ───────
git fetch --quiet "$MAIN_WT" "$DEFAULT_BRANCH" 2>/dev/null || true
if ! git rebase "$DEFAULT_BRANCH"; then
  git rebase --abort 2>/dev/null || true
  fail "rebase onto $DEFAULT_BRANCH hit a conflict git can't auto-resolve — resolve on the branch or escalate" 10
fi

# ── Integration gate on the MERGED result (the arbiter; a textual merge can still fail to compile) ─
if [ -x ".pandacorp/verify.sh" ]; then
  if ! bash .pandacorp/verify.sh; then
    fail "integration gate RED on the rebased result — fix on $BRANCH and re-run (NOT a semantic-conflict pass)" 11
  fi
fi

# ── Fast-forward merge into main, then clean up ────────────────────────────────────────────────────
# ff-only so main only ever moves forward to an already-gated, linear history; if the main checkout has
# conflicting uncommitted WIP from another session, git refuses → hand back (land when it's quiescent).
if ! git -C "$MAIN_WT" merge --ff-only "$BRANCH" 2>/dev/null; then
  fail "the $DEFAULT_BRANCH checkout is busy (uncommitted changes block the ff-merge) — land when quiescent" 12
fi

# Remove the worktree + its branch. We must leave the worktree dir before git can prune it; the calling
# agent should ExitWorktree first, but we self-heal: cd to the main checkout, then prune.
cd "$MAIN_WT"
git worktree remove --force "$WORKTREE" 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true
rm -f "$MAIN_WT/.pandacorp/run/worktrees/$BRANCH" 2>/dev/null || true   # drop the manifest entry (DR-096 §7)

echo "merge-queue: merged $BRANCH → $DEFAULT_BRANCH and removed the worktree"
exit 0
