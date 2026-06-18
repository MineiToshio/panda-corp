/**
 * WO-12-003 — `eventsPerMinute` (IF-12-rate) — ADVERSARIAL review tests (DR-015).
 *
 * Written by the reviewer (a DIFFERENT model from the implementer) to probe edge
 * cases, abuse and boundary behaviours the implementer did NOT cover in
 * rate.test.ts. Derived from the EARS criterion (AC-12-007.1), the contract in
 * the WO, and the real incidents in .pandacorp/comms/progress.md.
 *
 * Targets (NONE of these appear in rate.test.ts):
 *   A1 — prototype-pollution agent keys ("__proto__", "constructor", "toString").
 *   A2 — fractional window (5.9 → trunc 5) and negative-zero window.
 *   A3 — huge window must still be deterministic/finite (perf/DoS surface).
 *   A4 — future events (at > now) must NOT be counted.
 *   A5 — the in-progress minute (== now's minute) is excluded (the WO defines
 *        the newest bucket as the last *completed* minute).
 *   A6 — the injected `now` Date must not be mutated by the selector (purity).
 *   A7 — agent="" (empty string) does not become a byAgent key.
 *   A8 — whitespace / case-distinct agent strings are distinct keys (no coercion).
 *   A9 — events array passed in must not be mutated.
 *
 * Traceability: AC-12-007.1 → REQ-12-007 → IF-12-rate → WO-12-003.
 */

import { describe, expect, it } from "vitest";
import { type Bucket, eventsPerMinute } from "./rate";

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

const NOW = new Date("2026-06-16T12:30:00Z");

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    event: "ToolCall",
    at: "2026-06-16T12:29:00Z",
    agent: "implementer",
    status: "ok",
    ...overrides,
  };
}

/** Sum of all bucket totals. */
function sumTotals(buckets: Bucket[]): number {
  return buckets.reduce((acc, b) => acc + b.total, 0);
}

/** The newest (last) bucket — fails the test loudly if the window is empty. */
function newestOf(buckets: Bucket[]): Bucket {
  const b = buckets.at(-1);
  if (b === undefined) {
    throw new Error("expected at least one bucket");
  }
  return b;
}

// ---------------------------------------------------------------------------
// A1 — prototype pollution via agent key
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: prototype-pollution agent keys", () => {
  it("A1: agent='__proto__' is counted as an OWN byAgent key, not the prototype", () => {
    const buckets = eventsPerMinute(
      [makeEvent({ agent: "__proto__", at: "2026-06-16T12:29:00Z" })],
      5,
      NOW,
    );
    const newest = newestOf(buckets);
    // The event must be counted in total.
    expect(newest.total).toBe(1);
    // It must be an OWN enumerable property — not silently lost into the prototype
    // chain, and not polluting Object.prototype globally.
    expect(Object.hasOwn(newest.byAgent, "__proto__")).toBe(true);
    // The own-property value must be the count (1), read via getOwnPropertyDescriptor
    // so we never traverse the prototype chain.
    const desc = Object.getOwnPropertyDescriptor(newest.byAgent, "__proto__");
    expect(desc?.value).toBe(1);
    // Global prototype must remain clean.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("A1: agent='constructor' and 'toString' are real counted keys, summing to total", () => {
    const buckets = eventsPerMinute(
      [
        makeEvent({ agent: "constructor", at: "2026-06-16T12:29:00Z" }),
        makeEvent({ agent: "toString", at: "2026-06-16T12:29:00Z" }),
        makeEvent({ agent: "constructor", at: "2026-06-16T12:29:00Z" }),
      ],
      5,
      NOW,
    );
    const newest = newestOf(buckets);
    expect(newest.total).toBe(3);
    const agentSum = Object.values(newest.byAgent).reduce((a, b) => a + b, 0);
    // INVARIANT: byAgent counts must sum to total even with dangerous keys.
    expect(agentSum).toBe(3);
    expect(newest.byAgent.constructor).toBe(2);
    expect(newest.byAgent.toString).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A2 — fractional / negative-zero window
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: non-integer window", () => {
  it("A2: window=5.9 truncates to 5 buckets (not 6, not rounded)", () => {
    const buckets = eventsPerMinute([], 5.9, NOW);
    expect(buckets).toHaveLength(5);
  });

  it("A2: window=0.4 truncates to 0 → empty array", () => {
    expect(eventsPerMinute([], 0.4, NOW)).toEqual([]);
  });

  it("A2: window=-0 (negative zero) → empty array, no throw", () => {
    expect(eventsPerMinute([], -0, NOW)).toEqual([]);
  });

  it("A2: window=-3 (negative) → empty array, no throw", () => {
    expect(eventsPerMinute([], -3, NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A3 — huge window stays finite + deterministic
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: large window", () => {
  it("A3: window=1440 (a full day) yields exactly 1440 ascending unique buckets", () => {
    const buckets = eventsPerMinute([], 1440, NOW);
    expect(buckets).toHaveLength(1440);
    const keys = buckets.map((b) => b.minute);
    expect(new Set(keys).size).toBe(1440);
    // strictly ascending
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

// ---------------------------------------------------------------------------
// A4 — future events must not be counted
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: future events", () => {
  it("A4: an event 5 minutes in the FUTURE is not counted in any bucket", () => {
    const future = makeEvent({ at: new Date(NOW.getTime() + 5 * 60_000).toISOString() });
    const buckets = eventsPerMinute([future], 30, NOW);
    expect(sumTotals(buckets)).toBe(0);
  });

  it("A4: a mix of one past (counted) + one future (ignored) → total counts only the past one", () => {
    const past = makeEvent({ at: "2026-06-16T12:29:00Z" });
    const future = makeEvent({ at: new Date(NOW.getTime() + 60 * 60_000).toISOString() });
    const buckets = eventsPerMinute([past, future], 30, NOW);
    expect(sumTotals(buckets)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A5 — the in-progress minute is excluded
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: in-progress-minute exclusion", () => {
  it("A5: an event at 12:30:10 (same minute as now=12:30:00) is NOT counted (minute still running)", () => {
    const inProgress = makeEvent({ at: "2026-06-16T12:30:10Z" });
    const buckets = eventsPerMinute([inProgress], 30, NOW);
    expect(sumTotals(buckets)).toBe(0);
    // And no bucket should be keyed to the in-progress minute 12:30.
    expect(buckets.some((b) => b.minute === "2026-06-16T12:30")).toBe(false);
  });

  it("A5: the newest bucket is 12:29 (last completed minute) for now=12:30:00", () => {
    const buckets = eventsPerMinute([], 30, NOW);
    expect(newestOf(buckets).minute).toBe("2026-06-16T12:29");
  });
});

// ---------------------------------------------------------------------------
// A6 — injected `now` must not be mutated (purity)
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: purity of injected now", () => {
  it("A6: calling eventsPerMinute does not mutate the passed-in Date", () => {
    const now = new Date("2026-06-16T12:30:00Z");
    const before = now.getTime();
    eventsPerMinute([makeEvent()], 30, now);
    expect(now.getTime()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// A7 — empty-string agent
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: empty/whitespace agent", () => {
  it("A7: agent='' (empty string) increments total but is NOT a byAgent key", () => {
    const buckets = eventsPerMinute([makeEvent({ agent: "" })], 5, NOW);
    const newest = newestOf(buckets);
    expect(newest.total).toBe(1);
    expect(Object.keys(newest.byAgent)).toHaveLength(0);
  });

  it("A8: 'agent' and ' agent' (leading space) and 'Agent' are THREE distinct keys", () => {
    const buckets = eventsPerMinute(
      [
        makeEvent({ agent: "agent" }),
        makeEvent({ agent: " agent" }),
        makeEvent({ agent: "Agent" }),
      ],
      5,
      NOW,
    );
    const newest = newestOf(buckets);
    expect(Object.keys(newest.byAgent).sort()).toEqual([" agent", "Agent", "agent"]);
    expect(newest.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// A9 — input events array immutability
// ---------------------------------------------------------------------------
describe("frd-12 rate ADVERSARIAL: input immutability", () => {
  it("A9: the input events array is not mutated (length and elements unchanged)", () => {
    const events = [makeEvent({ agent: "a" }), makeEvent({ agent: "b" })];
    const snapshot = JSON.stringify(events);
    eventsPerMinute(events, 30, NOW);
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});
