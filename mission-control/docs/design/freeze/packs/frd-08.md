# Context pack · FRD-08 · Documentation

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-08 copy, S2.1 builds, S2.2 amendments, S2.3-08 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-08-documentation/frd.md` (id FRD-08, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 9 under `states["frd-08-documentation"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 19 AC lines: 2 drawn · 7 partially drawn · 3 not drawn · 7 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-08#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-08#U1 · partial · `docs-home`, `docs-page`

> - The Documentation SHALL be labelled **"Documentación"** in the top nav and as its page H1; "Manual" / "Códice" SHALL NOT be the surface name.

**Prototype:** Nav label, page H1 and breadcrumbs say "Documentación". The rail/bottom-nav mini label is "Manual", and strings inside still say "Manual" ("Buscar en todo el Manual", "Buscar en el Manual…", aria "Índice del Manual", "Anterior/Siguiente en Conceptos"). The AC forbids "Manual" as the surface name.

### FRD-08#U2 · drawn · `docs-page`, `docs-page-index-open`

> - The Documentation SHALL offer a side menu with pages and a reading area that renders each page.

**Prototype:** Reader with breadcrumbs, a "Paso X de Y" progress bar on tutorial pages (docs-page-tutorial), previous/next inside the group ("Anterior en Conceptos" / "Siguiente en Conceptos"), and the page index on the RIGHT ("Índice · El pipeline", "2 de 22") with search; below 900 px the index folds behind a toggle (docs-page-index-open).

### FRD-08#U3 · partial · `docs-home`, `docs-page`, `docs-page-tutorial`, `docs-page-guide`

> - The pages SHALL be organized by the full **Diátaxis** taxonomy: **tutorials** ("Empezar aquí" — learning-oriented, the first-mission walkthrough), **how-to guides** ("Guías" — task-oriented), **reference** ("Referencia" — information-oriented, the catalogs) and **explanation / concepts** ("Conceptos" — understanding-oriented, the why). Every documentation page SHALL belong to one of these four buckets.

**Prototype:** "Explorar por tipo": Tutorial (2 páginas), Guías (11), Conceptos (22), Workflows (3) and a Referencia card "En Configuración". Home also has "Empieza aquí", "Guías para el día a día" and one full-text search. Four Diátaxis buckets are not reproduced one to one (Workflows added; Reference lives in Configuración).

### FRD-08#U4 · behaviour only · `docs-page`

> - The pages SHALL cover, at minimum: what Pandacorp is, the flow, the stages in detail, the commands, the implementation modes, the standards, and how to operate / hand off to another person.

**Prototype:** Page coverage is the app's own content (38 captured pages); not a design concern.

### FRD-08#U5 · behaviour only · `docs-home`

> - The content SHALL be sufficient for someone with no prior context to understand how the factory works and how to operate it.

**Prototype:** Sufficiency for a newcomer is content quality.

### FRD-08#U6 · behaviour only · `docs-home`

> - The Reference catalogs — commands (skills), agents (party), decision rules, and standards — SHALL be **derived dynamically from the factory at build/read time** from the canonical source: the plugin skill and agent frontmatter (name + description) under `plugin/skills/` and `plugin/agents/`, `factory/decisions/registry.yaml`, and `factory/standards/`. They SHALL NOT be a hand-maintained copy, so that a **new, renamed or removed** skill, agent, rule or standard appears in the Reference **automatically** with no drift (DR-046).

**Prototype:** Derivation from the plugin files is a data rule; the Referencia card points to Configuración.

### FRD-08#U7 · partial · `docs-home`, `config-hub`

> - The Reference catalogs SHALL **reuse the Configuración (FRD-07) card components** — the same skill / agent / rule / standard card, grid and detail surfaces — rather than re-implementing them, so the two surfaces stay visually and behaviorally consistent.

**Prototype:** Reuse is by pointer: Referencia → Configuración (FRD-07 components); no catalog card is rendered inside Documentación.

### FRD-08#U8 · not drawn · `docs-home`

> - The **skill detail** SHALL present a **curated, plain-language explainer** (Spanish, "for-dummies") of what the skill does, when it is used and why it matters — from a hand-authored layer, NOT the raw English frontmatter description — falling back to the frontmatter description only when no explainer is authored.

**Prototype:** No per-skill curated explainer page: the "Workflows" pages explain two engines (pandacorp-build, pandacorp-backlog) and the generic concept; skill dialogs in Configuración show the English description.

### FRD-08#U9 · not drawn · `docs-home`

> - The skill detail SHALL render an **interactive, step-by-step flow graph**: ordered, **typed** steps (a normal step, a human-gate/decision, a safe point, an owner↔IA exchange, a repeating phase — each colour-coded by type), with parallel steps and the repeating loop made explicit, so a reader with no prior context can follow how the skill works.

**Prototype:** No interactive step-by-step flow graph per skill (the skill workflow diagram stays out of v2).

### FRD-08#U10 · not drawn · `docs-home`

> - WHERE a flow step invokes another skill or an agent, that node SHALL be **clickable cross-navigation**: clicking a skill node SHALL open that skill's own doc (with its own flow graph); clicking an agent node SHALL open that agent's card — so the Documentation is a **navigable graph**, not a set of flat pages.

**Prototype:** No clickable flow nodes.

### FRD-08#U11 · partial · `config-skill-dialog`

> - The full **`SKILL.md`** SHALL remain available rendered as **markdown** (a collapsible "ver el `SKILL.md` completo"), NOT a raw unformatted text dump.

**Prototype:** The full SKILL.md is available as markdown behind "Definición completa" in the Configuración dialog, not in Documentación.

### FRD-08#U12 · behaviour only · `docs-page`

> - The curated explainer + flow layer SHALL be **hand-authored** (`src/lib/manual/skill-flows.ts`) and SHALL reflect the **real** `plugin/skills/<slug>/SKILL.md` body + the factory decision rules (accuracy contract); when a skill's flow changes, its authored flow SHALL be updated in the same change (DR-046).

**Prototype:** Authoring layer (`skill-flows.ts`), no visual.

### FRD-08#U13 · behaviour only · `docs-page`

> - The hand-authored Tutorial / Guides / Concepts pages SHALL reflect the **current** factory workflow — the v2 build engine (the Build Plan, coarse work orders, repair-before-block, resumable runs) and the recent decision rules — NOT stale earlier content; a change to how the factory is operated SHALL update the affected page in the same change (DR-046; see the root `CLAUDE.md` "Decision log" section).

**Prototype:** Content currency of Tutorial/Guides/Concepts is the app's.

### FRD-08#U14 · partial · `docs-page-multi-runtime`

> - THE multi-runtime Concept SHALL present every non-Claude runtime (Codex, Cursor, OpenCode) as **read/review-only on project build state** (DR-120, frozen 2026-09-02): it may read the docs, work orders, `.pandacorp/status.yaml` and history and report to the owner, but SHALL NOT be shown as able to write build state, launch `implement` in any form, run hardening/release, drain the factory backlog, switch runtimes or invoke a launcher/supervisor/executor. Build (`/pandacorp:implement`) SHALL be presented as Claude Code only. It SHALL state that the former `attended_foreground` Codex profile (2026-07-15 to 2026-09-02) is **withdrawn**, that R10/R11 are **suspended, not failed**, and the reopen trigger ("Codex ships wake-capable local scheduling"); it SHALL NOT claim that file persistence or the legacy `running` + heartbeat projection permits live takeover.

**Prototype:** Concept "Operar desde cualquier agente" is a captured page, but its text follows DR-133 (2026-10-20: Codex and Claude Code have full read/write permission, "leer, editar y construir con las mismas reglas"), which supersedes the DR-120 read/review-only posture the AC requires.

### FRD-08#U15 · partial · `docs-page-multi-runtime`

> - THE multi-runtime Concept's "how to verify" steps SHALL NOT prescribe a Codex build (no attended single-FRD run, no duration budget): the Codex check is a cold read/review in Spanish that reports in chat and refuses `implement`, and the build check is `/pandacorp:implement` under Claude Code. The comparison and diagram surfaces (runtime comparison, two-doors diagram) SHALL label Codex as read/review-only and SHALL NOT promise build progress, notifications or telemetry for a Codex build.

**Prototype:** Same page and same DR-120 vs DR-133 divergence (the AC forbids prescribing a Codex build).

### FRD-08#U16 · partial · `docs-page-multi-runtime`

> - WHILE Codex enforcement is not installed and trusted in a real session, THE multi-runtime Concept SHALL NOT claim active enforcement there; it SHALL state that the read-only posture is an instruction (AGENTS.md) rather than configuration (`sandbox_mode` is still `workspace-write`) until BL-0030 lands.

**Prototype:** Same page; the enforcement caveat (AGENTS.md instruction, `sandbox_mode` still `workspace-write`, BL-0030) is in the app's page content, not a design concern.

### FRD-08#U17 · behaviour only · `docs-page`

> - WHERE a Concept/Guide page describes a project's documentation structure, it SHALL reflect the **feature-centric** layout (DR-049): the shared product layer (`docs/product/`), the per-feature module folders `docs/frds/frd-NN-<slug>/` (`frd.md` + on-demand `fdd.md`/`blueprint.md`/`mocks/`/`work-orders/`), the global `docs/{adr,analytics,reviews,decision-log.md}`, the stable-ID spine (`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN → WO-NN-MMM`) and the source-of-truth hierarchy `FRD > FDD > design-tokens > blueprint > work order` — NOT the old by-type layout (a flat `docs/frds/`, a global `docs/blueprint.md`, a global `docs/work-orders/`). The derived Reference picks up DR-049 and the rewritten `structure.md` standard automatically.

**Prototype:** Feature-centric structure content (pages "Estado y archivos", "El espinazo de documentos").

### FRD-08#U18 · behaviour only · `docs-page`

> - WHERE an authored page has a bespoke renderer (`src/app/manual/manualPages.tsx`), that renderer SHALL be the page's ONLY source of content (DR-115: one writer per fact); its `content/manual/<group>/<slug>.md` SHALL be an **index stub** (frontmatter `title`/`group`/`order` for the side menu + the H1 + a one-line summary + a pointer to the renderer) and SHALL NOT carry prose, headings, lists or tables, because the reader never renders it. A page with no bespoke renderer renders its `.md` body and that body SHALL be real prose. A test SHALL fail if a bespoke page's `.md` carries prose, or if a registered renderer has no `.md` (unreachable page).

**Prototype:** One-source-per-page rule for bespoke renderers: code structure.

### FRD-08#U19 · drawn · `docs-page-team`

> - The **"El equipo"** concept SHALL present one bio card (in the owner's language) for EVERY agent shipped in `plugin/agents/`, grouped by phase and drawn from ONE roster shared with the team diagram; the `drift-finder` card SHALL explain what it does (walks every FRD contract against already-verified code, outside the diff, proposing drift with a probe test) and WHEN it runs (only under `gateEvidence: 'digested'`, which is not the default, or when forced with `--drift-finder on`; it only proposes, the reviewer stays the judge). A test SHALL fail when an agent is added to `plugin/agents/` without a card.

**Prototype:** Concept "El equipo" is a captured page with the agent bio cards.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `docs-home` | `#documentacion` | (none) | full page | `FRD-08#U1` `FRD-08#U3` `FRD-08#U5` `FRD-08#U6` `FRD-08#U7` `FRD-08#U8` `FRD-08#U9` `FRD-08#U10` |
| `docs-search` | `#documentacion` | fill `#manual-search` = "worktree" | full page | — |
| `docs-page` | `#documentacion?page=el-pipeline` | (none) | full page | `FRD-08#U1` `FRD-08#U2` `FRD-08#U3` `FRD-08#U4` `FRD-08#U12` `FRD-08#U13` `FRD-08#U17` `FRD-08#U18` |
| `docs-page-index-open` | `#documentacion?page=el-pipeline` | click `[data-action="doc-index"]` | full page; widths 375/768 | `FRD-08#U2` |
| `docs-page-not-found` | `#documentacion?page=no-existe` | (none) | full page | — |
| `docs-page-tutorial` | `#documentacion?page=como-empezar` | (none) | full page | `FRD-08#U3` |
| `docs-page-guide` | `#documentacion?page=g-modo` | (none) | full page | `FRD-08#U3` |
| `docs-page-team` | `#documentacion?page=el-equipo` | (none) | full page | `FRD-08#U19` |
| `docs-page-multi-runtime` | `#documentacion?page=multi-runtime` | (none) | full page | `FRD-08#U14` `FRD-08#U15` `FRD-08#U16` |

States cited above that belong to another FRD folder (captured there, reused here): `config-hub`, `config-skill-dialog`.

**Not drawn (3)**: `FRD-08#U8`, `FRD-08#U9`, `FRD-08#U10`.

**Partially drawn (7)**: `FRD-08#U1`, `FRD-08#U3`, `FRD-08#U7`, `FRD-08#U11`, `FRD-08#U14`, `FRD-08#U15`, `FRD-08#U16`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `docs-page-tutorial`, `docs-page-guide`, `docs-page-team`, `docs-page-multi-runtime`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Páginas renderizadas por la app servida en local · 20 oct. 2026, 7:20 p. m.
- Documentación
- Guías
- El manual de la fábrica: empieza por el tutorial, sigue con las guías y profundiza en los conceptos.
- Índice del Manual
- Buscar en el Manual
- Buscar en el Manual…

### `docs-home`

- [p] El manual de la fábrica. Empieza por el tutorial, resuelve tareas con las guías y entiende el porqué con los conceptos.
- [@aria-label] Buscar en todo el Manual
- [@placeholder] Buscar en 38 páginas…
- [h2] Empieza aquí
- [p] Si es tu primera vez, el tutorial te lleva de cero a tu primer proyecto en 2 pasos.
- [small] Tu primera misión En unos minutos vas a llevar una idea de cero hasta ver a tu party de agentes construyénd…
- [p] Después, entiende lo esencial
- [h2] Guías para el día a día
- [span] 11 guías
- [a] Ver todas
- [span] Explorar por tipo
- [span] Aprender haciendo, de principio a fin.
- [span] 2 páginas (×4 of the same pattern)
- [span] Recetas para una tarea concreta.
- [span] Cómo funciona la fábrica y por qué.
- [span] Qué pasa por dentro de cada skill.
- [span] Comandos, agentes, reglas y estándares.
- [span] En Configuración

### `docs-search`

- [h2] Resultados 7

### `docs-page`

- [@aria-label] Modos de construcción de implement

### `docs-page-index-open`

- [@aria-label] Tabla desplazable

### `docs-page-not-found`

- [strong] Esta página no existe
- [span] El Manual no tiene una página «no-existe».
- [a] Ir al inicio del Manual

### `docs-page-tutorial`

- [@aria-label] Ruta
- [@aria-label] Paso 2 de 2 del tutorial
- [@aria-label] Paso 1 (×5 of the same pattern)

### `docs-page-guide`

- [@aria-label] Ruta

### `docs-page-team`

- [@aria-label] Ruta
- [@aria-label] Avatar de agente researcher
- [@aria-label] Avatar de agente product-manager
- [@aria-label] Avatar de agente designer
- [@aria-label] Avatar de agente copywriter
- [@aria-label] Avatar de agente architect
- [@aria-label] Avatar de agente devops
- [@aria-label] Avatar de agente implementer
- [@aria-label] Avatar de agente backend-dev
- [@aria-label] Avatar de agente frontend-dev
- [@aria-label] Avatar de agente test-writer
- [@aria-label] Avatar de agente analytics
- [@aria-label] Avatar de agente reviewer
- [@aria-label] Ícono de drift-finder
- [@aria-label] Avatar de agente security-auditor
- [@aria-label] Ícono de librarian
- [@aria-label] Ícono de mech

### `docs-page-multi-runtime`

- [@aria-label] Paso 1 (×3 of the same pattern)

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Empezar aquí" | "Empieza aquí" (docs-home h2).
- "Guías" bucket | "Guías" (card) and "Guías para el día a día" (h2).
- Surface name "Documentación" | "Manual" in the mini nav label and in search/index labels (see U1).
- "ver el `SKILL.md` completo" | "Definición completa" (config dialogs).
- Not-found page | "Esta página no existe" / "El Manual no tiene una página «no-existe»." / "Ir al inicio del Manual" (docs-page-not-found).
- Search placeholder "Buscar en 38 páginas…" (home) and "Buscar en el Manual…" (reader index).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Per-skill explainer and flow graph (U8-U10) are FRD wants; the skill workflow diagram is out of v2 by owner decision, so these three ACs need removal or an owner exception at M1.
- Four-bucket Diátaxis taxonomy vs the prototype's Tutorial / Guías / Conceptos / Workflows + Referencia pointer.
- The Manual pages are captured from the app and keep a different phase vocabulary and colour code (Descubierta/Documentada; Diseño violet, Arquitectura green, Construcción pink) with 10-11 px inline labels raised to 12 px; unifying it is an app content change (proposal "Finding about the current app").
- FRD-08 U14-U16 describe the DR-120 posture (non-Claude runtimes read/review-only); DR-133 (owner decision 2026-10-20, in the project AGENTS.md) supersedes it and the captured Concept page already follows DR-133. The FRD needs the amendment (S2.2), not the prototype.
- The captured guide "Elegir modo de construcción" still says "Lo cambias por proyecto en Portfolio → Party" (a removed tab) and mentions waves of 2/4/8 work orders: app content, to be refreshed in the real Manual.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 12: the Manual index sits on the RIGHT of the reader (a second left column would read as a second app sidebar); the reader shows typed documents with tinted markdown.
- Iteration 14: the captured pages' inline accent stripes (bar before each title, left-ruled notes) are hidden per the no-stripe rule.
- Iteration 22: Documentación home routes in (Empieza aquí, Guías para el día a día, Explorar por tipo, Referencia → Configuración, one search across 38 pages with snippets); reader with breadcrumbs, "Paso X de Y" with progress bar on tutorial pages, previous/next within the group. Rejected after red team: a left-hand page index, a second "On this page" rail, drawers instead of modals.
- Iteration 23: the two route-in cards share one height (545 px at 1440) and the left one adds "Después, entiende lo esencial".
- 2026-10-21 language: page bodies stay as the app renders them (Spanish content already); the "Manual" label should follow the contract name at M1.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
