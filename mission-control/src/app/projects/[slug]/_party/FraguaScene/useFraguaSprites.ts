/**
 * WO-06-007 — useFraguaSprites: drive the stage-level WO sprite layer from the engine.
 *
 * Bridges the La Fragua engine's animated positions to the DOM:
 *   - React owns the sprite LIST (which WOs exist) from the snapshot.
 *   - The RAF loop owns their POSITIONS, written imperatively each frame.
 *
 * Engine persistence (2026-07-01 rework): the engine used to be RECREATED on
 * every change of the `running` array — and every SSE frame re-derives the
 * snapshot, so a live build reset the engine (and any walk in flight) every few
 * seconds, teleporting in-review sprites back to the forge to re-walk. Now ONE
 * engine instance lives per (frd, mode, wave, reducedMotion) scene and a DIFF
 * effect applies only the CHANGES (`setWo` on state change, `verifyWo` on exit,
 * `openGate` once), so a room transition produces exactly one walk
 * (AC-06-003.2) and everything else keeps animating undisturbed.
 *
 * Determinism / SSR safety:
 *   - The engine is created in an effect (no `performance`/`window` at module scope).
 *   - Sprite wrappers get an initial static-slot position for first paint (SSR);
 *     the effect/RAF then takes over from `engine.wos()`.
 *   - Reduced motion: no RAF loop; positions are placed after each diff at the
 *     engine's current targets (the engine initializes sprites AT their target).
 *
 * Traceability: CMP-06-scene → AC-06-003.2.
 */

import { useCallback, useEffect, useRef } from "react";
import { createFraguaEngine, type FraguaEngine } from "../engine/engine";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import type { WoState } from "../state-map/state-map";

/** Sprite size offset: slots are centers; the 52px sprite is offset by half. */
const SPRITE_HALF = 26;

/** Inputs the hook needs from the snapshot to build + drive the engine. */
export interface UseFraguaSpritesInput {
  /** The FRD the scene shows — a change resets the engine (new per-FRD scene). */
  readonly frdId: string | null;
  /** Running WOs (id + visual state) — the sprite list React owns. */
  readonly running: FraguaSnapshot["running"];
  /** Verified WOs (trophies) — seeded into the engine so its slot math is correct. */
  readonly trophies: FraguaSnapshot["trophies"];
  /** Reviewer gate state — seeded into the engine. */
  readonly gate: FraguaSnapshot["gate"];
  /** Build mode (drives forge slot layout). */
  readonly mode: FraguaSnapshot["mode"];
  /** Wave size cap. */
  readonly wave: FraguaSnapshot["wave"];
  /** When true, skip the RAF loop and place sprites once at their target. */
  readonly reducedMotion: boolean;
}

/** What the hook returns to the scene for the stage-level sprite layer. */
export interface UseFraguaSpritesResult {
  /**
   * Stable ref callback factory: `registerSprite(wo)` returns the ref callback
   * for that WO's wrapper element. The element is stored so the RAF loop can
   * write its position imperatively.
   */
  readonly registerSprite: (wo: string) => (el: HTMLDivElement | null) => void;
}

/** Mutable per-scene tracking of what has already been applied to the engine. */
interface AppliedState {
  woStates: Map<string, WoState>;
  trophies: Set<string>;
  gateOpen: boolean;
}

/**
 * Apply the DIFF between the snapshot and the engine's already-applied state.
 * Only changes reach the engine, so an in-flight walk is never restarted.
 */
function applyDiff(
  engine: FraguaEngine,
  input: Pick<UseFraguaSpritesInput, "running" | "trophies" | "gate">,
  applied: AppliedState,
): void {
  for (const { wo, state } of input.running) {
    if (applied.woStates.get(wo) !== state) {
      engine.setWo(wo, state);
      applied.woStates.set(wo, state);
    }
  }
  // WOs that left the running list (verified at the gate, or the wave moved on):
  // retire them from the engine so their forge/tribunal slot frees up.
  for (const wo of [...applied.woStates.keys()]) {
    if (!input.running.some((r) => r.wo === wo)) {
      applied.woStates.delete(wo);
      engine.verifyWo(wo);
    }
  }
  for (const { wo } of input.trophies) {
    if (!applied.trophies.has(wo)) {
      applied.trophies.add(wo);
      if (!applied.woStates.has(wo)) engine.verifyWo(wo);
    }
  }
  if (input.gate.open && !applied.gateOpen) {
    applied.gateOpen = true;
    engine.openGate();
  }
}

/**
 * Mount the La Fragua engine and drive the stage-level sprite positions from it.
 *
 * @param input - Snapshot-derived sprite list + engine seed + reduced-motion flag.
 * @returns The ref-callback factory for the sprite wrappers.
 */
export function useFraguaSprites(input: UseFraguaSpritesInput): UseFraguaSpritesResult {
  const { frdId, running, trophies, gate, mode, wave, reducedMotion } = input;

  /** Per-WO wrapper elements, keyed by WO id. */
  const spriteEls = useRef<Map<string, HTMLDivElement>>(new Map());

  /** RAF self-stop discipline (PARTY.md §5): a new run invalidates the old. */
  const runIdRef = useRef<number>(0);

  /** Stable ref-callback factory — one per WO id, memoised across renders. */
  const refCbCache = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());

  /** The persistent engine for the current (frd, mode, wave) scene. */
  const engineRef = useRef<FraguaEngine | null>(null);

  /** What has already been applied to the engine (diff base). */
  const appliedRef = useRef<AppliedState>({
    woStates: new Map(),
    trophies: new Set(),
    gateOpen: false,
  });

  /** Latest snapshot slice, readable from the lifecycle effect without re-running it. */
  const latestInputRef = useRef({ running, trophies, gate });
  latestInputRef.current = { running, trophies, gate };

  const registerSprite = useCallback((wo: string): ((el: HTMLDivElement | null) => void) => {
    const cached = refCbCache.current.get(wo);
    if (cached !== undefined) return cached;
    const cb = (el: HTMLDivElement | null): void => {
      if (el === null) spriteEls.current.delete(wo);
      else spriteEls.current.set(wo, el);
    };
    refCbCache.current.set(wo, cb);
    return cb;
  }, []);

  /** Write the engine's current positions into the sprite wrapper elements. */
  const paint = useCallback((): void => {
    const engine = engineRef.current;
    if (engine === null) return;
    for (const sprite of engine.wos()) {
      const el = spriteEls.current.get(sprite.wo);
      if (el === undefined) continue;
      // transform, not left/top: a translate write stays on the compositor (no
      // layout pass per frame) — the Fase 3 perf budget (<2ms/frame main thread).
      el.style.transform = `translate(${sprite.px - SPRITE_HALF}px, ${sprite.py - SPRITE_HALF}px)`;
    }
  }, []);

  // Engine lifecycle: ONE engine per scene identity (frd/mode/wave/motion).
  // Snapshot data changes do NOT pass through here — the diff effect below
  // applies them — so a live SSE frame never resets an in-flight walk.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frdId is the scene identity — a FRD change must RESET the engine (fresh rooms/slots) even though the effect body never reads it.
  useEffect(() => {
    const engine = createFraguaEngine({ mode, wave });
    engineRef.current = engine;
    appliedRef.current = { woStates: new Map(), trophies: new Set(), gateOpen: false };
    applyDiff(engine, latestInputRef.current, appliedRef.current);

    if (reducedMotion) {
      // Static placement: the engine initialises sprites AT their target slot,
      // so a single paint puts each sprite in the correct room (no animation).
      paint();
      return () => {
        runIdRef.current++;
        engineRef.current = null;
      };
    }

    const myRunId = ++runIdRef.current;

    function tick(): void {
      if (runIdRef.current !== myRunId) return;
      if (typeof document !== "undefined" && document.hidden) {
        requestAnimationFrame(tick);
        return;
      }
      engine.tick(performance.now());
      paint();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return () => {
      runIdRef.current++;
      engineRef.current = null;
    };
  }, [frdId, mode, wave, reducedMotion, paint]);

  // Diff effect: feed snapshot CHANGES to the persistent engine. Under reduced
  // motion there is no RAF, so re-paint once after each diff (sprites are
  // initialised/moved AT their targets).
  useEffect(() => {
    const engine = engineRef.current;
    if (engine === null) return;
    applyDiff(engine, { running, trophies, gate }, appliedRef.current);
    if (reducedMotion) paint();
  }, [running, trophies, gate, reducedMotion, paint]);

  return { registerSprite };
}
