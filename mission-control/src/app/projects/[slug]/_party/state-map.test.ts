/**
 * WO-06-003 — Event → visual-state map (the decoupling boundary)
 *
 * Tests for the pure `eventToVisual` mapper (IF-06-state-map).
 *
 * Traceability:
 *   AC-06-004.1 — handoff: sprite walks to next zone, both end up together, with speech bubble
 *   AC-06-005.1 — researcher is on demand (consulted by backend/frontend, not a fixed step)
 *   AC-06-007.1 — work-order close fires achievement ("Achievement unlocked!")
 *   AC-06-013.1 — failure is a first-class state (never hidden, distinct from completed)
 *
 * Dependencies:
 *   IF-01-readEvents (lib/events.ts) — the `Event` type consumed as DashboardEvent.
 *   WO-06-001 (event-vm.ts) — EventType union.
 *
 * Pure module — no I/O, no DOM, no side-effects.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events";
import { eventToVisual, type VisualAction } from "./state-map";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-06-17T10:00:00Z", ...partial };
}

// ---------------------------------------------------------------------------
// start → setState(agent, 'work')
// ---------------------------------------------------------------------------

describe("frd-06: state-map — start event", () => {
  it("frd-06: WHEN event is 'start' with an agent THEN VisualAction is setState 'work'", () => {
    const ev = makeEvent({ event: "start", agent: "backend-dev" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "backend-dev",
      state: "work",
    });
  });

  it("frd-06: WHEN event is 'start' with researcher THEN VisualAction is setState 'work' (on-demand, AC-06-005.1)", () => {
    const ev = makeEvent({ event: "start", agent: "researcher" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "researcher",
      state: "work",
    });
  });

  it("frd-06: WHEN event is 'start' with no agent THEN returns noop", () => {
    const ev = makeEvent({ event: "start" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// handoff → startHandoff(from, target=to)  [AC-06-004.1]
// ---------------------------------------------------------------------------

describe("frd-06: state-map — handoff event (AC-06-004.1)", () => {
  it("frd-06: WHEN event is 'handoff' with agent and session (target) THEN VisualAction is startHandoff", () => {
    const ev = makeEvent({ event: "handoff", agent: "backend-dev", session: "frontend-dev" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "startHandoff",
      agentId: "backend-dev",
      targetId: "frontend-dev",
    });
  });

  it("frd-06: handoff target is preserved in the action (AC-06-004.1 — both sprites end up together)", () => {
    const ev = makeEvent({ event: "handoff", agent: "researcher", session: "backend-dev" });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("startHandoff");
    if (action.kind === "startHandoff") {
      expect(action.agentId).toBe("researcher");
      expect(action.targetId).toBe("backend-dev");
    }
  });

  it("frd-06: WHEN event is 'handoff' with no agent THEN returns noop", () => {
    const ev = makeEvent({ event: "handoff", session: "frontend-dev" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("frd-06: WHEN event is 'handoff' with agent but no target THEN setState walk (solo handoff fallback)", () => {
    const ev = makeEvent({ event: "handoff", agent: "backend-dev" });
    const action = eventToVisual(ev);
    // No target: emit a setState 'walk' as a solo handoff (engine will handle the animation)
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "backend-dev",
      state: "walk",
    });
  });
});

// ---------------------------------------------------------------------------
// end → setState(agent, 'idle')
// ---------------------------------------------------------------------------

describe("frd-06: state-map — end event", () => {
  it("frd-06: WHEN event is 'end' with an agent THEN VisualAction is setState 'idle'", () => {
    const ev = makeEvent({ event: "end", agent: "frontend-dev" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "frontend-dev",
      state: "idle",
    });
  });

  it("frd-06: WHEN event is 'end' with no agent THEN returns noop", () => {
    const ev = makeEvent({ event: "end" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// blocked → setState(agent, 'blocked')
// ---------------------------------------------------------------------------

describe("frd-06: state-map — blocked event", () => {
  it("frd-06: WHEN event is 'blocked' with an agent THEN VisualAction is setState 'blocked'", () => {
    const ev = makeEvent({ event: "blocked", agent: "test-writer" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "test-writer",
      state: "blocked",
    });
  });

  it("frd-06: WHEN event is 'blocked' with no agent THEN returns noop", () => {
    const ev = makeEvent({ event: "blocked" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// review → setState(reviewer/agent, 'review')
// ---------------------------------------------------------------------------

describe("frd-06: state-map — review event (AC-06-004.1 reviewer receives deliverable)", () => {
  it("frd-06: WHEN event is 'review' with an agent THEN VisualAction is setState 'review'", () => {
    const ev = makeEvent({ event: "review", agent: "reviewer" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "reviewer",
      state: "review",
    });
  });

  it("frd-06: WHEN event is 'review' with frontend-dev THEN VisualAction is setState 'review' (any reviewer)", () => {
    const ev = makeEvent({ event: "review", agent: "frontend-dev" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setState",
      agentId: "frontend-dev",
      state: "review",
    });
  });

  it("frd-06: WHEN event is 'review' with no agent THEN returns noop", () => {
    const ev = makeEvent({ event: "review" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// achievement → fireAchievement (AC-06-007.1 — work-order close fires achievement)
// ---------------------------------------------------------------------------

describe("frd-06: state-map — achievement event (AC-06-007.1)", () => {
  it("frd-06: WHEN event is 'achievement' THEN VisualAction is fireAchievement", () => {
    const ev = makeEvent({ event: "achievement", agent: "backend-dev", workOrder: "WO-01-001" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "fireAchievement",
      agentId: "backend-dev",
      workOrder: "WO-01-001",
    });
  });

  it("frd-06: WHEN event is 'achievement' with no agent THEN fireAchievement with agentId undefined", () => {
    const ev = makeEvent({ event: "achievement", workOrder: "WO-02-001" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "fireAchievement",
      agentId: undefined,
      workOrder: "WO-02-001",
    });
  });

  it("frd-06: WHEN event is 'achievement' with no workOrder THEN fireAchievement with workOrder undefined", () => {
    const ev = makeEvent({ event: "achievement", agent: "reviewer" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "fireAchievement",
      agentId: "reviewer",
      workOrder: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// failure → downSprite(agent)  — first-class state, never dropped (AC-06-013.1)
// ---------------------------------------------------------------------------

describe("frd-06: state-map — failure is first-class (AC-06-013.1)", () => {
  it("frd-06: WHEN event is 'test_fail' with an agent THEN VisualAction is downSprite", () => {
    const ev = makeEvent({ event: "test_fail", agent: "test-writer" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      agentId: "test-writer",
    });
  });

  it("frd-06: WHEN event has status 'fail' with an agent THEN VisualAction is downSprite", () => {
    const ev = makeEvent({ event: "write", agent: "backend-dev", status: "fail" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      agentId: "backend-dev",
    });
  });

  it("frd-06: failure is never filtered — downSprite returned even when other fields present (AC-06-013.1)", () => {
    const ev = makeEvent({
      event: "test_fail",
      agent: "test-writer",
      status: "fail",
      workOrder: "WO-05-001",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("downSprite");
  });

  it("frd-06: WHEN event is 'test_fail' with no agent THEN VisualAction is downSprite with agentId undefined", () => {
    const ev = makeEvent({ event: "test_fail" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      agentId: undefined,
    });
  });

  it("frd-06: WHEN event has status 'fail' with no agent THEN downSprite with agentId undefined", () => {
    const ev = makeEvent({ event: "end", status: "fail" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      agentId: undefined,
    });
  });

  it("frd-06: failure overrides normal event semantics — test_fail does not produce setState 'idle' (distinct from completed)", () => {
    // 'end' normally maps to idle, but if status=fail it downgrades to downSprite
    const ev = makeEvent({ event: "end", agent: "backend-dev", status: "fail" });
    const action = eventToVisual(ev);
    expect(action.kind).not.toBe("setState");
    expect(action.kind).toBe("downSprite");
  });
});

// ---------------------------------------------------------------------------
// Unknown event → safe noop (defensive)
// ---------------------------------------------------------------------------

describe("frd-06: state-map — unknown event (defensive noop)", () => {
  it("frd-06: WHEN event type is unknown THEN returns noop without throwing", () => {
    const ev = makeEvent({ event: "unknown_event_type", agent: "backend-dev" });
    expect(() => eventToVisual(ev)).not.toThrow();
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("frd-06: WHEN event type is empty string THEN returns noop without throwing", () => {
    const ev = makeEvent({ event: "" });
    expect(() => eventToVisual(ev)).not.toThrow();
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("frd-06: WHEN event type is a prototype property name THEN returns noop (prototype-pollution guard)", () => {
    const ev = makeEvent({ event: "constructor", agent: "backend-dev" });
    expect(() => eventToVisual(ev)).not.toThrow();
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// Idempotency — pure function (no hidden state)
// ---------------------------------------------------------------------------

describe("frd-06: state-map — idempotency (pure function)", () => {
  it("frd-06: WHEN eventToVisual is called twice with the same event THEN both results are equal", () => {
    const ev = makeEvent({ event: "start", agent: "backend-dev", workOrder: "WO-01-001" });
    const r1 = eventToVisual(ev);
    const r2 = eventToVisual(ev);
    expect(r1).toEqual(r2);
  });

  it("frd-06: WHEN eventToVisual is called with a handoff event THEN result is deterministic", () => {
    const ev = makeEvent({ event: "handoff", agent: "backend-dev", session: "frontend-dev" });
    expect(eventToVisual(ev)).toEqual(eventToVisual(ev));
  });
});
