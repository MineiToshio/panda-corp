"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

const OPEN_DIALOGS: HTMLDialogElement[] = [];
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let restoreScroll: (() => void) | undefined;

function lockScroll(): void {
  if (restoreScroll) return;
  const root = document.documentElement;
  const overflow = root.style.overflow;
  const gutter = root.style.scrollbarGutter;
  root.style.scrollbarGutter = "stable";
  root.style.overflow = "hidden";
  restoreScroll = () => {
    root.style.overflow = overflow;
    root.style.scrollbarGutter = gutter;
  };
}

function trapFocus(event: KeyboardEvent, panel: HTMLDialogElement): void {
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const current = document.activeElement;
  if (event.shiftKey && (current === first || current === panel || !panel.contains(current))) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (current === last || current === panel || !panel.contains(current))
  ) {
    event.preventDefault();
    first.focus();
  }
}

/** Couple controlled visibility to native modal state without reopening on callback changes. */
export function useModalLifecycle({
  open,
  panelRef,
  onClose,
}: {
  open: boolean;
  panelRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
}): void {
  const requestClose = useEffectEvent(onClose);
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const opener = document.activeElement;
    const native = typeof panel.showModal === "function";
    if (native) panel.showModal();
    else panel.setAttribute("open", "");
    OPEN_DIALOGS.push(panel);
    lockScroll();
    panel.focus();
    function handleKeyDown(event: KeyboardEvent): void {
      if (OPEN_DIALOGS.at(-1) !== panel || !panel) return;
      if (event.key === "Escape" && !native) {
        event.preventDefault();
        requestClose();
      }
      if (event.key === "Tab") trapFocus(event, panel);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const wasTop = OPEN_DIALOGS.at(-1) === panel;
      const index = OPEN_DIALOGS.indexOf(panel);
      if (index >= 0) OPEN_DIALOGS.splice(index, 1);
      if (panel.open && typeof panel.close === "function") panel.close();
      else panel.removeAttribute("open");
      if (!OPEN_DIALOGS.length) {
        restoreScroll?.();
        restoreScroll = undefined;
      }
      if (wasTop && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open, panelRef]);
}
