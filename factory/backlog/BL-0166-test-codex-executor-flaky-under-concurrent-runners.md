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

## Investigation (2026-09-24) — NOT reproduced in the named suite; negative evidence

Followed `docs/rules/debugging.md`'s SOP (reproduce-first). Read the full data path of
`plugin/scripts/test-codex-executor.mjs`: its `fixture()` helper uses `mkdtemp(os.tmpdir(), ...)`
for every project it spins up (genuinely unique per invocation, no fixed shared path); its events
file is explicitly scoped per test via `PANDACORP_CODEX_EVENTS_FILE` (so the BL's own suspicion —
"does this suite use `PANDACORP_EVENTS_LOG`?" — resolves to "it uses the codex-specific env override
correctly, already isolated"); the one confirmed shared-global-state read is
`diagnoseUsageLimitFromRollouts()` (`plugin/runtime/codex/failure-diagnostics.mjs`) falling back to
the real `$HOME/.codex` when `CODEX_HOME` is unset, hit only by the `"uncertain"` scenario test —
measured overhead ~32ms standalone, not itself timing-critical.

**Reproduction attempts, all clean:**
- 3 rounds of `node plugin/scripts/test-codex-executor.mjs & node plugin/scripts/test-codex-executor.mjs & wait`
  (the BL's own suggested repro) — 6 process runs, 306 individual test executions, **0 failures**,
  both processes `exit:0` every round.
- 1 round of 4-way concurrency (4 simultaneous invocations) — 204 test executions, **0 failures**.
- 2 concurrent FULL `bash plugin/scripts/run-engine-tests.sh` batteries from the same checkout
  (closer to the organic incident's shape: ~24-25 suites each, run in the same file order so both
  processes reach `test-codex-executor.mjs` within moments of each other, confirmed by both logs
  hitting `=== test-codex-executor.mjs ===` at the identical line number) — that suite's own section
  in both logs: **0 `FAIL` lines**, both processes.

Total: **9 concurrent invocations of the named suite across 4 reproduction shapes, 0 failures out of
~612 individual test executions.** Per this item's own instruction ("si NO reproduces el fallo... deja
BL-0166 abierto con la evidencia negativa y no inventes fix"), **no fix is applied here** — inventing
one against a suite that will not fail would be guessing, not engineering. `status` stays `open`.

**What the same investigation DID find and fix (sibling-audit, `docs/rules/debugging.md`: "what else
shares this cause?").** The two full-battery concurrent runs above reliably (every attempt) failed a
DIFFERENT suite at the exact same test, in both processes simultaneously:
`test-codex-enforcement.mjs`'s "Codex 0.144.1 strict config accepts generated project config" — a
genuine, confirmed, now-fixed race (non-atomic `writeFileSync` of `.codex/config.toml`, torn-read by
a concurrent `codex doctor`). Filed and closed separately as **BL-0169** (its own root cause, RED→GREEN
regression test, and a 3/3 concurrent-reproduction confirmation, so it does not inflate this item's
own negative result). This is plausibly why the organic incident got attributed to
"`test-codex-executor.mjs`" — the two suite names are adjacent alphabetically and both are
Codex-related; a `run-engine-tests.sh` failure log skimmed quickly could easily conflate them. Also
observed once, not diagnosed or fixed (would be further unbounded scope creep on this item): the SAME
two full-battery runs both failed `test-codex-unattended.mjs`'s "foreground launcher owns the process
lifetime and forwards termination" simultaneously — flagged separately as a background suggestion
rather than a third backlog item bundled into this investigation.
