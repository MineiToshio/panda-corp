---
id: WO-05-005
type: work-order
slug: wo-detail
title: 'WO-05-005 — Work order detail: Summary + Full document tabs'
status: DRAFT
parent: FRD-05
implementation_status: IN_REVIEW
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
- [x] Component tests written first and green.
- [x] Only the tab bar is `"use client"`; body renders server-side.
- [x] `react-markdown` for the full doc; tokens only; `data-testid` on the tabs; Spanish copy via i18n.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What was built:** End-to-end work order detail flow (CMP-05-detail) wired into the workspace.

**Components delivered:**

- `app/projects/[slug]/_components/wo-detail.tsx` — `WorkOrderDetail` component (already existed with 24 passing tests). Client component ("use client") for tab-bar interaction. Two panes: Summary (title, FRD chip, state badge with icon+label, summary text, relPath) and Full document (react-markdown render of raw WO content). Back affordance to `?tab=work-orders`. All CSS via custom properties, zero hardcoded colors.

- `app/projects/[slug]/_components/wo-board.tsx` — Added `data-testid="wo-card-link"` anchor wrapping each `WoCard`, `href="?tab=work-orders&wo=<id>"`. Each card is now a navigable link that opens the detail view (AC-05-003.1).

- `app/projects/[slug]/page.tsx` — Added `?wo=<id>` and `?wotab=<summary|full>` URL param handling in the `work-orders` branch. When `?wo=<id>` matches a known order, renders `WorkOrderDetail` instead of `TabWorkOrders`; unknown id falls back gracefully to the board.

- `lib/work-orders.ts` — Added `readWorkOrderDoc(projectPath, relPath): string | null`. Security: validates relPath against `WO_REL_PATH_PATTERN` (`docs/frds/frd-NN-*/work-orders/wo-*.md`) plus traversal guard; read-only, fail-soft. Separate from `lib/docs.ts readDoc` (which only surfaces FRD/blueprint docs, not work-order files).

**Interfaces/contracts exposed:**

```ts
// lib/work-orders.ts
export function readWorkOrderDoc(projectPath: string, relPath: string): string | null;

// app/projects/[slug]/_components/wo-detail.tsx (already existed)
export type WoDetailTab = "summary" | "full";
export interface WorkOrderDetailProps {
  order: WorkOrder;
  content: string | null;
  activeWoTab: WoDetailTab;
}
export function WorkOrderDetail(props: WorkOrderDetailProps): React.JSX.Element;
```

**URL contract (page.tsx):**
- `?tab=work-orders` — board (TabWorkOrders)
- `?tab=work-orders&wo=<id>` — detail, summary pane
- `?tab=work-orders&wo=<id>&wotab=full` — detail, full-document pane
- `?tab=work-orders&wo=<unknown-id>` — falls back to board (graceful)

**Test files:**
- `app/projects/[slug]/_components/wo-detail.test.tsx` — 24 component tests (AC-05-003.1/.2, back affordance, design tokens, data-testid completeness).
- `app/projects/[slug]/_components/wo-detail.integration.test.tsx` — 15 integration tests (card click targets, page routing, full-doc rendering, back link, unknown-id fallback).

**Gate:** 136 test files, 3736 tests green (+ 2 expected-fail + 5 skipped), tsc clean, biome clean. Commit `0ba8be8`.
