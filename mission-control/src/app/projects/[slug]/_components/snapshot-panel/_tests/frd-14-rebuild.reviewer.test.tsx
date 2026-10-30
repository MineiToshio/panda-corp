/**
 * FRD-14 gate (reviewer-authored, DR-015): the Orbita panel fed by the real buildSnapshot, across the
 * whole running/heartbeat/shared-verdict matrix, plus the panel boundaries the builder's suite skips.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotInfo } from "@/lib/snapshot/snapshot";
import { SnapshotPanel } from "../snapshot-panel";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const FRESH = "2026-10-30T11:59:30Z";
const DEAD = "2026-10-30T10:00:00Z";
const FOLDER = "funko-tracker";

function live(running: boolean, heartbeat?: string): SnapshotInfo {
  const snapshot = buildSnapshot(
    FOLDER,
    {
      lastGreenSha: "a41c09e2ffff0000",
      safeToTest: true,
      running,
      ...(heartbeat ? { supervisorHeartbeat: heartbeat } : {}),
    },
    NOW,
  );
  if (snapshot === null) throw new Error("fixture must yield a snapshot");
  return snapshot;
}

const lines = () => ({
  building: screen.queryByTestId("snapshot-panel-building-now") !== null,
  noSignal: screen.queryByTestId("snapshot-panel-no-signal") !== null,
});

describe("FRD-14 gate: activity line matrix through buildSnapshot", () => {
  it.each([
    { name: "stopped, no verdict", running: false, building: false, noSignal: false },
    {
      name: "stopped, old heartbeat",
      running: false,
      heartbeat: DEAD,
      building: false,
      noSignal: false,
    },
    {
      name: "stopped, fresh heartbeat",
      running: false,
      heartbeat: FRESH,
      building: false,
      noSignal: false,
    },
    {
      name: "running, fresh, live verdict",
      running: true,
      heartbeat: FRESH,
      building: true,
      noSignal: false,
    },
    {
      name: "running, dead heartbeat, fresh event (shared verdict live)",
      running: true,
      heartbeat: DEAD,
      building: true,
      noSignal: false,
    },
    {
      name: "running, no heartbeat, fresh event (shared verdict live)",
      running: true,
      building: true,
      noSignal: false,
    },
    {
      name: "running, dead, shared verdict no-signal",
      running: true,
      heartbeat: DEAD,
      ago: "hace 25 min",
      building: false,
      noSignal: true,
    },
    {
      name: "running, fresh heartbeat, shared verdict no-signal",
      running: true,
      heartbeat: FRESH,
      ago: "hace 25 min",
      building: false,
      noSignal: true,
    },
  ])("AC-14-002.2: $name", ({ running, heartbeat, ago, building, noSignal }) => {
    render(<SnapshotPanel slug={FOLDER} snapshot={live(running, heartbeat)} noSignalAgo={ago} />);
    expect(lines()).toEqual({ building, noSignal });
  });

  it("AC-14-002.2: an empty age string still selects the no-signal wording, never building-now", () => {
    render(<SnapshotPanel slug={FOLDER} snapshot={live(true, FRESH)} noSignalAgo="" />);
    expect(lines()).toEqual({ building: false, noSignal: true });
  });

  it("AC-14-001.3: a named order is shown; the internal sentinel and an empty order never are", () => {
    const { rerender } = render(
      <SnapshotPanel slug={FOLDER} snapshot={{ ...live(true, FRESH), buildingNow: "WO-05-005" }} />,
    );
    expect(screen.getByTestId("snapshot-panel-building-now")).toHaveTextContent(
      "Construyendo ahora: WO-05-005. Eso todavía no está en verde: no lo pruebes.",
    );
    rerender(<SnapshotPanel slug={FOLDER} snapshot={live(true, FRESH)} />);
    expect(screen.getByTestId("snapshot-panel-building-now").textContent).not.toContain(
      "building now",
    );
    rerender(<SnapshotPanel slug={FOLDER} snapshot={{ ...live(true, FRESH), buildingNow: "" }} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toHaveTextContent(
      "el build sigue avanzando",
    );
  });

  it("markup inside a work-order name stays literal text", () => {
    render(
      <SnapshotPanel
        slug={FOLDER}
        snapshot={{ ...live(true, FRESH), buildingNow: "<img src=x>" }}
      />,
    );
    const line = screen.getByTestId("snapshot-panel-building-now");
    expect(within(line).queryByRole("img")).toBeNull();
    expect(line).toHaveTextContent("<img src=x>");
  });
});

describe("FRD-14 gate: verdict, notice and command boundaries", () => {
  it("AC-14-002.1: singular distance copy, notice between activity and command", () => {
    render(
      <SnapshotPanel
        slug={FOLDER}
        snapshot={live(true, FRESH)}
        gap={{ status: "ok", commitsBehind: 1, hoursBehind: 1, stale: true }}
      />,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("El build lleva 1 commit y 1 hora más.");
    const activity = screen.getByTestId("snapshot-panel-building-now");
    const command = screen.getByTestId("cmd-row");
    expect(activity.compareDocumentPosition(notice)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notice.compareDocumentPosition(command)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("AC-14-002.1: stale wins over unsafe, and an unsafe commit never reads safe", () => {
    const unsafe = { ...live(true, FRESH), safeToTest: false };
    const { rerender } = render(
      <SnapshotPanel
        slug={FOLDER}
        snapshot={unsafe}
        gap={{ status: "ok", commitsBehind: 14, hoursBehind: 26, stale: true }}
      />,
    );
    expect(screen.getByText("Quedó atrás del build")).toBeInTheDocument();
    expect(screen.queryByText("Seguro para probar")).toBeNull();
    rerender(
      <SnapshotPanel
        slug={FOLDER}
        snapshot={unsafe}
        gap={{ status: "ok", commitsBehind: 0, hoursBehind: 0, stale: false }}
      />,
    );
    expect(screen.getByText("Aún no es seguro")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("completeness: an unavailable gap fabricates neither a distance nor a verdict", () => {
    render(
      <SnapshotPanel
        slug={FOLDER}
        snapshot={live(true, FRESH)}
        gap={{ status: "unavailable", reason: "Git read failed" }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Quedó atrás del build")).toBeNull();
    expect(screen.getByText("pasó todos los gates")).toBeInTheDocument();
    expect(screen.queryByText(/Git read failed/)).toBeNull();
  });

  it("AC-14-001.1: the display name labels the lead-in, the command keeps the folder", () => {
    render(
      <SnapshotPanel slug={FOLDER} projectName="Funko Tracker" snapshot={live(true, FRESH)} />,
    );
    expect(
      screen.getByText("Para probarlo, córrelo en la carpeta de Funko Tracker:"),
    ).toBeVisible();
    expect(screen.getByTestId("cmd-row")).toHaveTextContent(
      "git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2ffff0000",
    );
    expect(screen.getByTestId("snapshot-panel-sha")).toHaveTextContent(/^a41c09e2$/);
  });
});
