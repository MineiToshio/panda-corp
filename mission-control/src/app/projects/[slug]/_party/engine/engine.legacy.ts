/**
 * engine.legacy.ts — Old Party engine (agent-keyed model)
 *
 * @deprecated This is the pre-La-Fragua engine (WO-06-004 Wave 1).
 * It animated wandering zone agents with center-routed stage handoffs.
 * Kept ONLY for backward compatibility while PartyScene.tsx and PartyTab.tsx
 * (WO-06-005/006) are still using the old API.
 *
 * New code MUST NOT import from this file — use createFraguaEngine in engine.ts.
 *
 * The old model is being replaced by the WO-keyed model (createFraguaEngine).
 * This file will be deleted when WO-06-006 (DOM adapter) is re-implemented.
 */

import type { Pos } from "../layout";
import { MCCENTER } from "../layout";
import type { AgentState, VisualAction, WoState } from "../state-map/state-map";

// ---------------------------------------------------------------------------
// Constants (ported from prototype)
// ---------------------------------------------------------------------------

const WALK_SPEED = 0.1;
const MAX_DT = 48;
const ARRIVE_PAUSE = 700;
const APPROACH_DIST = 85;
const WANDER_RADIUS = 40;
const WANDER_INTERVAL = 2400;

// ---------------------------------------------------------------------------
// Types — public contracts (legacy)
// ---------------------------------------------------------------------------

/** @deprecated Use WoSprite from engine.ts instead. */
export type AgentSnapshot = {
  id: string;
  state: AgentState;
  home: Pos;
};

/** @deprecated Use FraguaEngineOpts from engine.ts instead. */
export type EngineOpts = {
  seed?: number;
};

/** @deprecated Use WoSprite from engine.ts instead. */
export type EngineAgent = {
  id: string;
  state: AgentState;
  px: number;
  py: number;
  bob: number;
};

/** @deprecated Use FraguaEngine from engine.ts instead. */
export type PartyEngine = {
  setState(id: string, state: AgentState): void;
  startHandoff(id: string, target: string): void;
  applyEvents(diff: VisualAction[]): void;
  tick(now: number): void;
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
  path: Pos[];
  walkPhase: WalkPhase | null;
  waitUntil: number;
  targetId: string | null;
  wanderTarget: Pos;
  wanderNextAt: number;
  phase: number;
  t0: number;
  _lastTick: number;
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function vecLen(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

function computeApproach(targetHome: Pos): Pos {
  const dx = MCCENTER[0] - targetHome[0];
  const dy = MCCENTER[1] - targetHome[1];
  const m = vecLen(dx, dy) || 1;
  return [
    Math.round(targetHome[0] + (dx / m) * APPROACH_DIST),
    Math.round(targetHome[1] + (dy / m) * APPROACH_DIST),
  ];
}

function rnd(seed: number, min: number, max: number): number {
  const next = ((seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  return min + next * (max - min);
}

// ---------------------------------------------------------------------------
// createPartyEngine — legacy factory function
// ---------------------------------------------------------------------------

/**
 * @deprecated Use createFraguaEngine from engine.ts for new code.
 * This creates the old agent-keyed Party engine.
 */
export function createPartyEngine(
  snapshot: readonly AgentSnapshot[],
  opts: EngineOpts,
): PartyEngine {
  const seed0 = opts.seed ?? 42;
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
      phase: ix * 1.7,
      t0: 0,
      _lastTick: 0,
    });
  });

  function getAgent(id: string): InternalAgent | undefined {
    return internal.get(id);
  }

  function applySetState(ag: InternalAgent, state: AgentState, now: number): void {
    ag.state = state;
    ag.t0 = now;
    ag.path = [];
    ag.walkPhase = null;
    ag.waitUntil = 0;
    ag.wanderTarget = [ag.px, ag.py];
    ag.wanderNextAt = now + WANDER_INTERVAL;
  }

  function beginWalk(ag: InternalAgent, targetHome: Pos, targetId: string | null): void {
    ag.state = "walk";
    ag.targetId = targetId;
    ag.walkPhase = "to";
    ag.waitUntil = 0;
    const approachPt = computeApproach(targetHome);
    ag.path = [[...MCCENTER] as Pos, [...approachPt] as Pos];
  }

  function onArrive(ag: InternalAgent, now: number): void {
    if (ag.walkPhase === "to") {
      ag.walkPhase = "wait";
      ag.waitUntil = now + ARRIVE_PAUSE;
      ag.path = [];
    } else if (ag.walkPhase === "back") {
      ag.px = ag.home[0];
      ag.py = ag.home[1];
      applySetState(ag, "work", now);
    }
  }

  function tickAgent(ag: InternalAgent, now: number): void {
    const dt = Math.min(MAX_DT, ag._lastTick > 0 ? now - ag._lastTick : 16);
    ag._lastTick = now;

    if (ag.state === "walk") {
      if (ag.walkPhase === "wait") {
        if (now >= ag.waitUntil) {
          ag.walkPhase = "back";
          ag.path = [[...MCCENTER] as Pos, [...ag.home] as Pos];
        }
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
          if (ag.path.length === 0) onArrive(ag, now);
        } else {
          ag.px += (dx / d) * step;
          ag.py += (dy / d) * step;
        }
      }
    } else {
      if (ag.state === "idle" || ag.state === "work") {
        if (now >= ag.wanderNextAt) {
          const angle = rnd(ag.phase + now, 0, Math.PI * 2);
          const radius = rnd(ag.phase + now + 1, 0, WANDER_RADIUS);
          const wx = ag.home[0] + Math.cos(angle) * radius;
          const wy = ag.home[1] + Math.sin(angle) * radius;
          ag.wanderTarget = [wx, wy];
          ag.wanderNextAt = now + WANDER_INTERVAL;
        }

        const dx = ag.wanderTarget[0] - ag.px;
        const dy = ag.wanderTarget[1] - ag.py;
        const d = vecLen(dx, dy);
        const step = WALK_SPEED * 0.15 * dt;
        if (d > 1) {
          ag.px += (dx / d) * Math.min(step, d);
          ag.py += (dy / d) * Math.min(step, d);
        }

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

    const sp = ag.state === "walk" ? 7.5 : 3.5;
    const amp = ag.state === "walk" ? 2.3 : ag.state === "work" ? 1.3 : 0.5;
    ag.bob = Math.sin((now / 1000) * sp + ag.phase) * amp;
  }

  const queue: VisualAction[] = [];

  function drainQueue(now: number): void {
    while (queue.length > 0) {
      const action = queue.shift();
      if (action === undefined) break;
      processAction(action, now);
    }
  }

  function woStateToAgentState(woState: WoState): AgentState {
    if (woState === "building") return "work";
    if (woState === "blocked") return "blocked";
    if (woState === "in_review") return "review";
    return "idle";
  }

  function processAction(action: VisualAction, now: number): void {
    switch (action.kind) {
      case "setWo": {
        const ag = getAgent(action.wo);
        if (ag) applySetState(ag, woStateToAgentState(action.state), now);
        break;
      }

      case "startHandoff": {
        const ag = getAgent(action.fromWo);
        if (!ag) return;
        const targetAg = action.toWo !== undefined ? getAgent(action.toWo) : undefined;
        const targetHome: Pos = targetAg ? ([...targetAg.home] as Pos) : ([...MCCENTER] as Pos);
        beginWalk(ag, targetHome, action.toWo ?? null);
        ag.t0 = now;
        break;
      }

      case "downSprite": {
        if (action.wo !== undefined) {
          const ag = getAgent(action.wo);
          if (ag) applySetState(ag, "blocked", now);
        }
        break;
      }

      case "verifyWo": {
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
        break;
    }
  }

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
      drainQueue(now);
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
