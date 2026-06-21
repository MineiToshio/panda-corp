/**
 * WO-06-007 — FraguaScene FND-4 primitive composition tests (RED phase)
 *
 * These tests verify that FraguaScene composes the VERIFIED FND-4 Party canvas
 * primitives (WO-06-006 / WO-13-009):
 *   - Room primitive (data-testid="room-root", data-zone=*)
 *   - AgentSprite primitive (data-testid="agent-sprite-root", data-role=*)
 *   - JudgeSprite primitive (data-testid="judge-sprite-root", data-active=*)
 *   - StoneBridge primitive (data-testid="stone-bridge-root", data-orientation=*)
 *   - Parchment primitive (data-testid="parchment-root")
 *
 * Traceability:
 *   WO-06-007 → AC-06-001 (sprites composed from AgentSprite FND-4 primitive)
 *   WO-06-007 → AC-06-003 (rooms composed from Room FND-4 primitive)
 *   WO-06-007 → AC-06-004 (reviewer composed from JudgeSprite FND-4 primitive)
 *   WO-06-007 → AC-06-006 (parchment composed from Parchment FND-4 primitive)
 *   Fidelity → stage layout 920×560 matching mocks/la-fragua.html
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

// ---------------------------------------------------------------------------
// RAF mock — FraguaScene uses requestAnimationFrame
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
// Suite 1: Room FND-4 primitive used for the three rooms (AC-06-003)
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — Room primitive for three rooms", () => {
  it("frd-06: WHEN rendered THEN the forge room uses the Room primitive (data-testid=room-root, data-zone=forge)", () => {
    render(<FraguaScene snapshot={snap()} />);
    const rooms = screen.getAllByTestId("room-root");
    const forgeRoom = rooms.find((r) => r.getAttribute("data-zone") === "forge");
    expect(forgeRoom).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN the tribunal room uses the Room primitive (data-testid=room-root, data-zone=tribunal)", () => {
    render(<FraguaScene snapshot={snap()} />);
    const rooms = screen.getAllByTestId("room-root");
    const tribunalRoom = rooms.find((r) => r.getAttribute("data-zone") === "tribunal");
    expect(tribunalRoom).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN the vault room uses the Room primitive (data-testid=room-root, data-zone=vault)", () => {
    render(<FraguaScene snapshot={snap()} />);
    const rooms = screen.getAllByTestId("room-root");
    const vaultRoom = rooms.find((r) => r.getAttribute("data-zone") === "vault");
    expect(vaultRoom).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN there are exactly 3 Room primitives (one per room)", () => {
    render(<FraguaScene snapshot={snap()} />);
    const rooms = screen.getAllByTestId("room-root");
    expect(rooms).toHaveLength(3);
  });

  it("frd-06: WHEN rendered with a running WO THEN the forge room shows a count chip (Room count prop)", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    // Room primitive renders data-testid="room-count" when count is provided
    const countChips = screen.getAllByTestId("room-count");
    expect(countChips.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: AgentSprite FND-4 primitive used for running WOs (AC-06-001)
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — AgentSprite primitive for running WOs", () => {
  it("frd-06: WHEN one WO is running THEN one AgentSprite is rendered (data-testid=agent-sprite-root)", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    const sprites = screen.getAllByTestId("agent-sprite-root");
    expect(sprites).toHaveLength(1);
  });

  it("frd-06: WHEN three WOs are running THEN three AgentSprites are rendered", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [
            { wo: "WO-06-001", title: "First", state: "building" },
            { wo: "WO-06-002", title: "Second", state: "building" },
            { wo: "WO-06-003", title: "Third", state: "building" },
          ],
        })}
      />,
    );
    const sprites = screen.getAllByTestId("agent-sprite-root");
    expect(sprites).toHaveLength(3);
  });

  it("frd-06: WHEN no WOs are running THEN no AgentSprite is rendered", () => {
    render(<FraguaScene snapshot={snap({ running: [] })} />);
    const sprites = screen.queryAllByTestId("agent-sprite-root");
    // In vault mode there might be trophy sprites — filter by those NOT in vault role
    const nonVaultSprites = sprites.filter((s) => s.getAttribute("data-state") !== "vault");
    expect(nonVaultSprites).toHaveLength(0);
  });

  it("frd-06: WHEN a WO is running THEN the AgentSprite has data-role=implementer", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    const sprite = screen.getByTestId("agent-sprite-root");
    expect(sprite.getAttribute("data-role")).toBe("implementer");
  });

  it("frd-06: WHEN a WO is in_review THEN at least one AgentSprite has state=review", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "in_review" }],
        })}
      />,
    );
    // A WO in_review may appear in both the forge slot and the tribunal section
    // (both rendered for visibility); at least one must have data-state=review
    const sprites = screen.getAllByTestId("agent-sprite-root");
    const reviewSprites = sprites.filter((s) => s.getAttribute("data-state") === "review");
    expect(reviewSprites.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-06: WHEN a WO is building THEN its AgentSprite has state=work", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    const sprites = screen.getAllByTestId("agent-sprite-root");
    expect(sprites.some((s) => s.getAttribute("data-state") === "work")).toBe(true);
  });

  it("frd-06: WHEN a trophy WO is shown THEN its AgentSprite has state=vault", () => {
    render(
      <FraguaScene
        snapshot={snap({
          trophies: [{ wo: "WO-06-001" }],
        })}
      />,
    );
    // Trophy sprites have state=vault
    const vaultSprites = screen
      .getAllByTestId("agent-sprite-root")
      .filter((s) => s.getAttribute("data-state") === "vault");
    expect(vaultSprites).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: JudgeSprite FND-4 primitive used for the reviewer gate (AC-06-004)
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — JudgeSprite primitive for reviewer gate", () => {
  it("frd-06: WHEN rendered THEN the reviewer gate uses the JudgeSprite primitive (data-testid=judge-sprite-root)", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("judge-sprite-root")).toBeInTheDocument();
  });

  it("frd-06: WHEN gate is closed THEN JudgeSprite has data-active=false", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: false } })} />);
    const judge = screen.getByTestId("judge-sprite-root");
    expect(judge.getAttribute("data-active")).toBe("false");
  });

  it("frd-06: WHEN gate is open THEN JudgeSprite has data-active=true", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    const judge = screen.getByTestId("judge-sprite-root");
    expect(judge.getAttribute("data-active")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Suite 4: StoneBridge FND-4 primitive used for room connectors
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — StoneBridge primitives between rooms", () => {
  it("frd-06: WHEN rendered THEN at least one StoneBridge primitive is present (data-testid=stone-bridge-root)", () => {
    render(<FraguaScene snapshot={snap()} />);
    const bridges = screen.getAllByTestId("stone-bridge-root");
    expect(bridges.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-06: WHEN rendered THEN a horizontal bridge (forge→tribunal) is present", () => {
    render(<FraguaScene snapshot={snap()} />);
    const bridges = screen.getAllByTestId("stone-bridge-root");
    const hBridge = bridges.find((b) => b.getAttribute("data-orientation") === "h");
    expect(hBridge).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN a vertical bridge (tribunal→vault) is present", () => {
    render(<FraguaScene snapshot={snap()} />);
    const bridges = screen.getAllByTestId("stone-bridge-root");
    const vBridge = bridges.find((b) => b.getAttribute("data-orientation") === "v");
    expect(vBridge).toBeDefined();
  });

  it("frd-06: WHEN WOs are running THEN bridges have data-flow=true", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    const bridges = screen.getAllByTestId("stone-bridge-root");
    const flowingBridge = bridges.find((b) => b.getAttribute("data-flow") === "true");
    expect(flowingBridge).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Parchment FND-4 primitive (AC-06-006)
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — Parchment primitive for status-note hand-off", () => {
  it("frd-06: WHEN rendered THEN the Parchment primitive is present (data-testid=parchment-root)", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("parchment-root")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Stage layout — 920×560 bounded stage (mock fidelity)
// ---------------------------------------------------------------------------

describe("frd-06: FraguaScene FND-4 — 920×560 stage layout (mock fidelity)", () => {
  it("frd-06: WHEN rendered THEN the stage element has width=920 and height=560 in its style", () => {
    render(<FraguaScene snapshot={snap()} />);
    const stage = screen.getByTestId("fragua-stage");
    const style = stage.getAttribute("style") ?? "";
    expect(style).toMatch(/width.*920/);
    expect(style).toMatch(/height.*560/);
  });

  it("frd-06: WHEN rendered THEN the stage has position:relative for absolute child positioning", () => {
    render(<FraguaScene snapshot={snap()} />);
    const stage = screen.getByTestId("fragua-stage");
    const style = stage.getAttribute("style") ?? "";
    expect(style).toMatch(/position.*relative/);
  });
});
