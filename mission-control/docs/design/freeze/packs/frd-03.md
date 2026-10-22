# Context pack · FRD-03 · Portfolio and project navigation

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-03 copy, S2.1 builds, S2.2 amendments, S2.3-03 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-03-portfolio/frd.md` (id FRD-03, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 5 under `states["frd-03-portfolio"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 9 AC lines: 1 drawn · 3 partially drawn · 4 not drawn · 1 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-03#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-03-001 · not drawn · `portfolio-cards`, `portfolio-list`

> - **REQ-03-001** — The portfolio SHALL list, in a vertical panel on the left, ONLY the projects in `building` and `shipped` (those that have started development); projects in `product` / `design` / `architecture` SHALL NOT appear here (they are on the Tablero).

**Prototype:** There is no left rail of building/shipped projects and the Portafolio overview lists ALL five projects, including PandaSaga and PandaCast in Arquitectura. The sidebar's "Proyectos" group (max five, "Ver los N") and the project picker also list every project. Conflict with the membership rule for S1.3.

### REQ-03-002 · behaviour only · `portfolio-cards`

> - **REQ-03-002** — WHEN a project is re-versioned and returns to `implementation` (building), it SHALL re-appear in the Portfolio rail.

**Prototype:** Re-versioned project returns to Construcción: data rule, nothing to draw.

### REQ-03-003 · partial · `portfolio-cards`, `portfolio-list`

> - **REQ-03-003** — EACH project in the list SHALL show its title, its stage and an indicator: "building" if `running`, "stopped" if not.

**Prototype:** Each project shows title, stage (phase chip + six-segment stepper "Etapa N de 6") and a violet "Construyendo" chip only when running; the "stopped" indicator is NOT drawn (the project header says "Sin construcción activa").

### REQ-03-004 · partial · `portfolio-list`

> - **REQ-03-004** — EACH project row SHALL show a **pending-decisions count badge** when it has unresolved decisions (count > 0) and a **bugs count badge** when it has bugs awaiting processing (count > 0), so the owner sees what needs attention without opening the workspace.

**Prototype:** The comparison list has columns "Cambios abiertos" and "Decisiones" (a count of decisions, e.g. 2 for PersonalPage v2). No bugs count badge is drawn; the sidebar rows carry no count badge.

### REQ-03-005 · drawn · `portfolio-cards`, `project-summary`

> - **REQ-03-005** — WHEN the owner selects a project in the list, the system SHALL show its workspace (FRD-04) in the right-hand panel.

**Prototype:** Clicking a card (or a sidebar project) opens the workspace, which takes the full content width.

### REQ-03-006 · not drawn · `portfolio-cards`

> - **REQ-03-006** — WHEN no project is selected, the system SHALL select the first one by default.

**Prototype:** With no project selected the overview is shown (a card grid); the first project is not selected by default.

### REQ-03-007 · partial · `portfolio-cards`

> - **REQ-03-007** — WHEN a portfolio entry carries a `last sync` date, its project row **on the portfolio rail (the surface `/portfolio` mounts)** SHALL show a chip with the relative time since that sync in Spanish ("hoy", "ayer", "hace N días", "hace N meses"), using the row's existing chip style; an unparseable date SHALL be shown as an explicit invalid-date chip, never hidden silently (WO-03-006; mounted on the rail by the 2026-09-30 follow-up, because the first build put it on a component no route mounted).

**Prototype:** Each card ends "Etapa N de 6 del pipeline · último cambio hace 1 h" (relative time of the last commit, Spanish "hace N h / días"); the unparseable-date chip is NOT drawn.

### FRD-03#U1 · not drawn · `portfolio-cards`

> - IF there are no active projects, THEN the system SHALL show an empty state gracefully.

**Prototype:** Empty portfolio ("no active projects") state is NOT drawn.

### FRD-03#U2 · not drawn · `portfolio-cards`

> - IF a project's local path does not exist on disk (folder deleted or moved), the system SHALL show a `⚠️ path not found` badge on the project row.
>   - IF the project has a `repo:` URL in the portfolio, the system SHALL show the recovery command: `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (copyable text, same shape as FRD-15/16 banners).
>   - IF there is no `repo:`, the system SHALL show a warning: "No remote registered — check a local backup or recreate with `/pandacorp:spec`."
>   - The detection is **read-only**: the app never clones, writes to the portfolio, or calls Claude.
>   - The badge disappears once the path exists on disk again (detected on next read/sync).

**Prototype:** "path not found" badge, the `git clone <repo> <path>` recovery command and the no-remote warning are NOT drawn.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `portfolio-cards` | `#portfolio` | (none) | full page | `REQ-03-001` `REQ-03-002` `REQ-03-003` `REQ-03-005` `REQ-03-006` `REQ-03-007` `FRD-03#U1` `FRD-03#U2` |
| `portfolio-list` | `#portfolio?view=lista` | (none) | full page | `REQ-03-001` `REQ-03-003` `REQ-03-004` |
| `portfolio-project-picker` | `#portfolio?project=mission-control` | click `[data-action="projects"]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | — |
| `portfolio-project-picker-search` | `#portfolio?project=mission-control` | click `[data-action="projects"]` → fill `#project-search` = "funko" → wait for `dialog[open]` | capture viewport; widths 375/1280 | — |
| `portfolio-project-not-found` | `#portfolio?project=does-not-exist` | (none) | full page | — |

States cited above that belong to another FRD folder (captured there, reused here): `project-summary`.

**Not drawn (4)**: `REQ-03-001`, `REQ-03-006`, `FRD-03#U1`, `FRD-03#U2`.

**Partially drawn (3)**: `REQ-03-003`, `REQ-03-004`, `REQ-03-007`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `portfolio-cards`

- [span] Captura de proyectos · 20 oct. 2026, 7:20 p. m.
- [p] Tus proyectos lado a lado. Entra a uno para recorrer su Spec, arquitectura, work orders y documentos.
- [@aria-label] Vista de proyectos
- [button] Lista
- [span] Ordenados por último cambio
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

### `portfolio-list`

- [span] Captura de proyectos · 20 oct. 2026, 7:20 p. m.
- [p] Tus proyectos lado a lado. Entra a uno para recorrer su Spec, arquitectura, work orders y documentos.
- [@aria-label] Vista de proyectos
- [button] Lista
- [span] Ordenados por último cambio
- [h2] Comparativa
- [@aria-label] Comparativa de proyectos
- [th] Fase
- [th] FRDs
- [th] Docs
- [th] ADRs
- [th] Cambios abiertos

### `portfolio-project-picker`

- [dlg p] Cartera
- [dlg h2] Cambiar de proyecto
- [dlg @aria-label] Buscar proyecto
- [dlg @placeholder] Buscar proyecto…
- [dlg span] FT
- [dlg small] Construcción · 8 FRDs · 82 documentos · 39/48 WO (×2 of the same pattern)
- [dlg span] PS
- [dlg small] Arquitectura · 7 FRDs · 66 documentos · 0/35 WO
- [dlg span] PC
- [dlg small] Arquitectura · 4 FRDs · 11 documentos · sin WOs
- [dlg span] PV
- [dlg small] Lanzamiento · 8 FRDs · 53 documentos · 19/25 WO

### `portfolio-project-picker-search`

- [dlg p] Cartera
- [dlg h2] Cambiar de proyecto
- [dlg @aria-label] Buscar proyecto
- [dlg @placeholder] Buscar proyecto…
- [dlg span] FT
- [dlg small] Construcción · 8 FRDs · 82 documentos · 39/48 WO (×2 of the same pattern)
- [dlg span] PS
- [dlg small] Arquitectura · 7 FRDs · 66 documentos · 0/35 WO
- [dlg span] PC
- [dlg small] Arquitectura · 4 FRDs · 11 documentos · sin WOs
- [dlg span] PV
- [dlg small] Lanzamiento · 8 FRDs · 53 documentos · 19/25 WO

### `portfolio-project-not-found`

- [strong] Este proyecto no existe en la captura
- [span] No hay ningún proyecto «does-not-exist».
- [a] Ver todos los proyectos

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- REQ-03-003 "building" / "stopped" | "Construyendo" / "Sin construcción activa" (portfolio-cards, project-summary).
- REQ-03-007 chips "hoy / ayer / hace N días / hace N meses" | "hace 1 h", "hace 43 h" on cards and "hoy / ayer / hace N días" in the project header ("último movimiento").
- FRD title "Portfolio and project navigation" and nav label | nav label and H1 "Portafolio" (iteration 27).
- Out of scope text "business snapshot" | not drawn (consistent with the FRD).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Portfolio membership rule (REQ-03-001, "Portfolio membership (the rule)") contradicts the overview: the prototype lists all projects at every phase.
- "vertical panel on the left" rail (REQ-03-001, -005, -006) became the sidebar project list plus a picker dialog ("Cambiar proyecto") and the card/list overview.
- Global Accounts view of "Global account directory extension" (Projects and Accounts SubTabs, `portfolioView=accounts`) is NOT drawn: only the per-project Cuentas tab exists.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- 2026-10-21: targets desktop + tablet + phone; the picker dialog and the overview adapt per width (the comparison table becomes one card per row below 1024 px; iteration 26).
- Iteration 2: the sidebar orders projects by last commit, shows at most five with "Ver los N", header "Proyectos" collapses (remembered per browser); cards and picker use the same order.
- Iteration 20: Tarjetas / Lista switch, one view at a time, `view=lista` in the URL.
- Iteration 27 language rule: "Portafolio" in the interface; the artifact names stay English.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
