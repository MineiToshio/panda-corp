# WO-02-003 review — `nextStep` command map

**Reviewer:** Opus 4.8 (1M) — different model from the implementer (DR-015)
**Date:** 2026-06-16
**Module:** `lib/next-step.ts` (CMP-02-next-step, IF-02-nextStep; REQ-02-004 / AC-02-004.1)
**Commit reviewed:** 351872e

## Verdict: APPROVED

Evidence re-run from clean (not trusting the self-report):

- **Lint (biome):** `lib/next-step.ts` + `lib/next-step.test.ts` clean. My new
  `lib/next-step.adversarial.test.ts` clean after autoformat.
- **Tests:** `next-step.test.ts` 57/57 green. Full suite 1057/1057 across 37 files,
  including the 30 new adversarial tests.
- **Typecheck (scope):** `next-step.ts` typechecks clean. NOTE below on the global gate.
- **Mutation testing (DR-016):** 4 hand-injected mutants, all killed:
  1. `product → CMD_BLUEPRINT` swap → 4 failures.
  2. ignore `advancePending` (always `baseLabel`) → 6 failures.
  3. drop the `phase in PHASE_COMMANDS` guard → 5 failures (caught **only** by the
     adversarial garbage-phase tests — the implementer's suite alone would have
     survived this mutant).
  4. alias `discarded` command to `shipped`'s → 1 failure.

## Findings

### Important (non-blocking — out of this WO's scope, flag to the owner)

- **Global `tsc --noEmit` is RED**, but the failure is `lib/discard.ts:98` (`cache`
  not in `GrayMatterOption`), an **untracked file from a different work order**.
  WO-02-003's commit only added `next-step.ts`/`next-step.test.ts`; `next-step.ts`
  itself typechecks clean. Not attributable to this WO — but `.pandacorp/verify.sh`
  will not go green project-wide until the discard WO fixes it. Routed to that WO's owner.

### Minor

- **`openPath` is declared in the contract but never populated.** The WO note says
  "asserting the `openPath` where applicable", yet `NextStepInput` carries no project
  path, so the function legitimately cannot produce one. This is consistent (no consumer
  reads `openPath` yet — verified by grep). When the FRD-02 card detail wires the real
  project path, `openPath` resolution should move into a caller that has the path, or the
  input contract should gain `projectPath?`. Documented, not a defect today.

## Adversarial coverage added (the implementer did not have these)

`lib/next-step.adversarial.test.ts` (30 tests):
- Garbage/unknown `cardStatus` (wrong case, wrong separator, padded, empty) → safe
  spec fallback, never throws (boundary-ownership, since input may come from untyped YAML).
- Garbage `phase` strings on an in-pipeline card → spec fallback, not a wrong phase command.
- DR-032: `advancePending` is a *substantive* acknowledgement hint (mentions the advance
  intent, real length delta, preserves the base label) — not a cosmetic 1-char tweak that
  the implementer's `commandDiffers || labelDiffers` test would have let slide.
- DR-032 leak guard: `advancePending` must NOT alter discovered/shipped/undefined-phase results.
- Terminal substance: shipped vs discarded are distinct, never a pipeline command.
- Per-phase labels all distinct (label-swap mutant hardening).
- Input integrity: extra keys / `__proto__` ignored, no throw, no pollution.

## Lenses

- **Correctness:** meets AC-02-004.1 and the full WO mapping table; DR-032 handled with a
  distinguishable label. Edge/undefined inputs safe (regression anchors B1'/I3 honored).
- **Security:** pure function, no fs/network/writes; prototype-pollution input probed and safe.
- **Quality:** scope clean (only the two intended files in the commit), no duplication,
  constants centralized, no magic strings, strict typing, no `any`/`@ts-ignore`.
