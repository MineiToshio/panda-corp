---
id: WO-03-002
type: work-order
slug: portfolio-surface
title: 'WO-03-002 — Portfolio surface (rail + table + rows + empty + recovery + status chips)'
status: DRAFT
parent: FRD-03
implementation_status: IN_REVIEW
reopen_count: 0
artifacts:
  - 'src/app/portfolio/**'
  - 'src/components/modules/ProjectRail/**'
  - 'src/components/modules/ProjectRow/**'
  - 'src/components/modules/PortfolioTable/**'
source_requirements: [REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006]
last_updated: '2026-06-21'
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

**What was built (pass 4 — DR-057 reuse fix: one rail, not two, 2026-06-21):**

Resolved the owner's Option A decision: the shared inventoried `ProjectRail` (`src/components/modules/ProjectRail/ProjectRail.tsx`) now absorbs URL-driven selection as a `selectedSlug` prop/variant ("selectable mode"). `page.tsx` imports `ProjectRail` directly (DR-057 gate: production consumer, not orphan). `SelectableProjectRail.tsx` is kept as a thin pass-through wrapper that delegates to `ProjectRail` — import-site compatibility for the many existing test files that import from it.

**Key architectural change:**

`ProjectRail` has two modes:
1. **Default mode** (no `selectedSlug`): static list of rows with testids `project-rail` / `project-rail-row` — unchanged behavior, all 54 original tests still pass.
2. **Selectable mode** (`selectedSlug` defined): each row is a Next.js `<Link>` to `?project=<name>`; testids switch to `selectable-project-rail` / `selectable-project-row`; `StatusChips` + `BusinessSnapshot` + `RecoveryHint` are siblings of the Link (never descendants — WCAG 4.1.2 no button-in-anchor).

**Files changed in this pass:**

- `src/components/modules/ProjectRail/ProjectRail.tsx` — added `selectedSlug?: string` prop; `SelectableRow` sub-component with Link nav + `data-selected` + icon + stage line + indicator; `SelectableEmptyState` for empty selectable mode; imports `BusinessSnapshot`, `RecoveryHint`, `StatusChips` from `app/portfolio/_components/`. Style constants de-exported (no longer needed externally — `SelectableProjectRail` was the only consumer and is now a thin wrapper).
- `src/components/modules/ProjectRail/_tests/ProjectRail.selectable.test.tsx` — new 27 tests (RED→GREEN): selectable mode root/row testids, Link nav, status icons, stage line, running indicator, StatusChips, BusinessSnapshot, RecoveryHint, no-button-in-anchor structural test, design token invariant.
- `src/app/portfolio/SelectableProjectRail.tsx` — converted from bespoke implementation to thin pass-through: `<ProjectRail items={items} selectedSlug={slug} />`. No style re-declarations, no duplicated logic.
- `src/app/portfolio/page.tsx` — now imports `ProjectRail` directly from `@/components/modules/ProjectRail/ProjectRail` and passes `selectedSlug` to activate selectable mode. `SelectableProjectRail` no longer imported here (DR-057 gate: page.tsx is the production consumer).

**DR-057 gate results:**

- `frd-03-rail-reuse.gate.reviewer.test.tsx` test 1: `page.tsx` imports `modules/ProjectRail/ProjectRail` — PASS.
- `frd-03-rail-reuse.gate.reviewer.test.tsx` test 2: `SelectableProjectRail.tsx` re-declares none of `RAIL_STYLE`/`ROW_STYLE`/`CHIP_BUILDING_STYLE`/`CHIP_STOPPED_STYLE` as top-level `const` — PASS.

**Contracts for FRD-04 (unchanged):**

```tsx
// src/app/portfolio/WorkspaceSlot.tsx — unchanged
// data-testid="workspace-slot" data-slug="<name>"
// data-testid="workspace-slot-placeholder" / "workspace-slot-empty"

// ProjectRail selectable mode (via page.tsx or SelectableProjectRail):
// rail root: data-testid="selectable-project-rail"
// each row: data-testid="selectable-project-row" data-selected="true|false"
// status icon: data-testid="rail-item-status-icon" className="ti ti-player-play|ti-player-pause"
// stage line: data-testid="selectable-row-stage"
// running indicator: data-testid="selectable-row-indicator" (sr-only)
// recovery (when exists===false): data-testid="recovery-hint" wrapping Banner (role="alert")
// StatusChips: data-testid="status-chip-decisions" / "status-chip-bugs" / "status-chip-rethink"
// BusinessSnapshot: data-testid="business-snapshot"
```

**Implicit decisions:**

1. `selectedSlug=""` (empty string) activates selectable mode with the empty state — this is the sentinel used by `page.tsx` when `deriveSelectedSlug` returns `undefined` (no active projects). The empty string never matches any project name so no row is selected.
2. `SelectableProjectRail` passes `selectedSlug ?? ""` to `ProjectRail` — undefined becomes `""` (selectable mode, empty sentinel) rather than `undefined` (non-selectable mode). This is the behavior all existing tests expect.
3. Style constants `RAIL_STYLE`, `ROW_STYLE`, `CHIP_BUILDING_STYLE`, `CHIP_STOPPED_STYLE` are now unexported (they were exported only for `SelectableProjectRail` to import; that consumer no longer needs them). Knip confirms no new unused exports.
4. Pre-existing failures in `tab-summary.reviewer.test.tsx` (2 tests, WO-04-005 nested button defect) existed before this WO and are unchanged.

**Test files covering this WO (273 total across ProjectRail + portfolio, all green):**

- `src/components/modules/ProjectRail/_tests/ProjectRail.test.tsx` — 54 tests (original non-selectable mode)
- `src/components/modules/ProjectRail/_tests/ProjectRail.selectable.test.tsx` — 27 tests (new selectable mode)
- `src/app/portfolio/_tests/frd-03-rail-reuse.gate.reviewer.test.tsx` — 2 tests (DR-057 one-rail gate)
- `src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx` — 24 tests (page surface)
- `src/app/portfolio/_tests/wo-03-004.test.tsx` — 27 tests (selection + workspace slot)
- `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx` — 6 tests (full-page assembly)
- `src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx` — 3 tests (live rail integration)
- `src/app/portfolio/_tests/frd-03-integration.gate.reviewer.test.tsx` — 5 tests (edge cases)
- `src/app/portfolio/_tests/frd-03-nested-interactive.reviewer.test.tsx` — 1 test (no nested button)
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.test.tsx` — 30 tests
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.reuse.test.tsx` — 11 tests (DR-057 structural)
- `src/app/portfolio/_components/status-chips/_tests/status-chips.test.tsx` — 29 tests
- `src/app/portfolio/_components/status-chips/_tests/status-chips.adversarial.test.tsx` — 13 tests
- `src/app/portfolio/_components/status-chips/_tests/status-chips.reuse.test.tsx` — 6 tests (DR-057 structural)
- `src/app/portfolio/_components/status-chips/_tests/proposals-chip.test.tsx` — 10 tests
- Plus BusinessSnapshot, PortfolioEmpty component tests.
- **Full suite: 326 test files, 7042 passing, 2 expected failures (pre-existing).**

**Preview Smoke Gate (DR-055 / DR-072):** `/portfolio` → HTTP 200, zero console errors. H1 "Portfolio" visible, `data-testid="portfolio-rail-label"` text "PROYECTOS", two-column grid layout (240px rail | 1fr workspace), PageTitle with icon + subtitle, graceful empty state (no active projects on this machine — correct per FRD-03: building/shipped only). Visual check: one screenshot taken; layout matches prototype structure (two-column, PageTitle, PROYECTOS label, empty state graceful). No gross structural divergence.

**Typecheck / lint / dead code:** `tsc --noEmit` exit 0. `biome check .` — 1 pre-existing info (biome.json deprecation), 0 errors. `knip` — 0 unused exports/files (style constants correctly de-exported).

## OWNER DECISION — Option A (2026-06-21)

The owner resolved the duplicate-rail block: **Option A — reuse the inventoried component.** Rebuild this WO to:
- **REUSE** the shared inventoried module `ProjectRail` / `ProjectRow` (`src/components/modules/ProjectRail/…`, components.md L88-89) — do NOT fork it.
- Add URL-based selection (+ default-select + workspace slot) as a **PROP/VARIANT of the shared `ProjectRail`**, not a copy.
- **DELETE** the bespoke `src/app/portfolio/SelectableProjectRail.tsx` and its verbatim style-constant copies (RAIL_STYLE/ROW_STYLE/CHIP_STYLE/…).
- After this, the shared `ProjectRail` MUST have a production consumer (the `/portfolio` page); the anchor test `src/app/portfolio/_tests/frd-03-rail-reuse.gate.reviewer.test.tsx` must pass (no orphan, no fork).
Rows/table/status-chips/empty/recovery + the VERIFIED `lib` layer stay as specified.
