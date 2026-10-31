import type { FocusEvent, KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ModelLayout, ModelNode } from "./layout";
import { useFrameView } from "./useFrameView";

const MIN_ZOOM = 0.3;
function fittedView(layout: ModelLayout, width: number, height: number) {
  const zoom = Math.min(
    1,
    Math.max(MIN_ZOOM, Math.min((width - 64) / layout.width, (height - 64) / layout.height)),
  );
  return { zoom, x: (width - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2 };
}
function initialView(layout: ModelLayout, width: number, height: number, entityId = "") {
  const focus = layout.nodes.find((node) => node.entity.id === entityId);
  if (!focus) return { zoom: 1, x: 0, y: 0 };
  return {
    zoom: 1,
    x: Math.max(32, (width - focus.width) / 2) - focus.x,
    y: Math.max(64, (height - focus.height) / 2) - focus.y,
  };
}
const MAX_ZOOM = 2;
const PAN_STEP = 64;

/** Pointer, keyboard and button alternatives for a scrollbar-free graph viewport. */
export function useViewport(
  layout: ModelLayout,
  expanded = false,
  mode = "diagram",
  entityId = "",
) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const { view, update: setView } = useFrameView(() => initialView(layout, 900, 440, entityId));
  function pan(x: number, y: number) {
    setView((old) => ({ ...old, x: old.x + x, y: old.y + y }));
  }
  function zoomBy(factor: number, anchor?: { x: number; y: number }) {
    const box = canvasRef.current;
    const center = anchor ?? {
      x: (box?.clientWidth || 600) / 2,
      y: (box?.clientHeight || 420) / 2,
    };
    setView((old) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, old.zoom * factor));
      const ratio = zoom / old.zoom;
      return {
        zoom,
        x: center.x - (center.x - old.x) * ratio,
        y: center.y - (center.y - old.y) * ratio,
      };
    });
  }
  function fit() {
    const canvas = canvasRef.current;
    setView(fittedView(layout, canvas?.clientWidth || 900, canvas?.clientHeight || 440));
  }
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (mode === "schema" && !expanded)) return;
    const resize = () =>
      setView(
        initialView(
          layout,
          canvas.clientWidth || (expanded ? window.innerWidth : 900),
          canvas.clientHeight || (expanded ? window.innerHeight : 440),
          entityId,
        ),
      );
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [layout, expanded, mode, entityId, setView]);
  const focusNode = useCallback(
    (node: ModelNode) => {
      const width = canvasRef.current?.clientWidth || 600;
      const height = canvasRef.current?.clientHeight || 420;
      setView({
        zoom: 1,
        x: Math.max(32, (width - node.width) / 2) - node.x,
        y: Math.max(64, (height - node.height) / 2) - node.y,
      });
    },
    [setView],
  );
  function restoreNativeScroll() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.scrollLeft) canvas.scrollLeft = 0;
    if (canvas.scrollTop) canvas.scrollTop = 0;
  }
  function handleFocusCapture(event: FocusEvent<HTMLDivElement>) {
    restoreNativeScroll();
    if (!(event.target instanceof Element)) return;
    const id = event.target.closest<HTMLElement>("[data-entity-id]")?.dataset.entityId;
    const node = layout.nodes.find((item) => item.entity.id === id);
    // Pointer activation must finish before its target moves beneath the pointer.
    if (node && event.target.matches(":focus-visible")) focusNode(node);
  }
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    window.getSelection()?.removeAllRanges();
    suppressClick.current = false;
    if (
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest("[data-model-interactive]")
    )
      return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClick.current = false;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    };
  }
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) < 5 && !drag.moved) return;
    drag.moved = true;
    suppressClick.current = true;
    setView((old) => ({ ...old, x: drag.originX + dx, y: drag.originY + dy }), true);
  }
  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    pan(delta[0], delta[1]);
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const center = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setView((old) => {
        const zoom = Math.min(
          MAX_ZOOM,
          Math.max(
            MIN_ZOOM,
            old.zoom *
              Math.exp(
                (-event.deltaY *
                  (event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                      ? canvas?.clientHeight || 440
                      : 1) *
                  Math.log(1.15)) /
                  100,
              ),
          ),
        );
        const ratio = zoom / old.zoom;
        return {
          zoom,
          x: center.x - (center.x - old.x) * ratio,
          y: center.y - (center.y - old.y) * ratio,
        };
      }, true);
    }
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  });
  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }
  return {
    canvasRef,
    view,
    pan,
    zoomBy,
    fit,
    focusNode,
    isOverviewClipped:
      view.zoom <= MIN_ZOOM &&
      (layout.width * view.zoom > (canvasRef.current?.clientWidth || 900) - 64 ||
        layout.height * view.zoom > (canvasRef.current?.clientHeight || 440) - 64),
    reset: () =>
      setView(
        initialView(
          layout,
          canvasRef.current?.clientWidth || 900,
          canvasRef.current?.clientHeight || 440,
          entityId,
        ),
      ),
    handlers: {
      onFocusCapture: handleFocusCapture,
      onScroll: restoreNativeScroll,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onLostPointerCapture: handlePointerEnd,
      onKeyDown: handleKeyDown,
      onClickCapture: handleClickCapture,
    },
  };
}
