import { describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { buildSignal } from "../build-signal";
import { latestBuildEvent } from "../live-events";
import { deriveStations } from "../stations";
import { deriveVerdict } from "../verdict";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const order = (id: string, state: WorkOrder["state"]): WorkOrder => ({
  id,
  title: id,
  frd: "frd-06-party",
  state,
  relPath: "docs/x.md",
});
const many = (n: number, state: WorkOrder["state"]) =>
  Array.from({ length: n }, (_, i) => order(`WO-06-${String(i).padStart(3, "0")}`, state));
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const event = (fields: Record<string, unknown>) =>
  ({ event: "AgentWorking", project: "demo", at: ago(1000), ...fields }) as never;

describe("station boundaries", () => {
  it("AC-06-020.4: exactly 8 shows no overflow, 9 shows +1, count stays authoritative", () => {
    expect(deriveStations(many(8, "done"))[3]).toMatchObject({ count: 8, overflow: 0 });
    const nine = deriveStations(many(9, "done"))[3];
    expect(nine).toMatchObject({ count: 9, overflow: 1 });
    expect(nine?.tokens).toHaveLength(8);
  });
  it("AC-06-001.5 AC-06-001.6: fail stays in Taller and a non work-order id is no token", () => {
    const stations = deriveStations([
      order("WO-06-001", "fail"),
      order("frd-06-party", "in_progress"),
    ]);
    expect(stations.map((station) => station.count)).toEqual([0, 1, 0, 0]);
  });
});
describe("build signal boundaries", () => {
  const signal = (at: string | null, running = true) =>
    buildSignal({ running, lastEventAt: at, nowMs: NOW }).kind;
  it("AC-06-020.6: live until just under the 10 minute TTL, no-signal at it", () => {
    expect(signal(ago(10 * 60_000 - 1))).toBe("live");
    expect(signal(ago(10 * 60_000))).toBe("no-signal");
  });
  it("AC-06-013.4: running false stays idle whatever the event tail says", () => {
    expect(signal(ago(0), false)).toBe("idle");
  });
  it("AC-06-019: running with no interpretable stamp is no-signal with a null age", () => {
    expect(buildSignal({ running: true, lastEventAt: "nonsense", nowMs: NOW })).toEqual({
      kind: "no-signal",
      lastSignalAt: null,
      ageMinutes: null,
    });
  });
  it("AC-06-020.6: the freshest of heartbeat and event wins across timestamp formats", () => {
    expect(
      buildSignal({
        running: true,
        supervisorHeartbeat: "2026-10-30T11:59:42.920Z",
        lastEventAt: "2026-10-30T11:59:42Z",
        nowMs: NOW,
      }).lastSignalAt,
    ).toBe("2026-10-30T11:59:42.920Z");
  });
});
describe("event liveness", () => {
  it("AC-06-011.3: foreign and hook events never power the scene", () => {
    expect(
      latestBuildEvent(
        [
          event({ project: "other" }),
          event({ event: "SubagentStop" }),
          event({ event: "SupervisorTick" }),
          event({ at: "garbage" }),
        ],
        "demo",
      ),
    ).toBeNull();
  });
  it("AC-06-011.2: enrichment-free events still count, with mixed-precision instants", () => {
    const latest = event({ at: "2026-10-30T11:59:42.920Z" });
    const earlier = event({ at: "2026-10-30T11:59:42Z" });
    expect(latestBuildEvent([latest, earlier], "demo")).toBe("2026-10-30T11:59:42.920Z");
  });
});
describe("verdict", () => {
  const idle = { kind: "idle", lastSignalAt: null, ageMinutes: null } as const;
  it("AC-06-020.2: absent cross-feature facts are omitted, never invented", () => {
    const text = deriveVerdict({
      orders: many(2, "done"),
      phase: "implementation",
      signal: idle,
      nowMs: NOW,
    }).text;
    expect(text).not.toMatch(/decisión|cambio/);
  });
  it("AC-06-020.2: no-signal outranks an owner decision, as the prototype's verdict", () => {
    expect(
      deriveVerdict({
        orders: many(1, "todo"),
        signal: { kind: "no-signal", lastSignalAt: null, ageMinutes: null },
        ownerPending: 2,
        nowMs: NOW,
      }).health,
    ).toBe("noSignal");
  });
});
