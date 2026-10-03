---
id: BL-0221
type: bug
area: build-engine
title: "BL-0216's own regression test is RED on main (test-codex-executor.mjs: a lease renewal that never settles does not end the run), so run-engine-tests.sh fails 31/32"
status: done
severity: p1
opened: 2026-10-01
closed: 2026-10-03
source: "pandacorp-bench-form benchmark session 2026-10-01: run-engine-tests.sh on the 9.118.0 candidate and test-codex-executor.mjs on main 9a12a08b (2/2 runs)"
closes: "plugin/scripts/test-codex-executor.mjs (BL-0216 hang armed at dispatch start) + test-codex-enforcement.mjs (bounded codex CLI calls); plugin decision-log Unreleased (bench follow-ups)"
links: [BL-0216, BL-0213]
---

## Problem
`node plugin/scripts/test-codex-executor.mjs` on main at 9a12a08b prints
`FAIL a lease renewal that never settles ends the run loudly before the lease TTL (BL-0216): Error: run kept going with a lease that was never renewed`
and `RESULT: 55 passed, 1 failed`, reproduced twice in a row. BL-0216 is marked `status: done` (closed 2026-09-30, commit
f51684a6), so either the fix in plugin/runtime/codex/executor.mjs (stall deadline in `heartbeat`) did not land as
specified, or its test's timing assumptions do not hold on this machine. `run-engine-tests.sh` therefore ends
`31 passed, 1 failed (of 32 suites)` for every plugin change. A second implementer saw the same suite family stall
(`test-codex-enforcement.mjs` with `codex doctor` > 10 min) and flake 19/20 vs 20/20.

## Root cause
Not verified. Check whether `renewStartedAt`/`stallMs` exist in executor.mjs and whether the test's fake clock reaches
`stallMs` within its wait.

## Fix plan
Reproduce, then fix the executor or the test (never weaken the assertion). Add a timeout to the `codex doctor` call in
test-codex-enforcement.mjs so the runner can never hang.

## Tests (prove the fix — TDD, RED → GREEN)
test-codex-executor.mjs GREEN 5/5 consecutive runs; run-engine-tests.sh 32/32 under `timeout 1800`.

## Done when
Both suites green and stable; BL-0216 back-linked.

## Resolution (2026-10-03)

Root cause confirmed: a test timing assumption, not the executor. The executor's stall deadline (`renewStallMs`,
`heartbeat`) is intact and `plugin/runtime/codex/` is unchanged since f51684a6. Reproduced 3/3 in isolation: exit 2
`CONTENDED lease mutation mutex busy`, stderr also carrying `lease renewal stalled for 1501 ms`, and the fake worker was
never invoked (no `fake-calls.log`). The preload hung the lease's second rename, the first renewal ~100 ms after acquire,
so a pre-dispatch fenced mutation started after the hang, waited the mutex's ~1 s budget and ended the run CONTENDED
before the 1.5 s stall deadline. The test only passed when the controller reached the dispatch within 100 ms.

Fix (test only, no assertion changed): the hang arms from the fake worker's own `stalled-dispatch-started` marker, so
the renewal stalls during the dispatch, the scenario the test names. Mutation check: with the stall deadline removed the
test is RED again (exit 2 CONTENDED). `test-codex-enforcement.mjs` bounds every `codex` CLI call (180 s spawnSync
timeout, `PANDACORP_CODEX_CLI_TIMEOUT_MS`, SIGKILL) and names a timeout as the failure reason (proved RED with
"codex timed out after 200 ms" under a 200 ms budget).

Evidence: `test-codex-executor.mjs` 56/56 in 5 consecutive runs; `test-codex-enforcement.mjs` 20/20;
`run-engine-tests.sh` under `timeout 1800` 37/37 suites green. BL-0216 back-linked (`links:`).
