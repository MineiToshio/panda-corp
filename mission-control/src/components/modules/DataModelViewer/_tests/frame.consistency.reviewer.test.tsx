import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFrameView } from "../useFrameView";

let frames: Map<number, FrameRequestCallback>;
let frameSequence = 0;

beforeEach(() => {
  frames = new Map();
  frameSequence = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++frameSequence;
      frames.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id)),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function flushFrames() {
  for (const [id, callback] of frames) {
    frames.delete(id);
    callback(16);
  }
}

describe("fluid graph viewport scheduling", () => {
  it("commits one frame for a burst while preserving every accumulated zoom delta", () => {
    const { result } = renderHook(() => useFrameView(() => ({ x: 0, y: 0, zoom: 1 })));
    act(() => {
      for (let index = 0; index < 3; index += 1)
        result.current.update((view) => ({ ...view, zoom: view.zoom * 1.15 }), true);
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(result.current.view.zoom).toBe(1);
    act(flushFrames);
    expect(result.current.view.zoom).toBeCloseTo(1.15 ** 3);
  });

  it("cancels a pending wheel or drag frame when a direct reset or fit replaces it", () => {
    const { result } = renderHook(() => useFrameView(() => ({ x: 0, y: 0, zoom: 1 })));
    act(() => result.current.update({ x: 17, y: 21, zoom: 1.5 }, true));
    act(() => result.current.update({ x: 40, y: 60, zoom: 0.9 }));

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    act(flushFrames);
    expect(result.current.view).toEqual({ x: 40, y: 60, zoom: 0.9 });
  });

  it("cancels a queued commit on unmount so an old diagram cannot update after closing", () => {
    const { result, unmount } = renderHook(() => useFrameView(() => ({ x: 0, y: 0, zoom: 1 })));
    act(() => result.current.update({ x: 17, y: 21, zoom: 1.5 }, true));
    expect(frames.size).toBe(1);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });
});
