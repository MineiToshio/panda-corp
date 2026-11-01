---
id: FDD-12
type: fdd
slug: observability-dataviz
title: Observability and data visualization (Observabilidad)
status: ACTIVE
parent: FRD-12
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-12 Observability and data visualization (Observabilidad)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This FDD describes the Observabilidad tab of a project in the approved Órbita prototype (`docs/design/prototype/index.html`, route `#portfolio?project=<slug>&tab=Observabilidad`), frozen FROM that prototype on 2026-10-22. It uses the global design system (`DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`) and defines no token or component of its own. Every screen and state below is a captured state of `docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html`; the screenshots in `mocks/screenshots/` are the binding picture.
>
> **Scope decisions that shape this FDD (M1, 2026-10-22).** The timeline view no longer exists (owner decision, iteration 22): Observabilidad has three views, Por FRD, Tablero and Dependencias, over the same work-order data. The dependency map follows the prototype's layouts: a deterministic FRD-level map (boxes, two per row) and a work-order graph in depth columns. The data-model canvas is another feature (FRD-02's `model-diagram`): it keeps the app's current layout engine and is compared by computed styles only, so it is not specified here. La Fragua heads the project Resumen (FRD-06), not this tab.

## Screens

The project header (`ProjectHeroCompact`), the breadcrumb and the project tab bar above the tab are FRD-04's. Inside the tab, a `Segmented` view switch offers Por FRD · Tablero · Dependencias (the tab is third after Spec: Resumen · Spec · Observabilidad · Arquitectura · …, with a count chip "110" on the tab, AC-12-002.1). The Tablero view's content is FRD-05's and is not described here.

| Screen | Purpose | Captured state | Acceptance criteria |
|---|---|---|---|
| Por FRD (default view) | The FRD-by-FRD reading of the same work-order data: four state tiles, a filter, one collapsed row per FRD. A legacy link with `tab=Work orders` lands here. | `observability-legacy-link` | AC-12-002.1, AC-12-002.3, AC-12-003.3, AC-12-006.4 |
| Dependencias, level Por FRD | The FRD-level map: one box per FRD, aggregated lines between boxes. | `observability-deps-frd` | AC-12-002.3, AC-12-004.1, AC-12-004.7, AC-12-004.8, AC-12-005.1, AC-12-006.1 |
| Dependencias, level Por work order | The work-order graph in depth columns, filterable by FRD. | `observability-deps-wo` | AC-12-004.1, AC-12-004.7, AC-12-004.5, AC-12-004.6, AC-12-006.1, AC-12-006.3 |
| Dependencias, one order focused | The chain of one work order lit, the rest dimmed, with the focus card below. | `observability-deps-focus` | AC-12-004.2, AC-12-006.2 |

### Por FRD (`observability-legacy-link`)

Top to bottom (the card family is `Card`, `Segmented`, `StateTile`, `FrdRow`, `WorkOrderRow`):
1. **View switch** `Segmented` (selected = neutral surface): "Por FRD" selected, "Tablero", "Dependencias", each with a 15px icon; at its right a `SelectField` "Filtrar por FRD" with "Todos los FRDs (23)" and one option per FRD ("FRD-01 · Data reading"), and the count "110 work orders" muted at the far right.
2. **Four state tiles** (`StateTile`, a combinable filter when pressed): Planificado 0 · En curso 0 · En revisión 1 · Verificado 109, each with a dot, a display number and a thin bar.
3. **"Expandir todo"** (a `Button` with a plus icon) at the right, above the list. FRD groups start collapsed (owner decision, iteration 23).
4. **FRD rows** (`FrdRow`, native `details`): chevron, the FRD code in mono ("FRD-01"), the FRD title ("Data reading"), a stacked state bar named "10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado", "10/10" and "100%". A row with open work (FRD-02, "8/9") shows its bar split by state.
5. **Drift badge and chip** (AC-12-003.3): the verified FRD-03 row carries the amber chip "Verificado · 2 derivas" (warning icon plus text); the FRD-15 row carries the coral chip "Deriva ilegible" (icon plus text). They read from one field through one shared reader; neither appears on an FRD without drift.
6. An expanded row lists its **work orders** (`WorkOrderRow`): id in mono ("WO-03-001"), title, the state chip "Verificado" (check icon plus text) and the dependency count in a fixed-width column (link icon and "1").

### Dependencias (`observability-deps-frd`, `observability-deps-wo`, `observability-deps-focus`)

- **Card** "Grafo de dependencias" (`CardHeader`) with a count chip in the same hue: "23 FRDs" at the FRD level, "110 work orders" at the work-order level (the focus capture is a different project: "48 work orders"). Under it a second `Segmented` named "Nivel del grafo": "Por FRD" · "Por work order" (AC-12-006.1).
- **Level Por FRD** (`DependencyFrdBox`): the line "Cada caja es un FRD con sus work orders en el orden de su cadena. Las líneas entre cajas agrupan las dependencias entre FRDs: el número dice cuántas, y «⇄» las que van en sentido contrario. Pulsa el título de un FRD para verlo en detalle, o una work order para abrirla." Boxes sit **two per row** in a deterministic layout (computed from structure only, so a state change recolours a card and never moves a box); each box has the FRD tag, the title, a green state bar, the count ("10/10") and its work orders in chain order in three columns (state dot, id in mono, clamped title). Cross-FRD dependencies are **aggregated to one line per directed pair**, curved, with the count at the line ("1"); the tooltip reads "FRD-01 → FRD-02: 1 dependencia". The map is a bounded canvas named "Mapa de dependencias entre FRDs, desplazable": it keeps its natural size and pans inside its own box, so the page never scrolls sideways (AC-12-004.5). There is no zoom toolbar here.
- **Opening an FRD** (AC-12-006.1): activating an FRD title (the box has the title "Ver las work orders de FRD-01 en el grafo detallado") switches to the work-order level filtered to that FRD (see `observability-deps-frd-open` in States).
- **Level Por work order** (`DependencyNode`): a `SelectField` named "Filtrar el grafo por FRD" ("Todos los FRDs"), the line "De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una work order para ver su cadena.", then the canvas named "Grafo de dependencias, desplazable" with nodes of 176 x 46 px tinted by state, curved edges and columns by depth (what goes first at the left, what it unblocks to the right). Each node shows a state dot, the id in mono and the title on one line, clamped with an ellipsis (the full text "WO-01-001 · Factory root resolution · Verificado" is the tooltip); the `WO-NN-MMM` prefix is not repeated in the title (AC-12-004.6). A work order without a declared dependency is an **independent node**: it has no edge and nothing is invented to connect it (AC-12-004.7). The canvas scrolls inside its bounded box.
- **Focus** (`observability-deps-focus`, AC-12-004.2): after a click on a work order ("WO-05-001"), its whole upstream and downstream chain is lit in ONE highlight colour and the cards of the chain are outlined; every other node and edge is dimmed. At rest every edge is uniform. A "Quitar foco" action (close icon, at the right of the intro line) clears the focus; the focus lives in the URL. Below the graph the **focus card** `DependencySide` (named "Work order en foco") shows the state chip "Verificado", the id, the title ("Checklist export model"), the button "Abrir work order" with an arrow, and two columns "Depende de · 2" and "Desbloquea · 1" with the work orders (id, title) of each (AC-12-006.2).

## States

| State | What it shows | Captured state | Acceptance criteria |
|---|---|---|---|
| FRD opened in the detailed graph | At 1280 only. After a click on the FRD box, the level switches to "Por work order", the filter reads "FRD-01 · Data reading", the count chip "32 work orders", and the orders of other FRDs that FRD-01 touches appear as dashed neighbour nodes. | `observability-deps-frd-open` | AC-12-006.1, AC-12-004.1 |
| Narrow screens, list instead of map | Below 900px (captured at 375 and 768) the FRD map is an ordered list: one row per FRD (code, title, "10/10 verificadas", a chevron); an unfolded FRD shows "Depende de" (here "Nada: es un punto de partida"), "Desbloquea" as chips of FRD codes and its work orders as rows with a chevron. | `observability-deps-list-open` | AC-12-006.3 |
| Narrow screens, work-order list | Below 900px the work-order level is a list by build step ("Paso 1 · 1 work order", "Paso 2 · 3 work orders", and so on), each step with its orders (id, title, state dot); the focused order is tinted. The intro line changes to "Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una work order para ver de qué depende y qué desbloquea." and the focus card moves ABOVE the list. | `observability-deps-wo`, `observability-deps-focus` | AC-12-006.3, AC-12-006.2 |
| Legacy link | A link with `tab=Work orders` opens the Observabilidad tab on the Por FRD view; nothing else changes. | `observability-legacy-link` | AC-12-006.4 |
| Build without signal | A project with `running` true and a stale heartbeat reads "Sin señal · último evento hace 25 min" in the project header chip (coral, warning icon) instead of the running wording; La Fragua carries the chip "Sin señal" and the line "El equipo se detuvo: el build dice estar corriendo, pero el último evento llegó hace 25 min."; the "Último commit en verde" panel repeats the warning "El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min. Revisa si sigue vivo antes de fiarte de ese estado." No progress is invented while no event arrives. The scene itself is FRD-06's; the snapshot panel is FRD-14's. | `build-no-signal` | AC-12-001.2, AC-12-005.2 |
| FRD verified with drift | The FRD-03 row is expanded: the chip "Verificado · 2 derivas" in the title line and a note box (warning icon, amber tint): "Verificado con 2 derivas del gate: REQ-03-002, AC-03-001.2. Sus tarjetas de cambio esperan en Cambios." with the link "Ver en Cambios" and an arrow, which opens the project's Cambios tab. The filter reads "FRD-03 · Portfolio". | `wo-frd-drift` | AC-12-003.3 |
| Unreadable drift | FRD-15: the coral chip "Deriva ilegible" and a coral note: "El campo drift de FRD-15 no es una lista de requisitos, así que no se puede contar. Revisa su frd.md." The row keeps its other data (4/4, 100%) and its work orders; it is never a silent empty list. | `wo-frd-drift-unreadable` | AC-12-003.3 |
| Collapsed rows at rest | Every FRD row starts collapsed with one "Expandir todo" toggle. | `observability-legacy-link` | AC-12-003.3 |

Rules that need no picture: the Inicio Pulso limit of AC-12-001.3 is a data rule over the same event file; AC-12-005.1 is live behaviour (the map refreshes when the SSE `stateVersion` moves; a state change only recolours a card). No loading state is designed: the work-order data arrives with the page.

## Components used

From `docs/design/components.md`; nothing new is introduced by this FRD.

| Part | Components |
|---|---|
| Tab frame | `Tabs` (count chip on Observabilidad), `Segmented` (view switch and graph level), `SelectField` |
| Por FRD | `StateTile`, `FrdRow` (drift badge variant), `WorkOrderRow`, `StackBar` (`ProgressBar` family), `Button` (Expandir todo), `Notice` for the drift notes |
| Dependencias | `Card` and `CardHeader` with `Chip` count, `DependencyFrdBox` / `DependencyFrdItem`, `DependencyNode`, `DependencyList` / `DependencySide`, `DependencyButton`, `StateDot` |
| Build without signal | `Chip` (coral), `FraguaScene` (FRD-06), `SnapshotPanel` (FRD-14), `ProjectHeroCompact` |

## Interaction & flow

- Entry: Portafolio → a project → Observabilidad (`/portfolio?project=<slug>&tab=Observabilidad`); the selected view (`view=deps`), the graph level (`dag=wo`), the focused order (`focus=WO-05-001`) and the FRD filter are in the URL (FRD-25), so reload and Back restore them.
- Por FRD: a row opens in place; a state tile filters; "Expandir todo" toggles every row; the drift link goes to Cambios.
- Dependencias: pick the level; click a work order to light its chain (click it again, the background or Escape, or "Quitar foco", clears it); activate an FRD title to open it in the work-order graph; "Abrir work order" opens the order's detail.
- Read-only: nothing here writes to the factory.
- Out of v2 (FRD marks, owner decision 2026-10-21; not drawn, so not specified here): jump-to-first-error, the follow-the-active-step mode, and the zoom / fit / fullscreen toolbar, wheel zoom and drag-to-pan on the dependency map; the data-model viewer keeps its own toolbar in FRD-02. The standalone KPI header (AC-12-001.1) and the timeline (AC-12-003.1, AC-12-003.1a, AC-12-003.2) are retired.

## Responsive & accessibility

- Widths 375 / 768 / 1280, light and dark, as captured (the open-FRD state at 1280 only; the narrow list state at 375 and 768). Below 900px the dependency map is a list; the FRD rows and tiles keep one column; the tab bar scrolls sideways with overflow arrows.
- Meaning is never colour alone: a work-order state is a dot plus its word ("Verificado"); the drift badge and chip carry a warning icon and text; a focused chain is outlined as well as tinted.
- The canvases are keyboard-scrollable regions with accessible names ("Mapa de dependencias entre FRDs, desplazable", "Grafo de dependencias, desplazable"); every node and FRD box is a button with a full name; the stacked state bars carry a text alternative with the five counts; chain lighting works with focus as well as click.
- Targets are at least 44px on touch layouts; the focus ring is the shared token; no text fades and only transforms animate.

## Copy

Interface strings are Spanish (`docs/design/microcopy.es.json`); FRD and work-order titles keep their source language, today English; artifact names stay English (work order, FRD). No em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar): the component catalogue `docs/design/prototype/components.html`, measured styles `docs/design/prototype/reference/computed-styles.json`, icons `docs/design/prototype/icons/`, root `DESIGN.md`, `docs/design/components.md` (rows `FrdRow`, `WorkOrderRow`, `StateTile`, `DependencyFrdBox` / `DependencyFrdItem`, `DependencyNode`, `DependencyList` / `DependencySide`, `Segmented`, `Tabs`, `Chip`, `Notice`, `CardHeader`), `docs/design/freeze/m1-decisions.md` and `docs/design/freeze/reconciliation.md`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html`; screenshots `docs/frds/frd-12-observability-dataviz/mocks/screenshots/<id>-<width>-<theme>.jpg` (375, 768, 1280; light and dark; `observability-deps-frd-open` at 1280, `observability-deps-list-open` at 375 and 768).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=mission-control&tab=Observabilidad&view=deps` (the other states add the parameters listed in `docs/design/freeze/fidelity.config.json`).
- **Oracle states of this FRD** (`oracle-states.json`): `observability-legacy-link`, `observability-deps-frd`, `observability-deps-wo`, `observability-deps-focus`, `observability-deps-frd-open`, `observability-deps-list-open`, `build-no-signal`, `wo-frd-drift`, `wo-frd-drift-unreadable`.
- **Measured by styles, not pixels:** the dependency canvases are compared by computed styles of their nodes, boxes and lines (L1/L2) and by the checks above; the data-model canvas of FRD-02 follows the same rule.

## Work-order read error (2026-10-31)

The coral FileReadErrors notice names every failed work-order file and its localized reason, followed by the valid work-order views. Paths wrap within the notice at phone widths. Individual failures never replace the entire list. Global progress shows "N archivos sin leer"; partial FRD counts describe only the readable orders. No total percentage is shown for an incomplete project plan.


## Visual close-out clarification (2026-10-31, lane O)

The view switch, FRD selector and count share a wrapping toolbar aligned from the left. The separate expand-all action stays right-aligned. FRD totals and percentages use the muted small regular text treatment from the oracle.
