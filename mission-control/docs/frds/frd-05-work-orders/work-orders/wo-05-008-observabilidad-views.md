---
id: WO-05-008
type: work-order
slug: observabilidad-views
title: 'WO-05-008 Observabilidad frame: Por FRD, Tablero, Dependencias mount, drift badge, live refresh'
status: DRAFT
parent: FRD-05
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_panels/ObservabilidadPanel.tsx'
  - 'src/app/projects/[slug]/_observability/**'
  - 'src/app/projects/[slug]/_components/{wo-views,wo-board,wo-frd-filter,wo-state-filter,wo-frd-filtered-board,tab-work-orders,wo-empty}/**'
  - 'src/app/projects/[slug]/_components/_tests/{frd-05-state-filter.gate.reviewer.test.tsx,frd-05.reviewer.integration.test.tsx}'
  - 'e2e/observability.spec.ts'
source_requirements: [REQ-05-001, REQ-05-002, REQ-05-003, REQ-05-005, REQ-05-006, REQ-05-007, REQ-05-008, REQ-12-002, REQ-12-003, REQ-12-005]
dependsOn: [WO-04-010, WO-12-007, WO-02-017, WO-05-001, WO-22-002]
last_updated: 2026-10-22
---

# WO-05-008 Observabilidad frame: Por FRD, Tablero, Dependencias mount, drift badge, live refresh

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Rebuilds the project's Observabilidad tab as the Órbita work-order section: the `ObservabilidadPanel` with the
Por FRD (default) · Tablero · Dependencias switch kept in the URL, collapsed FRD rows with stacked bars and the
drift badge, combinable state tiles and the FRD select, the Tablero capped at 8 cards (4 on phones) with the
coral «Bloqueado» column for failed orders, the empty-project state, one live refresher for every view, and the
mounts of FRD-12's dependency map and the work-order detail. It removes the v1 timeline, the force-layout DAG and
the old Work orders tab body.

## In Scope

- **`ObservabilidadPanel`** (`src/app/projects/[slug]/_panels/ObservabilidadPanel.tsx`, async Server Component,
  rewrites WO-04-010's adapter, keeps the `PanelProps` signature): reads the project's work orders
  (`listWorkOrders`), the FRD index (`src/lib/frds/frd-index.ts`, WO-12-007) and each verified FRD's drift
  (`readFrdDrift`) once per request; renders the view from the URL keys `view`, `frd`, `state`; mounts
  `DependencyMap({ project, route })` for `view=deps` and `WoDetail({ project, woId, view })` when `wo` is set
  (both seams exist before this wave; see the blueprint Contracts); mounts `WoLiveRefresh` once for all of them.
  It uses exactly WO-25-001's Observabilidad keys (`view` frd|tablero|deps, `frd` one id, `state` one
  comma-joined set in canonical order, `wo`, `woview` summary|full, `dag` frd|wo, `focus`), never edits
  `src/lib/navigation/**`, and reports any other key in the ledger. The `frd` filter is also the target of the
  Resumen's «Avance por FRD» rows and «Ver todos» link (AC-04-014.4): rows open while filtered. The panel
  renders no `<main>`.
- **Toolbar** (`_components/wo-views/`): `Segmented` Por FRD · Tablero · Dependencias with their icons (URL
  `view`, default omitted), the «Filtrar por FRD» `SelectField` (`WoFrdFilter`, restyled in place, options «Todos
  los FRDs (N)» then one per FRD with work orders, «FRD-NN · title» from the FRD index; URL `frd`), and the muted
  work-order count of the current filter.
- **State tiles** (the shared core `StateTile`, `src/components/core/StateTile/`, created by WO-22-002 in W3,
  composed by the strip `WoStateFilter`, restyled in place): Planificado · En
  curso · En revisión · Verificado, plus «Bloqueado» only while an order failed; each a toggle with
  `aria-pressed`, dot, display count (of the FRD-scoped set) and bar; several may be pressed (URL `state`,
  comma-separated); the visible orders are those in any pressed state AND in the selected FRD.
- **Por FRD** (`_components/wo-views/`: `WoByFrd`, `FrdRow`, `WorkOrderRow`): every FRD row a native `details`,
  collapsed at rest, open while a filter is set; summary with chevron, mono code, title, drift badge, `StackBar`
  with its text alternative («10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado» pattern),
  «done/total» and «pct%»; one «Expandir todo» / «Colapsar todo» toggle (browser state, not URL); work-order rows
  with id, title, state chip and dependency count in a fixed-width column; a failed row carries the coral fill
  and border, the alert icon on its id and the «Bloqueado» chip. A filter combination that leaves no order (a
  pressed tile whose count is 0) shows the catalogue's no-match sentence of the Observabilidad filters with the
  `EmptyState` pattern, never a blank area (the prototype's `woByFrd` behaviour; not captured in a state, reported
  to the design ledger). Every row opens the order (`wo` key).
- **Drift** (`_observability/FrdDriftBadge/`, restyled): the amber «Verificado · N derivas» chip (icon + text)
  on a verified FRD with a non-empty `drift` list and the amber note listing the ids with «Ver en Cambios»
  linking to the project's Cambios tab; the coral «Deriva ilegible» chip and note on any FRD whose `drift` is
  unreadable; nothing when absent or empty. One reader, `readFrdDrift` (DR-115).
- **Tablero** (`_components/wo-board/`: `WorkOrderBoard`, `WorkOrderColumn`, `WorkOrderCard`, restyled in place):
  columns in the order of the state table, «Bloqueado» after Verificado only while an order failed (header in
  the danger hue with its alert icon); equal-width columns, horizontal scroll when they do not fit, text wraps;
  each column header with icon, word and count chip; at most 8 cards, 4 below 760 px, then `MoreBar`
  «Mostrar N más» (N = the rest) and, once open, «Mostrar menos» (column expansion is browser state); an empty
  column is one line «Sin work orders»; card = mono id, title, «FRD-NN · N dependencia(s)»; the `fail` variant
  of the same card adds the alert icon, the coral fill/border, the danger title and the blocked reason. No
  layout shift after hydration on phones (the 4-card cap is decided without a client re-render that moves cards).
- **Empty project** (`_components/wo-empty/`, restyled): the dashed `EmptyState` sentence and the
  `/pandacorp:architecture` `CommandBox`; no tiles, no rows.
- **Live** (`_observability/WoLiveRefresh/`, relocated from `tab-work-orders/`): unchanged behaviour (fresher
  event OR moved `stateVersion` → throttled `router.refresh()`), one subscription, mounted once by the panel.
- **Removals (map §0.6 / §6.C items 6 and 8), in this WO:** `_observability/TimelineView/**` (the Línea de
  tiempo), `_observability/ObservabilidadTab/**` (the RPG/timeline toggle tab), `_observability/WoDag/**` (force
  layout, `ZoomControls`, `Controls`, `useDagZoom`, its `useFullscreen` copy, `Legend`, «saltar al primer error»,
  follow mode), `_components/tab-work-orders/tab-work-orders.tsx` (`TabWorkOrders`, the old tab body),
  `_components/wo-frd-filtered-board/**` (`WoFrdFilteredBoard`, local filter state), the pill filters and the v1
  five-column «Falló» board; their now-unused exports and their tests. `src/app/_observability/**` (the unmounted
  global code) is WO-13-013's, not this WO's.

## Out of Scope

- The work-order detail internals (`wo-detail/**`) and `src/lib/work-orders/**`: WO-05-009 (same wave).
- The dependency map itself (`_components/deps/**`, `src/lib/deps-layout/**`, the FRD index): WO-12-007.
- The workspace frame, tab bar, Observabilidad count badge, the legacy `tab=Work orders` alias (AC-12-006.4):
  WO-04-010. La Fragua (AC-12-002.2's positive side): WO-06-013 / WO-04-011.
- Any visual baseline under `e2e/visual.spec.ts-snapshots/**` (reviewer only, map §3.3 rule 4).

## Requirements & Acceptance Criteria

REQ-05-001, REQ-05-002, REQ-05-003, REQ-05-005, REQ-05-006, REQ-05-007, REQ-05-008; REQ-12-002, REQ-12-003,
REQ-12-005. Owned criteria, copied from the current FRDs:

- **AC-05-008.1** — THE Observabilidad tab SHALL offer the views Por FRD (the default), Tablero and Dependencias (FRD-12), and SHALL keep the selected view in the URL.
- **AC-05-008.2** — THE Por FRD view SHALL start with every FRD collapsed (each group showing its stacked state bar and "n/m %"), SHALL offer one "Expandir todo" / "Colapsar todo" toggle and a "Filtrar por FRD" select, and SHALL show the four state tiles with counts as filters that combine with each other and with the select.
- **AC-05-008.3** — THE Tablero SHALL show at most 8 cards per column (4 on phones) followed by "Mostrar N más", and SHALL collapse an empty column to one line.
- **AC-12-002.1** — WHERE a project is open, Mission Control SHALL expose an **"Observabilidad" project tab**, third in the tab order after Spec (FRD-04 REQ-04-002).
- **AC-12-002.2** — La Fragua SHALL NOT live in Observabilidad: it heads the project Resumen (FRD-06), and there is no Party tab.
- **AC-12-002.3** — The Observabilidad tab SHALL provide the views **Por FRD · Tablero · Dependencias** over the **same work-order data** (no timeline view, no RPG view).
- **AC-12-003.3 (pre-existing drift badge, DR-122)** — WHEN a FRD's rolled-up state is verified AND its
  `docs/frds/<frd>/frd.md` frontmatter carries a non-empty `drift: [REQ-…, AC-…]` list (written only by the
  build engine's certifying landing), THE **Por FRD row** of that FRD SHALL show **"Verificado · N derivas"** (N = the
  list length, icon + text, never color alone) as a link to the project's **Cambios** tab, where the
  `origin: gate-drift` cards live (state `wo-frd-drift`, M1 2026-10-22). The badge SHALL derive from that one field through ONE shared reader
  (`lib/frds/frd-drift.ts`, DR-115; no stored copy) and SHALL NOT appear when the list is empty/absent or the
  FRD is not verified. The reader SHALL fail loud (DR-078): a `drift` value that is not a list of
  `REQ-NN-MMM` / `AC-NN-MMM(.K)` ids, invalid frontmatter or an unreadable `frd.md` SHALL render a
  **"Deriva ilegible"** error chip on that FRD (any state), never a silent empty list; a FRD folder with no
  `frd.md` shows nothing.
- **AC-12-005.1** — WHILE the build is running THE views SHALL update **live / event-driven**: the structure comes from the work-order frontmatter and refreshes when the SSE `stateVersion` moves or a newer event arrives in `~/.claude/dashboard-events.ndjson` — not a one-shot snapshot.
- **AC-12-005.2** — IF no new event has arrived THEN the views SHALL stay consistent with the freshness indicator of AC-12-001.2 (no fabricated progress).

Also satisfied here without owning the criterion (prose only): REQ-05-001/002 behaviour drawn in `wo-failed` and
`wo-failed-row`; the Dependencias view criteria of FRD-12 are WO-12-007's; the detail (AC-05-008.4) is WO-05-009's.

**Completeness and NFRs (DR-100/DR-102).** Error path per reader: the work-order reader, the FRD index and the
drift reader each surface their designed error (drift → «Deriva ilegible»; others → the coral `Notice` pattern),
never an empty list (DR-078). Input validation: unknown `view`/`state`/`frd` values from the URL fall back to the
default view / no filter (never a crash). Read-only: no form posts, no mutation, no drag (REQ-05-006).
Accessibility: tiles and the view switch are `button`s with `aria-pressed`; rows are `summary`/`button`s in
reading order; state never by colour alone (icon + word); the stacked bars carry text alternatives; 44 px
targets on touch; focus ring from the token. Performance: one read per request (`React.cache()`), no client data
fetching, the server delivers the filtered view (no client loading skeleton). Reduced motion: no animation is
added. Live: one SSE subscription per mounted panel.

## Components built (blueprint)

CMP-05-observability-panel, CMP-05-view-toolbar, CMP-05-state-tiles, CMP-05-frd-rows, CMP-05-board,
CMP-05-empty, CMP-05-live-refresh; consumes IF-05-work-orders, IF-12-frd-index, IF-12-drift,
CMP-12-dependency-map, CMP-05-detail (`WoDetail`).

**Reuse (components.md: reuse → adapt → create).** Reuse `Segmented`, `SelectField`, `Chip`, `StateDot` (with
the shared work-order state map), `StackBar`, `MoreBar` (the Tablero's reveal-all variant: «Mostrar N más» then
«Mostrar menos», ledger on WO-13-011), `Button`, `CommandBox` (WO-13-011), `EmptyState`, `Notice` (WO-13-012),
`StateTile` (core, WO-22-002). Adapt in place: `WorkOrderBoard`/`WorkOrderCard` (fail variant is the same card),
`WoFrdFilter` (pills → select), `WoStateFilter` (pills → tile strip), `WorkOrderEmpty`, `FrdDriftBadge`. Create
only the components.md rows `FrdRow`, `WorkOrderRow`, `WorkOrderColumn` (relocated to these route folders, names
unchanged). Installs: none.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-05-work-orders/mocks/work-orders.html` sections `wo-by-frd`,
  `wo-by-frd-expanded`, `wo-state-filter`, `wo-kanban`, `wo-kanban-expanded`, `wo-empty`, `wo-failed`,
  `wo-failed-row` (screenshots `mocks/screenshots/<id>-{375,768,1280}-{light,dark}.jpg`); FRD-12's
  `docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html` sections `wo-frd-drift`,
  `wo-frd-drift-unreadable` (the drift rows, drawn in FRD-12's states).
- **Prototype functions:** `ordersView`, `woRow`, `woByFrd`, `woKanban`, `driftBadge`, `driftNote`
  (`docs/design/prototype/prototype.js`); CSS `docs/design/prototype/reference/css/` 11-progress, 13-list-row,
  14-empty-notice, 26-work-orders. Keep the recorded hooks: `.seg`, `.state-strip`, `.state-tile`, `.frd-tools`,
  `.frd-rows`, `details.frd-row`, `.wo-list`, `.worow`, `.is-failed`, `.wo-kanban`, `.kcol`, `.wocard`,
  `.wo-block`, `.morebtn`, `.kempty`, `.drift-chip`, `.drift-note`, and `data-tone` per state.
- **Token slice:** `--surface`, `--surface-2`, `--line`, the state hues slate / blue / amber / green / coral via
  `data-tone` and `--tint-strong`, card radius 16, chip 24 px, 12 px type floor, `tabular-nums` on counts,
  JetBrains Mono for ids only. Icons from `Icon` (list, columns, link, plus, minus, alert, chevrons).
- **FDD pointer:** `docs/frds/frd-05-work-orders/fdd.md` (Screens, States, Responsive: columns share the width at
  1280, masonry on tablet, stacked on phones with two tiles per row).
- **Fidelity criterion:** the built tab visually matches the mock sections above (layout, structure, components,
  density) on the frozen tokens, not an approximation; verified by the preview smoke gate (DR-055) per FRD and the
  close-out fidelity diff in oracle mode (`pnpm dev:oracle`, map §0.4).

## Tests

- **Behaviour e2e (this UI feature's one spec):** `e2e/observability.spec.ts`, starting with `gotoHydrated`,
  `getByRole` first, no hard waits, on the e2e factory root's `mission-control` fixture: the tab opens on Por FRD
  with collapsed rows; switching to Tablero and Dependencias writes `view` and survives reload and Back; a state
  tile press writes `state` and narrows the rows; «Expandir todo» opens every row; a row opens the detail (`wo`).
- **Unit / component (Vitest + RTL, real production-shaped fixtures, a malformed one that must fail loud):** tiles
  combine (union of states, AND with FRD); the fifth tile and column appear only with a failed order; the 8 / 4
  cap and «Mostrar N más» counts (the FRD-05 worked example: 21 → 8 + «Mostrar 13 más», phone 4 + «Mostrar 17
  más»); empty column one line; the fail variant carries icon + word; drift badge only on a verified FRD with a
  non-empty list, «Deriva ilegible» on an unreadable value in any state; live refresh on fresher event and on a
  moved `stateVersion` (backward transition); the views never show a timeline or RPG view.
- **Derogated tests (map §3.3, BL-0051), listed for the reviewer:**
  - `git rm` (their subject module is deleted here): `src/app/projects/[slug]/_observability/_tests/frd-12-gate-opus.reviewer.test.tsx`
    (`ObservabilidadTab`, timeline, Dagre DAG), `src/app/projects/[slug]/_components/_tests/frd-05-state-filter.gate.reviewer.test.tsx`
    (`TabWorkOrders`, `WoFrdFilteredBoard`), `src/app/projects/[slug]/_components/_tests/frd-05.reviewer.integration.test.tsx`
    (`TabWorkOrders`; its `readWorkOrderDoc` security cases are re-homed by WO-05-009 in `src/lib/work-orders/_tests/`).
  - Re-blessed by the FRD-05 gate reviewer, never edited here: `src/app/projects/[slug]/_components/_tests/frd-05-gate-opus.reviewer.test.tsx`,
    `src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx` (the v1 exports they import
    stay exported with type-compatible props so they compile).
  - Implementer tests: update `wo-board`, `wo-frd-filter`, `wo-state-filter`, `wo-empty`, `FrdDriftBadge` tests;
    move `tab-work-orders/_tests/wo-live-refresh.test.tsx` with `WoLiveRefresh`; delete the tests of every removed
    module (`TimelineView`, `ObservabilidadTab`, `WoDag/*`, `tab-work-orders`, `wo-frd-filtered-board`).
  - Visual baselines: untouched (re-blessed at close-out by the reviewer).

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green (biome, tsc, knip, madge, the affected tests, structure guard);
  the e2e spec passes; the preview smoke and shell gates are clean.
- Every owned criterion above is met by a test that fails without this change.
- The §6.C removals are gone: no import of `TimelineView`, `ObservabilidadTab`, `WoDag`, `useDagZoom`,
  `TabWorkOrders`, `WoFrdFilteredBoard` remains (grep evidence in the Status Note); knip/madge clean.
- No reviewer-authored test edited (only the three listed `git rm`), no baseline touched, no hardcoded string
  (every string through `t()`), no arbitrary Tailwind value, tokens only.

## Dependencies

WO-04-010 (W5: frame, panel stub, `WoDetail` adapter), WO-12-007 (W3: `DependencyMap`, FRD index), WO-02-017
(W3, map §2), WO-05-001 (reader, VERIFIED), WO-22-002 (W3: the core `StateTile`; edge added to the map's list
because this WO imports it, DR-087; the wave stays W6). Builds in W6 in parallel with WO-05-009 (disjoint
artifacts).

## Status Note
