/**
 * WO-06 liveness pass — PartyScene build-alive heartbeat.
 *
 * The Party scene is event-driven; between discrete events (a single agent
 * grinding one WO for minutes) nothing moved, so the scene read as dead. The
 * heartbeat conveys liveness from real state: pulsing "forjando en vivo" while
 * active and fresh, slowing to "sin señal reciente" after a quiet gap, and
 * "en espera" when the factory is idle.
 *
 * deriveHeartbeat is a pure function → unit-tested directly with explicit `now`.
 * The component test covers the rendered indicator + the live→stale transition.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { deriveHeartbeat, PartyScene, type PartySceneProps } from "../PartyScene";

const FRESH = "2026-06-18T20:00:00Z";
const FRESH_MS = Date.parse(FRESH);
const ONE_MIN = 60 * 1000;

describe("deriveHeartbeat (pure)", () => {
  it("is 'en espera' (off) when the build is not active", () => {
    const hb = deriveHeartbeat(false, FRESH, FRESH_MS);
    expect(hb.state).toBe("off");
    expect(hb.label).toBe("En espera");
    expect(hb.dotClass).toBeUndefined();
  });

  it("is 'forjando en vivo' (live) when active and the last event is recent", () => {
    const hb = deriveHeartbeat(true, FRESH, FRESH_MS + ONE_MIN);
    expect(hb.state).toBe("live");
    expect(hb.label).toBe("Forjando en vivo");
    expect(hb.dotClass).toBe("fragua-heartbeat");
  });

  it("is 'sin señal reciente' (stale) when active but no event for over 4 minutes", () => {
    const hb = deriveHeartbeat(true, FRESH, FRESH_MS + 5 * ONE_MIN);
    expect(hb.state).toBe("stale");
    expect(hb.label).toBe("Sin señal reciente");
    expect(hb.dotClass).toBe("fragua-heartbeat-stale");
  });

  it("treats active with no lastEventAt as live (never falsely stale)", () => {
    const hb = deriveHeartbeat(true, null, FRESH_MS);
    expect(hb.state).toBe("live");
  });
});

// ---------------------------------------------------------------------------
// Component — heartbeat indicator + live→stale transition over the wall clock
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
      lastEventAt: FRESH,
      ...overrides,
    },
  };
}

describe("PartyScene heartbeat indicator", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
    vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FRESH_MS + ONE_MIN));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders 'forjando en vivo' while active and fresh", () => {
    render(<PartyScene {...makeProps()} />);
    const hb = screen.getByTestId("party-heartbeat");
    expect(hb).toHaveAttribute("data-state", "live");
    expect(hb).toHaveTextContent("Forjando en vivo");
  });

  it("shows 'en espera' when the build is not active", () => {
    render(<PartyScene {...makeProps({ active: false })} />);
    const hb = screen.getByTestId("party-heartbeat");
    expect(hb).toHaveAttribute("data-state", "off");
    expect(hb).toHaveTextContent("En espera");
  });

  it("transitions to 'sin señal reciente' after a quiet gap, without a new event", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-heartbeat")).toHaveAttribute("data-state", "live");

    act(() => {
      vi.advanceTimersByTime(5 * ONE_MIN);
    });

    expect(screen.getByTestId("party-heartbeat")).toHaveAttribute("data-state", "stale");
  });
});
