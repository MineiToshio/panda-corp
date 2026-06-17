---
id: WO-05-002
type: work-order
slug: aggregate-progress
title: 'WO-05-002 — `lib/work-orders.ts`: `aggregateProgress`'
status: DRAFT
parent: FRD-05
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-05-002 — `lib/work-orders.ts`: `aggregateProgress`

**Feature:** FRD-05 · **Implements:** IF-05-work-orders (`aggregateProgress`, `WorkOrderProgress`) · **REQ-05-004**
**Deploy unit:** addition to `lib/work-orders.ts` (+ tests). Pure function, no fs, no UI.

## Acceptance criteria (copied)
- **AC-05-004.1** The view SHALL show aggregated progress `done / total` and `%`, summing every feature's `work-orders/`.

## Scope
- `aggregateProgress(orders: WorkOrder[]): WorkOrderProgress` — pure: `done` = count of `state === "done"`,
  `total` = `orders.length`, `pct` = rounded `done/total*100` (0 when `total === 0`).
- This is the single source for both the FRD-05 kanban progress and the FRD-04 Mission Objectives bar
  (they pass the same `WorkOrder[]`), so the two can never drift.
- **Out of scope:** discovery (WO-05-001), rendering (WO-05-006).

## Dependencies
- **Intra:** WO-05-001 (the `WorkOrder` type — sequence after; same module).
- **Cross:** none (pure function).

## TDD (RED → GREEN → refactor)
1. `done/total/pct` for a mixed set (e.g. 2 done of 7 → `{done:2,total:7,pct:29}`) (AC-05-004.1).
2. `total === 0` → `{done:0,total:0,pct:0}`, no division by zero.
3. Pure: same input → same output.

## Definition of done
- [ ] Tests written first and green.
- [ ] No `any`/`@ts-ignore`; pure (no fs).
- [ ] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** `aggregateProgress(orders: WorkOrder[]): WorkOrderProgress` in `lib/work-orders.ts` (lines 306-311). Pure function, no fs calls, no UI.

**Interface/contract exposed:**
```ts
export interface WorkOrderProgress { done: number; total: number; pct: number; }
export function aggregateProgress(orders: WorkOrder[]): WorkOrderProgress;
```
- `done` = count of `orders` where `state === "done"` (exact equality; review/fail/in_progress/todo excluded)
- `total` = `orders.length`
- `pct` = `Math.round(done / total * 1000) / 10` — 1-decimal precision (e.g. 1/3 -> 33.3, 2/3 -> 66.7); `0` when `total === 0`
- Non-mutating: input array and its elements are never modified

**Precision note:** the WO TDD example used `pct:29` for 2/7 as a narrative approximation. The adversarial reviewer (higher authority, `work-orders.adversarial.test.ts`) pinned 1-decimal precision. The implementation uses `Math.round(x * 1000) / 10`, producing `28.6` for 2/7.

**Integration seam:** consumed by CMP-05-progress (FRD-05 kanban progress bar, WO-05-006) and the FRD-04 Mission Objectives bar. Both pass `listWorkOrders()` output directly to this function. Single source of truth for both, so they can never drift (blueprint §4).

**Test files:**
- `lib/work-orders.wo05002.test.ts` — 24 tests covering AC-05-004.1: mixed-set done/total/pct, empty-list guard, pure-function contract, shape invariants, cross-FRD aggregation.
- `lib/work-orders.adversarial.test.ts` — pre-existing 5 `aggregateProgress` adversarial tests (focus area A) covering division-by-zero, done-only counting, 1-decimal precision (33.3, 66.7, 100, 0).
- `lib/work-orders.test.ts` — 73 integration tests for the full `lib/work-orders.ts` module (WO-05-001 scope).

**verify.sh:** 3499 tests pass, 2 expected fail, 5 skipped; biome clean; tsc clean.
