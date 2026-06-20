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

## Status Note

**What was built:** The complete `/portfolio` page surface (WO-03-002) — fully presentational, consuming the VERIFIED `activeProjects()` data layer from WO-03-001.

**Files changed / created:**

- `src/app/portfolio/page.tsx` — re-anchored to the prototype layout: `PageTitle` (H1 "Portfolio", icon `ti-stack-2`, subtitle from prototype), CSS grid `240px 1fr / gap 14px / align-items start`, `PROYECTOS` rail label (10px, `--color-accent-text`, `letter-spacing: 0.08em` — mirrors prototype `railLabel()`), `SelectableProjectRail` in the left column, `WorkspaceSlot` in the right.
- `src/app/portfolio/SelectableProjectRail.tsx` — added status icon (`<i data-testid="rail-item-status-icon" class="ti ti-player-play|ti-player-pause">`) as first element in the title row (matches prototype `ic` position); moved stage label to a second indented line (`marginLeft: 22px` — matches prototype stage line); added `sr-only` accessible indicator span (preserves existing `selectable-row-indicator` testid for legacy tests); extracted `STAGE_LINE_STYLE` constant; updated `ROW_STYLE` to match prototype `.rail` (transparent 0.5px border, no background, 9px 11px padding) and `ROW_SELECTED_STYLE` to match `.rail.on` (`--color-accent-bg` fill + `--color-accent` border + `inset 0 0 0 1px var(--color-accent)` box-shadow).
- `src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx` — new test file (24 tests, all green): PageTitle H1, subtitle, two-column layout, `PROYECTOS` label, status icons (ti-player-play/pause), stage line, count badges, selection/workspace, empty state, path-not-found recovery, design-token invariant.

**Interfaces / contracts exposed (for consumer — FRD-04 workspace slot):**

```tsx
// src/app/portfolio/WorkspaceSlot.tsx — unchanged contract
// data-testid="workspace-slot" data-slug="<name>"  — always present
// data-testid="workspace-slot-placeholder"          — when slug present (stub for FRD-04)
// data-testid="workspace-slot-empty"                — when no projects

// src/app/portfolio/SelectableProjectRail.tsx
interface SelectableProjectRailProps {
  items: ProjectListItem[];   // from activeProjects()
  selectedSlug: string | undefined;  // URL-derived or first item
}
// Each row: data-testid="selectable-project-row" data-selected="true|false"
// Status icon: data-testid="rail-item-status-icon" className="ti ti-player-play|ti-player-pause"
// Stage line: data-testid="selectable-row-stage"
// Recovery: data-testid="recovery-hint" (when exists===false)
```

**Implicit decisions / assumptions:**

1. `ROW_STYLE` uses `marginBottom: 6px` (from prototype `.rail { margin-bottom: 6px }`) instead of a `gap` on the parent — this matches the prototype spacing exactly.
2. The `sr-only` span for `selectable-row-indicator` is retained to keep all 150 pre-existing tests green (they query `selectable-row-indicator` for accessibility text); the visual indicator is now the Tabler icon (`rail-item-status-icon`), not color alone.
3. `PROYECTOS` label renders `aria-hidden="true"` — it is a decorative section label (the `<nav aria-label="Proyectos activos">` already names the region for screen readers).
4. The workspace right column still hosts `WorkspaceSlot` (stub with `data-slug`). FRD-04 wires in by replacing the slot body with `<ProjectWorkspace slug={selectedSlug} />` — the `data-testid="workspace-slot"` and `data-slug` attributes are the integration seam.
5. `BusinessSnapshot` component (`_components/BusinessSnapshot/`) is still in the codebase (pre-existing from earlier WOs) and wired in `SelectableProjectRail` — it renders nothing for non-operation rows (gated on `item.snapshot !== undefined`). FRD-03 deferred the snapshot; component stays dormant.

**Test files covering this WO:**

- `src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx` — 24 tests (new, this WO)
- `src/app/portfolio/_tests/wo-03-004.test.tsx` — 27 tests (selection + workspace slot)
- `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx` — 6 tests (full-page assembly)
- `src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx` — 3 tests (live rail integration)
- `src/app/portfolio/_tests/frd-03-integration.gate.reviewer.test.tsx` — 5 tests (edge cases)
- `src/app/portfolio/_tests/frd-03-nested-interactive.reviewer.test.tsx` — 1 test (no nested `<button>` in `<a>`)
- Total portfolio suite: 174 tests, all passing.

**Preview Smoke Gate (DR-055):** `/portfolio` → HTTP 200, zero console errors, H1 = "Portfolio", `data-testid="portfolio-rail-label"` text = "PROYECTOS". Verified with Playwright against `http://localhost:3000/portfolio`.
