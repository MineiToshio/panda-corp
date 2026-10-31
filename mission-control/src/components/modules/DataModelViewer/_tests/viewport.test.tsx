import { act, cleanup, fireEvent, renderHook, waitFor } from "@testing-library/react";
import type { KeyboardEvent, PointerEvent } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { layoutModel } from "../layout";
import { useViewport } from "../useViewport";
import { modelFixture } from "./fixture";

afterEach(cleanup);

function pointer(canvas: HTMLDivElement, x: number, y: number): PointerEvent<HTMLDivElement> {
  const event = new MouseEvent("pointerdown", { clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: 3 },
    target: { value: canvas },
    currentTarget: { value: canvas },
  });
  // React event wrappers expose the same fields used by these handlers.
  return event as unknown as PointerEvent<HTMLDivElement>;
}

describe("diagram navigation", () => {
  it("AC-02-015.3 AC-02-015.12: supports deterministic directional button pan and zoom independent of native scroll offsets", async () => {
    const layout = await layoutModel(modelFixture());
    const { result } = renderHook(() => useViewport(layout));
    const initial = result.current.view;
    act(() => result.current.pan(64, 0));
    expect(result.current.view.x).toBe(initial.x + 64);
    expect(result.current.view.y).toBe(initial.y);
    act(() => result.current.pan(0, -64));
    expect(result.current.view.y).toBe(initial.y - 64);
    act(() => result.current.zoomBy(100));
    expect(result.current.view.zoom).toBe(2);
    act(() => result.current.zoomBy(0.001));
    expect(result.current.view.zoom).toBe(0.3);
  });
  it("AC-13-010.2: opens and focuses tall entities at 100%, preserving navigation across 56 entities", async () => {
    const fixture = modelFixture();
    const model = {
      ...fixture,
      entities: Array.from({ length: 56 }, (_, index) => ({
        ...fixture.entities[0],
        id: `entity-${index}`,
        name: `Entity${index}`,
        attributes: Array.from({ length: 40 }, (_, field) => ({
          id: `field-${field}`,
          name: `field${field}`,
          type: "text",
          optional: false,
        })),
      })),
      relationships: [],
    };
    const layout = await layoutModel(model);
    const { result } = renderHook(() => useViewport(layout));
    expect(result.current.view.zoom).toBe(1);
    const last = layout.nodes[55];
    if (!last) throw new Error("Missing 56th entity");
    act(() => result.current.focusNode(last));
    expect(result.current.view.zoom).toBe(1);
    act(() => result.current.fit());
    expect(result.current.view.zoom).toBeGreaterThanOrEqual(0.3);
    act(() => result.current.reset());
    expect(result.current.view.zoom).toBe(1);
  });
  it("AC-02-015.13: does not move during click jitter and moves only beyond the drag threshold", async () => {
    const canvas = document.createElement("div");
    const layout = await layoutModel(modelFixture());
    const { result } = renderHook(() => useViewport(layout));
    const initial = result.current.view;
    act(() => result.current.handlers.onPointerDown(pointer(canvas, 100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer(canvas, 102, 102)));
    expect(result.current.view).toEqual(initial);
    act(() => result.current.handlers.onPointerMove(pointer(canvas, 120, 135)));
    await waitFor(() =>
      expect(result.current.view).toEqual({
        x: initial.x + 20,
        y: initial.y + 35,
        zoom: initial.zoom,
      }),
    );
    act(() => result.current.handlers.onPointerUp(pointer(canvas, 120, 135)));
    act(() => result.current.handlers.onPointerMove(pointer(canvas, 200, 200)));
    expect(result.current.view).toEqual({
      x: initial.x + 20,
      y: initial.y + 35,
      zoom: initial.zoom,
    });
  });
  it("supports arrow-key panning without intercepting keys inside entity controls", async () => {
    const canvas = document.createElement("div");
    const layout = await layoutModel(modelFixture());
    const { result } = renderHook(() => useViewport(layout));
    const initial = result.current.view;
    const event = new window.KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
    Object.defineProperties(event, { target: { value: canvas }, currentTarget: { value: canvas } });
    act(() => result.current.handlers.onKeyDown(event as unknown as KeyboardEvent<HTMLDivElement>));
    expect(result.current.view.x).toBe(initial.x - 64);
    expect(event.defaultPrevented).toBe(true);
    const button = document.createElement("button");
    canvas.append(button);
    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(result.current.view.x).toBe(initial.x - 64);
  });
});

it("opens at the graph origin and restores a deep-linked entity at detail scale", async () => {
  const layout = await layoutModel(modelFixture());
  const origin = renderHook(() => useViewport(layout));
  expect(origin.result.current.view).toEqual({ x: 0, y: 0, zoom: 1 });
  const linked = renderHook(() => useViewport(layout, false, "diagram", "audit"));
  const target = layout.nodes.find((node) => node.entity.id === "audit");
  if (!target) throw new Error("Missing audit entity");
  expect(linked.result.current.view.x).toBe(450 - target.x - target.width / 2);
  expect(linked.result.current.view.zoom).toBe(1);
});
