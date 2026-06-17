---
id: WO-10-002
type: work-order
slug: chains
title: 'WO-10-002 — `lib/achievements.ts`: chains + honest endowed progress'
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-002 — `lib/achievements.ts`: chains + honest endowed progress

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-10-chains`](../blueprint.md#4-components--interfaces). Thresholds/tier names in
[`docs/achievements.md`](../../../achievements.md).

## Goal
Implement `computeChains(stats)` in `lib/achievements.ts`: per chain, the current tier
(Bronze→Silver→Gold→Platinum→Legend), the next tier, the **honest endowed-progress** pct to next,
the unlock date+project per tier, and lower-is-better handling for idea→launch.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-002.1** — `computeChains()` SHALL tier up each chain when its stat crosses the threshold (per `docs/achievements.md`), returning current tier, next tier name and pct-to-next.
- **AC-10-002.2** — Each unlocked tier SHALL carry the **date** and **project** where it happened.
- **AC-10-002.3** — Progress SHALL be **honest endowed progress**: the bar starts from the progress **already achieved** (real), and the pct SHALL correspond to real work — it SHALL NEVER be inflated nor a bar stuck artificially (negative AC, FRD-09 forbidden pattern).
- **AC-10-002.4** — Lower-is-better chains (record idea→launch) SHALL compute progress correctly (improving = closer to the next, lower threshold), per the prototype `chainState` logic.
- **AC-10-002.5** — The function SHALL be pure and fixture-tested.

## Dependencies
- WO-10-001 (`computeStats`). Intra-feature.
- `docs/achievements.md` threshold/name tables.

## TDD plan
1. RED: tests for tier crossing, next-tier name, endowed pct from real progress, lower-is-better, date+project capture; a "no inflation / not stuck" negative test.
2. GREEN: implement `computeChains()` + the data tables.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/achievements.test.ts` green incl. negative ACs; tsc + biome clean; pure; no `any`.
- `.pandacorp/verify.sh` passes.
</content>
