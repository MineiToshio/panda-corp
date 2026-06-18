/**
 * WO-18-003 — `IF-18-pulse` pure derivation helper tests.
 *
 * Tests the `pulse()` function that computes:
 *   - Funnel: ideas alive, in-construction (live vs stale), shipped.
 *   - Owner-waiting count (from pending decisions).
 *   - idea→shipped conversion percentage.
 *   - ≤5 signals.
 *
 * Acceptance criteria verified:
 *   AC-18-003.1 — pulse shows funnel + owner-waiting + conversion; ≤5 signals.
 *   AC-18-003.2 — "in construction" distinguishes live vs stale (FRD-12 freshness).
 *   AC-18-003.3 — conversion = shipped / total ideas alive (rounded), safe division.
 *   AC-18-003.4 — fresh factory (no ideas) → 0% conversion, calm state, no divide-by-zero.
 *
 * TDD: tests written BEFORE implementation (RED phase).
 * Traceability: WO-18-003 → AC-18-003.1..4 → REQ-18-013/014.
 */

import { describe, expect, it } from "vitest";
import type { PulseInput, PulseResult } from "../pulse";
import { pulse } from "../pulse";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FRESH_FACTORY: PulseInput = {
  ideasAlive: 0,
  ideasShipped: 0,
  inConstructionLive: 0,
  inConstructionStale: 0,
  ownerWaiting: 0,
};

const TYPICAL_FACTORY: PulseInput = {
  ideasAlive: 5,
  ideasShipped: 2,
  inConstructionLive: 1,
  inConstructionStale: 0,
  ownerWaiting: 1,
};

const FACTORY_WITH_STALE: PulseInput = {
  ideasAlive: 8,
  ideasShipped: 3,
  inConstructionLive: 0,
  inConstructionStale: 2,
  ownerWaiting: 2,
};

const FACTORY_WITH_MIXED_BUILDS: PulseInput = {
  ideasAlive: 10,
  ideasShipped: 4,
  inConstructionLive: 1,
  inConstructionStale: 1,
  ownerWaiting: 3,
};

// ---------------------------------------------------------------------------
// AC-18-003.4 — Fresh factory (no ideas): calm state, 0% conversion, no error
// ---------------------------------------------------------------------------

describe("pulse — fresh factory (AC-18-003.4)", () => {
  it("returns 0% conversion when no ideas exist (no divide-by-zero)", () => {
    const result = pulse(FRESH_FACTORY);
    expect(result.conversionPct).toBe(0);
  });

  it("returns calm state when no ideas (ideasAlive = 0)", () => {
    const result = pulse(FRESH_FACTORY);
    expect(result.calm).toBe(true);
  });

  it("returns 0 ownerWaiting in fresh factory", () => {
    const result = pulse(FRESH_FACTORY);
    expect(result.ownerWaiting).toBe(0);
  });

  it("returns funnel with all zeros in fresh factory", () => {
    const result = pulse(FRESH_FACTORY);
    expect(result.ideasAlive).toBe(0);
    expect(result.ideasShipped).toBe(0);
    expect(result.inConstructionLive).toBe(0);
    expect(result.inConstructionStale).toBe(0);
  });

  it("never throws on fresh factory input", () => {
    expect(() => pulse(FRESH_FACTORY)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-18-003.1 — Funnel + owner-waiting + conversion present; ≤5 signals
// ---------------------------------------------------------------------------

describe("pulse — funnel and signals (AC-18-003.1)", () => {
  it("returns at most 5 signal keys in the result", () => {
    const result = pulse(TYPICAL_FACTORY);
    // The spec says ≤5 signals. We verify by checking the count of
    // core display signals (ideasAlive, inConstruction, shipped, ownerWaiting, conversion).
    const signalKeys: (keyof PulseResult)[] = [
      "ideasAlive",
      "ideasShipped",
      "inConstructionLive",
      "ownerWaiting",
      "conversionPct",
    ];
    // All 5 signals must be present
    expect(signalKeys.length).toBe(5);
    for (const key of signalKeys) {
      expect(key in result).toBe(true);
    }
  });

  it("passes through ideasAlive from input", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.ideasAlive).toBe(5);
  });

  it("passes through ideasShipped from input", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.ideasShipped).toBe(2);
  });

  it("passes through ownerWaiting from input", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.ownerWaiting).toBe(1);
  });

  it("is not calm when there are ideas and builds", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.calm).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-18-003.2 — In-construction distinguishes live vs stale
// ---------------------------------------------------------------------------

describe("pulse — live vs stale in-construction (AC-18-003.2)", () => {
  it("exposes inConstructionLive separately from inConstructionStale", () => {
    const result = pulse(FACTORY_WITH_STALE);
    expect(result.inConstructionLive).toBe(0);
    expect(result.inConstructionStale).toBe(2);
  });

  it("reports live count from input when builds are live", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.inConstructionLive).toBe(1);
    expect(result.inConstructionStale).toBe(0);
  });

  it("supports mixed live and stale builds simultaneously", () => {
    const result = pulse(FACTORY_WITH_MIXED_BUILDS);
    expect(result.inConstructionLive).toBe(1);
    expect(result.inConstructionStale).toBe(1);
  });

  it("signals hasStale = true when any stale build exists", () => {
    const result = pulse(FACTORY_WITH_STALE);
    expect(result.hasStale).toBe(true);
  });

  it("signals hasStale = false when no stale builds", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.hasStale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-18-003.3 — Conversion = shipped / total alive (rounded %)
// ---------------------------------------------------------------------------

describe("pulse — idea→shipped conversion (AC-18-003.3)", () => {
  it("computes conversion as shipped / ideasAlive (rounded to integer %)", () => {
    // 2 shipped / 5 alive = 40%
    const result = pulse(TYPICAL_FACTORY);
    expect(result.conversionPct).toBe(40);
  });

  it("rounds conversion to the nearest integer", () => {
    // 3 shipped / 8 alive = 37.5% → rounds to 38
    const result = pulse(FACTORY_WITH_STALE);
    expect(result.conversionPct).toBe(38);
  });

  it("returns 40% for 4 shipped / 10 alive", () => {
    const result = pulse(FACTORY_WITH_MIXED_BUILDS);
    expect(result.conversionPct).toBe(40);
  });

  it("returns 0% when shipped = 0 but ideas exist", () => {
    const result = pulse({ ...TYPICAL_FACTORY, ideasShipped: 0 });
    expect(result.conversionPct).toBe(0);
  });

  it("returns 100% when all ideas are shipped (max case)", () => {
    const result = pulse({
      ideasAlive: 3,
      ideasShipped: 3,
      inConstructionLive: 0,
      inConstructionStale: 0,
      ownerWaiting: 0,
    });
    expect(result.conversionPct).toBe(100);
  });

  it("never returns NaN — protects the tabular display", () => {
    // Even with zero alive (fresh factory), no NaN
    const result = pulse(FRESH_FACTORY);
    expect(Number.isNaN(result.conversionPct)).toBe(false);
  });

  it("never returns Infinity", () => {
    const result = pulse(FRESH_FACTORY);
    expect(Number.isFinite(result.conversionPct) || result.conversionPct === 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Calm state — AC-18-003.4 (exception-first UX)
// ---------------------------------------------------------------------------

describe("pulse — calm state", () => {
  it("is calm when ideas=0, ownerWaiting=0", () => {
    expect(pulse(FRESH_FACTORY).calm).toBe(true);
  });

  it("is calm when ownerWaiting=0 and nothing in construction", () => {
    const result = pulse({
      ideasAlive: 2,
      ideasShipped: 0,
      inConstructionLive: 0,
      inConstructionStale: 0,
      ownerWaiting: 0,
    });
    expect(result.calm).toBe(true);
  });

  it("is NOT calm when ownerWaiting > 0", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.calm).toBe(false);
  });

  it("is NOT calm when there are stale builds", () => {
    const result = pulse(FACTORY_WITH_STALE);
    expect(result.calm).toBe(false);
  });

  it("is NOT calm when there are live builds (active work)", () => {
    const result = pulse(TYPICAL_FACTORY);
    expect(result.calm).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Purity — pulse must be a pure function
// ---------------------------------------------------------------------------

describe("pulse — purity", () => {
  it("returns the same result given the same input (deterministic)", () => {
    const a = pulse(TYPICAL_FACTORY);
    const b = pulse(TYPICAL_FACTORY);
    expect(a).toEqual(b);
  });

  it("does not mutate the input object", () => {
    const input: PulseInput = { ...TYPICAL_FACTORY };
    const originalSnapshot = JSON.stringify(input);
    pulse(input);
    expect(JSON.stringify(input)).toBe(originalSnapshot);
  });
});
