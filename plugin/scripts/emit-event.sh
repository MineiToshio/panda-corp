#!/bin/bash
# Pandacorp event emitter for Party.
# Reads a hook's JSON payload from stdin and appends it as one NDJSON line to
# ~/.claude/dashboard-events.ndjson, stamped with the hook event name and time.
# Mission Control dashboard tails this file (read-only). This script never calls Claude.

EVENT_NAME="${1:-unknown}"
LOG="$HOME/.claude/dashboard-events.ndjson"

payload=$(cat)
ts=$(date -u +%FT%TZ)

# Wrap the payload with our metadata. Best-effort: if jq is missing, write a minimal line.
if command -v jq >/dev/null 2>&1; then
  printf '%s' "$payload" | jq -c --arg ev "$EVENT_NAME" --arg ts "$ts" \
    '{event:$ev, at:$ts, data:.}' >> "$LOG" 2>/dev/null
else
  printf '{"event":"%s","at":"%s"}\n' "$EVENT_NAME" "$ts" >> "$LOG"
fi

exit 0
