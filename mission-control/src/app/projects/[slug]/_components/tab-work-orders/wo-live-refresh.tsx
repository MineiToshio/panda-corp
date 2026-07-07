"use client";

/**
 * WO-05-003 — WoLiveRefresh (AC-05-005.1 live board updater)
 *
 * Invisible client component. Subscribes to `useLiveSnapshot` (WO-01-009, the
 * shared SSE transport) and calls `router.refresh()` whenever a new event arrives,
 * causing Next.js to re-render the Server Component tree that reads from disk.
 *
 * Pattern: minimal client boundary — only the live-refresh connector is "use client";
 * the board and all its data-reading are Server Components (no client state).
 *
 * Traceability:
 *   AC-05-005.1  Board SHALL update LIVE as agents change WO state (no page reload).
 *
 * Design rules:
 *   - Renders nothing to the DOM (null return).
 *   - Never writes to disk.
 *   - data-testid="wo-live-refresh" on the hidden span for integration tests.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import { stateVersionMoved } from "@/lib/status/state-version-moved";

export interface WoLiveRefreshProps {
  /** Project slug — passed to the SSE endpoint as ?project=<slug>. */
  project: string;
}

/**
 * WoLiveRefresh — invisible SSE subscriber that triggers a server refresh when
 * this project has fresh state.
 *
 * TWO refresh triggers (2026-07-07): a new EVENT (`lastEventAt` changed) OR a
 * moved machine-STATE version (`stateVersion`, DR-066 fix 3). The engine emits NO
 * event on a backward WO transition (IN_REVIEW→PLANNED on a reopen) — it only
 * rewrites the work-order frontmatter — so an event-only refresher misses it. The
 * stateVersion (max mtime of status.yaml + WO frontmatter) moves on that rewrite,
 * so the board re-reads and the reverted WO walks back to its column.
 *
 * Fast cadence: the transport already debounces (~150ms) and the route throttles
 * (~200ms) → ~350ms effective. No extra throttle here — the Server Component
 * re-read is the cheap, coalescing side of this. AC-05-005.1: event-driven.
 */
export function WoLiveRefresh({ project }: WoLiveRefreshProps): React.JSX.Element | null {
  const router = useRouter();
  const { snapshot, lastEventAt } = useLiveSnapshot({ project });

  // Track the previous lastEventAt + last state version to detect genuine movement.
  const prevEventRef = useRef<string | null>(null);
  const lastStateVersionRef = useRef<number | null>(null);

  useEffect(() => {
    const eventMoved = lastEventAt !== null && lastEventAt !== prevEventRef.current;
    // Always evaluate stateVersionMoved so its baseline is set on the first frame.
    const stateMoved = stateVersionMoved(snapshot?.stateVersion, lastStateVersionRef);
    if (eventMoved) prevEventRef.current = lastEventAt;
    if (eventMoved || stateMoved) {
      // Re-run the Server Component tree so the board re-reads the updated
      // work-order files from disk.
      router.refresh();
    }
  }, [lastEventAt, snapshot, router]);

  // Renders nothing — purely a side-effect component.
  return <span data-testid="wo-live-refresh" aria-hidden="true" style={{ display: "none" }} />;
}
