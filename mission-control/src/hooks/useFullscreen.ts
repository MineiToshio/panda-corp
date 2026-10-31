/**
 * useFullscreen — drive the browser Fullscreen API for one element.
 *
 * `toggle()` requests fullscreen on `ref` (or exits if already fullscreen);
 * `isFullscreen` tracks the live state via the `fullscreenchange` event so the
 * caller can swap the maximize/minimize icon and expand its layout to fill.
 *
 * Cross-browser hardened:
 *   - `requestFullscreen()`/`exitFullscreen()` return a Promise per spec, but
 *     some engines (older WebKit/Safari, some WebViews) return `undefined` — so
 *     we wrap the result in `Promise.resolve(...)` before `.catch` instead of
 *     calling `.catch` on the raw return (which threw "reading 'catch' of
 *     undefined").
 *   - A `try/catch` swallows engines that throw synchronously when blocked.
 *   - Falls back to the legacy `webkit*` members (Safari) for the element/exit
 *     calls and the change event, and is a no-op where no API exists (jsdom).
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Legacy WebKit-prefixed Fullscreen members the standard DOM types omit. */
interface WebkitFullscreenDocument {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
interface WebkitFullscreenElement {
  webkitRequestFullscreen?: () => void;
}

/** The current fullscreen element across standard + WebKit-prefixed APIs. */
function currentFullscreenElement(): Element | null {
  const doc = document as Document & WebkitFullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export interface Fullscreen {
  /** True while `ref`'s element is the document's fullscreen element. */
  isFullscreen: boolean;
  /** Enter fullscreen on `ref` (or exit if already fullscreen). */
  toggle: () => void;
}

/** Track + toggle fullscreen for the element held by `ref`. */
export function useFullscreen(ref: React.RefObject<HTMLElement | null>): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const trigger = useRef<HTMLElement | null>(null);
  const wasFullscreen = useRef(false);
  useEffect(() => {
    const onChange = (): void => {
      const active = currentFullscreenElement() === ref.current;
      setIsFullscreen(active);
      if (wasFullscreen.current && !active) trigger.current?.focus();
      if (active) ref.current?.querySelector<HTMLElement>("button")?.focus();
      wasFullscreen.current = active;
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      if (currentFullscreenElement() === ref.current) exitFullscreen();
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [ref]);

  const toggle = useCallback((): void => {
    const el = ref.current;
    if (!el) return;
    const elx = el as HTMLElement & WebkitFullscreenElement;
    if (!currentFullscreenElement())
      trigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restore = () => trigger.current?.focus();
    try {
      if (currentFullscreenElement()) {
        exitFullscreen();
      } else if (el.requestFullscreen) {
        void Promise.resolve(el.requestFullscreen()).catch(restore);
      } else {
        elx.webkitRequestFullscreen?.();
      }
    } catch {
      restore();
      // Blocked / no user gesture / engine threw synchronously — stay inline.
    }
  }, [ref]);

  return { isFullscreen, toggle };
}

function exitFullscreen(): void {
  const doc = document as Document & WebkitFullscreenDocument;
  if (document.exitFullscreen) void Promise.resolve(document.exitFullscreen()).catch(() => {});
  else doc.webkitExitFullscreen?.();
}
