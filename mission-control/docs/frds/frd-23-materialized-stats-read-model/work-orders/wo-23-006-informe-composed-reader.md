---
id: WO-23-006
type: work-order
slug: informe-composed-reader
title: 'WO-23-006 — Recompose the Informe reader (per-project + factory-wide) with independent fail-loud fallback'
status: ACTIVE
parent: FRD-23
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-23-001, REQ-23-007]
artifacts:
  - 'src/lib/achievements/read-model/informeResolver.ts'
  - 'src/lib/achievements/read-model/_tests/informeResolver.test.ts'
  - 'src/lib/achievements/read-model/_tests/informeResolver.sealCoverage.test.ts'
  - 'src/app/achievements/page.tsx'
difficulty: high
dependsOn: [WO-23-003, WO-23-005]
last_updated: '2026-10-22'
---
# WO-23-006 — Composed Informe reader (per-project + factory-wide)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-007); design in [`blueprint.md`](../blueprint.md) §3b–§5. Decision:
[`ADR-0004`](../../../adr/ADR-0004-materialized-stats-read-model.md) §"SSOT correction".

## Goal
Recompose the Informe data layer (`resolveInformeSources` / `resolvePortadaFromAggregate`, the WO-23-003
wiring) so it merges **per-project** facts (portada, per-project seal) with **factory-wide** facts (factory
store, factory seal), each with an **independent** fail-loud fallback to the live `derive*` cores. Fixes the
cross-project staleness bug (project A served fresh with stale factory-wide data from B). No visual change —
the Informe renders identically (FRD-10 REQ-10-020..027 unchanged).

## In scope
- Recompose the reader: read the factory store via `readStatsFactory(factoryRoot)` and each project's
  portada via `readStatsPortada(projectPath)`; assemble the shape FRD-10 renders from `ProjectScalars` +
  `FactoryScalars` + `phaseTransitions`/`lessons`/`funnel`/`weeklyFlow`.
- **Independent fallback**: a non-`ok` `FactoryResult` falls back to the live `derive*` cores for the
  factory-wide facts ONLY; a non-`ok` `PortadaResult` falls back for that project's per-project facts ONLY.
  Never collapse both to one fallback; never fabricate a zero (DR-078).
- Keep `getPendingMerge` live (AC-23-005.1) — untouched.

## Acceptance criteria (EARS)
- **AC-23-001.5** — The portada SHALL NOT hold any fact its seal does not validate: `commits`, `funnel` and
  the ideas-per-week series SHALL be read live even beside a fresh portada, and a live failure to derive
  one of them SHALL surface as an explicit error result, never a fabricated zero (DR-078).
- **AC-23-007.1** — The Informe reader SHALL compose factory-wide facts from the factory store (validated
  by the factory seal) with per-project facts from the portada (validated by the per-project seal).
- **AC-23-007.2** — A **factory-seal mismatch** SHALL fall back to live git for the **factory-wide facts
  only**, leaving valid per-project facts untouched (and vice-versa). Neither fallback SHALL fabricate a
  zero (DR-078).
- **AC-23-007.3** (regression) — GIVEN two materialized projects A and B, WHEN a phase change in B
  invalidates the factory-wide facts, project A's Informe SHALL NOT be served with stale factory-wide data:
  the factory seal SHALL mismatch and A SHALL re-derive / fall back for those facts. (This is the exact
  defect the split fixes.)

AC-23-001.5 was added after this work order's first delivery (change of 2026-09-30, `docs/decision-log.md`): the resolver keeps `commits`, `funnel` and the ideas series live beside a fresh portada. It is already implemented and covered by `src/lib/achievements/read-model/_tests/informeResolver.sealCoverage.test.ts` (four cases: commits live, funnel live, ideas series live with the WO-verified series sealed, un-derivable ideas series fails loud; plus the FRD count still sealed), so v2 builds nothing new for it; the test is declared in this work order's artifacts so the criterion has one owner.

## TDD plan
RED: a **regression test** reproducing the bug — materialize A and B, mutate B's phase, assert A's composed
Informe reflects the change (factory seal mismatch → live re-derivation), NOT the stale embedded copy. Then:
independent-fallback tests (factory stale + portada fresh → factory-wide live, per-project from portada; and
the mirror); composed equivalence (composed result == full live `derive*`). GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; no `any`; knip; madge; `.pandacorp/verify.sh`
passes. Informe renders identically (no design/visual change).

## Status Note

**Built (all green in isolation: read-model 111/111, app/achievements 243/243, tsc clean, biome clean, knip clean, madge no cycles).**

### What it built
Recomposed the Informe reader (`resolveInformeSources`) to compose **two independently seal-validated
stores**, each with its own fail-loud fallback to the live `derive*` cores (REQ-23-007):
- **Per-project facts** (`weeklyFlow`, per-project `scalars.{frds,commits}`, `funnel`) from the portada
  (per-project seal); fall back to live on any non-`ok` `PortadaResult` — unchanged from WO-23-003.
- **Factory-wide facts** (`phaseTransitions`, `scalars.{projects,decisions}`, `lessons`) now come from
  the **factory store** via `readStatsFactory` (factory seal, WO-23-005); fall back to live on any
  non-`ok` `FactoryResult`. Previously (WO-23-005 intermediate) these were **always** live; now they read
  the store when fresh and re-derive only when the factory seal mismatches.

Wired the composed reader into the integration seam `src/app/achievements/page.tsx` (`HallPage`): it now
reads `readStatsFactory(resolveFactoryRoot())` and passes the `FactoryResult` as the new third argument.
No visual change — `InformeSources` render shape and `Informe.tsx` are untouched (FRD-10 REQ-10-020..027).
`getPendingMerge` (FRD-21) untouched (AC-23-005.1).

**Cross-project staleness bug fixed (AC-23-007.3):** a phase change in project B mismatches the factory
seal → `readStatsFactory` returns non-`ok` → project A's Informe re-derives the factory-wide facts live
instead of serving B's stale embedded copy. A's fresh per-project portada can no longer carry a stale copy
because factory-wide facts left it (SSOT split, WO-23-005). The two fallbacks are independent: a
factory-store miss touches ONLY the factory-wide scope, leaving valid per-project facts intact, and
vice-versa.

### Interfaces / contracts exposed (signatures)
```ts
// informeResolver.ts — signature EXTENDED (third param is OPTIONAL, back-compat)
resolveInformeSources(
  portadaResult: PortadaResult,
  live: LiveInformeReaders,
  factoryResult?: FactoryResult,   // NEW (WO-23-006): omitted → factory-wide facts come from live ALWAYS
): InformeSources
```
`InformeSources` and `LiveInformeReaders` are unchanged. Consumes `readStatsFactory(factoryRoot): FactoryResult`
(WO-23-005) at the page seam.

### Decisions & assumptions the consumer inherits
- **Optional third param, not a required one.** `factoryResult` is optional so the blessed WO-23-001..004
  reviewer chain (`aggregateChain.reviewer.test.ts`, DR-080 — not editable) that calls with 2 args stays
  valid: omitted ⇒ factory-wide facts come from the live cores (exactly the WO-23-005 "always live"
  behavior), so that reviewer test passes unchanged. Real call sites pass the `FactoryResult`.
- **`testsPassing` is composed from the LIVE scalars always** — it is not held in either store (per
  `statsSchema.ts` contract). Never fabricated; carries live's `null` ("no cableado") through verbatim.
- **`phaseTransitions` in the store is a bare array**; the resolver wraps a fresh store's value as
  `{ ok: true, value: [...store.phaseTransitions] }` (the render's `ReportResult`, spread to shed
  `readonly`). On fallback it returns the live reader's `ReportResult` verbatim — including its OWN
  fail-loud `git-unavailable` (never collapsed to a fabricated `ok:true`/zero, DR-078).
- **Independence is structural:** factory-wide facts are resolved in one helper (`resolveFactoryWide`)
  BEFORE the portada branch, so a portada miss and a factory-store miss never interfere.
- The resolver stays a **pure dispatcher** over already-computed `PortadaResult`/`FactoryResult` — it does
  NOT read/validate seals itself (that is `readStatsPortada`/`readStatsFactory`); kept unit-testable
  without I/O (DR-092/DR-115). Seal validation happens at the page seam.

### Tests (this WO's own — RED-proven, all green)
`src/lib/achievements/read-model/_tests/informeResolver.test.ts` — extended with:
- v1 test of AC-23-007.1, composed reader: fresh store + fresh portada → factory-wide from store, per-project from
  portada, neither scope's live reader invoked; `testsPassing` composed live.
- v1 test of AC-23-007.2, independent fallback: factory-store miss → factory-wide live only, per-project untouched;
  portada miss → per-project live only, factory-wide untouched; both non-ok → both live, no fabricated zero.
- v1 test of AC-23-007.3 (regression, fails without the split): two projects A/B, B's phase change mismatches the
  factory seal → A re-derives factory-wide live, A's own per-project facts stay from its fresh portada.

Re-verified green (no behavior/visual change) alongside: `aggregateChain.reviewer.test.ts` (blessed,
unedited), the full `read-model` suite (111), `app/achievements` (243) incl. `Informe.test.tsx`,
`informeData.test.ts`.
