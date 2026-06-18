/**
 * WO-06-005 (La Fragua redesign) — PartyTab (CMP-06-party-tab)
 *
 * Server Component entry of the Party tab.
 * Reads the capped event tail via `lib/events` (readEvents) and derives a
 * `FraguaSnapshot` via `toFraguaSnapshot` (IF-06-fragua-snapshot).
 *
 * The snapshot carries everything the client scene needs:
 *   - The FRD currently in build (id + title).
 *   - Mode read from the event stream (default 'powerful').
 *   - Running WOs (≤ wave, already capped).
 *   - Queued count, gate state, trophies, archived count.
 *   - Global project {done, total} counter.
 *   - EventVM[] for the feed.
 *
 * Active flag: `snapshot.active` is true iff a FRD is detected in the event
 * stream (at least one AgentWorking with a `frd` field). When inactive, renders
 * `<PartyEmptyState>` (AC-06-010.1).
 *
 * Read-only invariant (AC-06-009.1):
 *   - NO mode selector — mode is displayed as data.
 *   - NO pause/reset/agent-control affordances.
 *   - Zero fs reaches the client — only the serialized FraguaSnapshot.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-party-tab → REQ-06-002, REQ-06-008, REQ-06-009, REQ-06-010
 *   IF-06-fragua-snapshot (fragua-snapshot.ts, WO-06-005)
 *   IF-06-event-vm (event-vm.ts, WO-06-001)
 *   IF-01-readEvents (lib/events.ts)
 */

import { readEvents } from "@/lib/events/events";
import { AchievementToast } from "../AchievementToast/AchievementToast";
import { EventFeed } from "../EventFeed/EventFeed";
import { toEventVM } from "../event-vm/event-vm";
import { FraguaScene } from "../FraguaScene/FraguaScene";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyEmptyState } from "../PartyEmptyState/PartyEmptyState";

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

const EMPTY_WRAPPER_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "row",
  minHeight: 0,
  overflow: "hidden",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
};

const SCENE_WRAPPER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  overflow: "auto",
};

const FEED_WRAPPER_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ---------------------------------------------------------------------------
// PartyTab component
// ---------------------------------------------------------------------------

/**
 * Server Component — reads event stream and derives the FraguaSnapshot.
 *
 * Active flag comes from the snapshot: `active` is true when the event stream
 * contains at least one AgentWorking event with an enriched `frd` field.
 * When inactive: renders the empty state (AC-06-010.1).
 * When active: renders FraguaScene (the La Fragua rooms/sprites) + EventFeed
 * + AchievementToast.
 *
 * Read-only (AC-06-009.1): No mode selector, no pause/reset controls.
 * Mode is displayed as plain data via FraguaScene.
 *
 * No `fs` ever reaches the client — only the serialized FraguaSnapshot.
 */
export function PartyTab({ eventsPath, cap = DEFAULT_CAP }: PartyTabProps): React.JSX.Element {
  // Read the capped tail of the event stream (read-only, never throws).
  const { events, lastEventAt } = readEvents({ path: eventsPath, cap });

  // Derive the FraguaSnapshot from the enriched event tail (IF-06-fragua-snapshot).
  // Pure function: no DOM, no I/O, no side-effects.
  const snapshot = toFraguaSnapshot(events, { lastEventAt });

  // Map raw events to view-models for the feed.
  const eventVMs = events.map(toEventVM);

  // The most recent event view-model — drives the achievement toast (CMP-06-achievement).
  const latestEvent = eventVMs.length > 0 ? eventVMs[eventVMs.length - 1] : undefined;

  const { active } = snapshot;

  return (
    <section data-testid="party-tab" aria-label="Panel del equipo de agentes" style={TAB_STYLE}>
      {/* Header: title + Live/No-signal indicator */}
      <header style={HEADER_STYLE}>
        <h2 style={HEADING_STYLE}>La Fragua</h2>
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
            title="Sin señal — no hay construcción activa"
            role="status"
          >
            Sin señal
          </span>
        )}
      </header>

      {/* Body: La Fragua scene + feed, or empty state (AC-06-010.1) */}
      {active ? (
        <div style={BODY_STYLE}>
          {/* CMP-06-scene — the La Fragua scene (rooms, sprites, trophies, gate).
              Observation-only: no mode selector, no pause/reset (AC-06-009.1). */}
          <div style={SCENE_WRAPPER_STYLE}>
            <FraguaScene snapshot={snapshot} />
          </div>

          {/* CMP-06-feed — the capped event log alongside the scene. */}
          <div style={FEED_WRAPPER_STYLE}>
            <EventFeed events={eventVMs} cap={cap} />
          </div>

          {/* CMP-06-achievement — celebratory toast on a work-order-close event. */}
          <AchievementToast latestEvent={latestEvent} />
        </div>
      ) : (
        <div data-testid="party-tab-empty" style={EMPTY_WRAPPER_STYLE}>
          <PartyEmptyState />
        </div>
      )}
    </section>
  );
}
