/**
 * WO-10-011 — catalogue v2 unlock coverage: representative real-signal unlocks per axis.
 * Every unlock derives from a verifiable signal; empty factory → all locked (honesty).
 */

import { describe, expect, it } from "vitest";
import type { EventsSnapshot } from "../../events/events";
import type { IdeaCard } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import { computeSecrets, computeUniques } from "../achievements";
import { UNIQUE_DEFINITIONS } from "../predicates";
import type { ReaderData } from "../stats";

type Raw = Record<string, unknown>;
function snap(events: Raw[]): EventsSnapshot {
  return { events: events as EventsSnapshot["events"], lastEventAt: null, byProject: {} };
}
function reader(over: Partial<ReaderData>): ReaderData {
  return { ideas: [], statuses: [], eventsSnapshot: null, ...over };
}
function status(over: Partial<NonNullable<StatusResult["status"]>>): StatusResult {
  return { present: true, malformed: false, status: { ...over } };
}
const EMPTY: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

function uniq(data: ReaderData, name: string) {
  return computeUniques(data).find((u) => u.name === name);
}

describe("catalogue v2 — shape", () => {
  it("has ~80 trophies across 8 axes, each with a rarity", () => {
    expect(UNIQUE_DEFINITIONS.length).toBeGreaterThanOrEqual(70);
    const axes = new Set(UNIQUE_DEFINITIONS.map((d) => d.category));
    expect(axes.size).toBe(8);
    for (const d of UNIQUE_DEFINITIONS) {
      expect(["Común", "Poco común", "Raro", "Épico", "Leyenda"]).toContain(d.rarity);
    }
  });

  it("the pyramid skews common: more Común than Leyenda", () => {
    const count = (r: string) => UNIQUE_DEFINITIONS.filter((d) => d.rarity === r).length;
    expect(count("Común")).toBeGreaterThan(count("Leyenda"));
  });

  it("empty factory → every trophy locked (no fabrication)", () => {
    expect(computeUniques(EMPTY).every((u) => !u.unlocked)).toBe(true);
  });
});

describe("catalogue v2 — representative unlocks per axis", () => {
  it("Production · Capataz novato ← Σ statuses.workOrdersDone ≥ 10", () => {
    const data = reader({ statuses: [status({ phase: "release", workOrdersDone: 12 })] });
    expect(uniq(data, "Capataz novato")?.unlocked).toBe(true);
    expect(uniq(EMPTY, "Capataz novato")?.unlocked).toBe(false);
  });

  it("Guild · El general ← a BuildLaunch with maxAgents ≥ 50", () => {
    const data = reader({
      eventsSnapshot: snap([
        { event: "BuildLaunch", at: "2026-06-21T06:00:00Z", maxAgents: 64, mode: "powerful" },
      ]),
    });
    expect(uniq(data, "El general")?.unlocked).toBe(true);
  });

  it("Resilience · El ave fénix ← 3 relaunches + a complete (same project)", () => {
    const data = reader({
      eventsSnapshot: snap([
        { event: "BuildRelaunch", at: "2026-06-21T06:10:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:20:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:30:00Z", project: "mc" },
        { event: "BuildComplete", at: "2026-06-21T16:00:00Z", project: "mc" },
      ]),
    });
    expect(uniq(data, "El ave fénix")?.unlocked).toBe(true);
  });

  it("Consistency · El fundador madrugador ← a green WO before 08:00", () => {
    const data = reader({
      eventsSnapshot: snap([{ event: "AgentDone", at: "2026-06-21T05:30:00Z", result: "green" }]),
    });
    expect(uniq(data, "El fundador madrugador")?.unlocked).toBe(true);
  });

  it("Speed · Modo dios activado ← a build completed within 2h", () => {
    const data = reader({
      eventsSnapshot: snap([
        { event: "BuildLaunch", at: "2026-06-21T06:00:00Z", project: "mc" },
        { event: "BuildComplete", at: "2026-06-21T07:30:00Z", project: "mc" },
      ]),
    });
    expect(uniq(data, "Modo dios activado")?.unlocked).toBe(true);
  });

  it("Quality · Pulcro ← a GateResult PASS", () => {
    const data = reader({
      eventsSnapshot: snap([
        { event: "GateResult", at: "2026-06-21T12:00:00Z", verdict: "PASS", project: "mc" },
      ]),
    });
    expect(uniq(data, "Pulcro")?.unlocked).toBe(true);
  });

  it("Mastery · La trilogía ← 3 projects at release", () => {
    const data = reader({
      statuses: [
        status({ phase: "release", project: "a", updatedAt: "2026-01-01T00:00:00Z" }),
        status({ phase: "release", project: "b", updatedAt: "2026-02-01T00:00:00Z" }),
        status({ phase: "release", project: "c", updatedAt: "2026-03-01T00:00:00Z" }),
      ],
    });
    expect(uniq(data, "La trilogía")?.unlocked).toBe(true);
  });
});

describe("catalogue v2 — secrets", () => {
  it("phoenix secret unlocks on ≥3 relaunch+complete; locked on empty", () => {
    const data = reader({
      eventsSnapshot: snap([
        { event: "BuildRelaunch", at: "2026-06-21T06:10:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:20:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:30:00Z", project: "mc" },
        { event: "BuildComplete", at: "2026-06-21T16:00:00Z", project: "mc" },
      ]),
    });
    const sec = computeSecrets(data).find((s) => s.hint.toLowerCase().includes("cenizas"));
    expect(sec?.unlocked).toBe(true);
    expect(sec?.criterion).toBeDefined();
    const locked = computeSecrets(EMPTY).find((s) => s.hint.toLowerCase().includes("cenizas"));
    expect(locked?.unlocked).toBe(false);
    expect(locked?.criterion).toBeUndefined();
  });

  it("forgotten-favorite secret reads a favorite+discarded idea card", () => {
    const idea: IdeaCard = {
      slug: "x",
      title: "X",
      status: "discarded",
      body: "",
      favorite: true,
    };
    const data = reader({ ideas: [idea] });
    const sec = computeSecrets(data).find((s) => s.hint.toLowerCase().includes("favorito"));
    expect(sec?.unlocked).toBe(true);
  });
});
