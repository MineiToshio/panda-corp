---
id: WO-05-003
type: work-order
slug: wo-board-tab
title: 'WO-05-003 — Work-orders tab: live kanban board + detail (re-paint to mock)'
status: DRAFT
parent: FRD-05
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/wo-board/**'
  - 'src/app/projects/[slug]/_components/wo-detail/**'
  - 'src/app/projects/[slug]/_components/wo-frd-filter/**'
  - 'src/app/projects/[slug]/_components/wo-progress/**'
  - 'src/app/projects/[slug]/_components/wo-empty/**'
source_requirements: [REQ-05-001, REQ-05-002, REQ-05-003, REQ-05-004, REQ-05-005, REQ-05-006]
last_updated: '2026-06-21'
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

## Status Note

**IN_REVIEW (2026-06-21, Sonnet 4.6) — reopen_count 1 fix applied.**

**What was fixed (the 3 DR-057/DR-062 violations from the gate reject):**

1. **FRD chip unified (DR-057).** `wo-detail.tsx` now imports and uses the shared `Chip` primitive (`<Chip tone="accent">`) in the header meta row — the bespoke `FRD_CHIP_STYLE` span is gone. The `wo-detail-frd-chip` slot wraps `<Chip>` so the test detects `data-testid="chip"` inside. `wo-frd-filter.tsx` already used `<Chip>` correctly in the first pass; the bespoke `chipStyle()` was already removed before reopening — confirmed by the 3 gate tests passing GREEN.

2. **Shared `Tabs` (DR-062).** `wo-detail.tsx` uses the `Tabs` primitive (`level="sub"`, `testIdPrefix="wo-detail-tab-"`, `ariaLabel="Pestañas del work order"`) for the Resumen/Documento-completo bar. Tab selection is URL-driven via `window.location.assign` in `onChange`, no `useRouter` dependency. The `data-testid="tabs-root"` stamp from `Tabs.tsx` is present and the gate test confirms it.

3. **`fail` label unified (secondary).** `wo-detail.tsx` `STATE_LABEL.fail` was "Bloqueado" (mismatching the board's "Falló"). Changed to `"Falló"` — both siblings now agree on the single word for the `fail` state.

**Gate anchor tests — all 3 GREEN:**
`src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx`:
- chip-in-detail: `wo-detail-frd-chip` contains a `data-testid="chip"` element
- chip-in-filter: `WoFrdFilter` renders `data-testid="chip"` elements
- tabs-in-detail: `data-testid="tabs-root"` present in `WoDetail`

**Components and files (complete list):**

- `src/app/projects/[slug]/_components/wo-board/wo-board.tsx` — `WorkOrderBoard` (Server Component, 5 columns, reuses `KanbanColumn` + `Chip` — DR-057); `WorkOrderCard` (fail variant: danger bg + border + ⚠ icon + danger title; FRD chip via `<Chip tone="info">`). Exported: `WorkOrderBoard({ orders: WorkOrder[] })`.
- `src/app/projects/[slug]/_components/wo-detail/wo-detail.tsx` — `WorkOrderDetail` ("use client"; uses `Chip` for FRD chip + `Tabs level="sub"` for tab bar; `STATE_LABEL.fail = "Falló"`). Exported: `WorkOrderDetail({ order, content, activeWoTab })`.
- `src/app/projects/[slug]/_components/wo-frd-filter/wo-frd-filter.tsx` — `WoFrdFilter` ("use client"; filter pills are `<Chip>` inside transparent `<button>` shells — DR-057). Exported: `WoFrdFilter({ frds, selected, onSelect })`.
- `src/app/projects/[slug]/_components/wo-frd-filtered-board/wo-frd-filtered-board.tsx` — `WoFrdFilteredBoard` ("use client"; owns `selectedFrd` state, composes `WoFrdFilter` + `WorkOrderBoard`). Exported: `WoFrdFilteredBoard({ orders })`.
- `src/app/projects/[slug]/_components/wo-progress/wo-progress.tsx` — `WorkOrderProgressBar` (Server Component; renders `aggregateProgress` result as `done/total · pct%`). Exported: `WorkOrderProgressBar({ progress: WorkOrderProgress })`.
- `src/app/projects/[slug]/_components/wo-empty/wo-empty.tsx` — `WorkOrderEmpty` (Server Component; Panel message + copy button for `/pandacorp:blueprint`). Exported: `WorkOrderEmpty()`.
- `src/app/projects/[slug]/_components/tab-work-orders/tab-work-orders.tsx` — `TabWorkOrders({ orders, project? })` routes to empty or progress+board; mounts `WoLiveRefresh` when `project` provided.
- `src/app/projects/[slug]/_components/tab-work-orders/wo-live-refresh.tsx` — `WoLiveRefresh({ project: string })` (thin "use client" SSE connector — fires `router.refresh()` on new `lastEventAt`). AC-05-005.1.
- `src/app/projects/[slug]/page.tsx` — `renderWorkOrdersTab(projectPath, slug, woParam, woTabParam)` passes `project={slug}` to `TabWorkOrders`; routes to `WorkOrderDetail` when `?wo=<id>`.
- `src/components/core/KanbanColumn/KanbanColumn.tsx` — `danger?: boolean` prop added (header label in `--color-danger` when true). Non-breaking.
- `src/app/preview-wo05003/page.tsx` — fidelity-check preview route (non-shipping; can be removed after VERIFIED).

**Interfaces/contracts:**
- `WorkOrderBoard({ orders: WorkOrder[] })` → 5-column kanban; cards link to `?tab=work-orders&wo=<id>`.
- `WorkOrderDetail({ order: WorkOrder, content: string | null, activeWoTab: "summary" | "full" })` → detail with `Tabs` (DR-062) + `Chip` (DR-057); `STATE_LABEL.fail = "Falló"`.
- `WoFrdFilter({ frds: string[], selected: string | null, onSelect: (frd: string | null) => void })` → pill filter bar; pills are `<Chip>` inside `<button>` shells (DR-057).
- `WoFrdFilteredBoard({ orders: WorkOrder[] })` → stateful wrapper (filter state + board).
- `WorkOrderProgressBar({ progress: WorkOrderProgress })` → `done/total · pct%` (tabular-nums).
- `WorkOrderEmpty()` → Panel + CopyButton for blueprint command.
- `WoLiveRefresh({ project: string })` → hidden span (`data-testid="wo-live-refresh"`), `router.refresh()` on SSE.
- `TabWorkOrders({ orders: WorkOrder[], project?: string })` → coordinator; `project` enables live refresh.
- `KanbanColumn` — `danger?: boolean` (default `false`); non-breaking.

**Implicit decisions and conventions:**
- `WorkOrderState` value `in_progress` (not `progress`) is the canonical lib key.
- Fail column is column index 3 (0-based): To do=0, En progreso=1, Review/Testing=2, Falló=3, Hecho=4.
- `fail` state label is "Falló" in BOTH the board columns and the detail `STATE_LABEL` — they must stay in sync.
- `WoFrdFilter` pills: `Chip tone="accent"` when selected, `tone="secondary"` when not — both `Todos` and per-FRD options.
- `WoDetail` FRD chip: `Chip tone="accent"` (not "info" — the detail uses accent for the FRD while the card uses info; both are `Chip` instances so DR-057 is satisfied).
- `KanbanColumn danger` prop affects only the header label color, not the count span (count stays accent).
- `WoLiveRefresh` renders a hidden `<span>` (not `null`) so tests can assert `data-testid="wo-live-refresh"`.
- `jsdom` does not support `EventSource`; tests that render `WoLiveRefresh` must mock `@/hooks/useLiveSnapshot`.

**Test files:**
- `src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx` — 3 DR-057/DR-062 gate tests (chip-in-detail, chip-in-filter, tabs-in-detail). All GREEN.
- `src/app/projects/[slug]/_components/wo-board/_tests/wo-board.test.tsx` — 25 tests for the 5-column board, fail variant, FRD chips, empty placeholder, card links.
- `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.test.tsx` — detail unit tests (tabs, FRD chip, state, markdown render, back link).
- `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx` — 15 page-level integration tests (board ↔ detail routing, full-doc render, back link).
- `src/app/projects/[slug]/_components/wo-frd-filtered-board/_tests/wo-frd-filtered-board.test.tsx` — 16 filter + board narrowing tests.
- `src/app/projects/[slug]/_components/_tests/frd-05.reviewer.integration.test.tsx` — reviewer integration tests (5-column API).

**Gates:** 323 test files / 6992 tests pass (2 pre-existing FRD-07 failures unrelated to this WO, unchanged from last green) · `tsc --noEmit` clean · `biome check` clean (544 files) · visual fidelity confirmed at cycle 1 against `projWO()` via Playwright screenshot of `/preview-wo05003` — 5 columns, fail danger variant, FRD chips, progress bar, empty state all rendered correctly.
