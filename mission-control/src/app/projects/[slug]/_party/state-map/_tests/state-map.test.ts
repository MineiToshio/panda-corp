/**
 * WO-06-003 — Event → visual-state map (the decoupling boundary)
 * Wave 2 (La Fragua redesign, 2026-06-18)
 *
 * Tests for the pure `eventToVisual` mapper (IF-06-state-map).
 *
 * The new map is work-order-keyed (not agent-keyed). Events from the enriched
 * stream (`AgentWorking {role, wo, frd, phase, activity, mode}` + `HandoffWritten`,
 * `ContractPublished`, `SubagentStop`) map to a 10-member discriminated union.
 *
 * Event field mappings for new event kinds:
 *   HandoffWritten: wo = fromWo, session = toWo (dependent WO in Build Plan)
 *   ContractPublished: wo = the WO that published the contract
 *   SubagentStop: wo = the WO that stopped/closed
 *
 * Traceability:
 *   AC-06-001.1  — WHILE running implementer WO → one sprite in Sala de Forja (setWo 'building')
 *   AC-06-003.2  — WHEN WO transitions between rooms → animate move (setWo state transitions)
 *   AC-06-006.1  — WHEN WO closes with Status Note → parchment (startHandoff fromWo→toWo)
 *   AC-06-007.2  — relay steps sequential (advanceRelay per activity step)
 *   AC-06-007.3  — WHEN ContractPublished → contract hand-off (publishContract)
 *   AC-06-012.1  — WHEN WO reaches VERIFIED → achievement toast (verifyWo + fireAchievement)
 *
 * Pure module — no I/O, no DOM, no side-effects.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import {
  eventToVisual,
  type RelayStep,
  STATE_MAP_KNOWN_EVENTS,
  type VisualAction,
  type WoState,
} from "../state-map";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-06-18T10:00:00Z", ...partial };
}

// ---------------------------------------------------------------------------
// AgentWorking phase:'build' + wo → setWo(wo, 'building')  (AC-06-001.1)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: AgentWorking build phase → setWo 'building'", () => {
  it("WHEN AgentWorking has phase:'build' and wo THEN VisualAction is setWo 'building'", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-06-001",
      frd: "frd-06-party",
      phase: "build",
      mode: "powerful",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "setWo",
      wo: "WO-06-001",
      state: "building",
    });
  });

  it("WHEN AgentWorking has phase:'build' with different wo THEN setWo carries that wo", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-02-003",
      phase: "build",
      mode: "balanced",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("setWo");
    if (action.kind === "setWo") {
      expect(action.wo).toBe("WO-02-003");
      expect(action.state).toBe("building");
    }
  });

  it("WHEN AgentWorking has phase:'build' but no workOrder THEN returns noop (defensive)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      phase: "build",
      mode: "powerful",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN AgentWorking has phase:'review' THEN triggers openGate (not setWo building)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "reviewer",
      workOrder: "WO-06-001",
      phase: "review",
      mode: "powerful",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("openGate");
    expect(action.kind).not.toBe("setWo");
  });
});

// ---------------------------------------------------------------------------
// AgentWorking deep mode relay — advanceRelay (AC-06-007.2)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: AgentWorking deep mode → advanceRelay (AC-06-007.2)", () => {
  it("WHEN AgentWorking mode:'deep' activity:'test' THEN advanceRelay wo step 'test'", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-03-001",
      phase: "build",
      mode: "deep",
      activity: "test",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "advanceRelay",
      wo: "WO-03-001",
      step: "test" as RelayStep,
    });
  });

  it("WHEN AgentWorking mode:'deep' activity:'backend' THEN advanceRelay step 'backend'", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-03-002",
      phase: "build",
      mode: "deep",
      activity: "backend",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "advanceRelay",
      wo: "WO-03-002",
      step: "backend" as RelayStep,
    });
  });

  it("WHEN AgentWorking mode:'deep' activity:'frontend' THEN advanceRelay step 'frontend'", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-03-003",
      phase: "build",
      mode: "deep",
      activity: "frontend",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "advanceRelay",
      wo: "WO-03-003",
      step: "frontend" as RelayStep,
    });
  });

  it("WHEN AgentWorking mode:'deep' activity:'selftest' THEN returns setWo 'building' (no relay step for selftest)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-03-004",
      phase: "build",
      mode: "deep",
      activity: "selftest",
    });
    const action = eventToVisual(ev);
    // selftest is not a relay step (test/backend/frontend are the 3 relay steps)
    expect(action.kind).toBe("setWo");
    if (action.kind === "setWo") {
      expect(action.state).toBe("building");
    }
  });

  it("WHEN AgentWorking mode:'powerful' activity:'test' THEN setWo 'building' (not relay, non-deep)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-03-005",
      phase: "build",
      mode: "powerful",
      activity: "test",
    });
    const action = eventToVisual(ev);
    // relay only in deep mode
    expect(action.kind).toBe("setWo");
    if (action.kind === "setWo") {
      expect(action.state).toBe("building");
    }
  });

  it("WHEN AgentWorking mode:'deep' activity:'implement' THEN setWo 'building' (implement is not a relay step)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-04-001",
      phase: "build",
      mode: "deep",
      activity: "implement",
    });
    const action = eventToVisual(ev);
    // implement activity → not a relay-specific step; just building
    expect(action.kind).toBe("setWo");
  });
});

// ---------------------------------------------------------------------------
// HandoffWritten → startHandoff (parchment, AC-06-006.1)
// `session` carries the dependent WO (Build Plan dependency target)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: HandoffWritten → startHandoff parchment (AC-06-006.1)", () => {
  it("WHEN HandoffWritten {workOrder, session=toWo} THEN startHandoff fromWo→toWo", () => {
    const ev = makeEvent({
      event: "HandoffWritten",
      workOrder: "WO-06-001",
      session: "WO-06-002",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "startHandoff",
      fromWo: "WO-06-001",
      toWo: "WO-06-002",
    });
  });

  it("WHEN HandoffWritten has workOrder but no session THEN startHandoff with toWo undefined (edge case)", () => {
    const ev = makeEvent({
      event: "HandoffWritten",
      workOrder: "WO-06-003",
    });
    const action = eventToVisual(ev);
    // parchment travels to forge edge when no dependent WO in scene
    expect(action).toEqual<VisualAction>({
      kind: "startHandoff",
      fromWo: "WO-06-003",
      toWo: undefined,
    });
  });

  it("WHEN HandoffWritten has no workOrder THEN returns noop (defensive)", () => {
    const ev = makeEvent({
      event: "HandoffWritten",
      session: "WO-06-004",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("handoff carries the dependent WO as the parchment target (AC-06-006.1)", () => {
    const ev = makeEvent({
      event: "HandoffWritten",
      workOrder: "WO-01-001",
      session: "WO-01-002",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("startHandoff");
    if (action.kind === "startHandoff") {
      expect(action.fromWo).toBe("WO-01-001");
      expect(action.toWo).toBe("WO-01-002");
    }
  });

  it("parchment does NOT represent live chat — driven by HandoffWritten document event (AC-06-006.2)", () => {
    // The event kind MUST be HandoffWritten (artifact event), not a chat/message event
    const chatEv = makeEvent({ event: "message", agent: "implementer" });
    expect(eventToVisual(chatEv).kind).not.toBe("startHandoff");
    const handoffEv = makeEvent({
      event: "HandoffWritten",
      workOrder: "WO-06-001",
      session: "WO-06-002",
    });
    expect(eventToVisual(handoffEv).kind).toBe("startHandoff");
  });
});

// ---------------------------------------------------------------------------
// ContractPublished → publishContract (AC-06-007.3)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: ContractPublished → publishContract (AC-06-007.3)", () => {
  it("WHEN ContractPublished {workOrder} THEN publishContract(wo)", () => {
    const ev = makeEvent({
      event: "ContractPublished",
      workOrder: "WO-07-001",
      frd: "frd-07-config",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "publishContract",
      wo: "WO-07-001",
    });
  });

  it("WHEN ContractPublished has no workOrder THEN returns noop (defensive)", () => {
    const ev = makeEvent({
      event: "ContractPublished",
      frd: "frd-07-config",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("ContractPublished drives the 📄 contract hand-off between relay steps (AC-06-007.3)", () => {
    const ev = makeEvent({
      event: "ContractPublished",
      workOrder: "WO-07-002",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("publishContract");
    if (action.kind === "publishContract") {
      expect(action.wo).toBe("WO-07-002");
    }
  });
});

// ---------------------------------------------------------------------------
// phase:'review' → openGate (gate opens when all WOs IN_REVIEW)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: phase:'review' → openGate", () => {
  it("WHEN AgentWorking has phase:'review' THEN VisualAction is openGate", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "reviewer",
      phase: "review",
      mode: "powerful",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "openGate" });
  });

  it("openGate is fired regardless of which role triggers the review phase", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-01-001",
      phase: "review",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("openGate");
  });
});

// ---------------------------------------------------------------------------
// WO VERIFIED / SubagentStop → verifyWo + fireAchievement (AC-06-012.1)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: WO close → verifyWo + fireAchievement (AC-06-012.1)", () => {
  it("WHEN SubagentStop with workOrder THEN verifyWo(wo)", () => {
    const ev = makeEvent({
      event: "SubagentStop",
      workOrder: "WO-06-003",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "verifyWo",
      wo: "WO-06-003",
    });
  });

  it("WHEN SubagentStop has no workOrder THEN returns noop (defensive)", () => {
    const ev = makeEvent({ event: "SubagentStop" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN achievement event with workOrder THEN fireAchievement(wo) (AC-06-012.1)", () => {
    const ev = makeEvent({
      event: "achievement",
      workOrder: "WO-06-003",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "fireAchievement",
      wo: "WO-06-003",
    });
  });

  it("WHEN achievement event with no workOrder THEN fireAchievement with wo undefined", () => {
    const ev = makeEvent({ event: "achievement" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "fireAchievement",
      wo: undefined,
    });
  });

  it("achievement fires toast ('¡Logro desbloqueado!') — fireAchievement is the signal (AC-06-012.1)", () => {
    const ev = makeEvent({
      event: "achievement",
      workOrder: "WO-12-001",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("fireAchievement");
    if (action.kind === "fireAchievement") {
      expect(action.wo).toBe("WO-12-001");
    }
  });
});

// ---------------------------------------------------------------------------
// Failure → downSprite — first-class, never filtered (AC-06-012.1 + FRD spec)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: failure is first-class — downSprite (never filtered)", () => {
  it("WHEN event has status:'fail' THEN downSprite(wo)", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      workOrder: "WO-01-001",
      status: "fail",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      wo: "WO-01-001",
    });
  });

  it("WHEN event is test_fail THEN downSprite(wo if present)", () => {
    const ev = makeEvent({
      event: "test_fail",
      workOrder: "WO-02-001",
    });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      wo: "WO-02-001",
    });
  });

  it("WHEN test_fail with no workOrder THEN downSprite wo undefined", () => {
    const ev = makeEvent({ event: "test_fail" });
    const action = eventToVisual(ev);
    expect(action).toEqual<VisualAction>({
      kind: "downSprite",
      wo: undefined,
    });
  });

  it("failure overrides build semantics — status:fail on AgentWorking gives downSprite not setWo", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      role: "implementer",
      workOrder: "WO-05-001",
      phase: "build",
      mode: "powerful",
      status: "fail",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("downSprite");
    expect(action.kind).not.toBe("setWo");
  });

  it("failure is never filtered — downSprite returned even when other fields present", () => {
    const ev = makeEvent({
      event: "test_fail",
      workOrder: "WO-05-001",
      status: "fail",
      frd: "frd-05",
    });
    const action = eventToVisual(ev);
    expect(action.kind).toBe("downSprite");
  });
});

// ---------------------------------------------------------------------------
// Unknown event → safe noop (defensive)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: unknown event → defensive noop", () => {
  it("WHEN event type is unknown THEN returns noop without throwing", () => {
    const ev = makeEvent({ event: "unknown_event_type" });
    expect(() => eventToVisual(ev)).not.toThrow();
    expect(eventToVisual(ev)).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN event type is empty string THEN returns noop without throwing", () => {
    const ev = makeEvent({ event: "" });
    expect(() => eventToVisual(ev)).not.toThrow();
    expect(eventToVisual(ev)).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN event type is prototype property name THEN noop (prototype-pollution guard)", () => {
    const ev = makeEvent({ event: "constructor" });
    expect(() => eventToVisual(ev)).not.toThrow();
    expect(eventToVisual(ev)).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN event has no workOrder and unknown type THEN noop", () => {
    const ev = makeEvent({ event: "read", agent: "implementer" });
    expect(eventToVisual(ev)).toEqual<VisualAction>({ kind: "noop" });
  });

  it("WHEN old 'start' event type used THEN noop (old vocab deprecated)", () => {
    // Old events that used start/end/blocked/review are no longer meaningful
    const ev = makeEvent({ event: "start", agent: "backend-dev" });
    const action = eventToVisual(ev);
    // 'start' is not in the new vocabulary → noop
    expect(action).toEqual<VisualAction>({ kind: "noop" });
  });
});

// ---------------------------------------------------------------------------
// Idempotency — pure function (no hidden state)
// ---------------------------------------------------------------------------

describe("frd-06 wave2: idempotency (pure function)", () => {
  it("WHEN eventToVisual is called twice with same event THEN results are equal", () => {
    const ev = makeEvent({
      event: "AgentWorking",
      workOrder: "WO-01-001",
      phase: "build",
      mode: "powerful",
    });
    expect(eventToVisual(ev)).toEqual(eventToVisual(ev));
  });

  it("WHEN HandoffWritten called twice THEN results are deterministic", () => {
    const ev = makeEvent({
      event: "HandoffWritten",
      workOrder: "WO-01-001",
      session: "WO-01-002",
    });
    expect(eventToVisual(ev)).toEqual(eventToVisual(ev));
  });

  it("never throws for any input (total function)", () => {
    const events: DashboardEvent[] = [
      makeEvent({
        event: "AgentWorking",
        workOrder: "WO-01",
        phase: "build",
        mode: "deep",
        activity: "test",
      }),
      makeEvent({ event: "HandoffWritten", workOrder: "WO-01", session: "WO-02" }),
      makeEvent({ event: "ContractPublished", workOrder: "WO-01" }),
      makeEvent({ event: "SubagentStop", workOrder: "WO-01" }),
      makeEvent({ event: "achievement", workOrder: "WO-01" }),
      makeEvent({ event: "test_fail", workOrder: "WO-01" }),
      makeEvent({ event: "AgentWorking", phase: "review" }),
      makeEvent({ event: "totally-unknown" }),
    ];
    for (const ev of events) {
      expect(() => eventToVisual(ev)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// STATE_MAP_KNOWN_EVENTS — the set of event types with visual meaning
// ---------------------------------------------------------------------------

describe("frd-06 wave2: STATE_MAP_KNOWN_EVENTS set", () => {
  it("includes AgentWorking", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("AgentWorking")).toBe(true);
  });

  it("includes HandoffWritten", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("HandoffWritten")).toBe(true);
  });

  it("includes ContractPublished", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("ContractPublished")).toBe(true);
  });

  it("includes SubagentStop", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("SubagentStop")).toBe(true);
  });

  it("includes achievement", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("achievement")).toBe(true);
  });

  it("includes test_fail", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("test_fail")).toBe(true);
  });

  it("does NOT include old deprecated event types (start/end/handoff/blocked/review)", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("start")).toBe(false);
    expect(STATE_MAP_KNOWN_EVENTS.has("end")).toBe(false);
    expect(STATE_MAP_KNOWN_EVENTS.has("handoff")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WoState type — exported states
// ---------------------------------------------------------------------------

describe("frd-06 wave2: WoState and RelayStep types are exported", () => {
  it("WoState 'building' is a valid state", () => {
    const state: WoState = "building";
    expect(state).toBe("building");
  });

  it("WoState 'in_review' is a valid state", () => {
    const state: WoState = "in_review";
    expect(state).toBe("in_review");
  });

  it("RelayStep 'test' is a valid step", () => {
    const step: RelayStep = "test";
    expect(step).toBe("test");
  });
});
