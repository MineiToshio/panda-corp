# PRD — Pandacorp (the factory dashboard)

## Vision
A single screen to operate the Pandacorp factory **as if it were an RPG**: see the state of all ideas and projects, read their documentation, know which command to run, and follow the "party" of agents building live — all wrapped in a layer of honest gamification that makes the real work fun.

## Feature landscape
Living index of the FRDs (feature-centric docs, DR-049). Each FRD is a self-contained module under `docs/frds/frd-NN-<slug>/`. Add a row when a new FRD is created.

| ID | Feature | What it does |
|---|---|---|
| [FRD-01](../frds/frd-01-data-reading/frd.md) | Data reading layer | Reads the factory's and each project's state from disk, read-only, never calling Claude. |
| [FRD-02](../frds/frd-02-ideas-board/frd.md) | Ideas board | The ideas kanban; derives each card's column and handles the only write (discard). |
| [FRD-03](../frds/frd-03-portfolio/frd.md) | Portfolio and project navigation | Lists created projects with their state and links into each project's workspace. |
| [FRD-04](../frds/frd-04-project-workspace/frd.md) | Project workspace | Per-project view with docs, commands and the build-mode selector. |
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
| [FRD-16](../frds/frd-16-orphan-project-detection/frd.md) | Orphan project detection | Detects external projects not yet adopted and suggests `/pandacorp:adopt`. |
| [FRD-17](../frds/frd-17-proposals-inbox/frd.md) | Proposals inbox | The self-learning gate + self-suggestion stream (promotions, bottlenecks, nudges). |
| [FRD-18](../frds/frd-18-dashboard/frd.md) | Dashboard ("Inicio") | The landing command center: since-last-visit digest, human-gate queue, factory pulse. |

## Problem
Operating the factory from the terminal alone is dry: there is no view of the overall state, you have to open files by hand, it's not obvious which skill is next, and nothing sustains the motivation of the solo operator day to day.

## User
The owner (sole operator, Spanish-speaking). Weak at UX → the tool must **guide and delight**, not just show data. **The entire UI is in Spanish** — copy, labels and `aria-label`s; the underlying code and identifiers are English.

## Value hypothesis
A read-only view that shows state + documentation + the next command, wrapped in an **honest** RPG layer (XP, levels and achievements that reflect real work), reduces friction and makes operating the factory daily pleasant — **without burning the subscription** (it never calls Claude) and **without falling into toxic gamification**.

## Principles and constraints
- **Read-only**: it never calls Claude or executes anything. The only write: marking an idea as `discarded`.
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

## Scope v1
The **Dashboard / "Inicio"** as the landing command center ([FRD-18](../frds/frd-18-dashboard/frd.md): the *since-last-visit* digest, the *Tu turno* human-gate queue, the *Pulso* funnel with the one metric that matters, the enriched *Construcción y cartera*, and the honest progress strip) + five tabs — **Board, Portfolio, Achievements, Configuration, Documentation** — + the **per-project workspace** + **Party RPG** + **gamification** (achievements/stats/XP/levels) + **build modes** + **probable snapshot and feedback channels** ([FRD-14](../frds/frd-14-snapshot-and-feedback/frd.md): a "last probable point / building now" panel with a worktree command, decision/bug chips per project), per the FRDs (`docs/frds/`, FRD-01 through FRD-18). The navigable prototype (`mission-control/prototype/index.html`) is the approved design. Cross-cutting across all tabs: **observability and data-viz** ([FRD-12](../frds/frd-12-observability-dataviz/frd.md): KPIs, data freshness, RPG↔timeline toggle, DAG) and the **visual and accessibility system** ([FRD-13](../frds/frd-13-visual-system-accessibility/frd.md): OKLCH tokens, rationed accent, `tabular-nums`, restrained motion, `prefers-reduced-motion`, state by icon+color).

## Non-goals (v1)
- It does not execute commands or agents (the owner pastes them into Claude Code).
- It is not multi-user nor deployed to the internet. No leaderboards.
- It does not edit the projects' documentation.

## Success metrics
- See the state of each idea/project and get the next-step command, without opening files.
- Zero calls to Claude from Pandacorp.
- The operator comes back daily: the gamification sustains the habit without fatigue.

## Backlog (future)
- Real computation of stats/achievements by reading the factory and the projects (today example data in the prototype).
- Dynamic Party per mode (more/fewer agents, several of the same role).
- Full-screen moment on level-up; phase transitions as a "cutscene"; weekly streak; meta-achievements (titled Seals); per-agent activity chart.
- Robust auto-refresh (file-watching) + real event streaming.
