# WO-04-003 review — `lib/next-step.ts`: `workspaceCommands(phase)`

**Reviewer:** Opus 4.8 (DR-015 — different model from the implementer)
**Date:** 2026-06-16
**Verdict:** APPROVED (cycle 2 — blocking finding resolved)
**Cycle:** 2 of 2

## Evidence re-run (not trusted from the self-report)

| Gate | Result | Notes |
|---|---|---|
| `vitest run` next-step suites (wo04003 + adversarial + base) | 171/171 PASS | Includes the 3 previously-RED reviewer adversarial tests (shared-row aliasing) — now GREEN, plus 4 new mutation-killing tests. |
| `vitest run lib/next-step.wo04003.adversarial.test.ts` | 19/19 PASS | Reviewer-owned suite (15 original + 4 added cycle 2). |
| `tsc --noEmit` (next-step files) | clean | No `any`/`@ts-ignore`. |
| `biome check lib/next-step.ts` | clean | |
| Purity grep | clean | No fs / network / clock / random / process in `next-step.ts`. |
| Full `vitest run` | 4 failing tests across 2 files — `lib/memory.adversarial.test.ts` (WO-17-001) + `lib/work-orders.adversarial.test.ts` (WO-05-001). **None touch `next-step.ts`.** Pre-existing, tracked separately, escalated to the owner. |

## Cycle-1 blocking finding — RESOLVED

`lib/next-step.ts:122-150`. The fix (commit `17b11ed`) replaces `[...BUILDING_ROWS]` / `[...OPERATION_ROWS]` with `BUILDING_ROWS.map((r) => ({ ...r }))` / `OPERATION_ROWS.map((r) => ({ ...r }))`, and the fallback returns `[{ ...FALLBACK_ROW }]`. Each call now hands callers fresh, owned row objects; module constants stay immutable.

Verified by the 3 reviewer adversarial tests that were RED in cycle 1, now GREEN:
- mutating a returned building row does NOT corrupt the next call.
- mutating a returned operation row does NOT corrupt the next call.
- a returned row object is not the SAME instance as the next call's row.

## Adversarial tests added (reviewer-owned, cycle 2)

`lib/next-step.wo04003.adversarial.test.ts` extended with 4 mutation-killing tests (DR-016):
- command→when pairing pinned per phase (kills a `when`-swap mutant that survives both the implementer's command pins and the reviewer's uniqueness checks).
- `new-version` `when` is milestone-specific and distinct from the iterate copy.
- every row has a non-empty command (`^/pandacorp:`) AND a non-empty `when` (kills blank-string mutants).
- `release` phase yields exactly the same rows as `implementation` (both are "building").

All 19 pass against the current implementation.

## Findings

### Correctness — PASS
Matches AC-04-005.1 and the WO scope: building → implement/release/iterate; operation → iterate/new-version; early phases delegate to the FRD-02 base map (no duplication); unknown/undefined → safe `spec` fallback (regressions B1'/I3). Pure and deterministic.

### Security — PASS
Pure function, no inputs beyond the typed `Phase`, no fs/network/eval. Hostile phase strings (`__proto__`, `constructor`, casing, whitespace, `null`) all fall back safely without producing a building command (reviewer suite block 5).

### Quality — PASS
Scope contained to `lib/next-step.ts` (+ colocated tests). No scope creep, no duplication (early phases reuse `PHASE_COMMANDS`). UI-facing `when` copy in Spanish per the language rule. Constants centralized.

## Note (not blocking this WO)
Per freeze-on-red SOP the global suite is RED due to WO-17-001 and WO-05-001 — orthogonal, already escalated to the owner. WO-04-003's own code and tests are fully green; the WO is technically APPROVED. Declaring it DONE in `status.yaml` remains gated on the global suite returning green (owner-tracked), independent of this verdict.
