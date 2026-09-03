#!/bin/bash
# Self-test for BL-0104: PreCompact must run the SAME lesson-capture backstop as Stop
# (add, don't relocate -- DR-047 rule 8's Stop-only coverage left compaction as an
# uncovered window). Proves: (1) hooks.json wires PreCompact to capture-lessons-reminder.sh
# while leaving the Stop wiring byte-for-byte the command it already was; (2) the script
# fires (exit 2, reminder on stderr) on a substantive session with a stale inbox, simulating
# a PreCompact payload (no stop_hook_active field, as Claude Code sends for this event);
# (3) the existing four-way throttle (recent inbox write) still suppresses it identically
# under a PreCompact-shaped payload. Run from the factory repo root:
#   bash plugin/scripts/test-capture-lessons-reminder.sh

set -u
HERE=$(cd "$(dirname "$0")/.." && cd .. && pwd)
HOOKS_JSON="$HERE/plugin/hooks/hooks.json"
SCRIPT="$HERE/plugin/scripts/capture-lessons-reminder.sh"
pass=0; fail=0

check() { # $1 label, $2 condition(0/1)
  if [ "$2" = "1" ]; then echo "  [pass] $1"; pass=$((pass+1)); else echo "  [FAIL] $1"; fail=$((fail+1)); fi
}

echo "== capture-lessons-reminder.sh / PreCompact wiring self-test (BL-0104) =="

# --- 1. Static wiring: hooks.json has a PreCompact block running this exact script,
#        and Stop's existing entry for it is unchanged (add, don't relocate). ---
precompact_cmd=$(jq -r '.hooks.PreCompact[0].hooks[0].command // ""' "$HOOKS_JSON")
stop_capture_cmd=$(jq -r '.hooks.Stop[0].hooks[] | select(.statusMessage=="Pandacorp capture check") | .command' "$HOOKS_JSON")
expected_cmd='bash "${CLAUDE_PLUGIN_ROOT}/scripts/capture-lessons-reminder.sh"'

check "PreCompact wired to capture-lessons-reminder.sh" \
  "$([ "$precompact_cmd" = "$expected_cmd" ] && echo 1 || echo 0)"
check "Stop's capture-check entry is unchanged (not relocated)" \
  "$([ "$stop_capture_cmd" = "$expected_cmd" ] && echo 1 || echo 0)"
stop_hook_count=$(jq '.hooks.Stop[0].hooks | length' "$HOOKS_JSON")
check "Stop still has its 4 original hooks (verify, capture, drift x2)" \
  "$([ "$stop_hook_count" = "4" ] && echo 1 || echo 0)"

# --- 2. Behavioral: a PreCompact-shaped payload (no stop_hook_active field, as Claude
#        Code's PreCompact input omits it) fires the reminder before compaction (exit 2). ---
fx=$(mktemp -d)
mkdir -p "$fx/factory/memory" "$fx/tmp"
sid="precompact-test-$$"
transcript="$fx/transcript.jsonl"
i=0
while [ "$i" -lt 7 ]; do
  echo '{"type":"user","message":{}}' >> "$transcript"
  i=$((i+1))
done

payload=$(jq -n --arg cwd "$fx" --arg sid "$sid" --arg tp "$transcript" \
  '{cwd:$cwd, session_id:$sid, transcript_path:$tp, trigger:"auto"}')

out=$(printf '%s' "$payload" | TMPDIR="$fx/tmp" bash "$SCRIPT" 2>&1 1>/dev/null)
code=$?
check "fires (exit 2) on stale inbox + substantive session, PreCompact-shaped payload" \
  "$([ "$code" = "2" ] && echo 1 || echo 0)"
check "reminder text mentions the raw inbox path" \
  "$(printf '%s' "$out" | grep -q "$fx/factory/memory/_inbox.md" && echo 1 || echo 0)"

# --- 3. Throttle preserved: a recent inbox write suppresses it under the same
#        PreCompact-shaped payload (the existing four-way throttle, untouched). ---
fx2=$(mktemp -d)
mkdir -p "$fx2/factory/memory" "$fx2/tmp"
sid2="precompact-throttle-$$"
transcript2="$fx2/transcript.jsonl"
i=0
while [ "$i" -lt 7 ]; do
  echo '{"type":"user","message":{}}' >> "$transcript2"
  i=$((i+1))
done
echo "gap: already captured" > "$fx2/factory/memory/_inbox.md"

payload2=$(jq -n --arg cwd "$fx2" --arg sid "$sid2" --arg tp "$transcript2" \
  '{cwd:$cwd, session_id:$sid, transcript_path:$tp, trigger:"auto"}')

printf '%s' "$payload2" | TMPDIR="$fx2/tmp" bash "$SCRIPT" >/dev/null 2>&1
code2=$?
check "throttle (recent inbox write) still suppresses under PreCompact payload (exit 0)" \
  "$([ "$code2" = "0" ] && echo 1 || echo 0)"

find "$fx" -delete 2>/dev/null
find "$fx2" -delete 2>/dev/null
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
