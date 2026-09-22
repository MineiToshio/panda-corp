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
# Exit code: 0 only if every discovered suite exits 0. Non-zero (and the list of failed
# suite names on stderr) otherwise. An empty directory (no test-*.mjs found) is ALSO a
# failure — it never silently reports success (DR-078: a reader that finds nothing fails
# loud, it does not return a quiet "all good").
#
# WP-05: test-*.sh suites are NOT auto-discovered by a generic glob. Verified (not assumed): doing
# so makes THIS runner discover test-run-engine-tests.sh itself (it matches `test-*.sh`), and that
# suite's own "real corpus" check calls this runner against the real plugin/scripts dir again --
# an unbounded self-recursion (confirmed live: it had to be killed after filling the process table).
# individual .sh suites are opted in explicitly below instead (EXPLICIT_SH_SUITES). The narrower
# sibling bug -- test-run-engine-tests.sh's own suite-count self-test used to hardcode its expected
# count from `ls test-*.mjs` alone, mismatching the moment ANY entry landed here -- is fixed there:
# it now reads THIS array (the same literal assignment line) instead of re-deriving a count.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
DIR="${1:-$HERE}"

shopt -s nullglob
files=("$DIR"/test-*.mjs)
shopt -u nullglob

EXPLICIT_SH_SUITES=(test-verify-gate-report.sh test-verify-before-stop.sh test-classify-change.sh test-check-derived-drift.sh)
for _sh in "${EXPLICIT_SH_SUITES[@]}"; do
  [ -f "$DIR/$_sh" ] && files+=("$DIR/$_sh")
done

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
  case "$f" in
    *.sh) cmd=(bash "$f") ;;
    *)    cmd=(node "$f") ;;
  esac
  if "${cmd[@]}"; then
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
