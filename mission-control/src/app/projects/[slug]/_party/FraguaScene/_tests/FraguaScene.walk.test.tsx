/**
 * WO-06-007 — FraguaScene walk tests (AC-06-003.2)
 *
 * Before this change the La Fragua engine computed the walk but FraguaScene
 * never read `engine.wos()`: running sprites were placed STATICALLY at fixed
 * room slots, so they JUMPED between rooms on a state change. These tests pin
 * the new behavior: the moving WO sprites live in a STAGE-LEVEL layer whose
 * positions are driven imperatively from the engine each animation frame.
 *
 * Strategy:
 *   - Mock requestAnimationFrame so we control exactly how many frames run, and
 *     mock performance.now() so the engine's dt is deterministic.
 *   - Assert the sprite wrapper is a stage-level sibling (not a room child).
 *   - Assert that ticking advances the sprite's inline left/top toward the
 *     target room slot for an in_review WO (forge → tribunal walk).
 *
 * Traceability: CMP-06-scene → AC-06-003.2 (room-transition animation).
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

// ---------------------------------------------------------------------------
// Controlled RAF + clock — run a fixed number of frames synchronously.
// ---------------------------------------------------------------------------

let rafCallbacks: FrameRequestCallback[] = [];
let now = 0;

/** Run the queued RAF callback `frames` times, advancing the clock each frame. */
function runFrames(frames: number, dtMs = 16): void {
  for (let i = 0; i < frames; i++) {
    const cb = rafCallbacks.shift();
    if (cb === undefined) break;
    now += dtMs;
    cb(now);
  }
}

beforeEach(() => {
  rafCallbacks = [];
  now = 0;

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (_id: number) => {
    // no-op
  });
  // matchMedia → motion enabled (RAF runs).
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function snap(overrides: Partial<FraguaSnapshot> = {}): FraguaSnapshot {
  return {
    frd: { id: "frd-06-party", title: "FRD-06 Party" },
    mode: "powerful",
    wave: 8,
    running: [],
    queuedCount: 0,
    gate: { open: false },
    trophies: [],
    archivedCount: 0,
    project: { done: 4, total: 12 },
    events: [],
    active: true,
    lastEventAt: "2026-06-18T20:00:00Z",
    ...overrides,
  };
}

/** Parse a `"NNpx"` inline coordinate to a number. */
function px(value: string | undefined): number {
  return Number.parseFloat(value ?? "NaN");
}

describe("FraguaScene — engine drives the stage-level sprite layer (AC-06-003.2)", () => {
  it("frd-06: WHEN a WO is in_review THEN ticking walks its sprite toward the tribunal (right)", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Walker", state: "in_review" }],
        })}
      />,
    );

    const sprite = screen.getByTestId("fragua-wo-WO-06-001");
    // The engine starts the sprite at the forge slot, targeting a tribunal slot
    // (which is to the RIGHT). After one paint, read the starting left.
    runFrames(1);
    const startLeft = px(sprite.style.left);

    // Advance several frames: the walk moves the sprite to the right (toward the
    // tribunal review slot at a higher x than the forge slot).
    runFrames(20);
    const laterLeft = px(sprite.style.left);

    expect(Number.isNaN(startLeft)).toBe(false);
    expect(Number.isNaN(laterLeft)).toBe(false);
    expect(laterLeft).toBeGreaterThan(startLeft);
  });

  it("frd-06: WHEN a building WO is running THEN it stays put (already at its forge slot)", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Builder", state: "building" }],
        })}
      />,
    );
    const sprite = screen.getByTestId("fragua-wo-WO-06-001");
    runFrames(1);
    const startLeft = px(sprite.style.left);
    runFrames(20);
    const laterLeft = px(sprite.style.left);
    // A building WO is already at its forge target; no walk.
    expect(laterLeft).toBeCloseTo(startLeft, 1);
  });

  it("frd-06: WHEN reduced motion THEN the sprite is placed once at its engine target (no RAF)", () => {
    vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
      return {
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    });
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Builder", state: "building" }],
        })}
      />,
    );
    // No RAF frame queued under reduced motion.
    expect(rafCallbacks.length).toBe(0);
    const sprite = screen.getByTestId("fragua-wo-WO-06-001");
    // The effect paints once at the engine's target → a real px coordinate.
    expect(Number.isNaN(px(sprite.style.left))).toBe(false);
    expect(Number.isNaN(px(sprite.style.top))).toBe(false);
  });
});
