# FRD-05 — Work orders

Implementation chunks for the **live work-orders kanban**, each testable in isolation.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Implements |
|---|---|---|---|
| [WO-05-001](./wo-05-001-work-orders-reader.md) | `lib/work-orders.ts` — discover + parse work orders | lib (TDD) | IF-05-work-orders |
| [WO-05-002](./wo-05-002-aggregate-progress.md) | `lib/work-orders.ts` — `aggregateProgress` | lib (TDD) | IF-05-work-orders |
| [WO-05-003](./wo-05-003-kanban-board.md) | Kanban board: 4 columns + cards + FRD chip | component | CMP-05-board/column/card |
| [WO-05-004](./wo-05-004-frd-filter.md) | Group/filter by FRD | component | CMP-05-frd-filter |
| [WO-05-005](./wo-05-005-wo-detail.md) | Work order detail: Summary + Full document tabs | component | CMP-05-detail |
| [WO-05-006](./wo-05-006-progress-and-empty.md) | Aggregated progress display + empty state | component | CMP-05-progress, CMP-05-empty |

## Order & parallelization

- **First:** WO-05-001 (the reader) — everything downstream depends on it.
- **Then (parallel):** WO-05-002 (pure aggregation over `WorkOrder[]`) can run right after the
  `WorkOrder` type lands in WO-05-001.
- **Then (parallel after the reader):** WO-05-003 (board), WO-05-005 (detail, also needs FRD-04
  `readDoc`), WO-05-006 (progress + empty).
- **Last:** WO-05-004 (FRD filter) layers onto the board (WO-05-003).
- The board is **mounted** into the FRD-04 workspace Work orders tab — that slot is reserved by
  `CMP-04-workspace` (FRD-04 WO-04-004).

## Cross-feature dependencies

- **FRD-01** (`lib/config.ts`, `lib/status.ts`).
- **FRD-04** (`lib/docs.ts` `readDoc` for the full-document tab; `CMP-04-workspace` mounts the board).
- **Producer contract:** the per-WO state marker written by `/pandacorp:implement` (factory plugin) —
  WO-05-001 fixtures must match it (see blueprint §5 flag).
