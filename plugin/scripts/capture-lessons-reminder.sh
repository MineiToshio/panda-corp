#!/bin/bash
# Pandacorp lesson-capture BACKSTOP (DR-047 loop v2, Fase 1.3).
# The PRIMARY capture is in-the-moment (rule 8): the instant the owner corrects
# something, a fix lands after a failure, or a library verdict emerges, the agent
# jots the one-liner IN THAT SAME TURN. This hook is only the safety net for what
# slipped through: it fires ONCE per session, on Stop, and tells the agent to
# RE-SCAN the conversation it just had — the full transcript is in its context,
# so this is a read-back, never a memory quiz (the owner shouldn't have to
# remember anything; neither should the agent guess).
# Exit 2 = one-time nudge (stderr shown to the model). Exit 0 = allow stop.

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
sid=$(echo "$input" | jq -r '.session_id // ""')

# Never loop: if a Stop hook already fired this turn, allow the stop.
stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$stop_active" = "true" ] && exit 0

# Once per session.
marker="${TMPDIR:-/tmp}/pandacorp-capture-reminder-${sid:-nosid}"
[ -f "$marker" ] && exit 0

# Scope: only Pandacorp contexts, each with its own raw inbox (rule 8 paths).
if [ -f "$cwd/.pandacorp/status.yaml" ]; then
  inbox="$cwd/.pandacorp/run/lessons.md"          # a product project
elif [ -d "$cwd/factory/memory" ]; then
  inbox="$cwd/factory/memory/_inbox.md"           # the factory itself
else
  exit 0
fi

# If the inbox was already written in the last hour, in-the-moment capture is
# alive (rule 8 working as designed) — stay silent, the backstop isn't needed.
if [ -f "$inbox" ] && [ -n "$(find "$inbox" -mmin -60 2>/dev/null)" ]; then
  touch "$marker"; exit 0
fi

# Substantive sessions only: >= 6 user turns in the transcript (cheap, deterministic).
transcript=$(echo "$input" | jq -r '.transcript_path // ""')
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  turns=$(grep -c '"type":"user"' "$transcript" 2>/dev/null || echo 0)
  [ "$turns" -lt 6 ] && { touch "$marker"; exit 0; }
fi

touch "$marker"
cat >&2 <<EOF
Pandacorp capture backstop (DR-047, once per session): the raw inbox has no recent
notes, so before finishing RE-SCAN THIS CONVERSATION — it is fully in your context;
do not rely on recall or ask the owner to remember. Walk it turn by turn and pull
out every capture event you did not jot at the moment it happened: an owner
correction ("no, hazlo asi", "esto esta mal", "por que lo hiciste asi?"), a
failure you later fixed, a library/tool that proved itself or failed, a non-obvious
gotcha. Write ONE line each to: $inbox
(prefix: gap · = a defect to fix -> routes to the backlog | gotcha ·/verdict ·/pattern ·
= durable knowledge -> routes to memory; tag (owner-stated) if the owner said it, else
(agent-inferred)). Reminder for next time: rule 8 says capture IN THE SAME TURN the
event happens — this backstop existing is not a license to defer. If the re-scan
finds nothing durable, just finish; this will not fire again this session.
EOF
exit 2
