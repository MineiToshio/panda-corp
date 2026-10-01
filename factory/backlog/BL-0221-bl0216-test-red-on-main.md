---
id: BL-0221
type: bug
area: build-engine
title: "BL-0216's own regression test is RED on main (test-codex-executor.mjs: a lease renewal that never settles does not end the run), so run-engine-tests.sh fails 31/32"
status: open
severity: p1
opened: 2026-10-01
closed:
source: "pandacorp-bench-form benchmark session 2026-10-01: run-engine-tests.sh on the 9.118.0 candidate and test-codex-executor.mjs on main 9a12a08b (2/2 runs)"
closes:
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
