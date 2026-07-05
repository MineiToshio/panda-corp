#!/bin/bash
# Self-test for warn-adhoc-write.sh's BL-0033 scoping: the DR-096 isolation nudge must
# NOT fire on factory-only prose edits, must STILL fire on gated/shipped factory paths
# and on product-project code, and the landing hint must not name a merge queue the
# factory doesn't have. Run from the factory repo root:
#   bash plugin/scripts/test-warn-adhoc-write.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$HERE/plugin/scripts/warn-adhoc-write.sh"
pass=0; fail=0

run_hook() { # $1 cwd, $2 file → prints hook stdout
  printf '{"cwd":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2" | bash "$HOOK" 2>/dev/null
}

expect() { # $1 label, $2 should_contain(1)/should_not_contain(0) "Isolation reminder", $3 output
  if [ "$2" = "1" ]; then
    if printf '%s' "$3" | grep -q "Isolation reminder"; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1 (nudge missing)"; fail=$((fail+1)); fi
  else
    if printf '%s' "$3" | grep -q "Isolation reminder"; then echo "  ✗ $1 (nudge fired)"; fail=$((fail+1)); else echo "  ✓ $1"; pass=$((pass+1)); fi
  fi
}

echo "== warn-adhoc-write.sh BL-0033 scoping self-test =="

# Factory fixture: a git repo with factory/constitution.md, no .pandacorp/status.yaml
fx=$(mktemp -d)
( cd "$fx" && git init -q )
mkdir -p "$fx/factory/standards" "$fx/plugin/skills/foo" "$fx/plugin/scripts" "$fx/plugin/templates/shared" "$fx/docs" "$fx/mission-control/src"
touch "$fx/factory/constitution.md"

expect "factory standards prose → NO nudge"        0 "$(run_hook "$fx" "$fx/factory/standards/quality.md")"
expect "factory registry yaml → NO nudge"          0 "$(run_hook "$fx" "$fx/factory/decisions/registry.yaml")"
expect "plugin SKILL.md prose → NO nudge"          0 "$(run_hook "$fx" "$fx/plugin/skills/foo/SKILL.md")"
expect "docs proposal → NO nudge"                  0 "$(run_hook "$fx" "$fx/docs/proposals/99-x.md")"
expect "plugin/scripts (executes) → nudge"         1 "$(run_hook "$fx" "$fx/plugin/scripts/foo.sh")"
expect "plugin/templates (ships) → nudge"          1 "$(run_hook "$fx" "$fx/plugin/templates/shared/x.tpl")"
expect "mission-control code → nudge"              1 "$(run_hook "$fx" "$fx/mission-control/src/app.tsx")"
# WS-A F11: cwd parked in a factory SUBDIR must still resolve to the repo root and nudge.
expect "F11 mission-control code, cwd=SUBDIR → nudge" 1 "$(run_hook "$fx/mission-control/src" "$fx/mission-control/src/app.tsx")"
expect "F11 factory prose, cwd=SUBDIR → still NO nudge" 0 "$(run_hook "$fx/factory/standards" "$fx/factory/standards/quality.md")"

# The factory landing hint must NOT name the merge queue (it doesn't exist there)
out=$(run_hook "$fx" "$fx/plugin/scripts/foo.sh")
if printf '%s' "$out" | grep -q "merge-queue.sh"; then
  echo "  ✗ factory hint still names merge-queue.sh"; fail=$((fail+1))
else
  echo "  ✓ factory hint does not name merge-queue.sh"; pass=$((pass+1))
fi

# Project fixture: git repo with .pandacorp/status.yaml
px=$(mktemp -d)
( cd "$px" && git init -q )
mkdir -p "$px/.pandacorp" "$px/src"
touch "$px/.pandacorp/status.yaml"

pout=$(run_hook "$px" "$px/src/app.ts")
expect "project src code → nudge"                  1 "$pout"
expect "F11 project code, cwd=SUBDIR → nudge"      1 "$(run_hook "$px/src" "$px/src/app.ts")"
if printf '%s' "$pout" | grep -q "merge-queue.sh"; then
  echo "  ✓ project hint names the merge queue"; pass=$((pass+1))
else
  echo "  ✗ project hint lost the merge queue"; fail=$((fail+1))
fi

rm -rf "$fx" "$px"
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
