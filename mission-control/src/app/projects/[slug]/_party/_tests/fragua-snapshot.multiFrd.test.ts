/**
 * toFraguaSnapshot: composite `frd` event field (several ids joined by comma).
 *
 * The engine emits run-level events (e.g. the visual-qa `uiPassSkipped` marker) with
 * `frd: "a,b"` when a wave or pass spans several FRDs. With parallel FRD gates, several
 * FRDs are active at once, so such events are the normal case. A composite value belongs
 * to no single FRD: it must never become the scene's focus id (AC-06-019.4).
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import type { SceneWorkOrder } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

const FRD_A = "frd-03-board";
const FRD_B = "frd-06-party";
const COMPOSITE = `${FRD_A},${FRD_B}`;

function event(at: string, frd: string, name = "AgentWorking"): DashboardEvent {
  return { event: name, at, frd, workOrder: "WO-03-001", mode: "powerful" };
}

function wo(id: string, state: SceneWorkOrder["state"], frd: string): SceneWorkOrder {
  return { id, frd, state };
}

describe("frd-06: toFraguaSnapshot composite frd field (AC-06-019.4)", () => {
  it("frd-06: a composite-only event stream never yields a raw comma-joined focus id", () => {
    const snap = toFraguaSnapshot([event("2026-09-30T10:00:00Z", COMPOSITE)], {
      lastEventAt: "2026-09-30T10:00:00Z",
    });
    expect(snap.frd).toBeNull();
    expect(snap.active).toBe(false);
  });

  it("frd-06: a later composite event does not displace the freshest single-FRD event focus", () => {
    const snap = toFraguaSnapshot(
      [
        event("2026-09-30T10:00:00Z", FRD_B),
        event("2026-09-30T10:05:00Z", COMPOSITE, "uiPassSkipped"),
      ],
      { lastEventAt: "2026-09-30T10:05:00Z" },
    );
    expect(snap.frd?.id).toBe(FRD_B);
  });

  it("frd-06: composite-only events fall back to the frontmatter focus", () => {
    const snap = toFraguaSnapshot([event("2026-09-30T10:00:00Z", COMPOSITE)], {
      lastEventAt: "2026-09-30T10:00:00Z",
      workOrders: [wo("WO-06-001", "in_progress", FRD_B), wo("WO-03-001", "done", FRD_A)],
    });
    expect(snap.frd?.id).toBe(FRD_B);
  });

  it("frd-06: with several FRDs building, the focus is the first building FRD in file order", () => {
    const snap = toFraguaSnapshot([event("2026-09-30T10:00:00Z", COMPOSITE)], {
      lastEventAt: "2026-09-30T10:00:00Z",
      workOrders: [wo("WO-03-001", "in_progress", FRD_A), wo("WO-06-001", "in_progress", FRD_B)],
    });
    expect(snap.frd?.id).toBe(FRD_A);
  });
});
