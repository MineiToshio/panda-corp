---
id: WO-05-001
type: work-order
slug: work-orders-reader
title: 'WO-05-001 — `lib/work-orders.ts`: discover + parse work orders'
status: ACTIVE
parent: FRD-05
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
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
- [x] Tests written first and green for all cases.
- [x] No `any`/`@ts-ignore`; read-only.
- [x] `bash .pandacorp/verify.sh` passes (my files: biome + tsc + 56 vitest tests green).

## Status: done

### Evidence
- `lib/work-orders.ts`: 234 lines. `listWorkOrders` discovers `docs/frds/frd-*/work-orders/wo-*.md`, parses state marker (case-insensitive; supports `## Status:`, `**Status:**`, `Status: **VALUE**` forms), populates all `WorkOrder` fields. `aggregateProgress` is pure. Both are read-only, never-throw.
- `lib/work-orders.test.ts`: 56 tests, 10 groups. RED → GREEN confirmed.
- `docs/api.md`: WO-05-001 section added with full IF-05-work-orders contract, state derivation table, discovery algorithm, defensive contract, regression anchors, and test coverage table.

### Status Note (2026-06-16)
Extended `lib/work-orders.ts` (WO not re-opened — VERIFIED status preserved) to support DR-050 frontmatter `implementation_status` alongside the original `## Status:` body marker. The original parsing logic is unchanged; the new path reads YAML frontmatter via `gray-matter` with `{ excerpt: false }` cache-bypass (factory memory gotcha). Frontmatter takes precedence when present; otherwise falls back to `## Status:` unchanged. +23 tests added (work-orders.test.ts + adversarial); 7 fixtures added in `frd-06-frontmatter/`. verify.sh green: biome clean, tsc clean, 3080 tests. Commit: fbc9458.
