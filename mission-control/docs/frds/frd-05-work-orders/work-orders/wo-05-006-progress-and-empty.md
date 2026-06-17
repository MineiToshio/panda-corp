---
id: WO-05-006
type: work-order
slug: progress-and-empty
title: WO-05-006 — Aggregated progress display + empty state
status: DRAFT
parent: FRD-05
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-05-006 — Aggregated progress display + empty state

**Feature:** FRD-05 · **Implements:** CMP-05-progress, CMP-05-empty · **REQ-05-004, REQ-05-006**
**Deploy unit:** `app/projects/[slug]/_components/wo-progress.tsx` + `wo-empty.tsx` + colocated tests.

## Acceptance criteria (copied)
- **AC-05-004.1** The view SHALL show aggregated progress `done / total` and `%`, summing every feature's `work-orders/`.
- **AC-05-006.1** WHEN a project has no work orders, the view SHALL show a message that they are generated in `/pandacorp:blueprint`.

## Scope
- `CMP-05-progress` (Server): render `done / total · %` from `aggregateProgress` (WO-05-002),
  `tabular-nums`. Shares the numbers with the FRD-04 Mission Objectives bar.
- `CMP-05-empty` (Server): when `listWorkOrders` returns `[]`, show "Work orders are generated in
  `/pandacorp:blueprint`" (mirrors prototype empty message), with a copy button for the command.
- **Out of scope:** discovery/aggregation (WO-05-001/002), the board (WO-05-003).

## Dependencies
- **Intra:** WO-05-001 (`listWorkOrders`), WO-05-002 (`aggregateProgress`).
- **Cross:** shared `CopyButton`.

## TDD (RED → GREEN → refactor)
Component tests:
1. Progress shows `2 / 7 · 29%` for that set (AC-05-004.1).
2. `total === 0` renders the empty state instead of a zeroed bar (AC-05-006.1).
3. Empty state message references `/pandacorp:blueprint` with a copy button.

## Definition of done
- [x] Component tests written first and green.
- [x] Server Components; reuse shared `CopyButton`.
- [x] `tabular-nums`; tokens only; Spanish copy via i18n.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-05-progress` (`WorkOrderProgressBar`), `CMP-05-empty` (`WorkOrderEmpty`), and the
coordinator `TabWorkOrders` that wires both together.

**What was already in place (WO-05-001):** `wo-progress.tsx` and `wo-empty.tsx` already existed
with their own tests (14 tests covering AC-05-004.1 and AC-05-006.1 at the component level).

**New work this WO:**
- `tab-work-orders.tsx` — Server Component coordinator (`TabWorkOrders`):
  - `orders.length === 0` → renders `WorkOrderEmpty` (AC-05-006.1, TDD case 2)
  - `orders.length > 0` → renders `WorkOrderProgressBar` (from `aggregateProgress`) + `WoFrdFilteredBoard`
    (TDD cases 1 and 3 satisfied through the coordinator)
- `tab-work-orders.test.tsx` — 13 tests (RED → GREEN) covering all 3 WO TDD cases:
  1. `2/7 · 28.6%` progress renders correctly (AC-05-004.1)
  2. `total === 0` shows empty state, NOT a zeroed bar (AC-05-006.1)
  3. Empty state references `/pandacorp:blueprint` with a copy button
- `page.tsx` updated: `work-orders` tab now mounts `TabWorkOrders` instead of bare `WoFrdFilteredBoard`.

**Interfaces/contracts exposed:**
```ts
// app/projects/[slug]/_components/tab-work-orders.tsx
export interface TabWorkOrdersProps { orders: WorkOrder[]; }
export function TabWorkOrders({ orders }: TabWorkOrdersProps): React.JSX.Element;
// Renders: <WorkOrderEmpty /> when orders.length === 0
//          <WorkOrderProgressBar progress={aggregateProgress(orders)} /> + <WoFrdFilteredBoard orders={orders} /> otherwise
```

**Integration seam:** `page.tsx` mounts `<TabWorkOrders orders={listWorkOrders(projectPath)} />`
in the `work-orders` tab branch (with WO-05-005 `WorkOrderDetail` routing layered above it).

**Test files:**
- `app/projects/[slug]/_components/tab-work-orders.test.tsx` — 13 tests (this WO)
- `app/projects/[slug]/_components/wo-progress.test.tsx` — 9 tests (CMP-05-progress, pre-existing)
- `app/projects/[slug]/_components/wo-empty.test.tsx` — 5 tests (CMP-05-empty, pre-existing)

**verify.sh:** 136 test files, 3736 tests GREEN + 2 expected fail + 5 skipped; biome clean; tsc clean.
