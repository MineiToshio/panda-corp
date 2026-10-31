import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { layoutModel, type ModelLayout } from "../layout";
import { useModelLayout } from "../useModelLayout";
import { modelFixture } from "./fixture";

vi.mock("../layout", () => ({ layoutModel: vi.fn() }));
afterEach(cleanup);

it("AC-02-015.11: equal payloads reuse pending work and the settled layout reference", async () => {
  let resolveLayout: (layout: ModelLayout) => void = () => {};
  vi.mocked(layoutModel).mockReturnValue(
    new Promise((resolve) => {
      resolveLayout = resolve;
    }),
  );
  const { result, rerender } = renderHook(useModelLayout, { initialProps: modelFixture() });
  const signal = vi.mocked(layoutModel).mock.calls[0]?.[1];
  rerender(modelFixture());
  expect(result.current.kind).toBe("loading");
  expect(layoutModel).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(false);
  const layout: ModelLayout = { nodes: [], edges: [], width: 100, height: 100 };
  await act(async () => resolveLayout(layout));
  const ready = result.current;
  rerender(modelFixture());
  expect(result.current).toBe(ready);
  expect(result.current).toEqual({ kind: "ready", layout });
  if (result.current.kind !== "ready") throw new Error("Expected a ready layout");
  expect(result.current.layout).toBe(layout);
  expect(layoutModel).toHaveBeenCalledOnce();
});
