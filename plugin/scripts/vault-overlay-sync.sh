#!/bin/bash
# Pandacorp vault overlay auto-sync (DR-089 era, pandacorp-vault convention).
#
# Commits the factory's gitignored PERSONAL files into the pandacorp-vault overlay (a bare repo whose
# work-tree is the factory checkout) and pushes to its private remote, so the owner's ideas/profile/
# portfolio survive machine loss without living in the shared repo. Best-effort: NEVER fails the caller
# (always exit 0), quiet on a no-op, commits locally and defers the push when offline. Wired to
# SessionStart alongside the state backup. Canonical: factory/standards/infra.md → "pandacorp-vault".
set -u

ARG_ROOT="${1:-$(pwd -P)}"
# Canonical main working tree (works from a worktree too — see backup-pandacorp-state.sh).
COMMON_DIR="$(git -C "$ARG_ROOT" rev-parse --git-common-dir 2>/dev/null)" || exit 0
[ -n "$COMMON_DIR" ] || exit 0
case "$COMMON_DIR" in /*) : ;; *) COMMON_DIR="$ARG_ROOT/$COMMON_DIR" ;; esac
COMMON_DIR="$(cd "$COMMON_DIR" 2>/dev/null && pwd -P)" || exit 0
ROOT="$(dirname "$COMMON_DIR")"

GD="$(dirname "$ROOT")/pandacorp-vault/personal.git"
[ -d "$GD" ] || exit 0                       # no overlay set up on this machine → nothing to do
[ -d "$ROOT/factory" ] || exit 0             # only the factory repo has the personal layer

ovl() { git --git-dir="$GD" --work-tree="$ROOT" -C "$ROOT" "$@"; }

# Re-track the personal set with -f (the main repo gitignores them) so NEW idea cards get picked up,
# then stage modifications/deletions of already-tracked files.
FILES=(factory/profile.md factory/portfolio.md factory/ports.yaml factory/gamification-ledger.json factory/memory/_inbox.md)
while IFS= read -r card; do FILES+=("$card"); done < <(find "$ROOT/factory/ideas" -maxdepth 1 -name '*.md' \
  ! -name '_idea-template.md' ! -name 'decision-log.md' 2>/dev/null | sed "s#^$ROOT/##")
[ -d "$ROOT/factory/ideas/_drafts" ] && while IFS= read -r d; do FILES+=("$d"); done < <(find "$ROOT/factory/ideas/_drafts" -name '*.md' ! -name 'README.md' 2>/dev/null | sed "s#^$ROOT/##")
ovl add -f "${FILES[@]}" 2>/dev/null
ovl add -u 2>/dev/null

# Commit only if something is staged; push best-effort (may be offline / no remote yet).
if ! ovl diff --cached --quiet 2>/dev/null; then
  ovl commit -q -m "auto: overlay snapshot $(date '+%F %H:%M')" 2>/dev/null
  if ovl remote get-url origin >/dev/null 2>&1 && ovl push -q origin HEAD 2>/dev/null; then
    echo "Pandacorp vault: overlay pushed to private remote"
  else
    echo "Pandacorp vault: overlay committed locally (push deferred — offline or no remote)"
  fi
fi
exit 0
