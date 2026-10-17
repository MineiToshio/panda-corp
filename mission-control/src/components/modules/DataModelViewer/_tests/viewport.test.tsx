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
  it("supports deterministic directional button pan and zoom independent of native scroll offsets", async () => {
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
    expect(result.current.view.zoom).toBe(0.02);
  });
  it("does not move during click jitter and moves only beyond the drag threshold", async () => {
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
