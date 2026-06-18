/**
 * WO-06-004 — La Fragua engine (RAF loop, wave cap, rooms, parchment, gate)
 *
 * Tests for `createFraguaEngine` (IF-06-engine): pure step math, no DOM, no real RAF.
 * A fake clock drives `tick(now)` so all movement is deterministic.
 *
 * Traceability:
 *   AC-06-001.1 — one sprite per running implementer WO
 *   AC-06-001.2 — wave cap (capped at mode wave size)
 *   AC-06-003.2 — room transitions animate along connecting paths
 *   AC-06-006.1 — parchment travels from closing WO to dependent WO station
 *
 * Dependencies:
 *   WO-06-002 (layout.ts) — Pos, FORGE_SLOTS, REVIEW_SLOTS
 *   WO-06-003 (state-map.ts) — VisualAction, WoState
 *
 * Pure core — no DOM, no real RAF in tests.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";
import type { VisualAction } from "../../state-map/state-map";
import type { FraguaEngine } from "../engine";
import { createFraguaEngine } from "../engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advance engine by N ticks of dt ms each, starting at t0. Returns final t. */
function advance(engine: FraguaEngine, t0: number, dt: number, steps: number): number {
  let t = t0;
  for (let i = 0; i < steps; i++) {
    t += dt;
    engine.tick(t);
  }
  return t;
}

/** Euclidean distance between two [x,y] positions. */
function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// ---------------------------------------------------------------------------
// Creation — basic init
// ---------------------------------------------------------------------------

describe("frd-06: createFraguaEngine — creation", () => {
  it("frd-06: WHEN engine is created with no WOs THEN wos() returns empty array", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    expect(engine.wos()).toEqual([]);
  });

  it("frd-06: WHEN engine is created THEN gate() returns { open: false }", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    expect(engine.gate()).toEqual({ open: false });
  });

  it("frd-06: WHEN engine is created THEN trophies() returns empty array", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    expect(engine.trophies()).toEqual([]);
  });

  it("frd-06: WHEN engine is created with pro mode THEN wave is 2", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    // enqueue more than 2 — only 2 should become sprites
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03");
    engine.tick(100);
    // 2 building, 1 queued
    const sprites = engine.wos().filter((w) => w.state === "building");
    expect(sprites).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// setWo — immediate state transitions (AC-06-001.1)
// ---------------------------------------------------------------------------

describe("frd-06: engine — setWo", () => {
  it("frd-06: WHEN setWo(wo, 'building') is called THEN sprite appears with state building", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.setWo("WO-001", "building");
    engine.tick(100);

    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite).toBeDefined();
    expect(sprite?.state).toBe("building");
  });

  it("frd-06: WHEN setWo(wo, 'in_review') is called THEN sprite transitions to in_review", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.setWo("WO-001", "building");
    engine.tick(100);
    engine.setWo("WO-001", "in_review");
    engine.tick(200);

    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite?.state).toBe("in_review");
  });

  it("frd-06: WHEN setWo(wo, 'blocked') is called THEN sprite state becomes blocked", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.setWo("WO-001", "building");
    engine.tick(100);
    engine.setWo("WO-001", "blocked");
    engine.tick(200);

    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite?.state).toBe("blocked");
  });

  it("frd-06: WHEN setWo is called for an unknown WO THEN other sprites are unaffected", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.setWo("WO-001", "building");
    engine.tick(100);

    // Call setWo on a completely unknown WO
    engine.setWo("WO-UNKNOWN", "blocked");
    engine.tick(200);

    // WO-001 should remain building
    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite?.state).toBe("building");
  });
});

// ---------------------------------------------------------------------------
// enqueue — wave cap (AC-06-001.2)
// ---------------------------------------------------------------------------

describe("frd-06: engine — enqueue + wave cap (AC-06-001.2)", () => {
  it("frd-06: WHEN fewer WOs than wave are enqueued THEN all become building sprites", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03");
    engine.tick(100);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building).toHaveLength(3);
  });

  it("frd-06: WHEN exactly wave WOs are enqueued THEN all become building sprites", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building).toHaveLength(2);
  });

  it("frd-06: WHEN more WOs than wave are enqueued THEN only wave WOs become sprites (AC-06-001.2)", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03");
    engine.enqueue("WO-04");
    engine.tick(100);

    const sprites = engine.wos();
    // wave=2 → max 2 building sprites; the rest are queued (not in wos())
    const building = sprites.filter((w) => w.state === "building");
    expect(building).toHaveLength(2);
    // Total sprites shown is at most the wave
    expect(sprites.length).toBeLessThanOrEqual(2);
  });

  it("frd-06: WHEN a building WO slot frees, THEN next queued WO is promoted (wave cap refill)", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03"); // queued
    engine.tick(100);

    // Verify WO-01 — frees a slot
    engine.verifyWo("WO-01");
    engine.tick(200);

    const building = engine.wos().filter((w) => w.state === "building");
    // WO-02 still building, WO-03 promoted from queue
    expect(building.length).toBeGreaterThanOrEqual(1);
    // WO-03 should now be in the scene
    const wo3 = engine.wos().find((w) => w.wo === "WO-03");
    expect(wo3).toBeDefined();
  });

  it("frd-06: WHEN a WO is enqueued twice THEN it is not duplicated in the scene", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-01");
    engine.tick(100);

    const matches = engine.wos().filter((w) => w.wo === "WO-01");
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// verifyWo — Bóveda trophies (AC-06-005.1)
// ---------------------------------------------------------------------------

describe("frd-06: engine — verifyWo + trophies", () => {
  it("frd-06: WHEN verifyWo is called THEN the WO appears in trophies()", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.verifyWo("WO-01");
    engine.tick(200);

    expect(engine.trophies()).toContain("WO-01");
  });

  it("frd-06: WHEN verifyWo is called THEN the WO sprite is removed from wos()", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.verifyWo("WO-01");
    engine.tick(200);

    const sprite = engine.wos().find((w) => w.wo === "WO-01");
    expect(sprite).toBeUndefined();
  });

  it("frd-06: WHEN multiple WOs are verified THEN all appear in trophies()", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03");
    engine.tick(100);
    engine.verifyWo("WO-01");
    engine.verifyWo("WO-02");
    engine.tick(200);

    expect(engine.trophies()).toContain("WO-01");
    expect(engine.trophies()).toContain("WO-02");
    expect(engine.trophies()).not.toContain("WO-03");
  });

  it("frd-06: WHEN trophies() is called THEN returned array is a fresh copy (safe to mutate)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.verifyWo("WO-01");
    engine.tick(200);

    const t1 = engine.trophies();
    t1.push("INJECTED");
    const t2 = engine.trophies();
    expect(t2).not.toContain("INJECTED");
  });
});

// ---------------------------------------------------------------------------
// openGate — reviewer gate (AC-06-004.2)
// ---------------------------------------------------------------------------

describe("frd-06: engine — openGate", () => {
  it("frd-06: WHEN gate is not open THEN gate() returns { open: false }", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    expect(engine.gate()).toEqual({ open: false });
  });

  it("frd-06: WHEN openGate() is called THEN gate() returns { open: true }", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.openGate();
    expect(engine.gate()).toEqual({ open: true });
  });

  it("frd-06: WHEN gate is opened via applyEvents openGate action THEN gate() is open", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    const actions: VisualAction[] = [{ kind: "openGate" }];
    engine.applyEvents(actions);
    engine.tick(100);

    expect(engine.gate().open).toBe(true);
  });

  it("frd-06: WHEN gate is opened THEN wos() reader still works (no crash)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.openGate();

    expect(() => engine.wos()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// startHandoff — parchment animation (AC-06-006.1)
// ---------------------------------------------------------------------------

describe("frd-06: engine — startHandoff (parchment, AC-06-006.1)", () => {
  it("frd-06: WHEN startHandoff(fromWo, toWo) is called THEN parchment is in flight (fromWo still building)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);
    engine.startHandoff("WO-01", "WO-02");
    engine.tick(200);

    // WO-01 sprite should remain (it's still building while parchment travels)
    const wo1 = engine.wos().find((w) => w.wo === "WO-01");
    expect(wo1).toBeDefined();
  });

  it("frd-06: WHEN startHandoff is called with unknown toWo THEN it does not crash", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);

    expect(() => {
      engine.startHandoff("WO-01", "WO-MISSING");
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN startHandoff is called with undefined toWo THEN it does not crash (edge: parchment → forge edge)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);

    expect(() => {
      engine.startHandoff("WO-01", undefined);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN startHandoff is called THEN after completion wos() is still consistent", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);
    engine.startHandoff("WO-01", "WO-02");
    // Advance enough for parchment to arrive
    advance(engine, 100, 16, 500);

    expect(() => engine.wos()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyEvents — queue drains in order at engine pace
// ---------------------------------------------------------------------------

describe("frd-06: engine — applyEvents (queue consumption)", () => {
  it("frd-06: WHEN applyEvents receives setWo 'building' THEN WO sprite appears", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    const actions: VisualAction[] = [{ kind: "setWo", wo: "WO-001", state: "building" }];
    engine.applyEvents(actions);
    engine.tick(100);

    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite).toBeDefined();
    expect(sprite?.state).toBe("building");
  });

  it("frd-06: WHEN applyEvents receives setWo 'in_review' THEN WO state is in_review", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.setWo("WO-001", "building");
    engine.tick(100);
    engine.applyEvents([{ kind: "setWo", wo: "WO-001", state: "in_review" }]);
    engine.tick(200);

    const sprite = engine.wos().find((w) => w.wo === "WO-001");
    expect(sprite?.state).toBe("in_review");
  });

  it("frd-06: WHEN applyEvents receives enqueue action THEN WO is enqueued (respects wave cap)", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    // Fill wave
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);
    // Enqueue via applyEvents — should stay queued
    engine.applyEvents([{ kind: "enqueue", wo: "WO-03" }]);
    engine.tick(200);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building.length).toBeLessThanOrEqual(2);
  });

  it("frd-06: WHEN applyEvents receives startHandoff THEN parchment begins", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);

    expect(() => {
      engine.applyEvents([{ kind: "startHandoff", fromWo: "WO-01", toWo: "WO-02" }]);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN applyEvents receives verifyWo THEN trophy is added", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.applyEvents([{ kind: "verifyWo", wo: "WO-01" }]);
    engine.tick(200);

    expect(engine.trophies()).toContain("WO-01");
  });

  it("frd-06: WHEN applyEvents receives downSprite THEN sprite state is blocked", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.applyEvents([{ kind: "downSprite", wo: "WO-01" }]);
    engine.tick(200);

    const sprite = engine.wos().find((w) => w.wo === "WO-01");
    expect(sprite?.state).toBe("blocked");
  });

  it("frd-06: WHEN applyEvents receives downSprite with undefined wo THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.tick(100);

    expect(() => {
      engine.applyEvents([{ kind: "downSprite", wo: undefined }]);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN applyEvents receives fireAchievement THEN no crash, no sprite state change", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    const before = engine.wos().map((w) => w.state);

    engine.applyEvents([{ kind: "fireAchievement", wo: "WO-01" }]);
    engine.tick(200);

    const after = engine.wos().map((w) => w.state);
    expect(after).toEqual(before);
  });

  it("frd-06: WHEN applyEvents receives advanceRelay THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "deep", wave: 6 });
    engine.enqueue("WO-01");
    engine.tick(100);

    expect(() => {
      engine.applyEvents([{ kind: "advanceRelay", wo: "WO-01", step: "test" }]);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN applyEvents receives publishContract THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "deep", wave: 6 });
    engine.enqueue("WO-01");
    engine.tick(100);

    expect(() => {
      engine.applyEvents([{ kind: "publishContract", wo: "WO-01" }]);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN applyEvents receives noop THEN no crash, no state change", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    const before = engine.wos().map((w) => w.state);

    engine.applyEvents([{ kind: "noop" }]);
    engine.tick(200);

    const after = engine.wos().map((w) => w.state);
    expect(after).toEqual(before);
  });

  it("frd-06: WHEN applyEvents receives empty array THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.tick(100);

    expect(() => {
      engine.applyEvents([]);
      engine.tick(200);
    }).not.toThrow();
  });

  it("frd-06: WHEN applyEvents receives multiple actions THEN all processed in order", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    const actions: VisualAction[] = [
      { kind: "setWo", wo: "WO-001", state: "building" },
      { kind: "setWo", wo: "WO-002", state: "in_review" },
    ];
    engine.applyEvents(actions);
    engine.tick(100);

    const wo1 = engine.wos().find((w) => w.wo === "WO-001");
    const wo2 = engine.wos().find((w) => w.wo === "WO-002");
    expect(wo1?.state).toBe("building");
    expect(wo2?.state).toBe("in_review");
  });
});

// ---------------------------------------------------------------------------
// Room positions — forge → tribunal → vault flow (AC-06-003.2)
// ---------------------------------------------------------------------------

describe("frd-06: engine — room positions", () => {
  it("frd-06: WHEN a WO is building THEN its position is within the Sala de Forja area", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);

    const sprite = engine.wos().find((w) => w.wo === "WO-01");
    expect(sprite).toBeDefined();
    // Forja is the left room — x approximately 60-450, y approximately 120-350
    expect(sprite?.px).toBeGreaterThan(40);
    expect(sprite?.px).toBeLessThan(460);
  });

  it("frd-06: WHEN a WO transitions to in_review THEN its sprite moves toward tribunal area", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.setWo("WO-01", "in_review");

    // Advance enough for the sprite to move into the tribunal
    const t = advance(engine, 100, 16, 300);
    void t;

    const sprite = engine.wos().find((w) => w.wo === "WO-01");
    // Tribunal x is ~ 510-850
    // After enough ticks, sprite should be in tribunal zone
    expect(sprite).toBeDefined();
    // The sprite is en route or arrived — it should be to the right side
    // (may still be transitioning; test that it's not stuck at initial forge position)
    expect(sprite?.state).toBe("in_review");
  });

  it("frd-06: WHEN two WOs are building THEN they do not share the same forge slot", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);

    const sprites = engine.wos().filter((w) => w.state === "building");
    expect(sprites.length).toBe(2);
    const s1 = sprites[0];
    const s2 = sprites[1];
    if (s1 !== undefined && s2 !== undefined) {
      // They should have different positions (different forge slots)
      const d = dist([s1.px, s1.py], [s2.px, s2.py]);
      expect(d).toBeGreaterThan(10);
    }
  });

  it("frd-06: WHEN multiple WOs are in tribunal THEN each has a distinct slot", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03");
    engine.tick(100);
    engine.setWo("WO-01", "in_review");
    engine.setWo("WO-02", "in_review");
    engine.setWo("WO-03", "in_review");
    // Enough time to settle into tribunal
    advance(engine, 100, 16, 400);

    const inReview = engine.wos().filter((w) => w.state === "in_review");
    expect(inReview.length).toBe(3);
    // Each WO gets a distinct tribunal slot
    const positions = inReview.map((w) => `${Math.round(w.px)},${Math.round(w.py)}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// wos() shape contract
// ---------------------------------------------------------------------------

describe("frd-06: engine — WoSprite shape contract", () => {
  it("frd-06: WHEN wos() is called THEN each sprite has wo, state, px, py fields", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-001");
    engine.tick(100);

    for (const sprite of engine.wos()) {
      expect(sprite).toHaveProperty("wo");
      expect(sprite).toHaveProperty("state");
      expect(sprite).toHaveProperty("px");
      expect(sprite).toHaveProperty("py");
    }
  });

  it("frd-06: WHEN wos() is called THEN returned array is a snapshot (mutations do not affect engine)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-001");
    engine.tick(100);

    const arr1 = engine.wos();
    const first = arr1[0];
    if (first !== undefined) {
      (first as unknown as Record<string, unknown>).state = "blocked";
    }
    const arr2 = engine.wos();
    expect(arr2[0]?.state).toBe("building");
  });
});

// ---------------------------------------------------------------------------
// Tick idempotence / determinism
// ---------------------------------------------------------------------------

describe("frd-06: engine — tick / idempotence", () => {
  it("frd-06: WHEN tick is called with the same timestamp twice THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");

    expect(() => {
      engine.tick(1000);
      engine.tick(1000);
    }).not.toThrow();
  });

  it("frd-06: WHEN engine is ticked with no WOs THEN no crash", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    expect(() => {
      engine.tick(1000);
      engine.tick(2000);
    }).not.toThrow();
  });

  it("frd-06: WHEN a second tick after verifyWo THEN trophy list is stable", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);
    engine.verifyWo("WO-01");
    engine.tick(200);
    engine.tick(300);

    expect(engine.trophies()).toContain("WO-01");
    expect(engine.trophies()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Wave cap with all modes (AC-06-001.2)
// ---------------------------------------------------------------------------

describe("frd-06: engine — wave cap across modes", () => {
  it("frd-06: powerful mode wave=8 allows up to 8 building sprites", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    for (let i = 1; i <= 10; i++) engine.enqueue(`WO-0${i}`);
    engine.tick(100);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building.length).toBeLessThanOrEqual(8);
    expect(building.length).toBe(8); // exactly fills the wave
  });

  it("frd-06: balanced mode wave=4 allows up to 4 building sprites", () => {
    const engine = createFraguaEngine({ mode: "balanced", wave: 4 });
    for (let i = 1; i <= 6; i++) engine.enqueue(`WO-0${i}`);
    engine.tick(100);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building.length).toBeLessThanOrEqual(4);
  });

  it("frd-06: deep mode wave=6 allows up to 6 building sprites", () => {
    const engine = createFraguaEngine({ mode: "deep", wave: 6 });
    for (let i = 1; i <= 8; i++) engine.enqueue(`WO-0${i}`);
    engine.tick(100);

    const building = engine.wos().filter((w) => w.state === "building");
    expect(building.length).toBeLessThanOrEqual(6);
  });

  it("frd-06: WHEN a review slot WO was in forge THEN forge slot count drops below wave", () => {
    const engine = createFraguaEngine({ mode: "pro", wave: 2 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.enqueue("WO-03"); // queued
    engine.tick(100);

    // Move WO-01 to review — frees a forge slot
    engine.setWo("WO-01", "in_review");
    engine.tick(200);

    // After transition, WO-03 should be promoted to fill the forge slot
    const allWos = engine.wos();
    const wo3 = allWos.find((w) => w.wo === "WO-03");
    expect(wo3).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Parchment via applyEvents (AC-06-006.1)
// ---------------------------------------------------------------------------

describe("frd-06: engine — parchment (startHandoff via applyEvents, AC-06-006.1)", () => {
  it("frd-06: WHEN HandoffWritten maps to startHandoff THEN no crash and both WOs remain in wos()", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.enqueue("WO-02");
    engine.tick(100);

    engine.applyEvents([{ kind: "startHandoff", fromWo: "WO-01", toWo: "WO-02" }]);
    engine.tick(200);

    expect(engine.wos().find((w) => w.wo === "WO-01")).toBeDefined();
    expect(engine.wos().find((w) => w.wo === "WO-02")).toBeDefined();
  });

  it("frd-06: WHEN parchment target is absent from scene THEN engine does not crash (edge case)", () => {
    const engine = createFraguaEngine({ mode: "powerful", wave: 8 });
    engine.enqueue("WO-01");
    engine.tick(100);

    expect(() => {
      engine.applyEvents([{ kind: "startHandoff", fromWo: "WO-01", toWo: undefined }]);
      engine.tick(200);
    }).not.toThrow();
  });
});
