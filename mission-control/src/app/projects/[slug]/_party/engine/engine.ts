/**
 * WO-06-004 — La Fragua engine (RAF loop, wave cap, rooms, parchment, gate)
 *
 * IF-06-engine: `createFraguaEngine(opts)`
 *
 * Pure step-math engine — no DOM, no real RAF in the core.
 * The RAF binding + DOM adapter lives in WO-06-006.
 *
 * Architecture (blueprint §2 IF-06-engine, FRD-06 REQ-06-001..006):
 *
 *   Wave cap (AC-06-001.2):
 *     At most `wave` WOs hold forge slots; the rest stay queued.
 *     When a slot frees (WO moves to in_review or verified), the next
 *     queued WO is promoted to fill it. The scene can never over-render.
 *
 *   Room flow (AC-06-003.2):
 *     building → in_review: WO sprite walks forge→tribunal path
 *     in_review → verified: WO sprite walks tribunal→vault path
 *     Each room has a pre-computed slot; WOs are placed at their room's
 *     next available slot without pixel collision.
 *
 *   Parchment (AC-06-006.1):
 *     `startHandoff(fromWo, toWo)` records the parchment route (fromWo station
 *     → toWo station or forge edge if absent). Cosmetic; the engine records the
 *     intent and `tick(now)` advances a parchment position.
 *
 *   Gate:
 *     `openGate()` flips the reviewer gate; consumed by the scene layer.
 *
 *   Deterministic:
 *     `tick(now)` advances at the engine's pace (no RAF in tests).
 *     Pure step math; the DOM/RAF binding lives in WO-06-006.
 *
 * Traceability:
 *   IF-06-engine → REQ-06-001, REQ-06-003, REQ-06-006
 *   AC-06-001.1 — one sprite per running WO
 *   AC-06-001.2 — wave cap
 *   AC-06-003.2 — room-transition animation
 *   AC-06-006.1 — parchment routing
 *
 * Dependencies:
 *   WO-06-002 (layout.ts) — Pos, FORGE_SLOTS, DEEP_SLOTS, REVIEW_SLOTS,
 *                            FORGE_OUT, TRIB_IN, TRIB_OUT, VAULT_Y
 *   WO-06-003 (state-map.ts) — VisualAction, WoState
 *
 * Module split (clean-code.md size limit):
 *   ./types — public + internal types
 *   ./slots — slot-assignment + movement geometry
 */

import type { Pos } from "../layout";
import { FORGE_OUT, FORGE_SLOTS, REVIEW_SLOTS } from "../layout";
import type { RelayStep, VisualAction, WoState } from "../state-map/state-map";
import {
  getForgeSlots,
  MAX_DT,
  nextFreeSlot,
  occupiedSlots,
  stepToward,
  WALK_SPEED,
} from "./slots";
import type {
  FraguaEngine,
  FraguaEngineOpts,
  GateState,
  InternalWo,
  ParchmentFlight,
  WoSprite,
} from "./types";

// ---------------------------------------------------------------------------
// createFraguaEngine — factory function
// ---------------------------------------------------------------------------

/**
 * Create a new La Fragua engine.
 *
 * @param opts - Engine options: mode (BuildMode) and wave size.
 */
export function createFraguaEngine(opts: FraguaEngineOpts): FraguaEngine {
  const { mode, wave } = opts;

  /** WOs currently in the scene (forge + tribunal; not vault). Keyed by wo id. */
  const active = new Map<string, InternalWo>();

  /** WOs waiting for a forge slot (FIFO queue). */
  const queued: string[] = [];

  /** Set for O(1) membership check of queued WO ids. */
  const queuedSet = new Set<string>();

  /** Set of all known WO ids (active + queued) for dedup. */
  const allKnown = new Set<string>();

  /** Verified WO ids (Bóveda trophies). */
  const verifiedList: string[] = [];

  /** Reviewer gate state. */
  let gateOpen = false;

  /** Active parchment flights. */
  const parchments: ParchmentFlight[] = [];

  /** Pending VisualActions. */
  const actionQueue: VisualAction[] = [];

  // -------------------------------------------------------------------------
  // Forge slot management
  // -------------------------------------------------------------------------

  /** Number of WOs currently in the forge room (holding forge slots). */
  function forgeCount(): number {
    let n = 0;
    for (const w of active.values()) {
      if (w.room === "forge") n++;
    }
    return n;
  }

  /**
   * Promote the next queued WO into a forge slot, if wave allows.
   * Called after a WO leaves the forge (moves to tribunal or vault).
   */
  function promoteQueued(): void {
    while (queued.length > 0 && forgeCount() < wave) {
      const nextWo = queued.shift();
      if (nextWo === undefined) break;
      queuedSet.delete(nextWo);
      addToForge(nextWo);
    }
  }

  /**
   * Compute the forge target position for a slot index.
   */
  function forgeSlotPos(slotIndex: number): Pos {
    const slots = getForgeSlots(mode);
    const slot = slots[slotIndex];
    if (slot === undefined) return [FORGE_SLOTS[0]?.[0] ?? 95, FORGE_SLOTS[0]?.[1] ?? 155];
    return [slot[0], slot[1]];
  }

  /**
   * Add a WO to the forge room at the next available slot.
   */
  function addToForge(wo: string): void {
    const slots = getForgeSlots(mode);
    const occ = occupiedSlots(active, "forge");
    const si = nextFreeSlot(slots.length, occ);
    const slotIndex = si >= 0 ? si : 0;
    const [tx, ty] = forgeSlotPos(slotIndex);
    active.set(wo, {
      wo,
      state: "building",
      room: "forge",
      px: tx,
      py: ty,
      targetPx: tx,
      targetPy: ty,
      slotIndex,
      _lastTick: 0,
    });
  }

  // -------------------------------------------------------------------------
  // Internal action processors
  // -------------------------------------------------------------------------

  /** Enqueue a WO for building, respecting the wave cap. Idempotent by allKnown. */
  function enqueueWo(wo: string): void {
    if (allKnown.has(wo)) return;
    allKnown.add(wo);
    if (forgeCount() < wave) {
      addToForge(wo);
    } else {
      queued.push(wo);
      queuedSet.add(wo);
    }
  }

  /** Move a WO sprite from forge to the tribunal. Frees the forge slot. */
  function moveToTribunal(sprite: InternalWo): void {
    const occ = occupiedSlots(active, "tribunal");
    const si = nextFreeSlot(REVIEW_SLOTS.length, occ);
    const slotIndex = si >= 0 ? si : 0;
    const slot = REVIEW_SLOTS[slotIndex];
    const [tx, ty]: Pos = slot !== undefined ? [slot[0], slot[1]] : [538, 190];

    const wasForge = sprite.room === "forge";
    // Change room FIRST so forgeCount() is accurate when promoteQueued() runs
    sprite.room = "tribunal";
    sprite.slotIndex = slotIndex;
    sprite.targetPx = tx;
    sprite.targetPy = ty;

    if (wasForge) promoteQueued();
  }

  function internalVerifyWo(wo: string): void {
    if (!active.has(wo)) return;
    active.delete(wo);
    allKnown.delete(wo);
    verifiedList.push(wo);
    // Always try to promote — whether the WO was in forge or tribunal,
    // a slot (forge or otherwise) may now be available.
    promoteQueued();
  }

  function processSetWo(wo: string, state: WoState): void {
    let sprite = active.get(wo);
    if (sprite === undefined) {
      if (state === "building") {
        enqueueWo(wo);
        return;
      }
      enqueueWo(wo); // creates in forge for non-building unknown WOs
      sprite = active.get(wo);
      if (sprite === undefined) return;
    }

    sprite.state = state;
    if (state === "in_review") moveToTribunal(sprite);
    else if (state === "verified") internalVerifyWo(wo);
  }

  /** Spawn a parchment flight from fromWo toward toWo (or the forge edge). */
  function spawnParchment(fromWo: string, toWo: string | undefined): void {
    const from = active.get(fromWo);
    const to = toWo !== undefined ? active.get(toWo) : undefined;
    parchments.push({
      fromWo,
      toWo,
      px: from !== undefined ? from.px : FORGE_OUT[0],
      py: from !== undefined ? from.py : FORGE_OUT[1],
      targetPx: to !== undefined ? to.targetPx : FORGE_OUT[0],
      targetPy: to !== undefined ? to.targetPy : FORGE_OUT[1],
      done: false,
    });
  }

  /** Handle downSprite action — put the WO in a blocked (failed) visual state. */
  function processDownSprite(wo: string | undefined): void {
    if (wo === undefined) return;
    const sprite = active.get(wo);
    if (sprite !== undefined) sprite.state = "blocked";
  }

  /** Handle advanceRelay action — update relay step. */
  function processAdvanceRelay(wo: string, step: RelayStep): void {
    const sprite = active.get(wo);
    if (sprite === undefined) return;
    sprite.relay = { step, contractPublished: sprite.relay?.contractPublished ?? false };
  }

  /** Handle publishContract action — flip contractPublished flag on the relay. */
  function processPublishContract(wo: string): void {
    const sprite = active.get(wo);
    if (sprite === undefined) return;
    sprite.relay = { step: sprite.relay?.step ?? "backend", contractPublished: true };
  }

  function processAction(action: VisualAction): void {
    switch (action.kind) {
      case "setWo":
        processSetWo(action.wo, action.state);
        break;
      case "enqueue":
        enqueueWo(action.wo);
        break;
      case "startHandoff":
        spawnParchment(action.fromWo, action.toWo);
        break;
      case "verifyWo":
        internalVerifyWo(action.wo);
        break;
      case "openGate":
        gateOpen = true;
        break;
      case "closeGate":
        gateOpen = false;
        break;
      case "downSprite":
        processDownSprite(action.wo);
        break;
      case "advanceRelay":
        processAdvanceRelay(action.wo, action.step);
        break;
      case "publishContract":
        processPublishContract(action.wo);
        break;
      case "fireAchievement":
        break; // cosmetic-only — no engine state change
      case "noop":
        break; // defensive no-op
    }
  }

  function drainQueue(_now: number): void {
    while (actionQueue.length > 0) {
      const action = actionQueue.shift();
      if (action === undefined) break;
      processAction(action);
    }
  }

  // -------------------------------------------------------------------------
  // Tick physics
  // -------------------------------------------------------------------------

  function tickSprite(sprite: InternalWo, now: number): void {
    const dt = Math.min(MAX_DT, sprite._lastTick > 0 ? now - sprite._lastTick : 16);
    sprite._lastTick = now;

    const step = WALK_SPEED * dt;
    const [nx, ny] = stepToward({
      px: sprite.px,
      py: sprite.py,
      targetPx: sprite.targetPx,
      targetPy: sprite.targetPy,
      step,
    });
    sprite.px = nx;
    sprite.py = ny;
  }

  function tickParchments(_now: number): void {
    const step = WALK_SPEED * Math.min(MAX_DT, 16);
    for (const p of parchments) {
      if (p.done) continue;
      const [nx, ny] = stepToward({
        px: p.px,
        py: p.py,
        targetPx: p.targetPx,
        targetPy: p.targetPy,
        step,
      });
      p.px = nx;
      p.py = ny;
      if (Math.hypot(p.targetPx - p.px, p.targetPy - p.py) < 1) {
        p.done = true;
      }
    }
    // Remove completed parchments to avoid unbounded growth
    const finished = parchments.filter((p) => p.done);
    if (finished.length > 0) {
      parchments.splice(0, parchments.length, ...parchments.filter((p) => !p.done));
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    setWo(wo: string, state: WoState): void {
      processSetWo(wo, state);
    },

    enqueue(wo: string): void {
      enqueueWo(wo);
    },

    startHandoff(fromWo: string, toWo: string | undefined): void {
      spawnParchment(fromWo, toWo);
    },

    verifyWo(wo: string): void {
      internalVerifyWo(wo);
    },

    openGate(): void {
      gateOpen = true;
    },

    closeGate(): void {
      gateOpen = false;
    },

    applyEvents(diff: VisualAction[]): void {
      for (const action of diff) {
        actionQueue.push(action);
      }
    },

    tick(now: number): void {
      // 1. Drain the action queue
      drainQueue(now);

      // 2. Advance each sprite toward its target slot
      for (const sprite of active.values()) {
        tickSprite(sprite, now);
      }

      // 3. Advance parchment flights
      tickParchments(now);
    },

    wos(): WoSprite[] {
      return Array.from(active.values()).map((w) => ({
        wo: w.wo,
        state: w.state,
        px: w.px,
        py: w.py,
        ...(w.relay !== undefined ? { relay: { ...w.relay } } : {}),
      }));
    },

    gate(): GateState {
      return { open: gateOpen };
    },

    trophies(): string[] {
      return [...verifiedList];
    },
  };
}

// ---------------------------------------------------------------------------
// Public type re-exports (IF-06-engine) — consumers import these from here.
// ---------------------------------------------------------------------------

export type { FraguaEngine, FraguaEngineOpts } from "./types";
