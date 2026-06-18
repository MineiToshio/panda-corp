"use client";

/**
 * FreshnessBadge — CMP-12-freshness
 *
 * Renders the Live / "Sin señal" indicator with the last-event timestamp.
 * Consumes the result of `freshness()` (IF-12-freshness, WO-12-001) as props.
 * Exported for FRD-06 Party panel consumption (blueprint §5, §4 App surface).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - State shown by ICON + LABEL, NEVER by color alone (FRD-13 constraint).
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on the timestamp (FRD-13, AC-13-003).
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish aria-labels and labels (AGENTS.md — single operator, Spanish UI).
 *   - "use client" because this component is meant to be embedded in client
 *     contexts (Party panel uses client-side refresh); RSC consumers may also
 *     embed it directly if they don't need interactivity.
 *
 * Props:
 *   - live: boolean — true = "En vivo", false = "Sin señal"
 *   - lastAt: string | null — the ISO 8601 timestamp of the most recent event,
 *     or null when no events have been seen yet.
 *
 * Traceability:
 *   CMP-12-freshness → AC-12-002.1 → REQ-12-002 → WO-12-005
 */

import type React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FreshnessBadgeProps {
  /** True when the last event was within the freshness threshold ("En vivo"). */
  live: boolean;
  /**
   * ISO 8601 timestamp of the last event, or null when no events exist.
   * The component formats it for human display; the raw ISO string is NOT
   * shown directly (FRD-13 readability; tabular-nums on the displayed value).
   */
  lastAt: string | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// Variables are wired by the design system (WO-13-002, globals.css).
// The fallback chain uses semantic system values so the component renders
// before design-tokens.json is frozen by the design phase.
// ---------------------------------------------------------------------------

const BADGE_BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: 1.4,
  // Background uses chip-bg token (subtle surface, not color-alone state)
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 8%, transparent))",
  border: "var(--hairline, 1px) solid",
  borderColor: "color-mix(in oklch, currentColor 15%, transparent)",
};

// Live variant — uses accent color for the border accent only
// State is communicated by icon + label text (not color alone — FRD-13)
const BADGE_LIVE_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  // Subtle accent-tinted border to visually reinforce the live state,
  // but the icon + "En vivo" label are the primary state communicators.
  borderColor: "color-mix(in oklch, var(--color-accent, currentColor) 40%, transparent)",
};

// No-signal variant — uses muted styling
const BADGE_NO_SIGNAL_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  opacity: 0.7,
};

const ICON_STYLE: React.CSSProperties = {
  // aria-hidden on the icon element; the label carries the semantic state.
  display: "inline-block",
  fontSize: "0.85rem",
  lineHeight: 1,
};

const LABEL_STYLE: React.CSSProperties = {
  color: "var(--color-text, currentColor)",
};

const TIMESTAMP_STYLE: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.75,
  marginLeft: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
};

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp for display.
 * Returns a short HH:MM:SS string (local time) for "En vivo" recency context.
 * Falls back to the raw string on parse failure, and to empty string if null/empty.
 *
 * Guard: empty string input → returns empty string (do not render timestamp element).
 */
function formatTimestamp(lastAt: string | null): string {
  if (!lastAt || lastAt.trim() === "") {
    return "";
  }
  try {
    const d = new Date(lastAt);
    if (!Number.isFinite(d.getTime())) {
      // Not a valid date — fall back to the raw string
      return lastAt;
    }
    // Format as HH:MM:SS local — concise and readable at a glance
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return lastAt;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FreshnessBadge — shows whether the event stream is live or stale.
 *
 * Consumed directly by the Mission Control global header (dashboard surface)
 * and re-used by FRD-06 Party panel (blueprint §4 / §5).
 *
 * Props are the output of `freshness(events, now)` from IF-12-freshness.
 * The caller is responsible for calling `freshness()` and passing the result.
 */
export function FreshnessBadge({ live, lastAt }: FreshnessBadgeProps): React.JSX.Element {
  const formattedTs = formatTimestamp(lastAt);

  if (live) {
    return (
      <span
        data-testid="freshness-badge"
        role="status"
        aria-label="En vivo — datos actuales"
        style={BADGE_LIVE_STYLE}
      >
        {/* Icon — decorative; label carries the state (FRD-13 not color-only) */}
        <span data-testid="freshness-icon" aria-hidden="true" style={ICON_STYLE}>
          ●
        </span>

        {/* State label — the primary semantic state communicator */}
        <span data-testid="freshness-live-label" style={LABEL_STYLE}>
          En vivo
        </span>

        {/* Timestamp — only when available */}
        {formattedTs && (
          <span data-testid="freshness-timestamp" style={TIMESTAMP_STYLE}>
            {formattedTs}
          </span>
        )}
      </span>
    );
  }

  // No-signal state
  return (
    <span
      data-testid="freshness-badge"
      role="status"
      aria-label="Sin señal — datos posiblemente desactualizados"
      style={BADGE_NO_SIGNAL_STYLE}
    >
      {/* Icon — decorative; label carries the state (FRD-13 not color-only) */}
      <span data-testid="freshness-icon" aria-hidden="true" style={ICON_STYLE}>
        ○
      </span>

      {/* State label — the primary semantic state communicator */}
      <span data-testid="freshness-no-signal-label" style={LABEL_STYLE}>
        Sin señal
      </span>

      {/* Timestamp — last known timestamp even when stale */}
      {formattedTs && (
        <span data-testid="freshness-timestamp" style={TIMESTAMP_STYLE}>
          {formattedTs}
        </span>
      )}
    </span>
  );
}
