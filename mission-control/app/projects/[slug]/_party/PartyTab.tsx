/**
 * WO-06-005 — PartyTab (CMP-06-party-tab)
 *
 * Server Component entry of the Party tab.
 * Reads the capped event tail via lib/events (readEvents),
 * maps events to EventVMs via toEventVM, and renders the EventFeed.
 * When no events exist, renders the empty state.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is synchronous fs reads via readEvents (lib/events.ts).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-party-tab → REQ-06-008, REQ-06-010
 *   IF-01-readEvents (lib/events.ts, docs/api.md WO-01-007)
 *   IF-06-event-vm (event-vm.ts, WO-06-001)
 */

import { readEvents } from "@/lib/events";
import { EventFeed } from "./EventFeed";
import { toEventVM } from "./event-vm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CAP = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PartyTabProps {
  /**
   * Path to the NDJSON event file.
   * Defaults to `~/.claude/dashboard-events.ndjson` (from readEvents default).
   * Override in tests via fixture paths.
   */
  eventsPath?: string;
  /**
   * Maximum number of events to retain (tail semantics).
   * Default: 200 (AC-06-014.1).
   */
  cap?: number;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

const TAB_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  margin: 0,
  color: "var(--color-text, currentColor)",
};

const LIVE_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.5rem)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const LIVE_STYLE: React.CSSProperties = {
  ...LIVE_BADGE_STYLE,
  background: "var(--color-live-bg, oklch(0.3 0.08 145 / 0.2))",
  color: "var(--color-live, oklch(0.65 0.18 145))",
};

const NO_SIGNAL_STYLE: React.CSSProperties = {
  ...LIVE_BADGE_STYLE,
  background: "var(--color-no-signal-bg, oklch(0.3 0.02 0 / 0.15))",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

const EMPTY_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 12)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  textAlign: "center",
};

const FEED_WRAPPER_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ---------------------------------------------------------------------------
// PartyTab component
// ---------------------------------------------------------------------------

/**
 * Server Component — reads event stream and renders the Party feed.
 *
 * Because this runs on the server (Next.js RSC), it never passes `fs` to the
 * client — only the serialized EventVM array crosses the boundary.
 */
export function PartyTab({ eventsPath, cap = DEFAULT_CAP }: PartyTabProps): React.JSX.Element {
  // Read the capped tail of the event stream (read-only, never throws).
  const snapshot = readEvents({ path: eventsPath, cap });
  const { events, lastEventAt } = snapshot;

  // Map raw events to view-models for the feed.
  const eventVMs = events.map(toEventVM);

  const active = eventVMs.length > 0;

  return (
    <section data-testid="party-tab" aria-label="Panel del equipo de agentes" style={TAB_STYLE}>
      {/* Header: title + Live/No-signal indicator */}
      <header style={HEADER_STYLE}>
        <h2 style={HEADING_STYLE}>Equipo en acción</h2>
        {active ? (
          <span
            data-testid="party-tab-live-indicator"
            style={LIVE_STYLE}
            title="En vivo — hay actividad reciente"
            role="status"
          >
            <span aria-hidden="true">●</span>
            {lastEventAt !== null && (
              <time dateTime={lastEventAt} style={{ fontVariantNumeric: "tabular-nums" }}>
                {lastEventAt.replace("T", " ").replace("Z", "")}
              </time>
            )}
          </span>
        ) : (
          <span
            data-testid="party-tab-no-signal"
            style={NO_SIGNAL_STYLE}
            title="Sin señal — no hay eventos recientes"
            role="status"
          >
            Sin señal
          </span>
        )}
      </header>

      {/* Body: feed or empty state */}
      {active ? (
        <div style={FEED_WRAPPER_STYLE}>
          <EventFeed events={eventVMs} cap={cap} />
        </div>
      ) : (
        <div
          data-testid="party-tab-empty"
          style={EMPTY_STYLE}
          role="status"
          aria-label="Sin equipo activo"
        >
          <span aria-hidden="true" style={{ fontSize: "2rem" }}>
            ⚔️
          </span>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>
            Sin equipo activo ni eventos registrados
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>
            Los agentes aparecerán aquí cuando se inicie una construcción
          </p>
        </div>
      )}
    </section>
  );
}
