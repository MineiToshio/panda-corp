---
id: WO-03-002
type: work-order
slug: portfolio-surface
title: 'WO-03-002 — Portfolio surface (rail + table + rows + empty + recovery + status chips)'
status: DRAFT
parent: FRD-03
implementation_status: PLANNED
artifacts:
  - 'src/app/portfolio/**'
  - 'src/components/modules/ProjectRail/**'
  - 'src/components/modules/ProjectRow/**'
  - 'src/components/modules/PortfolioTable/**'
source_requirements: [REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006]
last_updated: '2026-06-19'
---
# WO-03-002 — Portfolio surface

## Goal

Re-paint the whole `/portfolio` page so it matches the approved prototype: the left **vertical rail**
of active projects, the rows / table, the project-status chips, the selection + default-select +
workspace slot, the empty state and the read-only path-not-found recovery — H1 **"Portfolio"**
rendered via `PageTitle`. The `lib/portfolio.ts` `activeProjects` helper and the FRD-01 readers are
VERIFIED and consumed as-is; this WO is presentational.

## Scope (components from `docs/design/components.md`)

- **`ProjectRail` / `RailItem`** (`src/components/modules/ProjectRail/ProjectRail.tsx`) — the
  selectable rail nav primitive (`.rail` / `.rail.on`): status icon + title + count badges + stage
  line. Distinct from `Tabs` and the docs `.navitem` — reuse the rail primitive, do not fork a tab.
- **`ProjectRow` / `PortfolioTable`** (`src/components/modules/{ProjectRow,PortfolioTable}/*.tsx`) —
  the project rows / table: title, stage, building/stopped indicator (icon + label, not color-only).
- **`StatusChips`** (`src/app/portfolio/_components/status-chips/status-chips.tsx`) — per-row
  pending-decisions / bugs / rethink count badges; built as **`CountBadge` presets** (`tabular-nums`),
  not new pills.
- **`PortfolioEmpty`** (`src/app/portfolio/_components/PortfolioEmpty/PortfolioEmpty.tsx`) — graceful
  empty-portfolio state via `Panel`.
- **`RecoveryHint`** (`src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx`) — path-not-found
  recovery; **refactor onto the shared `Banner`** (path-not-found variant) with a copyable
  `git clone … && /pandacorp:sync-portfolio` via `CmdRow`, or the no-repo warning. A second
  banner/alert is a defect — reuse the ONE `Banner`.
- **Page** (`src/app/portfolio/page.tsx`) — H1 **"Portfolio"** via `PageTitle`; the workspace slot
  (right panel) hosting the selected project's workspace (FRD-04), default-select the first project,
  selection URL-driven (`?project=<slug>`).

**Deferred — do NOT build:** `BusinessSnapshot` (shipped-project business snapshot) is **out of scope
for now** (FRD-03 "Out of scope / Future" — premature, no monetizing projects yet). The rail keeps
space for it conceptually but renders nothing today.

reuse → adapt → create-only-if-new: every component reuses an existing foundation primitive
(`Banner`, `CountBadge`, `Panel`, `CmdRow`, `PageTitle`) or an inventoried module; no new shared
component is introduced.

## Acceptance criteria (anchored in FRD-03 EARS)

- AC-03-001 — The left vertical rail lists ONLY projects in `building` and `shipped` (started
  development); product/design/architecture do not appear; a re-versioned project re-appears.
- AC-03-002 — Each row shows title, stage and a building/stopped indicator (icon + label).
- Each row shows a **pending-decisions** count badge and a **bugs** count badge when count > 0
  (`StatusChips`).
- AC-03-004/.005 — Selecting a project shows its workspace (FRD-04) in the right panel; no selection →
  select the first by default.
- AC-03-006 — No active projects → graceful empty state; path missing → `⚠️ path not found` badge +
  recovery on the row (repo → copyable `git clone … && sync`; no repo → warning). Detection is
  **read-only** (never clones / writes / calls Claude); the badge clears once the path exists again.
- Page renders with H1 "Portfolio" via `PageTitle`; matches the prototype portfolio surface;
  light + dark; the Preview Smoke Gate is green.

## Dependencies

- Foundation (FRD-13): **WO-13-006** (`PageTitle`/`Tabs`), **WO-13-007**
  (`Banner` — RecoveryHint, `CountBadge` — StatusChips, `Panel`/`CmdRow`/`Button`), **WO-13-008**
  (rail status icons / item primitives as needed).
- Read layer (VERIFIED, consumed as-is): WO-03-001 (`lib/portfolio.ts` `activeProjects`), FRD-01
  `readPortfolio` / `readStatus` / `pathExists`, FRD-02 `lib/next-step.ts`.
- Cross-FRD: **frd-13** (foundation must land first); FRD-04 (workspace component hosted in the slot —
  stub until it lands).

## Visual reference

`docs/design/prototype/index.html` (the portfolio surface: rail, rows, status chips, empty state,
path-not-found recovery banner).
