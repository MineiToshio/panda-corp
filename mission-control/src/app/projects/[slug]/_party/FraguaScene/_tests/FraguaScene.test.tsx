/**
 * WO-06-006 — FraguaScene full implementation tests (CMP-06-scene)
 *
 * Tests against the La Fragua faithful scene (rooms, sprites per running WO,
 * +N en cola badge, reviewer gate, trophy shelf, parchment, FRD tracker).
 * 27 tests covering all acceptance criteria.
 *
 * Acceptance criteria covered:
 *   AC-06-001.1 — one sprite per running WO (fragua-wo-{id})
 *   AC-06-001.3 — +N en cola badge (fragua-queue-badge), never sprites for queued
 *   AC-06-002.1 — FRD title in tracker (fragua-frd-tracker)
 *   AC-06-002.3 — sprite hover tooltip (title="wo.id — wo.title")
 *   AC-06-003.1 — three rooms Forja/Tribunal/Bóveda (fragua-room-forge/tribunal/vault)
 *   AC-06-004.1 — reviewer figure dimmed while gate closed (data-gate-open="false")
 *   AC-06-004.2 — reviewer figure active when gate open (data-gate-open="true")
 *   AC-06-005.1 — VERIFIED WOs as trophies (fragua-trophy-{id})
 *   AC-06-005.2 — +N archivados compact (fragua-archived)
 *   AC-06-006.1 — parchment element present (fragua-parchment)
 *   AC-06-009.1 — no control affordances (no buttons, no inputs, no selectors)
 *
 * RAF is mocked. Engine is stub-replaced by snapshot-driven rendering.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

// ---------------------------------------------------------------------------
// RAF mock — FraguaScene uses requestAnimationFrame; jsdom doesn't support it.
// ---------------------------------------------------------------------------
vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => {
  // Do not execute the callback — static render only.
  return 0;
});
vi.stubGlobal("cancelAnimationFrame", (_id: number) => {
  // no-op
});

// ---------------------------------------------------------------------------
// Snapshot factory — sensible defaults that keep tests lean
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
// Suite 1: Three rooms with labels (AC-06-003.1)
// ---------------------------------------------------------------------------

describe("FraguaScene — three rooms with labels (AC-06-003.1)", () => {
  it("frd-06: WHEN rendered THEN the Sala de Forja room is present", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-room-forge")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN the Tribunal del Juez room is present", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-room-tribunal")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN the Bóveda room is present", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-room-vault")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN the scene does NOT render a 4-column kanban", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.queryByTestId("party-zone-library")).not.toBeInTheDocument();
    expect(screen.queryByTestId("party-zone-forge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("party-zone-workshop")).not.toBeInTheDocument();
    expect(screen.queryByTestId("party-zone-lab")).not.toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN each room has its Spanish label visible", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getAllByText(/Sala de Forja/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tribunal del Juez/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bóveda/).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: One sprite per running WO (AC-06-001.1)
// ---------------------------------------------------------------------------

describe("FraguaScene — one sprite per running WO (AC-06-001.1)", () => {
  it("frd-06: WHEN one WO is running THEN exactly one fragua-wo sprite is rendered", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    expect(screen.getByTestId("fragua-wo-WO-06-001")).toBeInTheDocument();
  });

  it("frd-06: WHEN three WOs are running THEN three fragua-wo sprites are rendered", () => {
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
    expect(screen.getByTestId("fragua-wo-WO-06-001")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-wo-WO-06-002")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-wo-WO-06-003")).toBeInTheDocument();
  });

  it("frd-06: WHEN no WOs are running THEN no fragua-wo sprite is rendered", () => {
    render(<FraguaScene snapshot={snap({ running: [] })} />);
    // No running WOs → no sprite wrappers anywhere on the stage.
    const stage = screen.getByTestId("fragua-stage");
    expect(stage.querySelector("[data-testid^='fragua-wo-']")).toBeNull();
  });

  it("frd-06: WHEN a WO is running THEN its sprite wrapper lives at the stage level, NOT inside a room", () => {
    // The moving WO sprites are a stage-level layer (driven imperatively by the
    // engine) so they can walk BETWEEN rooms; they must not be a room child.
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Walker", state: "building" }],
        })}
      />,
    );
    const sprite = screen.getByTestId("fragua-wo-WO-06-001");
    // Direct child of the stage, not nested inside the forge/tribunal room.
    const stage = screen.getByTestId("fragua-stage");
    expect(sprite.parentElement).toBe(stage);
    const forgeRoom = screen.getByTestId("fragua-room-forge");
    expect(forgeRoom.querySelector("[data-testid^='fragua-wo-']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: +N en cola badge (AC-06-001.3)
// ---------------------------------------------------------------------------

describe("FraguaScene — +N en cola badge (AC-06-001.3)", () => {
  it("frd-06: WHEN queuedCount > 0 THEN the queue badge is rendered", () => {
    render(<FraguaScene snapshot={snap({ queuedCount: 3 })} />);
    expect(screen.getByTestId("fragua-queue-badge")).toBeInTheDocument();
  });

  it("frd-06: WHEN queuedCount > 0 THEN the badge shows the correct count", () => {
    render(<FraguaScene snapshot={snap({ queuedCount: 5 })} />);
    const badge = screen.getByTestId("fragua-queue-badge");
    expect(badge).toHaveTextContent("5");
  });

  it("frd-06: WHEN queuedCount is 0 THEN no queue badge is rendered", () => {
    render(<FraguaScene snapshot={snap({ queuedCount: 0 })} />);
    expect(screen.queryByTestId("fragua-queue-badge")).not.toBeInTheDocument();
  });

  it("frd-06: WHEN queued WOs exist THEN they are NOT rendered as sprites", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Running", state: "building" }],
          queuedCount: 2,
        })}
      />,
    );
    // Only the one running WO has a sprite; queued ones never get sprites
    expect(screen.getByTestId("fragua-wo-WO-06-001")).toBeInTheDocument();
    // No second or third sprite for the 2 queued
    expect(screen.queryByTestId("fragua-wo-WO-06-002")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fragua-wo-WO-06-003")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: FRD tracker (AC-06-002.1)
// ---------------------------------------------------------------------------

describe("FraguaScene — no duplicated header (owner, 2026-07-02)", () => {
  it("the scene renders NO FRD tracker / counter / mode header — that data lives once in MissionBar/Campaña", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.queryByTestId("fragua-frd-tracker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fragua-project-counter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fragua-mode-display")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Hover tooltip on running WO sprite (AC-06-002.3)
// ---------------------------------------------------------------------------

describe("FraguaScene — hover tooltip on sprites (AC-06-002.3)", () => {
  it("frd-06: WHEN a sprite is rendered THEN it has a title with WO id and title", () => {
    render(
      <FraguaScene
        snapshot={snap({
          running: [{ wo: "WO-06-001", title: "Event vocabulary", state: "building" }],
        })}
      />,
    );
    const sprite = screen.getByTestId("fragua-wo-WO-06-001");
    expect(sprite).toHaveAttribute("title");
    const title = sprite.getAttribute("title") ?? "";
    expect(title).toContain("WO-06-001");
    expect(title).toContain("Event vocabulary");
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Reviewer gate (AC-06-004.1 / AC-06-004.2)
// ---------------------------------------------------------------------------

describe("FraguaScene — reviewer gate (AC-06-004.1 / AC-06-004.2)", () => {
  it("frd-06: WHEN gate is closed THEN the reviewer element is present and dimmed (data-gate-open=false)", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: false } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    expect(reviewer).toBeInTheDocument();
    expect(reviewer).toHaveAttribute("data-gate-open", "false");
  });

  it("frd-06: WHEN gate is open THEN the reviewer element is active (data-gate-open=true)", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    expect(reviewer).toBeInTheDocument();
    expect(reviewer).toHaveAttribute("data-gate-open", "true");
  });

  it("frd-06: WHEN gate is open THEN four lenses are indicated", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    // The reviewer reviews with four lenses (correctness · security · quality · runtime/visual)
    const reviewer = screen.getByTestId("fragua-reviewer");
    expect(reviewer.querySelectorAll("[data-lens]").length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Trophy shelf (AC-06-005.1 / AC-06-005.2)
// ---------------------------------------------------------------------------

describe("FraguaScene — trophy shelf (AC-06-005.1 / AC-06-005.2)", () => {
  it("frd-06: WHEN a WO is verified THEN a trophy is placed on the Bóveda shelf", () => {
    render(
      <FraguaScene snapshot={snap({ trophies: [{ wo: "WO-06-001" }, { wo: "WO-06-002" }] })} />,
    );
    expect(screen.getByTestId("fragua-trophy-WO-06-001")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-trophy-WO-06-002")).toBeInTheDocument();
  });

  it("frd-06: WHEN archived count > 0 THEN the +N archivados indicator is present", () => {
    render(<FraguaScene snapshot={snap({ archivedCount: 5 })} />);
    expect(screen.getByTestId("fragua-archived")).toBeInTheDocument();
    expect(screen.getByTestId("fragua-archived")).toHaveTextContent("5");
  });

  it("frd-06: WHEN archived count is 0 THEN no archivados indicator is present", () => {
    render(<FraguaScene snapshot={snap({ archivedCount: 0 })} />);
    expect(screen.queryByTestId("fragua-archived")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 8: Parchment element (AC-06-006.1)
// ---------------------------------------------------------------------------

describe("FraguaScene — parchment element (AC-06-006.1)", () => {
  it("frd-06: WHEN rendered THEN a parchment element is present in the scene", () => {
    render(<FraguaScene snapshot={snap()} />);
    // The parchment element is always structurally present (hidden/inactive when no handoff)
    expect(screen.getByTestId("fragua-parchment")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 9: Observation-only (AC-06-009.1)
// ---------------------------------------------------------------------------

describe("FraguaScene — observation-only, no control affordances (AC-06-009.1)", () => {
  it("frd-06: WHEN rendered THEN there are NO button elements", () => {
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.querySelectorAll("button").length).toBe(0);
  });

  it("frd-06: WHEN rendered THEN there are NO input elements", () => {
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.querySelectorAll("input").length).toBe(0);
  });

  it("frd-06: WHEN rendered THEN there is no mode selector (radiogroup or combobox)", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN there is no pause/reset text", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.queryByText(/pausar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reiniciar/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 10: Container and accessibility
// ---------------------------------------------------------------------------

describe("FraguaScene — container and accessibility", () => {
  it("frd-06: WHEN rendered THEN the scene root has data-testid='fragua-scene'", () => {
    render(<FraguaScene snapshot={snap()} />);
    expect(screen.getByTestId("fragua-scene")).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN the scene root is a <section>", () => {
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    expect(scene.tagName.toLowerCase()).toBe("section");
  });

  it("frd-06: WHEN rendered THEN the scene root has an aria-label in Spanish", () => {
    render(<FraguaScene snapshot={snap()} />);
    const scene = screen.getByTestId("fragua-scene");
    const label = scene.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("frd-06: WHEN null frd THEN tracker is not shown but scene still renders", () => {
    render(<FraguaScene snapshot={snap({ frd: null, active: false })} />);
    expect(screen.getByTestId("fragua-scene")).toBeInTheDocument();
    expect(screen.queryByTestId("fragua-frd-tracker")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Vault FRD champion (owner, 2026-07-02 v2): a completed FRD reads BIGGER, not
// busier — one scaled sprite + a 🏆 mark; a loose WO keeps the normal statuette.
// ---------------------------------------------------------------------------

describe("FraguaScene — a completed FRD is a champion, a loose WO a statuette", () => {
  it("a group trophy renders the scaled champion wrapper with the 🏆 mark and NO pile imgs", () => {
    const snapshot = snap({
      trophies: [
        {
          wo: "frd-01-x",
          frd: "frd-01-x",
          colorKey: "--color-agent-implementer",
          group: { count: 4 },
        },
        { wo: "WO-02-001", frd: "frd-02-y", colorKey: "--color-agent-reviewer" },
      ],
    });
    render(<FraguaScene snapshot={snapshot} />);
    const champion = screen.getByTestId("fragua-trophy-frd-01-x");
    expect(champion.getAttribute("data-group")).toBe("true");
    expect(champion.textContent).toContain("🏆");
    expect(champion.textContent).toContain("FRD-01");
    // No pile: the only <img> inside is the AgentSprite's own.
    expect(champion.querySelectorAll("img").length).toBe(1);
    const loose = screen.getByTestId("fragua-trophy-WO-02-001");
    expect(loose.getAttribute("data-group")).toBeNull();
    expect(loose.textContent).not.toContain("🏆");
  });
});

// ---------------------------------------------------------------------------
// Campamento (Fase 3): pending-merge worktrees camped outside main — real git
// state (FRD-21), occupied-only like the enfermería.
// ---------------------------------------------------------------------------

describe("FraguaScene — campamento (Fase 3)", () => {
  it("renders NO camp when nothing is pending (occupied-only)", () => {
    render(<FraguaScene snapshot={snap({ tents: [] })} />);
    expect(screen.queryByTestId("fragua-camp")).not.toBeInTheDocument();
  });

  it("pending branches pitch tents (≤3 + '+N'), each carrying its real status", () => {
    render(
      <FraguaScene
        snapshot={snap({
          tents: [
            { branch: "wt-a", status: "ready" },
            { branch: "wt-b", status: "in-progress" },
            { branch: "wt-c", status: "stale" },
            { branch: "wt-d", status: "ready" },
          ],
        })}
      />,
    );
    const camp = screen.getByTestId("fragua-camp");
    expect(camp).toBeInTheDocument();
    expect(screen.getByTestId("fragua-tent-wt-a")).toHaveAttribute("data-status", "ready");
    expect(screen.queryByTestId("fragua-tent-wt-d")).not.toBeInTheDocument();
    expect(camp.textContent).toContain("+1");
  });
});
