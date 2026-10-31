"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

/** Observe the strip geometry; overflow controls live outside the tablist. */
export function useTabOverflow(ref: RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const left = list.scrollLeft > 1;
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setEdges((previous) =>
      previous.left === left && previous.right === right ? previous : { left, right },
    );
  }, [ref]);
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    measure();
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    resize?.observe(list);
    const mutation = new MutationObserver(measure);
    mutation.observe(list, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", measure);
    return () => {
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, ref]);
  function scroll(direction: number): void {
    const list = ref.current;
    list?.scrollBy?.({ left: direction * list.clientWidth, behavior: "auto" });
  }
  return { ...edges, measure, scroll };
}
