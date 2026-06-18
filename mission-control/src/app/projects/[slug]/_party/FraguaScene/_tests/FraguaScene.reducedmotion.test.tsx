/**
 * WO-06-011 — FraguaScene reduced-motion tests — RED phase.
 *
 * AC-06-010.2: WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL
 * Party animation (sprites static, no RAF loop) while keeping the scene readable.
 *
 * This test targets FraguaScene (CMP-06-scene, the La Fragua faithful model).
 * The equivalent test for the old PartyScene lives in PartyScene.reducedmotion.test.tsx.
 *
 * Strategy:
 *   - Stub `window.matchMedia` to simulate `prefers-reduced-motion: reduce`.
 *   - Spy on `requestAnimationFrame` to verify the RAF loop is NOT started.
 *   - Assert the scene still renders (readable) with all three rooms present.
 *   - Assert `data-reduced-motion="true"` attribute on the scene root.
 *   - Assert NO crash on mount in either reduced/non-reduced state.
 *
 * Traceability:
 *   AC-06-010.2 → REQ-06-010 (reduced-motion)
 *   CMP-06-scene (FraguaScene) — WO-06-011
 *   FRD-13 (prefers-reduced-motion, motion tokens)
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

// ---------------------------------------------------------------------------
// RAF spy — counts how many times requestAnimationFrame is invoked
// ---------------------------------------------------------------------------

let rafCallCount = 0;
let rafId = 0;

beforeEach(() => {
  rafCallCount = 0;
  rafId = 0;

  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => {
    rafCallCount += 1;
    rafId += 1;
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (_id: number) => {
    // no-op
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper: stub matchMedia for prefers-reduced-motion
// ---------------------------------------------------------------------------

function stubReducedMotion(prefersReduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
    const matches = prefersReduced && query === "(prefers-reduced-motion: reduce)";
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
}

// ---------------------------------------------------------------------------
// Snapshot factory
// ---------------------------------------------------------------------------

function snap(overrides: Partial<FraguaSnapshot> = {}): FraguaSnapshot {
  return {
    frd: { id: "frd-06-party", title: "FRD-06 Party" },
    mode: "powerful",
    wave: 8,
    running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
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

// ---------------------------------------------------------------------------
// Suite 1: prefers-reduced-motion: reduce — RAF loop is NOT started (AC-06-010.2)
// ---------------------------------------------------------------------------

describe("FraguaScene — prefers-reduced-motion: reduce — RAF loop skipped (AC-06-010.2)", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN requestAnimationFrame is NOT called", () => {
    stubReducedMotion(true);
    render(<FraguaScene snapshot={snap()} />);
    expect(rafCallCount).toBe(0);
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN component mounts without throwing", () => {
    stubReducedMotion(true);
    expect(() => render(<FraguaScene snapshot={snap()} />)).not.toThrow();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN the scene root is still in the DOM (readable)", () => {
    stubReducedMotion(true);
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-scene")).toBeInTheDocument();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN the three rooms still render", () => {
    stubReducedMotion(true);
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-room-forge")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-room-tribunal")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-room-vault")).toBeInTheDocument();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN running WO sprites still render", () => {
    stubReducedMotion(true);
    render(
      <FraguaScene
        snapshot={snap({
          running: [
            { wo: "WO-06-001", title: "Event vocabulary", state: "building" },
            { wo: "WO-06-002", title: "Layout", state: "building" },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("fragua-wo-WO-06-001")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-wo-WO-06-002")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: data-reduced-motion attribute for CSS targeting (AC-06-010.2)
// ---------------------------------------------------------------------------

describe("FraguaScene — data-reduced-motion attribute (AC-06-010.2)", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN scene root has data-reduced-motion='true'", () => {
    stubReducedMotion(true);
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN scene does NOT have data-reduced-motion='true'", () => {
    stubReducedMotion(false);
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.getAttribute("data-reduced-motion")).not.toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Control — no reduced-motion → RAF IS called (confirming the skip is conditional)
// ---------------------------------------------------------------------------

describe("FraguaScene — no prefers-reduced-motion — RAF loop runs (control)", () => {
  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN requestAnimationFrame IS called at least once", () => {
    stubReducedMotion(false);
    render(<FraguaScene snapshot={snap()} />);
    expect(rafCallCount).toBeGreaterThan(0);
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN component mounts without throwing", () => {
    stubReducedMotion(false);
    expect(() => render(<FraguaScene snapshot={snap()} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: matchMedia absent (jsdom default) — defensive guard, no crash
// ---------------------------------------------------------------------------

describe("FraguaScene — matchMedia absent — no crash (defensive guard)", () => {
  it("frd-06: WHEN window.matchMedia is undefined THEN component does not throw", () => {
    // jsdom does not implement matchMedia; this tests the defensive guard
    vi.stubGlobal("matchMedia", undefined);
    expect(() => render(<FraguaScene snapshot={snap()} />)).not.toThrow();
  });
});
