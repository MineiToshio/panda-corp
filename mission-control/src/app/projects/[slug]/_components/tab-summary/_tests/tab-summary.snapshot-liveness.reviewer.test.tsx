/**
 * FRD-14 gate (reviewer-authored, DR-015): the interim no-signal age at the Resumen mount, on the
 * boundaries the builder's dead/live/missing matrix skips.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { TabSummary } from "../tab-summary";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const TEN_MINUTES = 10 * 60_000;

function renderMount(status: {
  readonly running?: boolean;
  readonly supervisorHeartbeat?: string;
}): void {
  const full = { ...status, lastGreenSha: "a41c09e2ffff0000", safeToTest: true };
  render(
    <TabSummary
      summary="Project"
      keyPoints={[]}
      activityLog={{ entries: [] }}
      decisions={[]}
      pendingDecisions={0}
      slug="mission-control"
      status={full}
      snapshot={buildSnapshot("mission-control", full, NOW)}
    />,
  );
}

const iso = (ageMs: number): string => new Date(NOW - ageMs).toISOString();
const activity = () => ({
  building: screen.queryByTestId("snapshot-panel-building-now") !== null,
  noSignal: screen.queryByTestId("snapshot-panel-no-signal") !== null,
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());

describe("FRD-14 gate: interim no-signal age at the Resumen mount", () => {
  it.each([
    { name: "stopped with a dead heartbeat", running: false, heartbeat: iso(2 * 3_600_000) },
    { name: "stopped with no heartbeat", running: false, heartbeat: undefined },
    { name: "running flag absent", running: undefined, heartbeat: iso(2 * 3_600_000) },
  ])("AC-14-001.3: $name has no activity line", ({ running, heartbeat }) => {
    renderMount({ running, supervisorHeartbeat: heartbeat });
    expect(activity()).toEqual({ building: false, noSignal: false });
  });

  it("AC-14-002.2: one second inside the 10 min TTL is live", () => {
    renderMount({ running: true, supervisorHeartbeat: iso(TEN_MINUTES - 1000) });
    expect(activity()).toEqual({ building: true, noSignal: false });
  });

  it("AC-14-002.2: exactly the 10 min TTL is no-signal, with the measured age", () => {
    renderMount({ running: true, supervisorHeartbeat: iso(TEN_MINUTES) });
    expect(activity()).toEqual({ building: false, noSignal: true });
    expect(screen.getByTestId("snapshot-panel-no-signal")).toHaveTextContent("hace 10 min");
  });

  it("AC-14-002.2: an unparseable heartbeat is no-signal and never leaks a raw value", () => {
    renderMount({ running: true, supervisorHeartbeat: "not-a-date" });
    expect(activity()).toEqual({ building: false, noSignal: true });
    expect(screen.getByTestId("snapshot-panel-no-signal").textContent).not.toMatch(
      /not-a-date|NaN|undefined|Invalid/,
    );
  });

  it("AC-14-002.2: a missing heartbeat fabricates no age", () => {
    renderMount({ running: true });
    expect(screen.getByTestId("snapshot-panel-no-signal").textContent).not.toMatch(
      /hace \d|NaN|undefined/,
    );
  });
});
