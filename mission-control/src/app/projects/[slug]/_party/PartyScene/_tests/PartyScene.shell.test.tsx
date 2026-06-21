/**
 * WO-06-007 — PartyScene shell tests (RED phase)
 *
 * PartyScene is rewritten as the OUTER CHROME SHELL that frames the stage with:
 *   - MissionBar (data-testid="mission-bar-root") — FRD pips + global WO counter + effort
 *   - FlowStrip (data-testid="flow-strip-root") — always-visible 8-beat pipeline row
 *   - Scene title ("La Fragua") above the stage
 *   - PowerOffOverlay (data-testid="power-off-overlay-root") — derived from active state
 *   - FraguaScene inside — the living map with the three rooms + sprites
 *
 * PartyScene accepts a `FraguaSnapshot` and renders the outer chrome + the stage.
 *
 * Acceptance criteria:
 *   AC-06-010 — FlowStrip always visible, lights active beats
 *   AC-06-009 — MissionBar effort is read-only data (no button/input/select)
 *   AC-06-013 — factory-off derived from snapshot.active, never a control
 *
 * Traceability:
 *   WO-06-007 → CMP-06-scene (the shell + stage)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { PartyScene } from "../PartyScene";

// ---------------------------------------------------------------------------
// RAF mock — FraguaScene inside PartyScene uses requestAnimationFrame
// ---------------------------------------------------------------------------
vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});

// ---------------------------------------------------------------------------
// Snapshot factory
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Suite 1: MissionBar FND-4 primitive (AC-06-009, AC-06-012.3)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — MissionBar primitive (AC-06-009)", () => {
  it("frd-06: WHEN rendered THEN MissionBar is present (data-testid=mission-bar-root)", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN MissionBar counter shows project done/total", () => {
    render(<PartyScene snapshot={snap({ project: { done: 7, total: 20 } })} />);
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter.textContent).toContain("7");
    expect(counter.textContent).toContain("20");
  });

  it("frd-06: WHEN rendered THEN MissionBar effort shows mode as read-only text (DR-061)", () => {
    render(<PartyScene snapshot={snap({ mode: "powerful" })} />);
    const effort = screen.getByTestId("mission-bar-effort");
    expect(effort.textContent).toMatch(/potente|powerful/i);
  });

  it("frd-06: WHEN rendered THEN MissionBar has NO button (effort is not a control)", () => {
    render(<PartyScene snapshot={snap()} />);
    const bar = screen.getByTestId("mission-bar-root");
    expect(bar.querySelector("button")).toBeNull();
    expect(bar.querySelector("select")).toBeNull();
    expect(bar.querySelector("input")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: FlowStrip FND-4 primitive (AC-06-010)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — FlowStrip primitive (AC-06-010)", () => {
  it("frd-06: WHEN rendered THEN FlowStrip is present (data-testid=flow-strip-root)", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN FlowStrip shows 8 beats (the complete pipeline)", () => {
    render(<PartyScene snapshot={snap()} />);
    const beats = screen.getAllByTestId(/^flow-beat-/);
    expect(beats).toHaveLength(8);
  });

  it("frd-06: WHEN rendered THEN FlowStrip is always visible regardless of active state", () => {
    // Even when factory is off, the flow strip is visible
    render(<PartyScene snapshot={snap({ active: false })} />);
    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: PowerOffOverlay FND-4 primitive (AC-06-013)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — PowerOffOverlay primitive (AC-06-013)", () => {
  it("frd-06: WHEN rendered with active=true THEN PowerOffOverlay has data-off=false", () => {
    render(<PartyScene snapshot={snap({ active: true })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay.getAttribute("data-off")).toBe("false");
  });

  it("frd-06: WHEN rendered with active=false THEN PowerOffOverlay has data-off=true", () => {
    render(<PartyScene snapshot={snap({ active: false })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay.getAttribute("data-off")).toBe("true");
  });

  it("frd-06: WHEN factory is off THEN PowerOffOverlay is present (never a blank screen)", () => {
    render(<PartyScene snapshot={snap({ active: false })} />);
    expect(screen.getByTestId("power-off-overlay-root")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Container and accessibility
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — container and accessibility", () => {
  it("frd-06: WHEN rendered THEN there is a scene title with 'La Fragua'", () => {
    render(<PartyScene snapshot={snap()} />);
    const titles = screen.getAllByText(/La Fragua/i);
    expect(titles.length).toBeGreaterThan(0);
  });

  it("frd-06: WHEN rendered THEN there are NO button elements (observation-only)", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN there are no input elements", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN there are no combobox/select elements", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN FraguaScene (the living map) is inside PartyScene", () => {
    render(<PartyScene snapshot={snap()} />);
    // FraguaScene renders fragua-scene at its root
    expect(screen.getByTestId("fragua-scene")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Read-only invariant (DR-061)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — read-only invariant (DR-061)", () => {
  it("frd-06: WHEN rendered THEN there is no 'Pausar', 'Reiniciar' or mode selector text", () => {
    render(<PartyScene snapshot={snap()} />);
    expect(screen.queryByText(/pausar|reiniciar|redirigir/i)).toBeNull();
  });

  it("frd-06: WHEN rendered THEN DemoControls badge is NOT present in production render", () => {
    // DemoControls (demo-controls-badge) should NOT appear in the default production render
    render(<PartyScene snapshot={snap()} />);
    expect(screen.queryByTestId("demo-controls-badge")).toBeNull();
  });
});
