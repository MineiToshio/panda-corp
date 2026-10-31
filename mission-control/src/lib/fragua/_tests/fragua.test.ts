import { describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { buildSignal } from "../build-signal";
import { deriveStations } from "../stations";
import { deriveVerdict } from "../verdict";

const nowMs = Date.parse("2026-10-30T12:00:00Z");
function order(state: WorkOrder["state"], id = "WO-06-001"): WorkOrder {
  return { id, frd: "frd-06-party", title: "Real work", state, relPath: "docs/order.md" };
}
describe("La Fragua authoritative derivations", () => {
  it("AC-06-013.2 AC-06-013.4: running flag owns idle, despite recent events", () => {
    expect(buildSignal({ running: false, lastEventAt: "2026-10-30T12:00:00Z", nowMs }).kind).toBe(
      "idle",
    );
  });
  it("AC-06-013.3 AC-06-019.7 AC-06-020.6: freshest numeric instant wins, TTL crossing is exact", () => {
    const input = {
      running: true,
      supervisorHeartbeat: "2026-10-30T11:00:00Z",
      lastEventAt: "2026-10-30T11:50:00.100Z",
      nowMs,
    };
    expect(buildSignal(input).kind).toBe("live");
    expect(buildSignal({ ...input, nowMs: nowMs + 100 }).kind).toBe("no-signal");
    expect(buildSignal({ ...input, supervisorHeartbeat: "2026-10-30T12:00:00+00:00" }).kind).toBe(
      "live",
    );
  });
  it("AC-06-001.5 AC-06-001.6 AC-06-011.2 AC-06-020.3: structure comes only from real orders, including failed and reopened", () => {
    const orders = [
      order("todo"),
      order("in_progress", "WO-06-002"),
      order("fail", "WO-06-003"),
      order("review", "WO-06-004"),
      order("done", "WO-06-005"),
      order("done", "frd-06-party"),
    ];
    expect(deriveStations(orders).map((s) => s.count)).toEqual([1, 2, 1, 1]);
    expect(
      deriveStations(orders.map((w) => (w.id === "WO-06-004" ? { ...w, state: "todo" } : w))).map(
        (s) => s.count,
      ),
    ).toEqual([2, 2, 0, 1]);
  });
  it("AC-06-020.4: 39 verified means eight visible tokens and +31", () => {
    const station = deriveStations(
      Array.from({ length: 39 }, (_, i) =>
        order("done", `WO-06-${String(i + 1).padStart(3, "0")}`),
      ),
    )[3];
    expect(station?.tokens).toHaveLength(8);
    expect(station?.overflow).toBe(31);
  });
  it("AC-06-020.2 AC-06-020.7: one-left review verdict, cross-feature facts omitted when absent", () => {
    const verdict = deriveVerdict({
      orders: [order("review")],
      phase: "implementation",
      signal: buildSignal({ running: false, nowMs }),
      nowMs,
    });
    expect(verdict.text).toContain("La 1 restante ya está construida");
    expect(verdict.text).not.toContain("decisión");
    expect(
      deriveVerdict({
        orders: [],
        phase: "design",
        signal: buildSignal({ running: true, nowMs }),
        nowMs,
        ownerPending: 1,
      }).health,
    ).toBe("noSignal");
  });
});

it("AC-06-011.2 AC-06-011.3: legacy optional fields and composite FRDs never change structure or admit foreign hook signals", async () => {
  const { latestBuildEvent } = await import("../live-events");
  expect(
    latestBuildEvent(
      [
        {
          event: "AgentWorking",
          project: "demo",
          at: "2026-10-30T11:59:00Z",
          frd: "frd-01-one,frd-02-two",
          workOrder: "frd-01-one",
        },
        { event: "SubagentStop", project: "demo", at: "2026-10-30T12:00:00Z" },
        { event: "AgentWorking", project: "foreign", at: "2026-10-30T12:00:00Z" },
      ],
      "demo",
    ),
  ).toBe("2026-10-30T11:59:00Z");
  expect(deriveStations([]).every((station) => station.count === 0)).toBe(true);
});
