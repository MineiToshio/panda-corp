import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useUrlState } from "@/lib/navigation/useUrlState";

/** Fullscreen is entered only by a gesture; a restored URL never replays it. */
export function useModelExpansion() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const native = useFullscreen(surfaceRef);
  const enteredNative = useRef(false);
  const [, setExpandedKey] = useUrlState("expanded", "");
  useEffect(() => {
    if (native.isFullscreen) {
      enteredNative.current = true;
      setExpandedKey("1", true);
    } else if (enteredNative.current) {
      enteredNative.current = false;
      setExpandedKey("", true);
    }
  }, [native.isFullscreen, setExpandedKey]);
  useEffect(() => {
    function restoreInline() {
      if (native.isFullscreen) native.toggle();
    }
    window.addEventListener("popstate", restoreInline);
    return () => window.removeEventListener("popstate", restoreInline);
  }, [native.isFullscreen, native.toggle]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!native.isFullscreen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      native.toggle();
      setExpandedKey("", true);
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input,[tabindex="0"]',
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return { expanded: native.isFullscreen, surfaceRef, open: native.toggle, onKeyDown };
}
