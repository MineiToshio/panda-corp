import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { layoutModel, type ModelLayout } from "../layout";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

vi.mock("../layout", async (actual) => ({
  ...(await actual<typeof import("../layout")>()),
  layoutModel: vi.fn(),
}));
function deferred() {
  let resolve: (value: ModelLayout) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<ModelLayout>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const geometry: ModelLayout = { nodes: [], edges: [], width: 100, height: 100 };
beforeEach(() => {
  vi.mocked(layoutModel).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("AC-02-015.11: pending layout stays interactive, expires and cancels without a late repaint", async () => {
  vi.useFakeTimers();
  const pending = deferred();
  vi.mocked(layoutModel).mockReturnValue(pending.promise);
  const click = vi.fn();
  render(
    <>
      <button type="button" onClick={click}>
        Outside
      </button>
      <DataModelViewer result={readyFixture()} />
    </>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Organizando modelo");
  fireEvent.click(screen.getByRole("button", { name: "Outside" }));
  expect(click).toHaveBeenCalledOnce();
  const signal = vi.mocked(layoutModel).mock.calls[0]?.[1];
  await act(() => vi.advanceTimersByTimeAsync(19_999));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(geometry));
  expect(screen.getByRole("alert")).toBeVisible();
});

it("AC-02-015.11: an engine rejection shows the explicit error state", async () => {
  vi.mocked(layoutModel).mockRejectedValue(new Error("Engine failed"));
  render(<DataModelViewer result={readyFixture()} />);
  expect(await screen.findByRole("alert")).toBeVisible();
});

it("AC-02-015.11: changing models cancels old work and isolates late results", async () => {
  const previous = deferred();
  const current = deferred();
  vi.mocked(layoutModel).mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
  const { rerender, unmount } = render(<DataModelViewer result={readyFixture()} />);
  const oldSignal = vi.mocked(layoutModel).mock.calls[0]?.[1];
  rerender(<DataModelViewer result={readyFixture()} />);
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => previous.resolve(geometry));
  expect(screen.getByRole("status")).toHaveTextContent("Organizando modelo");
  await act(async () => current.reject(new Error("Current failed")));
  expect(screen.getByRole("alert")).toBeVisible();
  unmount();
  expect(vi.mocked(layoutModel).mock.calls[1]?.[1]?.aborted).toBe(true);
});

it("AC-02-015.11: a first layout outlasting the default query budget still reaches the viewer", async () => {
  vi.useFakeTimers();
  const pending = deferred();
  vi.mocked(layoutModel).mockReturnValue(pending.promise);
  render(<DataModelViewer result={readyFixture()} />);
  const defaultBudget = expect(screen.findByRole("searchbox")).rejects.toThrow();
  await act(() => vi.advanceTimersByTimeAsync(1_000));
  await defaultBudget;
  const settled = waitForLayout();
  await act(() => vi.advanceTimersByTimeAsync(1_500));
  await act(async () => pending.resolve(geometry));
  await act(() => vi.advanceTimersByTimeAsync(100));
  await settled;
  expect(screen.getByRole("searchbox")).toBeVisible();
});

it("AC-02-015.11: the bounded wait names a layout that failed instead of timing out silently", async () => {
  vi.mocked(layoutModel).mockRejectedValue(new Error("Engine failed"));
  render(<DataModelViewer result={readyFixture()} />);
  await expect(waitForLayout()).rejects.toThrow("layout failed");
});
