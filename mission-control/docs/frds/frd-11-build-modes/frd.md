---
id: FRD-11
type: frd
title: FRD-11 — Per-project build modes
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
ui: true
visual_source: docs/design/prototype/index.html
---
# FRD-11 — Per-project build modes

Lets you choose how much power each project is built with, and shows the command to run.

## Acceptance criteria (EARS)
- EACH project SHALL offer (in its Commands tab) a **build mode** selector with four options:
  - **Pro / economical** — 1 agent at a time, economical models (sonnet/haiku). Slower, minimal consumption. For the Pro plan.
  - **Balanced** (default) — a team of ≤3 agents; opus lead, sonnet/haiku workers. Designed for Max 5x.
  - **Powerful** — up to 5 agents in parallel, advances faster. For Max 20x.
  - **Deep** — the best models across the board + extra adversarial review. For a special project.
- WHEN the owner chooses a mode, the **exact command to copy** SHALL be shown (`/pandacorp:implement [mode]`) with its description (agents, models, recommended plan).
- The chosen mode SHALL be **remembered per project**.
- The `/pandacorp:implement` skill SHALL accept those modes as an argument (`pro` | `powerful` | `deep`; no argument = balanced).

## Future
The mode will define the **team composition** (how many agents and of what role; e.g. several frontend), and **Party** ([FRD-06](../frd-06-party/frd.md)) will show the real team that is running.
