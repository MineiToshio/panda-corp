---
type: prd
status: ACTIVE
---
# PRD — Pandacorp (the factory dashboard)

## Vision
A single screen to operate the Pandacorp factory **as if it were an RPG**: see the state of all ideas and projects, read their documentation, know which command to run, and follow the "party" of agents building live — all wrapped in a layer of honest gamification that makes the real work fun.

## Feature landscape
Living index of the FRDs (feature-centric docs, DR-049). Each FRD is a self-contained module under `docs/frds/frd-NN-<slug>/`. Add a row when a new FRD is created. The **v2 (Órbita)** column shows each FRD's status in the v2 milestone (see [Version 2 — Órbita](#version-2--órbita-redesign)); the other columns describe the FRD as built in v1.

| ID | Feature | What it does | v2 (Órbita) |
|---|---|---|---|
| [FRD-01](../frds/frd-01-data-reading/frd.md) | Data reading layer | Reads the factory's and each project's state from disk, read-only, never calling Claude. | Unchanged (no UI). |
| [FRD-02](../frds/frd-02-ideas-board/frd.md) | Ideas board | The ideas kanban; derives each card's column and handles the only bounded writes (discard / restore `status`, and the visual `favorite` flag). | **Changed** (+8 ACs, REQ-02-016). Out of v2 items: see non-goals. |
| [FRD-03](../frds/frd-03-portfolio/frd.md) | Portfolio and project navigation | Lists created projects with their state and links into each project's workspace. | **Changed** (rail replaced by an overview of all projects; +3 ACs, REQ-03-008). Out of v2 items. |
| [FRD-04](../frds/frd-04-project-workspace/frd.md) | Project workspace | Nine-tab per-project workspace with complete shared Spec and Architecture surfaces, logical data-model viewer, docs, commands and the build-mode selector. | **Changed** (eight tabs; +8 ACs, REQ-04-014; carries the `readDecisions` fix). Out of v2 items. |
| [FRD-05](../frds/frd-05-work-orders/frd.md) | Work orders (live view) | Read-only kanban of a project's work orders, grouped by FRD, with the full document. | **Changed** (moves inside Observabilidad; +4 ACs, REQ-05-008). |
| [FRD-06](../frds/frd-06-party/frd.md) | Party (live RPG map) | The live RPG map of the agents building a concrete project. | **Changed** (no Party tab; becomes La Fragua at the head of the Resumen; +8 ACs, REQ-06-020). Out of v2 items. |
| [FRD-07](../frds/frd-07-configuration/frd.md) | Configuration | Factory/agent configuration surface, including agent levels. | **Changed** (+5 ACs, REQ-07-013). Out of v2 items. |
| [FRD-08](../frds/frd-08-documentation/frd.md) | Documentation | The navigable factory Manual ("Códice del gremio"), Reference derived from the factory. | **Changed** (surface named «Documentación»; +3 ACs, REQ-08-020). Out of v2 items. |
| [FRD-09](../frds/frd-09-gamification/frd.md) | Gamification (RPG theme) | The honest gamification layer: XP, guild level, the RPG vocabulary. | **Changed** (+2 ACs, AC-09-008.1/.2). Out of v2 items. |
| [FRD-10](../frds/frd-10-achievements-hall/frd.md) | Achievements Hall | The hall of achievements and growing stats. | **Changed** (+5 ACs, REQ-10-028). Out of v2 items. |
| [FRD-11](../frds/frd-11-build-modes/frd.md) | Per-project build modes | Per-project build mode selection that defines the team composition. | **Changed** (four-card picker; +3 ACs, REQ-11-005). |
| [FRD-12](../frds/frd-12-observability-dataviz/frd.md) | Observability and data visualization | KPIs, data freshness, RPG↔timeline toggle and the work-order DAG. | **Changed** (timeline removed; dependency map follows the prototype; +4 ACs, REQ-12-006). Out of v2 items. |
| [FRD-13](../frds/frd-13-visual-system-accessibility/frd.md) | Visual system and accessibility | OKLCH tokens, rationed accent, restrained motion, accessibility rigor. | **Changed** (tokens re-frozen from Órbita; +4 ACs, REQ-13-010). |
| [FRD-14](../frds/frd-14-snapshot-and-feedback/frd.md) | Probable snapshot and feedback channels | The "last probable point / building now" panel and decision/bug chips per project. | **Changed** (snapshot panel drawn in the Resumen; rail chips out of v2). |
| [FRD-15](../frds/frd-15-plugin-out-of-sync-warning/frd.md) | Plugin out-of-sync warning | Warns when the installed plugin has drifted from the repo. | **Changed** (+1 AC: sidebar pill). |
| [FRD-16](../frds/frd-16-orphan-project-detection/frd.md) | ~~Orphan project detection~~ — **REMOVED** | **Removed 2026-06-22** (owner: not wanted). The detection scan, `/api/orphans` route and dashboard banner were deleted; use `/pandacorp:adopt` / `/pandacorp:sync-portfolio` on demand instead. See [decision-log](../decision-log.md). | Removed (unchanged). |
| [FRD-17](../frds/frd-17-proposals-inbox/frd.md) | Proposals inbox | The self-learning gate + self-suggestion stream (promotions, bottlenecks, nudges). | **Changed** (ordered to-do model; +4 ACs, REQ-17-011). Out of v2 items. |
| [FRD-18](../frds/frd-18-dashboard/frd.md) | Dashboard ("Inicio") | The landing command center: since-last-visit digest, human-gate queue, factory pulse. | **Changed** (two-column layout; +4 ACs, REQ-18-022). The digest and other items are out of v2. |
| [FRD-19](../frds/frd-19-app-shell/frd.md) | Global app shell | The persistent top-navigation shell: brand + guild identity + the six top-level destinations, active-aware and responsive. | **Changed** (sidebar with seven destinations replaces the top navigation; +5 ACs, REQ-19-005 incl. the theme button). |
| [FRD-20](../frds/frd-20-overlay-freshness/frd.md) | Overlay freshness | Tells the owner when a project's Pandacorp overlay is behind the factory's, and what to run. | **Changed** (+1 AC; the quiet "up to date" badge is out of v2). |
| [FRD-21](../frds/frd-21-pending-merge/frd.md) | Pending merges | Surfaces unmerged branches and leftover worktrees across repositories, read-only (DR-096). | **Changed** ("Árboles de trabajo" card on Inicio + the global sidebar pill; +3 ACs REQ-21-007, REQ-21-008). Project-Resumen block out of v2. |
| [FRD-22](../frds/frd-22-factory-backlog/frd.md) | Factory backlog | The factory's `BL-*` work queue as the Backlog tab of Propuestas, read-only. | **Changed** (+4 ACs, REQ-22-010; read-error state). Out of v2 items. |
| [FRD-23](../frds/frd-23-materialized-stats-read-model/frd.md) | Materialized stats read-model | The Informe reads a materialized `.pandacorp/stats.json` (honest cache + freshness seal) instead of deriving git on every render, falling back to live git when the snapshot is missing/stale/corrupt. | Unchanged (no UI). |
| [FRD-24](../frds/frd-24-decision-id-emitter/frd.md) | Shared decision-id emitter | Extracts the `decisions.md` id-derivation into a pure function + CLI so the factory's `/pandacorp:decide` skill can invoke the same rule instead of re-deriving it in prose; golden vectors prove both paths agree. | Unchanged (no UI); its golden vectors must keep passing. |
| [FRD-25](../frds/frd-25-persistent-navigation/frd.md) | Persistent navigation URLs | Stable resource/tab/detail URLs across all views, legacy links and history/refresh restoration. | Unchanged (no UI); not amended by the freeze, see open decision 1. |
| [FRD-26](../frds/frd-26-services-accounts/frd.md) | Services and accounts | Read-only directory of the external services and accounts each project uses, per project and factory-wide. | **Changed** (+1 AC; the global directory becomes the third Portafolio view; read-error state). |

## Problem
Operating the factory from the terminal alone is dry: there is no view of the overall state, you have to open files by hand, it's not obvious which skill is next, and nothing sustains the motivation of the solo operator day to day.

## User
The owner (sole operator, Spanish-speaking). Weak at UX → the tool must **guide and delight**, not just show data. **The entire UI is in Spanish** — copy, labels and `aria-label`s; the underlying code and identifiers are English.

## Value hypothesis
A read-only view that shows state + documentation + the next command, wrapped in an **honest** RPG layer (XP, levels and achievements that reflect real work), reduces friction and makes operating the factory daily pleasant — **without burning the subscription** (it never calls Claude) and **without falling into toxic gamification**.

## Principles and constraints
- **Read-only**: it never calls Claude or executes anything. The only writes are a small, bounded, human-triggered set on one idea card's frontmatter: discard / restore its `status` ([FRD-02](../frds/frd-02-ideas-board/frd.md), ADR-0002) and toggle the visual `favorite` flag ([FRD-02](../frds/frd-02-ideas-board/frd.md) REQ-02-012, ADR-0003).
- **Reads files**: idea base and portfolio in the factory; documentation and state of each project in its folder.
- **Local**: listens on `127.0.0.1`. No auth, no deploy.
- **Honest gamification**: it represents real work (XP for results, not for volume or for opening the app). No leaderboards, lives/death, daily streaks or false urgency (see [FRD-09](../frds/frd-09-gamification/frd.md)).

## What we want to achieve (product goals)
0. Land on a **command center** (the Dashboard / "Inicio") that answers, at a glance, *what needs me now, what changed while I was away, and what's the next command* ([FRD-18](../frds/frd-18-dashboard/frd.md)).
1. See the state of the whole factory at a glance (ideas, projects, agents).
2. Read any document without opening files by hand.
3. Always know the next command, and be able to choose the **build mode** per project.
4. Follow the agents building live, in a fun way (RPG-style **Party**).
5. Feel progress: **achievements**, **stats** that grow, **guild level** and **agent levels**.
6. Let another person understand the whole system (internal documentation).
8. Return to the same project, tab and meaningful detail after refresh or a copied URL, with addresses stable across renames.
7. Understand a project's complete architecture and logical model from either the board or portfolio, including attributes, keys and explicit relationship cardinalities.

## Scope v1
The **Dashboard / "Inicio"** as the landing command center ([FRD-18](../frds/frd-18-dashboard/frd.md): the *since-last-visit* digest, the *Tu turno* human-gate queue, the *Pulso* funnel with the one metric that matters, the enriched *Construcción y cartera*, and the honest progress strip) + five tabs — **Board, Portfolio, Achievements, Configuration, Documentation** — + the **per-project workspace** + **Party RPG** + **gamification** (achievements/stats/XP/levels) + **build modes** + **probable snapshot and feedback channels** ([FRD-14](../frds/frd-14-snapshot-and-feedback/frd.md): a "last probable point / building now" panel with a worktree command, decision/bug chips per project), per the FRDs (`docs/frds/`, FRD-01 through FRD-18). The navigable prototype (`mission-control/prototype/index.html`) is the approved design. Cross-cutting across all tabs: **observability and data-viz** ([FRD-12](../frds/frd-12-observability-dataviz/frd.md): KPIs, data freshness, RPG↔timeline toggle, DAG) and the **visual and accessibility system** ([FRD-13](../frds/frd-13-visual-system-accessibility/frd.md): OKLCH tokens, rationed accent, `tabular-nums`, restrained motion, `prefers-reduced-motion`, state by icon+color).

### Shared architecture and logical model (FRD-02 / FRD-04)
The board detail and both embedded and direct project workspaces reuse the complete `ArchitectureDigest`. The workspace order is **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos**. Inside **Modelo de datos**, a compact, read-only ER diagram is the default at every viewport width; the **Esquema** alternative is a compact Prisma-like textual representation of the same logical artifact, not executable Prisma. Full-text table widths and readable initial centering make fields usable. Expansion uses native browser fullscreen with the same top-right icon controls as the dependency map, with a full-window fallback, precise frame-batched zoom/pan and actual opener-focus restoration; no lower relationship inspector/list is shown. Pan, zoom, fit, expansion, search and selection never edit the project. Missing, invalid and explicitly no-persistence sources remain distinguishable. The designed model is never presented as a verified operational database.

The scoped visual reference is [the data-model viewer prototype, round 2](../design/prototype/data-model-viewer/index.html), layered onto the existing whole-app design. The project-owned contract is `docs/product/data-model.json` (`schemaVersion: 1`); its producer in the factory architecture tooling is a separate dependency. MC itself declares `persistence: none`; illustrative models stay in fixtures/previews.

## Non-goals (v1)
- It does not execute commands or agents (the owner pastes them into Claude Code).
- It is not multi-user nor deployed to the internet. No leaderboards.
- It does not edit the projects' documentation or database schemas, execute schema code, inspect a live database, or infer relationships from field names.

## Success metrics
- See the state of each idea/project and get the next-step command, without opening files.
- Read a project's entities, attributes, keys and both relationship endpoints from either Architecture entry point without opening source files.
- Zero calls to Claude from Pandacorp.
- The operator comes back daily: the gamification sustains the habit without fatigue.

## Backlog (future)
- Real computation of stats/achievements by reading the factory and the projects (today example data in the prototype).
- Dynamic Party per mode (more/fewer agents, several of the same role).
- Full-screen moment on level-up; phase transitions as a "cutscene"; weekly streak; meta-achievements (titled Seals); per-agent activity chart.
- Robust auto-refresh (file-watching) + real event streaming.

### Specification continuity during implementation

The selected project in Portfolio and direct project workspace exposes **Spec** between Resumen and Work orders. It reuses the board's complete PRD/research/FRD digest and real document count, with an honest pending state when unavailable. The owner can inspect product intent and architecture without returning to the board. See FRD-04 REQ-04-013 and FRD-02 REQ-02-011.

### Architecture and responsive usability amendment — 2026-10-17

The shared architecture reads Stack → Integraciones y operación → Modelo de datos → environment/decisions/plan. Stack explains chosen technologies and providers; integrations explain flows, responsibilities and operational tasks. Preserve authored facts. Model selection can be cleared by clicking the same relation; diagram table text is nonselectable, while schema code remains copyable. Esquema is a single-column, initially collapsed entity accordion with one expanded entity at a time. Shared Propuesta/Spec/Architecture panels use available width, retaining only readable introductory prose limits. The original centered 1240px maximum application frame is retained; tab panels fill that host without the narrower 920px inner cap. One integrated phone/tablet header replaces the split-looking hamburger menu. This is scoped responsive shell/model coverage, not a new app-wide platform certification. See ADR-0009 and FRD-19 REQ-19-003.

## Version 2 — Órbita (redesign)

Added 2026-10-22. v1 above is kept as the historical record; where v2 changes a v1 statement (for example the nine-tab workspace, the top navigation, the Party tab), the amended FRD and this section govern. Sources: the owner decisions of 2026-10-21/22 in [decision-log](../decision-log.md), `docs/design/freeze/{m1-decisions,reconciliation,audit}.md`, the [Órbita proposal](../design/explorations/visual-refresh-2026/proposal.md) and the amended FRDs.

- **Return type:** personal (internal tool). No market sizing, monetization, pricing or GTM.
- **Payments in v2 (DR-035): no.** Local on `127.0.0.1`, no deploy, so no hosting plan applies.
- **Launch market and language:** not applicable (single owner). The interface is Spanish (see constraints).
- **Platforms (owner, 2026-10-21):** desktop, tablet and phone. The small-screen gates apply from the v2 build.

### Goal
Implement the owner-approved and frozen **Órbita** redesign so Mission Control reads as **one coherent application** on desktop, tablet and phone: a persistent sidebar with the projects one click away, neutral chrome where hue only carries meaning, and one set of component rules (iteration 28) instead of three visual dialects. The functions the prototype draws stay; the redesign is not a vehicle for new features.

### Value hypothesis (v2)
Recomposing the same read-only information into one measured design lets the owner (a) reach any project's state and next command from any screen without hunting, and (b) use Mission Control on a tablet or phone without anything breaking, **without losing any function that the approved prototype draws**. The app stays read-only and still never calls Claude.

How it is measured (all machine-checkable except the last):
- **Fidelity:** the fidelity gate (`docs/design/fidelity-checklist.md`, blocking mode) passes on the 159 oracle states at the target levels below.
- **Reach:** any project's Resumen is reachable from any screen through the sidebar Proyectos group or the «Cambiar proyecto» picker (AC-19-005.1, AC-03-008.3).
- **Responsive:** zero horizontal overflow at 320, 375, 768 and 1280 px and axe 0 serious/critical on every oracle state (L4).
- **Owner acceptance** on desktop, tablet and phone.

**Activation milestone:** the owner opens the v2 build on each of the three form factors and walks Inicio → a project's Resumen → Observabilidad → Documentos without a broken layout. **Review signal** (personal tool, so a review rather than a revenue kill-signal; thresholds are assumptions, see A-5): v2 does not ship while any of the 159 states is RED after the 3-repair-attempt budget, or while the retained v1 suite has a regression.

### Scope (in v2), by FRD
The 21 UI FRDs amended by the design freeze (the 79 prototype-drawn ACs are numbered per FRD; ids in parentheses). Non-UI FRDs (01, 23, 24, 25) are unchanged and FRD-16 stays removed.

- **FRD-02 · Tablero and idea page** — board search, phase chips with counts and jump, «Ocultar columnas vacías» (remembered), live «N ideas coinciden», idea header (stage line, «Volver al tablero», favorite / open project / discard on one row), Campaña strip «N/6 entregadas» with prev/next arrows, fully clickable FRD cards with a kind tag, environment variables grouped by `.env.example` section (AC-02-016.1 to .8). Discard goes through a confirm dialog with an optional reason; restore takes no reason.
- **FRD-03 · Portafolio** — the rail is replaced by an overview of all projects: cards and Lista (`view=lista`), plus the «Cambiar proyecto» searchable picker (AC-03-008.1 to .3, REQ-03-009).
- **FRD-04 · Project workspace** — eight tabs (Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos); full hero on Resumen only and a one-line header elsewhere; tab count badges; Resumen tiles, «Avance por FRD», Decisiones list and dialog, compact Tu turno, «Últimos avances» from structured sources only; Documentos with the index on the right (AC-04-014.1 to .8). Changes collapse into one «Historial».
- **FRD-05 · Work orders** — live inside Observabilidad as Por FRD (default) · Tablero · Dependencias, kept in the URL; capped board columns with «Mostrar más»; the work-order reading summary and fact sheet; a «Bloqueado» column after Verificado (AC-05-008.1 to .4).
- **FRD-06 · La Fragua** — no Party tab: the four-station La Fragua (Cola · Taller · Revisión · Bóveda) heads the Resumen, always dark, with verdict, health chip, forging bar, tokens with hover card and live crews only while `running` (AC-06-020.1 to .8). The sprite-per-work-order criteria are retired with their ids kept.
- **FRD-07 · Configuración** — Resumen hub with one search across the four catalogs, search in every tab, skills filter chips, agents grouped by model tier, rules filtered by Auto / Tu OK, standards MUST-first (AC-07-013.1 to .5); a third skill group «Otras» for skills with an undeclared scope.
- **FRD-08 · Documentación** — surface named «Documentación» (short rail label «Docs»): routing home, full-text search with snippets, reader with breadcrumbs, tutorial progress and a right-hand index (AC-08-020.1 to .3). Multi-runtime wording follows DR-133. The Manual page content is refreshed (stale «Portfolio → Party» and wave sizes).
- **FRD-09 · Gamification** — guild card in the sidebar (crest only on the rails) and the gold achievement notice, once per browser (AC-09-008.1/.2).
- **FRD-10 · Logros** — five tabs; Resumen with next rank, radar and last trophies; missions by closeness; trophies with «Los más alcanzables»; collapsed far eras; «sin datos aún» distinct from «no cableado» (AC-10-028.1 to .5).
- **FRD-11 · Build modes** — four mode cards with power meter (Equilibrado preselected), the scoped build target writing `/pandacorp:implement <frd>` or `change:<id>`, and the picker behind «Elegir modo de construcción» in Campaña (AC-11-005.1 to .3).
- **FRD-12 · Observabilidad** — no timeline; the dependency map at two levels (Por FRD, Por work order) following the prototype's layout, focus card, ordered list below 900 px, legacy `tab=Work orders` links land here (AC-12-006.1 to .4).
- **FRD-13 · Visual system** — tokens re-frozen from Órbita (Space Grotesk, Inter, JetBrains Mono self-hosted; nothing below 12 px; hover only on hover-capable pointers; scene surfaces always dark) (AC-13-010.1 to .4). Motion stays transform/opacity only (the FRD wins over the prototype).
- **FRD-14 · Snapshot** — see the owner-decided additions.
- **FRD-15 · Plugin warning** — coral sidebar pill «Plugin desactualizado» linking to Inicio (AC-15-006.1). The dirty-plugin banner variant is removed from the prototype (owner decision of 2026-06-22 wins).
- **FRD-17 · Propuestas** — ordered to-do «Qué te toca, en orden», navigation badge counting actions, signals grouped by kind with an unreliable flag, Memoria four-step flow (AC-17-011.1 to .4). The «Aplicada en» row stays in the lesson detail.
- **FRD-18 · Inicio** — two-column layout (plugin warning first; Tu turno → Tu cartera → En marcha; Pulso → Gremio → Embudo → Árboles de trabajo), one line per Tu turno item with a «Detalles» dialog, collapsible En marcha groups (AC-18-022.1 to .4). H1 and nav label are both «Inicio».
- **FRD-19 · App shell** — sidebar with seven destinations (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración) replacing the top navigation; Proyectos group (up to 5), counts, 64 px collapsible rail, tablet rail, phone top bar + bottom navigation + drawer; no exempt route (AC-19-005.1 to .5).
- **FRD-20 · Overlay freshness** — the upgrade notice names the project folder where the command runs (AC-20-004.1).
- **FRD-21 · Pending merges** — Inicio card «Árboles de trabajo» with the stated state rule and a per-repository branch dialog; `/pandacorp:worktrees` as the cleanup command (AC-21-007.1 to .3); the global pill (REQ-21-008).
- **FRD-22 · Backlog** — priority tiles and topic bars that filter, «Cómo avanzar» card, open items grouped by priority and paged (AC-22-010.1 to .4); items without priority are listed, not dropped.
- **FRD-26 · Cuentas** — the Cuentas table ordering, copyable login and one card per row below 1024 px (AC-26-011.1); the global directory (see additions).

### Owner-decided in-scope additions (M1 / M2, 2026-10-22)
These existing features were not in the first prototype; the owner took every recommendation to **draw them** and keep them in v2 (items 1 to 4 at M1, item 5 at M2):
1. **Pending-merges pill** — «⎇ N pendientes» in the sidebar (alert variant «· depurar ya» / «· sin leer»; hidden at zero), linking to Inicio's «Árboles de trabajo» (FRD-21, DR-096).
2. **Last-green-commit panel** — «último commit en verde · seguro para probar» with its copyable `git worktree add` command, in the project Resumen below La Fragua, shown only while a build runs and a `last_green_sha` exists (FRD-14, REQ-04-005).
3. **Global accounts view** — «Cuentas» as the third Portafolio view beside Tarjetas / Lista, reusing the Cuentas table plus search, state filter and row dialog (FRD-26, `portfolioView=accounts`).
4. **Twelve safety states** — honesty and fail-loud states the app already implements (DR-078, DR-066) that the fixture never triggered: a failing work order; build «sin señal»; six read errors (backlog files, data-model artifact, worktrees, usage stream, accounts source, missing project path); the calm Inicio («Nada espera tu acción ahora mismo.»); the empty factory; the «Verificado · N derivas» badge; and the warning that a change rebuilds verified work, plus the discard reason on a discarded idea.
5. **Theme button** (M2) — a sun/moon button in the sidebar footer next to «Colapsar» and inside the phone drawer; it starts from the system preference and remembers the choice (FRD-19 AC-19-005.5). This supersedes the audit's earlier proposal to drop the control.

### Bundled fixes
1. **e2e workspace-tab specs** — the specs that still expect the nine-tab workspace fail (4 failing at the overlay upgrade of 2026-10-22); they are rewritten for the eight-tab workspace.
2. **`readDecisions` counting a RESOLVED decision as pending** — seen in PersonalPage v2 `2026-07-01-1`, which `decisions.md` still lists under pending while the entry records its resolution. A decision already resolved in its file shows as «Resuelta» («ya resuelta en el archivo») in the project's decisions list and is **not** counted in Tu turno, Inicio or the sidebar badge (FRD-04 AC-04-014.5 and its worked example; FRD-18 follows).

### Non-goals (v2)
Rule (owner, 2026-10-21): an app feature the prototype does not draw stays out of v2. Out items keep their ids in the FRDs, prefixed **Out of v2**, so traceability survives. The factory's artifact content shown in the app is not translated or edited.
- **Global:** the Inicio digest «Desde tu última visita» with mark-seen; the board's «recommended» badge; Campaña's per-phase checklists; the deploy target and objectives in the Resumen; the skill workflow diagram (mini-flow, FlowGraph); the creation affordances («New standard / decision rule» via `/pandacorp:learn`); a timeline view; any new feature.
- **FRD-02:** discard quick-tags and the in-flight «Descartando…» state; gold card background for favourites (the star marks it); scoped dependency graph in the FRD dialog; visual distinction of composite keys, isolated entities and self-relations; attribute mappings and per-connector selection on model links; the viewport-filling fullscreen fallback.
- **FRD-03:** «stopped» indicator on rows; decision and bug count badges on rows (decisions become a Lista column); invalid-date chip.
- **FRD-04:** the «Obsoleta» tag (an obsolete decision is still never counted as pending); `implemented_sha` / `closing_at` evidence in the change dialog.
- **FRD-06:** effort level shown as read-only data.
- **FRD-07:** skill mini-flow and workflow explainer; «New decision rule» / «New standard» buttons and the rule explainer; agent level, title, XP bar, pixel art for every agent and per-agent model explanation (the tier is explained once per group).
- **FRD-08:** curated skill explainers, the interactive flow graph, flow cross-navigation and their hand-authored layer (REQ-08-008 to -010, -012).
- **FRD-09:** phase animation, automatic release celebration and level-up moment (the gold notice is the only celebration).
- **FRD-10:** estimated-rarity blurb; per-trophy «NUEVO» badge; «LA CIMA» summit treatment; TU PARTY roster and record badges; chain-complete crown and per-tier date/project; distinct revealed-secret treatment; populated top-N usage and effort lists (the honest empty band stays).
- **FRD-12:** «saltar al primer error» and «seguir al paso activo»; zoom/pan/fit/fullscreen toolbar on the dependency map (a bounded scroll region replaces it; the data-model viewer keeps its toolbar).
- **FRD-14:** pending-decision and bug chips and the `rethink_pending` indicator on the (removed) rail.
- **FRD-17:** per-card dismiss and remembered dismissal; prune explainers, stale-memory nudge and harvest-orphan banner; reject promotion; the «Úsala cuando» row; the «Crónica del gremio» alias.
- **FRD-18:** the digest; version and age-in-stage on cards; «estancado»; «N bugs» chip; inline blocker reason; «estable · en operación» label.
- **FRD-20:** the quiet «Última versión de Pandacorp» badge (an up-to-date project shows nothing).
- **FRD-21:** the «Pendientes de merge» block in the project Resumen.
- **FRD-22:** the evidence line on backlog rows; source, links and dates in the item dialog.
- **Not shipped from the prototype:** its demo-only controls, the capture stamp and the «propuesta de diseño» footer.

### Success metrics (v2)
- **Fidelity gate passes on all 159 oracle states** at the target levels, in light and dark, at 375 / 768 / 1280 px: L1 typography and colour 100% exact; L2 sizes exact and spacing, radius and anchor offsets within ±1 px; L3 at most 0.5% of pixels differing per slice (YIQ 0.1); L4 coverage 100% of states × widths × themes with axe 0 serious/critical.
- **No regression in the v1 test suite** (vitest, 8062/8062 at 2026-10-22, plus e2e), counting only tests of behaviour that v2 keeps. Tests of behaviour v2 replaces (top navigation, Party tab, portfolio rail, nine-tab list) are retired together with their ACs.
- **Owner acceptance** on desktop, tablet and phone.
- Unchanged v1 invariants: zero calls to Claude; no writes beyond the bounded set.

### Constraints
- **Language:** the interface is Spanish. Content Mission Control only shows keeps its language (project documents, AI-generated files of projects and factory: skill and agent descriptions, rules, lessons, backlog items). Artifact names stay English (FRD, PRD, ADR, work order, spec, backlog) with Spanish agreement («work orders verificadas»). The surface is «Documentación»; the short rail label is «Docs». Code, committed docs and identifiers are English.
- **Read-only over the factory:** the only writes remain discard/restore and `favorite` on one idea card. Browser-local preferences (collapsed sidebar, projects group fold, hide-empty columns, theme, shown-once notice) are not factory writes.
- **Frozen design contract:** `DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`, `docs/design/fidelity-checklist.md`, the prototype at `docs/design/prototype/` and its measured `reference/`. Where the drawn prototype and the stray CSS disagree, the drawn prototype binds, except where an FRD wins (motion, the dirty-plugin banner). The implementer may not edit the oracle or blessed baselines (DR-080).
- **Data-model canvas:** keeps the app's current layout engine (owner-approved 2026-10-16) and is compared by computed styles (L1/L2), not by pixels (L3); entity positions are not compared. The dependency map, by contrast, follows the prototype's layouts and is pixel-compared.
- **Brand mark:** the raster emblem `docs/design/prototype/assets/pandacorp.png` stays as a recorded exception to the vector-logo rule (internal tool, the guild crest); the build serves the original bytes.
- **Motion:** only `transform` and `opacity`, under 300 ms, honoring `prefers-reduced-motion`.
- **Local and responsive:** `127.0.0.1`; desktop, tablet and phone with the 44 px design target (24 px gated floor).

### Assumptions & open decisions (DR-095)
The clarification gate ran in `infer` mode: the scope was fixed by the owner decisions above, so no new question was needed.

Assumptions:
- **A-1** `[ASSUMPTION: the 79 Group A ACs are the complete prototype-drawn behaviour, plus the M1 additions — source: reconciliation.md and the amended FRDs]`.
- **A-2** `[ASSUMPTION: "Out of v2" items are removed from the build, not hidden behind a flag — source: owner rule 2026-10-21]`.
- **A-3** `[ASSUMPTION: FRD-24's id derivation is unaffected by the resolved-decision fix, which changes status counting only — source: FRD-24 and FRD-04 AC-04-014.5]`.
- **A-4** `[ASSUMPTION: retired v1 tests do not count as regressions — source: PRD success metrics wording above]`.
- **A-5** `[ASSUMPTION: the review signal has no revenue or usage threshold because the product is personal (DR-042/DR-043) — source: return_type personal]`.
- **A-6** The 24 non-blocking audit findings go to `.pandacorp/comms/visual-punch-list.md` for the end-of-build Visual QA, not into v2 FRDs.

Open decisions to settle in the planning step (`/pandacorp:change`):
1. **FRD-25 not amended.** AC-25-009 and AC-25-010 still mention the Party tab and the shell exemption, both gone in v2. Align the URL catalog with the eight tabs, the Observabilidad views, the Portafolio views and the no-exemption shell.
2. **Stale frontmatter.** FRD-22 says `implementation_status: PLANNED` although the backlog panel exists in `src/`, and FRD-02 says `IN_REVIEW`. Reconcile before work orders are cut.
3. **Short-label copy.** The M1 copy fix says «Documentación» for the surface and FRD-08 REQ-08-001 sets «Docs» for the rail; confirm `components.md` and the Shell-Presence contract (`e2e/shell.ts`) use «Docs».
