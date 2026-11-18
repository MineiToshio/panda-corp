---
id: BL-0326
type: bug
area: build-engine
title: "Fix v2 build engine failure in drive: source WO status missing"
status: done
severity: p1
opened: 2026-11-16
closed: 2026-11-18
source: "pandacorp-build engine failure, run br-2026-11-16-01"
closes: "Plugin 10.13.5 fix; the resumed run br-2026-11-16-01 (same run id) completed to run_finished on 2026-11-18T05:30:47Z"
links: [DR-103]
---

## Problem
The v2 build engine stopped itself at a safe point (exit 8). Command: `drive`, step: `loop`. It failed, was retried once after `rebuild-state`, and failed again (the retry was skipped: the fault confirms itself).
Error code: `INVALID_STATE`. Message: source WO status missing
```
Error: source WO status missing
    at applyWoTransition (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build-state.mjs:403:106)
    at async transitionWorkOrders (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/integrate/transitions.mjs:95:9)
    at async prepareGrant (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/next/dispatch.mjs:245:7)
    at async launchPhase (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/next/dispatch.mjs:151:48)
    at async fencedTwoPhase (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/state.mjs:198:25)
    at async dispatchRound (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/next/dispatch.mjs:61:18)
    at async step (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/next/step.mjs:81:20)
```
Run `br-2026-11-16-01`, epoch 36. The product work is preserved on the run's integration branch `lane/br-2026-11-16-01/integration`; the run is resumable once this is fixed. This failure consumed no unit attempt.

## Root cause
Confirmed engine bug (valid architect output), not an invalid WO and not a main/integration path error.

- At integration commit `0d82b2d7f0694886f25f604439a8e5ad03c88117`,
  `docs/frds/frd-12-web-performance/work-orders/wo-12-002-publication-cache-protocol.md:9`
  contains `implementation_status: "PLANNED"`; all seven new WOs (002–008) use the same valid quoted scalar.
  The historical `wo-12-001-public-performance.md:9` uses unquoted `IN_REVIEW`.
- `plugin/runtime/build/integrate/workOrders.mjs:18-20` strips YAML quotes, so the index
  accepts the WO. `plugin/runtime/build/integrate/transitions.mjs:95` passes the indexed
  path under the integration worktree to the governed writer. There is no fallback to main.
- Pre-fix `plugin/runtime/build-state.mjs:372` (`fmStatus`) only matched unquoted enum
  tokens. `applyWoTransition` threw `INVALID_STATE: source WO status missing` at line 403.
  The same reader also rejected quoted siblings during rollups: fixing dispatch alone is insufficient.
- Live journal entries 50–55 show `u-tests-wo-12-002` committed/integrated at `fa7e1e4aaff9`;
  entries 56–58 show the build unit admitted and then the engine failure before worker launch.
  Tests units do not move WO status (`next/dispatch.mjs:244` only transitions build/patch).
  This explains why planning and RED tests succeeded before construction failed; older bare scalars
  matched the writer and did not expose the mismatch.

## Fix plan
1. Preserve the actual WO-12-002 frontmatter as a factory-only regression fixture.
2. Accept exact governed status enums with balanced single/double quotes or no quotes, including CRLF,
   in `build-state.mjs`; restrict the lookup to frontmatter, preserving fail-closed rejection.
3. Prove the integration source, quoted sibling rollups, reopen routing and idempotent retry;
   run the complete build-v2 suite plus shared build-state/liveness suites.
4. Bump PATCH 10.13.5 and regenerate both manifests (required for a fix by DR-034).
   Resume the SAME run through the supported CLI; never patch project state or WO frontmatter manually.

## Tests (prove the fix, RED then GREEN)
A regression case in the matching `plugin/scripts/test-build-v2-*.mjs` suite that fails with this error before the fix and passes after, plus a resume of the interrupted run.

## Done when
- The regression test is green and the engine suite passes.
- The plugin version is bumped and the failed run resumes to completion.

## Recovery / delivery boundary

Use the fixed factory CLI directly (no cached plugin update is needed for this absolute path):

```sh
node /Users/Shared/Proyectos/panda-corp/plugin/scripts/pandacorp-build.mjs start --resume --project /Users/Shared/Proyectos/funko-tracker --coordinator codex
```

No `--unblock`, forced lease operation, frontmatter edit or manual `rebuild-state` is required.
Do not pass `--run br-2026-11-16-01`: that option restores a suspended run, whereas this stopped
run already occupies `build/` (`lifecycle/resume.mjs:124` refuses that combination).
Resume requeues the admitted build unit at attempt 1 and preserves the integrated tests/docs.
The normal coordinator/drive loop then continues it. `CONTENDED` means retry after the current
executor yields, never kill it or reset its state.

The owner explicitly forbids writes to funko-tracker and `.git`: no live resume, commit or plugin
activation was attempted. Status remains `doing` until the original live-run completion criterion
can be observed; the factory fix and its verification are delivered independently below.

## Closed (2026-11-18, observed during a funko-tracker harvest sweep)

Read-only observation of `funko-tracker/.pandacorp/run/build/journal.jsonl`: at `2026-11-16T07:36:17Z`
a `run_resumed` event (`from: stopped`) **requeued `u-build-wo-12-002`** — exactly the WO this failure
blocked — on the SAME `run_id` (`br-2026-11-16-01`), confirming the resume command above (or its
equivalent) was executed and worked. The run continued through further resumes and finished cleanly:
`2026-11-18T05:30:47Z run_finished {status: finished}`. `docs/frds/frd-12-web-performance/work-orders/
wo-12-002-publication-cache-protocol.md` now carries `implementation_status: VERIFIED`. The original
Done-when criterion ("the failed run resumes to completion") is met. No write was made to funko-tracker
or its git history to produce or observe this evidence — the project's own subsequent commits already
record it.

## Verification (2026-11-16)

- RED: `node plugin/scripts/test-build-v2-integrate.mjs` before the engine fix exited 1;
  the BL-0326 real-WO case failed with the exact `source WO status missing` error.
- Independent real-fixture oracle loaded the original `HEAD:plugin/runtime/build-state.mjs`
  without modifying the working tree: transition exit 1, `INVALID_STATE: source WO status missing`.
  The same transition with the fixed module exited 0 (oracle harness exit 0).
- GREEN: `TMPDIR=/private/tmp node plugin/scripts/test-build-v2-integrate.mjs` exited 0,
  25 passed / 0 failed. It covers integration-only WO lookup, quoted siblings/rollups,
  single-quoted CRLF reopen, idempotence, malformed/missing/body-only status rejection and untouched main.
- Full relevant suite: a Python subprocess aggregator ran every `test-build-v2-*.mjs`,
  `test-build-state*.mjs` and `test-build-liveness.mjs` with `TMPDIR=/private/tmp`:
  **40 suites passed / 0 failed; aggregator exit 0**. Per-command results follow.
- Initial aggregate: 39/40, exit 1. The conserve author-order comparison differed only in
  wall-clock timestamps by 1 ms; its two inputs now share a fixed `now`. No routing code changed.
- The default macOS TMPDIR uses `/var/folders`, a symlink path rejected by cleanup safety.
  Canonical `/private/tmp` resolves the integration suite's two unrelated cleanup refusals.
- `node plugin/scripts/generate-plugin-manifests.mjs`: exit 0.
- `bash plugin/scripts/check-derived-drift.sh /Users/Shared/Proyectos/panda-corp`: exit 0.
- `bash plugin/scripts/validate-backlog.sh`: exit 0 (320 valid items).
- `git diff --check`: exit 0.
- `claude plugin validate plugin/`: not executed; automatic approval review rejected runtime dispatch
  from Codex to Claude. Generated manifest/drift validation above passed; activation remains untouched.

| Command (all with `TMPDIR=/private/tmp`) | Exit | Result |
| --- | --- | --- |
| `node plugin/scripts/test-build-liveness.mjs` | 0 | RESULT: 5 passed, 0 failed |
| `node plugin/scripts/test-build-state-handoff.mjs` | 0 | RESULT: 25 passed, 0 failed |
| `node plugin/scripts/test-build-state.mjs` | 0 | RESULT: 33 passed, 0 failed |
| `node plugin/scripts/test-build-v2-admission.mjs` | 0 | RESULT 29 passed, 0 failed |
| `node plugin/scripts/test-build-v2-answer.mjs` | 0 | RESULT: 32 passed, 0 failed |
| `node plugin/scripts/test-build-v2-cli.mjs` | 0 | RESULT: 36 passed, 0 failed (test-build-v2-cli) |
| `node plugin/scripts/test-build-v2-conserve.mjs` | 0 | RESULT 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-detect.mjs` | 0 | RESULT 46 passed, 0 failed |
| `node plugin/scripts/test-build-v2-disk.mjs` | 0 | RESULT 26 passed, 0 failed (test-build-v2-disk) |
| `node plugin/scripts/test-build-v2-doubts.mjs` | 0 | RESULT: 38 passed, 0 failed |
| `node plugin/scripts/test-build-v2-drive.mjs` | 0 | RESULT: 45 passed, 0 failed |
| `node plugin/scripts/test-build-v2-e2e.mjs` | 0 | RESULT test-build-v2-e2e: 115/115 passed, 0 failed (49 s) |
| `node plugin/scripts/test-build-v2-failure.mjs` | 0 | RESULT 32 passed, 0 failed |
| `node plugin/scripts/test-build-v2-g2-leftover.mjs` | 0 | RESULT: 5 passed, 0 failed |
| `node plugin/scripts/test-build-v2-gate-patch.mjs` | 0 | RESULT 7 passed, 0 failed |
| `node plugin/scripts/test-build-v2-hardening.mjs` | 0 | RESULT test-build-v2-hardening: 38 passed, 0 failed |
| `node plugin/scripts/test-build-v2-incremental-adversarial.mjs` | 0 | 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-incremental-design.mjs` | 0 | RESULT: 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-integrate.mjs` | 0 | RESULT 25 passed, 0 failed |
| `node plugin/scripts/test-build-v2-jobs.mjs` | 0 | RESULT 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-land.mjs` | 0 | RESULT: 50 passed, 0 failed (test-build-v2-land.mjs) |
| `node plugin/scripts/test-build-v2-lock-stress.mjs` | 0 | 3 passed, 0 failed (14.1 s, plugin /Users/Shared/Proyectos/panda-corp/plugin) |
| `node plugin/scripts/test-build-v2-nested.mjs` | 0 | ℹ duration_ms 1117.338875 |
| `node plugin/scripts/test-build-v2-next.mjs` | 0 | RESULT: 68 passed, 0 failed |
| `node plugin/scripts/test-build-v2-perf.mjs` | 0 | RESULT 10 passed, 0 failed |
| `node plugin/scripts/test-build-v2-planner.mjs` | 0 | RESULT: 30 passed, 0 failed |
| `node plugin/scripts/test-build-v2-preflight.mjs` | 0 | RESULT  26 passed, 0 failed |
| `node plugin/scripts/test-build-v2-quota.mjs` | 0 | RESULT 35 passed, 0 failed |
| `node plugin/scripts/test-build-v2-report.mjs` | 0 | RESULT: 46 passed, 0 failed |
| `node plugin/scripts/test-build-v2-review-pin.mjs` | 0 | RESULT: 3 passed, 0 failed |
| `node plugin/scripts/test-build-v2-review-r1.mjs` | 0 | RESULT: 23 passed, 0 failed (test-build-v2-review-r1) |
| `node plugin/scripts/test-build-v2-review.mjs` | 0 | RESULT: 64 passed, 0 failed |
| `node plugin/scripts/test-build-v2-risk-backtest.mjs` | 0 | RESULT: PASS passed=28 failed=0 |
| `node plugin/scripts/test-build-v2-risk.mjs` | 0 | RESULT: 30 passed, 0 failed (test-build-v2-risk.mjs) |
| `node plugin/scripts/test-build-v2-routing.mjs` | 0 | RESULT 367 passed, 0 failed |
| `node plugin/scripts/test-build-v2-state.mjs` | 0 | RESULT: 76 passed, 0 failed |
| `node plugin/scripts/test-build-v2-telemetry.mjs` | 0 | RESULT 23 passed, 0 failed |
| `node plugin/scripts/test-build-v2-unblock.mjs` | 0 | RESULT: 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-visual-source.mjs` | 0 | RESULT: 12 passed, 0 failed |
| `node plugin/scripts/test-build-v2-workers.mjs` | 0 | RESULT: 16 passed, 0 failed |
