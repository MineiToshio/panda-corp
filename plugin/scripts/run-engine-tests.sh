#!/bin/bash
# run-engine-tests.sh — runs every plugin/scripts/test-*.mjs and fails loud if any of them
# does. This is the mechanism `.github/workflows/factory-engine-tests.yml` invokes on push
# (touching plugin/**) and on a daily schedule, so the factory's own engine correctness
# suite (BL-0069) is checked on a trigger that does not depend on an agent remembering to
# run it by hand (LESSON-0151: authored verification tooling rots without continuous
# execution — the tests existed and passed once, but nothing ran them, so they rotted
# invisibly).
#
# Usage: run-engine-tests.sh [dir]
#   dir defaults to this script's own directory (plugin/scripts/), so it works regardless of
#   cwd. A different [dir] is used by test-run-engine-tests.sh to prove the aggregation logic
#   against synthetic fixtures without touching the real corpus.
#
# Exit code: 0 only if every discovered test-*.mjs exits 0. Non-zero (and the list of failed
# suite names on stderr) otherwise. An empty directory (no test-*.mjs found) is ALSO a
# failure — it never silently reports success (DR-078: a reader that finds nothing fails
# loud, it does not return a quiet "all good").
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
DIR="${1:-$HERE}"

shopt -s nullglob
files=("$DIR"/test-*.mjs)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "run-engine-tests: no test-*.mjs found under $DIR -- refusing to report a silent success" >&2
  exit 1
fi

pass=0
fail=0
failed_names=()

for f in "${files[@]}"; do
  name=$(basename "$f")
  echo "=== $name ==="
  if node "$f"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    failed_names+=("$name")
  fi
done

echo ""
echo "run-engine-tests: $pass passed, $fail failed (of ${#files[@]} suites)"
if [ "$fail" -gt 0 ]; then
  echo "run-engine-tests: FAILED suites: ${failed_names[*]}" >&2
  exit 1
fi
exit 0
