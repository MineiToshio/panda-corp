---
id: WO-23-004
type: work-order
slug: aggregate-regen-backfill
title: 'WO-23-004 — Aggregate index + Stop/post-commit regeneration + one-shot backfill'
status: ACTIVE
parent: FRD-23
implementation_status: PLANNED
reopen_count: 0
source_requirements: [REQ-23-003, REQ-23-004]
artifacts: [src/lib/achievements/read-model/**, scripts/**]
difficulty: high
dependsOn: [WO-23-002]
last_updated: '2026-07-06'
---
# WO-23-004 — Aggregate index, universal regeneration & backfill

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-003, REQ-23-004); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
The **O(1)** aggregate index (from `sync-portfolio`), the **universal write trigger** (Stop hook /
git `post-commit`) so any change that ends in a commit regenerates the portada, and the one-shot
**backfill** for existing projects.

## In scope
- Extend the `sync-portfolio` portfolio walk to write the aggregate index (`StatsAggregate`) from the N
  portadas; a malformed aggregate reader (WO-23-001) fails loud.
- Regeneration trigger: the Claude Code **Stop hook** and/or a git **`post-commit`** calls
  `writeStatsPortada` for the affected project(s). Commit = the correct universal trigger (covers direct
  hand edits, ideas/decisions/phases, single-FRD builds).
- One-shot **backfill** command over existing projects calling `writeStatsPortada` once each.

## Acceptance criteria (EARS)
- **AC-23-003.1** — aggregate joins every portada into one file read in O(1); Informe cost independent of N.
- **AC-23-003.2** — malformed aggregate → fail loud, never a silent empty.
- **AC-23-004.1** — backfill generates each project's initial portada equivalent to the live reader.

## TDD plan
RED: aggregate join test (N portadas → one file → O(1) read; malformed → fail loud); backfill
equivalence test. GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note
_Pending — PLANNED._
