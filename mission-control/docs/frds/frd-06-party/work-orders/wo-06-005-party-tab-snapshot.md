---
id: WO-06-005
type: work-order
slug: party-tab-snapshot
title: WO-06-005 — Party tab server snapshot (RSC)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-005 — Party tab server snapshot (RSC)

**Components/Interfaces:** `CMP-06-party-tab` · **Traces:** REQ-06-008, REQ-06-002, REQ-06-005, REQ-06-010
**Deploy unit:** Party tab (Server Component) · **Location:** `app/projects/[slug]/_party/PartyTab.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-008.1: The view SHALL feed off the workflow events written by the subagents (`emit-event.sh`) and the `SubagentStop` hook (`~/.claude/dashboard-events.ndjson`) and off the task state (`~/.claude/tasks/`), **without calling Claude**.
- AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
- AC-06-002.1: EACH workflow subagent SHALL appear as a sprite placed in its zone.

## Scope
- Server Component that, for the project slug: reads the **capped** event tail via `lib/events` (cap 100–200) and task state via `lib/tasks`; reads the build mode via `lib/status`; builds `PartySnapshot` (roster via `IF-06-roster`, initial agent states from the tail, events mapped via `IF-06-event-vm`, `active`, `lastEventAt`).
- Passes the serializable snapshot to `CMP-06-scene`/`CMP-06-feed` (client). No `fs` reaches the client.
- `active=false` (no team / no events / `~/.claude/tasks/` absent) → render `CMP-06-empty`.

## Dependencies
- FRD-01 `lib/events`, `lib/tasks`, `lib/status`, `lib/config` (cross-feature, hard).
- WO-06-001 (mapper), WO-06-002 (roster).

## TDD / Definition of done
- Tests with `PANDACORP_FACTORY_ROOT` fixtures: builds a snapshot from a fixture ndjson tail; respects the cap (drops oldest); absent `tasks/` → `active=false`; malformed lines tolerated (never throws); never imports a Claude/AI client (auditable). `lastEventAt` is the newest `at`.
- Gate green.
