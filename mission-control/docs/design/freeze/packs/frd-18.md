# Context pack · FRD-18 · Dashboard ("Inicio", the command center)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-18 copy, S2.1 builds, S2.2 amendments, S2.3-18 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-18-dashboard/frd.md` (id FRD-18, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 3 under `states["frd-18-dashboard"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 24 AC lines: 4 drawn · 7 partially drawn · 11 not drawn · 2 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-18#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-18-001 · drawn · `home`, `shell-expanded`

> - **REQ-18-001** — The dashboard SHALL be the default landing view; the Board / Portfolio / Achievements / Configuration / Documentation tabs SHALL remain reachable from the top nav.

**Prototype:** Inicio ("Centro de mando") is the landing route; the other six destinations are in the sidebar, rail or bottom navigation.

### REQ-18-002 · drawn · `home`

> - **REQ-18-002** — The dashboard SHALL be read-only and SHALL NOT call Claude; every actionable item SHALL surface the exact `/pandacorp:*` command with a copy button, and clicking an item SHALL navigate to the relevant project, idea or board.

**Prototype:** Read-only; every actionable item shows the exact command with a copy button; clicking a project card navigates to the project, "Abrir tablero" / "Ver logros" / "Revisar" link to their screens.

### REQ-18-003 · partial · `home`

> - **REQ-18-003** — **Exception-first / quiet when healthy**: WHEN nothing needs the operator, the screen SHALL read calm (e.g. "Tu turno" shows an *al día* badge) rather than manufacture urgency. No vanity or cumulative counters with no decision attached.

**Prototype:** Counts are shown as a chip ("Tu turno 6"); the calm empty message "Nada espera tu acción ahora mismo." exists in code but the fixture is not quiet, and the "al día" badge is NOT drawn.

### REQ-18-004 · behaviour only · `home`

> - **REQ-18-004** — **Real-time / event-driven**: the dashboard SHALL update LIVE — it watches the events NDJSON stream and the project `status.yaml` files and pushes deltas into the affected sections (digest count, queue, pulse, project cards), NOT a static render produced only on navigation. WHEN a new event arrives or a status file changes, the relevant section SHALL reflect it without the operator reloading the page.

**Prototype:** Live updates are not captured.

### REQ-18-005 · not drawn · `home`

> - **REQ-18-005** — The section SHALL show factory **events** (work orders closed/failed, phase transitions, decisions queued, lessons captured) as change-framed items with a relative timestamp, read from the event stream + state diffs (FRD-01) — NOT as cumulative totals.

**Prototype:** The "Desde tu última visita" digest is NOT drawn (owner decision 2026-10-21: the digest with count and mark-seen stays out of v2).

### REQ-18-006 · not drawn · `home`

> - **REQ-18-006** — The "seen" marker (`visto_hasta`) SHALL be locally persisted and SHALL survive a page refresh and a tab close; a refresh or a mere visit SHALL NOT advance it.

**Prototype:** Seen marker: digest not drawn (out of v2).

### REQ-18-007 · not drawn · `home`

> - **REQ-18-007** — The marker SHALL advance ONLY when the operator acknowledges (a "marcar visto" action) or acts on an item. Events newer than the marker are "new" (highlighted and counted); a refresh therefore never loses unseen events.

**Prototype:** "marcar visto": not drawn (out of v2).

### REQ-18-008 · not drawn · `home`

> - **REQ-18-008** — WHEN there are no new events, the section SHALL NOT be empty: it SHALL show an *al día* state plus the **last-24h activity** (dimmed) as a rolling-window fallback.

**Prototype:** Digest al día / last-24h fallback: not drawn (out of v2).

### REQ-18-009 · not drawn · `home`

> - **REQ-18-009** — (Always-open use) The section SHOULD update live as new events arrive, incrementing the "new" count without a refresh.

**Prototype:** Live digest count: not drawn (out of v2).

### REQ-18-010 · partial · `home`, `home-turn-dialog`

> - **REQ-18-010** — The queue SHALL contain ONLY items that genuinely require the owner (a human gate): pending decisions (`.pandacorp/inbox/decisions.md` — spend money, deploy to prod, design/stack choice, delete data), shipped projects awaiting `/pandacorp:review-launch` (DR-043), the memory backlog nudge (FRD-17), and ideas in "Descubierta" awaiting prioritization.

**Prototype:** "Tu turno" holds pending decisions ("Decisión · hace 41 días", one flagged "ya resuelta en el archivo") and changes ready to build ("Cambio listo · pedido el 18 oct. 2026"), grouped decisions first. Shipped projects awaiting review-launch, the memory backlog nudge and the ideas in Descubierta are NOT in Tu turno (they live in Propuestas).

### REQ-18-011 · drawn · `home`

> - **REQ-18-011** — Routine progress SHALL NOT appear here: a running build, an auto-retried failed work order, and `advance_pending` (DR-032) are NOT owner gates — `advance_pending` is visible on the Board, not in this queue.

**Prototype:** Routine progress is separate: the "En marcha 30" card (Construyéndose ahora, Esperan la revisión de su FRD, Borradores en la cola) holds running builds and review-waiting orders, not owner gates.

### REQ-18-012 · partial · `home`

> - **REQ-18-012** — Items SHALL be ordered by urgency; the section header SHALL show the count of items waiting, or an *al día* badge when none.

**Prototype:** Items are ordered decisions first, then changes (not by urgency) and the header shows the count chip; the "al día" badge for zero is NOT drawn.

### REQ-18-013 · partial · `home`

> - **REQ-18-013** — The pulse SHALL present a small funnel (ideas alive → in construction → shipped) plus the count of items awaiting the owner, and SHALL surface the **one metric that matters**: the idea→shipped conversion. It composes FRD-12 and SHALL keep to ≤5 signals.

**Prototype:** "Pulso" shows Proyectos 5 · FRDs 53 · "167 de 218 WO verificados", and "Embudo de ideas" shows ideas alive per phase with "12 descartadas". The idea→shipped conversion metric ("the one metric that matters") is NOT on Inicio (it lives in Logros → Estadísticas).

### REQ-18-014 · behaviour only · `home`

> - **REQ-18-014** — **"Shipped" means launched, internal or external (DR-085).** A launch is either a legacy idea card hand-marked `status: "shipped"` with no linked project, or a portfolio project whose `.pandacorp/status.yaml` reports `phase: "release"` — an `in-pipeline` card's project reaching `release` counts as a launch even though the card itself stays `in-pipeline` (it freezes as a pointer, DR-085). The count SHALL come from THE single bridge resolver (`countLaunched`, `lib/ideas/ideas.ts`, DR-115) — the same one the Logros Informe funnel uses — never a local re-filter of ideas by `status: "shipped"` alone, or the two surfaces silently disagree on the same fact.

**Prototype:** Launched count via the single bridge resolver: data rule (the funnel's Lanzamiento column shows 1).

### REQ-18-015 · partial · `home`

> - **REQ-18-015** — The "in construction" signal SHALL distinguish live builds from stale ones via the honest live / no-signal indicator (FRD-12).

**Prototype:** Live vs stale builds: only a violet "Construyendo" chip on Funko Tracker; the honest live / no-signal indicator is NOT drawn.

### REQ-18-016 · partial · `home`

> - **REQ-18-016** — Per active project (architecture / building) and per shipped project, a card SHALL show phase + version, work-order progress, age-in-stage, and the next command.

**Prototype:** Card per project: avatar, phase chip, progress ring ("39 de 48 work orders verificados" on focus), six-segment stepper with phase names, "Etapa 5 de 6 del pipeline · último cambio hace 1 h", counts (WO verificados, FRDs, docs), "Siguiente · /pandacorp:release". Version and age-in-stage are NOT drawn.

### REQ-18-017 · not drawn · `home`

> - **REQ-18-017** — WHEN a running build's last event is older than a freshness threshold, the card SHALL flag it *sin señal* (no-signal) with the last-event time; a fresh build SHALL show *en vivo* (live). (No-signal is itself the alarm.)

**Prototype:** "sin señal" flag with the last-event time: NOT drawn.

### REQ-18-018 · not drawn · `home`

> - **REQ-18-018** — WHEN a project has sat in its current phase beyond a staleness threshold, the card SHALL flag it *estancado* (stalled) with the age.

**Prototype:** "estancado" flag with age: NOT drawn.

### REQ-18-019 · not drawn · `home`

> - **REQ-18-019** — WHEN a project has open bugs awaiting processing (count > 0), the card SHALL show a **"N bugs" count chip** so the operator sees pending defects at a glance.

**Prototype:** "N bugs" chip: NOT drawn.

### REQ-18-020 · not drawn · `home`

> - **REQ-18-020** — WHEN a work order is failing/blocked, the card SHALL surface the blocker reason inline (no need to open logs).

**Prototype:** Blocker reason inline: NOT drawn.

### REQ-18-021 · partial · `home`

> - **REQ-18-021** — The **next command** shown per card SHALL be derived from the project phase: a `building` project with work orders still open SHALL map to `/pandacorp:implement`; a `shipped` project SHALL map to `/pandacorp:review-launch`; otherwise the phase's natural next step.

**Prototype:** Next command per card comes from the project's phase commands in the capture ("/pandacorp:release" for Funko Tracker with 9 orders in review; "/pandacorp:implement" for projects in Arquitectura; "/pandacorp:iterate" for the shipped PersonalPage v2): the AC wants implement for a building project with open orders and review-launch for a shipped one.

### FRD-18#U1 · not drawn · `home`

> - A shipped project SHALL be presented as *estable · en operación* with `/pandacorp:review-launch` as its next action.

**Prototype:** The shipped card shows the phase chip "Lanzamiento" and "Siguiente · /pandacorp:iterate"; "estable · en operación" and `/pandacorp:review-launch` are NOT drawn.

### FRD-18#U2 · not drawn · `home`

> - WHEN there are no active projects, the section SHALL show a **first-action card** with the command to start one — never a blank.

**Prototype:** The first-action card for "no active projects" is NOT drawn (the fixture has five projects).

### FRD-18#U3 · drawn · `home`

> - The strip SHALL show the guild level/XP, the most recent achievement and the next milestone, all derived from **real outcomes** (shipped, phases completed, lessons graduated) per FRD-09. No streaks, no false urgency.

**Prototype:** Gremio card: rank sprite and name, "Nivel 22 · 2410 XP", bar, "25 XP para el nivel 23 · 18 trofeos", "Último logro · 6 oct. 2026" with its title, "Ver logros".

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `home` | `#inicio` | (none) | full page | `REQ-18-001` `REQ-18-002` `REQ-18-003` `REQ-18-004` `REQ-18-005` `REQ-18-006` `REQ-18-007` `REQ-18-008` `REQ-18-009` `REQ-18-010` `REQ-18-011` `REQ-18-012` `REQ-18-013` `REQ-18-014` `REQ-18-015` `REQ-18-016` `REQ-18-017` `REQ-18-018` `REQ-18-019` `REQ-18-020` `REQ-18-021` `FRD-18#U1` `FRD-18#U2` `FRD-18#U3` |
| `home-turn-dialog` | `#inicio` | click `[data-turn="0"]` → wait for `dialog[open]` | capture viewport | `REQ-18-010` |
| `home-in-flight-open` | `#inicio` | click `.flight-group > summary` | full page | — |

States cited above that belong to another FRD folder (captured there, reused here): `shell-expanded`.

**Not drawn (11)**: `REQ-18-005`, `REQ-18-006`, `REQ-18-007`, `REQ-18-008`, `REQ-18-009`, `REQ-18-017`, `REQ-18-018`, `REQ-18-019`, `REQ-18-020`, `FRD-18#U1`, `FRD-18#U2`.

**Partially drawn (7)**: `REQ-18-003`, `REQ-18-010`, `REQ-18-012`, `REQ-18-013`, `REQ-18-015`, `REQ-18-016`, `REQ-18-021`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `home`

- [span] Captura de proyectos · 20 oct. 2026, 7:20 p. m.
- [h1] Centro de mando
- [p] Primero lo que necesita tu acción; después lo que avanza y el estado de tus proyectos.
- [h2] El plugin instalado está atrás
- [p] Tienes instalada la 9.140.0 y el repositorio ya va por la 9.141.0. Las skills que corras usan la versión vieja hasta que actualices.
- [p] 1) Corre el comando · 2) Reinicia la sesión de Claude Code.
- [@aria-label] Copiar claude plugin update pandacorp@panda-corp
- [h2] Tu turno 6
- [span] PersonalPage v2 · Decisión · hace 41 días
- [code] /pandacorp: decide 2026-09-10-1 (×2 of the same pattern)
- [@aria-label] Copiar /pandacorp:decide 2026-09-10-1 (×2 of the same pattern)
- [@data-tip] Copiar comando
- [button] Detalles
- [@aria-label] Detalles: Textos del inicio y de "sobre mí" — 2 de 4 ajustes listos, faltan 2 (×6 of the same pattern)
- [span] PersonalPage v2 · Decisión · hace 112 días · ya resuelta en el archivo
- [span] Mission Control · Cambio listo · pedido el 18 oct. 2026 (×3 of the same pattern)
- [code] /pandacorp: implement change: board-search-diacritics
- [@aria-label] Copiar /pandacorp:implement change:board-search-diacritics
- [code] /pandacorp: implement change: rail-sort-ties
- [@aria-label] Copiar /pandacorp:implement change:rail-sort-ties
- [code] /pandacorp: implement change: timeline-gap-label
- [@aria-label] Copiar /pandacorp:implement change:timeline-gap-label
- [span] Funko Tracker · Cambio listo · pedido el 20 oct. 2026
- [code] /pandacorp: implement change: collection-csv-import
- [@aria-label] Copiar /pandacorp:implement change:collection-csv-import
- [span] Tu cartera
- [a] Ver portafolio
- [span] FT
- [@aria-label] 39 de 48 work orders verificados (×4 of the same pattern)
- [@aria-label] Fase: Construcción
- [@data-tip] 1. Investigación · completada
- [span] Investigación: completada
- [@data-tip] 2. Producto · completada
- [span] Producto: completada
- [@data-tip] 3. Diseño · completada
- [span] Diseño: completada
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · fase actual
- [span] Construcción: fase actual
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [span] Etapa 5 de 6 del pipeline · último cambio hace 1 h (×5 of the same pattern)
- [span] 39/48 WO verificados (×5 of the same pattern)
- [span] 82 docs (×5 of the same pattern)
- [span] Construyendo
- [div] Siguiente · /pandacorp:release
- [span] MC
- [span] 26 FRDs (×2 of the same pattern)
- [span] PS
- [@aria-label] Fase: Arquitectura
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [div] Siguiente · /pandacorp:implement
- [span] PC
- [span] Sin WOs
- [@data-tip] Aún no tiene work orders publicados
- [span] PV
- [@aria-label] Fase: Lanzamiento
- [@data-tip] 5. Construcción · completada
- [span] Construcción: completada
- [@data-tip] 6. Lanzamiento · fase actual
- [span] Lanzamiento: fase actual
- [div] Siguiente · /pandacorp:iterate
- [h2] En marcha 30
- [p] Trabajo que ya está en manos de la fábrica. No espera una decisión tuya; avanza cuando corre el build.
- [b] Construyéndose ahora
- [small] Cambios que un build está implementando.
- [small] Funko Tracker · cambio en curso
- [button] Ver cambio
- [small] PersonalPage v2 · cambio en curso
- [b] Esperan la revisión de su FRD
- [small] Órdenes ya construidas; se verifican cuando el build revisa su FRD completo.
- [span] Work order en revisión
- [strong] WO-02-014 · Accessible empty-column marker (×10 of the same pattern)
- [small] Mission Control · se cierra cuando el build revise su FRD
- [a] Abrir orden
- [small] Funko Tracker · se cierra cuando el build revise su FRD
- [b] Borradores en la cola
- [small] Cambios capturados que aún no están listos para construirse.
- [span] Borradores
- [strong] 5 cambios en borrador (×2 of the same pattern)
- [small] Funko Tracker · aún no entran al build hasta quedar listos
- [a] Revisar
- [small] PersonalPage v2 · aún no entran al build hasta quedar listos
- [h2] Pulso
- [small] de 218 WO verificados
- [div] Nivel 22 · 2410 XP
- … 26 more patterns omitted (same kinds as above).

### `home-turn-dialog`

- [dlg p] Decisión · PersonalPage v2
- [dlg p] Decisión pendiente en PersonalPage v2: un agente encontró algo que no debe decidir solo (alcance, dinero o algo irreversible) y ese punto espera tu respuesta.
- [dlg span] hace 41 días
- [dlg span] Lo que se necesita de ti
- [dlg span] Recomendación del agente
- [dlg span] Corre en la carpeta de PersonalPage v2. Te muestra la pregunta, las opciones y la recomendación, primero te pregunta si sigue vigente, y guarda tu respuesta.

### `home-in-flight-open`

- [h2] En marcha 30
- [p] Trabajo que ya está en manos de la fábrica. No espera una decisión tuya; avanza cuando corre el build.
- [b] Construyéndose ahora
- [small] Cambios que un build está implementando.
- [small] Funko Tracker · cambio en curso
- [button] Ver cambio
- [small] PersonalPage v2 · cambio en curso
- [b] Esperan la revisión de su FRD
- [small] Órdenes ya construidas; se verifican cuando el build revisa su FRD completo.
- [span] Work order en revisión
- [strong] WO-02-014 · Accessible empty-column marker (×10 of the same pattern)
- [small] Mission Control · se cierra cuando el build revise su FRD
- [a] Abrir orden
- [small] Funko Tracker · se cierra cuando el build revise su FRD
- [b] Borradores en la cola
- [small] Cambios capturados que aún no están listos para construirse.
- [span] Borradores
- [strong] 5 cambios en borrador (×2 of the same pattern)
- [small] Funko Tracker · aún no entran al build hasta quedar listos
- [a] Revisar
- [small] PersonalPage v2 · aún no entran al build hasta quedar listos

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- Layout order in the FRD (health banners, digest, Tu turno, Pulso, Construcción y cartera, Tu progreso) | prototype: plugin banner, Tu turno, Tu cartera, En marcha | right column Pulso, Gremio, Embudo de ideas, Árboles de trabajo.
- Section names "Pulso de la fábrica", "Construcción y cartera", "Tu progreso" | "Pulso", "Tu cartera", "Gremio".
- Page title "Dashboard (Inicio, the command center)" | H1 "Centro de mando" (nav label "Inicio").
- "Tu turno ... al día" | count chip only.
- "N bugs", "sin señal", "estancado", "en vivo" | absent.
- Next-command copy "Siguiente · /pandacorp:release" (prototype) vs "/pandacorp:implement" rule (REQ-18-021).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The digest (REQ-18-005..009) is FRD-18's second block but stays out of v2 (owner decision 2026-10-21). The FRD needs those ACs removed or marked deferred.
- Tu turno scope: FRD lists five kinds (decisions, review-launch, memory nudge, discovered ideas), the prototype only decisions and changes ready (decision 2026-10-20, iteration 15 moved the rest to Propuestas).
- Health indicators per card (REQ-18-015, -017, -018, -019, -020) have no drawn counterpart.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iterations 2-4 (owner): Inicio first element is the plugin warning; Tu turno one short line per item with the exact command and a "Detalles" modal (what it is, what is needed, the agent's recommendation, context, what the command does); portfolio cards explain themselves (ring tooltip, six-part bar with names, "Etapa N de 6"); activity left Inicio; Árboles de trabajo returned as a table (project, branches not integrated, leftover worktrees, one coloured state) with the proposed `/pandacorp:worktrees` labelled "Habilidad propuesta".
- Iteration 3: left column Tu turno → Tu cartera → En marcha; right column Pulso → Gremio → Embudo de ideas → Árboles de trabajo; decisions show their age and the scoped command `/pandacorp:decide <id>`.
- 2026-10-21 scope: the Inicio digest with count and mark-seen stays out of v2.
- Iteration 26: two-column pairs become one column below 1024 px with Tu turno first.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
