import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import ResumenPanel from "../../../_panels/ResumenPanel";
import { summaryFixture } from "./summaryFixture";

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

function project(input: { running?: boolean; heartbeat?: string; event?: string; sha?: string }) {
  fixture.item.running = input.running;
  fixture.item.status = {
    present: true,
    malformed: false,
    status: {
      project: "Display Name",
      phase: "implementation",
      running: input.running,
      supervisorHeartbeat: input.heartbeat,
      lastGreenSha: input.sha,
      safeToTest: true,
    },
  };
  fixture.write(
    ".pandacorp/status.yaml",
    `project: Display Name\nphase: implementation\nrunning: ${input.running ?? false}\nsupervisor_heartbeat: '${input.heartbeat ?? ""}'\n`,
  );
  fs.writeFileSync(
    path.join(fixture.root, "events.ndjson"),
    input.event
      ? `${JSON.stringify({
          event: "AgentWorking",
          at: input.event,
          project: "folder-name",
          wo: "WO-01-001",
          agent: "implementer",
        })}\n`
      : "",
  );
  return fixture.project();
}

describe("Resumen shared snapshot signal", () => {
  it("AC-14-002.1 AC-14-003.1: wires the real git gap result into the snapshot stale notice", () => {
    const current = project({ running: true, heartbeat: "2026-10-31T11:59:30Z", sha: "a41c09e2" });
    const run = vi.spyOn(childProcess, "execFileSync").mockImplementation((_command, args) => {
      const command = Array.isArray(args) ? args.join(" ") : "";
      if (command.startsWith("rev-list")) return "14";
      if (command.endsWith("--format=%ct HEAD"))
        return String(Date.parse("2026-10-31T12:00:00Z") / 1000);
      if (command.endsWith("--format=%ct a41c09e2"))
        return String(Date.parse("2026-10-30T10:00:00Z") / 1000);
      return "feat(reading): verify WO-01-001";
    });
    render(<ResumenPanel project={current} route={fixture.route} />);
    expect(screen.getByTestId("snapshot-panel")).toHaveTextContent("verificó WO-01-001 de FRD-01");
    expect(screen.getByText("Este commit quedó atrás del build")).toBeVisible();
    expect(screen.getByTestId("snapshot-panel")).toHaveTextContent("14 commits y 26 horas");
    expect(run).toHaveBeenCalledWith(
      "git",
      ["rev-list", "--count", "a41c09e2..HEAD"],
      expect.objectContaining({ cwd: current.projectPath }),
    );
  });
  it.each([
    { running: false, sha: "a41c09e2" },
    { running: true, sha: undefined },
    { running: undefined, sha: "a41c09e2" },
  ])("AC-14-001.1 AC-14-001.3: omits snapshot unless running with a green SHA: %j", (input) => {
    render(<ResumenPanel project={project(input)} route={fixture.route} />);
    expect(screen.queryByTestId("snapshot-panel")).toBeNull();
  });
  it("AC-14-001.1 AC-14-001.2: running snapshot uses the folder identity, never the display name or route slug", () => {
    render(
      <ResumenPanel
        project={project({ running: true, heartbeat: "2026-10-31T11:59:30Z", sha: "a41c09e2" })}
        route={fixture.route}
      />,
    );
    expect(screen.getByTestId("snapshot-panel")).toHaveTextContent(
      "Para probarlo, córrelo en la carpeta de Display Name:",
    );
    expect(
      screen.getByRole("button", {
        name: "Copiar git worktree add /Users/Shared/review-worktrees/folder-name a41c09e2",
      }),
    ).toBeVisible();
  });
  it.each([
    { heartbeat: "2026-10-31T10:00:00Z", event: "2026-10-31T11:59:30Z", live: true },
    { heartbeat: "2026-10-31T11:59:30Z", event: "2026-10-31T10:00:00Z", live: true },
    { heartbeat: "2026-10-31T10:00:00Z", event: undefined, live: false },
    { heartbeat: undefined, event: undefined, live: false },
  ])("AC-14-002.1 AC-14-002.2 AC-06-019.7: shared freshest-signal verdict: %j", (input) => {
    render(
      <ResumenPanel
        project={project({ ...input, running: true, sha: "a41c09e2" })}
        route={fixture.route}
      />,
    );
    expect(screen.queryByTestId("snapshot-panel-building-now") !== null).toBe(input.live);
    expect(screen.queryByTestId("snapshot-panel-no-signal") !== null).toBe(!input.live);
    expect(screen.getByText(input.live ? "Construyendo ahora" : "Sin señal")).toBeVisible();
    if (!input.live && input.heartbeat)
      expect(screen.getByTestId("snapshot-panel-no-signal")).toHaveTextContent("hace 2 h");
  });
});
