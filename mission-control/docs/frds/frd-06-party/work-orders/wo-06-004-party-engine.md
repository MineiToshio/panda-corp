---
id: WO-06-004
type: work-order
slug: party-engine
title: WO-06-004 — Party engine (RAF loop + animation queue)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
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

## Status Note

**Built:** `createPartyEngine(snapshot, opts): PartyEngine` — the pure step-math animation engine (IF-06-engine). No DOM, no real RAF in the core; the RAF binding lives in WO-06-006.

**Files delivered:**
- `app/projects/[slug]/_party/engine.ts` — factory function + all types
- `app/projects/[slug]/_party/engine.test.ts` — 32 tests RED→GREEN covering all AC

**Interface/contracts exposed (`IF-06-engine`):**

```ts
// Snapshot used to boot the engine (provided by the RSC host, CMP-06-party-tab)
type AgentSnapshot = { id: string; state: AgentState; home: Pos };

// Observable agent state returned by agents() on every tick
type EngineAgent = { id: string; state: AgentState; px: number; py: number; bob: number };

// Engine options
type EngineOpts = { seed?: number };

// Factory
createPartyEngine(snapshot: readonly AgentSnapshot[], opts: EngineOpts): PartyEngine

// PartyEngine interface
setState(id: string, state: AgentState): void          // immediate, no queue
startHandoff(id: string, target: string): void          // begins walk animation
applyEvents(diff: VisualAction[]): void                 // enqueues actions from state-map
tick(now: number): void                                 // advance physics (call from RAF)
agents(): EngineAgent[]                                 // snapshot of current state
```

**Physics (ported from prototype):**
- Walk path: `home → MCCENTER → approach(target, 85px offset) → [700ms pause] → MCCENTER → home`
- Walk speed: `0.1 * dt px/ms` (dt clamped to 48ms max)
- Bob: `sin(now/1000 * sp + phase) * amp` — idle: amp=0.5/sp=3.5, work: amp=1.3/sp=3.5, walk: amp=2.3/sp=7.5
- Wander: idle/work agents drift within `WANDER_RADIUS=40px` of home, retargeting every 2400ms
- `downSprite` action maps to `blocked` state (danger visual, PARTY.md §1)
- `fireAchievement` is cosmetic-only in the engine core (toast handled by WO-06-006 DOM adapter)

**Integration seams:**
- Import: `import { createPartyEngine } from "@/app/projects/[slug]/_party/engine"`
- Types: `AgentSnapshot`, `EngineAgent`, `PartyEngine`, `EngineOpts`
- Consumes: `VisualAction` from `./state-map`, `Pos`/`MCCENTER` from `./layout`
- WO-06-006 (DOM adapter/RAF loop) calls `engine.tick(performance.now())` in the RAF callback and reads `engine.agents()` to update DOM sprite transforms

**Gate:** 145 test files, 3924 tests GREEN + 2 expected-fail + 5 skipped. tsc clean. biome clean.
