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
import { isFeedEvent, toEventVM } from "../event-vm/event-vm";
import type { SceneWorkOrder } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyEmptyState } from "../PartyEmptyState/PartyEmptyState";
import { PartyLiveShell } from "./PartyLiveShell";

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
  /**
   * The project's authoritative build flag from `status.yaml` (`running`).
   * When `false`, the scene renders the powered-off state regardless of the
   * (possibly stale) event tail — the ndjson keeps the last build's events
   * forever, so events alone can't tell "off" from "finished long ago"
   * (AC-06-013). `undefined` keeps the event-derived behavior.
   */
  running?: boolean;
  /**
   * Project key for event filtering — the emitter's `basename $PWD` (the
   * project FOLDER name, not the portfolio display name). Applied INSIDE
   * `readEvents` before the tail cap, and passed to the SSE subscription, so
   * another project's build (or any session's hook noise) can neither crowd
   * this project's events out of the tail nor leak into its scene/feed.
   */
  project?: string;
  /**
   * The project's authoritative work orders (id + frd + state) from
   * `listWorkOrders` — the SAME source the Work Orders board reads (DR-092).
   * Decides the scene structure (sprites/rooms/queue/trophies/counter/gate);
   * events only drive liveness. Refreshed on every RSC render (the live shell
   * triggers one when a fresher event arrives).
   */
  workOrders?: readonly SceneWorkOrder[];
  /**
   * Real per-WO build starts (wo id → epoch ms) from track.jsonl — powers the
   * "N min al fuego" bubbles with real elapsed time (Fase 2, REQ-06-019).
   */
  woStarts?: Readonly<Record<string, number>>;
  /** Supervisor heartbeat ISO stamp from status.yaml (DR-066) — feeds the freshness badge. */
  supervisorHeartbeat?: string;
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

const EMPTY_WRAPPER_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

/** Fixed height of the bitácora block below the scene (px). */
const FEED_HEIGHT_PX = 320;

// Scene on top, bitácora BELOW at full width (owner decision 2026-07-01): the
// previous side-by-side row squeezed the feed against the fixed 920px stage on
// common viewports. The body scrolls vertically; the feed scrolls internally.
const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "auto",
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
  flexShrink: 0,
  height: `${FEED_HEIGHT_PX}px`,
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
export function PartyTab({
  eventsPath,
  cap = DEFAULT_CAP,
  running,
  project,
  workOrders,
  woStarts,
  supervisorHeartbeat,
}: PartyTabProps): React.JSX.Element {
  // Read the capped tail of the event stream (read-only, never throws).
  // The project filter runs BEFORE the cap so other sessions' noise cannot
  // crowd this project's build events out of the tail.
  const { events, lastEventAt } = readEvents({ path: eventsPath, cap, project });

  // Derive the FraguaSnapshot (IF-06-fragua-snapshot). Pure function: no DOM,
  // no I/O, no side-effects. `running` (status.yaml) forces the powered-off
  // state when the build is off; `workOrders` (frontmatter, DR-092) decides the
  // scene structure while events only drive liveness.
  const snapshot = toFraguaSnapshot(events, { lastEventAt, running, workOrders, woStarts });

  // Map the feed-relevant events to view-models for the bitácora (REQ-06-015):
  // session noise (SupervisorTick, hook SubagentStop) is filtered out;
  // failures always pass (first-class, AC-06-015.1).
  const eventVMs = events.filter(isFeedEvent).map(toEventVM);

  // The most recent event view-model — drives the achievement toast (CMP-06-achievement).
  const latestEvent = eventVMs.length > 0 ? eventVMs[eventVMs.length - 1] : undefined;

  // A build EXISTS (current or recently finished) iff a FRD was detected. That, not
  // `active`, gates scene-vs-empty: when the build is OFF (active false) but a FRD is
  // present, we still render the scene so it can show the powered-off state (the grey
  // factory-off design, AC-06-013) — the empty state (AC-06-010.1) is only for "no
  // build data at all". `active` then drives the power-off overlay inside the scene.
  const hasBuild = snapshot.frd !== null;

  return (
    <section data-testid="party-tab" aria-label="Panel del equipo de agentes" style={TAB_STYLE}>
      {/* Header: title + Live/No-signal indicator */}
      <header style={HEADER_STYLE}>
        <h2 style={HEADING_STYLE}>La Fragua</h2>
        {/* No signal chip here (owner, 2026-07-02): freshness has ONE voice — the
            DR-066 FreshnessBadge rendered by the live shell right below. */}
      </header>

      {/* Body: La Fragua scene (via PartyLiveShell) + feed, or empty state (AC-06-010.1).
          Gated on hasBuild (a FRD exists), NOT active — so an OFF build still shows the
          scene's powered-off state (AC-06-013) instead of the never-built empty state. */}
      {hasBuild ? (
        <div style={BODY_STYLE}>
          {/* CMP-06-scene — PartyLiveShell: client boundary that subscribes to
              useLiveSnapshot (SSE) and re-derives FraguaSnapshot on every frame.
              Falls back to the server-derived snapshot until first SSE frame.
              PartyScene (the outer chrome: MissionBar + FlowStrip + stage) lives inside.
              Observation-only: no mode selector, no pause/reset (AC-06-009.1, DR-061). */}
          <div style={SCENE_WRAPPER_STYLE}>
            <PartyLiveShell
              initialSnapshot={snapshot}
              project={project}
              running={running}
              workOrders={workOrders}
              woStarts={woStarts}
              supervisorHeartbeat={supervisorHeartbeat}
            />
          </div>

          {/* CMP-06-feed — the bitácora BELOW the scene, full width (REQ-06-015). */}
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
