import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { ModelLayout, ModelNode } from "./layout";

function initialView(layout: ModelLayout) {
  const first = layout.nodes[0];
  return { x: 24 - (first?.x ?? 0), y: 24 - (first?.y ?? 0), zoom: 1 };
}
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const PAN_STEP = 64;

/** Pointer, keyboard and button alternatives for a scrollbar-free graph viewport. */
export function useViewport(layout: ModelLayout) {
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
  const [view, setView] = useState(() => initialView(layout));
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
    const width = canvasRef.current?.clientWidth || 600;
    const height = canvasRef.current?.clientHeight || 420;
    const zoom = Math.min(
      1,
      Math.max(MIN_ZOOM, Math.min((width - 32) / layout.width, (height - 32) / layout.height)),
    );
    setView({ zoom, x: (width - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2 });
  }
  function focusNode(node: ModelNode) {
    const width = canvasRef.current?.clientWidth || 600;
    const height = canvasRef.current?.clientHeight || 420;
    setView({
      zoom: 1,
      x: width / 2 - node.x - node.width / 2,
      y: height / 2 - node.y - node.height / 2,
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
    reset: () => setView(initialView(layout)),
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
