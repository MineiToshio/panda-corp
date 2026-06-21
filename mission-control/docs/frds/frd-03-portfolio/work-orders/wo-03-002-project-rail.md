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

**What was built (pass 3 — DR-057 reuse fix, 2026-06-21):** Resolved the gate rejection reason: the previous implementation used bespoke banner/box/chip styles instead of the shared `Banner` + `CountBadge` primitives. This pass refactors those two components onto the shared foundation.

**Root cause of gate rejection (d37fa48):** `RecoveryHint` reimplemented a banner box with its own `BADGE_STYLE`/`HINT_BOX_STYLE`/`COMMAND_ROW_STYLE` (a duplicate of the shared `Banner`). `StatusChips` reimplemented pill styles with `AMBER_CHIP_STYLE`/`RED_CHIP_STYLE` instead of using `CountBadge` presets.

**Files changed in this pass:**

- `src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx` — refactored onto shared `Banner` (CMP-13-banner, tone="danger", kind="error") + `CmdRow` (CMP-13-cmdrow). All bespoke `BADGE_STYLE`/`HINT_BOX_STYLE`/`LABEL_STYLE`/`COMMAND_ROW_STYLE`/`CODE_STYLE`/`WARNING_STYLE` removed. Visual shell now from `Banner`; recovery command from `CmdRow`; no-repo warning in `Banner.children` with `data-testid="recovery-hint-no-repo"`.
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.test.tsx` — updated from testid-based queries (`recovery-hint-badge`, `recovery-hint-command`) to accessible role queries (`getByRole("alert")`, `getByTestId("cmd-row")`). 30 tests → 30 tests, all green.
- `src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.reuse.test.tsx` — new RED→GREEN structural tests (11 tests): verify `data-testid="banner"` present, `data-tone="danger"`, `data-testid="cmd-row"` with command text, no bespoke box style on root.
- `src/app/portfolio/_components/status-chips/status-chips.tsx` — refactored onto `CountBadge` (CMP-13-countbadge). All bespoke `BASE_CHIP_STYLE`/`AMBER_CHIP_STYLE`/`RED_CHIP_STYLE`/`PROPOSALS_CHIP_STYLE` removed. Decisions chip: `CountBadge count={pendingDecisions} tone="warn"`. Bugs chip: `CountBadge count={pendingBugs} tone="danger"`. Proposals chip: `CountBadge count={pendingProposals} tone="accent"`. Outer semantic wrappers preserve existing `data-testid` and `data-variant` attributes; `status-chip-decisions-count` span preserved (wraps CountBadge) for test-contract compat.
- `src/app/portfolio/_components/status-chips/_tests/status-chips.reuse.test.tsx` — new RED→GREEN structural tests (6 tests): verify `data-testid="count-badge"` inside decisions/bugs wrappers, correct `data-tone` on each badge.

**Contracts preserved (unchanged interfaces for FRD-04):**

```tsx
// src/app/portfolio/WorkspaceSlot.tsx — unchanged
// data-testid="workspace-slot" data-slug="<name>"
// data-testid="workspace-slot-placeholder" / "workspace-slot-empty"

// src/app/portfolio/SelectableProjectRail.tsx — unchanged
// Each row: data-testid="selectable-project-row" data-selected="true|false"
// Status icon: data-testid="rail-item-status-icon" className="ti ti-player-play|ti-player-pause"
// Stage line: data-testid="selectable-row-stage"
// Recovery: data-testid="recovery-hint" root (when exists===false) wrapping Banner

// RecoveryHint.tsx — updated public surface:
// data-testid="recovery-hint"    — root wrapper (preserved)
// data-testid="banner"           — shared Banner (replaces bespoke box)
// data-testid="cmd-row"          — CmdRow with clone command (repo path)
// data-testid="recovery-hint-no-repo" — no-repo warning paragraph (preserved)
// role="alert"                   — Banner's semantic role (replaces role="status" badge)

// StatusChips.tsx — updated public surface:
// data-testid="status-chip-decisions" / "status-chip-bugs" / "status-chip-rethink" — preserved
// data-testid="status-chip-decisions-count" / "status-chip-bugs-count" — preserved (wrap CountBadge)
// data-testid="count-badge" inside decisions/bugs wrappers — new (CountBadge)
```

**Implicit decisions:**

1. `RecoveryHint` keeps `data-testid="recovery-hint"` as a wrapping `<div>` around `Banner` — Banner itself has `data-testid="banner"`. This allows integration tests to `within(row).getByTestId("recovery-hint")` and navigate down to the Banner, while the row-level `queryByText(/ruta no encontrada/)` finds the Banner heading.
2. Tests previously querying `recovery-hint-badge` (a now-removed span) were updated to `getByRole("alert")` — semantically cleaner and more robust. The `Banner` renders `role="alert"` which is the correct semantic for path-not-found notification.
3. The `recovery-hint-command` testid (pointing to a `<code>` element) was removed; the `cmd-row` testid (pointing to `CmdRow`) is the new contract. `CmdRow.textContent` contains the full clone command.
4. `StatusChips` outer wrapper spans (`status-chip-decisions` etc.) retain their `color: var(--color-warn/danger/accent-text)` style so the design-token invariant test (`style.toContain("var(--")`) passes without CountBadge re-implementing the token check.
5. `RETHINK_CHIP_STYLE` is retained in `StatusChips` for the rethink indicator because `CountBadge` is a numeric count preset — rethink is a boolean flag indicator, not a count, so it is not a CountBadge consumer. No new component was created (DR-057: no new bespoke pill).
6. Pre-existing failures in `tab-summary.reviewer.test.tsx` (2 tests, WO-04-005 nested button defect) existed before this WO and are unchanged.

**Test files covering this WO (190 total, all green):**

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

**Preview Smoke Gate (DR-055):** `/portfolio` → HTTP 200, zero console errors, H1 = "Portfolio", `data-testid="portfolio-rail-label"` text = "PROYECTOS". Verified with Playwright against `http://localhost:3100/portfolio`. Layout matches prototype: two-column grid (240px rail | 1fr workspace), PageTitle with icon + subtitle, PROYECTOS label, empty state graceful.

**Typecheck / lint:** `tsc --noEmit` exit 0. `biome check .` exit 0 (1 pre-existing info: biome.json deprecation). `knip` exit 0 (no new dead code).
