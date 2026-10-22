# Context pack · FRD-05 · Work orders (live view)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-05 copy, S2.1 builds, S2.2 amendments, S2.3-05 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-05-work-orders/frd.md` (id FRD-05, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 9 under `states["frd-05-work-orders"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 8 AC lines: 4 drawn · 1 partially drawn · 1 not drawn · 2 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-05#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-05-001 · partial · `wo-kanban`, `wo-kanban-expanded`

> - **REQ-05-001** — The kanban SHALL show **five** columns, in this order: **To do · In progress · Review · Fail · Done**, all the **same width** and **wide** (not tiny), with **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.

**Prototype:** Board has four state columns Planificado · En curso · En revisión · Verificado, equal width; a fifth "Bloqueado" column only appears if a failing order exists. Tablet flows as a two-column masonry, phone stacks (empty columns collapse to one line). It is the "Tablero" view of three (Por FRD · Tablero · Dependencias); the default view is "Por FRD".

### REQ-05-002 · not drawn · `wo-kanban`

> - **REQ-05-002** — WHEN a work order is in the **Fail** column, its card SHALL carry the **failed-card danger treatment** (danger background + border, a warning icon and danger-colored text on the title), and the Fail column header SHALL itself read in the danger color, so a failure is visually unmistakable.

**Prototype:** The failed-card danger treatment (danger background/border, warning icon, danger title, danger column header) exists in code (state "Bloqueado", coral, alert icon) but NO fixture project has a failing work order, so no captured state draws it.

### REQ-05-003 · drawn · `wo-by-frd`, `wo-kanban`

> - **REQ-05-003** — EACH work order card SHALL indicate which **FRD** it belongs to; since work orders now live **per feature** under `docs/frds/frd-NN-<slug>/work-orders/` (DR-049), the kanban MAY group/filter the cards by their FRD (the FRD grouping is now the natural one).

**Prototype:** Cards carry "FRD-03 · 1 dependencia"; the list view groups by FRD (collapsed rows with stacked state bar, n/m, %), "Expandir todo / Colapsar todo", and a "Filtrar por FRD" select.

### REQ-05-004 · drawn · `wo-detail`, `wo-detail-full`

> - **REQ-05-004** — WHEN the owner clicks a work order, it SHALL show a **Summary** and a **Full document** tab that renders the entire work order (acceptance criteria, scope, definition of done, evidence).

**Prototype:** Detail with "Resumen" and "Documento completo" tabs. Resumen reads in order: De qué trata · Qué cambia · Cómo se comprueba (one card per AC with EARS keywords marked) · Qué se construyó, a flow header (Planificado → En curso → En revisión → Verificado) with a one-sentence "Ahora:", a fact sheet (Estado, Dificultad, Reaperturas, Actualizada, Requisitos, Archivos que toca, Dependencias, Construir esta orden). Full document renders the whole order.

### REQ-05-005 · drawn · `wo-by-frd`, `wo-detail`

> - **REQ-05-005** — It SHALL show the project's progress (work orders done / total and %), aggregated across every feature's `work-orders/`.

**Prototype:** "110 órdenes" with the four state tiles and the project header "109/110 WO · 99%".

### REQ-05-006 · behaviour only · `wo-by-frd`

> - **REQ-05-006** — The kanban SHALL reflect the live state (written by the agents in each feature's `docs/frds/frd-NN-<slug>/work-orders/`); the owner does NOT edit it.

**Prototype:** Read-only: nothing edits an order; the "Construir esta orden" command is copy-only.

### REQ-05-007 · drawn · `wo-state-filter`

> - **REQ-05-007** — The kanban SHALL offer a secondary filter by work-order state (`todo · in_progress · review · fail · done`, plus "all"), as `aria-pressed` pills in the same pattern as the FRD filter, combinable with it by logical AND (WO-05-007).

**Prototype:** State tiles (Planificado/En curso/En revisión/Verificado + counts and bars) are `aria-pressed` filters combinable with the FRD select; `state=review` narrows the list.

### FRD-05#U1 · behaviour only · `wo-by-frd`

> - **Real-time / event-driven**: the work-order board SHALL update LIVE as the agents change work-order state — when a work order moves column (e.g. into Review, Fail or Done) the board SHALL reflect it without the owner reloading the page. **(reconciled from code 2026-07-07)** — the board (`WoLiveRefresh`) refreshes on TWO triggers, not just fresher events: a genuinely newer event, OR a moved SSE `stateVersion` (the max mtime of `status.yaml` + WO frontmatter, via the shared `lib/status/state-version-moved.ts`). The `stateVersion` trigger is what makes a **backward** transition visible — a gate reopen (`IN_REVIEW → PLANNED`) rewrites only the frontmatter and emits no event, so an event-only board would leave the reopened WO stranded in the wrong column. The open **WO detail pane** mounts the same `WoLiveRefresh` (`ProjectWorkspace.renderWorkOrdersTab`), so an open work order's status badge updates live too — same SSE transport, no second subscription.

**Prototype:** Live refresh on SSE/stateVersion is not a visual state (not drawn; "Not captured: live refresh" in the proposal).

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `wo-by-frd` | `#portfolio?project=mission-control&tab=Observabilidad` | (none) | full page | `REQ-05-003` `REQ-05-005` `REQ-05-006` `FRD-05#U1` |
| `wo-by-frd-expanded` | `#portfolio?project=mission-control&tab=Observabilidad` | click `[data-action="frd-toggle-all"]` | full page | — |
| `wo-state-filter` | `#portfolio?project=mission-control&tab=Observabilidad&state=review` | (none) | full page | `REQ-05-007` |
| `wo-kanban` | `#portfolio?project=personal-page-v2&tab=Observabilidad&view=tablero` | (none) | full page | `REQ-05-001` `REQ-05-002` `REQ-05-003` |
| `wo-kanban-expanded` | `#portfolio?project=mission-control&tab=Observabilidad&view=tablero` | click `[data-wo-more]` | full page | `REQ-05-001` |
| `wo-detail` | `#portfolio?project=mission-control&tab=Observabilidad&wo=WO-02-014` | (none) | full page | `REQ-05-004` `REQ-05-005` |
| `wo-detail-full` | `#portfolio?project=mission-control&tab=Observabilidad&wo=WO-02-014&woview=Documento+completo` | (none) | full page | `REQ-05-004` |
| `wo-detail-not-found` | `#portfolio?project=mission-control&tab=Observabilidad&wo=WO-99-999` | (none) | full page | — |
| `wo-empty` | `#portfolio?project=pandacast&tab=Observabilidad` | (none) | full page | — |

**Not drawn (1)**: `REQ-05-002`.

**Partially drawn (1)**: `REQ-05-001`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `wo-empty`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Ruta
- MC
- 109/110 WO · 99%
- Fase: Construcción
- 1. Investigación · completada
- Investigación: completada
- 2. Producto · completada
- Producto: completada
- 3. Diseño · completada
- Diseño: completada
- 4. Arquitectura · completada
- Arquitectura: completada
- 5. Construcción · fase actual
- Construcción: fase actual
- 6. Lanzamiento · pendiente
- Lanzamiento: pendiente
- Cambiar proyecto
- Ver secciones anteriores
- Ver más secciones
- Secciones de Mission Control
- Spec
- Observabilidad 110
- Cambios 3
- Documentos 175
- FRD-02 · Ideas board
- Planificado
- En curso

### `wo-by-frd`

- [@aria-label] Vista de work orders
- [span] Filtrar por FRD
- [option] Todos los FRDs (23)
- [option] FRD-01 · Data reading (×22 of the same pattern)
- [span] 110 órdenes
- [@aria-label] Filtrar por estado
- [button] Expandir todo
- [@aria-label] 10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×10 of the same pattern)

### `wo-by-frd-expanded`

- [button] Colapsar todo

### `wo-state-filter`

- [@aria-label] Vista de work orders
- [span] Filtrar por FRD
- [option] Todos los FRDs (23)
- [option] FRD-01 · Data reading (×22 of the same pattern)
- [span] 1 orden
- [@aria-label] Filtrar por estado
- [button] Expandir todo
- [@aria-label] 8 verificado, 1 en revisión, 0 en curso, 0 bloqueado, 0 planificado

### `wo-kanban`

- [span] PV
- [span] 19/25 WO · 76%
- [@aria-label] Fase: Lanzamiento
- [@data-tip] 5. Construcción · completada
- [span] Construcción: completada
- [@data-tip] 6. Lanzamiento · fase actual
- [span] Lanzamiento: fase actual
- [@aria-label] Secciones de PersonalPage v2
- [button[tab]] Observabilidad 25
- [button[tab]] Cuentas 3
- [button[tab]] Cambios 6
- [button[tab]] Documentos 53
- [@aria-label] Vista de work orders
- [span] Filtrar por FRD
- [option] Todos los FRDs (8)
- [span] 25 órdenes
- [@aria-label] Filtrar por estado
- [@aria-label] Planificado: 6
- [h2] Planificado 6
- [small] FRD-03 · 1 dependencia (×6 of the same pattern)
- [@aria-label] En curso: 0
- [div] Sin órdenes
- [@aria-label] En revisión: 0
- [@aria-label] Verificado: 19
- [h2] Verificado 19
- [button] Mostrar 11 más

### `wo-kanban-expanded`

- [@aria-label] Vista de work orders
- [span] Filtrar por FRD
- [option] Todos los FRDs (23)
- [option] FRD-01 · Data reading (×22 of the same pattern)
- [span] 110 órdenes
- [@aria-label] Filtrar por estado
- [@aria-label] Planificado: 0
- [div] Sin órdenes
- [@aria-label] En curso: 0
- [@aria-label] En revisión: 1
- [h2] En revisión 1
- [small] FRD-02 · 1 dependencia (×23 of the same pattern)
- [@aria-label] Verificado: 109
- [h2] Verificado 109
- [button] Mostrar menos

### `wo-detail`

- [@aria-label] Avance de la orden
- [p] Ahora: Ya está construida. Espera la revisión de su FRD, que mira todas sus órdenes juntas.
- [@aria-label] Vista de la orden
- [button[tab]] Documento completo
- [h2] De qué trata
- [h2] Qué cambia
- [h2] Cómo se comprueba
- [span] WHILE
- [span] WHEN
- [span] SHALL
- [span] IF
- [span] THEN
- [h2] Qué se construyó
- [p] El contenido viene del documento de la orden, escrito en inglés; los títulos son de Mission Control.
- [button] Leer el documento completo
- [h3] Ficha
- [dt] Dificultad
- [dd] "low"
- [dt] Reaperturas
- [dt] Actualizada
- [dd] 25 set. 2026
- [dt] Requisitos
- [p] Archivos que toca
- [span] Depende de
- [span] Desbloquea
- [h3] Construir esta orden
- [code] /pandacorp:implement WO-02-014
- [@aria-label] Copiar /pandacorp:implement WO-02-014

### `wo-detail-full`

- [@aria-label] Avance de la orden
- [@aria-label] Vista de la orden
- [button[tab]] Documento completo
- [@aria-label] Copiar documento
- [h2] Scope

### `wo-detail-not-found`

- [strong] Esta orden no está publicada
- [span] WO-99-999 no aparece entre los work orders capturados de Mission Control.
- [a] Ver work orders

### `wo-empty`

- [span] PC
- [span] Sin work orders
- [@aria-label] Fase: Arquitectura
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [@aria-label] Secciones de PandaCast
- [button[tab]] Cuentas 7
- [button[tab]] Documentos 11
- [span] Este proyecto todavía no tiene work orders publicados. Sus documentos de producto y diseño siguen disponibles.
- [code] /pandacorp: architecture
- [@aria-label] Copiar /pandacorp:architecture

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- REQ-05-001 columns "To do · In progress · Review · Fail · Done" | "Planificado · En curso · En revisión · (Bloqueado) · Verificado" (wo-kanban, state tiles).
- Edge case "message indicating they are generated in /pandacorp:architecture" | "Este proyecto todavía no tiene work orders publicados. Sus documentos de producto y diseño siguen disponibles." + `/pandacorp:architecture` (wo-empty).
- Tab names in FRD: "Summary" / "Full document" | "Resumen" / "Documento completo".
- Not-found: no FRD text | "Esta orden no está publicada" / "WO-99-999 no aparece entre los work orders capturados de Mission Control." / "Ver work orders" (wo-detail-not-found).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Section lives under the tab "Observabilidad", merged with the dependency map; the default view is "Por FRD", not the kanban.
- Failed card treatment cannot be verified from any captured state (needs a configured state with a failing order if the owner keeps REQ-05-002).

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- 2026-10-21 targets phone + tablet: the board shows 4 cards per column on phones with "Mostrar N más", masonry on tablet (iteration 26).
- Iteration 19: Observabilidad = the work-order section; iteration 23: FRD groups start collapsed with one Expandir/Colapsar toggle; the dependency column has a fixed width so state chips align.
- Iteration 27: the work-order summary reads in order; it states in one line that the content comes from the order's document, in English (titles, scope and criteria keep their language).
- Iteration 28: "Mostrar más" is a full-width dashed bar; the selected filter chip is neutral.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
