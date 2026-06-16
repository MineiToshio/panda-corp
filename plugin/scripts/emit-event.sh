#!/bin/bash
# Pandacorp event emitter for Party.
# Reads a hook's JSON payload from stdin and appends it as one NDJSON line to
# ~/.claude/dashboard-events.ndjson, stamped with the hook event name, time and project.
# Mission Control dashboard tails this file (read-only). This script never calls Claude.

EVENT_NAME="${1:-unknown}"
LOG="$HOME/.claude/dashboard-events.ndjson"
PROJECT="$(basename "$PWD")"   # project namespace = its folder, so Party can tell concurrent builds apart

payload=$(cat)
ts=$(date -u +%FT%TZ)

# Wrap the payload with our metadata. Best-effort: if jq is missing, write a minimal line.
if command -v jq >/dev/null 2>&1; then
  printf '%s' "$payload" | jq -c --arg ev "$EVENT_NAME" --arg ts "$ts" --arg proj "$PROJECT" \
    '{event:$ev, at:$ts, project:$proj, data:.}' >> "$LOG" 2>/dev/null
else
  printf '{"event":"%s","at":"%s","project":"%s"}\n' "$EVENT_NAME" "$ts" "$PROJECT" >> "$LOG"
fi

exit 0
