---
id: WO-05-004
type: work-order
slug: frd-filter
title: WO-05-004 — Group/filter by FRD
status: DRAFT
parent: FRD-05
implementation_status: PLANNED
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
- [ ] Component tests written first and green.
- [ ] `"use client"` only for the filter control.
- [ ] Tokens only; `data-testid` on the filter; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.
