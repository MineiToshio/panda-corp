# WO-05-001 — `lib/work-orders.ts`: discover + parse work orders

**Feature:** FRD-05 · **Implements:** IF-05-work-orders (`listWorkOrders`, `WorkOrder`, `WorkOrderState`) · **REQ-05-002, REQ-05-005**
**Deploy unit:** `lib/work-orders.ts` (+ `lib/work-orders.test.ts`). Library only, no UI.

## Acceptance criteria (copied)
- **AC-05-002.1** EACH card SHALL show its FRD via a chip (the source feature `frd-NN-<slug>`).
- **AC-05-005.1** The kanban SHALL be read-only — state comes from the files written by the agents.

> This WO covers the **reader** that surfaces the FRD per work order and its state. The chip/UI is WO-05-003.

## Scope
- `listWorkOrders(projectPath): WorkOrder[]` — discover across **all** features:
  `docs/frds/frd-*/work-orders/wo-*.md`. For each: `id`, `title`, `frd` (the parent feature slug),
  `relPath`, `state` and optional `summary`.
- Derive `WorkOrderState` (`todo | in_progress | review | done | fail`) from the producer's on-disk
  marker (see blueprint §5 flag — align the fixtures to the actual `/pandacorp:implement` convention).
- Partial-tolerant: an unparseable WO defaults to `todo`; absent `work-orders/` → `[]`. Never throws.
- Read-only (no `fs.write*`).
- **Out of scope:** aggregation (WO-05-002), rendering (WO-05-003+), full-document read (uses FRD-04 `readDoc`).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-01 `lib/config.ts`. Producer marker convention (factory plugin) — confirm before GREEN.

## TDD (RED → GREEN → refactor)
`lib/work-orders.test.ts` against a fixture project with several `docs/frds/frd-*/work-orders/`:
1. Discovers work orders across multiple features, each tagged with its `frd` (AC-05-002.1).
2. Maps the on-disk marker to the right `WorkOrderState` for each state including `fail`.
3. Unparseable WO → `todo`, no throw (AC-05-005.1 robustness).
4. Absent `work-orders/` → `[]`.

## Definition of done
- [ ] Tests written first and green for all cases.
- [ ] No `any`/`@ts-ignore`; read-only.
- [ ] `bash .pandacorp/verify.sh` passes.
