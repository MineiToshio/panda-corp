/**
 * WO-06-007 — PartyScene reduced-motion tests (updated from WO-06-011)
 *
 * Updated by WO-06-007: PartyScene is now the OUTER CHROME SHELL.
 * The reduced-motion behavior is now inside FraguaScene (embedded in PartyScene).
 *
 * Tests:
 *   - WHEN prefers-reduced-motion: reduce THEN the component mounts without error
 *   - WHEN prefers-reduced-motion: reduce THEN the three rooms still render
 *   - WHEN prefers-reduced-motion: reduce THEN FlowStrip and MissionBar still render
 *   - WHEN prefers-reduced-motion: no-preference THEN component mounts without error
 *   - WHEN prefers-reduced-motion: reduce THEN fragua-scene has data-reduced-motion=true
 *
 * Traceability:
 *   FRD-13 (prefers-reduced-motion) → AC-06-014
 *   WO-06-007 → PartyScene shell + FraguaScene reduced-motion behavior
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { PartyScene, type PartySceneProps } from "../PartyScene";

// ---------------------------------------------------------------------------
// RAF spy
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
  vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});
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

function makeProps(overrides: Partial<FraguaSnapshot> = {}): PartySceneProps {
  return {
    snapshot: {
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
    },
  };
}

// ---------------------------------------------------------------------------
// Reduced-motion: component stays readable (rooms + strips still render)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — prefers-reduced-motion: reduce — readable (FRD-13)", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN component mounts without throwing", () => {
    stubReducedMotion(true);
    expect(() => render(<PartyScene {...makeProps()} />)).not.toThrow();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN the three La Fragua rooms still render", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const rooms = screen.getAllByTestId("room-root");
    expect(rooms).toHaveLength(3);
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN FlowStrip still renders", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN MissionBar still renders", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN fragua-scene has data-reduced-motion=true", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN requestAnimationFrame is NOT called", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    expect(rafCallCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Control: no-preference → RAF runs
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — no prefers-reduced-motion preference (FRD-13 control)", () => {
  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN component mounts without throwing", () => {
    stubReducedMotion(false);
    expect(() => render(<PartyScene {...makeProps()} />)).not.toThrow();
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN requestAnimationFrame IS called", () => {
    stubReducedMotion(false);
    render(<PartyScene {...makeProps()} />);
    expect(rafCallCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion data attribute on FraguaScene
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — reduced-motion data attribute on fragua-scene", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN fragua-scene has data-reduced-motion='true'", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN fragua-scene does NOT have data-reduced-motion='true'", () => {
    stubReducedMotion(false);
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.getAttribute("data-reduced-motion")).not.toBe("true");
  });
});
