"use client";

/**
 * CelebrationWatcher — auto-fires CelebrationSurface on result events (WO-09-003)
 *
 * This client component is the WIRING layer that connects:
 *   - `useLiveSnapshot` (the shared SSE transport, WO-01-009) — the event source
 *   - `CelebrationSurface` (CMP-09-celebration, WO-09-003) — the display layer
 *   - `classifyCelebration` (WO-09-005) — the honest tier classifier
 *
 * Architecture and design constraints:
 *   - "use client" required: subscribes to SSE (EventSource) via useLiveSnapshot.
 *   - Reads the LATEST event from the live snapshot; passes it directly to
 *     CelebrationSurface which calls classifyCelebration() internally.
 *   - The celebration fires AUTOMATICALLY when a result event arrives — NEVER
 *     from a button press (DR-061 / AC-09-006.1; FRD-09 §auto-fire mandate).
 *   - The ONLY button is the dismiss button INSIDE the overlay (DR-061).
 *   - No false-urgency: no timer, no countdown, no auto-dismiss after N seconds
 *     (AC-09-006.4 negative AC).
 *   - Announcement via aria-live="polite" inside CelebrationSurface/LiveRegion
 *     — never steals focus on auto-fire (AC-09-006.5).
 *   - Non-result events (read/navigate/activity) → classifyCelebration → "none"
 *     → CelebrationSurface renders null (AC-09-006.2 negative AC).
 *
 * Mounted once in app/layout.tsx so the celebration is global (every route).
 * Renders null when no result event is in flight.
 *
 * Traceability:
 *   AC-09-006.1 — celebration SCALES via CelebrationSurface (toast/phase/release/levelup)
 *   AC-09-006.2 — non-result events → "none" → nothing rendered (negative AC)
 *   AC-09-006.3 — animation in CelebrationSurface (transform/opacity, reduced-motion aware)
 *   AC-09-006.4 — no false-urgency timer/countdown/nagging (negative AC)
 *   AC-09-006.5 — aria-live="polite" via LiveRegion inside CelebrationSurface
 *   DR-061       — auto-fired; dismiss button only; no preview button in production
 */

import type React from "react";
import { CelebrationSurface } from "@/components/core/CelebrationSurface/CelebrationSurface";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { Event } from "@/lib/events/events";
import { classifyCelebration } from "@/lib/gamification/gamification";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract the latest result event to celebrate, if the most-recent snapshot
 * event is itself a result event.
 *
 * Design rationale (AC-09-006.2 negative AC):
 *   The celebration fires ONLY when the MOST RECENT event in the snapshot is a
 *   result event. If the latest event is a non-result (navigation, read,
 *   activity) no celebration fires — even if earlier events in the snapshot
 *   were results (those should have already been celebrated and dismissed by the
 *   time the non-result arrives).
 *
 * This is the honest, non-nagging behavior: the trigger is the exact moment
 * a result event becomes the latest known event, not a retrospective scan.
 *
 * @param events - ordered event list (chronological, last = most recent)
 * @returns the most-recent event if its tier ≠ "none"; null otherwise
 */
function latestResultEvent(events: readonly Event[]): Event | null {
  const latest = events[events.length - 1];
  if (latest === undefined) return null;
  return classifyCelebration(latest) !== "none" ? latest : null;
}

// ── CelebrationWatcher ────────────────────────────────────────────────────────

/**
 * CelebrationWatcher — the global auto-fire celebration wiring.
 *
 * Mounted in app/layout.tsx. Subscribes to the shared SSE transport and
 * surfaces the correct CelebrationSurface tier whenever a result event arrives.
 *
 * Renders null when no result event is active or when the celebration has been
 * dismissed by the user.
 */
export function CelebrationWatcher(): React.JSX.Element | null {
  // Shared SSE transport (WO-01-009) — no project filter: celebrations are global
  const { snapshot } = useLiveSnapshot();

  // Extract the latest result event from the live snapshot
  const resultEvent = snapshot ? latestResultEvent(snapshot.events) : null;

  // CelebrationSurface handles:
  //   - classifyCelebration(event) → tier
  //   - "none" tier → returns null
  //   - dismiss state management
  //   - prefers-reduced-motion (AC-09-006.3)
  //   - aria-live="polite" announcement (AC-09-006.5)
  return <CelebrationSurface event={resultEvent} />;
}
