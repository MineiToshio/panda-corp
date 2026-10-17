import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataModel } from "@/lib/architecture/data-model/types";
import { DataModelViewer } from "../DataModelViewer";
import { layoutModel, type ModelLayout } from "../layout";
import { modelFixture } from "./fixture";

vi.mock("../layout", async (importActual) => ({
  ...(await importActual<typeof import("../layout")>()),
  layoutModel: vi.fn(),
}));

function deferredLayout() {
  let resolve: (layout: ModelLayout) => void = () => {
    throw new Error("Uninitialized promise");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("Uninitialized promise");
  };
  const promise = new Promise<ModelLayout>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function singleEntityModel(name: string): DataModel {
  const entity = modelFixture().entities[0];
  if (!entity) throw new Error("Fixture entity required");
  return {
    schemaVersion: 1,
    persistence: "document",
    entities: [{ ...entity, id: name, name }],
    relationships: [],
  };
}

function positioned(model: DataModel): ModelLayout {
  return {
    width: 500,
    height: 200,
    nodes: model.entities.map((entity) => ({ entity, x: 20, y: 20, width: 400, height: 86 })),
    edges: [],
  };
}

beforeEach(() => vi.mocked(layoutModel).mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("asynchronous diagram generation independent acceptance", () => {
  it("discards a stale successful graph when the project artifact changes during layout", async () => {
    const stale = deferredLayout();
    const current = deferredLayout();
    vi.mocked(layoutModel).mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    const previousModel = singleEntityModel("PreviousProject");
    const nextModel = singleEntityModel("CurrentProject");
    const { rerender } = render(
      <DataModelViewer
        result={{ kind: "ready", source: "docs/product/data-model.json", model: previousModel }}
      />,
    );
    rerender(
      <DataModelViewer
        result={{ kind: "ready", source: "docs/product/data-model.json", model: nextModel }}
      />,
    );
    await act(async () => current.resolve(positioned(nextModel)));
    expect(
      await screen.findByRole("button", { name: "Seleccionar entidad CurrentProject" }),
    ).toBeVisible();
    await act(async () => stale.resolve(positioned(previousModel)));
    expect(
      screen.queryByRole("button", { name: "Seleccionar entidad PreviousProject" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Seleccionar entidad CurrentProject" }),
    ).toBeVisible();
  });

  it("does not let a stale layout rejection replace the current usable diagram", async () => {
    const stale = deferredLayout();
    const current = deferredLayout();
    vi.mocked(layoutModel).mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    const model = singleEntityModel("CurrentProject");
    const { rerender } = render(
      <DataModelViewer
        result={{
          kind: "ready",
          source: "docs/product/data-model.json",
          model: singleEntityModel("OldProject"),
        }}
      />,
    );
    rerender(
      <DataModelViewer result={{ kind: "ready", source: "docs/product/data-model.json", model }} />,
    );
    await act(async () => current.resolve(positioned(model)));
    await screen.findByRole("button", { name: "Seleccionar entidad CurrentProject" });
    await act(async () => stale.reject(new Error("Stale engine failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Seleccionar entidad CurrentProject" }),
    ).toBeVisible();
  });

  it("exposes a current engine failure instead of silently showing an empty graph", async () => {
    const pending = deferredLayout();
    vi.mocked(layoutModel).mockReturnValueOnce(pending.promise);
    render(
      <DataModelViewer
        result={{
          kind: "ready",
          source: "docs/product/data-model.json",
          model: singleEntityModel("BrokenLayout"),
        }}
      />,
    );
    await act(async () => pending.reject(new Error("Engine rejected graph")));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Seleccionar entidad BrokenLayout" }),
    ).not.toBeInTheDocument();
  });

  it("aborts the old layout signal and ignores its later cancellation after a project switch", async () => {
    const stale = deferredLayout();
    const current = deferredLayout();
    vi.mocked(layoutModel).mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    const currentModel = singleEntityModel("CurrentProject");
    const { rerender, unmount } = render(
      <DataModelViewer
        result={{
          kind: "ready",
          source: "docs/product/data-model.json",
          model: singleEntityModel("OldProject"),
        }}
      />,
    );
    const oldSignal = vi.mocked(layoutModel).mock.calls[0]?.[1];
    expect(oldSignal).toBeInstanceOf(AbortSignal);
    expect(oldSignal?.aborted).toBe(false);
    rerender(
      <DataModelViewer
        result={{ kind: "ready", source: "docs/product/data-model.json", model: currentModel }}
      />,
    );
    const currentSignal = vi.mocked(layoutModel).mock.calls[1]?.[1];
    expect(oldSignal?.aborted).toBe(true);
    expect(currentSignal).toBeInstanceOf(AbortSignal);
    expect(currentSignal?.aborted).toBe(false);
    expect(currentSignal).not.toBe(oldSignal);
    await act(async () => current.resolve(positioned(currentModel)));
    await screen.findByRole("button", { name: "Seleccionar entidad CurrentProject" });
    await act(async () => stale.reject(new DOMException("Layout canceled", "AbortError")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Seleccionar entidad CurrentProject" }),
    ).toBeVisible();
    unmount();
    expect(currentSignal?.aborted).toBe(true);
  });
});
