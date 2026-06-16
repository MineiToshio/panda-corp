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
- [ ] Component tests written first and green.
- [ ] Server Components (no client state in the board itself).
- [ ] Tokens only; `data-testid` on columns and cards; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.
