import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useFullscreen } from "@/hooks/useFullscreen";

/** Native browser fullscreen with a model-only full-window fallback and modal focus lifecycle. */
export function useModelExpansion() {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const enteredNative = useRef(false);
  const restoreIcon = useRef(false);
  const native = useFullscreen(surfaceRef);
  useEffect(() => {
    if (native.isFullscreen) enteredNative.current = true;
    else if (enteredNative.current) {
      enteredNative.current = false;
      setExpanded(false);
    }
  }, [native.isFullscreen]);
  useEffect(() => {
    if (!expanded) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-testid="model-close"]')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const trigger = restoreIcon.current
        ? triggerRef.current
            ?.closest('[data-testid="data-model-viewer"]')
            ?.querySelector<HTMLButtonElement>('[data-testid="model-fullscreen"]')
        : triggerRef.current?.querySelector("button");
      trigger?.focus();
    };
  }, [expanded]);
  function open(event?: MouseEvent<HTMLElement>) {
    restoreIcon.current = event?.currentTarget.getAttribute("data-testid") === "model-fullscreen";
    // Mount the model host within the gesture before the browser consumes transient activation.
    flushSync(() => setExpanded(true));
    native.toggle();
  }
  function close() {
    if (native.isFullscreen) native.toggle();
    setExpanded(false);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
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
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return { expanded, dialogRef, surfaceRef, triggerRef, open, close, onKeyDown };
}
