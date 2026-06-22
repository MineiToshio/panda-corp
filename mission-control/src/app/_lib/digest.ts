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
 * Maximum number of new-event rows rendered.
 *
 * A fresh marker (0) can match thousands of events; rendering them all causes a
 * visual runaway (DR-056 gate finding). Capped at 20 — the prototype shows ≈4–8
 * compact rows. The actual total is exposed via `totalNewCount` so the UI can
 * show "N más sin ver" without rendering all of them.
 */
const MAX_NEW_EVENTS = 20;

/**
 * Event types that are pure infrastructure / live-stream noise — excluded from the "since last visit"
 * digest. The real `dashboard-events.ndjson` is dominated by these (thousands of SubagentStop +
 * SupervisorTick + AgentWorking); surfacing them floods the digest with meaningless "SubagentStop ·
 * mission-control" rows instead of the milestone changes the prototype's digest shows.
 */
const DIGEST_NOISE_EVENTS: ReadonlySet<string> = new Set([
  "SubagentStop", // Claude runtime per-subagent stop — not a factory milestone
  "SupervisorTick", // supervisor heartbeat
  "AgentWorking", // fine-grained "agent is working on WO X" — belongs to the live Party, not the digest
]);

/** Keep only digest-worthy (milestone) events — drops the high-volume infra / live-stream noise. */
export function filterDigestEvents(events: readonly Event[]): Event[] {
  return events.filter((ev) => !DIGEST_NOISE_EVENTS.has(ev.event));
}

/** Spanish, human-readable labels for the milestone event types (UI copy is Spanish, architecture §7). */
const EVENT_TYPE_LABELS: Record<string, string> = {
  ReviewVerdict: "Veredicto de revisión",
  ReviewDone: "Revisión terminada",
  GateVerdict: "Veredicto del gate",
  GateResult: "Resultado del gate",
  BuildLaunch: "Construcción iniciada",
  BuildComplete: "Construcción completada",
  BuildRelaunch: "Construcción relanzada",
  AgentDone: "Agente completó su trabajo",
  AgentFinding: "Hallazgo de un agente",
  TaskCreated: "Tarea creada",
};

/** Human label for an event: a Spanish milestone label, falling back to the raw type. */
export function eventLabel(event: Event): string {
  return EVENT_TYPE_LABELS[event.event] ?? event.event;
}

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
 * - `newEvents`      — change-framed items newer than the marker, newest-first.
 *                      Capped at `MAX_NEW_EVENTS` to prevent visual runaway on a
 *                      fresh marker (DR-056 gate finding).
 * - `totalNewCount`  — the true count of all events newer than the marker, before
 *                      the cap. Use this to display "N más sin ver" when truncated.
 * - `last24h`        — change-framed items within the last-24h window (always
 *                      computed; used as fallback when `atDia` is true), newest-first.
 *                      Only includes events NOT already in `newEvents` (i.e. seen).
 * - `atDia`          — true when `totalNewCount` is 0 (no new events at all).
 */
export interface DigestResult {
  newEvents: DigestItem[];
  totalNewCount: number;
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

  const allNewEvents: DigestItem[] = [];
  const last24h: DigestItem[] = [];

  for (const ev of events) {
    const evMs = new Date(ev.at).getTime();
    const isNew = evMs > markerMs;

    if (isNew) {
      allNewEvents.push({ event: ev, isNew: true, relativeLabel: relativeLabel(evMs, nowMs) });
    } else if (evMs > windowStart) {
      // Seen but within 24h rolling window → fallback list (dimmed)
      last24h.push({ event: ev, isNew: false, relativeLabel: relativeLabel(evMs, nowMs) });
    }
  }

  // Sort newest-first (ISO strings compare lexicographically)
  allNewEvents.sort((a, b) => (a.event.at > b.event.at ? -1 : a.event.at < b.event.at ? 1 : 0));
  last24h.sort((a, b) => (a.event.at > b.event.at ? -1 : a.event.at < b.event.at ? 1 : 0));

  // Cap to prevent visual runaway when marker is 0 (DR-056 gate finding).
  // Expose totalNewCount so the UI can show "N más sin ver" for the overflow.
  const totalNewCount = allNewEvents.length;
  const newEvents = allNewEvents.slice(0, MAX_NEW_EVENTS);

  return {
    newEvents,
    totalNewCount,
    last24h,
    atDia: totalNewCount === 0,
  };
}
