---
id: WO-06-003
type: work-order
slug: event-visual-state-map
title: WO-06-003 — Event → visual-state map (the decoupling boundary)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-003 — Event → visual-state map (the decoupling boundary)

**Components/Interfaces:** `IF-06-state-map` · **Traces:** REQ-06-004, REQ-06-005, REQ-06-007, REQ-06-013
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/state-map.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-004.1: WHEN the pipeline does a **handoff** (stage transition), the sprite of the incoming stage SHALL move to the next zone and **both SHALL end up together** (the one yielding steps aside), with a **speech bubble**.
- AC-06-005.1: The researcher is **on demand**: backend and frontend consult it when they need to.
- AC-06-007.1: WHEN a work order closes, an **achievement** SHALL fire ("Achievement unlocked!").
- AC-06-013.1: Failure SHALL be a first-class state ... distinct from "completed". Never hidden.

## Scope
- `eventToVisual(event): VisualAction` implementing PARTY.md §4 / architecture §5 mapping:
  `start → setState(agent,'work')`; `handoff(from,to) → startHandoff(from, target=to)`;
  `end` (nothing pending) `→ setState(agent,'idle')`; `blocked → setState(agent,'blocked')`;
  reviewer receives deliverable / `review → setState(reviewer,'review')`;
  work-order close / `achievement → fireAchievement` + `setState(agent,'achievement')` then settle;
  failure (`test_fail`/`status:'fail'`) → `downSprite(agent)` (first-class, not filtered).
- Returns a discriminated-union `VisualAction` (no DOM, no side effects) consumed by the engine.

## Dependencies
- WO-06-001 (`EventType`, the VM types).

## TDD / Definition of done
- Tests cover every event type → expected `VisualAction`; `handoff` carries the target; `achievement` returns the celebration action; failure returns a down action and is never dropped; unknown event → safe no-op (defensive).
- Pure. Gate green.

## Status Note

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
