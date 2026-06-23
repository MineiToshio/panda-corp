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
/** Pointer travel (px) past which a press becomes a pan (not a node click). */
const PAN_THRESHOLD = 4;

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
  /** True while the user is grab-dragging the canvas (drives the grab/grabbing cursor). */
  isPanning: boolean;
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
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mirror scale in a ref so the (once-attached) wheel listener reads it live.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // True once a press has travelled past PAN_THRESHOLD — used to swallow the
  // click that ends a drag so a pan never accidentally selects a node.
  const didPanRef = useRef(false);

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

  // Grab-to-pan: press and drag anywhere on the canvas to scroll it. Listeners
  // live on window during the drag so it keeps tracking if the pointer leaves
  // the viewport, and a travelled press swallows the trailing click so panning
  // never selects a node.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let origin: { x: number; y: number; left: number; top: number } | null = null;

    const onMouseMove = (e: MouseEvent): void => {
      if (!origin) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (!didPanRef.current && Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) {
        didPanRef.current = true;
      }
      el.scrollLeft = origin.left - dx;
      el.scrollTop = origin.top - dy;
    };

    const endPan = (): void => {
      if (!origin) return;
      origin = null;
      setIsPanning(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endPan);
    };

    const onMouseDown = (e: MouseEvent): void => {
      // Left button only; ignore presses on the native scrollbar gutter.
      if (e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      if (e.clientX - rect.left > el.clientWidth || e.clientY - rect.top > el.clientHeight) return;
      didPanRef.current = false;
      origin = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      setIsPanning(true);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", endPan);
    };

    // Capture phase: if the press turned into a pan, stop the click before it
    // reaches a node (which would otherwise toggle its dependency chain).
    const onClickCapture = (e: MouseEvent): void => {
      if (didPanRef.current) {
        e.stopPropagation();
        e.preventDefault();
        didPanRef.current = false;
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endPan);
    };
  }, []);

  return { scale, containerRef, isPanning, zoomIn, zoomOut, reset, fitToView };
}
