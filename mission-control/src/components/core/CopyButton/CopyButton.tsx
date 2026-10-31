"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@/components/core/Icon/Icon";
import { Toast } from "@/components/core/Toast/Toast";
import { t } from "@/lib/copy/copy";
import styles from "./CopyButton.module.css";

/** Duration in milliseconds the "copiado" confirmation is shown before reverting. */
const REVERT_DELAY_MS = 2_000;

export interface CopyButtonProps {
  /** The text value to copy to the clipboard when the button is clicked. */
  value: string;
  /** Icon-only presentation inside a token-based command box. */
  variant?: "box";
  /** Accessible action name supplied by command surfaces. */
  accessibleLabel?: string;
  /** Reports whether the clipboard write succeeded. */
  onResult?: (copied: boolean) => void;
  /** Optional visible label rendered inside the button before the copy icon. */
  label?: string;
}

/**
 * Button chrome — neutral tokens (prototype `button`: card bg, bd2 border, text fg),
 * NOT the surrounding tone color. Tokens only (no hardcoded colors).
 */
const BUTTON_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "var(--command-copy-padding, 6px 9px)",
  minHeight: "var(--command-copy-height, auto)",
  cursor: "pointer",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--line-strong)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontFamily: "var(--font-display, inherit)",
  fontSize: "var(--command-font-size, var(--fs-sm))",
  fontWeight: 500,
  lineHeight: 1,
  flexShrink: 0,
};

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
export function CopyButton({
  value,
  label,
  variant,
  accessibleLabel,
  onResult,
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ copied: boolean; version: number } | null>(null);
  const mountedRef = useRef(true);
  const resultVersion = useRef(0);
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
      if (!mountedRef.current) return;
      setCopied(true);
      resultVersion.current += 1;
      setResult({ copied: true, version: resultVersion.current });
      onResult?.(true);

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
      if (!mountedRef.current) return;
      resultVersion.current += 1;
      setResult({ copied: false, version: resultVersion.current });
      onResult?.(false);
    }
  }, [value, onResult]);

  const ariaLabel = copied ? t("states.toast.copied") : "Copiar al portapapeles";

  const handleDismiss = useCallback(() => setResult(null), []);

  return (
    <>
      <button
        type="button"
        data-testid="copy-button"
        className={variant === "box" ? styles.box : undefined}
        aria-label={copied ? ariaLabel : (accessibleLabel ?? ariaLabel)}
        onClick={handleClick}
        style={
          variant === "box"
            ? {
                display: "inline-grid",
                placeItems: "center",
                flexShrink: 0,
                width: "calc(var(--s8) + var(--s1))",
                height: "calc(var(--s8) + var(--s1))",
                border: 0,
                padding: 0,
                borderRadius: "var(--r-sm)",
                background: "transparent",
                color: "var(--tone, var(--violet))",
                cursor: "pointer",
              }
            : BUTTON_STYLE
        }
      >
        {label !== undefined && <span>{label}</span>}
        {/* Icon-only affordance (prototype `ti-copy`); state via aria-label + icon swap,
          never a visible "copiar"/"copiado" word. */}
        <Icon name={copied ? "check" : "copy"} size="sm" />
      </button>
      {result !== null && !onResult ? (
        <Toast
          key={result.version}
          message={t(result.copied ? "states.toast.copied" : "states.toast.clipboardBlocked")}
          visible
          onDismiss={handleDismiss}
        />
      ) : null}
    </>
  );
}
