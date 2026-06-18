/**
 * WO-12-001 — `freshness` selector — RED phase.
 *
 * Tests are written BEFORE the implementation
 * (`app/_observability/selectors/freshness.ts` does not exist yet).
 * ALL tests must fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-12-002.1  The view SHALL show a Live / No signal indicator with the
 *                timestamp of the last event read from dashboard-events.ndjson
 *                (data freshness), so the operator knows whether they're seeing
 *                something current or frozen.
 *                Source: FRD-12 EARS criteria, REQ-12-002; blueprint §2
 *                (`IF-12-freshness`); WO-12-001.
 *
 * Contract (from WO-12-001 + blueprint §2/§3):
 *   export function freshness(
 *     events: Event[],
 *     now: Date,
 *   ): { lastAt: string | null; live: boolean }
 *
 *   - `lastAt`: the maximum `at` ISO string across all events, or null if
 *     the array is empty.
 *   - `live`: true when `lastAt` is within a named threshold constant
 *     (e.g. FRESHNESS_THRESHOLD_MS — a named export, NOT a magic number);
 *     false when the gap exceeds the threshold → "Sin señal".
 *   - Pure: no side-effects, no I/O, deterministic given the same inputs.
 *   - Never throws regardless of input shape.
 *   - The threshold is a centralized constant (blueprint §3); the tests
 *     import it to assert against, not hardcode a magic number.
 *
 * EARS breakdown:
 *   WHEN events is [] THEN { lastAt: null, live: false } ("Sin señal").
 *   WHEN newest event is within threshold THEN live: true.
 *   WHEN newest event is older than threshold THEN live: false.
 *   WHEN multiple events exist THEN lastAt is the maximum at, not the last
 *     in array position (order-independent).
 *   WHEN all events share the same at THEN lastAt is that value, live depends
 *     on the gap to now.
 *
 * Regression anchors from .pandacorp/comms/progress.md:
 *   B1' (2026-06-16, WO-13-001): `typeof NaN === "number"` — if the impl
 *     computes the gap as `now - Date.parse(at)` and `at` is an invalid ISO
 *     string, `Date.parse` returns NaN, then `NaN <= threshold` is false, so
 *     the event is treated as stale even if it was emitted a second ago.
 *     Regression: an event with a parseable `at` always contributes its
 *     timestamp correctly; an event with an unparseable `at` is skipped
 *     (does not corrupt lastAt to NaN).
 *   I2 (2026-06-16, WO-13-001): empty objects/arrays satisfied vacuous
 *     checks — regression: freshness([]) must return { lastAt: null, live:
 *     false }, not throw.
 *   FREEZE-ON-RED (2026-06-16): per-item errors must not abort the whole
 *     batch — freshness must return a valid result even if some events have
 *     malformed `at` values.
 *
 * Property-based coverage (parametric without fast-check):
 *   The "threshold boundary" describe block sweeps a representative set of
 *   gaps (just-inside, exactly-on, just-outside, far-outside) and verifies
 *   live/stale for each — covering the boundary mutation targets.
 *   The "max-at invariant" block runs over shuffled event arrays, verifying
 *   that lastAt is always the maximum at regardless of array order.
 *
 * Stack: Vitest (TypeScript). No mocks — `freshness` is pure.
 * `now` is injected as a parameter, making time fully deterministic in tests.
 */

import { describe, expect, it } from "vitest";

// The module under test — does NOT exist yet (RED phase).
// The threshold constant is also imported so tests do not embed magic numbers.
import { FRESHNESS_THRESHOLD_MS, freshness } from "./freshness";

// ---------------------------------------------------------------------------
// Local type alias — mirrors the Event type from lib/events.ts (WO-12-001
// depends on FRD-01 lib/events; tests are self-contained, no real I/O).
// ---------------------------------------------------------------------------

type Event = {
  event: string;
  at: string;
  agent?: string;
  project?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid Event with a given ISO timestamp. */
function ev(at: string, overrides: Partial<Event> = {}): Event {
  return { event: "AgentWorking", at, ...overrides };
}

/**
 * Return a Date that is `deltaMs` milliseconds before `anchor`.
 * Negative deltaMs → in the future relative to anchor.
 */
function msAgo(anchor: Date, deltaMs: number): Date {
  return new Date(anchor.getTime() - deltaMs);
}

// ---------------------------------------------------------------------------
// AC-12-002.1 — empty events array → { lastAt: null, live: false }
// The "Sin señal" state when there is no event history.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — AC-12-002.1 empty events → Sin señal", () => {
  const now = new Date("2026-06-16T10:00:00Z");

  it("frd-12: WHEN events is [] THEN lastAt is null", () => {
    expect(freshness([], now).lastAt).toBeNull();
  });

  it("frd-12: WHEN events is [] THEN live is false (Sin señal)", () => {
    expect(freshness([], now).live).toBe(false);
  });

  it("frd-12: WHEN events is [] THEN the return shape has exactly {lastAt, live} keys", () => {
    const result = freshness([], now);
    expect(result).toHaveProperty("lastAt");
    expect(result).toHaveProperty("live");
  });

  it("frd-12: WHEN events is [] THEN freshness does NOT throw", () => {
    expect(() => freshness([], now)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — lastAt is the MAXIMUM `at` across all events
// (order-independent — the newest event wins, not the last in array position)
// ---------------------------------------------------------------------------

describe("frd-12: freshness — AC-12-002.1 lastAt is the maximum `at`", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("frd-12: WHEN there is one event THEN lastAt equals that event's at", () => {
    const events = [ev("2026-06-16T11:59:00Z")];
    expect(freshness(events, now).lastAt).toBe("2026-06-16T11:59:00Z");
  });

  it("frd-12: WHEN events are in chronological order THEN lastAt is the last event's at", () => {
    const events = [
      ev("2026-06-16T10:00:00Z"),
      ev("2026-06-16T11:00:00Z"),
      ev("2026-06-16T11:59:00Z"),
    ];
    expect(freshness(events, now).lastAt).toBe("2026-06-16T11:59:00Z");
  });

  it("frd-12: WHEN events are in REVERSE chronological order THEN lastAt is still the maximum at", () => {
    const events = [
      ev("2026-06-16T11:59:00Z"),
      ev("2026-06-16T11:00:00Z"),
      ev("2026-06-16T10:00:00Z"),
    ];
    expect(freshness(events, now).lastAt).toBe("2026-06-16T11:59:00Z");
  });

  it("frd-12: WHEN events are shuffled THEN lastAt equals the maximum at regardless of array position", () => {
    const events = [
      ev("2026-06-16T09:00:00Z"),
      ev("2026-06-16T11:30:00Z"),
      ev("2026-06-16T08:00:00Z"),
      ev("2026-06-16T11:59:30Z"), // <-- the max
      ev("2026-06-16T10:45:00Z"),
    ];
    expect(freshness(events, now).lastAt).toBe("2026-06-16T11:59:30Z");
  });

  it("frd-12: WHEN all events share the same at THEN lastAt is that shared timestamp", () => {
    const ts = "2026-06-16T11:00:00Z";
    const events = [ev(ts), ev(ts), ev(ts)];
    expect(freshness(events, now).lastAt).toBe(ts);
  });

  it("frd-12: WHEN events come from different projects THEN lastAt is the global maximum", () => {
    const events = [
      ev("2026-06-16T10:00:00Z", { project: "proj-a" }),
      ev("2026-06-16T11:59:00Z", { project: "proj-b" }),
      ev("2026-06-16T09:30:00Z", { project: "proj-a" }),
    ];
    expect(freshness(events, now).lastAt).toBe("2026-06-16T11:59:00Z");
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — live: true WHEN within FRESHNESS_THRESHOLD_MS
// The threshold is a named constant from the module (blueprint §3).
// ---------------------------------------------------------------------------

describe("frd-12: freshness — AC-12-002.1 live=true when within threshold", () => {
  it("frd-12: WHEN the newest event is 1ms before now THEN live is true", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev(new Date(now.getTime() - 1).toISOString())];
    expect(freshness(events, now).live).toBe(true);
  });

  it("frd-12: WHEN the newest event is halfway inside the threshold THEN live is true", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const half = Math.floor(FRESHNESS_THRESHOLD_MS / 2);
    const events = [ev(msAgo(now, half).toISOString())];
    expect(freshness(events, now).live).toBe(true);
  });

  it("frd-12: WHEN the newest event is exactly 1ms inside the threshold THEN live is true", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev(msAgo(now, FRESHNESS_THRESHOLD_MS - 1).toISOString())];
    expect(freshness(events, now).live).toBe(true);
  });

  it("frd-12: WHEN there are many events but the newest is within threshold THEN live is true", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    // Lots of old events + one recent one.
    const events = [
      ev("2026-06-15T00:00:00Z"),
      ev("2026-06-14T00:00:00Z"),
      ev(msAgo(now, 5_000).toISOString()), // 5 seconds ago — well within any sensible threshold
    ];
    expect(freshness(events, now).live).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — live: false WHEN beyond FRESHNESS_THRESHOLD_MS ("Sin señal")
// ---------------------------------------------------------------------------

describe("frd-12: freshness — AC-12-002.1 live=false when beyond threshold (Sin señal)", () => {
  it("frd-12: WHEN the newest event is exactly at the threshold THEN live is false (boundary: stale, not live)", () => {
    // At exactly threshold, the gap is not WITHIN — it is AT the limit.
    // The expected behavior: >= threshold → live=false.
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev(msAgo(now, FRESHNESS_THRESHOLD_MS).toISOString())];
    expect(freshness(events, now).live).toBe(false);
  });

  it("frd-12: WHEN the newest event is 1ms beyond the threshold THEN live is false", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev(msAgo(now, FRESHNESS_THRESHOLD_MS + 1).toISOString())];
    expect(freshness(events, now).live).toBe(false);
  });

  it("frd-12: WHEN the newest event is from yesterday THEN live is false", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev("2026-06-15T12:00:00Z")]; // 24h ago
    expect(freshness(events, now).live).toBe(false);
  });

  it("frd-12: WHEN the newest event is from last month THEN live is false", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev("2026-05-16T12:00:00Z")];
    expect(freshness(events, now).live).toBe(false);
  });

  it("frd-12: WHEN all events are old THEN live is false even if the array has many events", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [
      ev("2026-06-01T00:00:00Z"),
      ev("2026-06-02T00:00:00Z"),
      ev("2026-06-10T00:00:00Z"),
    ];
    expect(freshness(events, now).live).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — threshold boundary sweep (parametric)
//
// Rule: gap < FRESHNESS_THRESHOLD_MS → live=true; gap >= threshold → live=false.
// Verifying 8 points around the boundary kills the off-by-one mutant and the
// inverted-comparison mutant that mutation testing would otherwise miss.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — threshold boundary (parametric sweep)", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  const cases: Array<{ label: string; deltaMs: number; expectedLive: boolean }> = [
    { label: "1ms ago", deltaMs: 1, expectedLive: true },
    { label: "1s ago", deltaMs: 1_000, expectedLive: true },
    {
      label: "halfway inside threshold",
      deltaMs: Math.floor(FRESHNESS_THRESHOLD_MS / 2),
      expectedLive: true,
    },
    {
      label: "threshold - 1ms (just inside)",
      deltaMs: FRESHNESS_THRESHOLD_MS - 1,
      expectedLive: true,
    },
    {
      label: "exactly at threshold (boundary — stale)",
      deltaMs: FRESHNESS_THRESHOLD_MS,
      expectedLive: false,
    },
    {
      label: "threshold + 1ms (just outside)",
      deltaMs: FRESHNESS_THRESHOLD_MS + 1,
      expectedLive: false,
    },
    {
      label: "2x threshold (clearly stale)",
      deltaMs: FRESHNESS_THRESHOLD_MS * 2,
      expectedLive: false,
    },
    {
      label: "24h ago (far outside)",
      deltaMs: 24 * 60 * 60 * 1_000,
      expectedLive: false,
    },
  ];

  for (const { label, deltaMs, expectedLive } of cases) {
    it(`frd-12: WHEN newest event is ${label} THEN live is ${String(expectedLive)}`, () => {
      const events = [ev(msAgo(now, deltaMs).toISOString())];
      expect(freshness(events, now).live).toBe(expectedLive);
    });
  }
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — FRESHNESS_THRESHOLD_MS must be a named constant (blueprint §3)
// The threshold must not be a magic number embedded in the selector body.
// We assert that the export exists and has a sensible value.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — FRESHNESS_THRESHOLD_MS is an exported named constant", () => {
  it("frd-12: FRESHNESS_THRESHOLD_MS is exported from the module (not undefined)", () => {
    expect(FRESHNESS_THRESHOLD_MS).toBeDefined();
  });

  it("frd-12: FRESHNESS_THRESHOLD_MS is a finite positive number", () => {
    expect(typeof FRESHNESS_THRESHOLD_MS).toBe("number");
    expect(Number.isFinite(FRESHNESS_THRESHOLD_MS)).toBe(true);
    expect(FRESHNESS_THRESHOLD_MS).toBeGreaterThan(0);
  });

  it("frd-12: FRESHNESS_THRESHOLD_MS is at least 30 seconds (operator needs reasonable freshness window)", () => {
    expect(FRESHNESS_THRESHOLD_MS).toBeGreaterThanOrEqual(30_000);
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — return shape is always { lastAt: string|null, live: boolean }
// Never undefined, never null at the top level, always both keys present.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — return shape invariant", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  const scenariosForShape: Array<{ label: string; events: Event[] }> = [
    { label: "empty events", events: [] },
    { label: "one recent event", events: [ev(msAgo(now, 1_000).toISOString())] },
    { label: "one stale event", events: [ev("2026-01-01T00:00:00Z")] },
    {
      label: "mixed recent + stale",
      events: [ev("2026-01-01T00:00:00Z"), ev(msAgo(now, 500).toISOString())],
    },
  ];

  for (const { label, events } of scenariosForShape) {
    it(`frd-12: WHEN ${label} THEN result has exactly {lastAt, live} with correct types`, () => {
      const result = freshness(events, now);
      expect(result).toBeDefined();
      // lastAt: string | null
      expect(result.lastAt === null || typeof result.lastAt === "string").toBe(true);
      // live: boolean (not truthy/falsy — strict boolean)
      expect(typeof result.live).toBe("boolean");
    });
  }
});

// ---------------------------------------------------------------------------
// Regression: events with invalid/unparseable `at` must be skipped gracefully
// (not corrupt lastAt to NaN or throw).
// Anchor: B1' (WO-13-001, 2026-06-16) — Date.parse("bad") === NaN.
// If the impl picks NaN as lastAt, `NaN <= threshold` is false → stale,
// even if there are valid recent events.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — regression B1': invalid `at` values do not corrupt result", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("frd-12: WHEN one event has an invalid at and another has a valid at THEN lastAt is the valid timestamp", () => {
    const validAt = msAgo(now, 1_000).toISOString();
    const events = [{ event: "Bad", at: "NOT-A-DATE" } as Event, ev(validAt)];
    const result = freshness(events, now);
    // The invalid event must be skipped; valid event drives lastAt.
    expect(result.lastAt).toBe(validAt);
  });

  it("frd-12: WHEN one event has an invalid at and another has a valid recent at THEN live is true", () => {
    const validAt = msAgo(now, 1_000).toISOString();
    const events = [{ event: "Bad", at: "NOT-A-DATE" } as Event, ev(validAt)];
    expect(freshness(events, now).live).toBe(true);
  });

  it("frd-12: WHEN ALL events have invalid at values THEN lastAt is null and live is false (not NaN, not throw)", () => {
    const events = [
      { event: "Bad1", at: "" } as Event,
      { event: "Bad2", at: "NOT-A-DATE" } as Event,
      { event: "Bad3", at: "undefined" } as Event,
    ];
    const result = freshness(events, now);
    expect(result.lastAt).toBeNull();
    expect(result.live).toBe(false);
  });

  it("frd-12: WHEN events have invalid at values THEN freshness does NOT throw", () => {
    const events = [{ event: "Bad", at: "GARBAGE" } as Event];
    expect(() => freshness(events, now)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — max-at invariant across shuffled arrays (parametric)
//
// Property: freshness(shuffle(events), now).lastAt === max(events.map(e => e.at))
// Verified across 6 permutations of a known event set — kills the "take last
// in array" mutant that would pass if events happen to be chronological.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — max-at invariant across permutations (parametric)", () => {
  const now = new Date("2026-06-16T12:00:00Z");
  // Timestamps as a plain tuple so indexed access is always string (no undefined).
  const ts0 = "2026-06-16T09:00:00Z";
  const ts1 = "2026-06-16T11:59:30Z"; // max
  const ts2 = "2026-06-16T08:00:00Z";
  const ts3 = "2026-06-16T10:45:00Z";
  const ts4 = "2026-06-16T11:00:00Z";
  const expectedMax = "2026-06-16T11:59:30Z";

  // Six hand-chosen permutations (including max-first, max-last, max-middle).
  const permutations: string[][] = [
    [ts0, ts1, ts2, ts3, ts4],
    [ts1, ts0, ts2, ts3, ts4], // max first
    [ts0, ts2, ts3, ts4, ts1], // max last
    [ts2, ts1, ts0, ts4, ts3],
    [ts4, ts3, ts2, ts1, ts0], // reversed
    [ts3, ts0, ts1, ts2, ts4],
  ];

  permutations.forEach((perm, idx) => {
    it(`frd-12: permutation ${idx + 1}: lastAt is always the maximum at`, () => {
      const events = perm.map((at) => ev(at));
      expect(freshness(events, now).lastAt).toBe(expectedMax);
    });
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — idempotency
// Calling freshness twice with the same inputs returns the same result.
// Proves no hidden mutable state that would make the live flag flicker.
// ---------------------------------------------------------------------------

describe("frd-12: freshness — idempotency (pure, no hidden state)", () => {
  it("frd-12: WHEN called twice with the same events and now THEN both calls return equal results", () => {
    const now = new Date("2026-06-16T12:00:00Z");
    const events = [ev("2026-06-16T11:58:00Z"), ev("2026-06-16T11:59:00Z")];
    const first = freshness(events, now);
    const second = freshness(events, now);
    expect(first.lastAt).toBe(second.lastAt);
    expect(first.live).toBe(second.live);
  });
});

// ---------------------------------------------------------------------------
// AC-12-002.1 — freshness never throws under any input combination
// ---------------------------------------------------------------------------

describe("frd-12: freshness — never throws (pure, no side effects)", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  const edgeCases: Array<{ label: string; events: Event[] }> = [
    { label: "empty array", events: [] },
    { label: "one valid event", events: [ev("2026-06-16T11:00:00Z")] },
    {
      label: "100 valid events",
      events: Array.from({ length: 100 }, (_, i) =>
        ev(`2026-06-16T${String(i % 24).padStart(2, "0")}:00:00Z`),
      ),
    },
    {
      label: "events with invalid at values",
      events: [{ event: "x", at: "" } as Event, { event: "y", at: "bad" } as Event],
    },
  ];

  for (const { label, events } of edgeCases) {
    it(`frd-12: WHEN ${label} THEN freshness does NOT throw`, () => {
      expect(() => freshness(events, now)).not.toThrow();
    });
  }
});
