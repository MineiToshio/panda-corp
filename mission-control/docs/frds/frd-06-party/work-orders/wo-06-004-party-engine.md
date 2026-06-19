---
id: WO-06-004
type: work-order
slug: party-engine
title: WO-06-004 — La Fragua engine (RAF loop, wave cap, rooms, parchment, gate)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
---

> **UNBLOCKED → IN_REVIEW (2026-06-18, repair pass).** The FRD-06 part of this WO was already
> *fixed*: `engine.ts` was over the 500-line hard cap (605 lines), the actual build-wave failure.
> The repair split it into `engine.ts` (414) + `engine/types.ts` (152) + `engine/slots.ts` (65),
> behavior-preserving (`occupiedForgeSlots`/`occupiedTribunalSlots` merged into one
> `occupiedSlots(wos, room)` helper). 53/53 engine tests green, tsc clean, biome-clean, no circular
> deps. The blocker was an **out-of-scope FRD-13 token regression** (two FRD-10 components still
> referenced the removed `--color-agent-guild` fallback). That regression has now been **resolved**
> by the repair engine — see WO-13-002 and the FRD-10 component repunt to
> `var(--color-tier-5, var(--color-agent-product-manager))`. Full `verify.sh` is now green (187 files,
> 5145 pass) and this WO is committed. Returns to IN_REVIEW for the FRD-06 reviewer.
# WO-06-004 — La Fragua engine (RAF loop, wave cap, rooms, parchment, gate)

**Components/Interfaces:** `IF-06-engine` · **Traces:** REQ-06-001, REQ-06-003, REQ-06-006
**Deploy unit:** Party tab (client engine) · **Location:** `app/projects/[slug]/_party/engine.ts` (+ `.test.ts`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The old engine animated wandering zone agents
> with center-routed stage handoffs. The faithful engine drives **one sprite per running WO** (capped at
> the wave), moves WOs Forja → Tribunal → Bóveda, routes the **parchment** between dependent WOs and opens
> the **single per-FRD gate**. The deep-relay sub-step physics live in WO-06-013. See the Status Note.

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: WHILE a work order is a **running `implementer`**, THE system SHALL render exactly **one sprite** for it in the Sala de Forja.
- AC-06-001.2: THE system SHALL cap the number of concurrently-built (sprite-bearing) work orders at the **wave size of the run mode**.
- AC-06-003.2: WHEN a work order transitions between rooms, THE system SHALL animate the move **inside / between rooms along the connecting path**.
- AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling from that work order to a **dependent** work order's station.

## Scope
- `createFraguaEngine(snapshot, opts)` exposing `setWo(wo,state)`, `enqueue(wo)`, `startHandoff(fromWo,toWo)`, `verifyWo(wo)`, `openGate()`, `applyEvents(diff)`, `tick(now)`, `wos()` / `gate()` / `trophies()` readers.
- **Wave cap:** at most `wave` (mode) WOs hold forge slots; the rest stay queued (drive the "+N en cola"); when a slot frees, the next queued WO is promoted. Enforced in the engine so the scene can never over-render (AC-06-001.2).
- **Room flow:** a WO walks forge-slot → tribunal-slot when it reaches `IN_REVIEW`; tribunal-slot → vault shelf when `VERIFIED` (AC-06-003.2), along the layout paths (WO-06-002).
- **Parchment:** `startHandoff(fromWo, toWo)` animates the `Status Note` document from the closing WO's station to the dependent WO's station; if `toWo` is absent from the scene, animate to the queue edge.
- **The decoupled queue:** `applyEvents` enqueues `VisualAction`s (WO-06-003); `tick(now)` advances at the engine's pace (deterministic given `now`; no RAF in tests). Pure step math; the DOM/RAF binding lives in WO-06-006.
- Remove wandering/zone/center-routing; the deep relay sub-step rendering is WO-06-013.

## Dependencies
- WO-06-002 (layout slots/paths), WO-06-003 (`VisualAction`).

## TDD / Definition of done
- Tests drive the engine with a fake clock (`tick(t)`): a handoff action moves the agent toward the target and ends both together; idle agents wander but stay within zone bounds; `applyEvents` drains in order at the queue's pace (visual lag is allowed); a second `tick` after completion returns to home/idle.
- Pure core, no DOM, no real RAF in tests. Gate green.

## Status Note (Wave 2 — La Fragua faithful engine, 2026-06-18)

**Built:** `createFraguaEngine({mode, wave}): FraguaEngine` — the WO-keyed pure-step-math engine (IF-06-engine). No DOM, no real RAF in the core; the RAF binding lives in WO-06-006.

**Files delivered:**
- `src/app/projects/[slug]/_party/engine/engine.ts` — `createFraguaEngine` + all new types + legacy re-exports
- `src/app/projects/[slug]/_party/engine/engine.legacy.ts` — `createPartyEngine` moved here (backward compat for PartyScene WO-06-006 until its redesign)
- `src/app/projects/[slug]/_party/engine/_tests/engine.test.ts` — 53 tests RED→GREEN covering all AC

**Interface/contracts exposed (`IF-06-engine`):**

```ts
// Options to boot the engine
type FraguaEngineOpts = { mode: BuildMode; wave: number };

// Observable WO sprite state returned by wos() on every tick
type WoSprite = { wo: string; state: WoState; px: number; py: number; relay?: {...} };

// Gate state returned by gate()
type GateState = { open: boolean };

// Factory
createFraguaEngine(opts: FraguaEngineOpts): FraguaEngine

// FraguaEngine interface
setWo(wo, state: WoState): void         // immediate state change; creates sprite if new
enqueue(wo): void                        // wave-capped enqueue; idempotent
startHandoff(fromWo, toWo): void         // parchment flight from fromWo → toWo station
verifyWo(wo): void                       // moves WO to trophies(); frees forge slot → promote
openGate(): void                         // opens the reviewer gate
applyEvents(diff: VisualAction[]): void  // enqueues actions (decoupled queue)
tick(now: number): void                  // advance physics (deterministic, no RAF in tests)
wos(): WoSprite[]                        // snapshot of forge+tribunal sprites
gate(): GateState                        // current gate state
trophies(): string[]                     // VERIFIED WO ids (Bóveda)
```

**Physics / mechanics built:**
- Wave cap: `enqueue()` promotes WOs into forge slots (≤wave); when a slot frees (move to tribunal or vault), `promoteQueued()` fills it
- Room flow: `setWo(wo,'in_review')` moves sprite to tribunal slot (forge→tribunal order: change room first, then promoteQueued for accurate forgeCount); `verifyWo(wo)` removes from active → trophies
- Slot assignment: `occupiedForgeSlots`/`occupiedTribunalSlots` track used slot indices; `nextFreeSlot` finds the next open one
- Parchment: `spawnParchment(fromWo, toWo)` records a ParchmentFlight; `tickParchments(now)` advances it toward target (or forge edge if toWo absent)
- Sprite animation: each sprite moves toward its `targetPx/targetPy` at WALK_SPEED=0.12 px/ms each `tick(now)`

**Integration seams:**
- Import: `import { createFraguaEngine } from "@/app/projects/[slug]/_party/engine/engine"`
- New types: `FraguaEngine`, `FraguaEngineOpts`, `WoSprite`, `GateState`
- Legacy types/factory still re-exported: `createPartyEngine`, `AgentSnapshot`, `EngineAgent`, `PartyEngine`, `EngineOpts`, `AgentState`
- Consumes: `VisualAction`/`WoState` from `./state-map/state-map`, layout constants from `../layout`
- WO-06-006 (DOM adapter/RAF loop) will call `engine.tick(performance.now())` and read `engine.wos()` + `engine.gate()` + `engine.trophies()` to render rooms

**Gate:** 53/53 engine tests GREEN. 183/184 test files GREEN (1 pre-existing failure in agentColorTokens.integration.reviewer.test.ts, FRD-13 issue — failing before this WO). tsc clean. biome clean (no new errors; 2 complexity warns on legacy file are rule=warn not error).

---

### Pre-redesign status note (the retry requirement — now implemented)

**Why reopened:** the shipped engine (below) is built around `AgentSnapshot`/`EngineAgent` with
home positions, `WANDER_RADIUS` idle drift, and a `home → MCCENTER → approach(target) → home` handoff
walk — the fictitious model. The retry rewrites it around **work orders**: `createFraguaEngine`, a
`WoSprite` model (`{ wo, state: building|in_review|verified|blocked, px, py, relay? }`), the **wave cap**
(promote queued WOs into freed forge slots), the **room flow** (forge→tribunal on `IN_REVIEW`,
tribunal→vault on `VERIFIED`), the **parchment** routing between dependent WOs, and the single
**`openGate()`** (reviewer activates when all WOs `IN_REVIEW`). Keep the decoupled queue + deterministic
`tick(now)` (no real RAF in tests). Delete wandering, `MCCENTER`, `AgentState 'walk'`. Rewrite the 32
tests against the new readers (`wos()`, `gate()`, `trophies()`). The deep relay sub-step physics are
WO-06-013.

---

### Previous build (obsoleted by the redesign — kept for history)

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
