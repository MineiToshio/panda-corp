"use client";
/**
 * WO-06-008 — AchievementToast (CMP-06-achievement)
 *
 * Celebratory toast fired when a work-order-close event arrives.
 * Shows "¡Logro desbloqueado!" with the work-order id (if present).
 * Self-dismisses after a short timeout; aria-live announcement.
 *
 * Motion rules (FRD-13):
 *   - Animation uses ONLY transform + opacity, transition <300ms.
 *   - prefers-reduced-motion: renders without animation (data-animated="false").
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every structural element.
 *   - Spanish user-facing copy (AGENTS.md).
 *
 * Traceability:
 *   CMP-06-achievement → REQ-06-007 → AC-06-007.1
 *   IF-06-event-vm (event-vm.ts, WO-06-001) — EventVM input type
 *   IF-13-tokens (tokens.ts, WO-13-001) — motion / color tokens
 */

import { useEffect, useRef, useState } from "react";
import type { EventVM } from "../event-vm/event-vm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration in ms before the toast auto-dismisses. */
const DISMISS_TIMEOUT_MS = 3500;

/** Only an achievement FRESHER than this fires the toast — a stale tail replay is
 * history (the feed already shows it), not news (owner, 2026-07-02: an hours-old
 * "¡Logro desbloqueado!" greeted every page visit and read as stuck). */
const FRESH_WINDOW_MS = 3 * 60_000;

/** The event type that triggers the achievement toast. */
const ACHIEVEMENT_EVENT_TYPE = "achievement";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AchievementToastProps {
  /**
   * The latest incoming event view-model from the event stream.
   * When event.icon === "trophy" (achievement type), the toast fires.
   * When undefined/null, no toast is shown.
   */
  latestEvent: EventVM | undefined | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

/**
 * Container style: fixed position, top-right corner.
 * Transitions use only transform + opacity, <300ms (FRD-13 motion tokens).
 */
function toastStyle(visible: boolean, animated: boolean): React.CSSProperties {
  const transition = animated
    ? "opacity 200ms var(--ease-out, ease-out), transform 200ms var(--ease-out, ease-out)"
    : "none";
  return {
    position: "fixed",
    top: "calc(var(--spacing, 0.25rem) * 6)",
    right: "calc(var(--spacing, 0.25rem) * 6)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 3)",
    padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
    borderRadius: "var(--radius, 0.5rem)",
    background: "var(--color-achievement-bg, var(--color-surface-panel, Canvas))",
    color: "var(--color-achievement-text, var(--color-text, currentColor))",
    border:
      "var(--hairline, 1px) solid var(--color-achievement-border, var(--color-border, currentColor))",
    boxShadow: "var(--shadow-panel, 0 4px 16px oklch(0 0 0 / 0.2))",
    fontSize: "0.875rem",
    fontWeight: 600,
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(calc(-1 * var(--spacing, 0.25rem) * 2))",
    pointerEvents: visible ? "auto" : "none",
    transition,
  };
}

const ICON_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  lineHeight: 1,
  flexShrink: 0,
};

const BODY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
};

const WO_ID_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 400,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect prefers-reduced-motion at mount time (SSR-safe). */
function detectReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Derive a stable "event key" that changes whenever a genuinely NEW achievement
 * event arrives. We key on `workOrder` when present (most specific), then on
 * `at` (timestamp). This prevents re-firing the toast on re-renders when the
 * same event is in props.
 */
function eventKey(vm: EventVM): string {
  return vm.workOrder !== undefined ? vm.workOrder : vm.at;
}

/** Return true when the EventVM represents a work-order-close achievement. */
function isAchievement(vm: EventVM | undefined | null): vm is EventVM {
  if (vm === undefined || vm === null) return false;
  // The icon "trophy" is the canonical marker for achievement events (event-vm.ts EVENT_ICON).
  // Using the icon field is implementation-stable: toEventVM always sets icon="trophy"
  // when event.event === "achievement" (the only case, EVENT_ICON.achievement = "trophy").
  return vm.icon === ACHIEVEMENT_EVENT_TYPE || vm.label === "¡Logro desbloqueado!";
}

// ---------------------------------------------------------------------------
// AchievementToast component
// ---------------------------------------------------------------------------

/**
 * Shows a celebratory toast when a work-order-close achievement event fires.
 *
 * - Receives the latest EventVM from the feed stream (caller responsibility).
 * - Only reacts to events whose icon === "trophy" (achievement type).
 * - Self-dismisses after DISMISS_TIMEOUT_MS.
 * - Reduced-motion: renders without CSS animation when prefers-reduced-motion is active.
 * - aria-live="polite" + role="status" so screen readers announce the achievement.
 */
export function AchievementToast({ latestEvent }: AchievementToastProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [currentVM, setCurrentVM] = useState<EventVM | null>(null);
  const [animated, setAnimated] = useState(true);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  // Detect reduced-motion on mount (client-only).
  useEffect(() => {
    setAnimated(!detectReducedMotion());
  }, []);

  // React to new achievement events — FRESH ones only (stale tail = history).
  useEffect(() => {
    if (!isAchievement(latestEvent)) return;
    const ageMs = Date.now() - Date.parse(latestEvent.at);
    if (!Number.isFinite(ageMs) || ageMs > FRESH_WINDOW_MS) return;

    const key = eventKey(latestEvent);
    // Avoid re-firing the toast for the same event on re-renders.
    if (key === lastKeyRef.current) return;

    lastKeyRef.current = key;

    // Show the toast.
    setCurrentVM(latestEvent);
    setVisible(true);

    // Clear any pending dismiss timer.
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
    }

    // Schedule auto-dismiss.
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, DISMISS_TIMEOUT_MS);
  }, [latestEvent]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleDismiss = () => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setVisible(false);
  };

  // Render nothing when no achievement has arrived yet, or once dismissed.
  if (currentVM === null || !visible) {
    // biome-ignore lint/complexity/noUselessFragments: returning null from a JSX.Element function requires a fragment
    return <></>;
  }

  return (
    <div
      data-testid="achievement-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="¡Logro desbloqueado!"
      data-animated={String(animated)}
      style={toastStyle(visible, animated)}
    >
      {/* Trophy icon — decorative for screen readers (text label covers it) */}
      <span aria-hidden="true" style={ICON_STYLE}>
        🏆
      </span>

      {/* Message body */}
      <div style={BODY_STYLE}>
        <span data-testid="achievement-toast-label">¡Logro desbloqueado!</span>
        {currentVM.workOrder !== undefined && (
          <span data-testid="achievement-toast-wo-id" style={WO_ID_STYLE}>
            {currentVM.workOrder}
          </span>
        )}
      </div>

      {/* Manual dismiss — the auto-timer covers the happy path; the ✕ guarantees
          the owner is never stuck looking at a toast (owner, 2026-07-02). */}
      <button
        type="button"
        data-testid="achievement-toast-dismiss"
        aria-label="Cerrar el aviso de logro"
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-muted, currentColor)",
          fontSize: "0.875rem",
          lineHeight: 1,
          padding: "2px 4px",
        }}
      >
        ✕
      </button>
    </div>
  );
}
