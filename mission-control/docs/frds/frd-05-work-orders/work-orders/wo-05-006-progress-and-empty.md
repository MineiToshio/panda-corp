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
- [ ] Component tests written first and green.
- [ ] Server Components; reuse shared `CopyButton`.
- [ ] `tabular-nums`; tokens only; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.
