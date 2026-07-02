"use client";

/**
 * WO-06-007 — PartyLiveShell (client boundary for Party live updates)
 *
 * Client component that:
 *   1. Accepts an `initialSnapshot` (from the RSC PartyTab — the server-derived
 *      static snapshot pre-rendered for instant paint and used as the SSR baseline).
 *   2. Subscribes to `useLiveSnapshot` (WO-01-009, SSE) for live event frames,
 *      scoped to this project.
 *   3. Re-derives `FraguaSnapshot` via `toFraguaSnapshot` on every live frame,
 *      carrying the authoritative `workOrders` structure (DR-092).
 *   4. Passes the live (or initial) snapshot to `PartyScene` (the outer chrome shell).
 *   5. When a frame carries a GENUINELY newer event, triggers a throttled
 *      `router.refresh()` so the RSC re-reads the work-order frontmatter and
 *      status.yaml — that is how a sprite WALKS to its new room mid-session
 *      (AC-06-001.6 live follow-up, 2026-07-01): the engine's emitters append an
 *      event at each state transition, the SSE frame arrives, the refresh pulls
 *      the fresh frontmatter, and the scene re-derives with the WO's new room.
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

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { Event as DashboardEvent } from "@/lib/events/events";

import type { FraguaSnapshot, SceneWorkOrder } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyScene } from "../PartyScene/PartyScene";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum ms between frontmatter refreshes. Events can burst (a wave of agents
 * starting together); one refresh per window is enough — the RSC re-reads ALL
 * the frontmatter each time, so the last refresh always lands the final state.
 */
const REFRESH_THROTTLE_MS = 5_000;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PartyLiveShellProps {
  /**
   * Initial snapshot from the RSC — used for instant SSR paint and as the
   * fallback when SSE has not yet delivered a frame.
   */
  initialSnapshot: FraguaSnapshot;
  /** Project key for the SSE subscription (the emitter's `basename $PWD`). */
  project?: string;
  /**
   * The project's authoritative build flag from `status.yaml` (`running`).
   * The SSE emits the current event tail on connect even when the build is OFF,
   * so a live frame that merely REPLAYS the stale tail must not re-activate the
   * scene — `running` keeps it powered-off (AC-06-013) unless a genuinely newer
   * event arrives (the build resumed).
   */
  running?: boolean;
  /**
   * Authoritative work orders (id + frd + state) from the RSC (DR-092). Carried
   * into the live re-derive so an SSE event frame — which only carries events —
   * keeps the frontmatter-decided structure. Refreshed via `router.refresh()`
   * whenever a fresher event arrives (throttled).
   */
  workOrders?: readonly SceneWorkOrder[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Is the frame's latest event newer than what the RSC render already saw? */
function hasFresherEvent(liveAt: string | null, initialAt: string | null): boolean {
  // ISO-8601 timestamps compare chronologically as strings.
  return liveAt !== null && (initialAt === null || liveAt > initialAt);
}

/**
 * Client boundary that wires the live SSE transport into PartyScene.
 * Falls back to the server-derived `initialSnapshot` until the first SSE frame.
 *
 * @param props.initialSnapshot - Server-derived snapshot for instant paint.
 * @param props.project         - Project key for SSE filtering.
 * @param props.running         - Authoritative build flag from status.yaml.
 * @param props.workOrders      - Authoritative work-order structure (DR-092).
 */
export function PartyLiveShell({
  initialSnapshot,
  project,
  running,
  workOrders,
}: PartyLiveShellProps): React.JSX.Element {
  // Subscribe to the live SSE transport, scoped to this project.
  const { snapshot: liveFrame, connected } = useLiveSnapshot({ project });

  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  // A fresher event means the build advanced → pull fresh frontmatter (the
  // room/queue/trophy truth) through a throttled RSC refresh. The refresh
  // updates `initialSnapshot`/`workOrders`/`running` via new props, so the
  // fresher-check self-resets and this cannot loop while the stream is quiet.
  useEffect(() => {
    if (liveFrame === null) return;
    if (!hasFresherEvent(liveFrame.lastEventAt ?? null, initialSnapshot.lastEventAt)) return;
    const now = Date.now();
    if (now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshAtRef.current = now;
    router.refresh();
  }, [liveFrame, initialSnapshot.lastEventAt, router]);

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
    const fresher = hasFresherEvent(liveAt, initialSnapshot.lastEventAt);
    return toFraguaSnapshot(events, {
      lastEventAt: liveAt,
      running: fresher ? undefined : running,
      workOrders,
    });
  }, [liveFrame, initialSnapshot, running, workOrders]);

  return (
    <div data-testid="party-live-shell">
      {/* Live connection indicator (for tests + debug) */}
      {connected && <span data-testid="party-live-connected" aria-hidden="true" />}

      {/* PartyScene: the outer chrome shell (MissionBar + FlowStrip + FraguaScene) */}
      <PartyScene snapshot={snapshot} />
    </div>
  );
}
