---
id: WO-23-005
type: work-order
slug: factory-store-split
title: 'WO-23-005 — Factory-scoped store + seal (writer/reader) and prune the per-project portada'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-006]
artifacts: [src/lib/achievements/read-model/**, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: [WO-23-001, WO-23-002]
last_updated: '2026-07-06'
---
# WO-23-005 — Factory-scoped store + seal, prune per-project portada

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-006, §"Portada scope-split"); design in [`blueprint.md`](../blueprint.md)
§3b–§5. Decision: [`ADR-0004`](../../../adr/ADR-0004-materialized-stats-read-model.md) §"SSOT correction".

## Goal
Close the DR-115 SSOT defect the FRD-23 gate surfaced: move the **factory-wide** facts out of the
per-project portada into **one** factory-scoped store `<factory-root>/.pandacorp/stats-factory.json` with
its **own factory-wide seal**, and prune the per-project portada to per-project facts only. Fail-loud
(DR-078), single writer (DR-115), atomic write.

## In scope
- `src/lib/achievements/read-model/factorySeal.ts` — `currentFactorySeal(factoryRoot): string | null` =
  the hash of the last commit touching `factory/portfolio.md`, `factory/decisions/`, `factory/memory/` and
  every project's `.pandacorp/status.yaml` (one `git log -1 --format=%H -- <paths>`); `isFactoryFresh(store, seal)`
  — equality only (LESSON-0009: commit hashes, not timestamps → no ordering).
- `src/lib/achievements/read-model/factoryStoreReader.ts` — `readStatsFactory(factoryRoot): FactoryResult`
  (`{ok:true;value:StatsFactory} | {ok:false; reason:"missing"|"stale"|"unparseable"}`), same fail-loud
  convention as `readStatsPortada`.
- `src/lib/achievements/read-model/factoryStoreWriter.ts` (factory tooling) — `writeStatsFactory(factoryRoot)`:
  re-derive `phaseTransitions`/`scalars.projects`/`scalars.decisions`/`lessons` via the existing pure
  `derive*` cores (DR-092 — do not re-implement), stamp the factory seal, write **atomically** (tmp+rename).
  Single writer (DR-115).
- Split `ReportScalars` → `ProjectScalars` (`frds`, `commits`) held per-project + `FactoryScalars`
  (`projects`, `decisions`) held factory-wide; update the `StatsPortada` schema/parser and `writeStatsPortada`
  to drop `phaseTransitions`/`scalars.projects`/`scalars.decisions`/`lessons`. **Remove** those fields from
  the per-project reader types/mappings (retire the stale copy by construction, DR-115) — not just stop writing them.
- Extend the `StatsFactory` schema + `z.infer`/type-guard parser reusing `report/types.ts` verbatim (DR-092).

## Acceptance criteria (EARS)
- **AC-23-006.1** — factory-wide facts stored ONCE in `stats-factory.json`, single writer, re-derived (no `+1/-1`).
- **AC-23-006.2** — factory seal covers `portfolio.md` + `decisions/` + `memory/` + every project's
  `status.yaml`; a phase change in ANY project mismatches the seal → store treated stale.
- **AC-23-006.3** — atomic write; `readStatsFactory` fail-loud (missing/stale/unparseable), never silent empty.
- **AC-23-006.4** — per-project portada no longer contains factory-wide facts; its seal validates 100% of it.

## TDD plan
RED: fixtures — a real-shape `stats-factory.json`, a malformed one, a stale one (seal mismatch), a missing
path; assert each `FactoryResult`. A **cross-project staleness** fixture: two projects' `status.yaml`, mutate
B → `currentFactorySeal` changes → store stale (seeds AC-23-007.3 in WO-23-006). Equivalence: factory store
numbers == live `derive*`. Portada parser rejects the OLD shape's removed fields as "shape it no longer owns"
(kept as per-project only). GREEN: implement. Refactor; `React.cache` the factory seal read.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; knip (no dead exports —
the removed portada fields fully retired); madge (no cycles); `.pandacorp/verify.sh` passes.

## Status Note
_(to be filled by the implementer at IN_REVIEW)_
