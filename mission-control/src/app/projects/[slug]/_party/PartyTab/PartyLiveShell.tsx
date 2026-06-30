"use client";

/**
 * WO-06-007 — PartyLiveShell (client boundary for Party live updates)
 *
 * Client component that:
 *   1. Accepts an `initialSnapshot` (from the RSC PartyTab — the server-derived
 *      static snapshot pre-rendered for instant paint and used as the SSR baseline).
 *   2. Subscribes to `useLiveSnapshot` (WO-01-009, SSE) for live event frames.
 *   3. Re-derives `FraguaSnapshot` via `toFraguaSnapshot` on every live frame.
 *   4. Passes the live (or initial) snapshot to `PartyScene` (the outer chrome shell).
 *
 * This boundary keeps the RSC PartyTab free of client hooks while making the
 * scene fully live — every new event triggers a re-derive + re-render without
 * a page reload (AC-06-008 live requirement).
 *
 * Read-only invariant (DR-061, AC-06-009.1):
 *   - NO mode selector, NO pause/reset. Everything is derived from real state.
 *   - Live is consumption-only; this component never writes to the factory.
 *
 * Traceability:
 *   AC-06-008 (live) → useLiveSnapshot SSE subscription
 *   WO-06-007 → CMP-06-party-tab (the live client boundary)
 *
 * data-testid surface:
 *   party-live-shell          — root wrapper
 *   party-live-connected      — present when SSE is connected
 */

import { useMemo } from "react";

import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { Event as DashboardEvent } from "@/lib/events/events";

import { toEventVM } from "../event-vm/event-vm";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyScene } from "../PartyScene/PartyScene";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PartyLiveShellProps {
  /**
   * Initial snapshot from the RSC — used for instant SSR paint and as the
   * fallback when SSE has not yet delivered a frame.
   */
  initialSnapshot: FraguaSnapshot;
  /**
   * Initial event view-models for the feed (from the RSC).
   * Updated live once SSE delivers a frame.
   */
  project?: string;
  /**
   * The project's authoritative build flag from `status.yaml` (`running`).
   * The SSE emits the current event tail on connect even when the build is OFF,
   * so a live frame that merely REPLAYS the stale tail must not re-activate the
   * scene — `running` keeps it powered-off (AC-06-013) unless a genuinely newer
   * event arrives (the build resumed).
   */
  running?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client boundary that wires the live SSE transport into PartyScene.
 * Falls back to the server-derived `initialSnapshot` until the first SSE frame.
 *
 * @param props.initialSnapshot - Server-derived snapshot for instant paint.
 * @param props.project         - Optional project slug for SSE filtering.
 */
export function PartyLiveShell({
  initialSnapshot,
  project,
  running,
}: PartyLiveShellProps): React.JSX.Element {
  // Subscribe to the live SSE transport
  const { snapshot: liveFrame, connected } = useLiveSnapshot({ project });

  // Derive FraguaSnapshot from the live frame when available; otherwise use
  // the initial server snapshot (pre-computed by the RSC at request time).
  const snapshot = useMemo<FraguaSnapshot>(() => {
    if (liveFrame === null) return initialSnapshot;

    // Re-derive from the live event array
    const events = (liveFrame.events ?? []) as DashboardEvent[];
    const liveAt = liveFrame.lastEventAt ?? null;
    // The SSE emits the current tail on connect even when the build is OFF, so a
    // frame that only REPLAYS the stale tail (no event newer than page-load) must
    // not re-activate the scene — keep the authoritative `running:false` powered
    // off. A genuinely NEWER event (the build resumed) reactivates (AC-06-013.3).
    // ISO-8601 timestamps compare chronologically, so `>` detects a fresher event.
    const hasFresherEvent =
      liveAt !== null &&
      (initialSnapshot.lastEventAt === null || liveAt > initialSnapshot.lastEventAt);
    return toFraguaSnapshot(events, {
      lastEventAt: liveAt,
      running: hasFresherEvent ? undefined : running,
    });
  }, [liveFrame, initialSnapshot, running]);

  // Compute the most recent event VM for the achievement toast
  const latestEventVM = useMemo(() => {
    if (liveFrame === null) return undefined;
    const events = (liveFrame.events ?? []) as DashboardEvent[];
    if (events.length === 0) return undefined;
    const lastEvent = events[events.length - 1];
    return lastEvent !== undefined ? toEventVM(lastEvent) : undefined;
  }, [liveFrame]);

  void latestEventVM; // consumed by AchievementToast in the parent (PartyTab)

  return (
    <div data-testid="party-live-shell">
      {/* Live connection indicator (for tests + debug) */}
      {connected && <span data-testid="party-live-connected" aria-hidden="true" />}

      {/* PartyScene: the outer chrome shell (MissionBar + FlowStrip + FraguaScene) */}
      <PartyScene snapshot={snapshot} />
    </div>
  );
}
