---
id: WO-03-002
type: work-order
slug: portfolio-surface
title: 'WO-03-002 — Portfolio surface (rail + table + rows + empty + recovery + status chips)'
status: DRAFT
parent: FRD-03
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/portfolio/**'
  - 'src/components/modules/ProjectRail/**'
  - 'src/components/modules/ProjectRow/**'
  - 'src/components/modules/PortfolioTable/**'
source_requirements: [REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006]
last_updated: '2026-06-20'
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

### What was built

Re-painted the `/portfolio` surface to match the prototype `portfolioView()` function from
`docs/design/prototype/index.html`. The implementation is entirely presentational (read-only Server
Components; no new writes, no Claude calls).

**Files changed / created:**

- `src/app/portfolio/page.tsx` — Added `PageTitle` (icon `ti-stack-2`, H1 "Portfolio", subtitle);
  two-column grid (240px + 1fr, gap 14px, align-items start); "PROYECTOS" rail label
  (10px, accent-text, letter-spacing 0.08em).
- `src/app/portfolio/SelectableProjectRail.tsx` — Full rewrite: `.rail`/`.rail.on` styles via CSS
  vars only; `RailItem` sub-component extracted (reduces complexity score to comply with
  `noExcessiveCognitiveComplexity`); `StatusIndicator` sub-component for play/pause icon + text label
  (not color-only); `deriveRowCounts()` helper; empty state text "Sin proyectos aún.";
  `data-testid="selectable-row-indicator"` on the indicator span (with inner
  `data-testid="rail-status-icon"` on the `<i>`), `data-testid="selectable-project-rail"`,
  `data-testid="selectable-project-row"`, `data-selected`, `data-testid="selectable-row-stage"`,
  `data-testid="selectable-row-rethink"`.
- `src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx` — Refactored onto the shared
  `Banner` component (DR-057). With repo: `tone="danger" kind="error"` + `commandRow` prop. Without
  repo: `tone="warn" kind="inline"`. Outer `data-testid="recovery-hint"` div preserved.
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.test.tsx` — Updated to use
  Banner-based testids (`banner`, `banner-cmd-row`, `banner-detail`, `copy-button`) instead of the
  removed custom testids. Added DR-057 reuse test (exactly ONE Banner per row).
- `src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx` — NEW: 19 tests covering DR-062
  (PageTitle H1), FDD-03 layout (portfolio-rail, workspace-slot, PROYECTOS label), AC-03-002
  (play/pause icon + text indicator), selected styling (accent-bg), empty state,
  path-not-found Banner reuse (DR-057), token invariant.

### Interfaces / contracts exposed

- `SelectableProjectRailProps` — `{ items: ProjectListItem[], selectedSlug: string | undefined }` (unchanged public API shape; internal restructuring only).
- `SelectableProjectRail` — `src/app/portfolio/SelectableProjectRail.tsx` (re-exported as named export, same path).
- `RecoveryHintProps` — `{ exists: boolean, path: string, repo?: string }` (unchanged).
- Page layout: `data-testid="portfolio-page"` > `data-testid="page-title"` + `data-testid="portfolio-rail"` + `data-testid="workspace-slot"`.

### Implicit decisions / naming conventions

- **Status indicator testid layering**: the `<span data-testid="selectable-row-indicator">` carries the
  text "Construyendo"/"Parado" (text content, satisfies WO-03-004 tests); the inner `<i data-testid="rail-status-icon">` is the icon element (satisfies WO-03-002 tests). Both testids coexist on the same indicator group.
- **`isRunning`** is derived as `item.running === true` (strict boolean — `undefined` and `false` both yield "Parado").
- **`deriveRowCounts`** fails-soft: any non-number `pendingDecisions`/`pendingBugs` returns `undefined`; any non-`true` `rethinkPending` returns `undefined`.
- **Empty string `repo`** is treated as absent (same path as `undefined`) in `RecoveryHint`.
- **`marginLeft: "22px"`** on stage/rethink lines: aligns under the 14px icon + 8px gap per prototype spec.
- **`grid-template-columns: 240px 1fr`** is hardcoded per prototype — not a token. If the rail width ever becomes a token, it should be promoted to `--portfolio-rail-width`.

### Test files covering this WO

- `src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx` (19 tests — new)
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.test.tsx` (updated — Banner-based)
- `src/app/portfolio/_tests/wo-03-004.test.tsx` (169 total passing — `selectable-row-indicator` testid now satisfied by the `StatusIndicator` span's text content)

### Gate results

- Tests: 265 test files, 6291 tests — all green (2 expected-fail, 0 failures)
- TypeScript: `tsc --noEmit` — zero errors
- Biome: `biome check src/` — zero errors, 462 files
- Preview Smoke Gate: HTTP 200, no console errors, page renders with correct DOM structure
