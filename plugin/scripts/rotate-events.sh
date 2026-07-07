#!/usr/bin/env bash
# Pandacorp event-stream rotation (E6). Runs at SessionStart. Keeps
# ~/.claude/dashboard-events.ndjson from growing unbounded (Mission Control tails it live).
#
# When the file exceeds 8 MB it is rotated by TAIL, never truncated in place and never deleted:
#   1. write the last 2000 lines to a sibling .tmp,
#   2. mv the ORIGINAL to dashboard-events.ndjson.1 (a SINGLE archive generation — overwritten each
#      rotation, so history is bounded to one prior file),
#   3. mv the .tmp into place as the new live stream.
# Tolerates a missing file (no-op). Best-effort: any failure leaves the original untouched.
set -uo pipefail

LOG="$HOME/.claude/dashboard-events.ndjson"
THRESHOLD=$((8 * 1024 * 1024))   # 8 MB
KEEP=2000                        # tail lines retained

[ -f "$LOG" ] || exit 0

# portable size (BSD stat -f%z, GNU stat -c%s, wc fallback)
size=$(stat -f%z "$LOG" 2>/dev/null || stat -c%s "$LOG" 2>/dev/null || wc -c < "$LOG" 2>/dev/null || echo 0)
[ "$size" -gt "$THRESHOLD" ] 2>/dev/null || exit 0

tmp="${LOG}.tmp.$$"
if ! tail -n "$KEEP" "$LOG" > "$tmp" 2>/dev/null; then
  rm -f "$tmp" 2>/dev/null
  exit 0
fi
# mv (not rm/truncate) preserves the previous stream as a single archive generation.
mv -f "$LOG" "${LOG}.1" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; exit 0; }
mv -f "$tmp" "$LOG"     2>/dev/null || exit 0
exit 0
