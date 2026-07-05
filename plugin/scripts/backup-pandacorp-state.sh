#!/bin/bash
# Pandacorp state backup (BL-0035 mitigation, DR-113 era) — snapshot the UNRECOVERABLE layer.
#
# The gitignored owner/state layer (.pandacorp/inbox + comms + run/lessons.md, and the factory's
# personal files: ideas cards, profile, portfolio, memory inbox) has NO git history by design
# (DR-033/DR-069). The 2026-07-04 incident (mission-control/.pandacorp wiped by an unknown process;
# the gitignored inbox contents were lost for good) proved that layer needs an out-of-repo backstop.
#
# This script rsyncs that layer to ~/.pandacorp-backups/<repo>/<YYYY-MM-DD>/ (one folder per day,
# last write of the day wins) and prunes folders older than RETENTION_DAYS. Fire-and-forget: it
# NEVER fails the caller (always exits 0) and never writes inside the repo. Wired to SessionStart
# (factory .claude/settings.json + plugin hooks.json), so every working session refreshes the
# day's snapshot. Manual run: bash plugin/scripts/backup-pandacorp-state.sh [repo-root]
set -u

ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)}"
[ -d "$ROOT" ] || exit 0
REPO="$(basename "$ROOT")"
DEST_BASE="$HOME/.pandacorp-backups/$REPO"
DAY="$(date +%F)"
DEST="$DEST_BASE/$DAY"
RETENTION_DAYS=30

command -v rsync >/dev/null 2>&1 || exit 0
mkdir -p "$DEST" 2>/dev/null || exit 0

# 1. Every project .pandacorp state layer in the repo (root project and one level down: the
#    factory holds mission-control/.pandacorp; a normal project holds ./.pandacorp).
for PD in "$ROOT/.pandacorp" "$ROOT"/*/.pandacorp; do
  [ -d "$PD" ] || continue
  REL="${PD#"$ROOT"/}"
  for SUB in inbox comms; do
    [ -d "$PD/$SUB" ] && rsync -a --delete "$PD/$SUB/" "$DEST/$REL/$SUB/" 2>/dev/null
  done
  [ -f "$PD/run/lessons.md" ] && mkdir -p "$DEST/$REL/run" 2>/dev/null \
    && rsync -a "$PD/run/lessons.md" "$DEST/$REL/run/lessons.md" 2>/dev/null
  [ -f "$PD/status.yaml" ] && rsync -a "$PD/status.yaml" "$DEST/$REL/status.yaml" 2>/dev/null
done

# 2. The factory's personal, gitignored data (DR-033): idea cards, profile, portfolio, memory inbox.
if [ -d "$ROOT/factory" ]; then
  for F in "$ROOT/factory/profile.md" "$ROOT/factory/portfolio.md" "$ROOT/factory/memory/_inbox.md"; do
    [ -f "$F" ] && mkdir -p "$DEST/factory/$(dirname "${F#"$ROOT"/factory/}")" 2>/dev/null \
      && rsync -a "$F" "$DEST/factory/${F#"$ROOT"/factory/}" 2>/dev/null
  done
  [ -d "$ROOT/factory/ideas" ] && rsync -a --delete \
    --include='*.md' --include='_drafts/***' --exclude='*' \
    "$ROOT/factory/ideas/" "$DEST/factory/ideas/" 2>/dev/null
fi

# 3. Prune snapshots older than RETENTION_DAYS (defensive: only date-named dirs under DEST_BASE).
find "$DEST_BASE" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -mtime +"$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null

exit 0
