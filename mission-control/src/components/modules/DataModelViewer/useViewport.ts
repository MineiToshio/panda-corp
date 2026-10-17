import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ModelLayout, ModelNode } from "./layout";

const MIN_ZOOM = 0.02;
function fittedView(layout: ModelLayout, width: number, height: number) {
  const zoom = Math.min(
    1,
    Math.max(MIN_ZOOM, Math.min((width - 64) / layout.width, (height - 64) / layout.height)),
  );
  return { zoom, x: (width - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2 };
}
function initialView(layout: ModelLayout, width: number, height: number) {
  const focus = [...layout.nodes].sort((a, b) => {
    const score = (node: ModelNode) => {
      const ends = layout.edges
        .flatMap((edge) => [edge.relationship.from, edge.relationship.to])
        .filter((endpoint) => endpoint.entity === node.entity.id);
      return ends.length + new Set(ends.flatMap((endpoint) => endpoint.attributes ?? [])).size * 2;
    };
    return score(b) - score(a);
  })[0];
  if (!focus) return fittedView(layout, width, height);
  const zoom = Math.min(0.9, (width - 64) / focus.width, (height - 64) / focus.height);
  return {
    zoom,
    x: width / 2 - (focus.x + focus.width / 2) * zoom,
    y: height / 2 - (focus.y + focus.height / 2) * zoom,
  };
}
const MAX_ZOOM = 2;
const PAN_STEP = 64;

/** Pointer, keyboard and button alternatives for a scrollbar-free graph viewport. */
export function useViewport(layout: ModelLayout, expanded = false, mode = "diagram") {
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
  const [view, setView] = useState(() => initialView(layout, 900, 440));
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
        ),
      );
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [layout, expanded, mode]);
  function focusNode(node: ModelNode) {
    const width = canvasRef.current?.clientWidth || 600;
    const height = canvasRef.current?.clientHeight || 420;
    setView({
      zoom: Math.min(1, (width - 32) / node.width, (height - 32) / node.height),
      x:
        width / 2 -
        (node.x + node.width / 2) *
          Math.min(1, (width - 32) / node.width, (height - 32) / node.height),
      y:
        height / 2 -
        (node.y + node.height / 2) *
          Math.min(1, (width - 32) / node.width, (height - 32) / node.height),
    });
  }
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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
    setView((old) => ({ ...old, x: drag.originX + dx, y: drag.originY + dy }));
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
          Math.max(MIN_ZOOM, old.zoom * Math.exp(-event.deltaY * 0.002)),
        );
        const ratio = zoom / old.zoom;
        return {
          zoom,
          x: center.x - (center.x - old.x) * ratio,
          y: center.y - (center.y - old.y) * ratio,
        };
      });
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
    reset: () =>
      setView(
        initialView(
          layout,
          canvasRef.current?.clientWidth || 900,
          canvasRef.current?.clientHeight || 440,
        ),
      ),
    handlers: {
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
