---
id: WO-05-007
type: work-order
slug: wo-state-filter
title: 'WO-05-007 — Work-orders kanban: secondary filter by state'
status: DRAFT
parent: FRD-05
implementation_status: PLANNED
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

_Pending — PLANNED._
