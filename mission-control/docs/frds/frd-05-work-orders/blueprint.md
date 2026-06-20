---
id: FRD-05-blueprint
type: blueprint
parent: FRD-05
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-17'
---
# FRD-05 — Work orders (live view) · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049). References the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) rather than restating it.
> Visual reference: `prototype/index.html` (`projWO`, `woFullDoc`, `frdChip`, `woProgress`).

## 0. Scope & traceability note

The FRD's acceptance criteria are bare EARS bullets; this blueprint assigns the canonical IDs
(`REQ-05-MMM` → `AC-05-MMM.K`) the work orders trace to (1:1 with the EARS bullets in source order).

FRD-05 implements the **read-only kanban of work orders** and its detail view. It is **mounted as
the "Work orders" tab** of the FRD-04 workspace (`CMP-04-workspace` reserves the slot). FRD-05 owns
`lib/work-orders.ts` and consumes `lib/docs.ts` (FRD-04) for rendering each work order's full
document.

## 1. Requirements (derived IDs)

| REQ | EARS (from `frd.md`) |
|---|---|
| REQ-05-001 | The kanban SHALL show columns **To do · In progress · Review/Testing · Done**, all the same width and wide, with horizontal scroll when they don't fit; text wraps onto several lines. |
| REQ-05-002 | EACH work order card SHALL indicate which **FRD** it belongs to; the kanban MAY group/filter cards by FRD (work orders live per feature under `docs/frds/frd-NN-<slug>/work-orders/`). |
| REQ-05-003 | WHEN the owner clicks a work order, it SHALL show a **Summary** tab and a **Full document** tab rendering the entire work order. |
| REQ-05-004 | It SHALL show the project's progress (work orders done / total and %), aggregated across every feature's `work-orders/`. |
| REQ-05-005 | The kanban SHALL reflect the live state (written by the agents per feature); the owner does NOT edit it. |
| REQ-05-006 | (Edge) Project with no work orders yet → message indicating they are generated in `/pandacorp:blueprint`. |

### Acceptance criteria (EARS, expanded)

- **AC-05-001.1** The kanban SHALL render four columns in order: To do, In progress, Review/Testing, Done.
- **AC-05-001.2** Columns SHALL be equal-width and wide, with horizontal scroll when they overflow; card text wraps (no truncation that hides content).
- **AC-05-002.1** EACH card SHALL show its FRD via a chip (the source feature `frd-NN-<slug>`).
- **AC-05-002.2** The kanban SHALL allow grouping/filtering by FRD (the natural grouping).
- **AC-05-003.1** WHEN a work order is clicked, a detail view SHALL open with a **Summary** tab and a **Full document** tab.
- **AC-05-003.2** The Full document tab SHALL render the entire work order markdown (acceptance criteria, scope, definition of done, evidence).
- **AC-05-004.1** The view SHALL show aggregated progress `done / total` and `%`, summing every feature's `work-orders/`.
- **AC-05-005.1** The kanban SHALL be read-only — no drag, no manual move; state comes from the files written by the agents.
- **AC-05-006.1** WHEN a project has no work orders, the view SHALL show a message that they are generated in `/pandacorp:blueprint`.

## 2. Interfaces (`lib/**`)

FRD-05 **owns** `lib/work-orders.ts` ([architecture §6](../../product/architecture.md#6-read-interfaces-lib--the-data-layer-boundary))
and **consumes** `lib/docs.ts` (FRD-04, `readDoc`) for the full-document tab.

### IF-05-work-orders — `lib/work-orders.ts` (NEW, owned here)

```ts
export type WorkOrderState = "todo" | "in_progress" | "review" | "done" | "fail";
export interface WorkOrder {
  id: string;          // "WO-05-003"
  title: string;
  frd: string;         // "frd-05-work-orders" — the source feature
  state: WorkOrderState;
  relPath: string;     // path to the wo markdown, for readDoc()
  summary?: string;    // short description for the Summary tab
}
export interface WorkOrderProgress { done: number; total: number; pct: number; }

// Discovers work orders across ALL features: docs/frds/frd-*/work-orders/wo-*.md
export function listWorkOrders(projectPath: string): WorkOrder[];        // [] when none
export function aggregateProgress(orders: WorkOrder[]): WorkOrderProgress; // pure
```

**State derivation.** The live state is written by the build agents per feature. The reader derives
`WorkOrderState` from the agreed marker the agents write (status frontmatter / checkbox / column
file convention used by `/pandacorp:implement`). The reader is **partial-tolerant**: an unparseable
work order defaults to `todo` and never breaks the aggregation. The producer convention is owned by
the factory plugin; MC reads it defensively (read-only, architecture §7).

> **Note for the report:** the exact on-disk state marker that `/pandacorp:implement` writes into
> each `wo-*.md` is a producer contract. This blueprint assumes a parseable state field; if the
> plugin's WO state lives elsewhere (e.g. `.pandacorp/status.yaml` per-WO list), the reader adapts
> there. Flagged below in §5.

## 3. Components (`CMP-05-*`) and app surface

App surface (architecture §11): rendered inside the FRD-04 workspace **Work orders** tab — no new
route; `CMP-04-workspace` mounts `CMP-05-board`.

| Component | Kind | Responsibility | Implements |
|---|---|---|---|
| `CMP-05-board` | Server | Loads work orders (`listWorkOrders`), renders the 4-column kanban + progress + FRD grouping/filter. | REQ-05-001, REQ-05-002, REQ-05-004, REQ-05-005 |
| `CMP-05-column` | Server | One equal-width, wide column with wrapping cards + horizontal-scroll container. | REQ-05-001 |
| `CMP-05-card` | Server | One work order card: title (wrapping) + FRD chip + fail treatment. | REQ-05-002 |
| `CMP-05-frd-filter` | Client | Group/filter the kanban by FRD. | REQ-05-002 |
| `CMP-05-detail` | Server | Work order detail with Summary / Full document tabs. | REQ-05-003 |
| `CMP-05-progress` | Server | Aggregated done/total/% (shares the prototype `woProgress` shape; the workspace header bar reuses these numbers). | REQ-05-004 |
| `CMP-05-empty` | Server | "Work orders are generated in `/pandacorp:blueprint`" empty state. | REQ-05-006 |
| `IF-05-work-orders` | lib | `lib/work-orders.ts` readers above. | all |

## 4. Cross-cutting

- **Read-only / no manual move** (AC-05-005.1): the kanban is purely a renderer of file state; there
  is no drag handler, no write path (architecture §7).
- **Progress consistency**: `aggregateProgress` is the single source for the kanban progress and is
  reused by the FRD-04 Mission Objectives bar — both read the same `WorkOrder[]` so they never drift.
- **Partial tolerance**: missing/malformed work orders never break the board (architecture §7).
- **Tokens & a11y** (FRD-13): equal-width wide columns, `tabular-nums` on counts, fail state shown
  with icon + label (not color alone), tabs are `role=tablist` in the detail.
- **Server-first**: only the FRD filter (`CMP-05-frd-filter`) and the detail tab bar are `"use client"`.

## 5. Traceability matrix & flags

| REQ | AC | Component(s) | Interface(s) |
|---|---|---|---|
| REQ-05-001 | AC-05-001.1/.2 | CMP-05-board, CMP-05-column | IF-05-work-orders |
| REQ-05-002 | AC-05-002.1/.2 | CMP-05-card, CMP-05-frd-filter | IF-05-work-orders |
| REQ-05-003 | AC-05-003.1/.2 | CMP-05-detail | IF-05-work-orders, IF-04-docs (`readDoc`) |
| REQ-05-004 | AC-05-004.1 | CMP-05-progress | IF-05-work-orders (`aggregateProgress`) |
| REQ-05-005 | AC-05-005.1 | CMP-05-board (no write path) | IF-05-work-orders |
| REQ-05-006 | AC-05-006.1 | CMP-05-empty | IF-05-work-orders |

**Flag (producer contract):** the exact on-disk **state marker** of each work order (how
`/pandacorp:implement` records `todo/in_progress/review/done/fail`) is owned by the factory plugin
and is not yet pinned in a committed MC doc. `IF-05-work-orders` assumes a parseable per-WO state and
is partial-tolerant; the reader's WO-05-001 fixtures must be aligned with the actual producer
convention before GREEN. No requirement is unbuildable — only the marker location needs confirming.

## Build Plan (Phase 2)

Phase 2 re-implements the **Work orders** tab presentation to match the approved prototype. The data
layer is done: **WO-05-001 and WO-05-002 are VERIFIED** (`lib/work-orders.ts` — discovery, parse,
`aggregateProgress`, `readWorkOrderDoc`) and are **not** re-planned; the coarse UI work order consumes
them.

**Coarse DAG:**

```
WO-05-001 (lib, VERIFIED) ─┐
WO-05-002 (lib, VERIFIED) ─┼─▶ WO-05-003  (Work-orders tab: board + card + frd-filter + detail + progress + empty)
foundation + live ────────┘
```

- **WO-05-003** — single coarse presentational WO. Re-paints `WoBoard`/`KanbanColumn`,
  `WorkOrderCard` (`.card` + `fail` danger **variant**, not a 2nd card), `WoFrdFilter`/
  `WoFrdFilteredBoard`, `WoDetail` (Resumen / Documento completo via `Tabs` + `DocView`), `WoProgress`
  and `WoEmpty`, faithful to `projWO()`. **Real-time**: consumes `useLiveSnapshot` (WO-01-009) for its
  work-orders slice — event-driven, not polling.

**Parallelism.** WO-05-003 has no intra-FRD UI sibling — it is one unit. Across FRDs it is
**disjoint** from FRD-06 (`_party/**`) and FRD-12 (`_observability/**`): its artifacts live only under
`src/app/projects/[slug]/_components/{wo-board,wo-detail,wo-frd-filter,wo-progress,wo-empty}/**`, so the
three workspace tabs re-paint in parallel with no file collision.

**Disjoint artifacts (WO-05-003):**
`src/app/projects/[slug]/_components/wo-board/**`, `…/wo-detail/**`, `…/wo-frd-filter/**`,
`…/wo-progress/**`, `…/wo-empty/**`.

**Cross-FRD deps:** `frd-13` (foundation primitives — KanbanColumn/Chip/Panel/Button/Tabs/DocHeading),
`frd-04` (the workspace Tabbar this mounts into; `readDoc`/`DocView`), `frd-01` (live — `useLiveSnapshot`
+ SSE transport, WO-01-009).
