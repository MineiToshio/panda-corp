/**
 * WO-10-010 — lib/achievements/signals.ts: real-signal derivation tests.
 *
 * AC-10-010.1 — every aggregate derived from the REAL event vocabulary (no task= reads).
 * AC-10-010.2 — first-event stamps carry source at/project; no fabrication.
 * AC-10-010.3 — empty factory → honest zeros/false/null.
 */

import { describe, expect, it } from "vitest";
import type { EventsSnapshot } from "../../events/events";
import { deriveSignals } from "../signals";
import type { ReaderData } from "../stats";

type RawEvent = Record<string, unknown>;

function snapshot(events: RawEvent[]): EventsSnapshot {
  return {
    events: events.map((e) => normalize(e)),
    lastEventAt: null,
    byProject: {},
  };
}

/** Map the test's flat shape into the parsed Event shape (fields already top-level). */
function normalize(e: RawEvent): import("../../events/events").Event {
  return e as import("../../events/events").Event;
}

function reader(events: RawEvent[], statuses: ReaderData["statuses"] = []): ReaderData {
  return { ideas: [], statuses, eventsSnapshot: snapshot(events) };
}

const EMPTY: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

describe("deriveSignals — empty factory → honest zeros (AC-10-010.3)", () => {
  it("all counts 0, flags false, stamps null", () => {
    const s = deriveSignals(EMPTY);
    expect(s.woClosed).toBe(0);
    expect(s.builds).toBe(0);
    expect(s.subagents).toBe(0);
    expect(s.distinctRoles).toBe(0);
    expect(s.weeklyStreak).toBe(0);
    expect(s.hasXhighEffort).toBe(false);
    expect(s.earlyBird).toBe(false);
    expect(s.firstGreenDone).toBeNull();
    expect(s.firstGatePass).toBeNull();
  });
});

describe("deriveSignals — counts from the real vocabulary (AC-10-010.1)", () => {
  it("woClosed = Σ statuses.workOrdersDone (uncapped cumulative floor)", () => {
    const s = deriveSignals(
      reader(
        [],
        [
          { present: true, malformed: false, status: { workOrdersDone: 30 } },
          { present: true, malformed: false, status: { workOrdersDone: 48 } },
          { present: false, malformed: false, status: null },
        ],
      ),
    );
    expect(s.woClosed).toBe(78);
  });

  it("counts builds, launches, relaunches, subagents, reviews, findings", () => {
    const s = deriveSignals(
      reader([
        { event: "BuildComplete", at: "2026-06-21T16:10:34Z", project: "mc", wos: "78/78" },
        {
          event: "BuildLaunch",
          at: "2026-06-21T06:23:45Z",
          project: "mc",
          mode: "powerful",
          maxAgents: 100,
        },
        { event: "BuildRelaunch", at: "2026-06-21T06:52:14Z", project: "mc", mode: "powerful" },
        { event: "SubagentStop", at: "2026-06-13T17:10:11Z", effortLevel: "xhigh" },
        { event: "SubagentStop", at: "2026-06-13T18:10:11Z", effortLevel: "high" },
        { event: "ReviewVerdict", at: "2026-06-16T18:17:55Z", project: "mc", verdict: "APPROVED" },
        {
          event: "AgentFinding",
          at: "2026-06-16T22:54:19Z",
          project: "mc",
          blocking: 1,
          important: 1,
        },
      ]),
    );
    expect(s.builds).toBe(1);
    expect(s.buildLaunches).toBe(1);
    expect(s.relaunches).toBe(1);
    expect(s.subagents).toBe(2);
    expect(s.reviewsApproved).toBe(1);
    expect(s.findings).toBe(1);
    expect(s.maxAgentsPeak).toBe(100);
    expect(s.hasXhighEffort).toBe(true);
    expect(s.fridayShip).toBe(false); // 2026-06-21 is a Sunday
  });

  it("gatePasses counts PASS verdicts; flawlessGates needs reopen_count 0", () => {
    const s = deriveSignals(
      reader([
        { event: "GateResult", at: "2026-06-21T12:39:51Z", verdict: "PASS", reopenCount: 0 },
        { event: "GateVerdict", at: "2026-06-21T12:23:51Z", verdict: "PASS", reopenCount: 2 },
        { event: "GateVerdict", at: "2026-06-21T11:23:51Z", verdict: "REJECT", reopenCount: 1 },
      ]),
    );
    expect(s.gatePasses).toBe(2);
    expect(s.flawlessGates).toBe(1);
    expect(s.maxReopenThenPass).toBe(2);
  });

  it("distinct roles + modes", () => {
    const s = deriveSignals(
      reader([
        { event: "AgentWorking", at: "2026-06-16T15:12:07Z", role: "test-writer" },
        { event: "AgentDone", at: "2026-06-17T18:23:34Z", role: "implementer", result: "green" },
        { event: "BuildLaunch", at: "2026-06-21T06:23:45Z", mode: "powerful" },
        { event: "BuildLaunch", at: "2026-06-22T06:23:45Z", mode: "deep" },
      ]),
    );
    expect(s.distinctRoles).toBe(2);
    expect(s.distinctModes).toBe(2);
  });
});

describe("deriveSignals — time-of-day & cadence from green-WO close times", () => {
  it("early bird, after midnight, witching hour from green AgentDone at", () => {
    const s = deriveSignals(
      reader([
        { event: "AgentDone", at: "2026-06-17T03:30:00Z", result: "green" }, // witching + early
        { event: "AgentDone", at: "2026-06-18T00:15:00Z", result: "green" }, // after midnight + early
      ]),
    );
    expect(s.witchingHour).toBe(true);
    expect(s.afterMidnight).toBe(true);
    expect(s.earlyBird).toBe(true);
    expect(s.greenDoneEvents).toBe(2);
    expect(s.activeDays).toBe(2);
  });

  it("weekend warrior needs a Saturday AND a Sunday green WO", () => {
    const sat = { event: "AgentDone", at: "2026-06-20T10:00:00Z", result: "green" }; // Sat
    const sun = { event: "AgentDone", at: "2026-06-21T10:00:00Z", result: "green" }; // Sun
    expect(deriveSignals(reader([sat])).weekendWarrior).toBe(false);
    expect(deriveSignals(reader([sat, sun])).weekendWarrior).toBe(true);
  });

  it("weeklyStreak counts consecutive ISO weeks with a green WO", () => {
    const s = deriveSignals(
      reader([
        { event: "AgentDone", at: "2026-06-01T10:00:00Z", result: "green" },
        { event: "AgentDone", at: "2026-06-08T10:00:00Z", result: "green" },
        { event: "AgentDone", at: "2026-06-15T10:00:00Z", result: "green" },
      ]),
    );
    expect(s.weeklyStreak).toBe(3);
  });
});

describe("deriveSignals — resilience + first-stamps (AC-10-010.2)", () => {
  it("maxRelaunchThenComplete only counts a project that also completed", () => {
    const s = deriveSignals(
      reader([
        { event: "BuildRelaunch", at: "2026-06-21T06:30:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:40:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:50:00Z", project: "mc" },
        { event: "BuildComplete", at: "2026-06-21T16:10:00Z", project: "mc" },
        { event: "BuildRelaunch", at: "2026-06-21T06:30:00Z", project: "abandoned" },
      ]),
    );
    expect(s.maxRelaunchThenComplete).toBe(3);
  });

  it("first stamps carry the earliest source at + project, never fabricated", () => {
    const s = deriveSignals(
      reader([
        { event: "AgentDone", at: "2026-06-18T10:00:00Z", result: "green", project: "b" },
        { event: "AgentDone", at: "2026-06-17T10:00:00Z", result: "green", project: "a" },
      ]),
    );
    expect(s.firstGreenDone).toEqual({ at: "2026-06-17T10:00:00Z", project: "a" });
  });
});
