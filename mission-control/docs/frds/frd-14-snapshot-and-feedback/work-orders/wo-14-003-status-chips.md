---
id: WO-14-003
type: work-order
slug: status-chips
title: 'WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips'
status: DRAFT
parent: FRD-14
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips

**Feature:** FRD-14 · **Implements:** CMP-14-status-chips · **REQ-14-004, REQ-14-005**
**Deploy unit:** `app/portfolio/_components/status-chips.tsx` (shared, also usable in the workspace) + colocated tests.

## Acceptance criteria (copied)
- **AC-14-004.1** EACH portfolio rail row SHALL show an amber chip with `pending_decisions` when `> 0`.
- **AC-14-004.2** EACH portfolio rail row SHALL show a red chip with `pending_bugs` when `> 0`.
- **AC-14-005.1** WHEN `rethink_pending: true`, the row/workspace SHALL show a "rethink pending — build will pause" indicator.

## Scope
- `CMP-14-status-chips` (Server): given a `ProjectStatus`, render:
  - amber chip with `pending_decisions` when `> 0` (AC-14-004.1),
  - red chip with `pending_bugs` when `> 0` (AC-14-004.2),
  - a "rethink pending" indicator when `rethink_pending === true` (AC-14-005.1).
  Mirrors prototype rail `dchip`/`bchip`. Renders nothing when all are zero/false (no empty chips).
- Mounted on the FRD-03 portfolio rail rows; reusable in the FRD-04 workspace header.
- **Out of scope:** the rail layout (FRD-03), the snapshot panel (WO-14-002).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-03 rail (mounts the chips); FRD-01 `lib/status.ts` fields.

## TDD (RED → GREEN → refactor)
Component tests:
1. `pending_decisions > 0` → amber chip with the number (AC-14-004.1).
2. `pending_bugs > 0` → red chip with the number (AC-14-004.2).
3. `rethink_pending: true` → "rethink pending" indicator (AC-14-005.1).
4. All zero/false → nothing rendered (no empty chips).
5. Chips carry number + `aria-label`/label (not color alone) — a11y.

## Definition of done
- [ ] Component tests written first and green.
- [ ] Server Component; tokens only; `tabular-nums` on counts; `data-testid` on each chip; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.
