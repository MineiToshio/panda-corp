import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ModelLayout } from "../layout";
import { useViewport } from "../useViewport";
import { modelFixture } from "./fixture";

const model = modelFixture();
const layout: ModelLayout = {
  nodes: model.entities.map((entity, index) => ({
    entity,
    x: 100 + index * 400,
    y: 200,
    width: 200,
    height: 100,
  })),
  edges: [],
  width: 2000,
  height: 1000,
};
function Harness({
  model = layout,
  mode = "diagram",
  expanded = false,
}: {
  model?: ModelLayout;
  mode?: string;
  expanded?: boolean;
}) {
  const viewport = useViewport(model, expanded, mode, "entry");
  return (
    <>
      <div ref={viewport.canvasRef} {...viewport.handlers} role="application" aria-label="Diagram">
        <button type="button" data-model-interactive data-entity-id="entry">
          Entity
        </button>
      </div>
      <output aria-label="Viewport">{JSON.stringify(viewport.view)}</output>
      <output aria-label="Clipped">{String(viewport.isOverviewClipped)}</output>
      <button type="button" onClick={viewport.fit}>
        Fit
      </button>
      <button type="button" onClick={viewport.reset}>
        Reset
      </button>
      <button type="button" onClick={() => viewport.zoomBy(2, { x: 100, y: 150 })}>
        Zoom
      </button>
    </>
  );
}
const view = (): { x: number; y: number; zoom: number } =>
  JSON.parse(screen.getByRole("status", { name: "Viewport" }).textContent ?? "{}");
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("fits both dimensions, centers the graph, and resets the linked entity at detail scale", () => {
  render(<Harness />);
  expect(view()).toEqual({ x: -200, y: -50, zoom: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  expect(view().zoom).toBeCloseTo(0.336);
  expect(view().x).toBeCloseTo(64);
  expect(view().y).toBeCloseTo(32);
  expect(screen.getByRole("status", { name: "Clipped" })).toHaveTextContent("false");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(view()).toEqual({ x: -200, y: -50, zoom: 1 });
});

it("zooms around the requested anchor and clamps at detail and overview limits", () => {
  render(<Harness />);
  const initial = view();
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  expect(view()).toEqual({
    zoom: 2,
    x: 100 - (100 - initial.x) * 2,
    y: 150 - (150 - initial.y) * 2,
  });
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  expect(view().zoom).toBe(2);
});

it.each([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
])("pans only the canvas for %s and restores native scroll", (key) => {
  render(<Harness />);
  const canvas = screen.getByRole("application", { name: "Diagram" });
  const initial = view();
  fireEvent.keyDown(screen.getByRole("button", { name: "Entity" }), { key });
  expect(view()).toEqual(initial);
  fireEvent.keyDown(canvas, { key: "Enter" });
  expect(view()).toEqual(initial);
  fireEvent.keyDown(canvas, { key });
  expect(view().x).toBe(initial.x + (key === "ArrowLeft" ? 64 : key === "ArrowRight" ? -64 : 0));
  expect(view().y).toBe(initial.y + (key === "ArrowUp" ? 64 : key === "ArrowDown" ? -64 : 0));
  canvas.scrollLeft = 40;
  canvas.scrollTop = 30;
  fireEvent.scroll(canvas);
  expect(canvas.scrollLeft).toBe(0);
  expect(canvas.scrollTop).toBe(0);
});

it("normalizes wheel units, preserves the pointer anchor, and removes its listener on unmount", async () => {
  const hook = render(<Harness />);
  const canvas = screen.getByRole("application", { name: "Diagram" });
  const initial = view();
  const wheel = (deltaY: number, deltaMode: number) =>
    fireEvent.wheel(canvas, { deltaY, deltaMode, clientX: 100, clientY: 150 });
  wheel(-100, 0);
  await waitFor(() => expect(view().zoom).toBeCloseTo(1.15));
  expect((100 - view().x) / view().zoom).toBeCloseTo(100 - initial.x);
  expect((150 - view().y) / view().zoom).toBeCloseTo(150 - initial.y);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  wheel(1, 1);
  await waitFor(() => expect(view().zoom).toBeCloseTo(Math.exp((-16 * Math.log(1.15)) / 100)));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  wheel(1, 2);
  await waitFor(() => expect(view().zoom).toBeCloseTo(Math.exp((-400 * Math.log(1.15)) / 100)));
  wheel(100000, 0);
  await waitFor(() => expect(view().zoom).toBe(0.3));
  wheel(-100000, 0);
  await waitFor(() => expect(view().zoom).toBe(2));
  const remove = vi.spyOn(canvas, "removeEventListener");
  act(() => hook.unmount());
  expect(remove).toHaveBeenCalledWith("wheel", expect.any(Function));
});

it("ignores interactive/right-button drags, tracks one captured pointer, and suppresses only the drag click", async () => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  render(<Harness />);
  const canvas = screen.getByRole("application", { name: "Diagram" });
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);
  canvas.releasePointerCapture = vi.fn();
  const initial = view();
  const pointer = { pointerId: 7, button: 0, clientX: 100, clientY: 100 };
  fireEvent.pointerDown(screen.getByRole("button", { name: "Entity" }), pointer);
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 150 });
  expect(view()).toEqual(initial);
  fireEvent.pointerDown(canvas, { ...pointer, button: 2 });
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 150 });
  expect(view()).toEqual(initial);
  fireEvent.pointerDown(canvas, pointer);
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
  fireEvent.pointerMove(canvas, { ...pointer, pointerId: 8, clientX: 200 });
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 103 });
  expect(view()).toEqual(initial);
  expect(fireEvent.click(canvas)).toBe(true);
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 130, clientY: 140 });
  await waitFor(() => expect(view()).toEqual({ ...initial, x: initial.x + 30, y: initial.y + 40 }));
  fireEvent.pointerUp(canvas, { ...pointer, pointerId: 8 });
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 101, clientY: 101 });
  await waitFor(() => expect(view()).toEqual({ ...initial, x: initial.x + 1, y: initial.y + 1 }));
  fireEvent.pointerUp(canvas, pointer);
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
  fireEvent.pointerMove(canvas, { ...pointer, clientX: 200 });
  expect(view()).toEqual({ ...initial, x: initial.x + 1, y: initial.y + 1 });
  expect(fireEvent.click(canvas)).toBe(false);
  expect(fireEvent.click(canvas)).toBe(true);
});

it("recenters a keyboard-focused entity and removes browser-induced scroll offsets", () => {
  render(<Harness />);
  const canvas = screen.getByRole("application", { name: "Diagram" });
  fireEvent.keyDown(canvas, { key: "ArrowRight" });
  expect(view().x).toBe(-264);
  canvas.scrollLeft = 30;
  canvas.scrollTop = 40;
  act(() => screen.getByRole("button", { name: "Entity" }).focus());
  expect(view()).toEqual({ x: -200, y: -50, zoom: 1 });
  expect(canvas.scrollLeft).toBe(0);
  expect(canvas.scrollTop).toBe(0);
});

it.each([
  { width: 10000, height: 1000 },
  { width: 1000, height: 10000 },
])("reports a clipped overview in either dimension: %o", (size) => {
  render(<Harness model={{ ...layout, ...size }} />);
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  expect(view().zoom).toBe(0.3);
  expect(screen.getByRole("status", { name: "Clipped" })).toHaveTextContent("true");
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  expect(screen.getByRole("status", { name: "Clipped" })).toHaveTextContent("false");
});

it("resizes the visible diagram, disconnects observers and leaves the inline schema untouched", () => {
  const callbacks: (() => void)[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const mounted = render(<Harness />);
  expect(observe).toHaveBeenCalledWith(screen.getByRole("application", { name: "Diagram" }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  act(() => callbacks[0]?.());
  expect(view().x).toBe(-100);
  mounted.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  observe.mockClear();
  render(<Harness mode="schema" />);
  expect(observe).not.toHaveBeenCalled();
});
