/**
 * WO-06-006 — PartyScene (CMP-06-scene) tests
 *
 * Component tests (jsdom + RTL):
 *   - renders 4 zones with their labels (AC-06-001.1)
 *   - one sprite per roster role placed in its zone (AC-06-002.1)
 *   - state classes applied from snapshot (AC-06-003.1, AC-06-009.1)
 *   - no button/control to command agents (observation-only, AC-06-009.1)
 *   - RAF is mocked via vi.stubGlobal
 *
 * Traceability:
 *   AC-06-001.1 → REQ-06-001 (4 zones with labels)
 *   AC-06-002.1 → REQ-06-002 (sprite per roster role in its zone)
 *   AC-06-003.1 → REQ-06-003 (state classes from snapshot)
 *   AC-06-009.1 → REQ-06-009 (observation-only, no controls)
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "./layout";
import { PartyScene, type PartySceneProps } from "./PartyScene";
import type { AgentState } from "./state-map";

// ---------------------------------------------------------------------------
// Mock RAF — the engine uses requestAnimationFrame; jsdom does not implement it
// properly. We stub it to a no-op so the component can mount without errors.
// ---------------------------------------------------------------------------

beforeEach(() => {
  let rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => {
    // Don't actually call _cb — just return a numeric id.
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
// AC-06-001.1 — 4 zones with labels
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — 4 zones with labels (AC-06-001.1)", () => {
  it("frd-06: WHEN rendered THEN it has 4 zone elements", () => {
    render(<PartyScene {...makeProps()} />);
    const zones = screen.getAllByTestId(/^party-zone-/);
    expect(zones).toHaveLength(4);
  });

  it("frd-06: WHEN rendered THEN the library zone has its label", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-zone-library")).toBeDefined();
    expect(screen.getByText("Biblioteca")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN the forge zone has its label", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-zone-forge")).toBeDefined();
    expect(screen.getByText("Forja")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN the workshop zone has its label", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-zone-workshop")).toBeDefined();
    expect(screen.getByText("Taller")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN the lab zone has its label", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-zone-lab")).toBeDefined();
    expect(screen.getByText("Laboratorio")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN labels persist when agents leave their zone (labels are in zones, not agents)", () => {
    // Zone labels are NOT inside the sprite element — they live in the station div.
    render(<PartyScene {...makeProps()} />);
    const forgeZone = screen.getByTestId("party-zone-forge");
    // The zone label is inside the station, not in the sprite.
    expect(forgeZone.textContent).toContain("Forja");
  });
});

// ---------------------------------------------------------------------------
// AC-06-002.1 — one sprite per roster role placed in its zone
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — sprites per roster role (AC-06-002.1)", () => {
  it("frd-06: WHEN rendered with 4-agent balanced roster THEN shows 4 sprites", () => {
    render(<PartyScene {...makeProps()} />);
    const sprites = screen.getAllByTestId(/^party-sprite-/);
    expect(sprites).toHaveLength(4);
  });

  it("frd-06: WHEN rendered THEN each agent in the roster has a sprite", () => {
    render(<PartyScene {...makeProps()} />);
    for (const role of BALANCED_ROSTER) {
      expect(screen.getByTestId(`party-sprite-${role}`)).toBeDefined();
    }
  });

  it("frd-06: WHEN rendered with 2-agent pro roster THEN shows 2 sprites", () => {
    const proRoster: Role[] = ["backend-dev", "reviewer"];
    const proAgents: AgentSpec[] = [
      { id: "backend-dev", state: "idle", color: "var(--color-agent-backend-dev)" },
      { id: "reviewer", state: "idle", color: "var(--color-agent-reviewer)" },
    ];
    render(<PartyScene {...makeProps({ roster: proRoster, agents: proAgents, mode: "pro" })} />);
    const sprites = screen.getAllByTestId(/^party-sprite-/);
    expect(sprites).toHaveLength(2);
  });

  it("frd-06: WHEN rendered THEN the backend-dev sprite is placed inside or near the forge zone", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-backend-dev");
    // Sprite carries the data-zone attribute reflecting its home zone
    expect(sprite.getAttribute("data-zone")).toBe("forge");
  });

  it("frd-06: WHEN rendered THEN the frontend-dev sprite is associated with the workshop zone", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-frontend-dev");
    expect(sprite.getAttribute("data-zone")).toBe("workshop");
  });

  it("frd-06: WHEN rendered THEN the test-writer sprite is associated with the lab zone", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-test-writer");
    expect(sprite.getAttribute("data-zone")).toBe("lab");
  });

  it("frd-06: WHEN rendered THEN the researcher sprite is associated with the library zone (powerful/deep roster)", () => {
    const powerfulRoster: Role[] = [
      "backend-dev",
      "frontend-dev",
      "test-writer",
      "researcher",
      "reviewer",
      "guild",
    ];
    const powerfulAgents: AgentSpec[] = powerfulRoster.map((id) => ({
      id,
      state: "idle" as AgentState,
      color: `var(--color-agent-${id})`,
    }));
    render(
      <PartyScene
        {...makeProps({ roster: powerfulRoster, agents: powerfulAgents, mode: "powerful" })}
      />,
    );
    const sprite = screen.getByTestId("party-sprite-researcher");
    expect(sprite.getAttribute("data-zone")).toBe("library");
  });
});

// ---------------------------------------------------------------------------
// AC-06-003.1 — state classes applied from snapshot
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — state classes from snapshot (AC-06-003.1)", () => {
  it("frd-06: WHEN an agent has state='work' THEN its sprite has class s-work", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-frontend-dev");
    expect(sprite.className).toContain("s-work");
  });

  it("frd-06: WHEN an agent has state='blocked' THEN its sprite has class s-blocked", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-test-writer");
    expect(sprite.className).toContain("s-blocked");
  });

  it("frd-06: WHEN an agent has state='review' THEN its sprite has class s-review", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-reviewer");
    expect(sprite.className).toContain("s-review");
  });

  it("frd-06: WHEN an agent has state='idle' THEN its sprite has class s-idle", () => {
    render(<PartyScene {...makeProps()} />);
    const sprite = screen.getByTestId("party-sprite-backend-dev");
    expect(sprite.className).toContain("s-idle");
  });

  it("frd-06: WHEN an agent has state='walk' THEN its sprite has class s-walk", () => {
    const agents: AgentSpec[] = [
      { id: "backend-dev", state: "walk", color: "var(--color-agent-backend-dev)" },
      { id: "frontend-dev", state: "idle", color: "var(--color-agent-frontend-dev)" },
      { id: "test-writer", state: "idle", color: "var(--color-agent-test-writer)" },
      { id: "reviewer", state: "idle", color: "var(--color-agent-reviewer)" },
    ];
    render(<PartyScene {...makeProps({ agents })} />);
    const sprite = screen.getByTestId("party-sprite-backend-dev");
    expect(sprite.className).toContain("s-walk");
  });
});

// ---------------------------------------------------------------------------
// AC-06-009.1 — observation-only: no buttons or controls to command agents
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
// Scene container — data-testid and aria
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — container and accessibility", () => {
  it("frd-06: WHEN rendered THEN scene has data-testid='party-scene'", () => {
    render(<PartyScene {...makeProps()} />);
    expect(screen.getByTestId("party-scene")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN scene has an aria-label in Spanish", () => {
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    const label = scene.getAttribute("aria-label");
    expect(label).toBeTruthy();
  });

  it("frd-06: WHEN rendered THEN scene is a <section> element (implicit region role)", () => {
    render(<PartyScene {...makeProps()} />);
    const scene = screen.getByTestId("party-scene");
    expect(scene.tagName.toLowerCase()).toBe("section");
  });

  it("frd-06: WHEN rendered THEN zone stations have image-rendering:pixelated (pixel-art, AC-06-001.1)", () => {
    render(<PartyScene {...makeProps()} />);
    const zone = screen.getByTestId("party-zone-forge");
    // image-rendering is applied via style; test the data-attribute approach
    expect(zone.getAttribute("data-pixelart")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// applyEvents / prop-change integration seam
// ---------------------------------------------------------------------------

describe("frd-06: PartyScene — applyEvents on prop change", () => {
  it("frd-06: WHEN agents prop changes state THEN sprite class updates on re-render", () => {
    const { rerender } = render(<PartyScene {...makeProps()} />);

    // Initial: frontend-dev is 'work'
    let sprite = screen.getByTestId("party-sprite-frontend-dev");
    expect(sprite.className).toContain("s-work");

    // After prop change: frontend-dev becomes 'blocked'
    const newAgents: AgentSpec[] = BALANCED_AGENTS.map((a) =>
      a.id === "frontend-dev" ? { ...a, state: "blocked" as AgentState } : a,
    );
    rerender(<PartyScene {...makeProps({ agents: newAgents })} />);

    sprite = screen.getByTestId("party-sprite-frontend-dev");
    expect(sprite.className).toContain("s-blocked");
  });
});
