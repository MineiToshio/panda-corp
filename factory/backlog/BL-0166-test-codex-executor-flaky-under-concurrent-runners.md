---
id: BL-0166
type: bug
area: build-engine
title: "test-codex-executor.mjs fails intermittently when run-engine-tests.sh's suites execute under concurrent/parallel runners, passes reliably in isolation"
status: open
severity: p2
opened: 2026-09-23
source: "bl-0140-0134-classifier + bl-0044-warn-adhoc integration session, 2026-09-23 — observed two failures of this suite during the day's parallel test runs, both green when re-run alone"
closes: "plugin/scripts/test-codex-executor.mjs (suite), possibly run-engine-tests.sh's runner-concurrency model"
links: []
---

## Problem
`test-codex-executor.mjs`, run as part of `plugin/scripts/run-engine-tests.sh`'s suite battery, has
failed twice today under conditions where multiple sessions/runners were exercising the repo's test
suites in parallel (concurrent worktree integrations, canary runs). Both times, re-running the same
suite ALONE (`node plugin/scripts/test-codex-executor.mjs` or an isolated
`run-engine-tests.sh` invocation with no other runner active) passed cleanly. This session's own two
`run-engine-tests.sh` runs (merging `bl-0140-0134-classifier` then `bl-0044-warn-adhoc`) both came
back fully green (24/24 then 25/25 suites) — no repro inside this session, consistent with the
"only under contention" pattern.

## Suspected cause (not yet confirmed — this is a P2 backlog item, not a diagnosed root cause)
Likely a shared-resource collision between concurrent runner processes: a fixed port, a shared
temp-file path not namespaced per-PID/per-run, or a timing assumption (a fixed-duration wait/poll)
that a loaded machine violates. Not yet investigated — no suspect has been read/confirmed per
`docs/rules/debugging.md`'s standard (reproduce first, enumerate suspects, confirm with direct
evidence). Filed as a backlog item rather than a debugging session because it has not reproduced
inside an isolated investigation yet, only under organic multi-session contention.

## Fix plan (not started)
1. Reproduce deliberately: run `test-codex-executor.mjs` concurrently with itself (2+ parallel
   invocations) or alongside another suite that shares its resource, and confirm the failure mode
   and error message.
2. Once reproduced, apply `docs/rules/debugging.md`'s SOP: read the full path, enumerate suspects
   (shared port/tempfile/lockfile, timing, environment leakage between parallel processes),
   discard with direct evidence, confirm the cause predicts the symptom AND explains the isolated
   passes.
3. Fix (likely: namespace any shared path/port by PID or a random suffix; replace a hard wait with
   a proper readiness poll) + a regression test that exercises the suite under deliberate
   concurrency, per `docs/rules/quality-and-testing.md`'s no-hard-waits / test-isolation rules.

## Done when
- [ ] The failure is reproduced deliberately (not just observed organically).
- [ ] A confirmed root cause (predicts the symptom, explains the isolated-pass non-failures).
- [ ] Fix applied; a regression test exercising deliberate concurrency is green.
- [ ] `bash plugin/scripts/run-engine-tests.sh` run at least twice back-to-back with another suite
      running concurrently, both green.

## Out of scope
Auditing every OTHER suite in `run-engine-tests.sh` for the same class of concurrency hazard (a
reasonable follow-up once this one is confirmed and fixed, not part of this item).
