# Context pack · FRD-11 · Per-project build modes

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-11 copy, S2.1 builds, S2.2 amendments, S2.3-11 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-11-build-modes/frd.md` (id FRD-11, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 3 under `states["frd-11-build-modes"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 4 AC lines: 1 drawn · 1 partially drawn · 0 not drawn · 2 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-11#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-11-001 · partial · `commands`

> - **REQ-11-001** — EACH project SHALL offer (in its Commands tab) a **build mode** selector — rendered as a compact
>   inline **`<select>`** on the `/pandacorp:implement` command row (the shared `CmdRow` control; it
>   replaced the prototype's 4-chip radio panel, owner decision 2026-06-27) — with four options:
>   - **Pro / economical** — 1 agent at a time, economical models (sonnet/haiku). Slower, minimal consumption. For the Pro plan.
>   - **Balanced** (default) — a team of ≤3 agents; opus lead, sonnet/haiku workers. Designed for Max 5x.
>   - **Powerful** — up to 5 agents in parallel, advances faster. For Max 20x.
>   - **Deep** — the best models across the board + extra adversarial review. For a special project.

**Prototype:** Four modes are drawn as a 4-card picker "Modo de construcción" (Equilibrado default · Pro · Potente · Profundo, each with an icon, tag, 1-4 power meter and hint), not as an inline `<select>` on the command row (the AC itself says the select replaced the 4-chip panel in 2026-06-27). Hints: Pro "1 agente a la vez, modelos económicos (sonnet/haiku)…"; Equilibrado "Equipo de ≤3 agentes…"; Potente "Hasta 5 agentes en paralelo…"; Profundo "Mejores modelos en todos + revisión adversarial extra…". The picker also appears (collapsed) in the Campaña build ficha ("Elegir modo de construcción").

### REQ-11-002 · drawn · `commands`, `commands-mode-powerful`

> - **REQ-11-002** — WHEN the owner chooses a mode, the **exact command to copy** SHALL be shown (`/pandacorp:implement [mode]`) with its description (agents, models, recommended plan).

**Prototype:** The exact command is shown under the picker: `/pandacorp:implement` for the default mode and `/pandacorp:implement powerful` after choosing Potente, with its hint (agents, models, plan).

### REQ-11-003 · behaviour only · `commands-mode-powerful`

> - **REQ-11-003** — The chosen mode SHALL be **remembered per project**.

**Prototype:** The chosen mode is remembered per project in the browser (`orbita-mode-<project>`); no state captures a reload.

### REQ-11-004 · behaviour only · `commands`

> - **REQ-11-004** — The `/pandacorp:implement` skill SHALL accept those modes as an argument (`pro` | `powerful` | `deep`; no argument = balanced).

**Prototype:** The skill's argument contract; the picker output matches (`pro | powerful | deep`, none = balanced).

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `commands` | `#portfolio?project=mission-control&tab=Comandos` | (none) | full page | `REQ-11-001` `REQ-11-002` `REQ-11-004` |
| `commands-mode-powerful` | `#portfolio?project=mission-control&tab=Comandos` | click `[data-mode="powerful"]` | full page | `REQ-11-002` `REQ-11-003` |
| `commands-target-scoped` | `#portfolio?project=mission-control&tab=Comandos` | js `const s = document.querySelector('#cmd-target'); s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bu…` | full page | — |

**Not drawn (0)**: none.

**Partially drawn (1)**: `REQ-11-001`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `commands`

- [@aria-label] Ruta
- [span] MC
- [span] 109/110 WO · 99%
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
- [b] Cambiar proyecto
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [@aria-label] Secciones de Mission Control
- [button[tab]] Spec
- [button[tab]] Observabilidad 110
- [button[tab]] Cambios 3
- [button[tab]] Documentos 175
- [h2] Siguiente paso
- [code] /pandacorp: release
- [@aria-label] Copiar /pandacorp:release
- [code] /pandacorp: iterate
- [@aria-label] Copiar /pandacorp:iterate
- [p] Con cuánta potencia se construye. Se recuerda por proyecto.
- [b] Equilibrado default
- [@aria-label] Potencia 2 de 4 (×4 of the same pattern)
- [small] Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.
- [b] Pro pro
- [b] Potente powerful
- [b] Profundo deep
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [h2] Construir un objetivo concreto
- [p] Elige un FRD, una orden pendiente o un cambio de la cola para acotar el build.
- [@aria-label] Objetivo del build
- [option] Elige un FRD o work order…
- [option] FRD-01 · Data reading (×26 of the same pattern)
- [option] WO-02-014 · Accessible empty-column marker
- [option] Cambio · Buscar ideas sin importar las tildes
- [option] Cambio · Proyectos con la misma fecha cambian de orden al recargar
- [option] Cambio · La línea de tiempo no marca los días sin actividad
- [code] /pandacorp: implement <id>
- [@aria-label] Copiar /pandacorp:implement <id>
- [h2] Cambios y decisiones
- [p] Pedir un cambio o un bug
- [code] /pandacorp: change
- [@aria-label] Copiar /pandacorp:change
- [p] Responder una decisión pendiente
- [code] /pandacorp: decide
- [@aria-label] Copiar /pandacorp:decide
- [p] Paquete grande o rediseño
- [code] /pandacorp: new-version
- [@aria-label] Copiar /pandacorp:new-version
- [p] Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.

### `commands-mode-powerful`

- [code] /pandacorp: implement powerful
- [@aria-label] Copiar /pandacorp:implement powerful

### `commands-target-scoped`

- [code] /pandacorp:implement FRD-01
- [@aria-label] Copiar /pandacorp:implement FRD-01

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Pro / economical · Balanced (default) · Powerful · Deep" | "Pro · Equilibrado (default) · Potente · Profundo" with tags "pro / default / powerful / deep".
- Hints in Spanish ("Para plan Pro", "Para Max 20x") keep the plan names; the AC lists them in English.
- Target builder (not in FRD-11): "Construir un objetivo concreto" with `/pandacorp:implement <id>`, `FRD-01` after choosing (commands-target-scoped).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The AC describes an inline `<select>` on the `CmdRow`; the approved prototype draws a four-card picker. The FRD text (and the Campaña ficha's AC-02-010.9 wording) need amending (Group A/B decision for S1.3).

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 27 (owner approved Comandos): each card's icon and commands carry a category colour (a faint tint and a coloured prompt, no edge stripe); the four build modes get an icon and a 1-4 power meter; in "Cambios y decisiones" each command takes the colour of what it does (change pink, decision amber, new version violet).
- Iteration 28: command boxes inside a coloured card take its tint and a coloured prompt on every screen.
- 2026-10-21: build modes and commands are never executed by the app (the card text "Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.").

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
