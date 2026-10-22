# Functional reconciliation (DR-064) · Órbita prototype ↔ FRDs

> S1.3 output, 2026-10-21. Inputs: `packs/_global.md` and the 20 per-FRD packs, the FRDs under `docs/frds/`, the approved prototype `docs/design/prototype/` (round 5, iteration 28), `docs/design/explorations/visual-refresh-2026/proposal.md`, `docs/decision-log.md` (2026-10-21 entries) and the factory registry (`factory/decisions/registry.yaml`). Owner decisions applied without re-asking: v2 = the redesign (prototype-less app features stay out by default), desktop + tablet + phone, Spanish interface with English artifact names, Party tab removed (La Fragua = 4 stations in the Resumen), Observabilidad = Por FRD / Tablero / Dependencias, no timeline, Cuentas after Arquitectura, Portafolio cards/list, collapsible sidebar, Propuestas as an ordered to-do, Logros five tabs, WO reading summary, iteration-28 component rules. Demo-only controls (DR-061) are never promoted.
>
> This file is S1.3's only output. S2.1 builds the approved Group B states, S2.2 writes the Group A ACs with the ids below and the contradiction amendments, S2.4 copies the resolved list into `design-decisions.md` § `## Functional reconciliation (DR-064)`.

## Resumen para el owner

**Cuentas:** Grupo A (el prototipo lo tiene, los FRDs no) **79** puntos, todos se escriben en su FRD. Grupo B (un FRD lo pide, el prototipo no) **53** puntos: **35 fuera de v2**, **3 se reclasifican** como comportamiento sin dibujo, **12 se dibujan** como estados de seguridad y **3 los decides tú**. Además, **20 contradicciones**: el FRD se corrige al prototipo, salvo en C-03, la regla de movimiento, donde el FRD gana. También hay **13 correcciones** al propio prototipo para S2.1, donde gana el FRD o el contrato del prototipo.

**Lo que necesita tus ojos** (ninguna decisión del 2026-10-21 lo cubre):

1. **Indicador global "⎇ N pendientes" (FRD-21).** El prototipo solo tiene la tabla "Árboles de trabajo" en Inicio. El indicador global lo pide una regla de la fábrica (DR-096: "indicador global en el shell"), y tú lo decidiste el 2026-06-26 ("el miedo es no mirar"). **Recomiendo dibujarlo** como una píldora en el sidebar, igual que "Plugin desactualizado", que lleve a la tabla de Inicio.
2. **Panel "último commit en verde" con su comando `git worktree add` (FRD-14 y REQ-04-005).** Ya existe en la app y sirve para probar un build largo sin pararlo. El prototipo no lo tiene. **Recomiendo dibujarlo** en el Resumen, solo mientras hay un build.
3. **Directorio global de Cuentas (FRD-26).** Lo aprobaste el 2026-10-20 y ya está construido. El prototipo solo tiene Cuentas por proyecto. **Recomiendo dibujarlo** como tercera vista de Portafolio (Tarjetas / Lista / Cuentas), reutilizando la tabla de Cuentas. Si prefieres dejarlo fuera de v2, FRD-26 se recorta a la pestaña del proyecto.
4. **Un lote de 12 estados de seguridad.** No son features: es la red que ya existe en la app y que el prototipo no muestra porque los datos de ejemplo no la activan. Son una work order fallida, un build "sin señal", 6 errores de lectura, la calma "al día", la fábrica vacía, la insignia de derivas y el aviso de que un cambio rehace trabajo verificado. **Recomiendo aprobar el lote completo.** Si no, la app los inventaría sin diseño o los perdería.
5. **Los dos grafos.** Para pasar el gate de fidelidad, el modelo de datos y el mapa de dependencias deben usar el layout simple del prototipo, no los motores actuales de la app (ruteo ortogonal y force layout). **Recomiendo adoptar los del prototipo.** Es más simple y es lo que aprobaste, pero reemplaza código ya construido.

## Id convention for new ACs

A new Group A AC opens the next free REQ number of its FRD and counts `.K` from 1: `AC-NN-MMM.K` with `MMM` = highest existing `REQ-NN`/`AC-NN` number + 1. FRD-07, FRD-08 and FRD-13 have no numbered ids. There, `MMM` starts after the count of their unnumbered EARS lines (`FRD-NN#Uk`), so S2.2 can still number those lines 001..k without a collision. FRD-09's last id is `AC-09-007`, so its next is 008. Pre-assigned starting points: FRD-02 → 016 · FRD-03 → 008 · FRD-04 → 014 · FRD-05 → 008 · FRD-06 → 020 · FRD-07 → 013 · FRD-08 → 020 · FRD-09 → 008 · FRD-10 → 028 · FRD-11 → 005 · FRD-12 → 006 · FRD-13 → 010 · FRD-15 → 006 · FRD-17 → 011 · FRD-18 → 022 · FRD-19 → 005 · FRD-20 → 004 · FRD-21 → 007 · FRD-22 → 010 · FRD-26 → 011.

## Group A · the prototype has it, the FRDs lack it (79)

Resolution for every row: S2.2 writes it into the owning FRD with the pre-assigned id; the FDD cites the listed captured states. The EARS line is a draft (S2.2 may tighten wording, not scope).

### FRD-02 · Ideas board

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-01 | AC-02-016.1 | Board title search | `board-search` | WHEN the owner types in the board search, THE system SHALL show only the ideas whose title matches, across every phase column. |
| A-02 | AC-02-016.2 | Phase selector chips with counts that jump to a column | `board`, `board-phase-jump` | THE board SHALL show one selector chip per phase with its idea count, and WHEN one is activated SHALL scroll that column into view. |
| A-03 | AC-02-016.3 | "Ocultar columnas vacías" switch, remembered per browser | `board-hide-empty` | WHEN the owner turns on "Ocultar columnas vacías", THE board SHALL remove empty phases and their selector chips and SHALL remember the choice in this browser. |
| A-04 | AC-02-016.4 | Live result count of the category filter | `board-category-filter` | WHILE a category filter is active, THE board SHALL show the live count "N ideas coinciden". |
| A-05 | AC-02-016.5 | Idea page header: phase stepper, "Volver al tablero", favorite, open project and discard actions on one row | `idea-pitch`, `idea-shipped` | THE idea page SHALL show a header with the idea's phase stepper, a "Volver al tablero" link and its favorite / open-project / discard actions. |
| A-06 | AC-02-016.6 | Campaña progress strip "N/6 entregadas" and previous/next arrows in the phase sheet | `idea-campaign`, `idea-campaign-phase` | THE Campaña SHALL show a six-segment strip with "N/6 entregadas", and the phase sheet SHALL offer previous/next phase arrows. |
| A-07 | AC-02-016.7 | FRD cards fully clickable; kind tag in colour (UI, Infra, Tool/CLI, API, Data) taken from `frd.md` `ui:` when the digest lacks it; work-order progress only once the build started, otherwise the planned count | `idea-spec`, `idea-architecture`, `idea-frd-dialog` | EACH FRD card SHALL open its detail from its whole area, carry a coloured kind tag, and SHALL show work-order progress only after construction started (before that, the planned count). |
| A-08 | AC-02-016.8 | Environment variables as label/content rows grouped by `.env.example` sections, "Sin descripción en .env.example" plus a count badge, groups folded past 12 | `idea-architecture` | THE Variables de entorno block SHALL group variables by their `.env.example` section, SHALL label a variable without its own comment "Sin descripción en .env.example" and count them, and SHALL fold groups longer than 12. |

### FRD-03 · Portfolio

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-09 | AC-03-008.1 | Overview card: avatar, phase chip, six-segment stepper with per-phase tooltips, progress ring with tooltip, "Etapa N de 6 · último cambio hace …", counts, "Siguiente · `<command>`", ordered by last commit | `portfolio-cards`, `a11y-ring-tooltip-focus` | THE Portafolio overview SHALL show one card per project, ordered by last commit, with phase, six-step stepper, verified-work-order ring, relative last change, counts and the next command. |
| A-10 | AC-03-008.2 | Tarjetas / Lista switch kept in the URL; comparison table (Fase, FRDs, Docs, ADRs, Cambios abiertos, Decisiones) that becomes one card per row below 1024 px | `portfolio-list` | WHEN the owner picks Lista, THE system SHALL show the comparison table instead of the cards and SHALL keep the choice in the URL (`view=lista`). |
| A-11 | AC-03-008.3 | "Cambiar de proyecto" picker dialog with search, same order | `portfolio-project-picker`, `portfolio-project-picker-search` | WHEN the owner activates "Cambiar proyecto", THE system SHALL open a searchable project list in a dialog, ordered by last commit. |

### FRD-04 · Project workspace

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-12 | AC-04-014.1 | Full hero only on Resumen; one-line compact header with "Cambiar proyecto" on every other tab | `project-summary`, `project-spec`, `wo-by-frd` | THE workspace SHALL show the full project hero on Resumen only and a one-line header (initials, name, phase, "n/m WO · pct", compact stepper, "Cambiar proyecto") on the other tabs. |
| A-13 | AC-04-014.2 | Tab count badges | `project-summary` | EACH workspace tab with countable content SHALL show its count. |
| A-14 | AC-04-014.3 | Resumen key tiles (avance, falta, cambios abiertos, último movimiento) and "Siguiente paso" with its command | `project-summary`, `project-summary-funko` | THE Resumen SHALL show four tiles (avance, falta, cambios abiertos, último movimiento) and the next step with its copyable command. |
| A-15 | AC-04-014.4 | "Avance por FRD": stacked state bar per FRD, n/m, unfinished first | `project-summary`, `project-summary-funko` | THE Resumen SHALL list each FRD with a stacked work-order state bar and n/m, unfinished FRDs first. |
| A-16 | AC-04-014.5 | "Decisiones" list with Resuelta / Pendiente chips opening a decision dialog (recommendation as text); a decision already resolved in its file is flagged "ya resuelta en el archivo" | `project-summary-decisions`, `project-decision-dialog` | THE Resumen SHALL list the project's decisions as Resuelta or Pendiente, open each in a dialog, and SHALL flag a pending entry whose file already records a resolution. |
| A-17 | AC-04-014.6 | Compact "Tu turno" in the Resumen, first below 1024 px | `project-summary-decisions` | THE Resumen SHALL show the project's own Tu turno items and SHALL place them first in the single-column layout. |
| A-18 | AC-04-014.7 | "Últimos avances" built only from structured sources, each line with icon, status label and date; raw engine log collapsed as "Bitácora técnica del motor" | `project-summary`, `project-summary-funko` | THE Resumen SHALL show recent progress from verified work orders and filed/started changes only, and SHALL keep the raw engine log collapsed. |
| A-19 | AC-04-014.8 | Documentos: index ordered by purpose, type filter chips with counts, search, typed paper (type chip, path, copy), index on the RIGHT, folded behind "Abrir índice" below 900 px | `project-documents`, `project-documents-search`, `project-documents-index-open` | THE Documentos tab SHALL order the index by purpose, filter by type and search, render the document as typed paper, and SHALL place the index right of the reader (folded below 900 px). |

### FRD-05 · Work orders

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-20 | AC-05-008.1 | Three views Por FRD (default) · Tablero · Dependencias, in the URL | `wo-by-frd`, `wo-kanban`, `observability-deps-frd` | THE Observabilidad tab SHALL offer the views Por FRD (default), Tablero and Dependencias, kept in the URL. |
| A-21 | AC-05-008.2 | Por FRD: collapsed groups with stacked state bar and n/m %, "Expandir todo / Colapsar todo", "Filtrar por FRD" select; state tiles with counts | `wo-by-frd`, `wo-by-frd-expanded`, `wo-state-filter` | THE Por FRD view SHALL start with every FRD collapsed, offer one expand/collapse-all toggle and an FRD select, and SHALL show the four state tiles as combinable filters. |
| A-22 | AC-05-008.3 | Tablero caps a column at 8 cards (4 on phones) with "Mostrar más"; empty columns collapse to one line | `wo-kanban`, `wo-kanban-expanded` | THE Tablero SHALL show at most 8 cards per column (4 on phones) followed by "Mostrar N más", and SHALL collapse an empty column to one line. |
| A-23 | AC-05-008.4 | Work-order reading summary: flow header with an "Ahora:" sentence; De qué trata · Qué cambia (Fuera de alcance apart) · Cómo se comprueba (one card per AC, EARS keywords marked) · Qué se construyó (long note folded); fact sheet (Estado, Dificultad, Reaperturas, Actualizada, Requisitos, Archivos que toca, Dependencias up/down, "Construir esta orden"); line saying the content comes from the order's document | `wo-detail` | THE work-order Resumen SHALL read in the order above, with a fact sheet listing the files the order touches, its dependencies both ways and its scoped build command. |

### FRD-06 · La Fragua (replaces the sprite-scene requirements, see C-08)

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-24 | AC-06-020.1 | La Fragua is the head of the project Resumen (no Party tab) and keeps the dark palette in both themes | `fragua-real` | THE project Resumen SHALL open with the La Fragua scene, drawn with the always-dark scene tokens in both themes. |
| A-25 | AC-06-020.2 | Verdict headline, health chip (espera tu decisión / construyendo / en pausa / listo para lanzar / avanzando) and stacked forging bar with a text alternative | `fragua-real`, `fragua-off` | THE scene SHALL state the project verdict as a sentence, a health chip, and a stacked bar of verified / review / workshop / queue counts with a text alternative. |
| A-26 | AC-06-020.3 | Four stations Cola · Taller · Revisión · Bóveda with count and sub-label, fixed decorative crews; a token's station = its frontmatter state | `fragua-real` | THE scene SHALL show four stations, each with its count, and SHALL place every work order in the station of its authoritative frontmatter state. |
| A-27 | AC-06-020.4 | Tokens (FRD number over order number), at most 8 per station then "+N"; hover/focus card with code, state, title, sentence and FRD | `fragua-real`, `fragua-token-card` | EACH station SHALL show up to 8 work-order tokens then "+N", and WHEN a token is hovered or focused THE system SHALL show its code, state, title and FRD. |
| A-28 | AC-06-020.5 | Empty station: three dashed slots and a short message; never-built project state | `fragua-real`, `fragua-empty` | WHEN a station holds no work, THE scene SHALL draw three dashed slots and its empty message. |
| A-29 | AC-06-020.6 | Live only while `running`: crews work, the courier walks a gold route between the first and last stations holding work; idle otherwise | `fragua-on`, `fragua-off` | WHILE the project's `running` flag is true, THE scene SHALL animate the crews and the courier between the first and last occupied stations; otherwise it SHALL stay idle. |
| A-30 | AC-06-020.7 | Foot chips: "Faltan N" / "Todo forjado", "N cambios abiertos", "Último movimiento hace …" | `fragua-real` | THE scene SHALL end with chips for what is left, open changes and the last movement. |
| A-31 | AC-06-020.8 | One station per row below 900 px | `fragua-real` (375, 768) | WHERE the viewport is narrower than 900 px, THE scene SHALL stack one station per row. |

### FRD-07 · Configuration

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-32 | AC-07-013.1 | Resumen hub: one search across the four catalogs, four count tiles, "Tus comandos" (copy on click) | `config-hub`, `config-hub-search` | THE Configuración SHALL open on a Resumen with one search across skills, agents, rules and standards, four count tiles and the owner's copyable commands. |
| A-33 | AC-07-013.2 | Search in every tab; Skills filter chips Todas · Comandos tuyos · Motores internos and a copy button per row | `config-skills`, `config-rules-search` | EACH catalog tab SHALL offer a search, and Habilidades SHALL filter by owner commands vs internal engines. |
| A-34 | AC-07-013.3 | Agents grouped by model tier with a one-line tier explanation and an effort chip | `config-agents` | THE Agentes tab SHALL group agents by model tier, each group explaining the tier in one line. |
| A-35 | AC-07-013.4 | Rules: filter chips Todas · Automáticas · Requieren al owner, Auto/Owner chip per rule, 30 at a time | `config-rules`, `config-rule-detail` | THE rules tab SHALL filter by approval kind and SHALL list 30 rules at a time with "Mostrar más". |
| A-36 | AC-07-013.5 | Standards: one list MUST first, severity facets, domain select, enforcement line under the title | `config-standards`, `config-standards-must` | THE standards tab SHALL list MUST first, filter by severity and domain, and show each standard's enforcement. |

### FRD-08 · Documentation

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-37 | AC-08-020.1 | Home that routes in: Empieza aquí (numbered tutorial, "Después, entiende lo esencial"), Guías para el día a día, Explorar por tipo (Tutorial · Guías · Conceptos · Workflows, Referencia → Configuración) | `docs-home` | THE Documentación home SHALL offer the tutorial path, the everyday guides and an explore-by-type block whose Referencia points to Configuración. |
| A-38 | AC-08-020.2 | Full-text search over every page with snippets | `docs-search` | WHEN the owner searches the Documentación, THE system SHALL list matching pages with a text snippet. |
| A-39 | AC-08-020.3 | Reader: breadcrumbs, "Paso X de Y" bar on tutorial pages, previous/next within the group, page index on the RIGHT with search, folded below 900 px | `docs-page`, `docs-page-tutorial`, `docs-page-index-open` | THE reader SHALL show breadcrumbs, tutorial progress, previous/next within the group and a right-hand searchable index. |

### FRD-09 · Gamification

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-40 | AC-09-008.1 | Sidebar guild card: crest with level, rank name, "N / M XP al nivel L", gold bar, link to Logros; crest only on the rails | `shell-expanded`, `shell-rail-collapsed` | THE shell SHALL show the guild level, rank and XP to the next level in the sidebar, reduced to the crest on the rails. |
| A-41 | AC-09-008.2 | Gold achievement notice: a trophy flagged new or unlocked within 7 days raises it once per browser, with "Ver" and "Cerrar aviso", auto-close after 9 s | `guild-achievement-notice` | WHEN a trophy is new or unlocked within the last 7 days, THE system SHALL show the gold notice once per browser and SHALL close it on demand or after 9 s. |

### FRD-10 · Achievements Hall

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-42 | AC-10-028.1 | Resumen right column: "Tu siguiente rango" (current → next emblem, XP left, how XP is earned), compact attributes radar naming strongest/weakest, last 4 trophies | `achievements-summary` | THE Logros Resumen SHALL show the next rank with XP left, a compact attributes radar and the last four trophies. |
| A-43 | AC-10-028.2 | Misiones sorted by closeness to the next tier; zero-progress missions last and muted | `achievements-missions` | WITHIN each saga, missions SHALL be ordered by closeness to their next tier, untouched ones last and muted. |
| A-44 | AC-10-028.3 | Trofeos: conquered bar and seals row, "Los más alcanzables" (lowest-rarity locked trophy per category, three when filtered), Por conquistar 12 at a time | `achievements-trophies`, `achievements-trophy-category` | THE Trofeos tab SHALL show the seals, the most reachable locked trophies, and SHALL list locked trophies 12 at a time. |
| A-45 | AC-10-028.4 | Rangos: eras more than one step beyond the current one collapsed with level range and count | `achievements-ranks`, `guild-rank-ladder` | THE rank ladder SHALL collapse eras more than one step beyond the current rank. |
| A-46 | AC-10-028.5 | Never-recorded counters read "sin datos aún" with an explanatory line, distinct from "no cableado"; phase transitions 10 at a time | `achievements-stats` | WHERE a counter's event has never been recorded, THE Estadísticas tab SHALL show "sin datos aún" (not 0) and explain why. |

### FRD-11 · Build modes

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-47 | AC-11-005.1 | Four mode cards with icon, tag, 1–4 power meter and hint; Equilibrado default | `commands`, `commands-mode-powerful` | THE Comandos tab SHALL present the four build modes as selectable cards with a power meter and hint, Equilibrado preselected. |
| A-48 | AC-11-005.2 | Scoped build target select that writes `/pandacorp:implement <frd>` or `change:<id>` | `commands-target-scoped` | WHEN the owner picks a target, THE command box SHALL show `/pandacorp:implement` scoped to it. |
| A-49 | AC-11-005.3 | Campaña build ficha carries the picker collapsed ("Elegir modo de construcción") | `idea-campaign-build` | THE Construcción phase sheet SHALL offer the mode picker behind "Elegir modo de construcción". |

### FRD-12 · Observability

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-50 | AC-12-006.1 | Dependencias at two levels (Por FRD boxes, Por work order); clicking an FRD title opens it in the detailed graph | `observability-deps-frd`, `observability-deps-frd-open`, `observability-deps-wo` | THE Dependencias view SHALL switch between an FRD-level map and a work-order graph, and WHEN an FRD title is activated SHALL open that FRD in the work-order graph. |
| A-51 | AC-12-006.2 | Focus card "Orden en foco" (Depende de · N, Desbloquea · N, "Abrir orden"), focus in the URL | `observability-deps-focus` | WHEN an order is focused, THE system SHALL show what it depends on and what it unblocks, with a link to the order. |
| A-52 | AC-12-006.3 | Below 900 px the map becomes an ordered list ("Paso N · M órdenes") whose FRDs unfold | `observability-deps-list-open` | WHERE the viewport is narrower than 900 px, THE dependency map SHALL render as a build-order list. |
| A-53 | AC-12-006.4 | Legacy `tab=Work orders` links land on Observabilidad | `observability-legacy-link` | WHEN a legacy Work orders link opens, THE workspace SHALL show Observabilidad. |

### FRD-13 · Visual system

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-54 | AC-13-010.1 | Colour rules: neutral chrome, hue only with text or icon, no edge stripes, green/amber/red only for status or severity, phase colours as the deliberate exception | `home`, `board` | THE UI SHALL keep chrome neutral and SHALL use hue only to carry meaning, together with text or an icon, never as an edge stripe. |
| A-55 | AC-13-010.2 | Self-hosted Space Grotesk / Inter / JetBrains Mono; nothing below 12 px; monospace only for ids, code, commands and paths | `home` | THE UI SHALL render with the three self-hosted families and SHALL NOT render product text below 12 px. |
| A-56 | AC-13-010.3 | Hover effects only on hover-capable pointers; focus kept clear of sticky bars | `a11y-skip-link-focus`, `a11y-ring-tooltip-focus` | WHERE the pointer cannot hover, THE UI SHALL apply no hover effect, and focused elements SHALL never sit under a sticky bar. |
| A-57 | AC-13-010.4 | Scene and map surfaces always dark | `fragua-real`, `idea-campaign` | THE La Fragua scene and the Campaña map SHALL use the always-dark scene tokens in both themes. |

### FRD-15 · Plugin warning

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-58 | AC-15-006.1 | Coral sidebar pill "Plugin desactualizado" (title with both versions) linking to Inicio | `shell-expanded`, `plugin-banner` | WHILE the installed plugin is behind, THE sidebar SHALL show the "Plugin desactualizado" pill linking to the banner. |

### FRD-17 · Proposals

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-59 | AC-17-011.1 | Resumen tab (default) "Qué te toca, en orden": only owner actions, each with count, reason, command, where to run it and a link; memory upkeep reads "se revisa sola" while the routine is current | `proposals-summary` | THE Propuestas page SHALL open on an ordered list of the actions that need the owner, each with its command and where to run it. |
| A-60 | AC-17-011.2 | Navigation badge counts actions, not items | `shell-expanded`, `proposals-summary` | THE Propuestas navigation badge SHALL count owner actions, not proposal items. |
| A-61 | AC-17-011.3 | "Señales automáticas" grouped by kind; the usage signal flagged unreliable when it marks most skills | `proposals-summary` | THE automatic signals SHALL be grouped by kind, and a signal that flags most of its population SHALL be marked unreliable. |
| A-62 | AC-17-011.4 | Memoria: four-step lesson flow with who moves each step; "Esperan tu decisión" first; candidates collapsed ("no piden nada") | `proposals-memory` | THE Memoria tab SHALL explain a lesson's four steps and list the lessons awaiting the owner first, with candidates collapsed. |

### FRD-18 · Inicio

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-63 | AC-18-022.1 | Layout: plugin warning first; left Tu turno → Tu cartera → En marcha; right Pulso → Gremio → Embudo de ideas → Árboles de trabajo; one column below 1024 px with Tu turno first | `home` | THE Inicio SHALL arrange its cards in the two columns above and SHALL put Tu turno first on narrow screens. |
| A-64 | AC-18-022.2 | Tu turno one line per item (title, project · kind · age, scoped command with copy) plus a "Detalles" dialog (what it is, what is needed, recommendation, context, what the command does) | `home`, `home-turn-dialog` | EACH Tu turno item SHALL be one line with its scoped command, and WHEN "Detalles" is activated THE system SHALL open its explanation dialog. |
| A-65 | AC-18-022.3 | "En marcha" card with collapsible groups (Construyéndose ahora, Esperan la revisión de su FRD, Borradores en la cola) | `home-in-flight-open` | THE Inicio SHALL list in-flight work, grouped and collapsible, apart from Tu turno. |
| A-66 | AC-18-022.4 | Pulso (Proyectos, FRDs, WO verificados) and Embudo de ideas per phase with the discarded count | `home` | THE Inicio SHALL show the factory pulse and the idea funnel by phase with discarded ideas counted apart. |

### FRD-19 · App shell

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-67 | AC-19-005.1 | Sidebar Proyectos group: at most 5 by last commit, "Ver los N", collapsible header remembered, row with phase-hued avatar, "Fase · pct%" and a full aria-label | `shell-expanded`, `shell-projects-folded` | THE sidebar SHALL list up to five projects by last commit with phase and progress, and SHALL remember whether the group is folded. |
| A-68 | AC-19-005.2 | Navigation counts (Inicio owner items, Tablero ideas, Propuestas actions); a dot on the collapsed rail when Inicio has items | `shell-expanded`, `shell-rail-collapsed` | THE navigation SHALL show the count of what needs attention per destination. |
| A-69 | AC-19-005.3 | Desktop collapse to a 64 px rail ("Colapsar" / "Fijar abierta"), remembered; floats open over the page on pointer or focus | `shell-rail-collapsed`, `shell-rail-float` | WHEN the owner collapses the sidebar, THE shell SHALL show an icon rail that floats open on pointer or focus without moving the content, and SHALL remember the choice. |
| A-70 | AC-19-005.4 | Tablet 76 px rail with mini labels; phone sticky top bar, bottom navigation (Inicio · Tablero · Portafolio · Manual · Más) and off-canvas drawer | `shell-expanded` (768, 375), `shell-drawer-open` | THE shell SHALL become an icon rail on tablets and a top bar + bottom navigation + drawer on phones. |

### FRD-20 · Overlay freshness

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-71 | AC-20-004.1 | Notice says where to run the command ("Córrelo en la carpeta de `<Proyecto>`") | `overlay-behind` | THE upgrade notice SHALL name the project folder where the command runs. |

### FRD-21 · Pending merge

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-72 | AC-21-007.1 | Inicio card "Árboles de trabajo": table Proyecto · Sin integrar · Sobrantes · Estado, state by the legend rule (Depurar ya: 3+ leftovers or pending or any branch idle 7+ days; Revisar pronto; Al día; Limpio), leftovers from `git worktree list` without locked ones | `worktrees-card` | THE Inicio SHALL show one row per repository with unmerged branches, leftover worktrees and a text state computed by the stated rule. |
| A-73 | AC-21-007.2 | A project row opens its branch list: last-commit subject, origin, age, commits outside main, uncommitted count, branch name | `worktrees-branch-dialog` | WHEN a repository row is activated, THE system SHALL list its branches with origin, age, commits outside main and uncommitted changes. |
| A-74 | AC-21-007.3 | Cleanup command `/pandacorp:worktrees` shown with copy | `worktrees-card` | THE card SHALL show `/pandacorp:worktrees` as the copyable cleanup command. |

### FRD-22 · Factory backlog

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-75 | AC-22-010.1 | P0 / P1 / P2 tiles with counts that filter | `backlog-priority-filter` | WHEN a priority tile is activated, THE backlog SHALL show only that priority. |
| A-76 | AC-22-010.2 | "Por tema" bar list in plain names (merged areas) that filters | `backlog-area-filter` | WHEN a topic bar is activated, THE backlog SHALL show only that topic. |
| A-77 | AC-22-010.3 | "Cómo avanzar" card: whole-queue command first with its cost warning, then one at a time (recommended), where to run | `backlog` | THE backlog SHALL show how to advance, whole-queue command first, each with where it runs. |
| A-78 | AC-22-010.4 | Open items grouped by priority sub-groups (P0 URGENTE, P1 IMPORTANTE, P2 CUANDO HAYA TIEMPO), paged | `backlog` | THE open items SHALL be grouped by priority and paged with "Mostrar más". |

### FRD-26 · Services and accounts

| # | New AC | What | State(s) | EARS draft |
|---|---|---|---|---|
| A-79 | AC-26-011.1 | Cuentas table: service name opens its dashboard in a new tab, login is click-to-copy text with a "Copiar" hint, environment chips in one teal hue, status; ordered configured → proposed → inactive then A–Z; one card per row below 1024 px | `accounts-project` | THE project Cuentas tab SHALL list services ordered by status then name, with a copyable login and the dashboard link. |

## Group B · an FRD wants it, the prototype lacks it (53)

Resolutions: **out** = out for v2 (owner decision 2026-10-21); S2.2 removes or defers the AC. **build** = S2.1 draws it as a configured state (proposed id) and adds it to `fidelity.config.json`. **behaviour** = no picture is needed; it stays as a behaviour-only AC. **owner** = M1 decision; the recommendation is given. DR-130 leaves no third option.

### Out for v2 (35)

| # | FRD · AC | What | Note |
|---|---|---|---|
| B-01 | FRD-02#U1 | "recommended" badge on board cards | Listed in decision 2. |
| B-02 | REQ-02-008 | Discard quick-tags; "Descartando…" in-flight state | The free-text reason still feeds `/discover`. |
| B-03 | AC-02-012.4 | Gold card background for favourites | The star alone marks it (drawn). |
| B-04 | AC-02-013.6 | Scoped dependency graph inside the FRD dialog | Dialog ends with its links (drawn). |
| B-05 | AC-02-015.1 (part) | Visual distinction of composite key groups, isolated entities and self-relations | Keys show as per-attribute badges (drawn). |
| B-06 | AC-02-015.2 (part) | Attribute mappings on links; per-connector selection | The relations list keeps cardinalities (drawn). |
| B-07 | AC-02-015.6 (part) | Viewport-filling dialog fallback | Native fullscreen stays (behaviour). |
| B-08 | AC-02-015.11 | Layout-worker loading/error states | Moot if owner item 5 adopts the prototype's synchronous layout; else becomes build. |
| B-09 | REQ-03-003 (part) | "stopped" indicator on rows | Only "Construyendo" when running; header says "Sin construcción activa". |
| B-10 | REQ-03-004, AC-14-003.1, AC-14-004.1 | Bugs and decisions count badges on rail rows | The rail is gone. Decisions are a column in Lista. |
| B-11 | REQ-03-007 (part) | Invalid-date chip for `last sync` | The date now comes from the last commit. |
| B-12 | FRD-04#U2 | "Obsoleta" decision tag | Keep the rule that an obsolete decision is never counted as pending. Decision 4 already fixes `readDecisions`. |
| B-13 | REQ-04-010 (part) | `implemented_sha` / `closing_at` evidence in the change dialog | Groups and chips are drawn. |
| B-14 | AC-06-012.3 | Effort level as read-only data | No surface shows it. |
| B-15 | FRD-07#U7, FRD-08#U8–U10 | Skill workflow diagram: mini-flow, curated explainer + interactive flow graph (`FlowGraph`, `skill-flows.ts`) | Listed in decision 2. In the current app this lives in Configuración's skill detail (`SkillDetail.tsx`). The explainer belongs to the same authored layer. |
| B-16 | FRD-07#U9, FRD-07#U10 (part) | "New decision rule" / "New standard" buttons; the "what a decision rule is" explainer | Listed in decision 2 (creation affordances). |
| B-17 | FRD-07#U11, FRD-07#U12 | Agent level, title, XP bar, pixel art for every agent, per-agent model explanation | The tier explanation sits in the group header (drawn). |
| B-18 | FRD-09#U5–U7 | Phase animation, automatic release celebration, level-up moment | The gold notice (first rung) stays. |
| B-19 | FRD-10#U1 (part) | Estimated-rarity blurb | |
| B-20 | FRD-10#U4 | Per-trophy NUEVO badge | Inicio's "Nuevo" chip and the gold notice stay. |
| B-21 | FRD-10#U8 (part) | "LA CIMA" summit treatment | |
| B-22 | FRD-10#U9 (part) | TU PARTY roster and record badges in the hero | |
| B-23 | FRD-10#U12 (part), FRD-10#U16 | Chain-complete crown; date · project per unlocked tier | Trophies keep date · project (drawn). |
| B-24 | FRD-10#U19 (part) | Distinct revealed-secret treatment | Amend: an unlocked secret moves to Conquistados as a normal trophy tile with its condition (drawn pattern). |
| B-25 | AC-10-022.1, AC-10-022.2 (populated) | Populated top-N usage and effort lists | Skills do not emit the event yet. The honest empty band stays (drawn). |
| B-26 | AC-12-004.3, AC-12-004.4 | "Saltar al primer error"; "seguir al paso activo" | |
| B-27 | AC-12-004.5 | Zoom / pan / fit / fullscreen toolbar on the dependency map | Bounded scroll region (drawn). The data-model toolbar stays. |
| B-28 | FRD-17#U3, FRD-17#U12 | Dismiss ✕ per card and remembered dismissal | The to-do model replaced the streams. |
| B-29 | FRD-17#U2, #U6, #U9, #U10 (part), REQ-17-009 (part) | Prune list with items, "obsoleta" explainer, stale-memory nudge, harvest-orphan banner, reject affordance, "Úsala cuando" / applied-in rows | The "Última revisión automática" date is drawn. |
| B-30 | REQ-18-005…009 | "Desde tu última visita" digest with mark-seen | Listed in decision 2. |
| B-31 | REQ-18-016 (part), REQ-18-018, REQ-18-019, REQ-18-020, FRD-18#U1 (part) | Version and age-in-stage on cards; "estancado"; "N bugs" chip; inline blocker reason; "estable · en operación" label | The next-command rule stays, see P-08. |
| B-32 | AC-20-001.2 | Quiet "Última versión de Pandacorp" ok badge | Up to date renders nothing, like FRD-15. |
| B-33 | REQ-21-004 | "Pendientes de merge" block in the project Resumen | The per-repository dialog on Inicio covers it (A-73). |
| B-34 | AC-22-001.3 (part) | Evidence line (`source` + `links`) on backlog rows | Shown in the item dialog metadata. |
| B-35 | AC-14-003.2, AC-14-005.1 (indicator) | `rethink_pending` indicator on the rail | The rail is gone. The feedback-channel docs are drawn in the captured Manual. |

### Reclassified as behaviour (3)

| # | FRD · AC | Why no picture is needed |
|---|---|---|
| B-36 | AC-02-015.5 (announcement) | The active-search announcement is an `aria-live` message on the drawn search (`model-entity-selected`). |
| B-37 | FRD-15#U3, FRD-15#U4 | The per-runtime Claude/Codex verdicts are API fields (`runtimes`). No component renders them separately today: only `src/lib/plugin-sync/plugin-sync.ts` reads `runtimes`, and it folds both into one `drift`, so the one drawn banner fires when either runtime is behind. |
| B-38 | AC-14-003.3 | The three feedback channels are explained in the captured Manual pages (`/pandacorp:bug`, `/pandacorp:decide` present in `data/manual-live.js`). |

### Build in the prototype as a configured state (12): the safety batch (owner item 4)

None of these is a feature. Each is an honesty or fail-loud state that the app already implements, and the engineering rules require it: DR-078 fail-loud readers, DR-066 liveness, rule 6 "designed empty/error states". The prototype lacks them only because the fixture never triggers them. Several already exist as prototype code paths (`b.errors`, the "No se pudo leer" chip, "Bloqueado", "Nada espera tu acción ahora mismo.").

| # | FRD · AC | Proposed state id | What to draw | Why build |
|---|---|---|---|---|
| B-39 | REQ-05-002 | `wo-failed` | One failing order: the "Bloqueado" column and coral card with alert icon in Tablero, plus the row in Por FRD | A failed build order must be unmistakable. The code path exists. |
| B-40 | REQ-18-015, REQ-18-017, AC-12-001.2, AC-14-002.2, AC-06-019.7 (one voice) | `build-no-signal` | `running: true` with a stale heartbeat. "Construyendo" turns into "Sin señal · último evento hace N" on the Inicio card, the Portafolio card and the Resumen. | DR-066: the flag alone is never shown as live. Without it, a dead build reads as building. |
| B-41 | AC-22-004.2, AC-22-004.3 | `backlog-errors` | Coral error notice naming the files that could not be read (including a duplicate id), the parsed items still listed | DR-078. The code path exists. |
| B-42 | AC-02-015.7, AC-04-012.4 | `model-invalid` | Unreadable / malformed model artifact: an explicit error notice in Modelo de datos, the rest of Arquitectura intact. One state covers malformed, oversized, unsupported and unreadable (same copy shape). | DR-078. "Explicit none" and "not published" are already drawn. |
| B-43 | REQ-21-006 | `worktrees-unreadable` | One repository row with the coral "No se pudo leer" chip, distinct from "Al día" | "Zero pending" vs "could not read" (DR-078). The code path exists. |
| B-44 | AC-10-022.3 | `stats-stream-error` | Usage band in its unreadable-stream error state, distinct from the drawn empty text | DR-078. |
| B-45 | AC-26-007 | `accounts-source-error` | Cuentas with an explicit bounded issue (malformed or dangling services file) | DR-078. Applies to the global directory too if owner item 3 keeps it. |
| B-46 | FRD-03#U2 | `portfolio-path-missing` | A project whose folder is missing: "Ruta no encontrada" chip on its card and the recovery command `git clone <repo> <path>` (or the no-remote warning) | Implemented today (`src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx`). It is the only signal for a moved repo. |
| B-47 | FRD-03#U1, FRD-18#U2 | `factory-empty` | No projects: Inicio first-action card with the command to start one, and the Portafolio empty state | Rule 6. A fork or clone without factory data lands here. |
| B-48 | REQ-18-003, REQ-18-012 (zero) | `home-calm` | Tu turno with nothing pending: "Nada espera tu acción ahora mismo." and the *al día* badge | FRD-18's core "quiet when healthy" principle. The string exists in code. |
| B-49 | AC-12-003.3 | `wo-frd-drift` | "Verificado · N derivas" badge (and "Deriva ilegible" chip) on the FRD row of Observabilidad → Por FRD, linking to Cambios | DR-122: the only surface for gate-drift cards. It lived in the removed timeline, so it moves to the row that replaced it. |
| B-50 | FRD-04#U3 (part), FRD-02#U4, FRD-02#U5 (part) | `project-change-rebuilds`, `idea-discarded-reason` | Change dialog of an expedite change with dependencies and the `rebuilds_verified` warning. Discarded idea with its reason in the Descartadas list and as a banner in its detail. | The warning appears before a change reopens verified work. The discard reason is the owner's own data, already written by the ADR-0002 flow. |

### Owner decides at M1 (3)

| # | FRD · AC | What | Recommendation |
|---|---|---|---|
| B-51 | REQ-21-001, REQ-21-002 (alert variant), REQ-21-003 (entry point) | Global pending-merge indicator reachable from every screen | **Build** `shell-pending-chip`: a sidebar pill "⎇ N pendientes" (alert variant when any repo is "Depurar ya"; calm or hidden at zero) that links to the Inicio "Árboles de trabajo" card, mirroring the plugin pill (A-58). The factory registry's DR-096 (4) requires "Mission Control showing a GLOBAL ambient 'N pendientes' indicator in the persistent shell". The project guide's DR-099 tells sessions the owner pulls cross-session status from that indicator. The owner set placement on 2026-06-26 (FRD-21 Notes). |
| B-52 | REQ-04-005, AC-14-001.1–.3, AC-14-002.1–.2 | Snapshot panel: last commit that passed every gate, its FRD and short SHA, the copyable `git worktree add` command, "building now" vs green, staleness warning | **Build** `project-snapshot` in the Resumen, below La Fragua, only while a build has a `last_green_sha`. FRD-14 is VERIFIED in the app and is the owner's tool for testing during an unattended build. FRD-14 has **no context pack and no config folder**, an S0.3 gap; S2.1 creates `states["frd-14-snapshot-and-feedback"]`. |
| B-53 | AC-26-001, -002, -003 (organization, dated identity/access status), -004, -005, -009 (Manual Services link) | Global services and accounts directory | **Build** `portfolio-accounts`: a third Portafolio view, "Cuentas", beside Tarjetas / Lista, reusing the Cuentas table plus a search, a state filter and a row dialog. Approved by the owner on 2026-10-20, implemented (`src/components/modules/ServicesDirectory/`, ADR-0011), and the redesign never reviewed it. If the owner says out, FRD-26 shrinks to AC-26-006/-008/-010 plus A-79. |

## Contradictions · the FRD says something else than the approved prototype (20)

Resolution is **amend the FRD to the prototype** (S2.2), unless the row says **keep FRD**. In that case the prototype is corrected in S2.1 (see P-rows).

| # | FRD · ACs | FRD says | Prototype (approved) | Resolution |
|---|---|---|---|---|
| C-01 | FRD-19 AC-19-001.1/.2, -002.2, -003.1…-003.5, -004.1/.2 | Top navigation with six destinations, 1100 px disclosure, 1240 px frame, exempt drill-ins (`SHELL_EXEMPT`) | Persistent sidebar with **seven** destinations (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración), 64 px collapsible rail, 76 px tablet rail, phone top bar + bottom nav + drawer, frame 1180 + 2 × 40 px, **no exempt route** | Amend. The nav contract for `e2e/shell.ts`: landmark `aside#sidebar`, the seven labels/paths, no exemptions, drawer toggled by `#menu`. Also FRD-18 REQ-18-001 / layout "top nav". |
| C-02 | FRD-13 #U1, #U2, #U4, #U8 and header ("warm pixel-RPG palette") | Pixel-RPG warm palette, one rationed accent, high-contrast layer, 3 elevation levels with radius 8 / base 16, canonical agent-role colour set | Órbita: neutral graphite/porcelain chrome, nine semantic hues + tints, 7 shadow tokens, radii 6–28 + pill, identity by sprites and model tier | Amend: FRD-13 points to `DESIGN.md` / `design-tokens.json` (frozen from this prototype) plus A-54…A-57. |
| C-03 | FRD-13 #U5 | Animate only `transform`/`opacity` | Transitions on colour, background, border, box-shadow, sidebar `width`. Dialog "pop" fades the whole dialog, including its text. | **Keep FRD**: it matches the DR-129 prototype contract. Fix the prototype (P-10). The S3 audit treats any residue as a blocker. |
| C-04 | FRD-04 REQ-04-001/-002/-003/-004, AC-04-012.1, AC-04-013.1, "Party tab / Observability sibling" lines | Ten tabs (…Work orders…Party…Observabilidad…), compact header on every tab, Summary = Mission Objectives + activity log | **Eight** tabs: Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos. Full hero on Resumen only. Resumen = La Fragua + A-14…A-18. | Amend (also fixes the stale 9/10-tab e2e specs, decision 4). |
| C-05 | FRD-04 #U3, #U4, REQ-04-011 | Hechos / Descartados behind separate toggles; inline "¿Seguro? Sí / No"; relative dates | One collapsed "Historial N"; a confirm dialog with an optional "Motivo" that replaces the detail; absolute dates ("19 oct. 2026") | Amend. Unparseable date: the raw text renders in the same slot (behaviour). |
| C-06 | FRD-03 REQ-03-001/-002/-005/-006, membership rule, "Global account directory extension" | Rail on the left with only building/shipped projects; first project selected by default | Overview of **all** projects (cards or list), sidebar project list, picker dialog, the workspace takes the full width | Amend. The accounts extension follows owner item 3. |
| C-07 | FRD-05 REQ-05-001, edge case | Five columns To do · In progress · Review · Fail · Done as the view | Inside Observabilidad. Default "Por FRD". The Tablero has four columns plus "Bloqueado" only when one fails. | Amend (with A-20…A-23, B-39). |
| C-08 | FRD-06 AC-06-001.1–.4, -002.1/.2, -003.1/.2, -004.1–.4, -005.1/.2, -006.1–.3, -007.1–.3, -008.1, -009.1–.4, -010.1–.3, -014.2, -015.1/.2, -016.1, -017.1, -018.1–.4, -019.1–.6, -019.8–.11 | Sprite per work order, per-FRD rooms Forja → Tribunal → Bóveda, tribunal, parchment, relay, flow strip, iconic bitácora, campamento, Misión strip, vault grouping, achievement toast per WO | Four-station La Fragua in the Resumen (iterations 19, 21, 24, 26), collapsed "Bitácora técnica del motor" | Amend: remove these and write A-24…A-31. Keep and reword: AC-06-001.5/.6 (stations follow the authoritative state), -002.3 (token card), -011.*, -012.1, -012.2 ("Demo" label, not "SOLO DEMO"), -013.1/.3/.4, -014.1, -018.5. AC-06-013.2 drops the "/pandacorp:implement" overlay line (the Resumen's Siguiente paso carries the command). AC-06-019.7 freshness goes to B-40. |
| C-09 | FRD-07 #U3 (rules), #U10 | Every item opens a detail modal; nine fixed standard domains, Summary/Detail views | Rules open an inline accordion; standards use a data-driven domain select and a dialog with the markdown | Amend. The accordion is a deliberate exception to "reveal-more is a modal": 48 short rows, the default text only. |
| C-10 | FRD-08 #U1, #U2, #U3, #U7, #U11 | Never "Manual"; side menu; four Diátaxis buckets; Reference re-renders the Configuración cards; SKILL.md in Documentación | Nav/H1 "Documentación" but rail/bottom-nav mini label "Manual"; index on the right; Tutorial · Guías · Conceptos · Workflows + Referencia pointing to Configuración; SKILL.md behind "Definición completa" in the Configuración dialog | Amend. Allow "Manual" only as the short rail/bottom-nav label. Every other string says "Documentación" (P-11). |
| C-11 | FRD-08 #U14, #U15, #U16 | Non-Claude runtimes read/review-only (DR-120) | Captured Concept page follows DR-133 (Codex and Claude Code full read/write) | Amend to DR-133 (owner decision 2026-10-20). |
| C-12 | FRD-09 #U1, #U2, #U8; vocabulary "Guild level in the top bar" | Guild level/XP in a top bar; emblem beside the rank; dismissable overlay | Sidebar guild card (A-40); gold notice with Ver / Cerrar (A-41) | Amend. |
| C-13 | FRD-10 #U2, #U7, #U8, #U9, #U10, #U11, #U18, AC-10-026.2, `visual_source_informe` | Axes Consistencia/Temple with icons; Misiones count; emblem 88/104 px; GuildHero only inside Resumen; "hazañas"/"misiones en curso"; hover lockchip; "—"/"no cableado" | Constancia/Resiliencia chips without icons; count only on Trofeos; 56 px emblem; hero above all five tabs; "trofeos / secretos / niveles de misión"; click opens a dialog; "sin datos aún" vs "no cableado" (A-46) | Amend. The Informe anchor is superseded by the Estadísticas tab. |
| C-14 | FRD-11 REQ-11-001; FRD-02 AC-02-010.9 (modes) | Inline `<select>` with a "default" option and a tooltip | Four-card mode picker (A-47). Spec modes in a disclosure listing each mode with its own command. | Amend both. |
| C-15 | FRD-12 AC-12-001.1, -002.1…-002.3, -003.1, -003.1a, -003.2, -004.1, -004.1b, -004.2, -004.6 | Observabilidad sibling of Party with Línea de tiempo ↔ DAG; force-layout clusters; 1-hop highlight with per-chain palette; "id · FRD" sub-line | Observabilidad = the work-order section with three views; no timeline (owner, iteration 22); deterministic two-per-row FRD boxes and depth columns; full upstream/downstream chain in one highlight colour; clamped title with tooltip | Amend. AC-12-003.3 moves to B-49. The layout change is owner item 5. |
| C-16 | FRD-02 REQ-02-014, #U4, AC-02-009.2 (rail), -010.3/-010.4 amendments, -010.5, -013.1, -013.3, -015.3, -015.10 | Hidden "Sin ideas en esta columna"; Descartadas button only when some exist; 210 px left rail; striped road + room pills; "`{n} · {name}` — {state}" header; Party target; omit Arquitectura tab; real DAG in the plan; Diagrama default at every width; orthogonal field-port routing | Visible "Sin ideas en esta fase"; button always with its count; folded/right rail; corridors carrying the artifact; kicker "Fase N de 6" + name + chip; target = project Resumen (La Fragua); tab kept with "La arquitectura todavía no está publicada."; state mosaic (hidden before Construcción); phones open on Esquema; simple masonry with curved links | Amend. REQ-02-014 keeps the role="status" semantics on the visible text. AC-02-015.10 depends on owner item 5. |
| C-17 | FRD-17 #U1, #U11, AC-17-010.1/.2, AC-17-001.1/.3 | Top-bar badge with open count + rail chip; "Crónica del gremio"; collapse at 6 with "ver más / ver menos"; group command for candidates + prune; candidates first | Sidebar badge counting actions; "Propuestas"; full-width "Mostrar N más · quedan M" (8 or 10), no collapse back; group command on "Para podar" only; "Esperan tu decisión" first | Amend. |
| C-18 | FRD-18 layout, REQ-18-010, REQ-18-012, REQ-18-013 | Digest + Tu progreso strip; Tu turno includes review-launch, memory nudge, discovered ideas; urgency order; idea→shipped conversion on Inicio | Layout A-63; Tu turno = decisions + changes ready (the rest lives in Propuestas, iteration 15), decisions first; conversion lives in Logros → Estadísticas | Amend. |
| C-19 | FRD-21 REQ-21-002, REQ-21-003, REQ-21-005 | 3 h stale threshold; in-progress/ready/stale rows ordered by risk; `merge-queue.sh` command per row | Legend rule Depurar ya / Revisar pronto / Al día / Limpio; table by repository + dialog; `/pandacorp:worktrees` | Amend (A-72…A-74). The global entry point is owner item 1. |
| C-20 | FRD-22 AC-22-001.2, -002.1/.2, -003.1, -006.1–.3, -007.1, -007.3, -009.1 | Abiertos then En curso; two sub-tabs, Memoria default; how-to note; Ver/Ocultar hechos and Descartados toggles; inline confirm; generic command below the list | En curso then Abiertos; three tabs Resumen (default) · Memoria · Backlog; "Cómo avanzar" card above; one collapsed "Hechos y descartados"; confirm dialog with optional reason; commands in "Cómo avanzar" | Amend. |

Also recorded, no amendment needed from the FRDs: Inicio's H1 is "Centro de mando" while its nav label is "Inicio", against design rule 4d (H1 = nav label). The owner approved it in iteration 1, so S2.4 records it as a deliberate deviation in `design-decisions.md`. The not-found states (`idea-not-found`, `portfolio-project-not-found`, `project-tab-not-found`, `wo-detail-not-found`, `docs-page-not-found`) already belong to FRD-25 AC-25-007/-008.

## Prototype corrections for S2.1 (13)

In these cases the prototype breaks an FRD that stays, the prototype contract, or a newer fact. They are not Group B items, and S2.1 makes each one and re-captures.

| # | Where | Defect | Fix |
|---|---|---|---|
| P-01 | La Fragua scene control | `[data-demo-only]` is re-created on every Resumen render and leaks under `?demo=off`. It appears in 12 states plus the `proyecto` identity screen. | Hide at render time, or CSS `html[data-demo="off"] [data-demo-only]{display:none}`. S3 blocker otherwise. |
| P-02 | Skip link | `href="#content"` is routed as an unknown screen and re-renders Inicio | In-page focus handler that the router ignores. |
| P-03 | FRD-02 AC-02-009.5 | Idea hero shows the verdict chip "🧪 validate", which the AC says to omit | Remove the chip (keep FRD). |
| P-04 | FRD-02 AC-02-010.5 / .7 | "Entrar a La Fragua" targets the removed Party tab and shows on a locked build phase | Link to the project Resumen and hide it until the build phase is reached. |
| P-05 | FRD-02 #U5 | The restore dialog asks for a "Motivo (opcional)" | Remove the field. Restore takes no reason. |
| P-06 | FRD-04 #U1 | The Resumen decision dialog shows the bare `/pandacorp:decide` | Use the scoped `/pandacorp:decide <id>`, as Tu turno already does (keep FRD). |
| P-07 | FRD-21 | `/pandacorp:worktrees` is labelled "Habilidad propuesta" (dashed) | The skill exists (`plugin/skills/worktrees/`, DR-135). Show it as a normal command. |
| P-08 | FRD-18 REQ-18-021 | The next command comes from the phase: Funko Tracker, building with 9 orders in review, shows `/pandacorp:release`, and shipped PersonalPage v2 shows `/pandacorp:iterate` | Keep FRD: a building project with open orders → `/pandacorp:implement`, a shipped one → `/pandacorp:review-launch` (DR-043). Fix the fixture derivation on Inicio and Portafolio cards. |
| P-09 | FRD-15 | Code path `HEALTH.plugin.uncommitted` adds "N archivos modificados" to the banner. The fixture has 0, so no state draws it. | Keep FRD. The owner decided on 2026-06-22 that uncommitted `plugin/` edits never trigger the banner (it was a permanent false alarm). Remove the code path, and the proposal sentence "(or with uncommitted plugin changes)". |
| P-10 | FRD-13 #U5 / DR-129 | Non-transform transitions; dialog opacity pop fades text | Transform-only motion, sidebar collapse by transform, no text fade (C-03). |
| P-11 | FRD-08 #U1 | Inner strings "Buscar en todo el Manual", "Buscar en el Manual…", aria "Índice del Manual" | Say "Documentación". The short nav label "Manual" stays (C-10). |
| P-12 | Shell footer | Prototype-only text ("propuesta de diseño, no es la app real" and the capture stamp) | No app requirement. S2.5 notes in `fidelity-checklist.md` that the build masks or omits it. |
| P-13 | Captured Manual content | The guide "Elegir modo de construcción" says "Portfolio → Party" and mentions waves of 2/4/8 | App content (DR-046): the real Manual page is refreshed in the v2 build. S2.2 adds this to FRD-08's content-currency line. |

## Notes for the lead

- **I did not follow two suggested defaults.** For FRD-15's dirty-plugin banner (P-09) and FRD-13's motion rule (C-03), the FRD should win. The first is an explicit owner decision recorded on 2026-06-22; the second is the DR-129 prototype contract.
- **FRD-14 has no pack and no `states` folder.** It is `ui: true` and `implementation_status: VERIFIED`. Whatever the owner decides on B-52, S2.2 must set FRD-14's `visual_source` and either mark its ACs out or add the state.
- **Proposed new state ids** for S2.1, if M1 approves them: `wo-failed`, `build-no-signal`, `backlog-errors`, `model-invalid`, `worktrees-unreadable`, `stats-stream-error`, `accounts-source-error`, `portfolio-path-missing`, `factory-empty`, `home-calm`, `wo-frd-drift`, `project-change-rebuilds`, `idea-discarded-reason`, `shell-pending-chip`, `project-snapshot`, `portfolio-accounts`. Most need only a fixture variant under `docs/design/prototype/fixtures/`.
- **Left to S1.4 (copy):** FRD-quoted strings that differ only in wording. Examples are "Versión desfasada de Pandacorp" vs "Este proyecto usa una versión vieja…", "Volver a agregar" vs "Restaurar", "¡Logro desbloqueado!" vs "¡Nuevo logro!", the chip "Modelo diseñado, no verificado…", and English UI strings (kickers "Skill", "Estándar · Programming", scope chip "project", "esfuerzo high").
