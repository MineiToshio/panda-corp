/**
 * WO-06-013 — FraguaScene host integration for the deep-mode relay (REQ-06-007).
 *
 * The scene is the relay host (blueprint CMP-06-relay "used by the scene"):
 *   - deep mode + a running WO with a frontend (relay present) → renders DeepRelay
 *     as the sequential 3-step relay (AC-06-007.1).
 *   - deep mode + a running WO with no frontend (no relay) → renders the single
 *     implementer figure (AC-06-007.4).
 *   - non-deep modes → the plain WO chip (no relay).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

function snapshot(overrides: Partial<FraguaSnapshot> = {}): FraguaSnapshot {
  return {
    frd: { id: "frd-06-party", title: "FRD-06 Party" },
    mode: "deep",
    wave: 6,
    running: [],
    queuedCount: 0,
    gate: { open: false },
    trophies: [],
    archivedCount: 0,
    project: { done: 0, total: 1 },
    events: [],
    active: true,
    lastEventAt: "2026-06-18T20:00:00Z",
    ...overrides,
  };
}

describe("FraguaScene — deep-mode relay host (REQ-06-007)", () => {
  it("renders DeepRelay for a deep-mode running WO that has a frontend", () => {
    render(
      <FraguaScene
        snapshot={snapshot({
          mode: "deep",
          running: [
            {
              wo: "WO-06-013",
              title: "WO-06-013",
              state: "building",
              relay: { step: "backend", contractPublished: false },
            },
          ],
        })}
      />,
    );

    expect(screen.getByTestId("deep-relay-WO-06-013")).toBeInTheDocument();
    expect(screen.getByTestId("relay-label")).toHaveTextContent("Opus");
  });

  it("renders a single implementer for a deep-mode running WO with no frontend", () => {
    render(
      <FraguaScene
        snapshot={snapshot({
          mode: "deep",
          running: [{ wo: "WO-06-099", title: "WO-06-099", state: "building" }],
        })}
      />,
    );

    expect(screen.getByTestId("deep-relay-single-WO-06-099")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-label")).not.toBeInTheDocument();
  });

  it("renders the plain WO chip (no relay) in non-deep modes", () => {
    render(
      <FraguaScene
        snapshot={snapshot({
          mode: "balanced",
          wave: 4,
          running: [{ wo: "WO-06-013", title: "WO-06-013", state: "building" }],
        })}
      />,
    );

    expect(screen.getByTestId("fragua-wo-WO-06-013")).toBeInTheDocument();
    expect(screen.queryByTestId("deep-relay-WO-06-013")).not.toBeInTheDocument();
  });
});
