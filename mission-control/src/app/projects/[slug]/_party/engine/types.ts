/**
 * WO-06-004 — La Fragua engine types (IF-06-engine).
 *
 * Public types consumed by the scene layer (WO-06-006) and the engine tests,
 * plus the engine-internal sprite/parchment shapes. Split out of engine.ts to
 * keep each module loadable whole (clean-code.md size limit).
 */

import type { BuildMode } from "@/lib/constants";
import type { RelayStep, VisualAction, WoState } from "../state-map/state-map";

/** Relay state carried by a deep-mode WO sprite. */
export type RelayState = {
  /** Current relay sub-step. */
  step: RelayStep;
  /** True once the backend contract is published to the frontend. */
  contractPublished: boolean;
};

/**
 * Observable state of a work-order sprite at a given tick.
 * Consumers use this to render sprites in the La Fragua scene.
 */
export type WoSprite = {
  /** Work-order identifier (e.g. "WO-06-004"). */
  wo: string;
  /** Current visual state of the WO. */
  state: WoState;
  /** Current x position in the La Fragua canvas (pixels). */
  px: number;
  /** Current y position in the La Fragua canvas (pixels). */
  py: number;
  /** Active relay state for deep-mode WOs (optional). */
  relay?: RelayState;
};

/**
 * The gate state returned by gate().
 */
export type GateState = {
  /** True when all WOs in the FRD are IN_REVIEW and the reviewer activates. */
  open: boolean;
};

/** Options for createFraguaEngine. */
export type FraguaEngineOpts = {
  /** Build mode (drives forge slot layout). */
  mode: BuildMode;
  /** Wave size: maximum concurrent building sprites. */
  wave: number;
};

/** Public interface of the La Fragua engine (IF-06-engine). */
export type FraguaEngine = {
  /**
   * Set a WO sprite's visual state immediately (no queue).
   * Creates the sprite if it doesn't exist.
   */
  setWo(wo: string, state: WoState): void;

  /**
   * Enqueue a WO for building. If wave slots are available, it is promoted
   * immediately to the forge. Otherwise it waits in the queue ("+N en cola").
   * Idempotent: enqueueing an already-tracked WO is a no-op.
   */
  enqueue(wo: string): void;

  /**
   * Begin the parchment animation from fromWo to toWo's station.
   * If toWo is absent from the scene, parchment animates to the forge edge.
   * Driven by HandoffWritten (artifact hand-off, NOT live chat) per AC-06-006.1.
   */
  startHandoff(fromWo: string, toWo: string | undefined): void;

  /**
   * Mark a WO as verified: remove it from wos(), add it to trophies(),
   * and promote the next queued WO into the freed slot.
   */
  verifyWo(wo: string): void;

  /**
   * Open the reviewer gate (Tribunal del Juez).
   * Called when AgentWorking carries phase:'review' (all WOs IN_REVIEW).
   */
  openGate(): void;

  /**
   * Translate VisualActions into internal instructions and enqueue them.
   * Processing happens at the engine's pace (temporal lag is intentional).
   */
  applyEvents(diff: VisualAction[]): void;

  /**
   * Advance physics by one step for the given clock time `now` (ms).
   * Call from your RAF loop: `engine.tick(performance.now())`.
   * Pure math — no DOM access in the engine core.
   */
  tick(now: number): void;

  /**
   * Return a snapshot of all current WO sprites (forge + tribunal; not vault trophies).
   * Returns a fresh array on every call — safe to mutate.
   */
  wos(): WoSprite[];

  /**
   * Return the current reviewer gate state.
   */
  gate(): GateState;

  /**
   * Return the list of verified WO ids (Bóveda trophies).
   * Returns a fresh array — safe to mutate.
   */
  trophies(): string[];
};

/** Room a WO sprite currently occupies. */
export type RoomState = "forge" | "tribunal" | "vault";

/** An in-flight parchment document between two WO stations. */
export type ParchmentFlight = {
  fromWo: string;
  toWo: string | undefined;
  /** Current parchment position. */
  px: number;
  py: number;
  /** Target position (toWo's current position, or forge edge). */
  targetPx: number;
  targetPy: number;
  /** True once parchment has arrived. */
  done: boolean;
};

/** Engine-internal mutable WO sprite record. */
export type InternalWo = {
  wo: string;
  state: WoState;
  room: RoomState;
  /** Current position (animated toward target slot). */
  px: number;
  py: number;
  /** Target position in current room. */
  targetPx: number;
  targetPy: number;
  /** Slot index in current room. */
  slotIndex: number;
  /** Last tick timestamp (for dt calculation). */
  _lastTick: number;
  /** Relay state (deep mode only). */
  relay?: RelayState;
};
