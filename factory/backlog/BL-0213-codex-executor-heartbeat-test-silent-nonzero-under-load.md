---
id: BL-0213
type: bug
area: build-engine
title: "test-codex-executor.mjs 'fenced heartbeat during a long dispatch' failed once in a full battery with a non-zero exit and EMPTY stdout/stderr (a second timing coupling BL-0166 did not cover)"
status: open
severity: p2
opened: 2026-09-30
closed:
source: "red-team of the BL-0190/0166/0168 batch (2026-09-30): first full `run-engine-tests.sh` of the review worktree at d2aae705"
closes: "plugin/scripts/test-codex-executor.mjs (the slow-heartbeat scenario), possibly plugin/scripts/codex-executor or its lease renewal"
links: [BL-0166]
---

## Problem
BL-0166 replaced the two signal tests' fixed 2 s readiness polls with explicit waits (a real fix: reverting it makes the
new "executor start slower than 2 s" variant fail with `signal exit null`, checked by mutation). In the red-team's first
full battery (`bash plugin/scripts/run-engine-tests.sh`, 28/29 suites green) a DIFFERENT test of the same suite failed:

```
FAIL  fenced heartbeat during a long dispatch is controller-owned, not a worker write: Error:
    at ok (…/test-codex-executor.mjs:42:60)   ← line 151: ok(result.code === 0, `${result.err}\n${result.out}`)
```

The executor exited non-zero and printed NOTHING on either stream. The scenario runs with `PANDACORP_LEASE_TTL_SECONDS=3`
and `PANDACORP_LEASE_RENEW_MS=100` and a fake dispatch that sleeps 450 ms: a 3 s lease under a loaded machine (the
battery runs the engine suites in sequence while other sessions run theirs) is the obvious suspect, but it is NOT
confirmed. Re-run alone: 52/52 green. A silent non-zero exit is itself a defect whichever cause it has: the executor
must say why it stopped.

## Fix plan
1. Reproduce deliberately (the suite under CPU contention, e.g. alongside `test-pandacorp-build.mjs` ×4).
2. Make the executor print its terminal reason on every non-zero exit (a lease loss must be loud), then confirm the
   cause per `docs/rules/debugging.md`.
3. Widen the fixture's TTL or wait on an explicit renewal marker instead of a wall-clock window.

## Done when
- [ ] Reproduced, cause confirmed; the executor never exits non-zero silently.
- [ ] Two back-to-back full batteries under deliberate contention are green.

## Out of scope
The other suites' timing hazards (BL-0166's own out-of-scope note).
