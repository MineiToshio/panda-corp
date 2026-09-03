#!/bin/bash
# Self-test for run-engine-tests.sh + factory-engine-tests.yml (BL-0069).
#
# RED (documented in the item): today, before this work, a `git push` or an unrelated engine
# change can land with a broken test-*.mjs and nothing fails -- there is no trigger.
# GREEN (proven here): a deliberately broken fixture causes the runner to report failure and
# name the broken suite; an all-passing corpus reports success; an empty directory fails loud
# instead of silently succeeding (DR-078); and against the REAL plugin/scripts corpus the
# runner's exit code and suite count faithfully reflect reality (it does not lie either way).
# The CI workflow itself (.github/workflows/factory-engine-tests.yml) is checked structurally
# (valid YAML, wires push+schedule+the runner) -- an actual push/schedule/Actions run cannot be
# exercised from this local script.
#
# Run from the factory repo root:
#   bash plugin/scripts/test-run-engine-tests.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
RUNNER="$HERE/plugin/scripts/run-engine-tests.sh"
WORKFLOW="$HERE/.github/workflows/factory-engine-tests.yml"
pass=0; fail=0

check() { # $1 label, $2 expected rc, $3 dir
  local output rc
  output=$(bash "$RUNNER" "$3" 2>&1)
  rc=$?
  if [ "$rc" = "$2" ]; then
    echo "  OK $1"; pass=$((pass+1))
  else
    echo "  XX $1 (expected rc=$2, got rc=$rc)"
    echo "$output" | tail -20
    fail=$((fail+1))
  fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Fixture 1: an all-passing synthetic corpus -> GREEN.
GREEN_DIR="$TMP/green"; mkdir -p "$GREEN_DIR"
cat > "$GREEN_DIR/test-a.mjs" <<'EOF'
console.log("RESULT: 1 passed, 0 failed");
EOF
cat > "$GREEN_DIR/test-b.mjs" <<'EOF'
console.log("RESULT: 1 passed, 0 failed");
process.exit(0);
EOF
check "all-passing synthetic corpus reports success" 0 "$GREEN_DIR"

# Fixture 2: one deliberately broken fixture among passing ones -> RED, and it is NAMED.
RED_DIR="$TMP/red"; mkdir -p "$RED_DIR"
cp "$GREEN_DIR/test-a.mjs" "$RED_DIR/test-a.mjs"
cat > "$RED_DIR/test-broken.mjs" <<'EOF'
throw new Error("deliberately broken fixture");
EOF
output=$(bash "$RUNNER" "$RED_DIR" 2>&1)
rc=$?
if [ "$rc" != "0" ] && echo "$output" | grep -q "test-broken.mjs"; then
  echo "  OK deliberately broken fixture is caught and named"; pass=$((pass+1))
else
  echo "  XX deliberately broken fixture NOT caught (rc=$rc)"
  echo "$output"
  fail=$((fail+1))
fi

# Fixture 3: an empty directory must fail loud, never silently report success (DR-078).
EMPTY_DIR="$TMP/empty"; mkdir -p "$EMPTY_DIR"
check "empty directory fails loud instead of silently reporting success" 1 "$EMPTY_DIR"

# Real corpus: the runner must discover every real suite; its exit code must reflect reality
# (never assumed green -- it only proves the mechanism does not lie, whatever today's state is).
real_output=$(bash "$RUNNER" "$HERE/plugin/scripts" 2>&1)
real_rc=$?
real_count=$(ls "$HERE"/plugin/scripts/test-*.mjs | wc -l | tr -d ' ')
if echo "$real_output" | grep -q "of $real_count suites"; then
  echo "  OK real corpus: runner discovers all $real_count test-*.mjs suites"; pass=$((pass+1))
else
  echo "  XX real corpus: suite count mismatch (expected $real_count)"
  echo "$real_output" | tail -5
  fail=$((fail+1))
fi
if [ "$real_rc" != "0" ]; then
  failed_line=$(echo "$real_output" | grep "FAILED suites")
  echo "  NOTE real corpus is currently RED -- runner correctly surfaced it: $failed_line"
fi

# The CI workflow itself: valid YAML, wired to push (plugin/** path filter) + schedule +
# this runner. Cannot exercise a real push/schedule/Actions run from a local script.
if [ -f "$WORKFLOW" ] && python3 -c "
import sys, yaml
with open('$WORKFLOW') as f:
    doc = yaml.safe_load(f)
on = doc.get(True, doc.get('on'))
assert on is not None, 'missing on:'
assert 'schedule' in on, 'missing schedule trigger'
assert 'push' in on, 'missing push trigger'
paths = on['push'].get('paths', [])
assert any('plugin' in p for p in paths), 'push trigger missing a plugin/** path filter'
jobs = doc.get('jobs') or {}
assert jobs, 'no jobs defined'
found = any('run-engine-tests.sh' in step.get('run', '') for j in jobs.values() for step in j.get('steps', []))
assert found, 'no step invokes run-engine-tests.sh'
" > /tmp/bl0069-wf-check.log 2>&1; then
  echo "  OK workflow YAML is valid and wires push+schedule+run-engine-tests.sh"; pass=$((pass+1))
else
  echo "  XX workflow YAML missing or structurally invalid"
  cat /tmp/bl0069-wf-check.log
  fail=$((fail+1))
fi

echo ""
echo "test-run-engine-tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
