"use client";
/**
 * WO-06-007 — EventFeed (CMP-06-feed)
 *
 * Client component that renders the capped event log with iconic vocabulary,
 * agent colors, first-class failure rows, auto-scroll + pin.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on all timestamps (FRD-13, AC-13-003).
 *   - data-testid on every interactive element.
 *   - aria-live="polite" for new rows (AC-06-014.1 / FRD-13).
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-feed → REQ-06-006, REQ-06-012, REQ-06-013, REQ-06-014, REQ-06-011
 *   Depends on: IF-06-event-vm (event-vm.ts), IF-13-tokens (tokens.ts)
 */

import { useEffect, useRef, useState } from "react";
import type { EventVM } from "./event-vm";

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
      : vm.agentColorKey
        ? `3px solid var(${vm.agentColorKey}, var(--color-accent, currentColor))`
        : "3px solid transparent",
    boxShadow: vm.isFailure ? "inset 2px 0 0 var(--color-failure, oklch(0.55 0.2 15))" : "none",
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    color: vm.isFailure ? "var(--color-failure-text, var(--color-text, currentColor))" : "inherit",
  };

  // Multi-project: project-color left border + agent-color second (via outline-offset trick)
  if (vm.projectColorKey && vm.agentColorKey) {
    base.outline = `2px solid var(${vm.agentColorKey}, var(--color-accent, currentColor))`;
    base.outlineOffset = "-2px";
  }

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
  background: "var(--color-accent, oklch(0.65 0.18 260))",
  color: "var(--color-accent-text, Canvas)",
  border: "none",
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
 */
export function EventFeed({
  events,
  cap = DEFAULT_CAP,
  showPin = false,
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

  return (
    <section
      data-testid="event-feed"
      aria-label="Registro de eventos del equipo"
      style={CONTAINER_STYLE}
    >
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
              data-agent-color={vm.agentColorKey ?? undefined}
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
                {vm.workOrder !== undefined && (
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
