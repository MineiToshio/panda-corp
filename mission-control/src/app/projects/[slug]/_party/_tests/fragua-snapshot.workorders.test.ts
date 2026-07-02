/**
 * toFraguaSnapshot — frontmatter-derived scene structure (DR-092, 2026-07-01).
 *
 * The work-order frontmatter (the Work Orders board's source) decides the
 * scene structure; events only drive liveness. These tests pin:
 *   - sprites from `in_progress` (forge, ≤ wave) and `review` (tribunal)
 *   - queue from `todo`/`fail` (+ building overflow beyond the wave)
 *   - trophies from `done` (no achievement event needed)
 *   - global counter from the frontmatter totals
 *   - gate open when every FRD WO sits at review/done with ≥1 review
 *   - empty-string event frd ignored; frontmatter FRD fallback
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import type { SceneWorkOrder } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

const FRD = "frd-03-checkout";

/** Minimal enriched AgentWorking event for the FRD focus. */
function agentWorking(at: string, frd: string, wo: string): DashboardEvent {
  return { event: "AgentWorking", at, frd, workOrder: wo, mode: "powerful" };
}

function wo(id: string, state: SceneWorkOrder["state"], frd: string = FRD): SceneWorkOrder {
  return { id, frd, state };
}

describe("frd-06: toFraguaSnapshot — structure from work orders (DR-092)", () => {
  const events = [agentWorking("2026-07-01T10:00:00Z", FRD, "WO-03-001")];

  it("frd-06: in_progress → forge sprite; review → tribunal sprite", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: "2026-07-01T10:00:00Z",
      workOrders: [
        wo("WO-03-001", "in_progress"),
        wo("WO-03-002", "review"),
        wo("WO-03-003", "todo"),
      ],
    });
    // v2 global scene: each entry also carries its FRD + stable palette color.
    expect(snapshot.running).toMatchObject([
      { wo: "WO-03-001", state: "building", frd: FRD },
      { wo: "WO-03-002", state: "in_review", frd: FRD },
    ]);
    expect(snapshot.running[0]?.colorKey).toMatch(/^--color-agent-/);
  });

  it("frd-06: todo + fail count as the queue; building overflow beyond the wave queues too", () => {
    const building = Array.from({ length: 10 }, (_, i) =>
      wo(`WO-03-1${i.toString().padStart(2, "0")}`, "in_progress"),
    );
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [...building, wo("WO-03-201", "todo"), wo("WO-03-202", "fail")],
    });
    // powerful wave = 8 forge sprites; 2 building overflow + 1 todo + 1 fail queue.
    expect(snapshot.running).toHaveLength(8);
    expect(snapshot.queuedCount).toBe(4);
  });

  it("frd-06: done WOs are trophies even with ZERO achievement events (frontmatter is the source)", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [
        wo("WO-03-001", "done"),
        wo("WO-03-002", "done"),
        wo("WO-03-003", "in_progress"),
      ],
    });
    // v2: trophies carry their FRD + color for the vault plaques.
    expect(snapshot.trophies).toMatchObject([
      { wo: "WO-03-001", frd: FRD },
      { wo: "WO-03-002", frd: FRD },
    ]);
  });

  it("frd-06 v2: the campaign lists every FRD with its real state, and the tribunal is a QUEUE", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [
        wo("WO-01-001", "done", "frd-01-core"),
        wo("WO-02-001", "review", "frd-02-a"),
        wo("WO-03-001", "review", "frd-03-b"),
        wo("WO-04-001", "in_progress", "frd-04-c"),
        wo("WO-05-001", "todo", "frd-05-d"),
        wo("WO-06-001", "fail", "frd-06-e"),
      ],
    });
    expect(snapshot.campaign?.map((c) => [c.frd, c.state])).toEqual([
      ["frd-01-core", "verified"],
      ["frd-02-a", "in_review"],
      ["frd-03-b", "in_review"],
      ["frd-04-c", "building"],
      ["frd-05-d", "pending"],
      ["frd-06-e", "blocked"],
    ]);
    // Gates are serialized (BL-0021): first in line is in session, the rest wait.
    expect(snapshot.gate).toMatchObject({
      open: true,
      judging: "frd-02-a",
      queue: ["frd-02-a", "frd-03-b"],
    });
    // The scene focus is the FRD under judgment.
    expect(snapshot.frd?.id).toBe("frd-02-a");
  });

  it("frd-06 v2: a fresh engine `gate` event picks WHICH queued FRD is in session", () => {
    const snapshot = toFraguaSnapshot(
      [
        agentWorking("2026-07-01T10:00:00Z", "frd-02-a", "WO-02-001"),
        { event: "gate", at: "2026-07-01T10:05:00Z", frd: "frd-03-b" },
      ],
      {
        lastEventAt: "2026-07-01T10:05:00Z",
        workOrders: [
          wo("WO-02-001", "review", "frd-02-a"),
          wo("WO-03-001", "review", "frd-03-b"),
        ],
      },
    );
    expect(snapshot.gate.judging).toBe("frd-03-b");
  });

  it("frd-06 v2: the forge wave spans FRDs (running mixes features, each with its color)", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [
        wo("WO-01-001", "in_progress", "frd-01-core"),
        wo("WO-02-001", "in_progress", "frd-02-a"),
        wo("WO-03-001", "in_progress", "frd-03-b"),
      ],
    });
    expect(snapshot.running.map((r) => r.frd)).toEqual(["frd-01-core", "frd-02-a", "frd-03-b"]);
    const colors = new Set(snapshot.running.map((r) => r.colorKey));
    expect(colors.size).toBe(3);
  });

  it("frd-06: the global counter reads done/total from the whole project's frontmatter", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [
        wo("WO-03-001", "in_progress"),
        wo("WO-03-002", "done"),
        wo("WO-01-001", "done", "frd-01-core"),
        wo("WO-01-002", "done", "frd-01-core"),
      ],
    });
    expect(snapshot.project).toEqual({ done: 3, total: 4 });
  });

  it("frd-06: gate opens from frontmatter when every FRD WO sits at review/done with ≥1 review", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [wo("WO-03-001", "review"), wo("WO-03-002", "done")],
    });
    expect(snapshot.gate.open).toBe(true);
  });

  it("frd-06: gate stays closed while any FRD WO is still building", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      workOrders: [wo("WO-03-001", "review"), wo("WO-03-002", "in_progress")],
    });
    expect(snapshot.gate.open).toBe(false);
  });

  it("frd-06: an empty-string event frd is ignored (visual-qa emits frd:'')", () => {
    const snapshot = toFraguaSnapshot(
      [
        agentWorking("2026-07-01T10:00:00Z", FRD, "WO-03-001"),
        agentWorking("2026-07-01T10:05:00Z", "", "visual-qa"),
      ],
      { lastEventAt: "2026-07-01T10:05:00Z", workOrders: [wo("WO-03-001", "in_progress")] },
    );
    expect(snapshot.frd?.id).toBe(FRD);
  });

  it("frd-06: with NO frd-bearing events, an in-flight frontmatter FRD still renders the scene", () => {
    const snapshot = toFraguaSnapshot([], {
      lastEventAt: null,
      workOrders: [wo("WO-03-001", "in_progress")],
    });
    expect(snapshot.frd?.id).toBe(FRD);
    expect(snapshot.running).toHaveLength(1);
  });

  it("frd-06: factory-off (running:false) still drops sprites and closes the gate", () => {
    const snapshot = toFraguaSnapshot(events, {
      lastEventAt: null,
      running: false,
      workOrders: [wo("WO-03-001", "review"), wo("WO-03-002", "done")],
    });
    expect(snapshot.active).toBe(false);
    expect(snapshot.running).toEqual([]);
    expect(snapshot.gate.open).toBe(false);
  });
});
