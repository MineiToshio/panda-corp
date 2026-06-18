"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Duration in milliseconds the "copiado" confirmation is shown before reverting. */
const REVERT_DELAY_MS = 2_000;

export interface CopyButtonProps {
  /** The text value to copy to the clipboard when the button is clicked. */
  value: string;
  /** Optional visible label rendered inside the button alongside the copy icon. */
  label?: string;
}

/**
 * CopyButton — shared clipboard affordance (CMP-02-copy-button).
 *
 * Copies `value` to the clipboard via `navigator.clipboard.writeText`,
 * shows a transient "copiado" confirmation in Spanish, then reverts
 * after REVERT_DELAY_MS ms.
 *
 * Reused by FRD-01 (onboarding gate), FRD-02 (intake modal + card detail),
 * FRD-03 (recovery/next-step commands).
 *
 * AC-02-003.x / AC-02-004.x
 */
export function CopyButton({ value, label }: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    // Guard: do not trigger a second write while the first is in flight
    if (pendingRef.current) return;

    pendingRef.current = true;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      // Clear any existing revert timeout
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        // flushSync ensures React flushes the state update synchronously when
        // the timer fires — critical for tests using vi.advanceTimersByTime
        // (fake timers execute callbacks synchronously, outside React's act).
        flushSync(() => {
          setCopied(false);
        });
        pendingRef.current = false;
        timeoutRef.current = null;
      }, REVERT_DELAY_MS);
    } catch {
      // Clipboard write failed (e.g. NotAllowedError in restricted contexts).
      // Do NOT show the "copiado" confirmation — that would mislead the user.
      pendingRef.current = false;
    }
  }, [value]);

  const ariaLabel = copied ? "Copiado al portapapeles" : "Copiar al portapapeles";

  return (
    <button
      type="button"
      data-testid="copy-button"
      aria-label={ariaLabel}
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.5rem",
        cursor: "pointer",
        borderRadius: "0.375rem",
        border: "1px solid currentColor",
        background: "transparent",
        fontFamily: "inherit",
        fontSize: "inherit",
      }}
    >
      {label !== undefined && <span>{label}</span>}
      {copied ? <span>copiado</span> : <span>copiar</span>}
    </button>
  );
}
