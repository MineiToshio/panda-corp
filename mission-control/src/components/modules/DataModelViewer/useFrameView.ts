import { useCallback, useEffect, useRef, useState } from "react";

type View = { x: number; y: number; zoom: number };
type Update = View | ((view: View) => View);

/** Batch high-frequency wheel/drag events once per frame; direct actions cancel stale frames. */
export function useFrameView(initial: () => View) {
  const [view, setView] = useState(initial);
  const current = useRef(view);
  const frame = useRef<number | null>(null);
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => cancelFrame, [cancelFrame]);
  const update = useCallback(
    (next: Update, deferred = false) => {
      current.current = typeof next === "function" ? next(current.current) : next;
      if (!deferred || typeof requestAnimationFrame === "undefined") {
        cancelFrame();
        setView(current.current);
      } else if (frame.current === null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setView(current.current);
        });
      }
    },
    [cancelFrame],
  );
  return { view, update };
}
