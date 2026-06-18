/**
 * WO-12-001 — `freshness` selector (IF-12-freshness).
 *
 * Pure selector: given the capped event tail and a reference `now`, returns
 * the timestamp of the newest event and a live/stale flag for the
 * "Live / No signal" indicator (AC-12-002.1, REQ-12-002).
 *
 * Contract:
 *   freshness(events: Event[], now: Date): { lastAt: string | null; live: boolean }
 *   - `lastAt`: maximum `at` ISO string across all events with a parseable
 *     timestamp, or null when the array is empty or all `at` values are invalid.
 *   - `live`: true when `lastAt` is within FRESHNESS_THRESHOLD_MS of `now`;
 *     false otherwise ("Sin señal").
 *   - Pure: no side-effects, no I/O, deterministic given the same inputs.
 *   - Never throws regardless of input shape.
 *   - Events with an unparseable `at` value are silently skipped (B1' anchor).
 *
 * Regression anchors:
 *   B1' (WO-13-001): Date.parse("bad") === NaN; NaN <= threshold is false,
 *     silently treating a valid recent event as stale. Guard with
 *     Number.isFinite(Date.parse(at)) before including the event.
 *   I2  (WO-13-001): freshness([]) must return { lastAt: null, live: false }.
 *   FREEZE-ON-RED: per-item errors must not abort the whole batch.
 *
 * Traceability: AC-12-002.1 → REQ-12-002 → IF-12-freshness → WO-12-001.
 */

import type { Event } from "../../../../lib/events/events";

/**
 * The window (in milliseconds) within which an event is considered "live".
 *
 * Named constant, not a magic number (blueprint §3; WO-12-001 scope).
 * Chosen as 5 minutes — long enough to tolerate normal idle periods between
 * factory events, short enough to surface a frozen stream promptly.
 */
export const FRESHNESS_THRESHOLD_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Compute data-freshness from the capped event tail.
 *
 * @param events - The already-parsed, capped `DashboardEvent[]` from
 *                 `lib/events` (no re-reading, no I/O — blueprint §3).
 * @param now    - The reference instant. Injected as a parameter so the
 *                 function is fully deterministic in tests.
 * @returns `{ lastAt, live }` — `lastAt` is the ISO string of the most
 *          recent valid event, or `null`; `live` is `true` when `lastAt`
 *          is within `FRESHNESS_THRESHOLD_MS` of `now`.
 */
export function freshness(events: Event[], now: Date): { lastAt: string | null; live: boolean } {
  let lastAt: string | null = null;

  for (const ev of events) {
    // B1' regression: guard against unparseable `at` values before comparing.
    const parsed = Date.parse(ev.at);
    if (!Number.isFinite(parsed)) {
      // Invalid ISO string — skip this event; do not corrupt lastAt.
      continue;
    }

    // ISO 8601 strings compare lexicographically, so string comparison is
    // equivalent to numeric timestamp comparison for well-formed UTC strings.
    // We keep the raw string (not the numeric ms) as lastAt because the
    // contract specifies `string | null` and callers display it as-is.
    if (lastAt === null || ev.at > lastAt) {
      lastAt = ev.at;
    }
  }

  if (lastAt === null) {
    return { lastAt: null, live: false };
  }

  // Compute the gap between `now` and the newest event.
  // Date.parse is safe here because we only set lastAt from a string that
  // already passed the Number.isFinite(Date.parse(...)) guard above.
  const gapMs = now.getTime() - Date.parse(lastAt);

  // live: strictly WITHIN the threshold (gap < threshold).
  // At exactly threshold or beyond → stale ("Sin señal").
  const live = gapMs < FRESHNESS_THRESHOLD_MS;

  return { lastAt, live };
}
