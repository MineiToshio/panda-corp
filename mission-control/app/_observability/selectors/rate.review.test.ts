/**
 * WO-12-003 — `eventsPerMinute` (IF-12-rate) — REVIEWER adversarial tests (DR-015, cycle 2).
 *
 * Written by the reviewer (Opus 4.8, a DIFFERENT model from the implementer and
 * NON-overlapping with the prior reviewer set in rate.adversarial.test.ts) to
 * probe edges that NEITHER the implementer (rate.test.ts) NOR the first review
 * (rate.adversarial.test.ts A1-A9) covered, plus mutation-killing assertions for
 * the contract invariants.
 *
 * The prior cycle's BLOCKING B1 (prototype-pollution byAgent) was fixed with
 * Object.create(null) + Object.hasOwn. These tests verify the fix holds against
 * the actual DR-001 abuse path (global Object.prototype pollution) and pin the
 * remaining contract guarantees so future mutations cannot silently rot them.
 *
 * New targets (none in rate.test.ts or rate.adversarial.test.ts):
 *   R1 — agent="__proto__" with repeated counts does NOT mutate Object.prototype
 *        globally (the real DR-001 / OWASP surface, beyond "is it an own key").
 *   R2 — byAgent survives a JSON round-trip with dangerous keys intact (consumers
 *        are server components that serialize the snapshot to the client).
 *   R3 — sum(byAgent) === total ONLY when every event has an agent; with a mix of
 *        agent / no-agent / non-string-agent events sum(byAgent) is STRICTLY < total
 *        (kills a "byAgent always equals total" mutant).
 *   R4 — the SAME agent across DISTINCT minutes lands in distinct buckets, not
 *        aggregated into one (kills a "use a single shared byAgent" mutant).
 *   R5 — off-by-one boundary: an event in the OLDEST bucket's minute is counted;
 *        an event one minute OLDER than the window is dropped (kills `>=`/`>` and
 *        `safeWindow`/`safeWindow-1` mutants on the window edge).
 *   R6 — returned buckets are deep-independent: mutating byAgent of a returned
 *        bucket does NOT leak into a fresh call's result (consumer isolation).
 *   R7 — non-string agent shapes (number, array, object, null) increment total
 *        but never appear as a byAgent key and never throw (I3 hardening).
 *   R8 — the returned object's `minute` keys are strictly monotonic with no gaps
 *        for a multi-minute window (kills a step-size mutant on the 60_000 stride).
 *
 * Traceability: AC-12-007.1 → REQ-12-007 → IF-12-rate → WO-12-003.
 */

import { afterEach, describe, expect, it } from "vitest";
import { type Bucket, eventsPerMinute } from "./rate";

type LooseEvent = {
  event: string;
  at: string;
  // intentionally loose to model untrusted NDJSON input
  agent?: unknown;
  project?: string;
};

const NOW = new Date("2026-06-16T12:30:00Z");

function ev(at: string, agent?: unknown): LooseEvent {
  return { event: "ToolCall", at, agent };
}

function sumTotals(buckets: Bucket[]): number {
  return buckets.reduce((acc, b) => acc + b.total, 0);
}

function sumByAgent(b: Bucket): number {
  return Object.values(b.byAgent).reduce((a, n) => a + n, 0);
}

function newest(buckets: Bucket[]): Bucket {
  const b = buckets.at(-1);
  if (b === undefined) throw new Error("expected at least one bucket");
  return b;
}

// Cast helper: the selector's public type narrows agent to string|undefined, but
// the real NDJSON stream is untrusted. We deliberately feed wider shapes.
// biome-ignore lint/suspicious/noExplicitAny: modelling untrusted runtime input
const feed = (events: LooseEvent[]) => events as any;

// ---------------------------------------------------------------------------
// R1 — global prototype-pollution abuse path (DR-001 / OWASP)
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: __proto__ does not pollute the global prototype", () => {
  afterEach(() => {
    // Defensive cleanup so a regression cannot leak across tests.
    // biome-ignore lint/suspicious/noExplicitAny: probing prototype pollution
    delete (Object.prototype as any).polluted;
  });

  it("R1: repeated agent='__proto__' events never write to Object.prototype", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:29:00Z", "__proto__"),
        ev("2026-06-16T12:29:10Z", "__proto__"),
        ev("2026-06-16T12:29:20Z", "__proto__"),
      ]),
      5,
      NOW,
    );
    const n = newest(buckets);
    // Counted as a real own key with value 3.
    expect(n.total).toBe(3);
    expect(Object.getOwnPropertyDescriptor(n.byAgent, "__proto__")?.value).toBe(3);
    // The global prototype must be untouched: a fresh object has no inherited count.
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    // biome-ignore lint/suspicious/noExplicitAny: probing prototype pollution
    expect(({} as any).polluted).toBeUndefined();
    // And byAgent's own __proto__ slot must be a number (own data prop), not a
    // prototype reference — read via descriptor to avoid the deprecated accessor.
    expect(typeof Object.getOwnPropertyDescriptor(n.byAgent, "__proto__")?.value).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// R2 — serialization safety (consumers serialize the snapshot)
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: byAgent survives JSON serialization", () => {
  it("R2: dangerous keys round-trip through JSON.stringify/parse intact", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:29:00Z", "constructor"),
        ev("2026-06-16T12:29:00Z", "toString"),
        ev("2026-06-16T12:29:00Z", "__proto__"),
        ev("2026-06-16T12:29:00Z", "constructor"),
      ]),
      5,
      NOW,
    );
    const n = newest(buckets);
    const roundTrip = JSON.parse(JSON.stringify(n.byAgent)) as Record<string, number>;
    // All three dangerous keys present after serialization, with correct counts.
    expect(roundTrip.constructor).toBe(2);
    expect(roundTrip.toString).toBe(1);
    // __proto__ is the tricky one: JSON.parse of an object with a "__proto__"
    // member CAN be dropped. Assert via own-descriptor that it survives as data.
    expect(Object.getOwnPropertyDescriptor(roundTrip, "__proto__")?.value).toBe(1);
    // Whatever serialization does, the SOURCE byAgent sum must still be the total.
    expect(sumByAgent(n)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// R3 — sum(byAgent) < total with mixed agent presence (mutation-killer)
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: byAgent sum vs total with mixed events", () => {
  it("R3: mix of agent / missing-agent / empty-agent → sum(byAgent) STRICTLY < total", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:29:00Z", "implementer"),
        ev("2026-06-16T12:29:00Z"), // no agent
        ev("2026-06-16T12:29:00Z", ""), // empty agent
        ev("2026-06-16T12:29:00Z", "implementer"),
      ]),
      5,
      NOW,
    );
    const n = newest(buckets);
    expect(n.total).toBe(4);
    expect(n.byAgent.implementer).toBe(2);
    // sum is 2 (only the two named events), strictly less than total 4.
    expect(sumByAgent(n)).toBe(2);
    expect(sumByAgent(n)).toBeLessThan(n.total);
  });

  it("R3: all events have an agent → sum(byAgent) === total (boundary equality)", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:29:00Z", "a"),
        ev("2026-06-16T12:29:00Z", "b"),
        ev("2026-06-16T12:29:00Z", "a"),
      ]),
      5,
      NOW,
    );
    const n = newest(buckets);
    expect(sumByAgent(n)).toBe(n.total);
    expect(n.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// R4 — same agent across distinct minutes is NOT aggregated
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: per-minute separation of one agent", () => {
  it("R4: agent='x' at 12:27 and 12:29 lands in two different buckets", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:27:30Z", "x"),
        ev("2026-06-16T12:29:30Z", "x"),
        ev("2026-06-16T12:29:45Z", "x"),
      ]),
      5,
      NOW,
    );
    const at27 = buckets.find((b) => b.minute === "2026-06-16T12:27");
    const at29 = buckets.find((b) => b.minute === "2026-06-16T12:29");
    expect(at27?.byAgent.x).toBe(1);
    expect(at29?.byAgent.x).toBe(2);
    // The empty minutes in between have zero buckets, not undefined.
    const at28 = buckets.find((b) => b.minute === "2026-06-16T12:28");
    expect(at28?.total).toBe(0);
    expect(Object.keys(at28?.byAgent ?? {})).toHaveLength(0);
    expect(sumTotals(buckets)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// R5 — window-edge off-by-one (mutation-killer on the boundary)
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: window oldest-edge boundary", () => {
  // now=12:30:00 → newest completed minute = 12:29; window=5 → [12:25..12:29].
  it("R5: event in the OLDEST in-window minute (12:25) is counted", () => {
    const buckets = eventsPerMinute(feed([ev("2026-06-16T12:25:00Z", "a")]), 5, NOW);
    expect(buckets[0]?.minute).toBe("2026-06-16T12:25");
    expect(buckets[0]?.total).toBe(1);
    expect(sumTotals(buckets)).toBe(1);
  });

  it("R5: event one minute OLDER than the window (12:24:59) is dropped", () => {
    const buckets = eventsPerMinute(feed([ev("2026-06-16T12:24:59Z", "a")]), 5, NOW);
    expect(buckets).toHaveLength(5);
    expect(sumTotals(buckets)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R6 — returned buckets are deep-independent across calls
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: consumer isolation across calls", () => {
  it("R6: mutating a returned bucket's byAgent does not leak into a fresh call", () => {
    const events = feed([ev("2026-06-16T12:29:00Z", "a")]);
    const first = eventsPerMinute(events, 5, NOW);
    // A hostile/buggy consumer mutates the returned structure.
    newest(first).byAgent.a = 999;
    newest(first).total = 999;
    const second = eventsPerMinute(events, 5, NOW);
    expect(newest(second).byAgent.a).toBe(1);
    expect(newest(second).total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// R7 — non-string agent shapes never become keys, never throw (I3 hardening)
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: non-string agent hardening", () => {
  it("R7: number/array/object/null agent → counted in total, absent from byAgent, no throw", () => {
    const buckets = eventsPerMinute(
      feed([
        ev("2026-06-16T12:29:00Z", 42),
        ev("2026-06-16T12:29:00Z", ["arr"]),
        ev("2026-06-16T12:29:00Z", { obj: true }),
        ev("2026-06-16T12:29:00Z", null),
        ev("2026-06-16T12:29:00Z", "real"),
      ]),
      5,
      NOW,
    );
    const n = newest(buckets);
    expect(n.total).toBe(5);
    expect(Object.keys(n.byAgent)).toEqual(["real"]);
    expect(n.byAgent.real).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// R8 — minute keys strictly monotonic, no gaps, exact 1-minute stride
// ---------------------------------------------------------------------------
describe("frd-12 rate REVIEW: bucket stride integrity", () => {
  it("R8: a 10-minute window yields 10 keys with exact consecutive minute stride", () => {
    const buckets = eventsPerMinute([], 10, NOW);
    expect(buckets).toHaveLength(10);
    const times = buckets.map((b) => new Date(`${b.minute}:00Z`).getTime());
    const strides: number[] = [];
    for (let i = 1; i < times.length; i++) {
      const cur = times[i];
      const prev = times[i - 1];
      if (cur === undefined || prev === undefined) throw new Error("unexpected gap");
      strides.push(cur - prev);
    }
    // Each step is exactly 60_000 ms — kills a stride mutant (e.g. *2, +1).
    expect(strides).toEqual(Array(9).fill(60_000));
    // Last key is the last completed minute before now.
    expect(buckets.at(-1)?.minute).toBe("2026-06-16T12:29");
    expect(buckets[0]?.minute).toBe("2026-06-16T12:20");
  });
});
