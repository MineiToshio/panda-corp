---
id: WO-05-005
type: work-order
slug: wo-detail
title: 'WO-05-005 — Work order detail: Summary + Full document tabs'
status: DRAFT
parent: FRD-05
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-16'
---
# WO-05-005 — Work order detail: Summary + Full document tabs

**Feature:** FRD-05 · **Implements:** CMP-05-detail · **REQ-05-003**
**Deploy unit:** `app/projects/[slug]/_components/wo-detail.tsx` + colocated tests.

## Acceptance criteria (copied)
- **AC-05-003.1** WHEN a work order is clicked, a detail view SHALL open with a **Summary** tab and a **Full document** tab.
- **AC-05-003.2** The Full document tab SHALL render the entire work order markdown (acceptance criteria, scope, definition of done, evidence).

## Scope
- `CMP-05-detail` (Server, with a small client tab holder): opened from a card click (board exposes
  the click target in WO-05-003). Two tabs:
  - **Summary**: title, FRD chip, state, the `WorkOrder.summary`.
  - **Full document**: render the entire `wo-*.md` via `readDoc(projectPath, relPath)` (FRD-04)
    + `react-markdown`.
- Back affordance to the board.
- **Out of scope:** the doc reader (FRD-04 `readDoc`), the board (WO-05-003).

## Dependencies
- **Intra:** WO-05-001 (`WorkOrder.relPath`), WO-05-003 (card click target).
- **Cross:** FRD-04 `lib/docs.ts` `readDoc`; stack `react-markdown`.

## TDD (RED → GREEN → refactor)
Component tests:
1. Opening a work order shows a Summary tab + a Full document tab (AC-05-003.1).
2. Summary tab shows title/FRD/state/summary.
3. Full document tab renders the complete markdown from a fixture `wo-*.md` (AC-05-003.2).
4. Back returns to the board.

## Definition of done
- [ ] Component tests written first and green.
- [ ] Only the tab bar is `"use client"`; body renders server-side.
- [ ] `react-markdown` for the full doc; tokens only; `data-testid` on the tabs; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.
