/**
 * WO-06-005 — PartyTab (CMP-06-party-tab)
 *
 * Server Component entry of the Party tab.
 * Reads the capped event tail via lib/events (readEvents) and
 * the task state via lib/tasks (readTasksState). An active team
 * requires BOTH events AND an active tasks directory.
 *
 * Builds a serializable PartySnapshot and passes it to EventFeed.
 * When no active team exists, renders PartyEmptyState.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is synchronous fs reads via readEvents + readTasksState.
 * No `fs` ever reaches the client — only the serialized EventVM array
 * crosses the server→client boundary.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-party-tab → REQ-06-008, REQ-06-010, REQ-06-002
 *   IF-01-readEvents (lib/events.ts, docs/api.md WO-01-007)
 *   IF-06-tasks (lib/tasks.ts, WO-06-005)
 *   IF-06-event-vm (event-vm.ts, WO-06-001)
 *   IF-06-roster (layout.ts, WO-06-002)
 *   IF-06-state-map (state-map.ts, WO-06-003)
 */

import { TASKS_DIR } from "@/lib/config";
import { readEvents } from "@/lib/events";
import { readTasksState } from "@/lib/tasks";
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
   * Path to the tasks directory.
   * Defaults to `~/.claude/tasks` (TASKS_DIR from lib/config).
   * Override in tests via fixture paths.
   * Active team requires this directory to contain at least one subdirectory.
   */
  tasksDir?: string;
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
 * Server Component — reads event stream + task state and renders the Party feed.
 *
 * Active team = tasksDir exists AND contains at least one team subdirectory.
 * When no active team: renders the empty state (AC-06-010.1).
 * When active: renders the EventFeed with the capped event tail.
 *
 * Because this runs on the server (Next.js RSC), it never passes `fs` to the
 * client — only the serialized EventVM array crosses the boundary.
 */
export function PartyTab({
  eventsPath,
  tasksDir = TASKS_DIR,
  cap = DEFAULT_CAP,
}: PartyTabProps): React.JSX.Element {
  // Read the capped tail of the event stream (read-only, never throws).
  const snapshot = readEvents({ path: eventsPath, cap });
  const { events, lastEventAt } = snapshot;

  // Read task state: absent tasks/ → no active team (AC-06-010.1)
  const tasksState = readTasksState(tasksDir);

  // Map raw events to view-models for the feed.
  const eventVMs = events.map(toEventVM);

  // Active = tasks directory has at least one team AND there are events to show.
  // WO-06-005 TDD: "absent tasks/ → active=false"
  const active = tasksState.active && eventVMs.length > 0;

  return (
    <section data-testid="party-tab" aria-label="Panel del equipo de agentes" style={TAB_STYLE}>
      {/* Header: title + Live/No-signal indicator */}
      <header style={HEADER_STYLE}>
        <h2 style={HEADING_STYLE}>Equipo en acción</h2>
        {active && lastEventAt !== null ? (
          <span
            data-testid="party-tab-live-indicator"
            style={LIVE_STYLE}
            title="En vivo — hay actividad reciente"
            role="status"
          >
            <span aria-hidden="true">●</span>
            <time dateTime={lastEventAt} style={{ fontVariantNumeric: "tabular-nums" }}>
              {lastEventAt.replace("T", " ").replace("Z", "")}
            </time>
          </span>
        ) : (
          <span
            data-testid="party-tab-no-signal"
            style={NO_SIGNAL_STYLE}
            title="Sin señal — no hay equipo activo ni eventos recientes"
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
