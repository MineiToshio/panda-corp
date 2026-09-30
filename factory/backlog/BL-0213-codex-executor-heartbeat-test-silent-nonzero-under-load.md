---
id: BL-0213
type: bug
area: build-engine
title: "test-codex-executor.mjs 'fenced heartbeat during a long dispatch' failed once in a full battery with a non-zero exit and EMPTY stdout/stderr (a second timing coupling BL-0166 did not cover)"
status: done
severity: p2
opened: 2026-09-30
closed: 2026-09-30
source: "red-team of the BL-0190/0166/0168 batch (2026-09-30): first full `run-engine-tests.sh` of the review worktree at d2aae705"
closes: "plugin/runtime/codex/executor.mjs (heartbeat, controllerOnlyStatusDelta, delta, announceStop), plugin/scripts/test-codex-executor.mjs (slow-disk variants, explain(), stderr test)"
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
- [x] Reproduced, cause confirmed; the executor never exits non-zero silently.
- [x] Back-to-back full batteries are green: 3 consecutive `run-engine-tests.sh` (181-192 s, 31/31 suites each) on the rebased tree, plus one under 14 CPU burners and 4 concurrent engine-suite loops (309 s, 31/31).

## Out of scope
The other suites' timing hazards (BL-0166's own out-of-scope note).

## Resolution (2026-09-30)
**Reproduced, not guessed.** CPU contention alone (16 busy loops on 10 cores, 15 runs) never failed the scenario. A deterministic
slow-disk preload (every `rename` of the executor delayed, the loaded-machine condition) reproduced the exact signature 6/6:
`exit != 0`, empty stdout and stderr. Making the executor print its stop reason (below) turned the silence into three
distinct confirmed causes, all the same coupling: the 100 ms heartbeat racing the dispatch's own controller-owned reads.
1. **The heartbeat's own temp file was read as a worker write.** `renew` rewrites `status.yaml` through `status.yaml.tmp-<pid>-<hex>` + rename; a dispatch snapshot/delta landing in that window saw the temp file appear or vanish, so the read-only auditor "wrote files" (`NEEDS_OWNER`, exit 20). Fixed: `delta` ignores `.pandacorp/status.yaml.tmp-*`.
2. **The lock-free projection check lost its race.** `controllerOnlyStatusDelta` read the lease and `status.yaml` separately and gave up after 5 attempts against a renewal that writes the lease first and the status second, so the controller's own heartbeat projection was reported as `implementer touched governed state: .pandacorp/status.yaml` (`OWNERSHIP`, exit 2; the exact silent exit-2 of the battery failure). Fixed: the lease and the status are read under the same mutex `renew` writes them under (`withFence`), one pass, no retry loop.
3. **Stacked renewals starved the mutex.** `setInterval(renew)` launched a new renewal while the previous one was still waiting for the mutex, so every other lease mutation timed out as `CONTENDED lease mutation mutex busy`, or a failed renewal self-terminated the run as `lease_lost`/SIGTERM. Fixed: one renewal in flight at a time (`heartbeat()`).
**Never silent.** The executor now prints `codex-executor: stopped (<reason>): <code> <message>` on stderr on every non-zero exit (was: checkpoint + journal only). The test's failure message now carries stderr, stdout, the checkpoint and the journal tail (`explain()`).
**Test technique (BL-0166's).** The fake dispatch no longer sleeps a wall-clock 450 ms: it waits for the lease's own renewal marker (30 s cap). Three variants run under a deterministic slow-disk preload: none, every rename 50 ms (renewal ~ the interval), the status projection lagging the lease by 250 ms. Plus `a non-zero executor exit always says why on stderr`, and `PANDACORP_TEST_FILTER` (run only the tests whose name contains it) as the repro aid.
**Mutation (each revert turns its test RED):** un-guarded timer -> CONTENDED / SIGTERM (2 variants fail); removed in-flight guard -> CONTENDED (2); lock-free delta -> `OWNERSHIP ... .pandacorp/status.yaml` (2, the original symptom); no temp-file filter -> "auditor wrote files ... status.yaml.tmp-*" (1); no stderr announcement -> `stderr: <empty>`.
**Not verified:** which of the three causes fired in the ONE organic failure (it left no output, and did not recur in the ~20 un-forced runs made here, 15 of them under CPU contention). The slow-disk model is an assumption about how a loaded machine behaves; all three causes are races a loaded disk widens. A 130 ms rename variant (renewal slower than its interval) still starves the mutex occasionally (2/8); it is an unrealistic extreme (production renews every 120 s) and was left out of the suite.
