#!/bin/bash
# Pandacorp Stop gate: prevents declaring "done" with a broken project.
# Runs the project's own .pandacorp/verify.sh if it exists (created by /pandacorp:blueprint).
# Exit 2 = keep working (stderr shown to the model). Exit 0 = allow stop.

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')

# Avoid infinite loops: if a previous Stop hook already fired in this turn, let it stop.
stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$stop_active" = "true" ] && exit 0

# Scope: only Pandacorp projects with a verify script — its presence in .pandacorp/ IS the marker
verify="$cwd/.pandacorp/verify.sh"
[ -f "$verify" ] || exit 0

out=$(bash "$verify" 2>&1)
if [ $? -ne 0 ]; then
  echo "Pandacorp verify gate FAILED — you can't finish with a broken project." >&2
  echo "Rule that failed: .pandacorp/verify.sh (tests + typecheck + lint must pass)." >&2
  echo "Fix the root cause; do NOT tweak the test to pass or declare it 'done'." >&2
  echo "--- verify.sh output (last 30 lines) ---" >&2
  echo "$out" | tail -30 >&2
  exit 2
fi

exit 0
