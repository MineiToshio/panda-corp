---
id: WO-23-006
type: work-order
slug: informe-composed-reader
title: 'WO-23-006 — Recompose the Informe reader (per-project + factory-wide) with independent fail-loud fallback'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-007]
artifacts: [src/lib/achievements/read-model/**, src/lib/achievements/report/**, src/app/**, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: [WO-23-003, WO-23-005]
last_updated: '2026-07-06'
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
- **AC-23-007.1** — reader composes factory-wide (factory seal) + per-project (per-project seal) facts.
- **AC-23-007.2** — factory-seal mismatch falls back for factory-wide facts only, per-project facts
  untouched, and vice-versa; neither fabricates a zero.
- **AC-23-007.3** (regression) — two materialized projects A, B; a phase change in B mismatches the factory
  seal → A's Informe is NOT served stale factory-wide data (re-derives / falls back for those facts). MUST
  fail without the split, pass with it.

## TDD plan
RED: a **regression test** reproducing the bug — materialize A and B, mutate B's phase, assert A's composed
Informe reflects the change (factory seal mismatch → live re-derivation), NOT the stale embedded copy. Then:
independent-fallback tests (factory stale + portada fresh → factory-wide live, per-project from portada; and
the mirror); composed equivalence (composed result == full live `derive*`). GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; no `any`; knip; madge; `.pandacorp/verify.sh`
passes. Informe renders identically (no design/visual change).

## Status Note
_(to be filled by the implementer at IN_REVIEW)_
