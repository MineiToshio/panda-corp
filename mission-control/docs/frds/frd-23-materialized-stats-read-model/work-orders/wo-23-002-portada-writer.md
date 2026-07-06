---
id: WO-23-002
type: work-order
slug: portada-writer
title: 'WO-23-002 — Portada writer (single writer, atomic) + portada-vs-live equivalence'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-002]
artifacts: [src/lib/achievements/read-model/statsWriter.ts, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: [WO-23-001]
last_updated: '2026-07-06'
---
# WO-23-002 — Portada writer

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-002); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
The **single writer** (DR-115) that re-derives the portada from git via the report `derive*` cores and
writes it **atomically**. Lives in factory tooling (invoked by hooks/backfill), not the MC render path.

## In scope
- `writeStatsPortada(projectPath)` — re-derive `weeklyFlow / phaseTransitions / scalars / lessons /
  funnel` by calling the existing pure cores in `src/lib/achievements/report/*` (DR-092 — do not
  re-implement), stamp `seal = currentSeal(projectPath)` and `generatedAt`, write **atomically**
  (tmp file + `fs.rename`).

## Acceptance criteria (EARS)
- **AC-23-002.1** — numbers re-derived from git + seal stamped; **never** incremental `+1/-1` writes.
- **AC-23-002.2** — atomic write (tmp + rename); a mid-write crash never leaves corrupt `stats.json`.
- **AC-23-002.3** — **equivalence**: materialized numbers == live-git numbers for the same project.

## TDD plan
RED: equivalence test (write portada for a fixture repo, read it back, assert == the live `derive*`
output); atomic-write test (no readable partial file). GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note
_Pending — PLANNED._
