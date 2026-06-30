---
id: FDD-05
type: fdd
title: FDD-05 — Work orders (live view) feature design
parent: frds/frd-05-work-orders/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-05 — Work orders (live view) feature design

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. **Fidelity, not novelty**: this describes the
work-orders kanban exactly as the prototype renders it, mapped to the frozen design system and to
FRD-05's acceptance criteria.

- **Visual source:** `docs/design/prototype/index.html` — render function **`projWO()`** (the kanban
  board **and** the single-work-order detail view), with **`woFullDoc()`** (the full-document markdown)
  and **`frdChip()`**. It renders inside the project workspace's "Work orders" subtab (FDD-04).
- The build's visual-fidelity gate captures the baseline from the `portfolio` view of `index.html`
  with a project selected and the **Work orders** subtab active (see `mocks/README.md`).

> The design contract (palette, typography, surfaces, the app-wide RPG skin) is the **global PDD** —
> not redefined here. Every value named below resolves to a token, never a hardcoded literal.

## 1. Layout

`projWO(i)` has **two states** within the subtab:

### Board state (default)
- A one-line read-only caption (`var(--text3)`): live state written by the agents, click a card for its
  summary + FRD.
- A **horizontal-scroll** row of equal-width **columns** (`.col`, fixed `224px`, `gap 8px`,
  `overflow-x:auto`). Columns, in order: **To do · In progress · Review/Testing · Fail · Done**
  (`WLBL`). Each column has a small header with its label + a `var(--text3)` count.
- Each **work-order card** (`.card`): the title (wraps onto several lines — `overflow-wrap:anywhere`)
  and its **FRD chip** (`frdChip()`, info-bg). A **failed** card is tinted `var(--danger-bg)` /
  `var(--danger)` border with a leading `ti-alert-triangle`. Empty column → a `—` placeholder.

### Detail state (a card clicked)
- A **back** button ("← Work orders").
- A header `.panel`: the work-order title + its **FRD chip** + a state chip (`WLBL`).
- A `.stab` switcher: **Resumen** (the WO description) / **Documento completo** (the full work-order
  markdown via `woFullDoc()` — description, acceptance criteria, scope, definition of done, evidence),
  rendered in a `.panel` (the doc tab in a `.panel.doc`).

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Kanban column | `KanbanColumn` (`.col`) | fixed 224px, header label + count; horizontal scroll row |
| Work-order card | `WorkOrderCard` (`.card`) | wrapping title + FRD chip; `fail` danger variant |
| FRD chip | `Chip` (`frdChip`) | info-bg, 10px |
| State chip (todo/progress/review/fail/done) | `Chip` | secondary / danger variants (`WLBL`) |
| Back button | `Button` | "← Work orders" |
| Detail subtab switcher | `SubTabs` (`.stab`) | Resumen / Documento completo |
| Rendered full document | `DocView` (`.panel.doc`) | markdown work order |
| Empty board / no work orders | text empty-state | "Los work orders se generan en /pandacorp:architecture." |

All reuse shared primitives. `WorkOrderCard` is the `.card` primitive with a `fail` (danger) variant —
**not** a second card component. `KanbanColumn` is the `.col` primitive.

## 3. States

- **Empty (no work orders)** — a `.panel` message: "Los work orders se generan en
  `/pandacorp:architecture`." (FRD-05 edge case). Never blank.
- **Loading** — the Next.js build streams the board; it reads the per-feature
  `docs/frds/frd-NN-<slug>/work-orders/` state under the subtab's boundary. No skeleton for content the
  server already delivers.
- **Error** — a board that fails to read the work-order state renders an inline `Banner` naming the
  source, not a blank column.
- **Fail column / blocked work order** — failed cards render in the `var(--danger-bg)` variant with the
  alert icon, so the blocker is visible on the board (and surfaced on the dashboard project card per
  FDD-18) without opening logs.
- **Progress** — aggregated `done / tot · pct%` is shown by the header objectives bar (FDD-04
  `progressBar()`), aggregated across every feature's `work-orders/`.

## 4. Demo-only controls (DR-061)

None. The kanban is **read-only** — the owner does not edit it; columns and cards reflect the live state
written by the build agents. There are no state-preview/demo controls, no drag-to-move (the board is
view-only, which also satisfies the WCAG "dragging has a single-pointer alternative" rule trivially —
there is no drag). Clicking a card opens its read-only detail; nothing mutates state.
