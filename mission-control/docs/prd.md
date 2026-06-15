# PRD — Pandacorp (the factory dashboard)

## Vision
A single screen to operate the Pandacorp factory **as if it were an RPG**: see the state of all ideas and projects, read their documentation, know which command to run, and follow the "party" of agents building live — all wrapped in a layer of honest gamification that makes the real work fun.

## Problem
Operating the factory from the terminal alone is dry: there is no view of the overall state, you have to open files by hand, it's not obvious which skill is next, and nothing sustains the motivation of the solo operator day to day.

## User
The owner (sole operator, Spanish-speaking). Weak at UX → the tool must **guide and delight**, not just show data.

## Value hypothesis
A read-only view that shows state + documentation + the next command, wrapped in an **honest** RPG layer (XP, levels and achievements that reflect real work), reduces friction and makes operating the factory daily pleasant — **without burning the subscription** (it never calls Claude) and **without falling into toxic gamification**.

## Principles and constraints
- **Read-only**: it never calls Claude or executes anything. The only write: marking an idea as `discarded`.
- **Reads files**: idea base and portfolio in the factory; documentation and state of each project in its folder.
- **Local**: listens on `127.0.0.1`. No auth, no deploy.
- **Honest gamification**: it represents real work (XP for results, not for volume or for opening the app). No leaderboards, lives/death, daily streaks or false urgency (see [FRD-09](frds/frd-09-gamification.md)).

## What we want to achieve (product goals)
1. See the state of the whole factory at a glance (ideas, projects, agents).
2. Read any document without opening files by hand.
3. Always know the next command, and be able to choose the **build mode** per project.
4. Follow the agents building live, in a fun way (RPG-style **Party**).
5. Feel progress: **achievements**, **stats** that grow, **guild level** and **agent levels**.
6. Let another person understand the whole system (internal documentation).

## Scope v1
Five tabs — **Board, Portfolio, Achievements, Configuration, Documentation** — + the **per-project workspace** + **Party RPG** + **gamification** (achievements/stats/XP/levels) + **build modes** + **probable snapshot and feedback channels** ([FRD-14](frds/frd-14-snapshot-and-feedback.md): a "last probable point / building now" panel with a worktree command, decision/bug chips per project), per the FRDs (`docs/frds/`, FRD-01 through FRD-14). The navigable prototype (`mission-control/prototype/index.html`) is the approved design. Cross-cutting across all tabs: **observability and data-viz** ([FRD-12](frds/frd-12-observability-dataviz.md): KPIs, data freshness, RPG↔timeline toggle, DAG) and the **visual and accessibility system** ([FRD-13](frds/frd-13-visual-system-accessibility.md): OKLCH tokens, rationed accent, `tabular-nums`, restrained motion, `prefers-reduced-motion`, state by icon+color).

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
