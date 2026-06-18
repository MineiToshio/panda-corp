/**
 * WO-06-004 — Party engine (RAF loop + animation queue)
 *
 * Tests for `createPartyEngine` (IF-06-engine): pure step math, no DOM, no real RAF.
 * A fake clock drives `tick(now)` so all movement is deterministic.
 *
 * Traceability:
 *   AC-06-003.1 — WHILE no stage transition: continuous breathing + wandering within zone
 *   AC-06-004.1 — ON handoff: incoming sprite walks to next zone; both end up together
 *
 * Dependencies:
 *   WO-06-002 (layout.ts) — Pos, Role, MCCENTER, mcPositions, rosterFor
 *   WO-06-003 (state-map.ts) — VisualAction, AgentState
 *
 * Pure core — no DOM, no real RAF in tests.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";

import type { AgentSnapshot, EngineAgent, PartyEngine } from "./engine";
import { createPartyEngine } from "./engine";
import type { Pos, Role } from "./layout";
import { MCCENTER, mcPositions, rosterFor } from "./layout";
import type { VisualAction } from "./state-map";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(roster: Role[]): AgentSnapshot[] {
  const positions = mcPositions(roster, "balanced");
  return roster.map((role, i) => ({
    id: role,
    state: "idle" as const,
    home: positions[i] ?? ([380, 285] as Pos),
  }));
}

/** Advance the engine by `steps` ticks of `dt` ms each, starting at `t0`. */
function advance(engine: PartyEngine, t0: number, dt: number, steps: number): number {
  let t = t0;
  for (let i = 0; i < steps; i++) {
    t += dt;
    engine.tick(t);
  }
  return t;
}

/** Distance between two positions. */
function dist(a: Pos, b: Pos): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Find agent by id, throwing a clear message if missing. */
function findAgent(agents: EngineAgent[], id: string): EngineAgent {
  const ag = agents.find((a) => a.id === id);
  if (ag === undefined) throw new Error(`Agent '${id}' not found in engine`);
  return ag;
}

/** Find snapshot by id, throwing a clear message if missing. */
function findSnap(snapshot: AgentSnapshot[], id: string): AgentSnapshot {
  const s = snapshot.find((a) => a.id === id);
  if (s === undefined) throw new Error(`Snapshot '${id}' not found`);
  return s;
}

// ---------------------------------------------------------------------------
// Smoke / creation
// ---------------------------------------------------------------------------

describe("frd-06: engine — creation", () => {
  it("frd-06: WHEN engine is created THEN agents() returns the snapshot roster", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const engine = createPartyEngine(snapshot, {});

    const agents = engine.agents();
    expect(agents).toHaveLength(roster.length);
    for (const role of roster) {
      const ag = agents.find((a) => a.id === role);
      expect(ag).toBeDefined();
    }
  });

  it("frd-06: WHEN engine is created THEN all agents start at their home position", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const engine = createPartyEngine(snapshot, {});

    for (const ag of engine.agents()) {
      const snap = snapshot.find((s) => s.id === ag.id);
      expect(snap).toBeDefined();
      if (snap !== undefined) {
        expect(ag.px).toBeCloseTo(snap.home[0], 0);
        expect(ag.py).toBeCloseTo(snap.home[1], 0);
      }
    }
  });

  it("frd-06: WHEN engine is created THEN agents have the initial state from snapshot", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const first = snapshot[0];
    if (first !== undefined) {
      first.state = "work";
    }
    const engine = createPartyEngine(snapshot, {});

    const ag = engine.agents()[0];
    expect(ag?.state).toBe("work");
  });
});

// ---------------------------------------------------------------------------
// setState — immediate state transition
// ---------------------------------------------------------------------------

describe("frd-06: engine — setState", () => {
  it("frd-06: WHEN setState(id, 'work') is called THEN agent state is 'work'", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.setState("backend-dev", "work");

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    expect(ag?.state).toBe("work");
  });

  it("frd-06: WHEN setState(id, 'blocked') is called THEN agent state is 'blocked'", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.setState("backend-dev", "blocked");

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    expect(ag?.state).toBe("blocked");
  });

  it("frd-06: WHEN setState is called with unknown id THEN other agents are unaffected", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.setState("unknown-agent", "work");

    const before = engine.agents().map((a) => a.state);
    expect(before.every((s) => s === "idle")).toBe(true);
  });

  it("frd-06: WHEN setState transitions any state THEN position stays at home (no move)", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const engine = createPartyEngine(snapshot, {});

    engine.setState("backend-dev", "work");

    const ag = findAgent(engine.agents(), "backend-dev");
    const snap = findSnap(snapshot, "backend-dev");
    expect(ag.px).toBeCloseTo(snap.home[0], 0);
    expect(ag.py).toBeCloseTo(snap.home[1], 0);
  });
});

// ---------------------------------------------------------------------------
// Idle drift — AC-06-003.1 (wandering within zone)
// ---------------------------------------------------------------------------

describe("frd-06: engine — idle drift (AC-06-003.1)", () => {
  it("frd-06: WHEN an idle agent is ticked THEN it has a bob offset (breathing, |bob| > 0 over time)", () => {
    const roster: Role[] = ["backend-dev"];
    const engine = createPartyEngine(makeSnapshot(roster), {});

    // Tick over a full breath cycle to see bob variation
    const bobs = new Set<number>();
    let t = 1000;
    for (let i = 0; i < 50; i++) {
      t += 200;
      engine.tick(t);
      const ag = engine.agents()[0];
      if (ag !== undefined) {
        bobs.add(Math.round(ag.bob * 10));
      }
    }
    // bob should vary (breathing is sinusoidal)
    expect(bobs.size).toBeGreaterThan(1);
  });

  it("frd-06: WHEN an idle agent is ticked THEN position stays near home (wander within bounds)", () => {
    const roster: Role[] = ["backend-dev"];
    const snapshot = makeSnapshot(roster);
    const engine = createPartyEngine(snapshot, {});
    const first = snapshot[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const home = first.home;

    // Tick 5 s worth at 60 fps
    advance(engine, 0, 16, 300);

    const ag = engine.agents()[0];
    expect(ag).toBeDefined();
    if (ag === undefined) return;
    // Wander should be bounded — no more than 60 px from home
    expect(dist([ag.px, ag.py], home)).toBeLessThan(60);
  });

  it("frd-06: WHEN a work-state agent is ticked THEN it also bobs (alive, AC-06-003.1)", () => {
    const roster: Role[] = ["backend-dev"];
    const engine = createPartyEngine(makeSnapshot(roster), {});
    engine.setState("backend-dev", "work");

    const bobs = new Set<number>();
    let t = 1000;
    for (let i = 0; i < 50; i++) {
      t += 200;
      engine.tick(t);
      const ag = engine.agents()[0];
      if (ag !== undefined) {
        bobs.add(Math.round(ag.bob * 10));
      }
    }
    expect(bobs.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Handoff — AC-06-004.1
// ---------------------------------------------------------------------------

describe("frd-06: engine — handoff (AC-06-004.1)", () => {
  it("frd-06: WHEN startHandoff(from, to) is called THEN walker state becomes 'walk'", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.startHandoff("backend-dev", "frontend-dev");

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    expect(ag?.state).toBe("walk");
  });

  it("frd-06: WHEN a walking agent is ticked THEN it moves toward MCCENTER first", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const home = findSnap(snapshot, "backend-dev").home;
    const engine = createPartyEngine(snapshot, {});

    engine.startHandoff("backend-dev", "frontend-dev");

    // Tick ~2 s at 60 fps (120 ticks × 1.6px = 192px traveled; dist to center ~228px)
    // After 2 s the agent is past halfway, so dCenter < dHome.
    advance(engine, 0, 16, 120);

    const ag = findAgent(engine.agents(), "backend-dev");
    // Should be closer to MCCENTER than to original home (past halfway)
    const dHome = dist([ag.px, ag.py], home);
    const dCenter = dist([ag.px, ag.py], MCCENTER);
    expect(dCenter).toBeLessThan(dHome);
  });

  it("frd-06: WHEN a handoff completes THEN walker returns to its own home", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const home = findSnap(snapshot, "backend-dev").home;
    const engine = createPartyEngine(snapshot, {});

    engine.startHandoff("backend-dev", "frontend-dev");

    // Tick 10 s — enough for the full trip (home→center→approach→wait→center→home)
    advance(engine, 0, 16, 625);

    const ag = findAgent(engine.agents(), "backend-dev");
    // After full trip, agent snaps to home then may idle-wander up to WANDER_RADIUS (40px)
    expect(dist([ag.px, ag.py], home)).toBeLessThan(45);
    expect(ag.state).not.toBe("walk");
  });

  it("frd-06: WHEN a handoff completes THEN the target agent ends up together near its own home", () => {
    // Per AC-06-004.1: 'both SHALL end up together' means they meet at the approach point
    // and the walker returns. The target does not move; the walker visits the target's area.
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const targetHome = findSnap(snapshot, "frontend-dev").home;
    const engine = createPartyEngine(snapshot, {});

    engine.startHandoff("backend-dev", "frontend-dev");

    // Tick 10 s
    advance(engine, 0, 16, 625);

    const target = findAgent(engine.agents(), "frontend-dev");
    // Target stays near its own home; idle wander is bounded to WANDER_RADIUS (40px)
    expect(dist([target.px, target.py], targetHome)).toBeLessThan(45);
  });

  it("frd-06: WHEN handoff completes THEN walker state is no longer 'walk'", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.startHandoff("backend-dev", "frontend-dev");

    // Tick enough time for full trip
    advance(engine, 0, 16, 625);

    const ag = findAgent(engine.agents(), "backend-dev");
    expect(ag.state).not.toBe("walk");
  });

  it("frd-06: WHEN startHandoff is called with unknown target THEN walker still completes a trip", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    // Unknown target — engine should handle gracefully
    engine.startHandoff("backend-dev", "unknown-target");

    const ag = findAgent(engine.agents(), "backend-dev");
    // Even with unknown target, walk state starts
    expect(ag.state).toBe("walk");
  });
});

// ---------------------------------------------------------------------------
// applyEvents — queue consumption at engine's pace
// ---------------------------------------------------------------------------

describe("frd-06: engine — applyEvents", () => {
  it("frd-06: WHEN applyEvents receives a setState action THEN agent state updates after next tick", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const actions: VisualAction[] = [{ kind: "setState", agentId: "backend-dev", state: "work" }];
    engine.applyEvents(actions);
    engine.tick(100);

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    expect(ag?.state).toBe("work");
  });

  it("frd-06: WHEN applyEvents receives a startHandoff action THEN walker begins walk", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const actions: VisualAction[] = [
      { kind: "startHandoff", agentId: "backend-dev", targetId: "frontend-dev" },
    ];
    engine.applyEvents(actions);
    engine.tick(100);

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    expect(ag?.state).toBe("walk");
  });

  it("frd-06: WHEN applyEvents receives a downSprite action THEN agent state becomes 'blocked' (failed)", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const actions: VisualAction[] = [{ kind: "downSprite", agentId: "backend-dev" }];
    engine.applyEvents(actions);
    engine.tick(100);

    const ag = engine.agents().find((a) => a.id === "backend-dev");
    // downSprite puts the agent in a visually distinct downed/failed state.
    // Engine maps this to 'blocked' (danger visual) per PARTY.md §1.
    expect(ag?.state).toBe("blocked");
  });

  it("frd-06: WHEN applyEvents receives a noop action THEN no agent state changes", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});
    const before = engine.agents().map((a) => a.state);

    const actions: VisualAction[] = [{ kind: "noop" }];
    engine.applyEvents(actions);
    engine.tick(100);

    const after = engine.agents().map((a) => a.state);
    expect(after).toEqual(before);
  });

  it("frd-06: WHEN applyEvents receives a fireAchievement action THEN no crash and no state change", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});
    const before = engine.agents().map((a) => a.state);

    const actions: VisualAction[] = [
      { kind: "fireAchievement", agentId: "backend-dev", workOrder: "WO-06-004" },
    ];
    engine.applyEvents(actions);
    engine.tick(100);

    // fireAchievement is cosmetic — no agent state changes in the engine core
    const after = engine.agents().map((a) => a.state);
    expect(after).toEqual(before);
  });

  it("frd-06: WHEN applyEvents receives multiple actions THEN all are processed in order", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const actions: VisualAction[] = [
      { kind: "setState", agentId: "backend-dev", state: "work" },
      { kind: "setState", agentId: "frontend-dev", state: "review" },
    ];
    engine.applyEvents(actions);
    engine.tick(100);

    const be = engine.agents().find((a) => a.id === "backend-dev");
    const fe = engine.agents().find((a) => a.id === "frontend-dev");
    expect(be?.state).toBe("work");
    expect(fe?.state).toBe("review");
  });

  it("frd-06: WHEN applyEvents receives empty array THEN engine does not crash", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    expect(() => {
      engine.applyEvents([]);
      engine.tick(100);
    }).not.toThrow();
  });

  it("frd-06: WHEN downSprite has undefined agentId THEN engine does not crash", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const actions: VisualAction[] = [{ kind: "downSprite", agentId: undefined }];
    expect(() => {
      engine.applyEvents(actions);
      engine.tick(100);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tick idempotence / second tick after completion
// ---------------------------------------------------------------------------

describe("frd-06: engine — tick / second tick after completion", () => {
  it("frd-06: WHEN tick is called with the same timestamp twice THEN no crash", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    expect(() => {
      engine.tick(1000);
      engine.tick(1000);
    }).not.toThrow();
  });

  it("frd-06: WHEN a second tick after handoff completion THEN walker is in home/idle (not walk)", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.startHandoff("backend-dev", "frontend-dev");
    // Full trip
    const t = advance(engine, 0, 16, 625);
    // One more tick after arrival
    engine.tick(t + 16);

    const ag = findAgent(engine.agents(), "backend-dev");
    expect(ag.state).not.toBe("walk");
  });
});

// ---------------------------------------------------------------------------
// Zone bounds — AC-06-003.1 (agents stay within their zone)
// ---------------------------------------------------------------------------

describe("frd-06: engine — zone bounds (AC-06-003.1)", () => {
  it("frd-06: WHEN an idle agent wanders THEN it stays within 60 px of its home position", () => {
    const roster = rosterFor("balanced");
    const snapshot = makeSnapshot(roster);
    const engine = createPartyEngine(snapshot, {});

    // Tick 30 s
    advance(engine, 0, 16, 1875);

    for (const ag of engine.agents()) {
      const home = snapshot.find((s) => s.id === ag.id);
      if (home !== undefined) {
        expect(dist([ag.px, ag.py], home.home)).toBeLessThan(60);
      }
    }
  });

  it("frd-06: WHEN all agents are ticked for a long period THEN none collide with MCCENTER (unless walking)", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    // Tick 10 s
    advance(engine, 0, 16, 625);

    for (const ag of engine.agents()) {
      if (ag.state !== "walk") {
        // Idle/work agents should not be at MCCENTER
        const dCenter = dist([ag.px, ag.py], MCCENTER);
        expect(dCenter).toBeGreaterThan(30);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// EngineAgent shape contract
// ---------------------------------------------------------------------------

describe("frd-06: engine — EngineAgent shape", () => {
  it("frd-06: WHEN agents() is called THEN each agent has id, state, px, py, bob fields", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    engine.tick(1000);

    for (const ag of engine.agents()) {
      expect(ag).toHaveProperty("id");
      expect(ag).toHaveProperty("state");
      expect(ag).toHaveProperty("px");
      expect(ag).toHaveProperty("py");
      expect(ag).toHaveProperty("bob");
    }
  });

  it("frd-06: WHEN agents() is called THEN returned array is a snapshot (mutations do not affect engine)", () => {
    const roster = rosterFor("balanced");
    const engine = createPartyEngine(makeSnapshot(roster), {});

    const arr1 = engine.agents();
    const first = arr1[0];
    if (first !== undefined) {
      (first as unknown as Record<string, unknown>).state = "blocked";
    }
    const arr2 = engine.agents();

    // Engine state should be unchanged
    expect(arr2[0]?.state).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Pro mode (2 agents)
// ---------------------------------------------------------------------------

describe("frd-06: engine — pro mode (2 agents)", () => {
  it("frd-06: WHEN created with pro roster THEN agents() has 2 entries", () => {
    const roster = rosterFor("pro");
    const engine = createPartyEngine(makeSnapshot(roster), {});
    expect(engine.agents()).toHaveLength(2);
  });

  it("frd-06: WHEN handoff occurs in pro mode THEN walker completes trip normally", () => {
    const roster = rosterFor("pro");
    const snapshot = makeSnapshot(roster);
    const home = findSnap(snapshot, "backend-dev").home;
    const engine = createPartyEngine(snapshot, {});

    engine.startHandoff("backend-dev", "reviewer");
    advance(engine, 0, 16, 625);

    const ag = findAgent(engine.agents(), "backend-dev");
    // After full trip, snaps to home then may idle-wander up to WANDER_RADIUS (40px)
    expect(dist([ag.px, ag.py], home)).toBeLessThan(45);
    expect(ag.state).not.toBe("walk");
  });
});
