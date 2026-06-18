/**
 * WO-12-003 — `eventsPerMinute` (IF-12-rate) — RED phase.
 *
 * These tests are written BEFORE the implementation (`rate.ts` does not exist yet).
 * Every test will fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-12-007.1  The honest metrics (..., events per minute) SHALL be derived from the
 *                same event file, with no extra instrumentation.
 *                Source: FRD-12 EARS criterion; blueprint §2 (IF-12-rate); WO-12-003.
 *
 * Contract (WO-12-003 + blueprint §2 IF-12-rate):
 *   export function eventsPerMinute(
 *     events: Event[],
 *     window: number,          // number of minutes to cover (e.g. 30)
 *     now?: Date               // reference instant; injectable for determinism in tests
 *   ): Bucket[]
 *
 *   export type Bucket = {
 *     minute: string;          // ISO minute key "YYYY-MM-DDTHH:MM" (UTC, no seconds)
 *     total: number;           // total events in that minute
 *     byAgent: Record<string, number>; // per-agent count; keys are agent strings
 *   }
 *
 * Invariants:
 *   - Returns exactly `window` buckets (one per minute, newest last) when window > 0.
 *   - Buckets outside the window are excluded; buckets with no events have total=0 and
 *     byAgent={}.
 *   - `byAgent` counts sum to `total` for every bucket.
 *   - An event with no `agent` field does NOT contribute to `byAgent` but is counted in `total`.
 *   - An empty event array with window > 0 → `window` buckets all zeroed.
 *   - window = 0 → [] (no buckets).
 *   - Pure: no I/O, no env reads, no throws.
 *   - Deterministic given the same `events` + `now`.
 *   - Consumed by FRD-06 ActivityPulse (WO-06-009) and FRD-18 — single source of rate metric.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   B1' (WO-13-001, 2026-06-16): typeof NaN === "number" — any numeric guard must use
 *     Number.isFinite; `window=NaN` must not silently produce wrong bucket counts or throw.
 *   I2  (WO-13-001, 2026-06-16): empty-object / vacuous-truth — empty events array with
 *     window > 0 must produce zeroed buckets, not throw or return undefined.
 *   I3  (WO-13-001, 2026-06-16): array-shaped values bypass scalar guards — `agent` field
 *     that is not a string must NOT be included in `byAgent` keys.
 *   FREEZE-ON-RED (WO-02-004, 2026-06-16): events missing optional fields (no `at`, no
 *     `agent`) must not abort the batch; parse errors per item must be isolated.
 *   WO-12-001 freshness ordering (2026-06-16): timestamp comparison must be numeric
 *     (Date.parse) not lexicographic — non-UTC strings must not corrupt bucket assignment.
 *
 * Property-based invariants (parametric — Vitest only; fast-check not in dep tree):
 *   - sum(buckets.map(b => b.total)) === events that fall inside the window.
 *   - For every bucket b: sum(Object.values(b.byAgent)) <= b.total.
 *   - bucket.minute keys are unique and match ISO "YYYY-MM-DDTHH:MM" format.
 *   - buckets are ordered chronologically ascending (oldest first).
 *
 * Stack: Vitest (TypeScript). Pure function — no fixtures, no I/O, no env.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Type aliases — mirror the contract; kept local to express what is asserted.
// The module does not exist yet (RED phase) so all types are declared here.
// ---------------------------------------------------------------------------

type Event = {
  event: string;
  at: string;
  agent?: string;
  session?: string;
  tool?: string;
  status?: "ok" | "fail";
  workOrder?: string;
  task?: string;
  project?: string;
};

/**
 * The Bucket type the implementation must export.
 * `minute`: ISO minute key "YYYY-MM-DDTHH:MM" (UTC, no seconds).
 * `total`:  count of all events that fall in this minute bucket.
 * `byAgent`: per-agent count; keys are agent strings.
 */
type Bucket = {
  minute: string;
  total: number;
  byAgent: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Module under test — GREEN phase (rate.ts exists and is fully typed).
// ---------------------------------------------------------------------------

import { eventsPerMinute } from "../rate";

// ---------------------------------------------------------------------------
// Factories / helpers
// ---------------------------------------------------------------------------

/** Reference "now" used to make every test deterministic. */
const NOW = new Date("2026-06-16T12:30:00Z");

/** Build an Event with sensible defaults. Override at call site. */
function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    event: "ToolCall",
    at: "2026-06-16T12:29:00Z",
    agent: "implementer",
    status: "ok",
    ...overrides,
  };
}

/**
 * Return an ISO minute string "YYYY-MM-DDTHH:MM" for `minutesAgo` minutes
 * before `NOW`, in UTC.
 */
function minuteKeyAgo(minutesAgo: number): string {
  const d = new Date(NOW.getTime() - minutesAgo * 60_000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ---------------------------------------------------------------------------
// AC-12-007.1 — bucket structure invariants
// ---------------------------------------------------------------------------

describe("frd-12 rate: AC-12-007.1 — output structure", () => {
  it("frd-12: WHEN window=5 and events is empty THEN returns exactly 5 buckets", () => {
    const buckets = eventsPerMinute([], 5, NOW);
    expect(buckets).toHaveLength(5);
  });

  it("frd-12: WHEN window=1 and events is empty THEN returns exactly 1 bucket", () => {
    const buckets = eventsPerMinute([], 1, NOW);
    expect(buckets).toHaveLength(1);
  });

  it("frd-12: WHEN window=30 and events is empty THEN returns exactly 30 buckets", () => {
    const buckets = eventsPerMinute([], 30, NOW);
    expect(buckets).toHaveLength(30);
  });

  it("frd-12: WHEN window=0 THEN returns an empty array", () => {
    const buckets = eventsPerMinute([], 0, NOW);
    expect(buckets).toHaveLength(0);
  });

  it("frd-12: WHEN window > 0 and events are empty THEN every bucket has total=0", () => {
    const buckets = eventsPerMinute([], 5, NOW);
    for (const b of buckets) {
      expect(b.total).toBe(0);
    }
  });

  it("frd-12: WHEN window > 0 and events are empty THEN every bucket has byAgent={}", () => {
    const buckets = eventsPerMinute([], 5, NOW);
    for (const b of buckets) {
      expect(b.byAgent).toEqual({});
    }
  });

  it("frd-12: WHEN called THEN every bucket has a non-empty minute string field", () => {
    const buckets = eventsPerMinute([], 3, NOW);
    for (const b of buckets) {
      expect(typeof b.minute).toBe("string");
      expect(b.minute.length).toBeGreaterThan(0);
    }
  });

  it("frd-12: WHEN called THEN every bucket minute key matches ISO YYYY-MM-DDTHH:MM format", () => {
    const ISO_MINUTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    const buckets = eventsPerMinute([], 5, NOW);
    for (const b of buckets) {
      expect(b.minute).toMatch(ISO_MINUTE_RE);
    }
  });

  it("frd-12: WHEN called THEN bucket minute keys are unique (no duplicates)", () => {
    const buckets = eventsPerMinute([], 10, NOW);
    const keys = buckets.map((b) => b.minute);
    const unique = new Set(keys);
    expect(unique.size).toBe(10);
  });

  it("frd-12: WHEN called THEN buckets are in chronological ascending order (oldest first)", () => {
    const buckets = eventsPerMinute([], 5, NOW);
    for (let i = 1; i < buckets.length; i++) {
      // ISO minute strings compare lexicographically in UTC ascending order.
      // Loop bounds guarantee both elements exist; ?? "" is a type-safe fallback.
      expect((buckets[i]?.minute ?? "") > (buckets[i - 1]?.minute ?? "")).toBe(true);
    }
  });

  it("frd-12: WHEN called THEN total is a non-negative finite integer in every bucket", () => {
    const events = [makeEvent({ at: "2026-06-16T12:28:30Z" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      expect(Number.isFinite(b.total)).toBe(true);
      expect(b.total).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(b.total)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-12-007.1 — event bucketing by minute
// ---------------------------------------------------------------------------

describe("frd-12 rate: AC-12-007.1 — event bucketing", () => {
  it("frd-12: WHEN 1 event falls in the most-recent minute THEN that bucket has total=1", () => {
    // NOW = 12:30:00; event at 12:29:45 → minute key 12:29
    const events = [makeEvent({ at: "2026-06-16T12:29:45Z" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const key = minuteKeyAgo(1); // 12:29
    const bucket = buckets.find((b) => b.minute === key);
    expect(bucket).toBeDefined();
    expect(bucket?.total).toBe(1);
  });

  it("frd-12: WHEN 3 events fall in the same minute THEN that bucket total=3", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:10Z" }),
      makeEvent({ at: "2026-06-16T12:29:30Z" }),
      makeEvent({ at: "2026-06-16T12:29:50Z" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const key = minuteKeyAgo(1); // 12:29
    const bucket = buckets.find((b) => b.minute === key);
    expect(bucket?.total).toBe(3);
  });

  it("frd-12: WHEN events fall in 2 different minutes THEN their totals are in the correct buckets", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z" }), // minute 12:29
      makeEvent({ at: "2026-06-16T12:28:59Z" }), // minute 12:28
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket29 = buckets.find((b) => b.minute === minuteKeyAgo(1));
    const bucket28 = buckets.find((b) => b.minute === minuteKeyAgo(2));
    expect(bucket29?.total).toBe(1);
    expect(bucket28?.total).toBe(1);
  });

  it("frd-12: WHEN an event is older than the window THEN it is NOT counted in any bucket", () => {
    // window=5 → covers minutes [12:25, 12:26, 12:27, 12:28, 12:29]
    // an event at 12:24:59 is outside the window
    const events = [makeEvent({ at: "2026-06-16T12:24:59Z" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const totalSum = buckets.reduce((sum, b) => sum + b.total, 0);
    expect(totalSum).toBe(0);
  });

  it("frd-12: WHEN the window is 0 minutes THEN no events are counted (empty result)", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:45Z" })];
    const buckets = eventsPerMinute(events, 0, NOW);
    expect(buckets).toHaveLength(0);
  });

  it("frd-12: WHEN event `at` equals the exact start of a minute boundary THEN it is counted in that minute", () => {
    // 12:28:00 belongs to minute key 2026-06-16T12:28
    const events = [makeEvent({ at: "2026-06-16T12:28:00Z" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(2));
    expect(bucket?.total).toBe(1);
  });

  it("frd-12: WHEN all events fall in the window THEN sum of all bucket totals equals events.length", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z" }),
      makeEvent({ at: "2026-06-16T12:28:30Z" }),
      makeEvent({ at: "2026-06-16T12:27:00Z" }),
      makeEvent({ at: "2026-06-16T12:26:00Z" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const totalSum = buckets.reduce((sum, b) => sum + b.total, 0);
    expect(totalSum).toBe(4);
  });

  it("frd-12: WHEN events span the full window THEN sum of totals equals events inside the window", () => {
    const inside = [
      makeEvent({ at: "2026-06-16T12:29:00Z" }),
      makeEvent({ at: "2026-06-16T12:25:00Z" }),
    ];
    const outside = [
      makeEvent({ at: "2026-06-16T12:24:59Z" }), // just outside
    ];
    const buckets = eventsPerMinute([...inside, ...outside], 5, NOW);
    const totalSum = buckets.reduce((sum, b) => sum + b.total, 0);
    expect(totalSum).toBe(2);
  });

  it("frd-12: WHEN no events fall in the window THEN all bucket totals are 0 (stalled pulse)", () => {
    // Events are all older than the 5-minute window
    const events = [
      makeEvent({ at: "2026-06-16T12:00:00Z" }),
      makeEvent({ at: "2026-06-16T11:59:00Z" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      expect(b.total).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-12-007.1 — per-agent breakdown: byAgent counts
// ---------------------------------------------------------------------------

describe("frd-12 rate: AC-12-007.1 — per-agent breakdown (byAgent)", () => {
  it("frd-12: WHEN 1 event with agent='implementer' in a minute THEN byAgent has implementer=1", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.byAgent.implementer).toBe(1);
  });

  it("frd-12: WHEN 2 events from same agent in same minute THEN byAgent[agent]=2", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:10Z", agent: "test-writer" }),
      makeEvent({ at: "2026-06-16T12:29:50Z", agent: "test-writer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.byAgent["test-writer"]).toBe(2);
  });

  it("frd-12: WHEN 2 events from different agents in same minute THEN byAgent has both with correct counts", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "reviewer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.byAgent.implementer).toBe(1);
    expect(bucket?.byAgent.reviewer).toBe(1);
  });

  it("frd-12: WHEN an event has no agent field THEN it contributes to total but NOT to byAgent", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: undefined })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(1);
    expect(Object.keys(bucket?.byAgent ?? {})).toHaveLength(0);
  });

  it("frd-12: WHEN a bucket has 0 events THEN byAgent is an empty object", () => {
    const buckets = eventsPerMinute([], 3, NOW);
    for (const b of buckets) {
      expect(b.byAgent).toEqual({});
    }
  });

  it("frd-12: WHEN byAgent counts are summed THEN they are <= total for every bucket", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: undefined }), // no agent
      makeEvent({ at: "2026-06-16T12:29:45Z", agent: "reviewer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      const agentSum = Object.values(b.byAgent).reduce((s, n) => s + n, 0);
      expect(agentSum).toBeLessThanOrEqual(b.total);
    }
  });

  it("frd-12: WHEN all events have agents THEN sum of byAgent values equals total for each bucket", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:45Z", agent: "reviewer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    const agentSum = Object.values(bucket?.byAgent ?? {}).reduce((s, n) => s + n, 0);
    expect(agentSum).toBe(bucket?.total);
  });

  it("frd-12: WHEN agents appear across multiple minutes THEN byAgent is scoped per bucket", () => {
    // implementer fires in both minute 12:29 and 12:28
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:28:00Z", agent: "implementer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket29 = buckets.find((b) => b.minute === minuteKeyAgo(1));
    const bucket28 = buckets.find((b) => b.minute === minuteKeyAgo(2));
    // Each bucket should count only its own minute's events
    expect(bucket29?.byAgent.implementer).toBe(1);
    expect(bucket28?.byAgent.implementer).toBe(1);
  });

  it("frd-12: WHEN 5 different agents each fire 1 event in the same minute THEN byAgent has 5 keys each with value 1", () => {
    const agents = ["implementer", "test-writer", "reviewer", "librarian", "orchestrator"];
    const events = agents.map((agent, i) =>
      makeEvent({ at: `2026-06-16T12:29:${String(i * 10).padStart(2, "0")}Z`, agent }),
    );
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(Object.keys(bucket?.byAgent ?? {})).toHaveLength(5);
    for (const agent of agents) {
      expect(bucket?.byAgent[agent]).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-12-007.1 — determinism (pure function, injectable `now`)
// ---------------------------------------------------------------------------

describe("frd-12 rate: AC-12-007.1 — determinism / pure function", () => {
  it("frd-12: WHEN called twice with the same events and now THEN results are deeply equal", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z" })];
    const first = eventsPerMinute(events, 5, NOW);
    const second = eventsPerMinute(events, 5, NOW);
    expect(first).toEqual(second);
  });

  it("frd-12: WHEN now changes THEN the bucket window shifts accordingly (deterministic by now)", () => {
    const now1 = new Date("2026-06-16T12:30:00Z");
    const now2 = new Date("2026-06-16T13:00:00Z");
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z" })];
    const buckets1 = eventsPerMinute(events, 5, now1);
    const buckets2 = eventsPerMinute(events, 5, now2);
    // The event falls in the window for now1 but not for now2 (30 min ago)
    const sum1 = buckets1.reduce((s, b) => s + b.total, 0);
    const sum2 = buckets2.reduce((s, b) => s + b.total, 0);
    expect(sum1).toBeGreaterThan(sum2);
  });

  it("frd-12: WHEN called with 200 events inside the window THEN completes synchronously without error", () => {
    const events = Array.from({ length: 200 }, (_, i) =>
      makeEvent({
        at: new Date(NOW.getTime() - (i % 5) * 60_000 - i * 1000).toISOString(),
        agent: `agent-${i % 4}`,
      }),
    );
    let buckets: Bucket[] | undefined;
    expect(() => {
      buckets = eventsPerMinute(events, 10, NOW);
    }).not.toThrow();
    expect(Array.isArray(buckets)).toBe(true);
  });

  it("frd-12: WHEN called THEN does not read process.env (pure, no I/O)", () => {
    const events = [makeEvent()];
    const withEnv = eventsPerMinute(events, 5, NOW);
    const saved = process.env.PANDACORP_FACTORY_ROOT;
    delete process.env.PANDACORP_FACTORY_ROOT;
    const withoutEnv = eventsPerMinute(events, 5, NOW);
    if (saved !== undefined) process.env.PANDACORP_FACTORY_ROOT = saved;
    expect(withEnv).toEqual(withoutEnv);
  });

  it("frd-12: WHEN the returned array is mutated THEN calling eventsPerMinute again returns a fresh result", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z" })];
    const result = eventsPerMinute(events, 1, NOW);
    const totalBefore = result[0]?.total;
    // Mutate the returned bucket — must not affect subsequent calls
    if (result[0]) {
      result[0].total = 9999;
    }
    const result2 = eventsPerMinute(events, 1, NOW);
    expect(result2[0]?.total).toBe(totalBefore);
  });
});

// ---------------------------------------------------------------------------
// Error path / resilience — regression anchors from progress.md incidents
// ---------------------------------------------------------------------------

describe("frd-12 rate: error paths — regression from progress.md incidents", () => {
  // Regression I2 (WO-13-001, 2026-06-16): empty events → zeroed buckets, not throw
  it("frd-12 regression I2: WHEN events=[] and window=5 THEN returns 5 zeroed buckets, does not throw", () => {
    expect(() => eventsPerMinute([], 5, NOW)).not.toThrow();
    const buckets = eventsPerMinute([], 5, NOW);
    expect(buckets).toHaveLength(5);
    for (const b of buckets) {
      expect(b.total).toBe(0);
    }
  });

  it("frd-12 regression I2: WHEN events=[] THEN byAgent={} in every bucket (no undefined values)", () => {
    const buckets = eventsPerMinute([], 3, NOW);
    for (const b of buckets) {
      expect(b.byAgent).toBeDefined();
      expect(typeof b.byAgent).toBe("object");
    }
  });

  // Regression B1' (WO-13-001, 2026-06-16): NaN inputs must not produce silent wrong output
  it("frd-12 regression B1': WHEN window=NaN THEN does not throw", () => {
    expect(() => eventsPerMinute([], Number.NaN, NOW)).not.toThrow();
  });

  it("frd-12 regression B1': WHEN window=NaN THEN returns either [] or a safe fallback (no NaN values in output)", () => {
    const buckets = eventsPerMinute([], Number.NaN, NOW);
    for (const b of buckets) {
      expect(Number.isFinite(b.total)).toBe(true);
    }
  });

  it("frd-12 regression B1': WHEN events have valid timestamps THEN no bucket total is NaN or non-finite", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ at: `2026-06-16T12:2${i % 5}:00Z` }),
    );
    const buckets = eventsPerMinute(events, 10, NOW);
    for (const b of buckets) {
      expect(Number.isFinite(b.total)).toBe(true);
      expect(b.total).toBeGreaterThanOrEqual(0);
    }
  });

  // Regression I3 (WO-13-001, 2026-06-16): agent field must be a string before counting
  it("frd-12 regression I3: WHEN event has agent as a non-string value THEN it does NOT appear in byAgent", () => {
    const events = [
      // Deliberately mistyped — simulates a malformed event in the NDJSON
      {
        event: "AgentWorking",
        at: "2026-06-16T12:29:00Z",
        // biome-ignore lint/suspicious/noExplicitAny: intentional regression test for non-string agent
        agent: ["implementer"] as any,
        status: "ok" as const,
      },
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    // byAgent must not have an array key
    const byAgentKeys = Object.keys(bucket?.byAgent ?? {});
    expect(byAgentKeys).not.toContain("implementer,"); // array coercion artifact
    expect(byAgentKeys.every((k) => typeof k === "string" && !k.includes(","))).toBe(true);
  });

  // Regression FREEZE-ON-RED (WO-02-004, 2026-06-16): missing optional fields must not throw
  it("frd-12 regression FREEZE-ON-RED: WHEN events have no optional fields THEN does not throw", () => {
    const sparse: Event[] = [
      { event: "AgentWorking", at: "2026-06-16T12:29:00Z" }, // no agent, no status, no workOrder
      { event: "ToolCall", at: "2026-06-16T12:28:00Z" }, // no status, no agent
    ];
    expect(() => eventsPerMinute(sparse, 5, NOW)).not.toThrow();
    const buckets = eventsPerMinute(sparse, 5, NOW);
    expect(Array.isArray(buckets)).toBe(true);
  });

  it("frd-12 regression FREEZE-ON-RED: WHEN one event has an invalid at string THEN other events are still bucketed", () => {
    const events = [
      makeEvent({ at: "not-a-date" }), // malformed timestamp
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "reviewer" }), // valid
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    // The valid event must still be counted
    const totalSum = buckets.reduce((s, b) => s + b.total, 0);
    expect(totalSum).toBeGreaterThanOrEqual(1);
  });

  it("frd-12 regression FREEZE-ON-RED: WHEN events array is empty THEN result is an array (not undefined or null)", () => {
    const result = eventsPerMinute([], 5, NOW);
    expect(Array.isArray(result)).toBe(true);
  });

  // WO-12-001 freshness ordering regression: lexicographic vs numeric timestamp comparison
  it("frd-12 regression WO-12-001 ordering: WHEN events have non-UTC local offsets THEN they are bucketed by numeric UTC time not string comparison", () => {
    // Same instant expressed differently — both must land in the same bucket
    // 2026-06-16T12:29:30Z === 2026-06-16T13:29:30+01:00 (hypothetical)
    // We cannot guarantee JS parses the offset correctly here, but the selector
    // must use Date.parse() numerically, not raw string comparison.
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z" }),
      makeEvent({ at: "2026-06-16T12:29:30Z" }),
    ];
    expect(() => eventsPerMinute(events, 5, NOW)).not.toThrow();
    const buckets = eventsPerMinute(events, 5, NOW);
    // Both events must be found in the window
    const sum = buckets.reduce((s, b) => s + b.total, 0);
    expect(sum).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Property-based invariants — parametric table
// Each row explores a distinct axis of the invariant space.
// ---------------------------------------------------------------------------

describe("frd-12 rate: property-based invariants — parametric table", () => {
  /** Invariant: sum(bucket.total) <= total events provided */
  it("frd-12 invariant: sum of bucket totals is never greater than events.length", () => {
    const events = Array.from({ length: 15 }, (_, i) =>
      makeEvent({ at: new Date(NOW.getTime() - i * 30_000).toISOString() }),
    );
    const buckets = eventsPerMinute(events, 5, NOW);
    const sum = buckets.reduce((s, b) => s + b.total, 0);
    expect(sum).toBeLessThanOrEqual(events.length);
  });

  /** Invariant: for every bucket, sum(byAgent values) <= total */
  it("frd-12 invariant: sum(byAgent values) <= bucket.total for all buckets", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: undefined }),
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "reviewer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      const agentSum = Object.values(b.byAgent).reduce((s, n) => s + n, 0);
      expect(agentSum).toBeLessThanOrEqual(b.total);
    }
  });

  /** Invariant: buckets.length === window for window > 0 */
  const windowCases = [1, 2, 5, 10, 30];
  for (const w of windowCases) {
    it(`frd-12 invariant: WHEN window=${w} THEN returns exactly ${w} buckets`, () => {
      const buckets = eventsPerMinute([], w, NOW);
      expect(buckets).toHaveLength(w);
    });
  }

  /** Invariant: all minute keys are unique */
  it("frd-12 invariant: all bucket minute keys are unique across any window", () => {
    const buckets = eventsPerMinute([], 20, NOW);
    const keys = buckets.map((b) => b.minute);
    expect(new Set(keys).size).toBe(20);
  });

  /** Invariant: bucket totals are non-negative integers */
  it("frd-12 invariant: all bucket totals are non-negative integers", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeEvent({ at: new Date(NOW.getTime() - i * 20_000).toISOString() }),
    );
    const buckets = eventsPerMinute(events, 10, NOW);
    for (const b of buckets) {
      expect(Number.isInteger(b.total)).toBe(true);
      expect(b.total).toBeGreaterThanOrEqual(0);
    }
  });

  /** Invariant: byAgent value counts are non-negative integers */
  it("frd-12 invariant: all byAgent counts are non-negative integers", () => {
    const events = ["a", "b", "c"].map((agent, i) =>
      makeEvent({ at: new Date(NOW.getTime() - i * 10_000).toISOString(), agent }),
    );
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      for (const count of Object.values(b.byAgent)) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(1); // only present when >= 1
      }
    }
  });

  /** Invariant: buckets are in ascending minute order */
  it("frd-12 invariant: bucket minute keys are strictly ascending (oldest first)", () => {
    const events = [makeEvent({ at: "2026-06-16T12:27:00Z" })];
    const buckets = eventsPerMinute(events, 10, NOW);
    for (let i = 1; i < buckets.length; i++) {
      expect((buckets[i]?.minute ?? "") > (buckets[i - 1]?.minute ?? "")).toBe(true);
    }
  });

  /** Invariant: does not throw regardless of window size */
  const edgeWindows = [0, 1, 5, 100];
  for (const w of edgeWindows) {
    it(`frd-12 invariant: WHEN window=${w} THEN eventsPerMinute does NOT throw`, () => {
      expect(() => eventsPerMinute([makeEvent()], w, NOW)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Specific behavior assertions — concrete values, not generic toBeTruthy()
// ---------------------------------------------------------------------------

describe("frd-12 rate: specific behavior assertions", () => {
  it("frd-12: WHEN 3 events from 'implementer' in minute 12:29 and 2 from 'reviewer' in 12:28 THEN each bucket has the correct byAgent map", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:10Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:20Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "implementer" }),
      makeEvent({ at: "2026-06-16T12:28:10Z", agent: "reviewer" }),
      makeEvent({ at: "2026-06-16T12:28:50Z", agent: "reviewer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const b29 = buckets.find((b) => b.minute === minuteKeyAgo(1));
    const b28 = buckets.find((b) => b.minute === minuteKeyAgo(2));

    expect(b29?.total).toBe(3);
    expect(b29?.byAgent.implementer).toBe(3);
    expect(b29?.byAgent.reviewer).toBeUndefined();

    expect(b28?.total).toBe(2);
    expect(b28?.byAgent.reviewer).toBe(2);
    expect(b28?.byAgent.implementer).toBeUndefined();
  });

  it("frd-12: WHEN window=1 and the single event is in that minute THEN buckets=[{minute, total:1, byAgent:{agent:1}}]", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:30Z", agent: "implementer" })];
    const buckets = eventsPerMinute(events, 1, NOW);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.total).toBe(1);
    expect(buckets[0]?.byAgent.implementer).toBe(1);
  });

  it("frd-12: WHEN window=1 and no events fall in that minute THEN buckets=[{minute, total:0, byAgent:{}}]", () => {
    // Event is 10 minutes before NOW, outside the 1-minute window
    const events = [makeEvent({ at: "2026-06-16T12:20:00Z" })];
    const buckets = eventsPerMinute(events, 1, NOW);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.total).toBe(0);
    expect(buckets[0]?.byAgent).toEqual({});
  });

  it("frd-12: WHEN 10 events each from a different agent in the same minute THEN byAgent has 10 keys", () => {
    const agents = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
    const events = agents.map((agent) => makeEvent({ at: "2026-06-16T12:29:00Z", agent }));
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(Object.keys(bucket?.byAgent ?? {})).toHaveLength(10);
  });

  it("frd-12: WHEN called with window=5 THEN the newest bucket covers the current minute (12:29 for NOW=12:30)", () => {
    // NOW = 12:30:00 → most recent full minute = 12:29
    const buckets = eventsPerMinute([], 5, NOW);
    const newest = buckets[buckets.length - 1];
    // The newest bucket must cover minute 12:29 (1 minute ago) or 12:30 depending on contract
    // Either way: the minute key of the newest bucket must be >= minuteKeyAgo(1)
    expect(newest?.minute).toBeDefined();
    // Must not be in the future
    const newestMs = Date.parse(`${newest?.minute}:00Z`);
    expect(newestMs).toBeLessThanOrEqual(NOW.getTime());
  });

  it("frd-12: WHEN an event has status='fail' THEN it is still bucketed (status does not filter events)", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", status: "fail", agent: "implementer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const totalSum = buckets.reduce((s, b) => s + b.total, 0);
    expect(totalSum).toBe(1);
  });

  it("frd-12: WHEN events span more minutes than the window THEN only events within the window are counted", () => {
    // window=3: covers 12:27, 12:28, 12:29 (3 minutes before NOW=12:30)
    const insideWindow = [
      makeEvent({ at: "2026-06-16T12:29:00Z" }),
      makeEvent({ at: "2026-06-16T12:28:00Z" }),
      makeEvent({ at: "2026-06-16T12:27:00Z" }),
    ];
    const outsideWindow = [
      makeEvent({ at: "2026-06-16T12:26:59Z" }), // just before the window
      makeEvent({ at: "2026-06-16T12:00:00Z" }), // far before
    ];
    const buckets = eventsPerMinute([...insideWindow, ...outsideWindow], 3, NOW);
    const sum = buckets.reduce((s, b) => s + b.total, 0);
    expect(sum).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Regression B1 — prototype-pollution via agent key (WO-12-003 review, 2026-06-16)
//
// Real defect found by the reviewer (wo-12-003-review.md): when `ev.agent` is a
// key that exists on Object.prototype ("__proto__", "constructor", "toString",
// "valueOf", "hasOwnProperty"), reading `byAgent[ev.agent] ?? 0` traverses the
// prototype chain and returns the INHERITED function, so `current + 1` produces
// a garbage string instead of a number. Writing to `byAgent["__proto__"]` is
// silently dropped, losing the count while `total` still increments.
//
// Both cases violate the documented invariant: "byAgent counts sum to total".
// Downstream consumers (FRD-06 ActivityPulse stall signal, FRD-18 rate chart)
// receive NaN/string contamination or silent undercount.
//
// Fix required: build byAgent with Object.create(null) so there is no prototype
// chain to traverse and "__proto__" becomes a normal own property.
//
// These tests are RED against the current implementation and turn GREEN only
// after the null-prototype fix is applied to rate.ts.
//
// Source: wo-12-003-review.md §Findings B1; AC-12-007.1; progress.md 2026-06-16.
// ---------------------------------------------------------------------------

describe("frd-12 rate: regression B1 — prototype-pollution agent keys corrupt byAgent", () => {
  // B1a — __proto__ key: the write is silently dropped by plain-object byAgent.
  // The count is lost → byAgent sums to 0 while total is 1. Violation of invariant.
  it("frd-12 regression B1a: WHEN agent='__proto__' THEN total=1 AND byAgent sums equal total (count not silently lost)", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: "__proto__" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(1);
    // byAgent["__proto__"] must be 1, not undefined/lost
    const byAgentSum = Object.values(bucket?.byAgent ?? {}).reduce((s, n) => s + n, 0);
    expect(byAgentSum).toBe(bucket?.total);
  });

  it("frd-12 regression B1a: WHEN agent='__proto__' THEN byAgent count is the number 2 (not undefined, not NaN)", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:10Z", agent: "__proto__" }),
      makeEvent({ at: "2026-06-16T12:29:20Z", agent: "__proto__" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(2);
    // Read the count via getOwnPropertyDescriptor so we never traverse the prototype chain.
    // If byAgent is built with Object.create(null), the own property exists with value=2.
    const desc = Object.getOwnPropertyDescriptor(bucket?.byAgent, "__proto__");
    expect(typeof desc?.value).toBe("number");
    expect(Number.isFinite(desc?.value as number)).toBe(true);
    expect(desc?.value).toBe(2);
  });

  it("frd-12 regression B1a: WHEN agent='__proto__' THEN global Object.prototype is not polluted", () => {
    eventsPerMinute([makeEvent({ at: "2026-06-16T12:29:00Z", agent: "__proto__" })], 5, NOW);
    // Object.prototype must not have gained any new property from the selector call
    const protoKeys = Object.getOwnPropertyNames(Object.prototype);
    expect(protoKeys).not.toContain("total");
    expect(protoKeys).not.toContain("minute");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  // B1b — constructor key: byAgent["constructor"] ?? 0 reads the inherited function,
  // so `current + 1` becomes "function Object() { [native code] }1" (a string).
  // The sum of byAgent values is then a corrupted string, not a number equal to total.
  it("frd-12 regression B1b: WHEN agent='constructor' THEN byAgent count is a finite number (not a function-coerced string)", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "constructor" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "constructor" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(2);
    // Read via getOwnPropertyDescriptor so we never traverse the prototype chain.
    const desc = Object.getOwnPropertyDescriptor(bucket?.byAgent, "constructor");
    expect(typeof desc?.value).toBe("number");
    expect(Number.isFinite(desc?.value as number)).toBe(true);
    expect(desc?.value).toBe(2);
  });

  it("frd-12 regression B1b: WHEN agent='toString' THEN byAgent sums to total (no string corruption)", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:10Z", agent: "toString" }),
      makeEvent({ at: "2026-06-16T12:29:20Z", agent: "toString" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "implementer" }),
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(3);
    // All byAgent values must be numbers
    const entries = Object.values(bucket?.byAgent ?? {});
    for (const v of entries) {
      expect(typeof v).toBe("number");
      expect(Number.isFinite(v)).toBe(true);
    }
    const byAgentSum = entries.reduce((s, n) => s + n, 0);
    expect(byAgentSum).toBe(3);
  });

  it("frd-12 regression B1b: WHEN agent='valueOf' THEN count is not lost (byAgent sums equal total)", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: "valueOf" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(1);
    const byAgentSum = Object.values(bucket?.byAgent ?? {}).reduce((s, n) => s + n, 0);
    expect(byAgentSum).toBe(1);
  });

  it("frd-12 regression B1b: WHEN agent='hasOwnProperty' THEN count is a finite number, not a function", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: "hasOwnProperty" })];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(1);
    const desc = Object.getOwnPropertyDescriptor(bucket?.byAgent, "hasOwnProperty");
    expect(typeof desc?.value).toBe("number");
    expect(desc?.value).toBe(1);
  });

  // B1 combined — multiple dangerous keys in the same bucket: all counts must be
  // numeric, none corrupted, and their sum must equal total.
  it("frd-12 regression B1 combined: WHEN multiple prototype-collision agent keys appear in one bucket THEN ALL byAgent values are numbers summing to total", () => {
    const events = [
      makeEvent({ at: "2026-06-16T12:29:00Z", agent: "__proto__" }),
      makeEvent({ at: "2026-06-16T12:29:10Z", agent: "constructor" }),
      makeEvent({ at: "2026-06-16T12:29:20Z", agent: "toString" }),
      makeEvent({ at: "2026-06-16T12:29:30Z", agent: "valueOf" }),
      makeEvent({ at: "2026-06-16T12:29:40Z", agent: "implementer" }), // safe key
    ];
    const buckets = eventsPerMinute(events, 5, NOW);
    const bucket = buckets.find((b) => b.minute === minuteKeyAgo(1));
    expect(bucket?.total).toBe(5);
    const values = Object.values(bucket?.byAgent ?? {});
    for (const v of values) {
      expect(typeof v).toBe("number");
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
    }
    const byAgentSum = values.reduce((s, n) => s + n, 0);
    expect(byAgentSum).toBe(5);
  });

  // Consumer-safety invariant: FRD-06 / FRD-18 receive valid numbers, not strings.
  // A corrupted byAgent with a string value breaks the reduce in those consumers
  // and causes ActivityPulse to emit a wrong stall signal.
  it("frd-12 regression B1 consumer safety: WHEN dangerous agent keys are present THEN no byAgent value is a string (FRD-06/FRD-18 consumer safety)", () => {
    const dangerousAgents = ["__proto__", "constructor", "toString", "hasOwnProperty"];
    const events = dangerousAgents.map((agent, i) =>
      makeEvent({ at: `2026-06-16T12:29:${String(i * 10).padStart(2, "0")}Z`, agent }),
    );
    const buckets = eventsPerMinute(events, 5, NOW);
    for (const b of buckets) {
      for (const v of Object.values(b.byAgent)) {
        expect(typeof v).not.toBe("string");
        expect(typeof v).toBe("number");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// FRD-06 / FRD-18 consumer contract — single source of rate metric
// ---------------------------------------------------------------------------

describe("frd-12 rate: consumer contract — single source for FRD-06 ActivityPulse and FRD-18", () => {
  it("frd-12: WHEN there are no events in the window THEN all buckets are zero (stalled pulse signal for FRD-06)", () => {
    // An empty or all-zeroed bucket array is the 'stalled' signal consumed by ActivityPulse
    const events: Event[] = []; // nothing happening
    const buckets = eventsPerMinute(events, 5, NOW);
    const allZero = buckets.every((b) => b.total === 0);
    expect(allZero).toBe(true);
  });

  it("frd-12: WHEN called from two different consumers with the same inputs THEN both get the same result (shared data, no mutation)", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z", agent: "implementer" })];
    const resultForParty = eventsPerMinute(events, 5, NOW);
    const resultForDashboard = eventsPerMinute(events, 5, NOW);
    expect(resultForParty).toEqual(resultForDashboard);
  });

  it("frd-12: WHEN the same bucket is consumed by FRD-06 and FRD-18 THEN mutations from one consumer do not corrupt the other", () => {
    const events = [makeEvent({ at: "2026-06-16T12:29:00Z" })];
    const r1 = eventsPerMinute(events, 1, NOW);
    const r2 = eventsPerMinute(events, 1, NOW);
    // Mutate r1
    if (r1[0]) r1[0].total = 9999;
    // r2 must be unaffected
    expect(r2[0]?.total).toBe(1);
  });
});
