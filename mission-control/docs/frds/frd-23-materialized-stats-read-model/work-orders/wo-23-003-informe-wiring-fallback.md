---
id: WO-23-003
type: work-order
slug: informe-wiring-fallback
title: 'WO-23-003 — Wire the Informe to read the portada first, fall back to live git'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-001, REQ-23-005]
artifacts: [src/lib/achievements/report/**, src/app/**]
difficulty: medium
dependsOn: [WO-23-001]
last_updated: '2026-07-06'
---
# WO-23-003 — Informe wiring + honest fallback

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-001, REQ-23-005); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
Make the Informe data path try the portada/aggregate first and **fall back to the existing live git
readers** (WO-10-014) on any non-`ok` result. No visual change (the Informe looks identical).

## In scope
- A resolver that, per project, calls `readStatsPortada` (WO-23-001); on `{ok:true}` uses the portada,
  on any `{ok:false}` (`missing`/`stale`/`unparseable`) falls back to the live `weeklyFlow` /
  `phaseTransitions` / `reportScalars` / `lessonCounts` / `funnelAndFlow`.
- Keep `getPendingMerge` (FRD-21) on the **live** path — NOT materialized (AC-23-005.1).

## Acceptance criteria (EARS)
- **AC-23-001.1** — fresh portada → numbers come from the portada, no live git shell.
- **AC-23-001.2/.3/.4** — missing / stale / corrupt → fall back to the live reader, honest, never a
  fabricated zero.
- **AC-23-005.1** — `getPendingMerge` still reads live git.

## TDD plan
RED: resolver tests over stubbed reader results (fresh → portada; each non-`ok` → live fallback);
assert pending-merge untouched. GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green incl. existing; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note
_Pending — PLANNED._
