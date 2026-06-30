/**
 * WO-06-007 — useFraguaSprites: drive the stage-level WO sprite layer from the engine.
 *
 * Bridges the La Fragua engine's animated positions to the DOM:
 *   - React owns the sprite LIST (which WOs exist) from the snapshot.
 *   - The RAF loop owns their POSITIONS, written imperatively each frame.
 *
 * Before WO-06-007 the engine computed the walk (forge→tribunal→vault) but the
 * scene never read `engine.wos()`: running sprites were placed STATICALLY at
 * fixed room slots, so they JUMPED between rooms on a state change. This hook
 * reads `engine.wos()` every frame and updates each sprite wrapper's left/top,
 * so a WO actually WALKS between rooms along the connecting bridges (AC-06-003.2).
 *
 * Determinism / SSR safety:
 *   - The engine is created in an effect (no `performance`/`window` at module scope).
 *   - Sprite wrappers get an initial static-slot position for first paint (SSR);
 *     the effect/RAF then takes over from `engine.wos()`.
 *   - Reduced motion: no RAF loop; positions are placed ONCE at the engine's
 *     target slots (the engine initializes sprites AT their target).
 *
 * Traceability: CMP-06-scene → AC-06-003.2.
 */

import { useCallback, useEffect, useRef } from "react";
import { createFraguaEngine } from "../engine/engine";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

/** Sprite size offset: slots are centers; the 52px sprite is offset by half. */
const SPRITE_HALF = 26;

/** Inputs the hook needs from the snapshot to build + drive the engine. */
export interface UseFraguaSpritesInput {
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

/**
 * Mount the La Fragua engine and drive the stage-level sprite positions from it.
 *
 * @param input - Snapshot-derived sprite list + engine seed + reduced-motion flag.
 * @returns The ref-callback factory for the sprite wrappers.
 */
export function useFraguaSprites(input: UseFraguaSpritesInput): UseFraguaSpritesResult {
  const { running, trophies, gate, mode, wave, reducedMotion } = input;

  /** Per-WO wrapper elements, keyed by WO id. */
  const spriteEls = useRef<Map<string, HTMLDivElement>>(new Map());

  /** RAF self-stop discipline (PARTY.md §5): a new run invalidates the old. */
  const runIdRef = useRef<number>(0);

  /** Stable ref-callback factory — one per WO id, memoised across renders. */
  const refCbCache = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());

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

  useEffect(() => {
    const engine = createFraguaEngine({ mode, wave });

    for (const { wo, state } of running) {
      engine.setWo(wo, state);
    }
    for (const { wo: twoId } of trophies) {
      engine.verifyWo(twoId);
    }
    if (gate.open) engine.openGate();

    /** Write the engine's current positions into the sprite wrapper elements. */
    function paint(): void {
      for (const sprite of engine.wos()) {
        const el = spriteEls.current.get(sprite.wo);
        if (el === undefined) continue;
        el.style.left = `${sprite.px - SPRITE_HALF}px`;
        el.style.top = `${sprite.py - SPRITE_HALF}px`;
      }
    }

    if (reducedMotion) {
      // Static placement: the engine initialises sprites AT their target slot,
      // so a single paint puts each sprite in the correct room (no animation).
      paint();
      return () => {
        runIdRef.current++;
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
    };
  }, [mode, wave, running, trophies, gate.open, reducedMotion]);

  return { registerSprite };
}
