/**
 * IF-18-digest — pure derivation helper (WO-18-001, FRD-18, blueprint §3).
 *
 * Given the event tail + the `visto_hasta` marker (client-supplied), splits
 * events into:
 *   - `newEvents`  — events STRICTLY NEWER than the marker (highlighted + counted).
 *   - `last24h`    — events within the last-24h rolling window (dimmed fallback).
 *   - `atDia`      — true when there are no new events.
 *
 * Constraints:
 *   - PURE: no side effects, no I/O, no localStorage access.
 *   - Does NOT mutate the input array.
 *   - Items sorted newest-first in both lists.
 *   - Change-framed (one item per source event, never cumulative totals).
 *
 * Traceability: REQ-18-005 → AC-18-001.1; REQ-18-007 → AC-18-001.3;
 *               REQ-18-008 → AC-18-001.4.
 */

import type { Event } from "@/lib/events/events";

/** Window in milliseconds that defines "last 24h" rolling fallback. */
const LAST_24H_MS = 24 * 60 * 60 * 1000;

/**
 * A single change-framed item in the digest.
 *
 * - `event`        — the source Event.
 * - `isNew`        — true if this event is newer than the `visto_hasta` marker.
 * - `relativeLabel`— human-readable relative timestamp (e.g. "hace 30 min", "hace 2 h").
 */
export interface DigestItem {
  event: Event;
  isNew: boolean;
  relativeLabel: string;
}

/**
 * The result returned by `computeDigest`.
 *
 * - `newEvents` — change-framed items newer than the marker, newest-first.
 * - `last24h`   — change-framed items within the last-24h window (always computed;
 *                 used as fallback when `atDia` is true), newest-first.
 *                 Only includes events that are NOT already in `newEvents` (i.e. seen).
 * - `atDia`     — true when `newEvents` is empty.
 */
export interface DigestResult {
  newEvents: DigestItem[];
  last24h: DigestItem[];
  atDia: boolean;
}

/**
 * Build a human-readable relative timestamp label in Spanish.
 *
 * @param eventMs - The event's timestamp in milliseconds.
 * @param nowMs   - The "current" time in milliseconds.
 * @returns A string like "hace 30 min", "hace 2 h", "hace 1 día".
 */
function relativeLabel(eventMs: number, nowMs: number): string {
  const diffMs = nowMs - eventMs;
  const diffMin = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMin < 1) return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays === 1) return "hace 1 día";
  return `hace ${diffDays} días`;
}

/**
 * Derive the digest from the event tail.
 *
 * @param events   - The capped event tail (any order; typically oldest-first from the stream).
 * @param markerMs - The `visto_hasta` timestamp in ms. Events strictly AFTER this are "new".
 * @param nowMs    - The current time in ms (injected for purity / testability).
 * @returns A `DigestResult` with `newEvents`, `last24h`, and `atDia`.
 */
export function computeDigest(
  events: readonly Event[],
  markerMs: number,
  nowMs: number,
): DigestResult {
  const windowStart = nowMs - LAST_24H_MS;

  const newEvents: DigestItem[] = [];
  const last24h: DigestItem[] = [];

  for (const ev of events) {
    const evMs = new Date(ev.at).getTime();
    const isNew = evMs > markerMs;

    if (isNew) {
      newEvents.push({ event: ev, isNew: true, relativeLabel: relativeLabel(evMs, nowMs) });
    } else if (evMs > windowStart) {
      // Seen but within 24h rolling window → fallback list (dimmed)
      last24h.push({ event: ev, isNew: false, relativeLabel: relativeLabel(evMs, nowMs) });
    }
  }

  // Sort newest-first (ISO strings compare lexicographically)
  newEvents.sort((a, b) => (a.event.at > b.event.at ? -1 : a.event.at < b.event.at ? 1 : 0));
  last24h.sort((a, b) => (a.event.at > b.event.at ? -1 : a.event.at < b.event.at ? 1 : 0));

  return {
    newEvents,
    last24h,
    atDia: newEvents.length === 0,
  };
}
