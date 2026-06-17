---
id: WO-05-004
type: work-order
slug: frd-filter
title: WO-05-004 — Group/filter by FRD
status: DRAFT
parent: FRD-05
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-05-004 — Group/filter by FRD

**Feature:** FRD-05 · **Implements:** CMP-05-frd-filter · **REQ-05-002**
**Deploy unit:** `app/projects/[slug]/_components/wo-frd-filter.tsx` + colocated tests.

## Acceptance criteria (copied)
- **AC-05-002.2** The kanban SHALL allow grouping/filtering by FRD (the natural grouping).

## Scope
- `CMP-05-frd-filter` (Client, `"use client"`): a control listing the distinct FRDs present in the
  project's work orders; selecting one filters the kanban to that FRD (URL search param so the
  Server board re-renders filtered, or client-side filter of the passed `WorkOrder[]`).
- "All" option resets the filter.
- **Out of scope:** the board rendering (WO-05-003) — this only narrows the set.

## Dependencies
- **Intra:** WO-05-003 (board), WO-05-001 (`WorkOrder.frd` field).
- **Cross:** none.

## TDD (RED → GREEN → refactor)
Component tests:
1. Lists the distinct FRDs present in the work orders (AC-05-002.2).
2. Selecting an FRD narrows the visible cards to that FRD.
3. "All" restores the full set.

## Definition of done
- [x] Component tests written first and green.
- [x] `"use client"` only for the filter control.
- [x] Tokens only; `data-testid` on the filter; Spanish copy via i18n.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What it built:**
`CMP-05-frd-filter` delivered as two files:
- `app/projects/[slug]/_components/wo-frd-filter.tsx` — controlled pill-bar filter (pre-existing from WO-05-001 UI delivery): props `frds`, `selected`, `onSelect`; aria-pressed on each button; Spanish copy ("Todos" / per-FRD slug); zero hardcoded colors; `data-testid="wo-frd-filter"`, `"wo-frd-filter-all"`, `"wo-frd-filter-option"`.
- `app/projects/[slug]/_components/wo-frd-filtered-board.tsx` (NEW, `"use client"`): stateful wrapper `WoFrdFilteredBoard` that owns `selectedFrd: string | null` state, derives `distinctFrds()` from `orders`, computes `visibleOrders` by filtering on `frd`, and renders `<WoFrdFilter>` + `<WorkOrderBoard>` together. This is the integration layer that makes filtering actually narrow the kanban cards.

**Interfaces/contracts exposed:**
```tsx
// app/projects/[slug]/_components/wo-frd-filtered-board.tsx
export interface WoFrdFilteredBoardProps { orders: WorkOrder[]; }
export function WoFrdFilteredBoard(props: WoFrdFilteredBoardProps): React.JSX.Element

// app/projects/[slug]/_components/wo-frd-filter.tsx (pre-existing)
export interface WoFrdFilterProps {
  frds: string[];
  selected: string | null;
  onSelect: (frd: string | null) => void;
}
export function WoFrdFilter(props: WoFrdFilterProps): React.JSX.Element
```

**Integration seams:**
- `WoFrdFilteredBoard` is consumed by `TabWorkOrders` (WO-05-006, `tab-work-orders.tsx`) when `orders.length > 0`.
- `page.tsx` renders `<TabWorkOrders orders={orders} />` for the work-orders tab; filtering is fully encapsulated inside `WoFrdFilteredBoard`.
- `data-testid="wo-frd-filtered-board"` on the wrapper root; `"wo-frd-filter"`, `"wo-frd-filter-all"`, `"wo-frd-filter-option"` on the filter bar; board and card testids unchanged from WO-05-003.

**Test files:**
- `app/projects/[slug]/_components/wo-frd-filter.test.tsx` — 10 tests covering the controlled filter component (pre-existing, all GREEN).
- `app/projects/[slug]/_components/wo-frd-filtered-board.test.tsx` (NEW) — 16 integration tests RED→GREEN covering all 3 TDD requirements: (1) lists distinct FRDs, (2) selecting an FRD narrows visible cards, (3) "All" restores the full set.

**verify.sh:** GREEN — 136 test files, 3736 tests passed, biome clean, tsc clean.
