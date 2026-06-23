/**
 * useDagZoom tests — zoom transform behaviour through the public hook API.
 *
 * jsdom has no layout (getBoundingClientRect/wheel geometry is inert), so we
 * verify the observable contract: the scale the buttons produce and its clamp
 * bounds — not the scroll-anchoring maths, which needs a real viewport.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDagZoom } from "../useDagZoom";

describe("useDagZoom", () => {
  it("starts at scale 1 (100%) and not panning", () => {
    const { result } = renderHook(() => useDagZoom());
    expect(result.current.scale).toBe(1);
    expect(result.current.isPanning).toBe(false);
  });

  it("zoomIn increases the scale; zoomOut decreases it", () => {
    const { result } = renderHook(() => useDagZoom());

    act(() => result.current.zoomIn());
    const zoomed = result.current.scale;
    expect(zoomed).toBeGreaterThan(1);

    act(() => result.current.zoomOut());
    expect(result.current.scale).toBeLessThan(zoomed);
  });

  it("reset returns to 100% from any zoom", () => {
    const { result } = renderHook(() => useDagZoom());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    expect(result.current.scale).not.toBe(1);

    act(() => result.current.reset());
    expect(result.current.scale).toBe(1);
  });

  it("clamps zoom-out to a legible floor (never collapses toward 0)", () => {
    const { result } = renderHook(() => useDagZoom());
    for (let i = 0; i < 40; i++) act(() => result.current.zoomOut());

    const floor = result.current.scale;
    expect(floor).toBeGreaterThan(0);
    expect(floor).toBeLessThan(1);

    // Saturated: a further zoom-out is a no-op (no state churn below the floor).
    act(() => result.current.zoomOut());
    expect(result.current.scale).toBe(floor);
  });

  it("clamps zoom-in to a ceiling", () => {
    const { result } = renderHook(() => useDagZoom());
    for (let i = 0; i < 40; i++) act(() => result.current.zoomIn());

    const ceiling = result.current.scale;
    expect(ceiling).toBeGreaterThan(1);

    act(() => result.current.zoomIn());
    expect(result.current.scale).toBe(ceiling);
  });

  it("fitToView is a no-op when the container is unmeasured (stays at 1)", () => {
    // No DOM is attached to containerRef in renderHook, so fit can't measure a
    // viewport — it must leave the scale untouched rather than blow up.
    const { result } = renderHook(() => useDagZoom());
    act(() => result.current.fitToView(2000, 1500));
    expect(result.current.scale).toBe(1);
  });
});
