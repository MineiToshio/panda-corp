#!/bin/bash
# Pandacorp event emitter for Party (SLIM payload — E5).
# Reads a hook's JSON payload from stdin and appends ONE compact NDJSON line to
# ~/.claude/dashboard-events.ndjson, stamped with the hook event name, time and project.
# Mission Control tails this file (read-only). This script never calls Claude.
#
# Payload is intentionally MINIMAL — {event, at, project, session_id?, agent_type?, agent_id?} —
# and DROPS heavy hook fields (last_assistant_message, background_tasks, nested data blobs) so the
# stream stays small and cheap to tail (paired with rotate-events.sh's 8 MB rotation).
# Project is derived from the hook's `.cwd` by walking UP to the NEAREST directory containing
# .pandacorp/status.yaml (the project marker) — NOT the git top-level: an in-repo project like
# mission-control lives inside panda-corp's git root, so the toplevel would mislabel its events
# (BL-0022 class). Fall back to the git top-level, then to $PWD basename.

EVENT_NAME="${1:-unknown}"
LOG="$HOME/.claude/dashboard-events.ndjson"

input=$(cat)
ts=$(date -u +%FT%TZ)   # second-precision UTC

if command -v jq >/dev/null 2>&1; then
  cwd=$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null)
  [ -n "$cwd" ] || cwd="$PWD"
  # Nearest .pandacorp project marker wins (in-repo projects like mission-control);
  # else git toplevel; else the cwd itself.
  root=""
  probe="$cwd"
  while [ -n "$probe" ] && [ "$probe" != "/" ]; do
    if [ -f "$probe/.pandacorp/status.yaml" ]; then root="$probe"; break; fi
    probe=$(dirname "$probe")
  done
  [ -n "$root" ] || root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
  project=$(basename "$root")
  session_id=$(printf '%s' "$input" | jq -r '.session_id // ""' 2>/dev/null)
  agent_type=$(printf '%s' "$input" | jq -r '.agent_type // .subagent_type // ""' 2>/dev/null)
  agent_id=$(printf '%s'   "$input" | jq -r '.agent_id // .subagent_id // ""' 2>/dev/null)
  jq -cn \
    --arg ev "$EVENT_NAME" --arg at "$ts" --arg proj "$project" \
    --arg sid "$session_id" --arg atype "$agent_type" --arg aid "$agent_id" \
    '{event:$ev, at:$at, project:$proj}
      + (if $sid   != "" then {session_id:$sid}  else {} end)
      + (if $atype != "" then {agent_type:$atype} else {} end)
      + (if $aid   != "" then {agent_id:$aid}    else {} end)' >> "$LOG" 2>/dev/null
else
  # jq missing: minimal line, project from $PWD basename.
  printf '{"event":"%s","at":"%s","project":"%s"}\n' "$EVENT_NAME" "$ts" "$(basename "$PWD")" >> "$LOG"
fi

exit 0
