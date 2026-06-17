---
id: WO-06-004
type: work-order
slug: party-engine
title: WO-06-004 — Party engine (RAF loop + animation queue)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-004 — Party engine (RAF loop + animation queue)

**Components/Interfaces:** `IF-06-engine` · **Traces:** REQ-06-003, REQ-06-004
**Deploy unit:** Party tab (client engine) · **Location:** `app/projects/[slug]/_party/engine.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-003.1: WHILE there is no stage transition, the sprites SHALL have life: a continuous "breathing" animation and **wandering** all over their zone (not standing still).
- AC-06-004.1: WHEN the pipeline does a handoff, the sprite of the incoming stage SHALL move to the next zone and **both SHALL end up together** (the one yielding steps aside), with a speech bubble.

## Scope
- `createPartyEngine(snapshot, opts)` exposing `setState(id,state)`, `startHandoff(id,target)`, `applyEvents(diff)`, `tick(now)`, `agents()`. Ports `MC`/`mcBoot`/`mcLoop`/`mcSetState`/`mcStartHandoff`/`mcApproach`/`mcArrive`/`mcSeed` semantics from the prototype into typed TS.
- The **decoupled queue** (PARTY.md §4): `applyEvents` enqueues `VisualAction`s (from `IF-06-state-map`); `tick(now)` advances positions/phases at the engine's pace. Pure step math (no DOM) in the core; the RAF binding + DOM adapter is thin and lives in WO-06-006.
- Wandering within the zone (idle drift) + breathing handled as state, computed deterministically given a `now` (so tests are deterministic without RAF).
- Handoff routes station → center → next-to-target → back (no path over another work area).

## Dependencies
- WO-06-002 (positions/roster), WO-06-003 (`VisualAction`).

## TDD / Definition of done
- Tests drive the engine with a fake clock (`tick(t)`): a handoff action moves the agent toward the target and ends both together; idle agents wander but stay within zone bounds; `applyEvents` drains in order at the queue's pace (visual lag is allowed); a second `tick` after completion returns to home/idle.
- Pure core, no DOM, no real RAF in tests. Gate green.
