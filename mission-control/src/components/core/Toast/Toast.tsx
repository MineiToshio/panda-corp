"use client";

/**
 * WO-13-007 — Toast (CMP-13-toast)
 *
 * Transient bottom confirmation ("copiado"). Small, sober, auto-dismiss.
 * NOT a celebration; distinct from AchievementToast (Party, FRD-06).
 *
 * Respects prefers-reduced-motion: the appear/disappear transition is CSS-only
 * (opacity transition on the element). The JS side only manages visibility
 * timing and fires onDismiss when durationMs has elapsed.
 *
 * Tokens only. Light+dark first-class.
 * Traceability: CMP-13-toast, AC-13-006.x.
 */

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToastProps {
  /** The message to display. */
  message: string;
  /** Whether the toast is currently visible. */
  visible: boolean;
  /** Auto-dismiss after this many ms when visible=true. Defaults to 2000ms. */
  durationMs?: number;
  /** Called when the auto-dismiss timer fires (parent should set visible=false). */
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

/**
 * Toast — transient sober bottom confirmation.
 *
 * Usage:
 *   const [visible, setVisible] = useState(false);
 *   <Toast message="Copiado" visible={visible} onDismiss={() => setVisible(false)} />
 *
 * The parent controls visibility; Toast fires onDismiss when the timer elapses.
 * Motion: CSS opacity transition — disabled automatically by prefers-reduced-motion
 * (globals.css sets transition-duration:0ms under the media query).
 */
export function Toast({
  message,
  visible,
  durationMs = 2_000,
  onDismiss,
}: ToastProps): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;

    // Clear any existing timer before starting a new one
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onDismiss?.();
    }, durationMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, durationMs, onDismiss]);

  const style: React.CSSProperties = {
    position: "fixed",
    bottom: "calc(var(--space-base, 1rem) * 1.5)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 200,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "var(--radius-sm, 8px)",
    border: "var(--hairline, 1px) solid var(--color-border-strong)",
    background: "var(--color-card)",
    color: "var(--color-text)",
    fontSize: "13px",
    fontWeight: 500,
    boxShadow: "var(--shadow-2, 0 18px 50px rgba(0,0,0,.5))",
    // Opacity-only transition (FRD-13: transform/opacity only, <300ms)
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity var(--duration-base, 200ms) var(--easing-standard, ease)",
  };

  return (
    <div
      data-testid="toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={visible ? undefined : "true"}
      style={style}
    >
      {message}
    </div>
  );
}
