#!/bin/bash
# run-engine-tests.sh — runs every plugin/scripts/test-*.mjs and fails loud if any of them
# does. This is the mechanism `.github/workflows/factory-engine-tests.yml` invokes on push
# (touching plugin/**) and on a daily schedule, so the factory's own engine correctness
# suite (BL-0069) is checked on a trigger that does not depend on an agent remembering to
# run it by hand (LESSON-0151: authored verification tooling rots without continuous
# execution — the tests existed and passed once, but nothing ran them, so they rotted
# invisibly).
#
# Usage: run-engine-tests.sh [--list] [dir]
#   --list prints the suite names that would run (one per line) and exits 0 without running them.
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
LIST_ONLY=0
if [ "${1:-}" = "--list" ]; then LIST_ONLY=1; shift; fi
DIR="${1:-$HERE}"

shopt -s nullglob
all_mjs=("$DIR"/test-*.mjs)
shopt -u nullglob

# v1 engine freeze (DR-150, engine v2 phase 0): the v1 (Dynamic Workflows) engine stays in the
# tree, usable but never fixed, so its OWN suites leave this runner. This is an explicit
# exclusion, not a deletion; the files are archived at R2/10.0.0 (see PLAN §1.2).
# test-build-run-id.mjs is deliberately NOT excluded until R2. Keep this a single literal
# assignment line: test-run-engine-tests.sh reads it the same way it reads EXPLICIT_SH_SUITES.
ENGINE_V1_EXCLUDED=(test-pandacorp-build.mjs test-build-engine.mjs test-build-mech.mjs test-build-mech-lanes.mjs test-engine-artifact.mjs test-engine-lease-lifecycle.mjs test-codex-executor.mjs test-codex-unattended.mjs test-runtime-switch.mjs test-r10-certification-permit.mjs test-whole-frd-gate-contract.mjs test-prod-smoke.mjs)
files=()
for _f in "${all_mjs[@]}"; do
  _skip=0
  for _x in "${ENGINE_V1_EXCLUDED[@]}"; do
    [ "$(basename "$_f")" = "$_x" ] && _skip=1 && break
  done
  [ "$_skip" = "0" ] && files+=("$_f")
done

EXPLICIT_SH_SUITES=(test-verify-gate-report.sh test-verify-before-stop.sh test-classify-change.sh test-check-derived-drift.sh test-doc-lint-closing.sh test-doc-lint-env-example.sh test-doc-lint-neon-project-id.sh test-change-now-prose.sh test-worktree-bootstrap.sh test-warn-adhoc-write.sh test-scan-portfolio.sh test-serve-once.sh test-merge-queue-certified-tree.sh test-pipefail-readers.sh test-pre-push.sh test-merge-queue-lock-refresh.sh)
# v1-only .sh suites test-preflight-version-skew.sh and test-preflight-session-cwd.sh were dropped
# from the list above for the same freeze (DR-150). test-pre-push.sh and test-merge-queue-lock-refresh.sh
# are pre-added for the v2 work; the -f guard below skips them until they exist.
for _sh in "${EXPLICIT_SH_SUITES[@]}"; do
  [ -f "$DIR/$_sh" ] && files+=("$DIR/$_sh")
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "run-engine-tests: no test-*.mjs found under $DIR -- refusing to report a silent success" >&2
  exit 1
fi

if [ "$LIST_ONLY" = "1" ]; then
  for f in "${files[@]}"; do basename "$f"; done
  exit 0
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
