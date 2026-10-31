"use client";

/**
 * CMP-18-live-watcher — DashboardLiveWatcher (WO-18-001, AC-18-001.2)
 *
 * Client component that provides real-time / event-driven dashboard updates.
 *
 * Behaviour:
 *   - Subscribes to the shared `useLiveSnapshot` hook (WO-01-009 SSE transport).
 *   - When a new live event arrives (`lastEventAt` changes), calls
 *     `router.refresh()` to re-run the Server Component with fresh lib data.
 *   - Renders nothing (null) — it is a pure side-effect component.
 *   - Does NOT own a transport; does NOT poll; does NOT write to disk.
 *
 * Architecture notes:
 *   - `router.refresh()` re-runs the RSC payload for the current route without
 *     a navigation, so the Server Component re-reads `lib/**` and streams fresh
 *     data into the affected sections.
 *   - Native decision disclosure state is preserved across refreshes by React.
 *   - "use client" required: useLiveSnapshot opens an EventSource.
 *
 * Traceability:
 *   AC-18-001.2 — event-driven, NOT polling; does not own the transport
 *   REQ-18-004   — dashboard updates live without a reload
 */

import { useEffect, useRef } from "react";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import { useBackgroundRefresh } from "@/lib/navigation/NavigationProvider";
import { stateVersionMoved } from "@/lib/status/state-version-moved";

/**
 * DashboardLiveWatcher — invisible client component.
 *
 * Subscribes to the shared SSE transport (useLiveSnapshot) and calls
 * router.refresh() when new events arrive, making the dashboard event-driven
 * without any polling.
 *
 * Renders null — no visible output.
 */
export function DashboardLiveWatcher(): null {
  const refresh = useBackgroundRefresh();
  const { lastEventAt, snapshot } = useLiveSnapshot();
  const previousVersion = useRef<number | null>(null);
  // Track the previous lastEventAt to detect genuinely new events
  const prevLastEventAt = useRef<string | null>(null);

  useEffect(() => {
    const eventMoved = lastEventAt !== null && lastEventAt !== prevLastEventAt.current;
    const stateMoved = stateVersionMoved(snapshot?.stateVersion, previousVersion);
    if (eventMoved) prevLastEventAt.current = lastEventAt;
    if (eventMoved || stateMoved) refresh();
  }, [lastEventAt, snapshot, refresh]);

  return null;
}
