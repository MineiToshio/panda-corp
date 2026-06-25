# FRD-05 — Work orders

Implementation chunks for the **live work-orders kanban**, each testable in isolation.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Implements | State | Depends on |
|---|---|---|---|---|
| [WO-05-001](./wo-05-001-work-orders-reader.md) | `lib/work-orders.ts` — discover + parse work orders | lib (TDD) | IF-05-work-orders | VERIFIED | WO-01-000 |
| [WO-05-002](./wo-05-002-aggregate-progress.md) | `lib/work-orders.ts` — `aggregateProgress` | lib (TDD) | IF-05-work-orders | VERIFIED | WO-05-001 |
| [WO-05-003](./wo-05-003-wo-board-tab.md) | Work-orders tab: live kanban board + detail (re-paint) | UI (Phase 2) | CMP-05-board/column/card/frd-filter/detail/progress/empty | VERIFIED | WO-05-001, WO-05-002, WO-04-001, WO-04-004, WO-01-009, WO-13-006, WO-13-007, WO-13-008, WO-13-001, WO-13-002, WO-13-003 |

## Phase 2 re-plan (presentational)

The `lib/work-orders.ts` layer (WO-05-001/002) is **VERIFIED and untouched** — the gap was purely
presentational. The former UI work orders (the old WO-05-003 board, WO-05-004 filter, WO-05-005 detail,
WO-05-006 progress+empty) are **collapsed into one coarse WO** (WO-05-003) that re-paints the whole
**Work orders** tab to the owner-approved prototype `projWO()`, built on the FRD-13 foundation primitives
and **live off `useLiveSnapshot`** (WO-01-009, event-driven, not polling).

## Order & parallelization

- WO-05-001/002 (the reader + aggregation) are already VERIFIED — never rebuilt.
- **WO-05-003** is the single coarse UI work order: it consumes the VERIFIED lib + the FRD-13 foundation
  + the FRD-04 Tabbar slot + the FRD-01 live snapshot. It is **disjoint** from FRD-06 (`_party`) and
  FRD-12 (`_observability`) — those three subfolders never collide, so the three tabs re-paint in parallel.
- The board is **mounted** into the FRD-04 workspace Work orders tab — that slot is reserved by
  `CMP-04-workspace` (FRD-04 WO-04-004).

## Cross-feature dependencies

- **FRD-01** (`lib/config.ts`, `lib/status.ts`).
- **FRD-04** (`lib/docs.ts` `readDoc` for the full-document tab; `CMP-04-workspace` mounts the board).
- **Producer contract:** the per-WO state marker written by `/pandacorp:implement` (factory plugin) —
  WO-05-001 fixtures must match it (see blueprint §5 flag).
