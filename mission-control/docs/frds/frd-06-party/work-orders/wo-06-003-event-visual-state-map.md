---
id: WO-06-003
type: work-order
slug: event-visual-state-map
title: WO-06-003 — Event → visual-state map (the decoupling boundary)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
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
