/**
 * WO-06-011 — PartyScene reduced-motion tests — RED phase.
 *
 * FRD-13: the UI SHALL honor `prefers-reduced-motion` — it disables ALL Party animation.
 *
 * Tests:
 *   - WHEN prefers-reduced-motion: reduce THEN the RAF loop is NOT started
 *   - WHEN prefers-reduced-motion: reduce THEN sprites do NOT receive animation classes
 *   - WHEN prefers-reduced-motion: no-preference THEN the RAF loop IS started (control)
 *   - WHEN prefers-reduced-motion: reduce THEN component does not throw
 *
 * Implementation strategy:
 *   PartyScene reads window.matchMedia('(prefers-reduced-motion: reduce)').matches
 *   on mount. When true, it skips calling requestAnimationFrame entirely.
 *   Sprites still render with their state class (s-idle, s-work, etc.) but the
 *   continuous bob/wander animation is not applied (no RAF → no DOM mutation loop).
 *
 * Traceability:
 *   FRD-13 (prefers-reduced-motion) → REQ-06-003 (breathing + wandering when no motion preference)
 *   WO-06-011: Empty state + reduced-motion + multi-project borders
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "./layout";
import { PartyScene, type PartySceneProps } from "./PartyScene";
import type { AgentState } from "./state-map";

// ---------------------------------------------------------------------------
// RAF spy — tracks how many times requestAnimationFrame is called
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
// Fixtures
// ---------------------------------------------------------------------------

type AgentSpec = { id: Role; state: AgentState; color: string };

const BALANCED_ROSTER: Role[] = ["backend-dev", "frontend-dev", "test-writer", "reviewer"];

const BALANCED_AGENTS: AgentSpec[] = [
  { id: "backend-dev", state: "idle", color: "var(--color-agent-backend-dev)" },
  { id: "frontend-dev", state: "work", color: "var(--color-agent-frontend-dev)" },
  { id: "test-writer", state: "blocked", color: "var(--color-agent-test-writer)" },
  { id: "reviewer", state: "review", color: "var(--color-agent-reviewer)" },
];

function makeProps(overrides: Partial<PartySceneProps> = {}): PartySceneProps {
  return {
    roster: BALANCED_ROSTER,
    agents: BALANCED_AGENTS,
    active: true,
    mode: "balanced",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reduced-motion: RAF loop is NOT started (FRD-13)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — prefers-reduced-motion: reduce — RAF loop skipped (FRD-13)", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN requestAnimationFrame is NOT called", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    expect(rafCallCount).toBe(0);
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN component mounts without throwing", () => {
    stubReducedMotion(true);
    expect(() => render(<PartyScene {...makeProps()} />)).not.toThrow();
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN all 4 zones still render", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const zones = screen.getAllByTestId(/^party-zone-/);
    expect(zones).toHaveLength(4);
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN all sprites still render", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const sprites = screen.getAllByTestId(/^party-sprite-/);
    expect(sprites).toHaveLength(4);
  });

  it("frd-06: WHEN prefers-reduced-motion: reduce THEN sprites still show their initial state class (s-idle, s-work, etc.)", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    // State classes still applied — only the RAF-driven animation is skipped
    const idleSprite = screen.getByTestId("party-sprite-backend-dev");
    expect(idleSprite.className).toContain("s-idle");
    const workSprite = screen.getByTestId("party-sprite-frontend-dev");
    expect(workSprite.className).toContain("s-work");
  });
});

// ---------------------------------------------------------------------------
// Control: no-preference → RAF IS called (confirming the skip is conditional)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — no prefers-reduced-motion preference — RAF loop runs (FRD-13 control)", () => {
  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN requestAnimationFrame IS called at least once", () => {
    stubReducedMotion(false);
    render(<PartyScene {...makeProps()} />);
    // RAF should be called at least once to start the loop
    expect(rafCallCount).toBeGreaterThan(0);
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN component mounts without throwing", () => {
    stubReducedMotion(false);
    expect(() => render(<PartyScene {...makeProps()} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion: data-reduced-motion attribute for test introspection (AC-06-011)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — reduced-motion data attribute", () => {
  it("frd-06: WHEN prefers-reduced-motion: reduce THEN scene has data-reduced-motion='true'", () => {
    stubReducedMotion(true);
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    expect(scene.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN scene does NOT have data-reduced-motion='true'", () => {
    stubReducedMotion(false);
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    expect(scene.getAttribute("data-reduced-motion")).not.toBe("true");
  });
});
