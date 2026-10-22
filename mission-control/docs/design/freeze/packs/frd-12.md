# Context pack · FRD-12 · Observability and data visualization

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-12 copy, S2.1 builds, S2.2 amendments, S2.3-12 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-12-observability-dataviz/frd.md` (id FRD-12, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 6 under `states["frd-12-observability-dataviz"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 21 AC lines: 2 drawn · 5 partially drawn · 10 not drawn · 4 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-12#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-12-001.1 · not drawn · `observability-legacy-link`

> - **AC-12-001.1** — ~~The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left~~; the detail goes in collapsible sections. **SUPERSEDED (reconciled from code 2026-07-05):** the standalone observability KPI header (`KpiHeader`/`deriveKpis`) was never mounted in production and was **removed** (DR-092/DR-115 — its "failed work orders" metric derived state through a mechanism divergent from `WorkOrder.state`). The operative factory pulse is the Inicio **`Pulso`** section (FRD-18), which is the single source for those cross-cutting signals. This AC no longer describes shipped behaviour.

**Prototype:** Superseded in the FRD itself (KPI header removed); nothing to draw. The operative pulse is Inicio's "Pulso" (FRD-18).

### AC-12-001.2 · not drawn · `observability-deps-frd`

> - **AC-12-001.2** — The view SHALL show a **Live / No signal** indicator with the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` (data freshness), so the operator knows whether they're seeing something current or frozen.

**Prototype:** No "En vivo / Sin señal" indicator with the last-event timestamp in Observabilidad; the screens carry a "Captura de proyectos · <fecha>" stamp only (the proposal lists live refresh as "Not captured").

### AC-12-001.3 · behaviour only · `observability-deps-frd`

> - **AC-12-001.3** — ANY grouping or ranking (agents, events, metrics) SHALL be limited to the **top-5** so as not to overwhelm the operator.

**Prototype:** Top-5 limit: data rule (the lists here page 8/10/12 at a time instead).

### AC-12-001.4 · behaviour only · `observability-deps-frd`

> - **AC-12-001.4** — The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.

**Prototype:** Derived from the event file: data rule.

### AC-12-002.1 · partial · `wo-by-frd`

> - **AC-12-002.1** — WHERE a project is open, Mission Control SHALL expose an **"Observabilidad" project tab** that is a **sibling of the Party tab**, NOT a view nested inside Party.

**Prototype:** "Observabilidad" is a project tab, but it IS the work-order section; there is no Party tab to be a sibling of (La Fragua is the top of Resumen).

### AC-12-002.2 · drawn · `fragua-real`

> - **AC-12-002.2** — The **Party** tab SHALL remain the live-agents-only RPG panel and SHALL NOT contain the timeline or DAG views.

**Prototype:** La Fragua carries neither a timeline nor a DAG.

### AC-12-002.3 · not drawn · `wo-by-frd`, `observability-deps-frd`

> - **AC-12-002.3** — The Observabilidad tab SHALL provide a **Línea de tiempo ↔ DAG** toggle over the **same work-order data**, offering exactly those two views (no RPG view here).

**Prototype:** The tab offers THREE views (Por FRD · Tablero · Dependencias), not Línea de tiempo ↔ DAG. "Línea de tiempo" was removed by the owner (iteration 22).

### AC-12-003.1 · not drawn · `wo-by-frd`

> - **AC-12-003.1** — WHEN the **Línea de tiempo** view is selected THE system SHALL render the build as **FRD ▸ work order (+ a per-FRD review segment)**: the **FRD is the top level**, shown as a **collapsible** row (click to expand/collapse) carrying a **summary bar equal to the sum of its work-orders' durations**; each work order **nests** under its FRD as a smaller, lighter bar, with its **review/test phase as a tail segment**. Each bar's **width is proportional to its duration** (a per-FRD local scale, so an 8-min and a 23-min work order are visibly different — the bar must never be a fixed/floored width that hides the duration). Granularity is FRD▸WO+review (NOT task/action — too granular). A reopened work order shows its **last attempt** (the attempt count is surfaced as meta).

**Prototype:** No timeline: removed by the owner in iteration 22.

### AC-12-003.1a · not drawn · `wo-by-frd`

> - **AC-12-003.1a (data source + honest fallbacks)** — The timeline reads the **durable per-project log `.pandacorp/track.jsonl`** (written by the build engine: `wo_start`/`wo_end`/`review_*`/`frd_end`, DR-086) and degrades through an honest precedence:
>   1. **track present** → **real** durations (`source: "track"`).
>   2. **no track, but git history records the build** (WO-tagged commits) → an **estimated** timeline reconstructed from git (`source: "git"`): the **order, the dates and the outcomes are real**; **durations are estimated** from the gap between commits (clamped to a sane max, laid out sequentially so multi-day pauses don't distort the axis). It SHALL be shown under an explicit **"≈ tiempos estimados"** banner and never presented as real.
>   3. **no track, no git build** but work orders exist → a **structural** view (FRD▸WO with states, NO durations) under an honest banner ("histórico — estructura sin duraciones").
>   4. **no build data at all** → an **honest empty state**.
>   The system SHALL NEVER render fabricated/placeholder duration bars, and SHALL always flag estimated durations as estimates.

**Prototype:** No track/git/structural timeline fallbacks, no "≈ tiempos estimados" banner.

### AC-12-003.2 · not drawn · `wo-by-frd`

> - **AC-12-003.2** — The timeline SHALL offer a **"saltar al primer error"** affordance that locates the first failed work order in the sequence.

**Prototype:** No "saltar al primer error" in any view.

### AC-12-003.3 · not drawn · `wo-by-frd`

> - **AC-12-003.3 (pre-existing drift badge, DR-122)** — WHEN a FRD's rolled-up state is verified AND its
>   `docs/frds/<frd>/frd.md` frontmatter carries a non-empty `drift: [REQ-…, AC-…]` list (written only by the
>   build engine's certifying landing), THE timeline's FRD row SHALL show **"Verificado · N derivas"** (N = the
>   list length, icon + text, never color alone) as a link to the project's **Cambios** tab, where the
>   `origin: gate-drift` cards live. The badge SHALL derive from that one field through ONE shared reader
>   (`lib/frds/frd-drift.ts`, DR-115; no stored copy) and SHALL NOT appear when the list is empty/absent or the
>   FRD is not verified. The reader SHALL fail loud (DR-078): a `drift` value that is not a list of
>   `REQ-NN-MMM` / `AC-NN-MMM(.K)` ids, invalid frontmatter or an unreadable `frd.md` SHALL render a
>   **"Deriva ilegible"** error chip on that FRD (any state), never a silent empty list; a FRD folder with no
>   `frd.md` shows nothing.

**Prototype:** The "Verificado · N derivas" badge and the "Deriva ilegible" chip are NOT drawn.

### AC-12-004.1 · partial · `observability-deps-frd`, `observability-deps-frd-open`

> - **AC-12-004.1** — WHEN the **DAG** view is selected THE system SHALL render a **work-order dependency graph** as a **2D compound (cluster) layout**: each FRD is an opaque box placed in free 2D, with its work-order cards inside it. Hand-rolled deterministic layout — no Dagre/ELK runtime dependency.

**Prototype:** Two-level graph: "Por FRD" draws each FRD as a box holding its work orders in chain order (2 boxes per row, deterministic, no force simulation) with aggregated cross-FRD lines; "Por work order" is a column layout by depth. A free-2D force-directed placement is not drawn.

### AC-12-004.1a · drawn · `observability-deps-wo`

> - **AC-12-004.1a (real dependencies — no fabrication, DR-087)** — Edges SHALL come from each work order's **`dependsOn` frontmatter** (read by `lib/work-orders`), the machine-readable source of truth. A work order with no declared dependencies is an **independent node** (no edge); cross-FRD and fan-in/fan-out edges render as-is. The system SHALL NOT fabricate edges — in particular it SHALL NOT invent a "depends on the previous work order in its FRD" sequential chain when a WO has no real dependency (that drew a linear chain that misrepresented the real graph).

**Prototype:** Edges come from each order's dependencies; independent orders have no edge; no sequential chain is invented.

### AC-12-004.1b · partial · `observability-deps-frd`

> - **AC-12-004.1b (2D compound layout — clusters in free 2D)** — The DAG SHALL place each FRD as an opaque **cluster box** positioned by a **deterministic seeded force simulation** (fixed iteration counts, no randomness) followed by an **AABB no-overlap pass** so boxes never touch; related FRDs end up adjacent and hubs central. Work-order **cards** sit inside their box, laid out by intra-FRD dependency rank (each card 2 lines: id + title + a state-color bar). Edges are **two levels**: **intra-FRD** WO→WO lines (drawn ON TOP of the boxes, visible inside) and **cross-FRD** lines **aggregated to one FRD→FRD line per directed pair** (drawn BEHIND the opaque boxes, so they hide where they cross a box and emerge from the borders — no spiderweb over the boxes). The layout is computed from **STRUCTURE ONLY** (WO ids + deps + frd) and is **byte-deterministic**, so it is stable across server reads + live updates: a WO **state** change only recolors its card — boxes never jump. (Replaces the earlier 1D swimlane layout; the force-directed/Obsidian look the red-team flagged for non-determinism is made deterministic here by seeding + structural-only layout, and adopted after the owner validated the prototype `docs/design/prototype/dag-2d.html`.)

**Prototype:** Cross-FRD lines are aggregated to one FRD→FRD line per pair, labelled with the count and "⇄" for the minority direction ("FRD-01 → FRD-02: 1 dependencias"); boxes sit in two columns by dependency order, not by force layout + AABB pass.

### AC-12-004.2 · partial · `observability-deps-focus`

> - **AC-12-004.2 (color-on-select highlight)** — WHEN the operator hovers or **clicks to pin** a card THE system SHALL highlight its **intra transitive chain within its FRD** + its FRD's **immediate FRD neighbors** (1 hop — full transitive across FRDs is rejected: the shared foundations connect the whole graph, so it lights everything), **recolor each highlighted line a distinct trace-palette color** (the `--color-trace-N` design tokens) so crossing lines stay traceable, outline the chain's cards + the neighbor FRD boxes, and **dim** the rest. At rest every edge is uniform accent. Click the card again / the background / Escape clears the pin.

**Prototype:** Clicking an order lights its upstream and downstream chain across FRDs (not 1 hop only), dims the rest and shows a side card "Orden en foco" with "Depende de · 2" / "Desbloquea · 1". Per-chain trace-palette colours are NOT drawn (one highlight colour); at rest edges are uniform.

### AC-12-004.3 · not drawn · `observability-deps-wo`

> - **AC-12-004.3** — The DAG SHALL offer **"saltar al primer error"** that selects/highlights the first failed work order and its chain.

**Prototype:** No "saltar al primer error".

### AC-12-004.4 · not drawn · `observability-deps-wo`

> - **AC-12-004.4** — The DAG SHALL offer a **"seguir al paso activo" follow-mode** toggle that, when ON, marks/centers the work order currently in execution.

**Prototype:** No "seguir al paso activo" follow mode.

### AC-12-004.5 · not drawn · `observability-deps-wo`

> - **AC-12-004.5** — The DAG SHALL render at a **legible natural size** (never auto-shrunk to fit the column) and SHALL be **zoom/pan-able**: a floating toolbar (zoom out · % readout that resets to 100% · zoom in · fit-to-view) AND the **mouse wheel** change the zoom (wheel zoom is zoom-to-cursor and does not scroll the page), while the graph **pans inside its own bounded, scrollable container** — a wide graph never forces the whole page to scroll horizontally. Panning works by the scrollbars AND by **grab-dragging the canvas** (press-and-drag to scroll, `grab`/`grabbing` cursor); a press that travels past a small threshold pans and **does not select a node** (a click still selects), so dragging and clicking never conflict. The DAG SHALL also offer a **fullscreen** toggle (browser Fullscreen API on the whole DAG panel — legend + controls + canvas) so a large graph can fill the screen; Escape or the toggle exits, and zoom/pan/fit keep working at the larger size.

**Prototype:** No zoom toolbar, wheel zoom, fit or fullscreen on the dependency map (the data-model diagram has them); the canvas scrolls inside a bounded region (aria-label "Grafo de dependencias, desplazable"); grab-drag panning is not drawn. Below 900 px the canvas becomes an ordered list.

### AC-12-004.6 · partial · `observability-deps-wo`

> - **AC-12-004.6** — Each node SHALL keep its text **inside the card**: the title wraps to ≤2 lines with ellipsis (never spilling past the card edge) and the redundant `WO-NN-MMM —` id prefix is stripped from the title (the id is shown once, in the node's mono `id · FRD` sub-line).

**Prototype:** Nodes show the id and a clamped title (title attribute with id · title · state); the "id · FRD" mono sub-line is not drawn as such.

### AC-12-005.1 · behaviour only · `observability-deps-frd`

> - **AC-12-005.1** — WHILE the build is running THE views SHALL update **live / event-driven** as new events arrive in `~/.claude/dashboard-events.ndjson` — not a one-shot snapshot. The **timeline** does this by **re-reading its durable source `.pandacorp/track.jsonl` on each event** (the engine appends to it live, so a refresh shows the latest WOs/durations from the same durable record); the DAG/KPIs read the event stream directly.

**Prototype:** Live updates are not a static state.

### AC-12-005.2 · behaviour only · `observability-deps-frd`

> - **AC-12-005.2** — IF no new event has arrived THEN the views SHALL stay consistent with the freshness indicator of AC-12-001.2 (no fabricated progress).

**Prototype:** Consistency with the freshness indicator: indicator not drawn.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `observability-legacy-link` | `#portfolio?project=mission-control&tab=Work+orders` | (none) | full page | `AC-12-001.1` |
| `observability-deps-frd` | `#portfolio?project=mission-control&tab=Observabilidad&view=deps` | (none) | full page | `AC-12-001.2` `AC-12-001.3` `AC-12-001.4` `AC-12-002.3` `AC-12-004.1` `AC-12-004.1b` `AC-12-005.1` `AC-12-005.2` |
| `observability-deps-wo` | `#portfolio?project=mission-control&tab=Observabilidad&view=deps&dag=wo` | (none) | full page | `AC-12-004.1a` `AC-12-004.3` `AC-12-004.4` `AC-12-004.5` `AC-12-004.6` |
| `observability-deps-focus` | `#portfolio?project=funko-tracker&tab=Observabilidad&view=deps&dag=wo&focus=WO-05-001` | (none) | full page | `AC-12-004.2` |
| `observability-deps-frd-open` | `#portfolio?project=mission-control&tab=Observabilidad&view=deps` | click `[data-dag-frd]` | full page; widths 1280 | `AC-12-004.1` |
| `observability-deps-list-open` | `#portfolio?project=mission-control&tab=Observabilidad&view=deps` | click `.dl-frd > summary` | full page; widths 375/768 | — |

States cited above that belong to another FRD folder (captured there, reused here): `wo-by-frd`, `fragua-real`.

**Not drawn (10)**: `AC-12-001.1`, `AC-12-001.2`, `AC-12-002.3`, `AC-12-003.1`, `AC-12-003.1a`, `AC-12-003.2`, `AC-12-003.3`, `AC-12-004.3`, `AC-12-004.4`, `AC-12-004.5`.

**Partially drawn (5)**: `AC-12-002.1`, `AC-12-004.1`, `AC-12-004.1b`, `AC-12-004.2`, `AC-12-004.6`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

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
- Vista de work orders
- Filtrar por FRD
- Nivel del grafo
- Por work order

### `observability-legacy-link`

- [option] Todos los FRDs (23)
- [option] FRD-01 · Data reading (×23 of the same pattern)
- [span] 110 órdenes
- [@aria-label] Filtrar por estado
- [span] Planificado
- [span] En curso
- [button] Expandir todo
- [@aria-label] 10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×10 of the same pattern)

### `observability-deps-frd`

- [h2] Grafo de dependencias 23 FRDs
- [p] Los FRDs en el orden en que se pueden construir. Abre uno para ver de qué depende, qué desbloquea y sus work orders.
- [p] Cada caja es un FRD con sus work orders en el orden de su cadena. Las líneas entre cajas agrupan las dependencias entre FRDs: el número dice cuántas, y «⇄» las que van en sentido contrario. Pulsa el título de un FRD para verlo en detalle, o una orden para abrirla.
- [@aria-label] Mapa de dependencias entre FRDs, desplazable
- [title] FRD-01 → FRD-02: 1 dependencias (×22 of the same pattern)
- [@title] Ver las work orders de FRD-01 en el grafo detallado (×23 of the same pattern)
- [@aria-label] 10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×10 of the same pattern)
- [span] Party
- [@title] WO-01-001 · Factory root resolution · Verificado (×109 of the same pattern)
- [@title] WO-02-014 · Accessible empty-column marker · En revisión
- [span] 10/10 verificadas (×10 of the same pattern)
- [span] Depende de
- [span] Nada: es un punto de partida
- [span] Desbloquea
- [span] Nada

### `observability-deps-wo`

- [h2] Grafo de dependencias 110 órdenes
- [@aria-label] Filtrar el grafo por FRD
- [option] FRD-01 · Data reading (×23 of the same pattern)
- [span] De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena.
- [span] Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una orden para ver de qué depende y qué desbloquea.
- [@aria-label] Grafo de dependencias, desplazable
- [@title] WO-01-001 · Factory root resolution · Verificado (×109 of the same pattern)
- [@title] WO-02-014 · Accessible empty-column marker · En revisión
- [p] Paso 1 · 1 orden (×4 of the same pattern)
- [p] Paso 2 · 3 órdenes (×15 of the same pattern)

### `observability-deps-focus`

- [span] FT
- [span] 39/48 WO · 81%
- [@aria-label] Secciones de Funko Tracker
- [button[tab]] Observabilidad 48
- [button[tab]] Cuentas 10
- [button[tab]] Cambios 21
- [button[tab]] Documentos 82
- [h2] Grafo de dependencias 48 órdenes
- [@aria-label] Filtrar el grafo por FRD
- [span] De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena.
- [span] Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una orden para ver de qué depende y qué desbloquea.
- [button] Quitar foco
- [@aria-label] Grafo de dependencias, desplazable
- [@title] WO-01-001 · Catalog read model and seed loader · En revisión (×9 of the same pattern)
- [@title] WO-01-002 · Franchise index page · Verificado (×39 of the same pattern)
- [p] Paso 1 · 4 órdenes (×12 of the same pattern)
- [p] Paso 13 · 1 orden (×4 of the same pattern)
- [@aria-label] Orden en foco
- [button] Abrir orden
- [p] Depende de · 2
- [p] Desbloquea · 1

### `observability-deps-frd-open`

- [h2] Grafo de dependencias 32 órdenes
- [@aria-label] Filtrar el grafo por FRD
- [option] FRD-01 · Data reading (×23 of the same pattern)
- [span] De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena.
- [span] Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una orden para ver de qué depende y qué desbloquea.
- [@aria-label] Grafo de dependencias, desplazable
- [p] Paso 1 · 1 orden
- [p] Paso 2 · 3 órdenes (×10 of the same pattern)

### `observability-deps-list-open`

- (no strings beyond the shared chrome and the first state of the same route)

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Línea de tiempo ↔ DAG" toggle | segmented control "Por FRD · Tablero · Dependencias" (+ "Por FRD / Por work order" level switch inside Dependencias).
- "DAG" | "Grafo de dependencias" (card title with a count chip: "23 FRDs" / "110 órdenes").
- Phone/tablet list version: "Paso 1 · 1 orden", "Depende de · N", "Desbloquea · N", "Quitar foco", "Abrir orden" (not in the FRD).
- Prototype explanatory text: "De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena." and "Por pasos: cada paso se puede construir cuando termina el anterior…".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Owner decision (iteration 22) removed "Línea de tiempo": AC-12-003.1 / .1a / .2 / .3 and AC-12-002.3 need removal from the FRD or a re-instated timeline state.
- The proposal says the prototype's dependency maps use a simple deterministic layout; the real app's compound DAG uses a force layout, "which a build must keep or replace deliberately".
- AC-12-004.5 zoom/pan/fullscreen toolbar and AC-12-004.3/.4 (jump to first error, follow mode) are FRD wants without a drawn counterpart (the data-model diagram toolbar exists, FRD-02 REQ-02-015 amendment says both viewers share one GraphControls component).

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 19: "Work orders" renamed Observabilidad; it gains the dependency trace; the separate mosaic tab is gone (the Arquitectura plan keeps a mosaic). Old `tab=Work orders` links still land on Observabilidad (state observability-legacy-link).
- Iteration 21: dependency graph restored in Observabilidad → Dependencias (columns by depth, curved edges, filter by FRD, dashed out-of-FRD neighbours, click to light the chain and a card below with what it depends on and unlocks).
- Iteration 22: "Línea de tiempo" removed; two levels (Por FRD compound boxes with aggregated lines; Por work order) ; clicking an FRD title opens it in the detailed graph.
- Iteration 26: below 900 px the dependency map becomes a list in build order (each FRD unfolds to what it depends on, what it unblocks and its work orders; the work-order level lists them by step; the focus card moves above the list).
- Iteration 23: FRD groups start collapsed in Por FRD with one Expandir/Colapsar toggle.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
