---
id: WO-05-003
type: work-order
slug: wo-board-tab
title: 'WO-05-003 — Work-orders tab: live kanban board + detail (re-paint to mock)'
status: DRAFT
parent: FRD-05
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_components/wo-board/**'
  - 'src/app/projects/[slug]/_components/wo-detail/**'
  - 'src/app/projects/[slug]/_components/wo-frd-filter/**'
  - 'src/app/projects/[slug]/_components/wo-progress/**'
  - 'src/app/projects/[slug]/_components/wo-empty/**'
source_requirements: [REQ-05-001, REQ-05-002, REQ-05-003, REQ-05-004, REQ-05-005, REQ-05-006]
last_updated: '2026-06-19'
---
# WO-05-003 — Work-orders tab: live kanban board + detail (re-paint to mock)

**Feature:** FRD-05 · **Implements:** CMP-05-board, CMP-05-column, CMP-05-card, CMP-05-frd-filter, CMP-05-detail, CMP-05-progress, CMP-05-empty

The single coarse presentational work order for the **Work orders** tab. It re-paints the whole
work-orders surface to the owner-approved prototype, faithful to the mock and built on the foundation
primitives — the `lib/work-orders.ts` reader and `aggregateProgress` (WO-05-001/002) are **VERIFIED and
out of scope** (consume them, never re-plan them). **Real-time**: the board is event-driven via
`useLiveSnapshot` (WO-01-009), not polling — when a work order moves column the board reflects it without
a reload.

## Goal

Render the work-orders tab exactly as the prototype `projWO()` renders it, on the frozen tokens and the
FRD-13 foundation primitives: a five-column read-only kanban (todo · progress · review · **fail** · done)
with FRD-chipped cards, an FRD grouping/filter, the single-work-order detail (Resumen / Documento
completo), aggregated progress and the empty state — all live off the real event stream.

## Scope

- **`WoBoard`** + **`KanbanColumn`** use — five equal-width, wide columns in order
  **To do · In progress · Review · Fail · Done**, horizontal-scroll row, titles wrap
  (`overflow-wrap:anywhere`); each column header shows its label + a `var(--text3)` count
  (`tabular-nums`). Reuse the FRD-13 `KanbanColumn` primitive (WO-13-008) — do **not** re-implement a
  column. `src/app/projects/[slug]/_components/wo-board/**`.
- **`WorkOrderCard`** — the shared `.card` primitive with a `fail` **danger variant** (danger
  background + border, `ti-alert-triangle` leading icon, danger-colored title) and the FRD `Chip`
  (info-bg). It is a *variant*, **NOT** a second card component (DR-057). Empty column → `—` placeholder.
- **`WoFrdFilter`** + **`WoFrdFilteredBoard`** — the pill-bar control listing the distinct FRDs present,
  "Todos" reset, narrowing the visible cards; the stateful wrapper composes the filter + board.
  `src/app/projects/[slug]/_components/wo-frd-filter/**`.
- **`WoDetail`** — opened on card click: a header `Panel` with title + FRD chip + state chip, then a
  `Tabs` switcher **Resumen** (the `WorkOrder.summary`) / **Documento completo** (the full `wo-*.md`
  markdown via the FRD-04 `DocView`/`readDoc`), with a back affordance to the board.
  `src/app/projects/[slug]/_components/wo-detail/**`.
- **`WoProgress`** — aggregated `done / total · pct%` from `aggregateProgress` (WO-05-002),
  `tabular-nums`; the same numbers the FRD-04 Mission Objectives bar reads (never drift).
  `src/app/projects/[slug]/_components/wo-progress/**`.
- **`WoEmpty`** — when there are no work orders, the `Panel` message
  "Los work orders se generan en `/pandacorp:blueprint`." with a copy button; never blank.
  `src/app/projects/[slug]/_components/wo-empty/**`.
- **Live**: subscribe to the work-orders slice of `useLiveSnapshot` (WO-01-009, SSE) so column moves,
  fail transitions and progress update in place — event-driven, **not** polling.
- **Read-only**: no drag, no manual move, no mutation, no demo controls (FDD-05 §4) — which also
  satisfies the WCAG single-pointer-alternative rule trivially.
- **Out of scope:** the reader/aggregation (`lib/work-orders.ts`, WO-05-001/002 — VERIFIED); the SSE
  transport + `useLiveSnapshot` (WO-01-009); the workspace Tabbar (FRD-04); `readDoc`/`DocView` (FRD-04).

## Acceptance criteria

- **AC-05-001.1/.2** Five columns in order To do · In progress · Review · Fail · Done; equal-width, wide,
  horizontal scroll on overflow; titles wrap (no clipping).
- **AC-05-002.1/.2** Each card shows its FRD chip; the board can be grouped/filtered by FRD; "Todos"
  restores the full set.
- **Fail treatment** A work order in the Fail column renders the danger variant (danger bg + border,
  alert icon, danger title) and the Fail column header reads in danger — failure is unmistakable, and
  conveyed by icon + label, **not color alone**.
- **AC-05-003.1/.2** Clicking a work order opens the detail with **Resumen** and **Documento completo**
  tabs; the full-document tab renders the entire `wo-*.md`; back returns to the board.
- **AC-05-004.1** Aggregated `done / total · pct%` is shown, summing every feature's `work-orders/`.
- **AC-05-006.1** No work orders → the `/pandacorp:blueprint` empty message, never a zeroed bar or blank.
- **AC-05-005.1 (live)** The board updates LIVE off the event stream as agents change WO state — no reload.
- **Fidelity** Matches the prototype `projWO()` on the frozen tokens (in-loop visual-fidelity gate);
  tokens only, zero hardcoded values; reuses the FRD-13 primitives per `docs/design/components.md`.

## Dependencies

- **Intra:** WO-05-001 (`listWorkOrders`, `WorkOrder`, `readWorkOrderDoc` — VERIFIED), WO-05-002
  (`aggregateProgress` — VERIFIED).
- **Foundation (FRD-13):** WO-13-006 (PageTitle/SectionHead/Tabs), WO-13-007 (Chip/CountBadge/Panel/
  Button/DocHeading/Banner), WO-13-008 (KanbanColumn).
- **Live (FRD-01):** WO-01-009 (`useLiveSnapshot` + the SSE transport — `foundation:true`).
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-04` (the Tabbar this mounts into; `readDoc`/
  `DocView`), `frd-01` (live snapshot).

## Visual reference

`docs/design/prototype/index.html` — render function `projWO()` (board **and** detail), with
`woFullDoc()` (full document) and `frdChip()`; reached in the `portfolio` view with a project selected
and the **Work orders** subtab active. See `../fdd.md` and `mocks/README.md`. Fidelity, not novelty.
