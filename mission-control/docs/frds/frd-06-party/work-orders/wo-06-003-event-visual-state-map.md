---
id: WO-06-003
type: work-order
slug: event-visual-state-map
title: WO-06-003 — Event → visual-action map (La Fragua decoupling boundary)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-003 — Event → visual-action map (La Fragua decoupling boundary)

**Components/Interfaces:** `IF-06-state-map` · **Traces:** REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-007, REQ-06-012
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/state-map.ts` (+ `.test.ts`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The old map was agent/zone-keyed
> (`setState(agent,'work'/'walk')`, handoff between *stages*, researcher-on-demand). The faithful model
> is **work-order-keyed** with new event kinds (`HandoffWritten`, `ContractPublished`, relay `activity`,
> gate open) and no live peer chat. See the Status Note below.

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: WHILE a work order is a **running `implementer`**, THE system SHALL render exactly **one sprite** for it in the Sala de Forja.
- AC-06-003.2: WHEN a work order transitions between rooms, THE system SHALL animate the move **inside / between rooms along the connecting path**.
- AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling from that work order to a **dependent** work order's station (the Build Plan dependency).
- AC-06-007.2: THE system SHALL render the relay steps **sequentially**, and SHALL NOT show the three roles working simultaneously.
- AC-06-007.3: WHEN `backend-dev` publishes the `docs/api.md` contract, THE system SHALL render a **contract hand-off** (driven by `ContractPublished`).
- AC-06-012.1: WHEN a work order closes (reaches `VERIFIED`), THE system SHALL fire an **achievement** toast.

## Scope
- `eventToVisual(event): VisualAction` mapping the **enriched** event stream (`{role, wo, frd, phase,
  activity, mode}` + the new kinds) to engine actions:
  - `AgentWorking` with `phase:'build'` + `wo` → `setWo(wo,'building')`; `activity` (`test|backend|
    frontend|selftest|implement`) → `advanceRelay(wo, step)` in deep mode.
  - `HandoffWritten {wo, frd}` → `startHandoff(fromWo=wo, toWo=dependent)` — the parchment (AC-06-006.1).
  - `ContractPublished {wo, frd}` → `publishContract(wo)` (AC-06-007.3).
  - `phase:'review'` (gate) → `openGate()` once all WOs are `IN_REVIEW`; reviewer activates (REQ-06-004).
  - WO `VERIFIED` / `SubagentStop` close → `verifyWo(wo)` + `fireAchievement(wo)` (AC-06-012.1).
  - failure (`status:'fail'`/`test_fail`) → `downSprite(wo)` (first-class, never filtered).
- Returns a discriminated-union `VisualAction` (no DOM, no side effects) consumed by `IF-06-engine`.
- Remove the obsolete `'walk'`/zone-handoff/researcher-on-demand semantics.

## Dependencies
- WO-06-012 (`lib/events.ts` enriched fields), WO-06-001 (`EventType`/VM types).

## TDD / Definition of done
- Tests cover every event type → expected `VisualAction`; `handoff` carries the target; `achievement` returns the celebration action; failure returns a down action and is never dropped; unknown event → safe no-op (defensive).
- Pure. Gate green.

## Status Note (Wave 2 La Fragua redesign — delivered 2026-06-18)

**Built:** `IF-06-state-map` — the pure event → visual-action decoupling boundary, fully rewritten for the work-order-keyed model. The old agent/zone-keyed 5-member union is replaced with a 10-member union. The `eventToVisual` pure function maps the enriched event stream to typed engine instructions with no DOM, no I/O, no side-effects.

**Files delivered:**
- `src/app/projects/[slug]/_party/state-map/state-map.ts` — complete rewrite: `VisualAction` (10-member discriminated union), `WoState`, `RelayStep`, `AgentState` (backward-compat), `eventToVisual(event: DashboardEvent): VisualAction` pure mapper, `STATE_MAP_KNOWN_EVENTS` set. `handleAgentWorking` extracted helper to maintain biome complexity budget.
- `src/app/projects/[slug]/_party/state-map/_tests/state-map.test.ts` — 48 tests (RED→GREEN) covering all ACs: AgentWorking build/review, deep relay steps, HandoffWritten parchment, ContractPublished, SubagentStop verifyWo, achievement fireAchievement, failure first-class downSprite, unknown noop, idempotency, STATE_MAP_KNOWN_EVENTS set, WoState/RelayStep types.
- `src/app/projects/[slug]/_party/engine/engine.ts` — updated `processAction` switch to handle the 10 new VisualAction kinds; extracted `woStateToAgentState`, `processSetWo`, `processStartHandoff` helpers; added `WoState` to imports. The engine remains agent-keyed internally; WO ids are used as agent identifiers as a bridge until the full WO-keyed engine redesign.
- `src/app/projects/[slug]/_party/engine/_tests/engine.test.ts` — updated `applyEvents` test group from old action shapes (setState/agentId, startHandoff/agentId+targetId) to new shapes (setWo/wo, startHandoff/fromWo+toWo, downSprite/wo, fireAchievement/wo); added tests for openGate, advanceRelay, publishContract, verifyWo.

**Interfaces/contracts exposed:**

```ts
// Work-order visual state
export type WoState = "building" | "in_review" | "verified" | "blocked";

// Deep-mode relay step
export type RelayStep = "test" | "backend" | "frontend";

// 10-member discriminated union (IF-06-state-map)
export type VisualAction =
  | { kind: "setWo";          wo: string;      state: WoState }
  | { kind: "enqueue";        wo: string }
  | { kind: "startHandoff";   fromWo: string;  toWo: string | undefined }
  | { kind: "advanceRelay";   wo: string;      step: RelayStep }
  | { kind: "publishContract"; wo: string }
  | { kind: "openGate" }
  | { kind: "verifyWo";       wo: string }
  | { kind: "fireAchievement"; wo: string | undefined }
  | { kind: "downSprite";     wo: string | undefined }
  | { kind: "noop" };

// Backward-compatible (for PartyScene/engine consumers not yet migrated)
export type AgentState = "work" | "walk" | "idle" | "blocked" | "review";

// The decoupling boundary
export function eventToVisual(event: DashboardEvent): VisualAction;

// Set of event types with visual meaning
export const STATE_MAP_KNOWN_EVENTS: Set<string>;
```

**Mapping rules implemented (FRD-06 §2 IF-06-state-map):**
- `AgentWorking` + `phase:'build'` + `workOrder` → `setWo(wo,'building')` (AC-06-001.1)
- `AgentWorking` + `phase:'build'` + `mode:'deep'` + relay activity (`test|backend|frontend`) → `advanceRelay(wo, step)` (AC-06-007.2)
- `AgentWorking` + `phase:'review'` → `openGate()` (REQ-06-004)
- `HandoffWritten` + `workOrder` → `startHandoff(fromWo=workOrder, toWo=session)` parchment (AC-06-006.1)
- `ContractPublished` + `workOrder` → `publishContract(wo)` (AC-06-007.3)
- `SubagentStop` + `workOrder` → `verifyWo(wo)` (AC-06-012.1)
- `achievement` → `fireAchievement(wo=workOrder?)` (AC-06-012.1)
- `status==='fail'` OR `event==='test_fail'` → `downSprite(wo?)` overrides all semantics (AC-06-012.1)
- Anything else → `noop` (defensive, never throws)

**Integration seams:**
- Consumed by `IF-06-engine` (`createPartyEngine`, WO-06-004) via `engine.applyEvents(diff)`.
- Consumed by `PartyTab` (WO-06-005) via `events.map(eventToVisual)`.
- Depends on `lib/events.ts` (`Event` type as `DashboardEvent`) — enriched fields from WO-06-012.
- `HandoffWritten.session` = the dependent WO id (Build Plan target); `workOrder` = fromWo.

**Test files:** `src/app/projects/[slug]/_party/state-map/_tests/state-map.test.ts` (48 tests, all GREEN).

**Gate at hand-off:** 183 test files, 5099 tests GREEN + 2 expected-fail + 5 skipped (1 pre-existing failure in untracked `agentColorTokens.integration.reviewer.test.ts` from another WO). `tsc --noEmit` clean (no new errors). `biome check` clean on all changed files (1 pre-existing warning in `engine.ts:tickAgent` — not introduced by this WO).

---

### Previous build (obsoleted by the redesign — kept for history)

**Built:** `IF-06-state-map` — the pure event → visual-action decoupling boundary. Raw `DashboardEvent` objects from the NDJSON stream are mapped to a typed discriminated-union `VisualAction` that the engine (IF-06-engine, WO-06-004) consumes. No DOM, no I/O, no side-effects.

**Files delivered:**
- `app/projects/[slug]/_party/state-map.ts` — `VisualAction` discriminated union (5 members: `SetStateAction`, `StartHandoffAction`, `FireAchievementAction`, `DownSpriteAction`, `NoopAction`), `AgentState` type, `eventToVisual(event: DashboardEvent): VisualAction` pure mapper, `STATE_MAP_KNOWN_EVENTS` set (re-exported for engine consumers).
- `app/projects/[slug]/_party/state-map.test.ts` — 28 tests RED→GREEN covering all AC.

**Interfaces/contracts exposed:**

```ts
// Types
export type AgentState = "work" | "walk" | "idle" | "blocked" | "review";
export type VisualAction =
  | { kind: "setState";       agentId: string;           state: AgentState }
  | { kind: "startHandoff";   agentId: string;           targetId: string }
  | { kind: "fireAchievement"; agentId: string|undefined; workOrder: string|undefined }
  | { kind: "downSprite";     agentId: string|undefined }
  | { kind: "noop" };

// The decoupling boundary
export function eventToVisual(event: DashboardEvent): VisualAction;

// Optional: set of event types with visual meaning
export const STATE_MAP_KNOWN_EVENTS: Set<string>;
```

**Mapping rules implemented (PARTY.md §4 + blueprint IF-06-state-map):**
- `start` + agent → `setState(agent, 'work')` (including researcher on-demand, AC-06-005.1)
- `handoff` + agent + session → `startHandoff(agent, target=session)` (AC-06-004.1)
- `handoff` + agent, no session → `setState(agent, 'walk')` (solo-handoff fallback)
- `end` + agent → `setState(agent, 'idle')`
- `blocked` + agent → `setState(agent, 'blocked')`
- `review` + agent → `setState(agent, 'review')`
- `achievement` → `fireAchievement(agent?, workOrder?)` (AC-06-007.1)
- `status==='fail'` OR `event==='test_fail'` → `downSprite(agent?)` overrides all other semantics (AC-06-013.1)
- unknown / no-agent cases → `noop` (defensive, never throws)

**Integration seams:**
- Consumed by `IF-06-engine` (`createPartyEngine`, WO-06-004) via `engine.applyEvents(diff)`.
- Depends on `lib/events.ts` (`Event` type as `DashboardEvent`) — the raw event stream type.
- The `handoff` target is read from `event.session` (the NDJSON emitter uses `session` for the target role per the event contract).

**Test files:** `app/projects/[slug]/_party/state-map.test.ts` (28 tests, all GREEN).

**Gate at hand-off:** 142 test files, 3867 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean. `biome check` clean on both new files.
