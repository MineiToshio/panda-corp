import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";
import { SnapshotPanel } from "../snapshot-panel";

const snapshot: SnapshotInfo = {
  sha: "a41c09e2",
  safeToTest: true,
  worktreeCommand: "git worktree add /Users/Shared/review-worktrees/folder a41c09e2",
  stale: false,
  noSignal: true,
};
it("AC-14-001.1, AC-14-001.2, AC-14-001.3: commit, separate live line and copyable folder command", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(
    <SnapshotPanel
      slug="folder"
      projectName="Renamed"
      snapshot={snapshot}
      gap={{
        status: "ok",
        commitsBehind: 0,
        hoursBehind: 0,
        stale: false,
        verified: { wo: "WO-07-002", frd: "FRD-07" },
      }}
    />,
  );
  expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Último commit en verde");
  expect(screen.getByText(/de FRD-07/)).toHaveTextContent("WO-07-002");
  expect(screen.getByText(/worktree aparte mientras/)).toBeInTheDocument();
  expect(screen.getByTestId("snapshot-panel-building-now")).toHaveTextContent("no lo pruebes");
  expect(screen.queryByTestId("snapshot-panel-no-signal")).toBeNull();
  await user.click(screen.getByRole("button", { name: `Copiar ${snapshot.worktreeCommand}` }));
  expect(copy).toHaveBeenCalledWith(snapshot.worktreeCommand);
});
it("AC-14-002.2, AC-06-019.7: caller's shared verdict overrides old heartbeat-only state", () => {
  render(
    <SnapshotPanel
      slug="folder"
      snapshot={{ ...snapshot, noSignal: undefined, buildingNow: "WO-05-005" }}
      noSignalAgo="hace 25 min"
    />,
  );
  expect(screen.getByTestId("snapshot-panel-no-signal")).toHaveTextContent("25 min");
  expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
});
it("AC-14-002.1: stale probe warns with measured distance", () => {
  render(
    <SnapshotPanel
      slug="folder"
      snapshot={snapshot}
      gap={{ status: "ok", commitsBehind: 14, hoursBehind: 26, stale: true }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("14 commits y 26 horas");
  expect(screen.getByText("Quedó atrás del build")).toBeInTheDocument();
});
it("AC-14-001.1: null is absent, unsafe and unavailable never claim safety or distance", () => {
  const { rerender, container } = render(<SnapshotPanel slug="folder" snapshot={null} />);
  expect(container).toBeEmptyDOMElement();
  rerender(
    <SnapshotPanel
      slug="folder"
      snapshot={{ ...snapshot, safeToTest: false }}
      gap={{ status: "unavailable", reason: "unknown sha" }}
    />,
  );
  expect(screen.getByText("Aún no es seguro")).toBeInTheDocument();
  expect(screen.getByText("pasó todos los gates")).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/punto verde|local.*remot/i);
});

it("AC-14-001.3: a stopped build has no activity line while the command remains available", () => {
  render(
    <SnapshotPanel
      slug="folder"
      snapshot={{ ...snapshot, buildingNow: undefined, noSignal: undefined }}
    />,
  );
  expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  expect(screen.queryByTestId("snapshot-panel-no-signal")).toBeNull();
  expect(screen.getByRole("button", { name: `Copiar ${snapshot.worktreeCommand}` })).toBeVisible();
});
