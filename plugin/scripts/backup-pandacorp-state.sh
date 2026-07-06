#!/bin/bash
# Pandacorp state backup (BL-0035 mitigation, DR-113 era) — snapshot the UNRECOVERABLE layer.
#
# The gitignored owner/state layer (.pandacorp/inbox + comms + run/lessons.md, and the factory's
# personal files: ideas cards, profile, portfolio, memory inbox) has NO git history by design
# (DR-033/DR-069). The 2026-07-04 incident (mission-control/.pandacorp wiped by an unknown process;
# the gitignored inbox contents were lost for good) proved that layer needs an out-of-repo backstop.
#
# This script rsyncs that layer to ~/.pandacorp-backups/<repo>/<YYYY-MM-DD>/ (one folder per day,
# ADDITIVE within the day — never --delete: a file wiped from the source between sessions must
# survive in the day's snapshot, or the backup destroys its freshest copy on exactly the event it
# exists for — Fable-audit 2026-07-04 #3) and prunes folders older than RETENTION_DAYS.
# Fire-and-forget: it NEVER fails the caller (always exits 0) and never writes inside the repo —
# but it is no longer SILENT: it prints a one-line summary (file count + any failures) so a
# shrinking or failing backup is visible in-session instead of masquerading as a working one.
# Wired to SessionStart (factory .claude/settings.json + plugin hooks.json), so every working
# session refreshes the day's snapshot. Manual run: bash plugin/scripts/backup-pandacorp-state.sh [repo-root]
set -u

# Resolve the CANONICAL main working tree even when invoked from a git worktree (BL-0045 F14):
# git worktrees don't carry the gitignored owner state (it lives in the MAIN checkout), and
# --show-toplevel would key the backup under the worktree's basename → a near-empty snapshot in
# the wrong folder. --git-common-dir points at the main repo's .git from anywhere; its parent is
# the real working tree, so a session living in worktrees still refreshes the true repo snapshot.
ARG_ROOT="${1:-$(pwd -P)}"
COMMON_DIR="$(git -C "$ARG_ROOT" rev-parse --git-common-dir 2>/dev/null)"
if [ -n "$COMMON_DIR" ]; then
  case "$COMMON_DIR" in /*) : ;; *) COMMON_DIR="$ARG_ROOT/$COMMON_DIR" ;; esac  # make absolute
  COMMON_DIR="$(cd "$COMMON_DIR" 2>/dev/null && pwd -P)"
  ROOT="$(dirname "$COMMON_DIR")"   # parent of the shared .git = the main working tree
else
  ROOT="$ARG_ROOT"                  # not a git repo (e.g. a raw path) — back up as-is
fi
[ -d "$ROOT" ] || exit 0
REPO="$(basename "$ROOT")"
DEST_BASE="$HOME/.pandacorp-backups/$REPO"
DAY="$(date +%F)"
DEST="$DEST_BASE/$DAY"
RETENTION_DAYS=30

command -v rsync >/dev/null 2>&1 || { echo "Pandacorp backup SKIPPED: rsync not available" >&2; exit 0; }
mkdir -p "$DEST" 2>/dev/null || { echo "Pandacorp backup FAILED: cannot create $DEST" >&2; exit 0; }

failures=0
try() { "$@" 2>/dev/null || failures=$((failures+1)); }
# rsync does NOT create missing destination PARENT dirs — ensure them first (the original
# version silently lost a nested project's status.yaml to this whenever inbox/ was absent).
try_to() { # try_to <dest-file-or-dir> <rsync args...>
  local dest="$1"; shift
  mkdir -p "$(dirname "$dest")" 2>/dev/null
  try "$@" "$dest"
}

# 1. Every project .pandacorp state layer in the repo. Scan up to 3 levels deep (BL-0045 F13:
#    the old one-level glob missed a nested project like packages/app/.pandacorp), pruning the
#    heavy/irrelevant trees. ADDITIVE (no --delete): a partial wipe between sessions must not
#    shrink today's snapshot.
while IFS= read -r PD; do
  [ -d "$PD" ] || continue
  REL="${PD#"$ROOT"/}"
  for SUB in inbox comms; do
    [ -d "$PD/$SUB" ] && try_to "$DEST/$REL/$SUB/" rsync -a "$PD/$SUB/"
  done
  [ -f "$PD/run/lessons.md" ] && try_to "$DEST/$REL/run/lessons.md" rsync -a "$PD/run/lessons.md"
  # run/*.sh — the machine-specific deploy machinery (serve.sh/deploy-local.sh, DR-089). It is
  # gitignored (encodes THIS machine's paths/port) and precious: losing it took Mission Control's
  # always-on deploy down (BL-0035 follow-up). The reproducible KNOW-HOW lives in infra.md DR-089;
  # this backs up the machine-specific INSTANCE so a sweep no longer loses it.
  for SH in "$PD"/run/*.sh; do
    [ -f "$SH" ] && try_to "$DEST/$REL/run/$(basename "$SH")" rsync -a "$SH"
  done
  [ -f "$PD/status.yaml" ] && try_to "$DEST/$REL/status.yaml" rsync -a "$PD/status.yaml"
done < <(find "$ROOT" -maxdepth 3 -type d -name .pandacorp \
           -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null)

# 2. The factory's personal, gitignored data (DR-033): idea cards, profile, portfolio, memory
#    inbox — plus the other unrecoverable gitignored owner state the first version missed
#    (Fable-audit 2026-07-04 #2): the gamification ledger, the ports ledger, the sweep stamp.
if [ -d "$ROOT/factory" ]; then
  for F in "$ROOT/factory/profile.md" "$ROOT/factory/portfolio.md" "$ROOT/factory/memory/_inbox.md" \
           "$ROOT/factory/memory/_last-sweep" "$ROOT/factory/ports.yaml" "$ROOT/factory/gamification-ledger.json"; do
    [ -f "$F" ] && try_to "$DEST/factory/${F#"$ROOT"/factory/}" rsync -a "$F"
  done
  [ -d "$ROOT/factory/ideas" ] && try_to "$DEST/factory/ideas/" rsync -a \
    --include='*.md' --include='_drafts/***' --exclude='*' \
    "$ROOT/factory/ideas/"
fi

# 3. Prune snapshots older than RETENTION_DAYS (defensive: only date-named dirs under DEST_BASE).
find "$DEST_BASE" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -mtime +"$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null

# 4. One-line visibility (never fails the caller): count + failures. A shrinking count across
#    days, or any failure count, is the signal the old silent version could never emit.
count=$(find "$DEST" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$failures" -gt 0 ]; then
  echo "Pandacorp backup: $count files → $DEST — WARNING: $failures rsync failure(s), snapshot may be incomplete" >&2
else
  echo "Pandacorp backup: $count files → $DEST"
fi

# 5. Advisory: warn if any gitignored path is precious yet neither disposable nor in the manifest
#    above (the enforceable form of "nothing precious lives only-gitignored"). Never fails us.
CHECK="$(dirname "$0")/check-unbacked-precious.sh"
[ -f "$CHECK" ] && bash "$CHECK" "$ROOT" || true

exit 0
