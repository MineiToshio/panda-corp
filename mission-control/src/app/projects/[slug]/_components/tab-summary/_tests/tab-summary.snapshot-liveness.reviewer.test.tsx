/**
 * FRD-14 gate (reviewer-authored, DR-015), reconciled for WO-04-011: the mount reads
 * `WorkspaceProject.build`, so no surface grades a heartbeat alone. Boundaries of the shared signal
 * through the real panel, with no interim age left at the Resumen mount.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import ResumenPanel from "../../../_panels/ResumenPanel";
import { summaryFixture } from "./summaryFixture";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const TEN_MINUTES = 10 * 60_000;
const SHA = "a41c09e2ffff0000";
const state = vi.hoisted(() => ({ items: [] as ProjectListItem[] }));
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => state.items,
  readPortfolio: () => state.items,
}));
class FakeEventSource {
  close() {}
}
let fixture: ReturnType<typeof summaryFixture>;
beforeEach(() => {
  fixture = summaryFixture();
  state.items = [fixture.item];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  fixture.cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderMount(input: {
  readonly running?: boolean;
  readonly supervisorHeartbeat?: string;
  readonly lastGreenSha?: string;
}): void {
  const status = {
    project: "Display Name",
    phase: "implementation",
    safeToTest: true,
    lastGreenSha: SHA,
    ...input,
  };
  fixture.item.running = input.running;
  fixture.item.status = {
    present: true,
    malformed: false,
    status: { ...status, phase: "implementation" as const },
  };
  fixture.write(
    ".pandacorp/status.yaml",
    [
      "project: Display Name",
      "phase: implementation",
      `running: ${input.running ?? false}`,
      ...(status.lastGreenSha ? [`last_green_sha: ${status.lastGreenSha}`] : []),
      ...(input.supervisorHeartbeat
        ? [`supervisor_heartbeat: '${input.supervisorHeartbeat}'`]
        : []),
      "",
    ].join("\n"),
  );
  render(<ResumenPanel project={fixture.project()} route={fixture.route} />);
}

const iso = (ageMs: number): string => new Date(NOW - ageMs).toISOString();
const activity = () => ({
  panel: screen.queryByTestId("snapshot-panel") !== null,
  building: screen.queryByTestId("snapshot-panel-building-now") !== null,
  noSignal: screen.queryByTestId("snapshot-panel-no-signal") !== null,
});

describe("FRD-14 gate: the shared no-signal age at the Resumen mount", () => {
  it.each([
    { name: "stopped with a dead heartbeat", running: false, heartbeat: iso(2 * 3_600_000) },
    { name: "stopped with no heartbeat", running: false, heartbeat: undefined },
    { name: "running flag absent", running: undefined, heartbeat: iso(2 * 3_600_000) },
  ])("AC-14-001.1: $name mounts no panel", ({ running, heartbeat }) => {
    renderMount({ running, supervisorHeartbeat: heartbeat });
    expect(activity()).toEqual({ panel: false, building: false, noSignal: false });
  });

  it("AC-14-001.1 limit: running without a green SHA mounts no panel", () => {
    renderMount({ running: true, supervisorHeartbeat: iso(0), lastGreenSha: "" });
    expect(activity().panel).toBe(false);
  });

  it("AC-14-002.2 limit: one second inside the 10 min TTL is live", () => {
    renderMount({ running: true, supervisorHeartbeat: iso(TEN_MINUTES - 1000) });
    expect(activity()).toEqual({ panel: true, building: true, noSignal: false });
  });

  it("AC-14-002.2 limit: exactly the 10 min TTL is no-signal, with the measured age", () => {
    renderMount({ running: true, supervisorHeartbeat: iso(TEN_MINUTES) });
    expect(activity()).toEqual({ panel: true, building: false, noSignal: true });
    expect(screen.getByTestId("snapshot-panel-no-signal")).toHaveTextContent("hace 10 min");
  });

  it("AC-14-002.2 error: an unparseable heartbeat is no-signal and never leaks a raw value", () => {
    renderMount({ running: true, supervisorHeartbeat: "not-a-date" });
    expect(activity()).toEqual({ panel: true, building: false, noSignal: true });
    expect(screen.getByTestId("snapshot-panel-no-signal").textContent).not.toMatch(
      /not-a-date|NaN|undefined|Invalid/,
    );
  });

  it("AC-14-002.2 edge: a missing heartbeat fabricates no age", () => {
    renderMount({ running: true });
    expect(screen.getByTestId("snapshot-panel-no-signal").textContent).not.toMatch(
      /hace \d|NaN|undefined/,
    );
  });
});
