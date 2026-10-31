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

import { useEffect, useEffectEvent, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToastProps {
  /** The message to display. */
  message: string;
  /** Whether the toast is currently visible. */
  visible: boolean;
  /** Auto-dismiss after this many ms when visible=true. Defaults to 2600ms. */
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
  durationMs = 2_600,
  onDismiss,
}: ToastProps): React.JSX.Element {
  const toastId = useId();
  const dismiss = useEffectEvent(() => onDismiss?.());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !message) return;

    // Clear any existing timer before starting a new one
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      dismiss();
    }, durationMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, durationMs, message]);

  const style: React.CSSProperties = {
    position: "fixed",
    bottom: "var(--s6)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 200,
    maxWidth: "calc(100vw - 32px)",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "var(--s3) var(--s4)",
    borderRadius: "var(--r)",
    background: "var(--primary-bg)",
    color: "var(--primary-fg)",
    fontSize: "var(--fs-md)",
    fontWeight: 600,
    boxShadow: "var(--shadow-toast)",
    // Opacity-only transition (FRD-13: transform/opacity only, <300ms)
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity var(--dur) var(--ease)",
  };

  return (
    <div
      id={`toast-${toastId}`}
      className="toast"
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
