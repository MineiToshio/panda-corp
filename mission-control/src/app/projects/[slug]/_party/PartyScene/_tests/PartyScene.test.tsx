/**
 * WO-06-007 — PartyScene (CMP-06-scene) shell tests
 *
 * Updated by WO-06-007: PartyScene is now the OUTER CHROME SHELL that
 * receives a `FraguaSnapshot` and renders:
 *   - MissionBar (FND-4) — FRD pips + WO counter + effort as read-only data
 *   - FlowStrip (FND-4) — 8-beat pipeline row, always visible
 *   - Scene title "La Fragua"
 *   - FraguaScene (the living map with three rooms + sprites)
 *   - PowerOffOverlay (FND-4) — derived from snapshot.active
 *
 * The old 4-zone (library/forge/workshop/lab) model is replaced by the
 * La Fragua faithful model (Sala de Forja → Tribunal → Bóveda). These
 * tests now verify the shell contract, not the old roster/agents API.
 *
 * Traceability:
 *   WO-06-007 → AC-06-009 (MissionBar effort read-only)
 *   WO-06-007 → AC-06-010 (FlowStrip always visible)
 *   WO-06-007 → AC-06-013 (PowerOffOverlay derived from state)
 *   WO-06-007 → DR-061 (no mode selector, no controls)
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { PartyScene, type PartySceneProps } from "../PartyScene";

// ---------------------------------------------------------------------------
// Mock RAF — FraguaScene inside uses requestAnimationFrame
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
  vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Snapshot factory — default active build
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
// Outer chrome: MissionBar + FlowStrip + scene title
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — MissionBar and FlowStrip (AC-06-009/010)", () => {
  it("frd-06: WHEN rendered THEN MissionBar is present", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN FlowStrip is present", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN FlowStrip shows 8 beats", () => {
    render(<PartyScene {...makeProps()} />);
    const beats = screen.getAllByTestId(/^flow-beat-/);
    expect(beats).toHaveLength(8);
  });

  it("frd-06: WHEN rendered THEN the shell carries the La Fragua aria-label (no duplicated title row — owner, 2026-07-02)", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByLabelText(/La Fragua — sala de construcción/i)).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN MissionBar effort is read-only text (no button)", () => {
    render(<PartyScene {...makeProps({ mode: "powerful" })} />);
    const bar = screen.getByTestId("mission-bar-root");
    expect(bar.querySelector("button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PowerOffOverlay — derived from snapshot.active (AC-06-013)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene shell — PowerOffOverlay from active state (AC-06-013)", () => {
  it("frd-06: WHEN active=true THEN PowerOffOverlay has data-off=false", () => {
    render(<PartyScene {...makeProps({ active: true })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay.getAttribute("data-off")).toBe("false");
  });

  it("frd-06: WHEN active=false THEN PowerOffOverlay has data-off=true", () => {
    render(<PartyScene {...makeProps({ active: false })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay.getAttribute("data-off")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant (AC-06-009.1, DR-061)
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — observation-only (AC-06-009.1)", () => {
  it("frd-06: WHEN rendered THEN there are NO button elements in the scene", () => {
    render(<PartyScene {...makeProps()} />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN there are no input elements to control agents", () => {
    render(<PartyScene {...makeProps()} />);
    const inputs = screen.queryAllByRole("textbox");
    expect(inputs).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN there are no combobox/select to command agents", () => {
    render(<PartyScene {...makeProps()} />);
    const selects = screen.queryAllByRole("combobox");
    expect(selects).toHaveLength(0);
  });

  it("frd-06: WHEN rendered THEN there is no 'Pausar' or 'Redirigir' button", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.queryByText(/pausar|redirigir|detener|controlar/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Container and accessibility
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — container and accessibility", () => {
  it("frd-06: WHEN rendered THEN scene has data-testid='party-scene'", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-scene")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN scene has an aria-label in Spanish", () => {
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    const label = scene.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/La Fragua|fragua|sala/i);
  });

  it("frd-06: WHEN rendered THEN scene is a <section> element", () => {
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    expect(scene.tagName.toLowerCase()).toBe("section");
  });

  it("frd-06: WHEN rendered THEN FraguaScene is embedded inside PartyScene", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("fragua-scene")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN the three La Fragua rooms are visible (Sala de Forja, Tribunal, Bóveda)", () => {
    render(<PartyScene {...makeProps()} />);
    const rooms = screen.getAllByTestId("room-root");
    expect(rooms).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Prop change — snapshot updates drive the scene
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — snapshot-driven updates", () => {
  it("frd-06: WHEN running WOs in snapshot THEN AgentSprites appear in the forge", () => {
    render(
      <PartyScene
        {...makeProps({
          running: [{ wo: "WO-06-001", title: "First", state: "building" }],
        })}
      />,
    );
    const sprites = screen.getAllByTestId("agent-sprite-root");
    expect(sprites.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-06: WHEN active changes to false THEN PowerOffOverlay becomes visible", () => {
    const { rerender } = render(<PartyScene {...makeProps({ active: true })} />);
    expect(screen.getByTestId("power-off-overlay-root").getAttribute("data-off")).toBe("false");

    rerender(<PartyScene {...makeProps({ active: false })} />);
    expect(screen.getByTestId("power-off-overlay-root").getAttribute("data-off")).toBe("true");
  });
});
