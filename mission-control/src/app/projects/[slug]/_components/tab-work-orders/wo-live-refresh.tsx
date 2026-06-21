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

export interface WoLiveRefreshProps {
  /** Project slug — passed to the SSE endpoint as ?project=<slug>. */
  project: string;
}

/**
 * WoLiveRefresh — invisible SSE subscriber that triggers a server refresh on
 * any new event for this project.
 *
 * AC-05-005.1: event-driven, not polling.
 */
export function WoLiveRefresh({ project }: WoLiveRefreshProps): React.JSX.Element | null {
  const router = useRouter();
  const { lastEventAt } = useLiveSnapshot({ project });

  // Track the previous lastEventAt to detect genuine new events.
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastEventAt !== null && lastEventAt !== prevRef.current) {
      prevRef.current = lastEventAt;
      // Re-run the Server Component tree so the board re-reads the updated
      // work-order files from disk.
      router.refresh();
    }
  }, [lastEventAt, router]);

  // Renders nothing — purely a side-effect component.
  return <span data-testid="wo-live-refresh" aria-hidden="true" style={{ display: "none" }} />;
}
