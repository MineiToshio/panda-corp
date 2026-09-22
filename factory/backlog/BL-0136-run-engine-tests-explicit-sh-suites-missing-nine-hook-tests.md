---
id: BL-0136
type: bug
area: build-engine
title: "run-engine-tests.sh's EXPLICIT_SH_SUITES allowlist is missing 9 of the hooks' own test-*.sh suites"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md speed sprint; LESSON-0151, LESSON-0184"
closes:
links: [BL-0069, LESSON-0151, LESSON-0184]
---

## Problem
`plugin/scripts/run-engine-tests.sh` (BL-0069's CI-wiring target) discovers `test-*.mjs` by glob but
cannot glob `test-*.sh` the same way — `test-*.sh` matches `test-run-engine-tests.sh` itself, which would
then recursively invoke the aggregator it is testing (confirmed live on the sprint's
`integration-speed-sprint-a` branch: `plugin/scripts/run-engine-tests.sh` comment "the narrower sibling
bug — test-run-engine-tests.sh's own suite-count self-test used to hardcode its expected count..."). The
fix chosen was an explicit opt-in array, `EXPLICIT_SH_SUITES`, checked after WP-05/E3 land (as of
`integration-speed-sprint-a`):
`EXPLICIT_SH_SUITES=(test-verify-gate-report.sh test-verify-before-stop.sh test-classify-change.sh)`.
That is only 3 of the `.sh` suites that actually exist under `plugin/scripts/` — live-verified (`git show
integration-speed-sprint-a:plugin/scripts/<name>` on each) to also exist but be ABSENT from the array:
`test-block-dangerous.sh`, `test-warn-adhoc-write.sh`, `test-capture-lessons-reminder.sh`,
`test-backup-and-precious.sh`, `test-detect-gate-config-newer.sh`, `test-run-engine-tests.sh` (must stay
excluded — it IS the recursive self-test), `test-validate-memory-eval-gate-advisory.sh`,
`test-warn-worktree-remove.sh`, `test-check-derived-drift.sh`. That is 8 real hook-test suites (9 minus
the self-test) that `run-engine-tests.sh` — and therefore the CI workflow BL-0069 wired to it — never
runs, silently. This is the exact failure mode LESSON-0151 and LESSON-0184 name: authored verification
tooling (these 8 suites all exist, are presumably passing today, and were written specifically to guard
the enforcement hooks) rots invisibly the moment nothing continuously executes it.

## Root cause
`EXPLICIT_SH_SUITES` was seeded with the `.sh` suites the packages that INTRODUCED the allowlist
mechanism (WP-05's `test-verify-gate-report.sh`, E3's `test-verify-before-stop.sh`, F1's
`test-classify-change.sh`) happened to add for themselves. Nobody did a full inventory of PRE-EXISTING
`test-*.sh` suites under `plugin/scripts/` and back-filled them into the same array, so the 9 hook test
suites that predate this sprint were never opted in.

## Fix plan
1. Enumerate every `test-*.sh` file under `plugin/scripts/` (not just the 9 named above — re-run the
   inventory at implementation time in case more landed meanwhile) and diff against the current
   `EXPLICIT_SH_SUITES` contents.
2. Add each missing suite to `EXPLICIT_SH_SUITES` ONE AT A TIME, running `run-engine-tests.sh` after each
   addition — a suite added blind that turns out to already be red (rotted, per LESSON-0151) needs its
   own triage, not to be silently folded into a batch that then reports the whole corpus red for an
   unrelated reason.
3. `test-run-engine-tests.sh` (the aggregator's own self-test) stays permanently OUT of
   `EXPLICIT_SH_SUITES` — it already runs on its own via its dedicated invocation path; adding it here
   recreates the exact recursion the array exists to avoid. Document this exclusion with a comment at the
   array's definition site so a future addition doesn't re-introduce it by accident.

## Tests (prove the fix — TDD, RED → GREEN)
RED = today (post-sprint-merge baseline), `bash plugin/scripts/run-engine-tests.sh` does not invoke any
of the 8 missing suites — provable by instrumenting a temporary fake copy of one (e.g.
`test-block-dangerous.sh`) that writes a sentinel file on invocation and observing it never gets written.
GREEN = after the fix, the same instrumentation confirms all 8 run. Extend
`test-run-engine-tests.sh`'s own suite-count assertion (it already reads the `EXPLICIT_SH_SUITES` array
literal per the sprint's fix for the "narrower sibling bug") so the count check catches a FUTURE
`test-*.sh` file landing without a corresponding array entry — a fail-loud gate against this class of
regression recurring, not just a one-time backfill.

## Done when
All genuine pre-existing hook `test-*.sh` suites run under `run-engine-tests.sh` (verified 8, plus any
found by a fresh inventory at implementation time); `test-run-engine-tests.sh`'s count assertion goes RED
if a new `test-*.sh` lands without an array entry; the self-test exclusion is documented inline; plugin
version bumped per DR-034; LESSON-0151/LESSON-0184 cited in the closing commit.

## Out of scope
Converting any `.sh` suite to `.mjs` to sidestep the glob-recursion problem structurally — that redesign
is a separate call, not required for this item's fix.
