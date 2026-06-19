---
id: FDD-03
type: fdd
title: FDD-03 — Portfolio and project navigation (feature design)
parent: frds/frd-03-portfolio/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-03 — Portfolio and project navigation (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. **Fidelity, not novelty**: this describes the
portfolio exactly as the prototype renders it, mapped to the frozen design system and to FRD-03's
acceptance criteria.

- **Visual source:** `docs/design/prototype/index.html` — render function **`portfolioView()`** (the
  two-column rail + pane shell). The right pane is the project workspace, owned by FDD-04.
- The build's visual-fidelity gate captures the baseline from the `portfolio` view of `index.html`
  (see `mocks/README.md`).

> The design contract (palette, typography, surfaces, the app-wide RPG skin) is the **global PDD** —
> not redefined here. Every value named below resolves to a token, never a hardcoded literal.

## 1. Layout

`portfolioView()` renders a **two-column grid** `grid-template-columns: 240px 1fr; gap 14px;
align-items: start`:

- **Left — the project rail.** A small uppercase "PROYECTOS" label (`var(--text3)`), then one
  **rail item** per project (`.rail`). Each rail item: a running/stopped status icon
  (`ti-player-play` `var(--ok)` / `ti-player-pause` `var(--text3)`), the title (500 weight), a trailing
  group of **count badges** (pending-decisions pill on `var(--warn)`, bugs pill on `var(--danger)` —
  pill, canvas-colored text, 17px min), and a second line with the stage label (`var(--text3)`,
  indented under the icon). The selected rail (`.rail.on`) gets the `var(--accent-bg)` fill +
  `var(--accent)` border + inset accent ring.
- **Right — the workspace pane.** `projectPane(get(ST.projectSlug))` (FDD-04) when a project is
  selected, else a placeholder `.panel` ("Elige un proyecto a la izquierda.").

On mobile the two columns stack (the rail above the pane); the rail stays a vertical list.

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Rail header label | text label | uppercase 11px `var(--text3)` |
| Project rail item | `RailItem` (`.rail`) | status icon + title + count badges + stage line; `.on` selected variant |
| Running / stopped indicator | status icon | `ti-player-play` (ok) / `ti-player-pause` (text3) |
| Pending-decisions / bugs counts | `CountBadge` (pill) | warn pill / danger pill, canvas-colored numeral |
| Path-not-found warning | `Banner` | `⚠️ path not found` row + copyable recovery command (FRD-15/16 shape) |
| Empty rail | text empty-state | "Sin proyectos aún." |
| Right pane | `ProjectWorkspace` (FDD-04) | the selected project's workspace |

The rail item is a distinct **selectable navigation primitive** (`.rail`) — adjacent to but separate
from `.navitem` (docs nav) and `.tab`; reuse `RailItem`, do not fork a near-duplicate for the docs nav.

## 3. States

- **Default selection** — when no project is selected, the first project in the list is auto-selected
  (`AC`: "WHEN no project is selected … select the first one by default").
- **Empty** — no active projects → the rail shows "Sin proyectos aún." and the pane shows the
  placeholder `.panel`. Graceful, never blank.
- **Loading** — the Next.js build streams the rail and the pane; the pane reads project state under its
  own boundary (FDD-04). No skeleton for the rail the server already delivers.
- **Error / path-not-found** — per FRD-03 ACs: a project whose local path is missing shows a
  `⚠️ path not found` **`Banner`** on its rail row, with the copyable `git clone <repo> <path>` +
  `/pandacorp:sync-portfolio` recovery (same banner shape as FRD-15/16) or the "no remote registered"
  warning. Read-only: the app never clones, writes, or calls Claude; the badge clears once the path
  exists again on the next read.

## 4. Demo-only controls (DR-061)

None. The portfolio rail surfaces only real read-only data (status, decision/bug counts, stage) and
real navigation; there are no state-preview/demo controls on this surface. The shipped-project
**business snapshot** (active users / return metric / last verdict, FRD-03 AC) is real data filled by
`/pandacorp:review-launch`, surfaced read-only — never inside a demo block.
