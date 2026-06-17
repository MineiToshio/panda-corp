---
id: FRD-06
type: frd
title: FRD-06 — Party (live RPG map)
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
---
# FRD-06 — Party (live RPG map)

RPG-style view of the workflow subagents building a project: pixel-art zones and characters that move between stages.

## Acceptance criteria (EARS)
- The view SHALL show 4 **pixel-art zones** (Research = library, Backend = forge, Frontend = workshop, Testing = lab), each with its label.
- EACH workflow subagent (researcher, backend, frontend, testing) SHALL appear as a **sprite** (its avatar) placed in its zone.
- WHILE there is no stage transition, the sprites SHALL have life: a continuous "breathing" animation and **wandering** all over their zone (not standing still).
- WHEN the pipeline does a **handoff** (stage transition), the sprite of the incoming stage SHALL move to the next zone and **both SHALL end up together** (the one yielding steps aside), with a **speech bubble**.
- The researcher is **on demand**: backend and frontend consult it when they need to (it is not a fixed step at the start).
- The view SHALL show a **log** of the workflow events (subagent actions and handoffs between stages).
- WHEN a work order closes, an **achievement** SHALL fire ("Achievement unlocked!").
- The view SHALL feed off the workflow events written by the subagents (`emit-event.sh`) and the factory's `SubagentStop` hook (`~/.claude/dashboard-events.ndjson`) and off the task state (`~/.claude/tasks/`), **without calling Claude**. In the prototype it is **simulated** with a button.
- The view is for **observation**: to redirect/pause an agent, the owner uses the Claude Code app.
- IF there is no active team, it SHALL show an empty state gracefully.

## UX reinforcements (2026 research, see `docs/proposals/06-improvement-plan-2026.md`)
- EACH agent SHALL have a **fixed color** reused across the ENTIRE UI (its sprite, the event feed and its cards), so the eye links sprite ↔ event ↔ card without reading text. If several projects are being built, project-color (left border) + agent-color (second border).
- The events SHALL use a **fixed, bounded iconic vocabulary** (~12 types: read, write, edit, test ✓/✗, message, start, end); tool = extra icon.
- **Failure SHALL be a first-class state**, as visible as the achievement: agent in a "downed" state + danger color + error icon, distinct from "completed". Never hidden in a log.
- The feed SHALL **auto-scroll to the new** with a "pin" button when the operator scrolls up, and a **cap of 100–200 events** in memory (discards the oldest) so it doesn't degrade the render in long builds.
- It SHALL show an **activity pulse** (bars per minute, color per agent) that indicates at a glance whether the factory is alive or stalled.
- It SHALL offer an honest **RPG ↔ timeline/tree toggle** over the same data (work orders → tasks → actions), and a **Live / No signal** indicator with the timestamp of the last event.

## Future
The displayed team will scale according to the **build mode** ([FRD-11](../frd-11-build-modes/frd.md)): more or fewer agents, even several of the same role, positioned within their zones. Work order DAG with *path-focus* (highlight the dependency chain) and "jump to the first error" ([FRD-12](../frd-12-observability-dataviz/frd.md)).
