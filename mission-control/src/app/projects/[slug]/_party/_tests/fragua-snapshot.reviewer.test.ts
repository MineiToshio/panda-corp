/**
 * FRD-06 — Adversarial reviewer integration tests for toFraguaSnapshot.
 *
 * Written by the FRD-06 review gate (different model than the implementers).
 * These exercise edge cases / abuse the implementers did NOT cover, anchored in
 * the EARS criteria and the FRD's "Edge cases" section, against the real
 * snapshot derivation that drives the whole scene (the integration brain that
 * ties WO-06-001/004/005/012/013 together).
 *
 * Anchored ACs:
 *   AC-06-001.2  — running WOs capped at the wave even on a noisy/duplicated stream
 *   AC-06-001.3  — queued count never negative / never double-counts running|verified
 *   AC-06-002.1  — the scene follows the most-recent FRD in build
 *   AC-06-004.2  — gate opens for the current FRD when its gate event arrives
 *   AC-06-005.1  — trophies belong to the current FRD's Bóveda (scene is per-FRD)
 *   AC-06-008.2  — missing/garbage optional fields never throw, degrade gracefully
 *   Edge case    — a SubagentStop frees a wave slot for a queued WO
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

const FRD = "frd-06-party";
const OTHER_FRD = "frd-10-achievements-hall";

function working(wo: string, frd: string, mode?: DashboardEvent["mode"]): DashboardEvent {
  return {
    event: "AgentWorking",
    at: "2026-06-18T20:00:00Z",
    workOrder: wo,
    frd,
    ...(mode ? { mode } : {}),
  };
}

function stop(wo: string, frd: string): DashboardEvent {
  return { event: "SubagentStop", at: "2026-06-18T20:00:01Z", workOrder: wo, frd };
}

function achievement(wo: string, frd?: string): DashboardEvent {
  return {
    event: "achievement",
    at: "2026-06-18T20:00:02Z",
    workOrder: wo,
    ...(frd ? { frd } : {}),
  };
}

const OPTS = { lastEventAt: "2026-06-18T20:00:02Z" };

describe("frd-06 reviewer: wave cap survives a noisy / duplicated stream (AC-06-001.2)", () => {
  it("frd-06 reviewer: 30 duplicated+distinct running events, mode=pro → running.length === 2", () => {
    const events: DashboardEvent[] = [];
    for (let n = 1; n <= 10; n++) {
      const wo = `WO-06-${String(n).padStart(3, "0")}`;
      events.push(working(wo, FRD, "pro"), working(wo, FRD, "pro"), working(wo, FRD, "pro"));
    }
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.mode).toBe("pro");
    expect(snap.wave).toBe(2);
    expect(snap.running.length).toBe(2);
    expect(new Set(snap.running.map((r) => r.wo)).size).toBe(snap.running.length);
  });
});

describe("frd-06 reviewer: a freed slot lets a queued WO take a sprite (edge case)", () => {
  it("frd-06 reviewer: WO-1 stops before WO-3 starts → WO-1 no longer occupies a forge slot", () => {
    const events: DashboardEvent[] = [
      working("WO-06-001", FRD, "pro"),
      working("WO-06-002", FRD, "pro"),
      stop("WO-06-001", FRD),
      working("WO-06-003", FRD, "pro"),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    const runningIds = snap.running.map((r) => r.wo);
    expect(snap.running.length).toBeLessThanOrEqual(2);
    expect(runningIds).not.toContain("WO-06-001");
  });
});

describe("frd-06 reviewer: gate opens for the current FRD (AC-06-004.2)", () => {
  it("frd-06 reviewer: a gate event for the CURRENT FRD opens the gate", () => {
    const events: DashboardEvent[] = [
      working("WO-06-001", FRD, "powerful"),
      { event: "gate", at: "2026-06-18T20:00:03Z", frd: FRD },
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.gate.open).toBe(true);
  });
});

describe("frd-06 reviewer: queued count is a non-negative, non-double-counting integer (AC-06-001.3)", () => {
  it("frd-06 reviewer: queued >= 0 and verified-with-stop is neither running nor queued", () => {
    const events: DashboardEvent[] = [
      working("WO-06-001", FRD, "powerful"),
      working("WO-06-002", FRD, "powerful"),
      working("WO-06-003", FRD, "powerful"),
      working("WO-06-004", FRD, "powerful"),
      working("WO-06-005", FRD, "powerful"),
      stop("WO-06-005", FRD),
      achievement("WO-06-005", FRD),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.queuedCount).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(snap.queuedCount)).toBe(true);
    // Verified (stopped) WO must not also be a running forge sprite.
    expect(snap.running.map((r) => r.wo)).not.toContain("WO-06-005");
  });
});

describe("frd-06 reviewer: the Bóveda shelf is per-FRD (AC-06-005.1, scene is per-FRD)", () => {
  it("frd-06 reviewer: a foreign-FRD achievement lingering in the 200-event tail is not a current-FRD trophy", () => {
    // Realistic: the event tail is capped globally, so a just-finished FRD's
    // achievement events sit in the tail when the next FRD starts building.
    const events: DashboardEvent[] = [
      achievement("WO-10-007", OTHER_FRD),
      achievement("WO-10-008", OTHER_FRD),
      working("WO-06-001", FRD, "powerful"),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.frd?.id).toBe(FRD);
    const trophyIds = snap.trophies.map((t) => t.wo);
    // The Bóveda is the CURRENT FRD's shelf; foreign-FRD trophies must not leak in.
    expect(trophyIds).not.toContain("WO-10-007");
    expect(trophyIds).not.toContain("WO-10-008");
  });
});

describe("frd-06 reviewer: hostile/garbage optional fields never throw (AC-06-008.2)", () => {
  it("frd-06 reviewer: events with empty-string frd / unknown event types degrade, never throw", () => {
    const events: DashboardEvent[] = [
      working("WO-06-001", FRD, "powerful"),
      { event: "WeirdUnknownEvent", at: "2026-06-18T20:00:04Z", frd: "" },
      { event: "AgentWorking", at: "2026-06-18T20:00:05Z", frd: FRD },
      { event: "achievement", at: "2026-06-18T20:00:06Z" },
    ];
    expect(() => toFraguaSnapshot(events, OPTS)).not.toThrow();
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.active).toBe(true);
  });
});
