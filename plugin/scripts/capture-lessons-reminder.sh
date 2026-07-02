#!/bin/bash
# Pandacorp lesson-capture reminder (DR-047 loop v2, Fase 1.3 — the Devin/CodeRabbit
# pattern: a correction is a capture event, and agents forget rule 8).
# Fires ONCE per session, on Stop, only in a Pandacorp context (the factory or a
# project), only for substantive sessions, and only if the raw inbox wasn't already
# written recently. It does not detect corrections itself (that judgment is the
# model's); it forces the model to ASK ITSELF the question once before finishing.
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

# If the inbox was already written in the last hour, capture is alive — stay silent.
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
Pandacorp capture check (DR-047, once per session): before finishing, ask yourself —
did the owner CORRECT you, did something fail and then get FIXED, did a library/tool
prove itself or fail, did you hit a non-obvious gotcha? Each of those is a capture
event. If ANY apply, jot one-line candidates NOW to: $inbox
(prefix: gap · = a defect to fix -> routes to the backlog | gotcha ·/verdict ·/pattern ·
= durable knowledge -> routes to memory; tag (owner-stated) if the owner said it, else
(agent-inferred)). Do NOT polish — one line each; the librarian refines later.
If nothing durable happened, just finish — this reminder will not fire again this session.
EOF
exit 2
