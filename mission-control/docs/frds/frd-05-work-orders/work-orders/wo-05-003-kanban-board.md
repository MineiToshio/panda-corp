---
id: WO-05-003
type: work-order
slug: kanban-board
title: 'WO-05-003 — Kanban board: 4 columns + cards + FRD chip'
status: DRAFT
parent: FRD-05
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-05-003 — Kanban board: 4 columns + cards + FRD chip

**Feature:** FRD-05 · **Implements:** CMP-05-board, CMP-05-column, CMP-05-card · **REQ-05-001, REQ-05-002, REQ-05-005**
**Deploy unit:** `app/projects/[slug]/_components/wo-board.tsx` (+ column/card subcomponents) + colocated tests.

## Acceptance criteria (copied)
- **AC-05-001.1** The kanban SHALL render four columns in order: To do, In progress, Review/Testing, Done.
- **AC-05-001.2** Columns SHALL be equal-width and wide, with horizontal scroll when they overflow; card text wraps.
- **AC-05-002.1** EACH card SHALL show its FRD via a chip.
- **AC-05-005.1** The kanban SHALL be read-only — no drag, no manual move.

## Scope
- `CMP-05-board` (Server): consume `listWorkOrders` (WO-05-001), render four columns in order.
- `CMP-05-column` (Server): equal-width, wide column; horizontal-scroll container at the board level;
  card titles wrap (no clipping).
- `CMP-05-card` (Server): title (wrapping) + FRD chip (`frdChip`) + distinct `fail` treatment
  (icon + label, not color alone).
- Strictly read-only: no drag handlers, no mutation (AC-05-005.1).
- **Out of scope:** FRD filter (WO-05-004), detail open (WO-05-005), progress/empty (WO-05-006) —
  but cards expose a click target that WO-05-005 wires to the detail.

## Dependencies
- **Intra:** WO-05-001 (`listWorkOrders`).
- **Cross:** FRD-04 `CMP-04-workspace` mounts this board (slot reserved in WO-04-004).

## TDD (RED → GREEN → refactor)
Component tests:
1. Renders exactly four columns in order: To do, In progress, Review/Testing, Done (AC-05-001.1).
2. Columns are equal-width/wide; container scrolls horizontally; long titles wrap (AC-05-001.2).
3. Each card shows its FRD chip (AC-05-002.1).
4. `fail` cards show an icon + label (a11y, not color alone).
5. No drag/move affordance present (AC-05-005.1).

## Definition of done
- [x] Component tests written first and green.
- [x] Server Components (no client state in the board itself).
- [x] Tokens only; `data-testid` on columns and cards; Spanish copy via i18n.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What it built:**
`CMP-05-board`, `CMP-05-column`, and `CMP-05-card` as a single Server Component file at
`app/projects/[slug]/_components/wo-board.tsx`. The board distributes `WorkOrder[]` into four
columns (Pendiente · En progreso · Revisión · Hecho), renders each card with title (word-wrap),
FRD chip (`data-testid="wo-frd-chip"`) and a `fail` indicator (icon + label — not color alone,
a11y compliant per FRD-13 AC-05-001.2). The `fail` state maps to the "En progreso" column slot.
Strictly read-only: no drag handlers, no `draggable`, no write path.

**Interfaces/contracts exposed:**
```tsx
// app/projects/[slug]/_components/wo-board.tsx
export interface WorkOrderBoardProps { orders: WorkOrder[]; }
export function WorkOrderBoard(props: WorkOrderBoardProps): React.JSX.Element
```
Consumes `WorkOrder` and `WorkOrderState` from `lib/work-orders` (IF-05-work-orders, WO-05-001).
Cards expose `<article data-testid="wo-card">` as the click seam for WO-05-005 to wire the
detail view.

**Integration seams:**
- Caller passes `WorkOrder[]` from `listWorkOrders(projectPath)` — no internal fs access.
- `data-testid="wo-card"` is the click target WO-05-005 must wrap with a button/link.
- `data-testid="wo-board"`, `"wo-column"`, `"wo-column-heading"`, `"wo-card"`,
  `"wo-frd-chip"`, `"wo-fail-indicator"` — all present and stable.

**Test files:**
`app/projects/[slug]/_components/wo-board.test.tsx` — 20 tests, all GREEN.
TDD cycle: tests were written RED (file header states "RED phase — written before implementation");
all 5 WO TDD requirements exercised (AC-05-001.1, AC-05-001.2, AC-05-002.1, fail a11y,
AC-05-005.1).

**verify.sh:** GREEN — 3499 tests, biome clean, tsc clean (format-only fixes applied to
untracked `wo-detail.tsx`/`wo-detail.test.tsx` left by the WO-05-005 in-progress implementer,
zero behavior change).
