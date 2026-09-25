---
id: WO-05-007
type: work-order
slug: wo-state-filter
title: 'WO-05-007 — Work-orders kanban: secondary filter by state'
status: ACTIVE
parent: FRD-05
implementation_status: IN_REVIEW
difficulty: low
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/wo-state-filter/**'
  - 'src/app/projects/[slug]/_components/wo-frd-filtered-board/**'
source_requirements: [REQ-05-007, REQ-05-003]
dependsOn: [WO-05-003]
last_updated: '2026-09-24'
change_ref: canario-d-paralelismo-portfolio-board-changes-wo.md
---
# WO-05-007 — Work-orders kanban: secondary filter by state

**Change:** `.pandacorp/inbox/changes/canario-d-paralelismo-portfolio-board-changes-wo.md` (item 4).
**IDs touched:** REQ-05-007; `CMP-05-frd-filter` (sibling), `CMP-05-board`.

## Problem

`WoFrdFilter` (`src/app/projects/[slug]/_components/wo-frd-filter/wo-frd-filter.tsx`) filters the
kanban by FRD only; there is no way to isolate, e.g., only `in_progress` or `fail` work orders in a
project with many FRDs.

## Scope

- New client component `src/app/projects/[slug]/_components/wo-state-filter/wo-state-filter.tsx`
  (`WoStateFilter`) — same pattern as `WoFrdFilter`: pills built on the shared `Chip`,
  `aria-pressed`, `data-testid` per pill, an "all" pill. Options are the `WorkOrderState` values
  (`todo | in_progress | review | fail | done`, `src/lib/work-orders/work-orders.ts`) labelled with the
  board's Spanish column names (Por hacer · En progreso · Revisión · Fallo · Hecho — reuse the
  board's existing labels, do not re-declare a divergent map if one is exported).
- Compose it in `WoFrdFilteredBoard` (`wo-frd-filtered-board.tsx`) next to the FRD filter; the two
  are combinable (logical AND). Do NOT edit `wo-frd-filter/**` or `wo-board/**` (outside this WO's
  artifacts) — read their exports only.
- Route-scoped component (`_components/`): no `docs/design/components.md` row needed.

## Acceptance criteria

- AC-05-007.1 — The kanban offers a state filter (pills with `aria-pressed`) listing every
  `WorkOrderState` plus "all"; selecting a state shows only work orders in that state.
- AC-05-007.2 — The FRD and state filters combine with AND; clearing either restores the other's view.
- AC-05-007.3 — The pill state is conveyed by `aria-pressed` + text, not color alone; every pill is
  keyboard-operable.

## Tests (RED first)

- `src/app/projects/[slug]/_components/wo-state-filter/_tests/wo-state-filter.test.tsx` — renders all
  states + all; `aria-pressed` toggles; `onChange` contract.
- `src/app/projects/[slug]/_components/wo-frd-filtered-board/_tests/wo-frd-filtered-board.test.tsx` —
  new cases: state-only filter, FRD + state AND, reset.

## Visual reference

`docs/design/prototype/index.html` (workspace Work orders tab, the FRD filter pill row). The state
filter is a second pill row with the identical pill style.

## Status Note

**Built.** New client component `WoStateFilter`
(`src/app/projects/[slug]/_components/wo-state-filter/wo-state-filter.tsx`) — a second pill row,
identical pattern/markup/styling to `WoFrdFilter` (same `<fieldset>`/`Chip`/`TOGGLE_STYLE` shapes,
duplicated rather than shared per clean-code's "tolerate the second copy" — the two option sets
(FRD slugs vs. a fixed 5-state enum) are different enough not to force a shared abstraction yet).

- **Interface exposed:**
  ```ts
  export interface WoStateFilterProps {
    selected: WorkOrderState | null; // null = "All"
    onSelect: (state: WorkOrderState | null) => void;
  }
  export function WoStateFilter(props: WoStateFilterProps): React.JSX.Element;
  ```
  `data-testid`: `wo-state-filter` (container), `wo-state-filter-all` (the "Todos" pill),
  `wo-state-filter-option` (one per state, `aria-label="Filtrar por estado <Label>"`,
  `title="<Label>"` — same lookup-by-`textContent` pattern as `wo-frd-filter-option`).

- **Integration seam:** composed inside `WoFrdFilteredBoard`
  (`wo-frd-filtered-board.tsx`), which now owns TWO independent pieces of state
  (`selectedFrd: string | null`, `selectedState: WorkOrderState | null`) and derives
  `visibleOrders` by chaining two `.filter()` calls (AND) — clearing one filter ("All") does NOT
  reset the other, each is independent (AC-05-007.2). `WoFrdFilteredBoardProps` is unchanged
  (still just `{ orders: WorkOrder[] }`); the new state is fully internal.

- **Decisions/assumptions inherited by any consumer:**
  - **Labels are the literal strings rendered by `WoBoard`'s (non-exported) `COLUMNS` map** — "To
    do", "En progreso", "Review / Testing", "Falló", "Hecho" — re-declared verbatim in
    `wo-state-filter.tsx`'s local `STATE_OPTIONS` (not the WO scope note's own paraphrase "Por
    hacer · … · Revisión · Fallo", which does not match the shipped board copy; the board's actual
    strings win, per the WO's own "reuse the board's existing labels" instruction). If `WoBoard`'s
    labels ever change, `wo-state-filter.tsx` must be updated in the same change (no shared source
    today — `COLUMNS` in `wo-board.tsx` is not exported; promoting a shared label map is a
    reasonable rule-of-three follow-up once a third consumer needs these labels).
  - **State pill order** is the same canonical order as `WoBoard`'s columns: `todo, in_progress,
    review, fail, done`.
  - **AND semantics**: `visibleOrders = orders.filter(frd match).filter(state match)`; an empty
    intersection renders zero cards (no special empty-state copy added — out of this WO's scope,
    `WorkOrderBoard`'s existing per-column "—" placeholder already covers an empty column).
  - No new design tokens; both filters share `CONTAINER_STYLE`/`TOGGLE_STYLE` values (duplicated,
    not extracted) and the existing `Chip` primitive (`tone="accent"` selected, `"secondary"`
    unselected) — zero new visual surface.

- **Tests covering this WO:**
  - `src/app/projects/[slug]/_components/wo-state-filter/_tests/wo-state-filter.test.tsx` (13 cases:
    renders all 5 states + "all"; click → `onSelect` contract; `aria-pressed` on select/all/others;
    every pill is a real keyboard-operable `<button type="button">`).
  - `src/app/projects/[slug]/_components/wo-frd-filtered-board/_tests/wo-frd-filtered-board.test.tsx`
    (new `describe` blocks: state-only filter narrows/restores; FRD+state AND intersection incl. the
    empty-intersection case; clearing either filter independently restores the other's view).
  - Full scoped run: `pnpm vitest run` on both dirs → 33 passed; `pnpm biome check` and
    `pnpm tsc --noEmit` clean on the touched files/whole project.

- **Visual fidelity (DR-054/056, light in-loop check):** no project is registered in this canary
  sandbox's `factory/portfolio.md` (only `portfolio.example.md` exists), so the real
  `/projects/<slug>?tab=work-orders` route could not be rendered end-to-end here. Verified instead
  by rendering `WoFrdFilteredBoard` with fixture `WorkOrder[]` through the real DOM (RTL) and
  compositing the captured markup with the project's actual `globals.css` `@theme` color tokens in a
  static page, screenshotted via Playwright: the state pill row renders directly below the FRD pill
  row, identical container/pill treatment (per the WO's visual reference — "a second pill row with
  the identical pill style"), matching `docs/design/prototype/index.html`'s `WLBL` labels exactly.
  No gross structural divergence. Fine-fidelity sweep is the end-of-build Visual QA pass's job
  (DR-072); this component introduces no new tokens/colors for it to check.

- **Not touched (read-only, per scope):** `wo-frd-filter/**`, `wo-board/**` — only their exports
  (`WoFrdFilter`, `WorkOrderBoard`, `WorkOrder`/`WorkOrderState`) were imported.
