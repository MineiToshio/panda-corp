/**
 * useFullscreen tests — the observable contract under jsdom, which has no
 * Fullscreen API: the hook must start "not fullscreen" and `toggle()` must be a
 * safe no-op (guarded) rather than throw on a missing `requestFullscreen`.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFullscreen } from "../useFullscreen";

describe("useFullscreen", () => {
  it("starts not fullscreen", () => {
    const ref: React.RefObject<HTMLElement | null> = { current: document.createElement("div") };
    const { result } = renderHook(() => useFullscreen(ref));
    expect(result.current.isFullscreen).toBe(false);
  });

  it("toggle is a safe no-op when the Fullscreen API is unavailable", () => {
    const ref: React.RefObject<HTMLElement | null> = { current: document.createElement("div") };
    const { result } = renderHook(() => useFullscreen(ref));
    expect(() => act(() => result.current.toggle())).not.toThrow();
    expect(result.current.isFullscreen).toBe(false);
  });

  it("toggle is a no-op with a null ref", () => {
    const ref: React.RefObject<HTMLElement | null> = { current: null };
    const { result } = renderHook(() => useFullscreen(ref));
    expect(() => act(() => result.current.toggle())).not.toThrow();
  });
});
