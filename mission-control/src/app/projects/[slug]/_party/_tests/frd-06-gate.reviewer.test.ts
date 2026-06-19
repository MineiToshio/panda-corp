/**
 * FRD-06 — Second-pass adversarial reviewer tests (FRD gate, powerful mode).
 *
 * Written by the FRD-06 review gate (Opus, a different model than the sonnet/
 * haiku implementers — DR-015). These exercise edges the implementers AND the
 * first reviewer pass (`fragua-snapshot.reviewer.test.ts`) did NOT cover, anchored
 * in the EARS criteria + the FRD's "Edge cases" section, through the REAL snapshot
 * derivation that integrates WO-06-001/002/005/012/013 together.
 *
 * Deliberately disjoint from `fragua-snapshot.reviewer.test.ts` (that file already
 * covers: pro wave cap on a noisy stream, freed-slot reuse, gate-open, queued
 * non-negativity, per-FRD Bóveda isolation, garbage-field tolerance). This file
 * adds the gaps:
 *   AC-06-001.2  — the DEEP wave cap is 6 (not the pro=2 already tested)
 *   AC-06-002.1  — the scene follows the MOST-RECENT FRD when two interleave
 *   AC-06-002.2  — the global done counter is decoupled from the per-FRD shelf
 *   AC-06-005.2  — >9 verified trophies compact to "+N archivados" (overflow math)
 *   AC-06-008.2  — mode absent from the whole stream → default 'powerful' (wave 8)
 *   AC-06-009.1  — an unknown/garbage mode string falls back, never crashes the wave
 *   Edge case    — out-of-order events with a stale tail degrade, never mis-render
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

const FRD = "frd-06-party";
const OTHER_FRD = "frd-10-achievements-hall";
const OPTS = { lastEventAt: "2026-06-18T21:00:00Z" };

function working(wo: string, frd: string, mode?: DashboardEvent["mode"]): DashboardEvent {
  return {
    event: "AgentWorking",
    at: "2026-06-18T21:00:00Z",
    workOrder: wo,
    frd,
    ...(mode ? { mode } : {}),
  };
}

function achievement(wo: string, frd?: string): DashboardEvent {
  return {
    event: "achievement",
    at: "2026-06-18T21:00:02Z",
    workOrder: wo,
    ...(frd ? { frd } : {}),
  };
}

function wos(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(3, "0")}`);
}

describe("frd-06 gate: the DEEP wave cap is 6 (AC-06-001.2)", () => {
  it("frd-06 gate: 9 distinct running WOs in deep mode → running.length === 6", () => {
    const events = wos("WO-06", 9).map((wo) => working(wo, FRD, "deep"));
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.mode).toBe("deep");
    expect(snap.wave).toBe(6);
    expect(snap.running.length).toBe(6);
    // The remaining 3 must surface as queue, never lost.
    expect(snap.queuedCount).toBe(3);
  });
});

describe("frd-06 gate: the scene follows the MOST-RECENT FRD (AC-06-002.1)", () => {
  it("frd-06 gate: events of FRD-10 then FRD-06 → scene is FRD-06, FRD-10 WOs not running", () => {
    const events: DashboardEvent[] = [
      working("WO-10-001", OTHER_FRD, "powerful"),
      working("WO-10-002", OTHER_FRD, "powerful"),
      working("WO-06-001", FRD, "powerful"),
      working("WO-06-002", FRD, "powerful"),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.frd?.id).toBe(FRD);
    const runningIds = snap.running.map((r) => r.wo);
    expect(runningIds).toContain("WO-06-001");
    expect(runningIds).not.toContain("WO-10-001");
  });
});

describe("frd-06 gate: global done counter is cross-FRD, decoupled from the shelf (AC-06-002.2)", () => {
  it("frd-06 gate: 2 foreign + 1 current achievement → project.done counts all 3, shelf only 1", () => {
    const events: DashboardEvent[] = [
      achievement("WO-10-001", OTHER_FRD),
      achievement("WO-10-002", OTHER_FRD),
      working("WO-06-001", FRD, "powerful"),
      achievement("WO-06-001", FRD),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    // The global counter spans every FRD (the "FRD by FRD" project view).
    expect(snap.project.done).toBe(3);
    // The Bóveda shelf is per-FRD: only the current FRD's trophy.
    expect(snap.trophies.map((t) => t.wo)).toEqual(["WO-06-001"]);
    // total is never below done (a counter must not read "3 / 1").
    expect(snap.project.total).toBeGreaterThanOrEqual(snap.project.done);
  });
});

describe("frd-06 gate: >9 verified trophies compact to +N archivados (AC-06-005.2)", () => {
  it("frd-06 gate: 13 current-FRD achievements → 9 trophies shown + archivedCount === 4", () => {
    const built = wos("WO-06", 13).map((wo) => working(wo, FRD, "powerful"));
    const verified = wos("WO-06", 13).map((wo) => achievement(wo, FRD));
    const snap = toFraguaSnapshot([...built, ...verified], OPTS);
    expect(snap.trophies.length).toBe(9);
    expect(snap.archivedCount).toBe(4);
    // Shown + archived must reconstruct the full verified set (no trophy dropped).
    expect(snap.trophies.length + snap.archivedCount).toBe(13);
  });

  it("frd-06 gate: exactly 9 trophies → archivedCount === 0 (boundary, no off-by-one)", () => {
    const built = wos("WO-06", 9).map((wo) => working(wo, FRD, "powerful"));
    const verified = wos("WO-06", 9).map((wo) => achievement(wo, FRD));
    const snap = toFraguaSnapshot([...built, ...verified], OPTS);
    expect(snap.trophies.length).toBe(9);
    expect(snap.archivedCount).toBe(0);
  });
});

describe("frd-06 gate: mode absent from the whole stream → default 'powerful' (AC-06-008.2 / AC-06-009.1)", () => {
  it("frd-06 gate: no mode field anywhere → mode='powerful', wave=8", () => {
    const events = wos("WO-06", 3).map((wo) => working(wo, FRD)); // no mode
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.mode).toBe("powerful");
    expect(snap.wave).toBe(8);
  });

  it("frd-06 gate: a garbage mode string is ignored, falls back, never produces NaN wave", () => {
    const events: DashboardEvent[] = [
      // @ts-expect-error — deliberately hostile: an out-of-union mode value at the boundary.
      working("WO-06-001", FRD, "ultra-turbo-9000"),
      working("WO-06-002", FRD),
    ];
    const snap = toFraguaSnapshot(events, OPTS);
    expect(snap.mode).toBe("powerful");
    expect(Number.isFinite(snap.wave)).toBe(true);
    expect(snap.wave).toBeGreaterThan(0);
  });
});

describe("frd-06 gate: out-of-order / stale tail degrades, never mis-renders (Edge case)", () => {
  it("frd-06 gate: an empty stream → empty state, not a crash or a phantom FRD", () => {
    const snap = toFraguaSnapshot([], OPTS);
    expect(snap.active).toBe(false);
    expect(snap.frd).toBeNull();
    expect(snap.running).toEqual([]);
    expect(snap.trophies).toEqual([]);
    expect(snap.project).toEqual({ done: 0, total: 0 });
  });

  it("frd-06 gate: a stream with only foreign-FRD events still names a current FRD, no current-FRD sprites", () => {
    const events = wos("WO-10", 4).map((wo) => working(wo, OTHER_FRD, "powerful"));
    const snap = toFraguaSnapshot(events, OPTS);
    // The most recent frd is the foreign one — the scene follows it (still valid).
    expect(snap.frd?.id).toBe(OTHER_FRD);
    expect(snap.running.length).toBeLessThanOrEqual(snap.wave);
    expect(snap.running.every((r) => r.wo.startsWith("WO-10"))).toBe(true);
  });
});
