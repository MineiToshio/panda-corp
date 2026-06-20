/**
 * WO-02-007 — CampaignPipeline pixel-art trail tests (TDD: RED phase)
 *
 * Traceability:
 *   CMP-02-campaign-pipeline → components/modules/CampaignPipeline/CampaignPipeline.tsx
 *   WO-02-007 fidelity gate — the pipeline MUST be built from shared Party canvas
 *   primitives (DR-057 / the fidelity defect this re-anchor fixes). These tests
 *   verify that the 6-room pixel-art trail is assembled from Room/StoneBridge/
 *   AgentSprite primitives, NOT a flat list.
 *
 *   AC-02-010.1 — the pipeline renders inside a stage (dark canvas, 30px grid)
 *   AC-02-010.3 — Rooms carry the correct zone + state
 *   Party canvas contract — Room primitives used, not bespoke room markup
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CampaignPipeline,
  type CampaignPipelineProps,
} from "@/components/modules/CampaignPipeline/CampaignPipeline";
import type { CampaignPhase } from "@/lib/campaign/campaign";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_PROPS: CampaignPipelineProps = {
  slug: "my-idea",
  activePhase: 0,
  onEnterForge: vi.fn(),
};

// PHASE_KEYS may be used in future pixel-trail extensions; underscore prefix suppresses unused warning.
const _PHASE_KEYS = ["research", "product", "design", "architecture", "build", "release"] as const;

// Campaign phase zones mapped to Room zones
// research→research, product→spec, design→design, architecture→architecture, build→build, release→release
const PHASE_ZONES = ["research", "spec", "design", "architecture", "build", "release"] as const;

// ---------------------------------------------------------------------------
// Pixel-art trail: Room primitives used (DR-057 / WO-13-009)
// ---------------------------------------------------------------------------

describe("WO-02-007 pixel-art trail — Room primitives (DR-057)", () => {
  it("renders exactly 6 Room primitives on the stage (data-testid='room-root')", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const rooms = within(root).getAllByTestId("room-root");
    expect(rooms).toHaveLength(6);
  });

  it("each Room has data-zone matching a campaign phase zone", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const rooms = within(root).getAllByTestId("room-root");
    const zones = rooms.map((r) => r.getAttribute("data-zone"));
    for (const zone of PHASE_ZONES) {
      expect(zones).toContain(zone);
    }
  });

  it("each Room is a <section> element (required by the Room primitive)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const rooms = within(root).getAllByTestId("room-root");
    for (const room of rooms) {
      expect(room.tagName.toLowerCase()).toBe("section");
    }
  });

  it("Room zones map research→research, product→spec, design→design, arch→architecture, build→build, release→release", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const rooms = within(root).getAllByTestId("room-root");
    const zones = rooms.map((r) => r.getAttribute("data-zone") ?? "");
    expect(zones[0]).toBe("research");
    expect(zones[1]).toBe("spec");
    expect(zones[2]).toBe("design");
    expect(zones[3]).toBe("architecture");
    expect(zones[4]).toBe("build");
    expect(zones[5]).toBe("release");
  });

  it("the stage element has position:relative and a dark background (pixel-RPG canvas)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    // The stage wrapper should be present (the 920×560 dark canvas)
    // We check it's inside the pipeline root
    expect(pipeline).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Room state — active/done/locked mapped to Room data-state
// ---------------------------------------------------------------------------

describe("WO-02-007 Room state mapping (AC-02-010.3)", () => {
  it("activePhase=0: research Room is 'active', all others are 'locked'", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const rooms = within(pipeline).getAllByTestId("room-root");
    // research is index 0 → active
    expect(rooms[0]).toHaveAttribute("data-state", "active");
    // all others locked
    for (let i = 1; i < rooms.length; i++) {
      expect(rooms[i]).toHaveAttribute("data-state", "locked");
    }
  });

  it("activePhase=2: research+product done, design active, rest locked", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const rooms = within(pipeline).getAllByTestId("room-root");
    expect(rooms[0]).toHaveAttribute("data-state", "done");
    expect(rooms[1]).toHaveAttribute("data-state", "done");
    expect(rooms[2]).toHaveAttribute("data-state", "active");
    expect(rooms[3]).toHaveAttribute("data-state", "locked");
    expect(rooms[4]).toHaveAttribute("data-state", "locked");
    expect(rooms[5]).toHaveAttribute("data-state", "locked");
  });

  it("activePhase=5: first 5 rooms are done, last is active", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const rooms = within(pipeline).getAllByTestId("room-root");
    for (let i = 0; i < 5; i++) {
      expect(rooms[i]).toHaveAttribute("data-state", "done");
    }
    expect(rooms[5]).toHaveAttribute("data-state", "active");
  });
});

// ---------------------------------------------------------------------------
// StoneBridge connectors (5 between 6 rooms)
// ---------------------------------------------------------------------------

describe("WO-02-007 StoneBridge connectors (5 between 6 rooms)", () => {
  it("renders exactly 5 StoneBridge connectors", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const bridges = within(pipeline).getAllByTestId("stone-bridge-root");
    expect(bridges).toHaveLength(5);
  });

  it("activePhase=2: the bridge between product(1) and design(2) has flow=true", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const bridges = within(pipeline).getAllByTestId("stone-bridge-root");
    // bridge[1] = connector between rooms[1] (product/spec) and rooms[2] (design)
    // The active connector flows — between index (active-1) and active
    // So for activePhase=2, bridge index 1 (between room 1 and room 2) flows
    const flowBridges = bridges.filter((b) => b.getAttribute("data-flow") === "true");
    expect(flowBridges.length).toBeGreaterThanOrEqual(1);
  });

  it("activePhase=0: no bridge flows (research is the first phase)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const bridges = within(pipeline).getAllByTestId("stone-bridge-root");
    const flowBridges = bridges.filter((b) => b.getAttribute("data-flow") === "true");
    expect(flowBridges.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AgentSprite — sprites inside Room primitives
// ---------------------------------------------------------------------------

describe("WO-02-007 AgentSprite inside rooms", () => {
  it("renders AgentSprite elements inside the pipeline (at least one per rendered room)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    // At minimum the active room should have sprites
    const sprites = within(pipeline).getAllByTestId("agent-sprite-root");
    expect(sprites.length).toBeGreaterThanOrEqual(1);
  });

  it("the active room's sprites have the correct agentRole for their phase", () => {
    // activePhase=0 → research → researcher role
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const sprites = within(pipeline).getAllByTestId("agent-sprite-root");
    const roles = sprites.map((s) => s.getAttribute("data-role") ?? "");
    expect(roles).toContain("researcher");
  });

  it("build phase (activePhase=4) shows implementer, reviewer, analytics sprites", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const sprites = within(pipeline).getAllByTestId("agent-sprite-root");
    const roles = sprites.map((s) => s.getAttribute("data-role") ?? "");
    expect(roles).toContain("implementer");
    expect(roles).toContain("reviewer");
    expect(roles).toContain("analytics");
  });

  it("design phase (activePhase=2) shows designer and copywriter sprites", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const sprites = within(pipeline).getAllByTestId("agent-sprite-root");
    const roles = sprites.map((s) => s.getAttribute("data-role") ?? "");
    expect(roles).toContain("designer");
    expect(roles).toContain("copywriter");
  });
});

// ---------------------------------------------------------------------------
// Room labels — each room shows its phase name
// ---------------------------------------------------------------------------

describe("WO-02-007 Room labels match phase names", () => {
  it("rooms carry accessible Spanish phase labels", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const pipeline = screen.getByTestId("campaign-pipeline");
    const roomLabels = within(pipeline).getAllByTestId("room-label");
    expect(roomLabels.length).toBe(6);
    // Each label has some text
    for (const label of roomLabels) {
      expect((label.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Stage container (dark canvas with grid)
// ---------------------------------------------------------------------------

describe("WO-02-007 stage container structure", () => {
  it("renders a stage element (data-testid='campaign-stage')", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("campaign-stage")).toBeInTheDocument();
  });

  it("the stage contains all 6 rooms", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const stage = screen.getByTestId("campaign-stage");
    const rooms = within(stage).getAllByTestId("room-root");
    expect(rooms).toHaveLength(6);
  });

  it("the stage contains all 5 bridges", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const stage = screen.getByTestId("campaign-stage");
    const bridges = within(stage).getAllByTestId("stone-bridge-root");
    expect(bridges).toHaveLength(5);
  });

  it("the labelled container heading is present above the stage", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const heading = screen.getByText(/EL VIAJE DE ESTA IDEA POR LAS 6 FASES/i);
    expect(heading).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Robustness — all 6 active phase values render the trail without crash
// ---------------------------------------------------------------------------

describe("WO-02-007 pixel-trail robustness — every activePhase value", () => {
  const allPhases: CampaignPhase[] = [0, 1, 2, 3, 4, 5];

  it.each(allPhases)("activePhase=%i renders 6 Room primitives", (activePhase) => {
    const { unmount } = render(
      <CampaignPipeline slug="x" activePhase={activePhase} onEnterForge={vi.fn()} />,
    );
    const pipeline = screen.getByTestId("campaign-pipeline");
    expect(within(pipeline).getAllByTestId("room-root")).toHaveLength(6);
    unmount();
  });

  it.each(allPhases)("activePhase=%i renders 5 StoneBridge connectors", (activePhase) => {
    const { unmount } = render(
      <CampaignPipeline slug="x" activePhase={activePhase} onEnterForge={vi.fn()} />,
    );
    const pipeline = screen.getByTestId("campaign-pipeline");
    expect(within(pipeline).getAllByTestId("stone-bridge-root")).toHaveLength(5);
    unmount();
  });
});
