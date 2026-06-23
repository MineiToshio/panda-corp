/**
 * useDagZoom — zoom + pan state for the WoDag canvas.
 *
 * Why this exists: the DAG used to render with `maxWidth:100%` + `height:auto`,
 * so a wide graph was auto-shrunk to fit the column and became illegibly small.
 * This hook drives an explicit, zoom/pan-able canvas instead:
 *   - `scale` multiplies the SVG's natural size; the container scrolls to pan.
 *   - Buttons (zoom in/out/reset/fit) and the mouse wheel both change `scale`.
 *   - Wheel zoom is zoom-to-cursor: the point under the pointer stays put.
 *
 * The wheel listener is attached imperatively with `{ passive: false }` because
 * React's synthetic onWheel can be passive, and we must `preventDefault()` to
 * stop the page from scrolling while the pointer is over the graph.
 *
 * Pure of product logic — it only owns view transform state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Smallest zoom — lets a large graph be "fit" to the viewport. */
const MIN_SCALE = 0.3;
/** Largest zoom. */
const MAX_SCALE = 2.5;
/** Multiplicative step per button press / wheel notch. */
const STEP = 1.15;
/** Inner margin (px) left around the graph when fitting to the viewport. */
const FIT_PAD = 24;

/** Clamp a scale into [MIN_SCALE, MAX_SCALE]. */
function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** A point to keep stationary across a scale change (zoom-to-cursor). */
interface ZoomAnchor {
  /** Pointer offset from the container's top-left, in viewport px. */
  vx: number;
  vy: number;
  /** Graph-space (unscaled) coordinates of the point under the pointer. */
  gx: number;
  gy: number;
}

export interface DagZoom {
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Fit the given graph content size into the current viewport. */
  fitToView: (contentW: number, contentH: number) => void;
}

/**
 * Own the WoDag canvas zoom/pan transform.
 *
 * `containerRef` must be attached to the scrollable viewport that wraps the
 * scaled SVG; the hook reads its size/scroll to implement zoom-to-cursor and
 * fit-to-viewport, and adjusts its scroll after each scale change.
 */
export function useDagZoom(): DagZoom {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mirror scale in a ref so the (once-attached) wheel listener reads it live.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Anchor to re-align after the scaled DOM has laid out (set on every zoom).
  const pendingAnchor = useRef<ZoomAnchor | null>(null);

  /** Stage a scale change anchored at a viewport point, then commit it. */
  const zoomTo = useCallback((nextScale: number, vx: number, vy: number) => {
    const el = containerRef.current;
    const old = scaleRef.current;
    const next = clampScale(nextScale);
    if (next === old) return;
    if (el) {
      pendingAnchor.current = {
        vx,
        vy,
        gx: (el.scrollLeft + vx) / old,
        gy: (el.scrollTop + vy) / old,
      };
    }
    setScale(next);
  }, []);

  /** Zoom around the centre of the current viewport (button presses). */
  const zoomAtCenter = useCallback(
    (compute: (old: number) => number) => {
      const el = containerRef.current;
      const vx = el ? el.clientWidth / 2 : 0;
      const vy = el ? el.clientHeight / 2 : 0;
      zoomTo(compute(scaleRef.current), vx, vy);
    },
    [zoomTo],
  );

  const zoomIn = useCallback(() => zoomAtCenter((s) => s * STEP), [zoomAtCenter]);
  const zoomOut = useCallback(() => zoomAtCenter((s) => s / STEP), [zoomAtCenter]);
  const reset = useCallback(() => zoomAtCenter(() => 1), [zoomAtCenter]);

  const fitToView = useCallback(
    (contentW: number, contentH: number) => {
      const el = containerRef.current;
      if (!el || contentW <= 0 || contentH <= 0) return;
      const sw = (el.clientWidth - FIT_PAD) / contentW;
      const sh = (el.clientHeight - FIT_PAD) / contentH;
      zoomAtCenter(() => Math.min(sw, sh));
    },
    [zoomAtCenter],
  );

  // After a scale change, re-align the scroll so the anchored point stays put.
  useEffect(() => {
    const el = containerRef.current;
    const anchor = pendingAnchor.current;
    if (!el || !anchor) return;
    el.scrollLeft = anchor.gx * scale - anchor.vx;
    el.scrollTop = anchor.gy * scale - anchor.vy;
    pendingAnchor.current = null;
  }, [scale]);

  // Non-passive wheel listener → plain-wheel zoom-to-cursor over the graph.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const old = scaleRef.current;
      const next = e.deltaY < 0 ? old * STEP : old / STEP;
      zoomTo(next, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  return { scale, containerRef, zoomIn, zoomOut, reset, fitToView };
}
