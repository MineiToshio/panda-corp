/**
 * WO-06-004 — Party engine (RAF loop + animation queue)
 *
 * IF-06-engine: `createPartyEngine(snapshot, opts)`
 *
 * Pure step-math engine — no DOM, no real RAF in the core.
 * The RAF binding + DOM adapter lives in WO-06-006.
 *
 * Architecture (PARTY.md §4 + blueprint §2 IF-06-engine):
 *
 *   - `applyEvents(diff)` translates VisualActions into internal instructions
 *     and enqueues them. Processing is at the engine's pace — visual lag is
 *     intentional (temporal fidelity is secondary to legibility, PARTY.md §4).
 *   - `tick(now)` advances positions/phases. All movement is computed with
 *     step math using `now` as a clock — deterministic and testable without RAF.
 *   - `setState(id, state)` is an immediate (non-queued) state transition.
 *     Used by the host to synchronise state from server-derived snapshots.
 *   - `startHandoff(id, target)` initiates the walk animation:
 *       home → MCCENTER → approach(target) → [wait 700 ms] → MCCENTER → home
 *     (ported from prototype mcApproach / mcArrive).
 *   - `agents()` returns a snapshot of all agents' current positions and states.
 *     The returned array is a fresh copy — callers may mutate it safely.
 *
 * Walk physics (ported from prototype mcLoop):
 *   step per ms = WALK_SPEED * dt (prototype: 0.1 * dt px/ms)
 *   speed: walking > working > idle (prototype: sp=7.5 walk, sp=3.5 other)
 *
 * Bob (breathing, AC-06-003.1):
 *   bob = sin(now/1000 * sp + phase) * amp
 *   idle/blocked/review: amp=0.5, sp=3.5
 *   work: amp=1.3, sp=3.5
 *   walk: amp=2.3, sp=7.5
 *
 * Wander (idle drift, AC-06-003.1):
 *   Idle agents drift around their home position within WANDER_RADIUS px.
 *   Target is updated every WANDER_INTERVAL ms (randomised via seeded offset).
 *   The drift is purely cosmetic — position is snapped back if it drifts beyond
 *   WANDER_RADIUS from home.
 *
 * Traceability:
 *   IF-06-engine → REQ-06-003, REQ-06-004
 *   AC-06-003.1 — breathing + wandering
 *   AC-06-004.1 — handoff route + speech bubble
 *
 * Dependencies:
 *   WO-06-002 (layout.ts) — Pos, Role, MCCENTER
 *   WO-06-003 (state-map.ts) — VisualAction, AgentState
 */

import type { Pos } from "../layout";
import { MCCENTER } from "../layout";
import type { AgentState, VisualAction, WoState } from "../state-map/state-map";

// ---------------------------------------------------------------------------
// Constants (ported from prototype)
// ---------------------------------------------------------------------------

/** Walk speed in px per ms (prototype: 0.1 * dt). */
const WALK_SPEED = 0.1;

/** Maximum time delta clamped per tick (prototype: min(48, dt) ms). */
const MAX_DT = 48;

/** Pause after delivering (before returning home), ms (prototype: 700). */
const ARRIVE_PAUSE = 700;

/** Approach offset: how close the walker gets to the target (prototype: 85 px). */
const APPROACH_DIST = 85;

/** Wander radius: max drift from home for idle agents (px). */
const WANDER_RADIUS = 40;

/** How often a wandering agent picks a new drift target (ms). */
const WANDER_INTERVAL = 2400;

// ---------------------------------------------------------------------------
// Types — public contracts
// ---------------------------------------------------------------------------

/** Snapshot used to initialise an agent inside the engine. */
export type AgentSnapshot = {
  id: string;
  state: AgentState;
  home: Pos;
};

/** Options for `createPartyEngine`. */
export type EngineOpts = {
  /** Seed value for reproducible randomness in tests (optional). */
  seed?: number;
};

/** The observable state of an agent at a given tick. */
export type EngineAgent = {
  id: string;
  state: AgentState;
  /** Current x position (pixel coords within the 760×570 scene canvas). */
  px: number;
  /** Current y position. */
  py: number;
  /**
   * Vertical bob offset in pixels (breathing / bounce animation).
   * Consumers apply: `element.style.transform = translate(px-27, py-27+bob)`.
   */
  bob: number;
};

/** Public interface of the Party engine. */
export type PartyEngine = {
  /**
   * Immediately set an agent's visual state (no queue).
   * Used to apply server-derived state changes synchronously.
   */
  setState(id: string, state: AgentState): void;

  /**
   * Start a handoff animation from `id` to `target`.
   * The walker routes: home → MCCENTER → approach(target) → wait → MCCENTER → home.
   */
  startHandoff(id: string, target: string): void;

  /**
   * Translate VisualActions into internal instructions and enqueue them.
   * Processing happens at the engine's pace — temporal lag is intentional.
   */
  applyEvents(diff: VisualAction[]): void;

  /**
   * Advance the engine by one step for the given clock time `now` (ms).
   * Call this from your RAF loop: `engine.tick(performance.now())`.
   * Pure math — no DOM access in the engine core.
   */
  tick(now: number): void;

  /**
   * Return a snapshot of all current agent states + positions.
   * Returns a fresh array on every call — safe to mutate.
   */
  agents(): EngineAgent[];
};

// ---------------------------------------------------------------------------
// Internal agent state
// ---------------------------------------------------------------------------

type WalkPhase = "to" | "wait" | "back";

type InternalAgent = {
  id: string;
  state: AgentState;
  home: Pos;
  px: number;
  py: number;
  bob: number;

  // Walk
  path: Pos[];
  walkPhase: WalkPhase | null;
  waitUntil: number;
  targetId: string | null;

  // Wander (idle drift)
  wanderTarget: Pos;
  wanderNextAt: number;

  // Bob
  phase: number; // per-agent phase offset (set at init to spread out the waves)
  t0: number; // timestamp of last state change

  // Internal: last tick timestamp (for dt calculation)
  _lastTick: number;
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function vecLen(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

/**
 * Compute the approach point: the position `APPROACH_DIST` px away from the
 * target's home in the direction from MCCENTER → target.
 * Ported from prototype: mcApproach(t).
 */
function computeApproach(targetHome: Pos): Pos {
  const dx = MCCENTER[0] - targetHome[0];
  const dy = MCCENTER[1] - targetHome[1];
  const m = vecLen(dx, dy) || 1;
  return [
    Math.round(targetHome[0] + (dx / m) * APPROACH_DIST),
    Math.round(targetHome[1] + (dy / m) * APPROACH_DIST),
  ];
}

/**
 * Deterministic pseudo-random using a simple LCG per agent.
 * Returns a value in [min, max].
 */
function rnd(seed: number, min: number, max: number): number {
  // LCG: a=1664525, c=1013904223, m=2^32
  const next = ((seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  return min + next * (max - min);
}

// ---------------------------------------------------------------------------
// createPartyEngine — factory function
// ---------------------------------------------------------------------------

/**
 * Create a new Party engine from a roster snapshot.
 *
 * @param snapshot - Initial agent states and home positions.
 * @param opts     - Engine options (optional seed for determinism in tests).
 */
export function createPartyEngine(
  snapshot: readonly AgentSnapshot[],
  opts: EngineOpts,
): PartyEngine {
  const seed0 = opts.seed ?? 42;

  // Initialise internal agent state
  const internal = new Map<string, InternalAgent>();

  snapshot.forEach((s, ix) => {
    const agentSeed = seed0 + ix * 997;
    internal.set(s.id, {
      id: s.id,
      state: s.state,
      home: [...s.home] as Pos,
      px: s.home[0],
      py: s.home[1],
      bob: 0,
      path: [],
      walkPhase: null,
      waitUntil: 0,
      targetId: null,
      wanderTarget: [...s.home] as Pos,
      wanderNextAt: rnd(agentSeed, 0, WANDER_INTERVAL),
      phase: ix * 1.7, // spread bob waves across agents
      t0: 0,
      _lastTick: 0,
    });
  });

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function getAgent(id: string): InternalAgent | undefined {
    return internal.get(id);
  }

  function applySetState(ag: InternalAgent, state: AgentState, now: number): void {
    ag.state = state;
    ag.t0 = now;
    ag.path = [];
    ag.walkPhase = null;
    ag.waitUntil = 0;
    // Reset wander target to current position so drift doesn't immediately
    // pull the agent away from where it just landed.
    ag.wanderTarget = [ag.px, ag.py];
    ag.wanderNextAt = now + WANDER_INTERVAL;
  }

  function beginWalk(ag: InternalAgent, targetHome: Pos, targetId: string | null): void {
    ag.state = "walk";
    ag.targetId = targetId;
    ag.walkPhase = "to";
    ag.waitUntil = 0;

    const approachPt = computeApproach(targetHome);
    // Path: current pos → MCCENTER → approach(target)
    ag.path = [[...MCCENTER] as Pos, [...approachPt] as Pos];
  }

  function onArrive(ag: InternalAgent, now: number): void {
    if (ag.walkPhase === "to") {
      // Reached approach point — pause, then go back
      ag.walkPhase = "wait";
      ag.waitUntil = now + ARRIVE_PAUSE;
      ag.path = [];
    } else if (ag.walkPhase === "back") {
      // Snap exactly to home, then return to work state
      ag.px = ag.home[0];
      ag.py = ag.home[1];
      applySetState(ag, "work", now);
    }
  }

  function tickAgent(ag: InternalAgent, now: number): void {
    const dt = Math.min(MAX_DT, ag._lastTick > 0 ? now - ag._lastTick : 16);
    ag._lastTick = now;

    if (ag.state === "walk") {
      // Handle wait phase
      if (ag.walkPhase === "wait") {
        if (now >= ag.waitUntil) {
          // Start return trip
          ag.walkPhase = "back";
          ag.path = [[...MCCENTER] as Pos, [...ag.home] as Pos];
        }
        // Still waiting — bob only
      } else if (ag.path.length > 0) {
        const target = ag.path[0];
        if (target === undefined) return;
        const dx = target[0] - ag.px;
        const dy = target[1] - ag.py;
        const d = vecLen(dx, dy);
        const step = WALK_SPEED * dt;

        if (d <= step) {
          ag.px = target[0];
          ag.py = target[1];
          ag.path.shift();

          if (ag.path.length === 0) {
            onArrive(ag, now);
          }
        } else {
          ag.px += (dx / d) * step;
          ag.py += (dy / d) * step;
        }
      }
    } else {
      // Idle drift (wander) — AC-06-003.1
      if (ag.state === "idle" || ag.state === "work") {
        if (now >= ag.wanderNextAt) {
          // Pick a new drift target within WANDER_RADIUS of home
          const angle = rnd(ag.phase + now, 0, Math.PI * 2);
          const radius = rnd(ag.phase + now + 1, 0, WANDER_RADIUS);
          const wx = ag.home[0] + Math.cos(angle) * radius;
          const wy = ag.home[1] + Math.sin(angle) * radius;
          ag.wanderTarget = [wx, wy];
          ag.wanderNextAt = now + WANDER_INTERVAL;
        }

        // Drift toward wander target (slow drift, 10% of walk speed)
        const dx = ag.wanderTarget[0] - ag.px;
        const dy = ag.wanderTarget[1] - ag.py;
        const d = vecLen(dx, dy);
        const step = WALK_SPEED * 0.15 * dt;
        if (d > 1) {
          ag.px += (dx / d) * Math.min(step, d);
          ag.py += (dy / d) * Math.min(step, d);
        }

        // Safety clamp: never drift beyond WANDER_RADIUS from home
        const distFromHome = vecLen(ag.px - ag.home[0], ag.py - ag.home[1]);
        if (distFromHome > WANDER_RADIUS) {
          const backDx = ag.home[0] - ag.px;
          const backDy = ag.home[1] - ag.py;
          const backD = vecLen(backDx, backDy) || 1;
          const excess = distFromHome - WANDER_RADIUS;
          ag.px += (backDx / backD) * excess;
          ag.py += (backDy / backD) * excess;
        }
      }
    }

    // Bob (breathing / bounce) — always active, AC-06-003.1
    const sp = ag.state === "walk" ? 7.5 : 3.5;
    const amp = ag.state === "walk" ? 2.3 : ag.state === "work" ? 1.3 : 0.5;
    ag.bob = Math.sin((now / 1000) * sp + ag.phase) * amp;
  }

  // ---------------------------------------------------------------------------
  // Queue
  // ---------------------------------------------------------------------------

  /** Pending VisualActions to process on the next tick. */
  const queue: VisualAction[] = [];

  function drainQueue(now: number): void {
    while (queue.length > 0) {
      const action = queue.shift();
      if (action === undefined) break;
      processAction(action, now);
    }
  }

  /**
   * Map a WoState to the engine's internal AgentState.
   * The engine is agent-keyed; this bridges the WO-keyed → agent-keyed gap.
   */
  function woStateToAgentState(woState: WoState): AgentState {
    if (woState === "building") return "work";
    if (woState === "blocked") return "blocked";
    if (woState === "in_review") return "review";
    return "idle"; // verified and unknown → idle
  }

  function processSetWo(wo: string, woState: WoState, now: number): void {
    const ag = getAgent(wo);
    if (ag) applySetState(ag, woStateToAgentState(woState), now);
  }

  function processStartHandoff(fromWo: string, toWo: string | undefined, now: number): void {
    const ag = getAgent(fromWo);
    if (!ag) return;
    const targetAg = toWo !== undefined ? getAgent(toWo) : undefined;
    const targetHome: Pos = targetAg ? ([...targetAg.home] as Pos) : ([...MCCENTER] as Pos);
    beginWalk(ag, targetHome, toWo ?? null);
    ag.t0 = now;
  }

  function processAction(action: VisualAction, now: number): void {
    switch (action.kind) {
      case "setWo":
        // Map WO state to internal agent state (WO-keyed bridge, full redesign is a later WO).
        processSetWo(action.wo, action.state, now);
        break;

      case "startHandoff":
        // Parchment: fromWo walks toward toWo's station.
        processStartHandoff(action.fromWo, action.toWo, now);
        break;

      case "downSprite":
        // Failure is first-class (AC-06-012.1): map to 'blocked' (danger visual).
        if (action.wo !== undefined) {
          const ag = getAgent(action.wo);
          if (ag) applySetState(ag, "blocked", now);
        }
        break;

      case "verifyWo": {
        // WO verified: trophy in Bóveda. Map to idle for the sprite.
        const ag = getAgent(action.wo);
        if (ag) applySetState(ag, "idle", now);
        break;
      }

      case "fireAchievement":
      case "openGate":
      case "advanceRelay":
      case "publishContract":
      case "enqueue":
      case "noop":
        // Cosmetic or scene-layer actions — no internal agent-state change.
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    setState(id: string, state: AgentState): void {
      const ag = getAgent(id);
      if (ag) applySetState(ag, state, ag._lastTick);
    },

    startHandoff(id: string, target: string): void {
      const ag = getAgent(id);
      if (!ag) return;
      const targetAg = getAgent(target);
      const targetHome: Pos = targetAg ? ([...targetAg.home] as Pos) : ([...MCCENTER] as Pos);
      beginWalk(ag, targetHome, target);
    },

    applyEvents(diff: VisualAction[]): void {
      for (const action of diff) {
        queue.push(action);
      }
    },

    tick(now: number): void {
      // 1. Drain the action queue first
      drainQueue(now);

      // 2. Advance each agent's physics
      for (const ag of internal.values()) {
        tickAgent(ag, now);
      }
    },

    agents(): EngineAgent[] {
      return Array.from(internal.values()).map((ag) => ({
        id: ag.id,
        state: ag.state,
        px: ag.px,
        py: ag.py,
        bob: ag.bob,
      }));
    },
  };
}
