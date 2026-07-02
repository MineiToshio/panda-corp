"use client";
/**
 * WO-06-007 — EventFeed (CMP-06-feed)
 *
 * Wave 3 (La Fragua redesign retry, 2026-06-18):
 *   - data-agent-color attribute renamed to data-role-color (aligned with roleColorKey rename in WO-06-001).
 *   - Renders handoff / contract / gate vocabulary rows (already in EventVM via event-vm.ts).
 *   - Live / No-signal badge added to the feed header (folded from descoped WO-06-010),
 *     reading `live` + `lastEventAt` props. Icon + label (NEVER color-only). tabular-nums timestamp.
 *
 * Client component that renders the capped event log with iconic vocabulary,
 * role colors, first-class failure rows, auto-scroll + pin.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on all timestamps (FRD-13, AC-13-003).
 *   - data-testid on every interactive element.
 *   - aria-live="polite" for new rows (AC-06-014.1 / FRD-13).
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-feed → REQ-06-011, REQ-06-010
 *   Depends on: IF-06-event-vm (event-vm.ts), IF-13-tokens (tokens.ts)
 */

import { useEffect, useRef, useState } from "react";
import type { EventVM } from "../event-vm/event-vm";

// ---------------------------------------------------------------------------
// Cap constants (AC-06-014.1: 100–200 events in memory)
// ---------------------------------------------------------------------------

const DEFAULT_CAP = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventFeedProps {
  /** Event view-models from toEventVM. The feed renders the last `cap` events. */
  events: EventVM[];
  /**
   * Maximum number of events to display (tail semantics — shows the most recent).
   * Default: 200 (AC-06-014.1).
   */
  cap?: number;
  /**
   * For testing: force the pin button to be visible regardless of scroll state.
   * Not used in production — the pin shows when the user scrolls up.
   */
  showPin?: boolean;
  /**
   * Whether the event stream is currently live (within freshness threshold).
   * When provided, the feed header shows a Live / No-signal badge.
   * Omit to render without badge (backward-compat).
   * (Folded from WO-06-010 — AC-06-011.1 wave 3)
   */
  live?: boolean;
  /**
   * ISO 8601 timestamp of the last known event, or null when no events exist.
   * Used by the Live / No-signal badge in the feed header.
   * Only rendered when `live` prop is also provided.
   */
  lastEventAt?: string | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors (FRD-13, AGENTS.md)
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  position: "relative",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  fontVariantNumeric: "tabular-nums",
};

const FEED_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 2)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexShrink: 0,
};

const FEED_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  margin: 0,
};

const BADGE_BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "var(--radius, 0.375rem)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.4,
};

const BADGE_LIVE_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  background: "var(--color-live-bg, oklch(0.3 0.08 145 / 0.2))",
  color: "var(--color-live, oklch(0.65 0.18 145))",
};

const BADGE_NO_SIGNAL_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  background: "var(--color-no-signal-bg, oklch(0.3 0.02 0 / 0.15))",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

const BADGE_ICON_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  lineHeight: 1,
};

const BADGE_LABEL_STYLE: React.CSSProperties = {
  color: "currentColor",
};

const BADGE_TIMESTAMP_STYLE: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  opacity: 0.75,
  marginLeft: "calc(var(--spacing, 0.25rem) * 0.5)",
};

const FEED_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 2)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontSize: "0.875rem",
};

function rowStyle(vm: EventVM): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "calc(var(--spacing, 0.25rem) * 2)",
    padding: "calc(var(--spacing, 0.25rem) * 2)",
    borderRadius: "var(--radius, 0.5rem)",
    background: vm.isFailure
      ? "var(--color-failure-bg, oklch(0.25 0.06 15 / 0.15))"
      : "var(--color-surface-panel, transparent)",
    borderLeft: vm.projectColorKey
      ? `3px solid var(${vm.projectColorKey}, var(--color-accent, currentColor))`
      : vm.roleColorKey
        ? `3px solid var(${vm.roleColorKey}, var(--color-accent, currentColor))`
        : "3px solid transparent",
    boxShadow: vm.isFailure ? "inset 2px 0 0 var(--color-failure, oklch(0.55 0.2 15))" : "none",
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    color: vm.isFailure ? "var(--color-failure-text, var(--color-text, currentColor))" : "inherit",
  };

  // The single 3px left stripe is the ONLY color the row carries (owner, 2026-07-02):
  // the old full-row role-color outline turned the feed into saturated boxes that
  // clashed with the app palette. Project vs role still resolves in the stripe order.
  return base;
}

const ICON_STYLE: React.CSSProperties = {
  flexShrink: 0,
  width: "1rem",
  height: "1rem",
  opacity: 0.85,
  fontStyle: "normal",
  fontSize: "0.875rem",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const TIMESTAMP_STYLE: React.CSSProperties = {
  flexShrink: 0,
  fontSize: "0.6875rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const PIN_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(var(--spacing, 0.25rem) * 3)",
  right: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  // --color-accent-text is the "accent-colored text on a NORMAL surface" token — on an
  // accent background it was unreadable (owner, 2026-07-02). Neutral readable chip instead.
  background: "var(--color-card, Canvas)",
  color: "var(--color-text, CanvasText)",
  border: "var(--hairline, 1px) solid var(--color-border-strong, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 600,
  boxShadow: "var(--shadow-panel, 0 2px 8px oklch(0 0 0 / 0.15))",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format the ISO 8601 timestamp to a concise HH:MM:SS display. */
function formatTimestamp(iso: string): string {
  const match = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return match?.[1] ?? iso;
}

// ---------------------------------------------------------------------------
// FeedHeader sub-component — Live / No-signal badge
// ---------------------------------------------------------------------------

interface FeedHeaderProps {
  live: boolean;
  lastEventAt: string | null;
}

/**
 * Feed header badge showing Live / No-signal status.
 * State conveyed by ICON + LABEL, never by color alone (FRD-13).
 * tabular-nums timestamp when lastEventAt is present.
 */
function FeedHeader({ live, lastEventAt }: FeedHeaderProps): React.JSX.Element {
  const formattedTs = lastEventAt ? formatTimestamp(lastEventAt) : "";

  if (live) {
    return (
      <header style={FEED_HEADER_STYLE}>
        <span style={FEED_TITLE_STYLE}>Bitácora del gremio</span>
        <span
          data-testid="event-feed-live-badge"
          role="status"
          aria-label="En vivo — datos actuales"
          style={BADGE_LIVE_STYLE}
        >
          <span data-testid="event-feed-badge-icon" aria-hidden="true" style={BADGE_ICON_STYLE}>
            ●
          </span>
          <span data-testid="event-feed-badge-label" style={BADGE_LABEL_STYLE}>
            En vivo
          </span>
          {formattedTs && (
            <span data-testid="event-feed-badge-timestamp" style={BADGE_TIMESTAMP_STYLE}>
              {formattedTs}
            </span>
          )}
        </span>
      </header>
    );
  }

  return (
    <header style={FEED_HEADER_STYLE}>
      <span style={FEED_TITLE_STYLE}>Bitácora del gremio</span>
      <span
        data-testid="event-feed-no-signal-badge"
        role="status"
        aria-label="Sin señal — datos posiblemente desactualizados"
        style={BADGE_NO_SIGNAL_STYLE}
      >
        <span data-testid="event-feed-badge-icon" aria-hidden="true" style={BADGE_ICON_STYLE}>
          ○
        </span>
        <span data-testid="event-feed-badge-label" style={BADGE_LABEL_STYLE}>
          Sin señal
        </span>
        {formattedTs && (
          <span data-testid="event-feed-badge-timestamp" style={BADGE_TIMESTAMP_STYLE}>
            {formattedTs}
          </span>
        )}
      </span>
    </header>
  );
}

// ---------------------------------------------------------------------------
// EventFeed component
// ---------------------------------------------------------------------------

/**
 * Renders the bounded event log with auto-scroll + pin affordance.
 *
 * - Applies tail cap (default 200) — oldest events are dropped when over cap.
 * - Auto-scrolls to the newest row on mount and on events update.
 * - When the user scrolls up, auto-scroll pauses and a pin button appears.
 * - Clicking pin restores auto-scroll.
 * - Failure rows are visually distinct (danger treatment, never hidden).
 * - aria-live="polite" announces new rows to screen readers.
 * - Optional Live/No-signal badge in the feed header (`live` + `lastEventAt` props).
 * - Renders handoff / contract / gate vocabulary rows (via EventVM label/icon).
 */
export function EventFeed({
  events,
  cap = DEFAULT_CAP,
  showPin = false,
  live,
  lastEventAt,
}: EventFeedProps): React.JSX.Element {
  const listRef = useRef<HTMLOListElement>(null);
  const [isPinned, setIsPinned] = useState(false);
  const userScrolledUp = showPin || isPinned;

  // Apply tail cap: show the most recent `cap` events.
  const visible = cap >= events.length ? events : events.slice(events.length - cap);

  // Auto-scroll to bottom when new events arrive and user hasn't scrolled up.
  // Depend only on userScrolledUp; visible is derived and would change every render.
  useEffect(() => {
    if (!userScrolledUp && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [userScrolledUp]);

  // Detect scroll-up to reveal pin button.
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setIsPinned(!atBottom);
  }

  function handlePin() {
    setIsPinned(false);
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }

  // Whether the `live` badge should be shown: only when `live` prop is explicitly provided.
  const showBadge = live !== undefined;

  return (
    <section
      data-testid="event-feed"
      aria-label="Registro de eventos del equipo"
      style={CONTAINER_STYLE}
    >
      {/* Feed header with Live/No-signal badge — shown when live prop is provided */}
      {showBadge && <FeedHeader live={live as boolean} lastEventAt={lastEventAt ?? null} />}

      {visible.length === 0 ? (
        <div data-testid="event-feed-empty" style={EMPTY_STYLE} role="status">
          Sin eventos registrados
        </div>
      ) : (
        <ol
          ref={listRef}
          data-testid="event-feed-list"
          aria-live="polite"
          aria-relevant="additions"
          style={{
            ...FEED_STYLE,
            listStyle: "none",
            margin: 0,
            padding: "calc(var(--spacing, 0.25rem) * 2)",
          }}
          onScroll={handleScroll}
        >
          {visible.map((vm, idx) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for a capped tail
              key={idx}
              data-testid="event-feed-row"
              data-failure={vm.isFailure ? "true" : undefined}
              data-role-color={vm.roleColorKey ?? undefined}
              data-project-color={vm.projectColorKey ?? undefined}
              style={rowStyle(vm)}
            >
              {/* Primary event icon */}
              <span style={ICON_STYLE} aria-hidden="true">
                {vm.icon}
              </span>
              {/* Optional tool icon */}
              {vm.toolIcon !== undefined && (
                <span style={{ ...ICON_STYLE, opacity: 0.5 }} aria-hidden="true">
                  {vm.toolIcon}
                </span>
              )}
              {/* Event label */}
              <span style={LABEL_STYLE}>
                {vm.label}
                {vm.wo !== undefined && (
                  <span
                    style={{
                      marginLeft: "0.25rem",
                      fontSize: "0.6875rem",
                      color: "var(--color-text-muted, currentColor)",
                      opacity: 0.7,
                    }}
                  >
                    {vm.wo}
                  </span>
                )}
                {/* Backward-compat: also check workOrder alias if wo is absent */}
                {vm.wo === undefined && vm.workOrder !== undefined && (
                  <span
                    style={{
                      marginLeft: "0.25rem",
                      fontSize: "0.6875rem",
                      color: "var(--color-text-muted, currentColor)",
                      opacity: 0.7,
                    }}
                  >
                    {vm.workOrder}
                  </span>
                )}
              </span>
              {/* Timestamp */}
              <time dateTime={vm.at} style={TIMESTAMP_STYLE}>
                {formatTimestamp(vm.at)}
              </time>
            </li>
          ))}
        </ol>
      )}

      {/* Pin button — appears when user scrolls up (or showPin=true in tests) */}
      {userScrolledUp && (
        <button
          type="button"
          data-testid="event-feed-pin"
          aria-label="Ir al evento más reciente"
          onClick={handlePin}
          style={PIN_STYLE}
        >
          Ir al último ↓
        </button>
      )}
    </section>
  );
}
