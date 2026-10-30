import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { TabSummary } from "../tab-summary";

const NOW = Date.parse("2026-10-30T12:00:00Z");

afterEach(() => vi.restoreAllMocks());

describe("Resumen snapshot heartbeat integration", () => {
  it.each([
    { name: "dead", heartbeat: "2026-10-30T10:00:00Z", building: false },
    { name: "live", heartbeat: "2026-10-30T11:59:30Z", building: true },
    { name: "missing", heartbeat: undefined, building: false },
  ])("shows the correct activity line for a $name running build", ({ heartbeat, building }) => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const status = {
      running: true,
      supervisorHeartbeat: heartbeat,
      lastGreenSha: "a41c09e2ffff0000",
      safeToTest: true,
    };
    render(
      <TabSummary
        summary="Project"
        keyPoints={[]}
        activityLog={{ entries: [] }}
        decisions={[]}
        pendingDecisions={0}
        slug="mission-control"
        status={status}
        snapshot={buildSnapshot("mission-control", status, NOW)}
      />,
    );
    expect(screen.queryByTestId("snapshot-panel-building-now") !== null).toBe(building);
    expect(screen.queryByTestId("snapshot-panel-no-signal") !== null).toBe(!building);
    if (heartbeat && !building) {
      expect(screen.getByTestId("snapshot-panel-no-signal").textContent).toContain("hace 2 h");
    }
  });
});
