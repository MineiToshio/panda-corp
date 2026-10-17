---
type: prd
status: ACTIVE
---
# PRD — Pandacorp (the factory dashboard)

## Vision
A single screen to operate the Pandacorp factory **as if it were an RPG**: see the state of all ideas and projects, read their documentation, know which command to run, and follow the "party" of agents building live — all wrapped in a layer of honest gamification that makes the real work fun.

## Feature landscape
Living index of the FRDs (feature-centric docs, DR-049). Each FRD is a self-contained module under `docs/frds/frd-NN-<slug>/`. Add a row when a new FRD is created.

| ID | Feature | What it does |
|---|---|---|
| [FRD-01](../frds/frd-01-data-reading/frd.md) | Data reading layer | Reads the factory's and each project's state from disk, read-only, never calling Claude. |
| [FRD-02](../frds/frd-02-ideas-board/frd.md) | Ideas board | The ideas kanban; derives each card's column and handles the only bounded writes (discard / restore `status`, and the visual `favorite` flag). |
| [FRD-03](../frds/frd-03-portfolio/frd.md) | Portfolio and project navigation | Lists created projects with their state and links into each project's workspace. |
| [FRD-04](../frds/frd-04-project-workspace/frd.md) | Project workspace | Nine-tab per-project workspace with complete shared Spec and Architecture surfaces, logical data-model viewer, docs, commands and the build-mode selector. |
| [FRD-05](../frds/frd-05-work-orders/frd.md) | Work orders (live view) | Read-only kanban of a project's work orders, grouped by FRD, with the full document. |
| [FRD-06](../frds/frd-06-party/frd.md) | Party (live RPG map) | The live RPG map of the agents building a concrete project. |
| [FRD-07](../frds/frd-07-configuration/frd.md) | Configuration | Factory/agent configuration surface, including agent levels. |
| [FRD-08](../frds/frd-08-documentation/frd.md) | Documentation | The navigable factory Manual ("Códice del gremio"), Reference derived from the factory. |
| [FRD-09](../frds/frd-09-gamification/frd.md) | Gamification (RPG theme) | The honest gamification layer: XP, guild level, the RPG vocabulary. |
| [FRD-10](../frds/frd-10-achievements-hall/frd.md) | Achievements Hall | The hall of achievements and growing stats. |
| [FRD-11](../frds/frd-11-build-modes/frd.md) | Per-project build modes | Per-project build mode selection that defines the team composition. |
| [FRD-12](../frds/frd-12-observability-dataviz/frd.md) | Observability and data visualization | KPIs, data freshness, RPG↔timeline toggle and the work-order DAG. |
| [FRD-13](../frds/frd-13-visual-system-accessibility/frd.md) | Visual system and accessibility | OKLCH tokens, rationed accent, restrained motion, accessibility rigor. |
| [FRD-14](../frds/frd-14-snapshot-and-feedback/frd.md) | Probable snapshot and feedback channels | The "last probable point / building now" panel and decision/bug chips per project. |
| [FRD-15](../frds/frd-15-plugin-out-of-sync-warning/frd.md) | Plugin out-of-sync warning | Warns when the installed plugin has drifted from the repo. |
| [FRD-16](../frds/frd-16-orphan-project-detection/frd.md) | ~~Orphan project detection~~ — **REMOVED** | **Removed 2026-06-22** (owner: not wanted). The detection scan, `/api/orphans` route and dashboard banner were deleted; use `/pandacorp:adopt` / `/pandacorp:sync-portfolio` on demand instead. See [decision-log](../decision-log.md). |
| [FRD-17](../frds/frd-17-proposals-inbox/frd.md) | Proposals inbox | The self-learning gate + self-suggestion stream (promotions, bottlenecks, nudges). |
| [FRD-18](../frds/frd-18-dashboard/frd.md) | Dashboard ("Inicio") | The landing command center: since-last-visit digest, human-gate queue, factory pulse. |
| [FRD-19](../frds/frd-19-app-shell/frd.md) | Global app shell | The persistent top-navigation shell: brand + guild identity + the six top-level destinations, active-aware and responsive. |
| [FRD-23](../frds/frd-23-materialized-stats-read-model/frd.md) | Materialized stats read-model | The Informe reads a materialized `.pandacorp/stats.json` (honest cache + freshness seal) instead of deriving git on every render, falling back to live git when the snapshot is missing/stale/corrupt. |
| [FRD-24](../frds/frd-24-decision-id-emitter/frd.md) | Shared decision-id emitter | Extracts the `decisions.md` id-derivation into a pure function + CLI so the factory's `/pandacorp:decide` skill can invoke the same rule instead of re-deriving it in prose; golden vectors prove both paths agree. |

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

The shared architecture reads Stack → Integraciones y operación → Modelo de datos → environment/decisions/plan. Stack explains chosen technologies and providers; integrations explain flows, responsibilities and operational tasks. Preserve authored facts. Model selection can be cleared by clicking the same relation; diagram table text is nonselectable, while schema code remains copyable. Esquema is a single-column, initially collapsed entity accordion with one expanded entity at a time. Shared Propuesta/Spec/Architecture panels use available width, retaining only readable introductory prose limits. A fluid frame and one integrated phone/tablet header replace the narrow frame and split-looking hamburger menu. This is scoped responsive shell/model coverage, not a new app-wide platform certification. See ADR-0009 and FRD-19 REQ-19-003.
