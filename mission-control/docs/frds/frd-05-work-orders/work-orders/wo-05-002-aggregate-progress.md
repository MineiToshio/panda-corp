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
