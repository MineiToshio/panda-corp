/**
 * toFraguaSnapshot — GateVerdict closes the tribunal + wo_reopen re-forges a WO
 * (2026-07-07). Latest-per-frd, superseding, state-derived (no event counting).
 *
 * The tribunal must not linger on a FRD that has been ruled: a GateVerdict for
 * the judging FRD closes the gate LIVE, before the frontmatter refresh lands.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import type { SceneWorkOrder } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

function wo(id: string, state: SceneWorkOrder["state"], frd: string): SceneWorkOrder {
  return { id, frd, state };
}

function agentWorking(at: string, frd: string, id: string): DashboardEvent {
  return { event: "AgentWorking", at, frd, workOrder: id, phase: "build", mode: "powerful" };
}

describe("toFraguaSnapshot — GateVerdict closes the tribunal (frontmatter path)", () => {
  const FRD = "frd-07-gate";
  const workOrders = [wo("WO-07-001", "review", FRD), wo("WO-07-002", "review", FRD)];

  it("all-review FRD opens the tribunal (baseline, no verdict yet)", () => {
    const snap = toFraguaSnapshot([agentWorking("2026-07-07T10:00:00Z", FRD, "WO-07-001")], {
      lastEventAt: "2026-07-07T10:00:00Z",
      workOrders,
    });
    expect(snap.gate.open).toBe(true);
    expect(snap.gate.judging).toBe(FRD);
  });

  it("a GateVerdict for the judging FRD closes the tribunal (open=false, judging=null)", () => {
    const snap = toFraguaSnapshot(
      [
        agentWorking("2026-07-07T10:00:00Z", FRD, "WO-07-001"),
        { event: "GateVerdict", at: "2026-07-07T10:00:05Z", frd: FRD, verdict: "pass" },
      ],
      { lastEventAt: "2026-07-07T10:00:05Z", workOrders },
    );
    expect(snap.gate.open).toBe(false);
    expect(snap.gate.judging).toBeNull();
  });
});

describe("toFraguaSnapshot — gate lifecycle (event-only fallback path)", () => {
  const FRD = "frd-08-y";
  const base: DashboardEvent[] = [
    agentWorking("2026-07-07T10:00:00Z", FRD, "WO-08-001"),
    { event: "gate", at: "2026-07-07T10:00:01Z", frd: FRD },
  ];

  it("a gate event opens the tribunal", () => {
    const snap = toFraguaSnapshot(base, { lastEventAt: "2026-07-07T10:00:01Z" });
    expect(snap.gate.open).toBe(true);
  });

  it("a later GateVerdict supersedes the gate event and closes the tribunal", () => {
    const snap = toFraguaSnapshot(
      [...base, { event: "GateVerdict", at: "2026-07-07T10:00:02Z", frd: FRD, verdict: "reopen" }],
      { lastEventAt: "2026-07-07T10:00:02Z" },
    );
    expect(snap.gate.open).toBe(false);
  });
});

describe("toFraguaSnapshot — wo_reopen re-forges a stopped WO (event-only path)", () => {
  const FRD = "frd-09-z";

  it("a WO stopped then reopened is running again (back at the forge)", () => {
    const snap = toFraguaSnapshot(
      [
        agentWorking("2026-07-07T10:00:00Z", FRD, "WO-09-001"),
        { event: "SubagentStop", at: "2026-07-07T10:00:01Z", frd: FRD, workOrder: "WO-09-001" },
        { event: "wo_reopen", at: "2026-07-07T10:00:02Z", frd: FRD, workOrder: "WO-09-001" },
      ],
      { lastEventAt: "2026-07-07T10:00:02Z" },
    );
    expect(snap.running.some((r) => r.wo === "WO-09-001")).toBe(true);
  });
});
