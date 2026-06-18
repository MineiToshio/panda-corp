/**
 * WO-18-001 — `IF-18-digest` pure function — RED phase
 *
 * Traceability (EARS → AC → test):
 *   AC-18-001.1  (REQ-18-005) IF-18-digest returns change-framed items with relative
 *                timestamps from the event tail (not cumulative totals).
 *   AC-18-001.2  (REQ-18-006) The marker is persisted in localStorage and survives
 *                a refresh; refresh/visit does NOT advance it.
 *   AC-18-001.3  (REQ-18-007) Marker advances ONLY on "marcar visto"; events newer
 *                than the marker are flagged "new" and counted.
 *   AC-18-001.4  (REQ-18-008) WHEN no new events, section shows al-día state + last-24h
 *                activity (dimmed) — never empty.
 *   AC-18-001.6  Marker is NEVER written to the factory/project; client-local only.
 *
 * Pure function tests only (no DOM, no localStorage). Component tests are in
 * `Digest/_tests/digest.test.tsx`.
 *
 * Stack: Vitest (jsdom, but these tests don't use DOM).
 */

import { describe, expect, it } from "vitest";
import type { Event } from "@/lib/events/events";
import { computeDigest, type DigestItem, type DigestResult } from "../digest";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Build a minimal Event at a given ISO timestamp. */
function makeEvent(at: string, overrides: Partial<Event> = {}): Event {
  return {
    event: "AgentWorking",
    at,
    ...overrides,
  };
}

const NOW_MS = new Date("2026-06-18T12:00:00Z").getTime();
const HOUR_MS = 60 * 60 * 1000;

// Events at various offsets from NOW_MS
const ev30minAgo = makeEvent(new Date(NOW_MS - 0.5 * HOUR_MS).toISOString(), {
  event: "WoCompleted",
  project: "alpha",
});
const ev2hAgo = makeEvent(new Date(NOW_MS - 2 * HOUR_MS).toISOString(), {
  event: "WoCompleted",
  project: "beta",
});
const ev10hAgo = makeEvent(new Date(NOW_MS - 10 * HOUR_MS).toISOString(), {
  event: "AgentWorking",
  project: "gamma",
});
const ev25hAgo = makeEvent(new Date(NOW_MS - 25 * HOUR_MS).toISOString(), {
  event: "AgentWorking",
  project: "delta",
});
const ev48hAgo = makeEvent(new Date(NOW_MS - 48 * HOUR_MS).toISOString(), {
  event: "WoCompleted",
  project: "epsilon",
});

// A full fixture tail: oldest to newest
const FULL_TAIL: readonly Event[] = [ev48hAgo, ev25hAgo, ev10hAgo, ev2hAgo, ev30minAgo];

// ---------------------------------------------------------------------------
// AC-18-001.1 — change-framed items, relative timestamps, sorted newest-first
// ---------------------------------------------------------------------------

describe("frd-18: IF-18-digest — AC-18-001.1 (change-framed, relative timestamps)", () => {
  it("frd-18: returns a DigestResult with newEvents, last24h, and atDia fields", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS; // marker 5h ago
    const result: DigestResult = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    expect(result).toHaveProperty("newEvents");
    expect(result).toHaveProperty("last24h");
    expect(result).toHaveProperty("atDia");
  });

  it("frd-18: AC-18-001.1 — newEvents are sorted newest-first", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    // ev30minAgo (newer) should come before ev2hAgo (older)
    expect(newEvents.length).toBeGreaterThan(1);
    for (let i = 1; i < newEvents.length; i++) {
      // DigestItem exposes the source event via .event.at
      expect(newEvents[i - 1]!.event.at >= newEvents[i]!.event.at).toBe(true);
    }
  });

  it("frd-18: AC-18-001.1 — last24h items are sorted newest-first", () => {
    // Marker at NOW → everything is "seen"; within-24h events go to last24h
    const markerMs = NOW_MS;
    const { last24h } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    expect(last24h.length).toBeGreaterThan(1);
    for (let i = 1; i < last24h.length; i++) {
      // DigestItem exposes the source event via .event.at
      expect(last24h[i - 1]!.event.at >= last24h[i]!.event.at).toBe(true);
    }
  });

  it("frd-18: AC-18-001.1 — each DigestItem carries the source Event and a relativeLabel", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    for (const item of newEvents) {
      expect(item).toHaveProperty("event");
      expect(item).toHaveProperty("relativeLabel");
      expect(typeof item.relativeLabel).toBe("string");
      expect(item.relativeLabel.trim()).not.toBe("");
    }
  });

  it("frd-18: AC-18-001.1 — relative label for <1h event includes 'min'", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    const { newEvents } = computeDigest([ev30minAgo], markerMs, NOW_MS);
    // The 30-minute-ago event should produce a relative label containing 'min'
    const item = newEvents.find((i) => i.event.at === ev30minAgo.at);
    expect(item).toBeDefined();
    expect(item!.relativeLabel).toMatch(/min/);
  });

  it("frd-18: AC-18-001.1 — relative label for 2h event includes 'h'", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    const { newEvents } = computeDigest([ev2hAgo], markerMs, NOW_MS);
    const item = newEvents.find((i) => i.event.at === ev2hAgo.at);
    expect(item).toBeDefined();
    // Either "Xh" or "X h" pattern
    expect(item!.relativeLabel).toMatch(/\d+\s*h/);
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.3 — events newer than marker are "new"; marker logic
// ---------------------------------------------------------------------------

describe("frd-18: IF-18-digest — AC-18-001.3 (marker logic: new vs seen)", () => {
  it("frd-18: AC-18-001.3 — events NEWER than marker go into newEvents", () => {
    // Marker set to 3h ago → ev30minAgo (0.5h) and ev2hAgo (2h) are "new"
    const markerMs = NOW_MS - 3 * HOUR_MS;
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    const ats = newEvents.map((i) => i.event.at);
    expect(ats).toContain(ev30minAgo.at);
    expect(ats).toContain(ev2hAgo.at);
  });

  it("frd-18: AC-18-001.3 — events OLDER than marker do NOT appear in newEvents", () => {
    const markerMs = NOW_MS - 3 * HOUR_MS;
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    const ats = newEvents.map((i) => i.event.at);
    expect(ats).not.toContain(ev10hAgo.at);
    expect(ats).not.toContain(ev25hAgo.at);
    expect(ats).not.toContain(ev48hAgo.at);
  });

  it("frd-18: AC-18-001.3 — event EXACTLY at marker timestamp is NOT new", () => {
    const markerMs = new Date(ev2hAgo.at).getTime();
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    const ats = newEvents.map((i) => i.event.at);
    // ev2hAgo is exactly at marker — it should NOT be "new"
    expect(ats).not.toContain(ev2hAgo.at);
  });

  it("frd-18: AC-18-001.3 — all events are new when marker is 0 (epoch)", () => {
    const { newEvents } = computeDigest(FULL_TAIL, 0, NOW_MS);
    // With marker at epoch, every event is newer
    expect(newEvents.length).toBe(FULL_TAIL.length);
  });

  it("frd-18: AC-18-001.3 — no events are new when marker is NOW", () => {
    const { newEvents } = computeDigest(FULL_TAIL, NOW_MS, NOW_MS);
    expect(newEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.4 — al-día state + last-24h fallback when no new events
// ---------------------------------------------------------------------------

describe("frd-18: IF-18-digest — AC-18-001.4 (al-día + last-24h fallback)", () => {
  it("frd-18: AC-18-001.4 — atDia is true when there are no new events", () => {
    const { atDia, newEvents } = computeDigest(FULL_TAIL, NOW_MS, NOW_MS);
    expect(newEvents.length).toBe(0);
    expect(atDia).toBe(true);
  });

  it("frd-18: AC-18-001.4 — atDia is false when there are new events", () => {
    const markerMs = NOW_MS - 3 * HOUR_MS;
    const { atDia } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    expect(atDia).toBe(false);
  });

  it("frd-18: AC-18-001.4 — last24h contains events within the last 24h rolling window", () => {
    // Marker at NOW → everything is "seen"; events within 24h go to last24h fallback.
    const markerMs = NOW_MS;
    const { last24h } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    // Events within 24h: ev30minAgo (0.5h), ev2hAgo (2h), ev10hAgo (10h)
    const ats = last24h.map((i) => i.event.at);
    expect(ats).toContain(ev30minAgo.at);
    expect(ats).toContain(ev2hAgo.at);
    expect(ats).toContain(ev10hAgo.at);
  });

  it("frd-18: AC-18-001.4 — last24h does NOT include events older than 24h", () => {
    // Marker at NOW → everything is "seen"; only within-24h events go to last24h.
    const markerMs = NOW_MS;
    const { last24h } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    const ats = last24h.map((i) => i.event.at);
    expect(ats).not.toContain(ev25hAgo.at);
    expect(ats).not.toContain(ev48hAgo.at);
  });

  it("frd-18: AC-18-001.4 — last24h is populated even in al-día state (fallback, never empty when events exist)", () => {
    // al-día + no new events → last24h serves as fallback
    const { atDia, last24h } = computeDigest(FULL_TAIL, NOW_MS, NOW_MS);
    expect(atDia).toBe(true);
    // There are events within 24h in FULL_TAIL
    expect(last24h.length).toBeGreaterThan(0);
  });

  it("frd-18: AC-18-001.4 — fresh factory (empty tail) → atDia true, last24h empty", () => {
    const { atDia, newEvents, last24h } = computeDigest([], NOW_MS, NOW_MS);
    expect(atDia).toBe(true);
    expect(newEvents.length).toBe(0);
    expect(last24h.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.1 — items are change-framed (not cumulative totals)
// ---------------------------------------------------------------------------

describe("frd-18: IF-18-digest — change-framed (not cumulative)", () => {
  it("frd-18: each item represents a single event, not an aggregate count", () => {
    const markerMs = 0;
    const { newEvents } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    // Each item should map 1:1 to a source event
    expect(newEvents.length).toBe(FULL_TAIL.length);
    for (const item of newEvents) {
      // Each item should reference its source event's 'at' timestamp
      expect(typeof item.event.at).toBe("string");
    }
  });

  it("frd-18: computeDigest is a pure function — same inputs produce same output", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    const r1 = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    const r2 = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    expect(r1.atDia).toBe(r2.atDia);
    expect(r1.newEvents.length).toBe(r2.newEvents.length);
    expect(r1.last24h.length).toBe(r2.last24h.length);
  });

  it("frd-18: computeDigest does not mutate the input array", () => {
    const tail = [...FULL_TAIL];
    const originalFirst = tail[0]!.at;
    computeDigest(tail, NOW_MS - 5 * HOUR_MS, NOW_MS);
    expect(tail[0]!.at).toBe(originalFirst);
    expect(tail.length).toBe(FULL_TAIL.length);
  });
});

// ---------------------------------------------------------------------------
// DigestItem shape
// ---------------------------------------------------------------------------

describe("frd-18: DigestItem type contract", () => {
  it("frd-18: DigestItem has isNew flag that matches whether it came from newEvents", () => {
    const markerMs = NOW_MS - 3 * HOUR_MS;
    const { newEvents, last24h } = computeDigest(FULL_TAIL, markerMs, NOW_MS);
    for (const item of newEvents) {
      expect(item.isNew).toBe(true);
    }
    // last24h items that are seen should have isNew false
    for (const item of last24h) {
      expect(item.isNew).toBe(false);
    }
  });
});
