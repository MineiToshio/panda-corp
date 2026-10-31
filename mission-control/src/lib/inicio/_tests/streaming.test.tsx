import { PassThrough } from "node:stream";
import { Suspense } from "react";
import { renderToPipeableStream } from "react-dom/server.node";
import { expect, it, vi } from "vitest";
import { TurnSection, WorktreesSection } from "@/app/(dashboard)/_components/HomeSections";
import { getWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";

vi.mock("@/lib/pendingMerge/worktreesByRepo", () => ({ getWorktreesByRepo: vi.fn() }));
vi.mock("@/lib/inicio/turn", () => ({
  ownerTurnItems: () => ({ items: [], count: 0, errors: [] }),
}));
vi.mock("@/components/dashboard/TuTurno/TuTurno", () => ({
  TuTurno: () => <p>Owner queue ready</p>,
}));
vi.mock("@/components/dashboard/FactoryWorktrees/FactoryWorktrees", () => ({
  FactoryWorktrees: () => <p>Git ready</p>,
}));

it("streams Tu turno while the git section is still suspended", async () => {
  let finish: (() => void) | undefined;
  vi.mocked(getWorktreesByRepo).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve([]);
      }),
  );
  const turn = TurnSection();
  const worktrees = WorktreesSection();
  function Turn() {
    return turn;
  }
  function Worktrees() {
    return worktrees;
  }
  const output = new PassThrough();
  let html = "";
  let ownerChunk: (() => void) | undefined;
  const ownerReady = new Promise<void>((resolve) => {
    ownerChunk = resolve;
  });
  output.on("data", (chunk) => {
    html += String(chunk);
    if (html.includes("Owner queue ready")) ownerChunk?.();
  });
  const ended = new Promise<void>((resolve) => output.on("end", resolve));
  const stream = renderToPipeableStream(
    <main>
      <Suspense fallback={null}>
        <Turn />
      </Suspense>
      <Suspense fallback={null}>
        <Worktrees />
      </Suspense>
    </main>,
    {
      onShellReady() {
        stream.pipe(output);
      },
    },
  );
  try {
    await ownerReady;
    expect(html).not.toContain("Git ready");
    finish?.();
    await ended;
    expect(html).toContain("Git ready");
  } finally {
    stream.abort();
  }
});
