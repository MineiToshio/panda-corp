---
id: FRD-12-blueprint
type: blueprint
slug: observability-dataviz
title: FRD-12 Observability and data visualization feature blueprint, v2 Órbita
status: ACTIVE
parent: FRD-12
implementation_status: IN_REVIEW
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---
# FRD-12 — Observability and data visualization · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049) on top of [`../../product/architecture.md`](../../product/architecture.md) (§5
> build-event contract, §6: `deps-layout`, `work-orders`, `frds`; Route map rows for Observabilidad). Binding
> visual spec: [`fdd.md`](fdd.md) + [`mocks/observability-dataviz.html`](mocks/observability-dataviz.html). Cross-FRD
> plan: `.pandacorp/run/architecture/wo-map.md` (§2 FRD-12, §5, §6.C items 8 and 9, §8.4).

## Purpose

FRD-12 is Mission Control's honest observability layer. In v2 it is mostly realized by other features' surfaces,
and owns one new piece of its own:

- **Dependencias** (owned here, WO-12-007): the deterministic two-level dependency map of the Observabilidad tab.
  «Por FRD» draws one box per FRD, two per row, with the FRD's work orders in chain order and the cross-FRD
  dependencies aggregated to one line per directed pair; «Por work order» draws the orders in depth columns with
  curved edges. Both are computed from structure only (ids, `dependsOn`, FRD), so a state change only recolours.
  Clicking an order lights its chain and pins it in the URL with the «Work order en foco» card; below 900 px both
  levels are ordered lists. No Dagre / ELK at runtime, no zoom / fit / fullscreen toolbar, no «saltar al primer
  error», no follow mode (FRD «Out of v2»).
- **The Observabilidad frame, its views over the same data, the drift badge and the live refresh** are built in
  FRD-05's WO-05-008 (it owns AC-12-002.x, AC-12-003.3, AC-12-005.x).
- **Freshness and the Inicio Pulso** (AC-12-001.2, AC-12-001.3) are owned by FRD-18's WO-18-002, on top of
  FRD-06's single build-signal resolver (`src/lib/fragua/build-signal.ts`, WO-06-013).
- **The legacy `tab=Work orders` link** (AC-12-006.4) is the workspace frame's (WO-04-010).

Retired: the KPI header (AC-12-001.1), the event metrics (AC-12-001.4), the Línea de tiempo (AC-12-003.1); their
v1 code is deleted by WO-05-008 (`src/app/projects/[slug]/_observability/{TimelineView,ObservabilidadTab,WoDag}`)
and WO-13-013 (the unmounted `src/app/_observability/**`, `pnpm remove @dagrejs/dagre`).

## Components & Interfaces

| ID | Kind | Name · location | Responsibility | Traces |
|---|---|---|---|---|
| CMP-12-dependency-map | RSC | `DependencyMap({ project, route })` · `src/app/projects/[slug]/_components/deps/DependencyMap.tsx` | Self-loading: the `Card` «Grafo de dependencias» with its count chip («N FRDs» or «N work orders»), the `Segmented` named «Nivel del grafo» (Por FRD · Por work order, URL `dag`), the level's intro line, the bounded canvas and the narrow list, the focus card. Reads `listWorkOrders` and the FRD index; the layout from `src/lib/deps-layout`. | REQ-12-004, REQ-12-006 |
| CMP-12-frd-box | RSC | `DependencyFrdBox` / `DependencyFrdItem` · `deps/` | A compound box per FRD (head button with code tag, title, «done/total», state `StackBar`), its work orders as mini nodes in chain order on a three-column grid (state dot, mono id, clamped title; activation opens the order), the aggregated cross-FRD curves with their count and «⇄ back» label and tooltip; below 900 px `ol.dag-list` of `details.dl-frd` (Depende de / Desbloquea FRD chips or the starting-point sentence, the FRD's work orders). | REQ-12-004, REQ-12-006 |
| CMP-12-node | RSC | `DependencyNode` · `deps/` | 176 × 46 node tinted by state (dot, mono id, title without the `WO-NN-MMM —` prefix, clamped, full «id · title · state» as tooltip), focus / dim / out-of-scope (dashed) variants; below 900 px the steps list «Paso N · M work orders» of rows. | REQ-12-004 |
| CMP-12-canvas | client island | `DependencyCanvas` · `deps/` | The bounded, keyboard-scrollable region (`role="region"`, its accessible name) at natural size; hover lights a chain transiently; click pins it by writing `focus` (and clicking it again, the background, Escape or «Quitar foco» clears it); FRD head activation writes `dag=wo` + `frd`. No zoom, wheel zoom, drag-pan or fullscreen. | REQ-12-004, REQ-12-006 |
| CMP-12-focus-card | RSC | `DependencySide` · `deps/` | The «Work order en foco» card: state chip, id, title, «Abrir work order» (`wo` key), «Depende de · N» and «Desbloquea · N» lists (or their empty sentences); placed above the list below 900 px. | REQ-12-006 |
| IF-12-deps-layout | lib | `src/lib/deps-layout/` | Pure, byte-deterministic placement from STRUCTURE ONLY (ids, `dependsOn`, FRD; plus the FRD filter at the work-order level): the FRD-level boxes, item positions, dominant-direction links with counts, and the work-order depth columns, edges, steps and chain sets. The prototype's arithmetic ported verbatim (technical-assumptions §4.3). | REQ-12-004 |
| IF-12-frd-index | lib | `listProjectFrds(projectPath)` · `src/lib/frds/frd-index.ts` | THE project FRD index (DR-115): folder slug, code `FRD-NN`, display title by the prototype's precedence (the Spec digest's FRD title, else the Architecture digest's, else the `frd.md` H1 without its code, else the humanized slug), deduped per request. Consumers: this map, the Observabilidad select and rows (WO-05-008), the work-order detail (WO-05-009), the Comandos targets (WO-11-004). | REQ-12-004, REQ-12-006 |
| IF-12-drift (existing) | lib | `readFrdDrift` · `src/lib/frds/frd-drift.ts` | The one drift reader (fail loud); rendered by WO-05-008. | REQ-12-003 |

Reuse: `Card`/`CardHeader`, `Notice` (WO-13-012), `Segmented`, `SelectField`, `Chip`, `StateDot` with the shared
work-order state map, `StackBar`, `Button` (WO-13-011), `Icon`; `t()` copy (`workspace.observabilidad.dag*`).
No graph or positioning library.

## Contracts

- **Seam (map §0.3):** `DependencyMap({ project, route })`; `project` structural `{ slug, path }`; `route` carries
  the FRD-25 keys `dag` (`frd` default · `wo`), `focus` (a work-order id; ignored when not in the shown set),
  `frd` (FRD folder slug, the work-order level filter). It loads its own data; WO-05-008 mounts it for
  `view=deps`. All URL writes go through the FRD-25 codec; none runs a mutation.
- **`src/lib/deps-layout` inputs/outputs:** input = the list of `{ id, frd, dependsOn }` (+ the FRD order of the
  index); output = plain serializable geometry (canvas size, boxes with their item coordinates, links with path
  data, label point, count and back count; nodes, edges with path data, columns/steps; upstream and downstream
  sets for a focus). Same input ⇒ identical output byte for byte; work-order state is never an input. Dependencies
  naming an id outside the listed set are dropped (no dangling edge); nothing is invented for an order without
  `dependsOn` (DR-087).
- **Errors:** the work-order reader never throws; an empty set renders the catalogue's no-dependencies sentence
  in the `EmptyState` pattern (the panel shows its own empty project state first, so this is defensive).
- **Live:** the map is server-rendered and refreshed by the Observabilidad panel's single live refresher
  (WO-05-008); because placement ignores state, a refresh recolours nodes and never moves a box.

## Visual spec (DR-054)

| WO | Reproduce | Oracle states | Recorded hooks |
|---|---|---|---|
| WO-12-007 | [`fdd.md`](fdd.md) «Dependencias» and States, [`mocks/observability-dataviz.html`](mocks/observability-dataviz.html) | `observability-deps-frd`, `observability-deps-wo`, `observability-deps-focus`, `observability-deps-frd-open`, `observability-deps-list-open` | `.dag-wrap`, `.dag[role=region]`, `.dag-canvas`, `svg.dag-edges`, `.fdag-box`, `.fdag-head[data-dag-frd]`, `.fcode`, `.fdag-title`, `.fdag-bar`, `path.fdag-link`, `text.fdag-n`, `.dag-node` (`.mini`, `.focus`, `.dim`, `.out`), `.dag-id`, `.dag-t`, `path.dag-edge` (`.on`, `.dim`), `ol.dag-list`, `details.dl-frd`, `.dl-rel`, `.dag-side`, `.dag-focus`, `.dag-note` |

Prototype reference: `dagLevels`, `frdDagView`, `depsView` in `docs/design/prototype/prototype.js`. Token slice:
teal card hue, state hues on nodes, ONE highlight colour for a lit chain, uniform accent edges at rest, mono ids,
12 px floor. Canvases are compared by computed styles and the checks above (FDD «Measured by styles»).

## Dependencies & Risks

- **Upstream:** WO-13-012 (primitives), WO-25-001 (URL keys), WO-05-001 (reader, VERIFIED). It reads the existing
  Spec and Architecture digest parsers for FRD titles while WO-02-017 reworks those modules in the same wave
  (ledger: keep their FRD list shape stable).
- **Risk: pixel determinism** (technical-assumptions §4.3): any iteration-order or float difference moves boxes;
  the port is verbatim and a golden test pins coordinates.
- **Risk: no route before W6.** The map is mounted by WO-05-008 (W6); its behaviour e2e lives in
  `e2e/observability.spec.ts` (WO-05-008), and WO-12-007 proves its criteria with resolver and component tests.
- **Risk: superseded work orders** appear as nodes until WO-05-009 (W6) drops them from the reader.

## Traceability

| REQ | Components / interfaces | Live ACs → owner |
|---|---|---|
| REQ-12-001 | IF-06-build-signal (WO-06-013), Inicio `Pulso` and cards (FRD-18) | AC-12-001.2, AC-12-001.3 → WO-18-002 |
| REQ-12-002 | CMP-05-observability-panel, CMP-05-view-toolbar (FRD-05), FRD-04 tab bar | AC-12-002.1, AC-12-002.2, AC-12-002.3 → WO-05-008 |
| REQ-12-003 | IF-12-drift, FRD-05's drift badge (`FrdDriftBadge`) | AC-12-003.3 → WO-05-008 |
| REQ-12-004 | CMP-12-dependency-map, CMP-12-frd-box, CMP-12-node, CMP-12-canvas, IF-12-deps-layout, IF-12-frd-index | AC-12-004.1, AC-12-004.2, AC-12-004.3, AC-12-004.4, AC-12-004.5, AC-12-004.6, AC-12-004.7, AC-12-004.8 → WO-12-007 |
| REQ-12-005 | CMP-05-live-refresh (FRD-05), structure-only layout (IF-12-deps-layout) | AC-12-005.1, AC-12-005.2 → WO-05-008 |
| REQ-12-006 | CMP-12-dependency-map, CMP-12-canvas, CMP-12-focus-card, FRD-04 legacy alias | AC-12-006.1, AC-12-006.2, AC-12-006.3 → WO-12-007 · AC-12-006.4 → WO-04-010 |

Struck and retired (owned by nobody): AC-12-001.1, AC-12-001.4, AC-12-003.1 (map §8.4).

## Build Plan

> The build engine reads this table; it matches each work order's frontmatter exactly.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-12-007 | WO-13-012, WO-25-001, WO-05-001 | `src/app/projects/[slug]/_components/deps/**`, `src/lib/deps-layout/**`, `src/lib/frds/frd-index.ts`, `src/lib/frds/_tests/frd-index.test.ts` | false | W3 · with WO-06-013, WO-02-017 and the other W3 surface WOs |

- **Order:** WO-12-007 builds in W3 (after the W2 primitives) as a module; WO-05-008 mounts it in W6; WO-05-009 and
  WO-11-004 read its FRD index.
- **Disjoint by design:** only `_components/deps/**`, `src/lib/deps-layout/**` and the two `frd-index` files; no
  other W3 work order writes `src/lib/frds/` (the existing `frd-drift.ts` is read-only here).
- **Cross-FRD:** the frame and the views of FRD-12's other criteria are FRD-05's and FRD-04's; freshness is
  FRD-06's resolver consumed by FRD-18.

## Reconciliation (2026-10-22, binding)

- WO-12-007 uses exactly WO-25-001's keys `dag`, `focus`, `frd` and never edits `src/lib/navigation/**`; its
  `listProjectFrds()` (`src/lib/frds/frd-index.ts`) is the one FRD index read by WO-04-010, WO-04-011 (and La
  Fragua through it), WO-05-008 and WO-11-004; WO-02-017 keeps the digests' FRD-list shape stable in W3.

## Superseded (v1 history)

- WO-12-001 Top-N cap helper + freshness selector · superseded by WO-13-013 (dead `src/app/_observability`).
- WO-12-002 KPI selector · superseded by WO-13-013.
- WO-12-003 Events-per-minute selector · superseded by WO-13-013.
- WO-12-004 Timeline selector · superseded by WO-13-013.
- WO-12-005 Observabilidad tab + Timeline view · superseded by WO-05-008.
- WO-12-006 Work-order DAG view (Dagre) · superseded by WO-12-007 and WO-05-008.

## Readiness check (DR-100)

Every REQ-12-MMM with a live criterion maps to a component or interface (here or in its owning feature); each live
criterion is owned by exactly one work order (README AC table, cross-FRD owners by the map); `dependsOn` names only
live work orders; the W3 artifacts are disjoint; no open clarification marker survives; no API contract.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
