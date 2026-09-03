#!/bin/bash
# Pandacorp WorktreeRemove SOFT WARNING (BL-0105, proposal 33 §6 R-21): the DR-096 pending-work
# check today only runs when the owner remembers `pending-work.sh` by hand. This hook fires the
# moment Claude Code removes a worktree (session exit, a subagent's isolation:"worktree" finishing,
# or a background-session delete) and applies the SAME invariant `pending-work.sh` uses: a worktree
# whose branch is NOT fully merged into the default branch, OR whose tree is dirty, is unmerged
# work about to disappear — warn LOUDLY before it's gone.
#
# WorktreeRemove hooks have NO decision control (Claude Code discards all JSON output fields and
# ignores the exit code except for debug-log-only failure noise) — they cannot block removal, full
# stop. registry.yaml's precedent explicitly rejects a hard PreToolUse block for this class of
# action in favor of a visible warning (DR-099's loud-hand-back pattern), so the only channel this
# hook has to be VISIBLE is a side effect: a desktop notification (osascript, guarded — same
# pattern as pending-work.sh --notify / merge-queue.sh) plus stderr (debug-log visible, and what
# this hook's own self-test asserts against). This hook NEVER blocks (always exits 0) and never
# performs the removal itself (Claude Code / git handles that for git-based worktrees).
set -euo pipefail

input=$(cat 2>/dev/null || true)
wt=$(printf '%s' "$input" | jq -r '.worktree_path // ""' 2>/dev/null || true)

# Nothing to check (malformed/missing input, or the path is already gone) → silent no-op.
[ -n "$wt" ] || exit 0
[ -d "$wt" ] || exit 0
git -C "$wt" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null || echo "")
[ -n "$branch" ] || exit 0  # detached HEAD worktree: nothing to attribute to a branch

root=$(git -C "$wt" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "")
[ -n "$root" ] || exit 0
default_branch=$(git --git-dir="$root" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo "")
[ -n "$default_branch" ] || default_branch="main"
[ "$branch" != "$default_branch" ] || exit 0  # removing a worktree ON the default branch: n/a

ahead=$(git -C "$wt" rev-list --count "$default_branch..$branch" 2>/dev/null || echo 0)
dirty=$([ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ] && echo 1 || echo 0)

[ "$ahead" = "0" ] && [ "$dirty" = "0" ] && exit 0  # fully merged + clean → silent, nothing pending

reason="+$ahead commit(s) sin mergear a $default_branch"
[ "$dirty" = "1" ] && reason="$reason, cambios sin commitear"
msg="Pandacorp: worktree '$branch' se está eliminando con trabajo pendiente ($reason). Revísalo antes de perderlo: $wt"

command -v osascript >/dev/null 2>&1 && osascript -e "display notification \"$reason\" with title \"Pandacorp: worktree con trabajo sin mergear\"" 2>/dev/null || true
echo "$msg" >&2
exit 0
