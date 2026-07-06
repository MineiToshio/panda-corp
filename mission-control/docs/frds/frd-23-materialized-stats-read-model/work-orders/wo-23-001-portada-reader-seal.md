---
id: WO-23-001
type: work-order
slug: portada-reader-seal
title: 'WO-23-001 — Portada reader + freshness seal + fail-loud fixtures'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-001]
artifacts: [src/lib/achievements/read-model/**, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: []
last_updated: '2026-07-06'
---
# WO-23-001 — Portada reader + freshness seal

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-001); design in [`blueprint.md`](../blueprint.md) §3–§5.

## Goal
The **fail-loud** (DR-078), read-only reader of the materialized portada + its self-validating seal.
No writing here.

## In scope
- `src/lib/achievements/read-model/seal.ts` — `currentSeal(projectPath): string` =
  `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`; `isFresh(portada, seal): boolean`.
- `src/lib/achievements/read-model/statsReader.ts` — `readStatsPortada(projectPath): PortadaResult`
  (Zod-parsed; discriminated `{ok:true;value} | {ok:false; reason:"missing"|"stale"|"unparseable"}`),
  `readStatsAggregate(): AggregateResult`.
- The `StatsPortada` / `StatsAggregate` Zod schema + `z.infer` types, reusing `report/types.ts`.

## Acceptance criteria (EARS)
- **AC-23-001.1** — present + well-formed + seal matches → `{ok:true; value}`, no git shell for numbers.
- **AC-23-001.2** — missing → `{ok:false; reason:"missing"}`.
- **AC-23-001.3** — seal mismatch → `{ok:false; reason:"stale"}`.
- **AC-23-001.4** — present but corrupt/unrecognised → **fail loud** `{ok:false; reason:"unparseable"}`
  (never a silent `[]`/`null`).

## TDD plan
RED: fixtures — a **real production-shape** `stats.json`, a **malformed** one (bad JSON + wrong shape),
a **stale** one (seal mismatch), and a **missing** path; assert each result. GREEN: implement.
Refactor; `React.cache` the seal read.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note
_Pending — PLANNED._
