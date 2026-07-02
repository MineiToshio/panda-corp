/**
 * DR-066 consumer liveness/freshness — unit tests for the single derivation
 * (change mc-observability-consumer-dr066).
 *
 * Bands off the producer tick T=60s: live < 3T; aging < 10min TTL; no-signal ≥ TTL
 * or no interpretable stamp. Liveness = running AND fresh, never the flag alone.
 */

import { describe, expect, it } from "vitest";

import { freshnessBand, isLive, LIVE_WINDOW_MS, NO_SIGNAL_TTL_MS } from "../liveness";

const NOW = Date.parse("2026-07-02T12:00:00Z");

/** ISO stamp `ms` before NOW. */
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe("freshnessBand — DR-066 graded bands", () => {
  it("age < 3·T → live, with the age reported", () => {
    const f = freshnessBand(ago(60_000), NOW);
    expect(f.band).toBe("live");
    expect(f.ageMs).toBe(60_000);
  });

  it("3·T ≤ age < TTL → aging (datos de hace X)", () => {
    expect(freshnessBand(ago(LIVE_WINDOW_MS), NOW).band).toBe("aging");
    expect(freshnessBand(ago(NO_SIGNAL_TTL_MS - 1), NOW).band).toBe("aging");
  });

  it("age ≥ TTL → no-signal (never the last value dressed as current)", () => {
    expect(freshnessBand(ago(NO_SIGNAL_TTL_MS), NOW).band).toBe("no-signal");
    expect(freshnessBand(ago(24 * 3_600_000), NOW).band).toBe("no-signal");
  });

  it("absent / blank / unparseable stamp → no-signal with ageMs null (never guesses)", () => {
    expect(freshnessBand(undefined, NOW)).toEqual({ band: "no-signal", ageMs: null });
    expect(freshnessBand(null, NOW)).toEqual({ band: "no-signal", ageMs: null });
    expect(freshnessBand("  ", NOW)).toEqual({ band: "no-signal", ageMs: null });
    expect(freshnessBand("not-a-date", NOW)).toEqual({ band: "no-signal", ageMs: null });
  });

  it("future stamp (clock skew) reads as age 0 — live, never negative", () => {
    const f = freshnessBand(new Date(NOW + 30_000).toISOString(), NOW);
    expect(f.band).toBe("live");
    expect(f.ageMs).toBe(0);
  });
});

describe("isLive — running AND fresh, never the flag alone (DR-066 rule a)", () => {
  it("running:true + fresh heartbeat → live", () => {
    expect(isLive({ running: true, supervisorHeartbeat: ago(30_000) }, NOW)).toBe(true);
  });

  it("running:true + heartbeat inside the TTL but past the live band → still live (quiet agent)", () => {
    expect(isLive({ running: true, supervisorHeartbeat: ago(5 * 60_000) }, NOW)).toBe(true);
  });

  it("frozen running:true + stale heartbeat (≥ TTL) → NOT live", () => {
    expect(isLive({ running: true, supervisorHeartbeat: ago(NO_SIGNAL_TTL_MS) }, NOW)).toBe(false);
  });

  it("running:true with NO heartbeat at all → NOT live (the flag alone is never proof)", () => {
    expect(isLive({ running: true }, NOW)).toBe(false);
  });

  it("running:false → never live, however fresh the heartbeat", () => {
    expect(isLive({ running: false, supervisorHeartbeat: ago(1_000) }, NOW)).toBe(false);
    expect(isLive({}, NOW)).toBe(false);
  });
});
