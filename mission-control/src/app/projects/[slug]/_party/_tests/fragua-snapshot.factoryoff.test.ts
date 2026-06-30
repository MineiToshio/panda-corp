/**
 * toFraguaSnapshot — factory-off from the authoritative `running` flag (AC-06-013).
 *
 * The event ndjson keeps the LAST build's events forever, so a stale tail (e.g. the
 * final Visual-QA pass) would render a frozen "active" scene + a phantom running WO
 * even when nothing is building. `status.yaml`'s `running` is the authoritative
 * signal: when `false`, the snapshot is forced to the powered-off state regardless
 * of the events; `undefined`/`true` keeps the event-derived behavior.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

const FRD = "frd-10-achievements-hall";

function working(wo: string): DashboardEvent {
  return {
    event: "AgentWorking",
    at: "2026-06-30T02:00:00Z",
    workOrder: wo,
    frd: FRD,
    phase: "build",
  };
}

// A stale tail that, on its own, derives an active scene with a running WO.
const STALE_TAIL: DashboardEvent[] = [working("WO-10-014"), working("WO-10-015")];
const OPTS = { lastEventAt: "2026-06-30T02:00:00Z" };

describe("toFraguaSnapshot — factory-off (AC-06-013)", () => {
  it("running:false forces active=false even with a non-empty event tail", () => {
    const snap = toFraguaSnapshot(STALE_TAIL, { ...OPTS, running: false });
    expect(snap.active).toBe(false);
  });

  it("running:false drops the running WOs (no phantom sprite)", () => {
    const snap = toFraguaSnapshot(STALE_TAIL, { ...OPTS, running: false });
    expect(snap.running).toHaveLength(0);
  });

  it("running:false keeps the FRD context (so the scene renders the off state, not the empty state)", () => {
    const snap = toFraguaSnapshot(STALE_TAIL, { ...OPTS, running: false });
    expect(snap.frd?.id).toBe(FRD);
  });

  it("running:true keeps the event-derived active scene with running WOs", () => {
    const snap = toFraguaSnapshot(STALE_TAIL, { ...OPTS, running: true });
    expect(snap.active).toBe(true);
    expect(snap.running.length).toBeGreaterThan(0);
  });

  it("running omitted preserves the prior event-derived behavior (active scene)", () => {
    const snap = toFraguaSnapshot(STALE_TAIL, OPTS);
    expect(snap.active).toBe(true);
    expect(snap.running.length).toBeGreaterThan(0);
  });
});
