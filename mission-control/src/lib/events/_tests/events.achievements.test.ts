/**
 * WO-10-009 — lib/events.ts: surface the REAL enriched fields the factory emits.
 *
 * The achievements engine (FRD-10 v2) re-anchors trophy unlocks to the REAL event
 * vocabulary. The v1 reader only surfaced {frd,phase,activity,mode,role,wo}; the real
 * stream carries verdict/result/reopen_count/blocking/important/agent_type/effort.level/
 * maxAgents/wos/frds/reason (nested under `data`, the real emitter shape).
 *
 * AC-10-009.1 — each real enriched field surfaces on the parsed Event.
 * AC-10-009.2 — wrong-typed fields drop individually; malformed lines skip; never throw.
 * AC-10-009.3 — additive: existing consumers unaffected (covered by events.wo06012.test.ts).
 * AC-10-009.4 — tested against the real-shape fixtures (nested `data`) + a malformed one.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Event, readEvents } from "../events";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-ach-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeLines(lines: string[]): string {
  const filePath = path.join(tmpDir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

describe("wo-10-009: real enriched fields surfaced from data.*", () => {
  it("AgentDone exposes result + role + wo (data-nested, real shape)", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentDone",
        at: "2026-06-17T18:23:34Z",
        project: "mission-control",
        data: { role: "implementer", wo: "WO-06-005", result: "green" },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.result).toBe("green");
    expect(ev.role).toBe("implementer");
    expect(ev.workOrder).toBe("WO-06-005");
  });

  it("ReviewVerdict exposes verdict=APPROVED", () => {
    const p = writeLines([
      JSON.stringify({
        event: "ReviewVerdict",
        at: "2026-06-16T18:17:55Z",
        project: "mission-control",
        data: { role: "reviewer", wo: "WO-02-004", verdict: "APPROVED" },
      }),
    ]);
    expect(readEvents({ path: p }).events[0]?.verdict).toBe("APPROVED");
  });

  it("GateVerdict exposes verdict=REJECT + reopenCount + reason", () => {
    const p = writeLines([
      JSON.stringify({
        event: "GateVerdict",
        at: "2026-06-21T12:23:51Z",
        project: "mission-control",
        data: {
          role: "reviewer",
          frd: "frd-07",
          wo: "WO-07-005",
          verdict: "REJECT",
          reopen_count: 2,
          reason: "missing nav",
          mode: "powerful",
        },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.verdict).toBe("REJECT");
    expect(ev.reopenCount).toBe(2);
    expect(ev.reason).toBe("missing nav");
    expect(ev.frd).toBe("frd-07");
  });

  it("GateResult exposes verdict=PASS", () => {
    const p = writeLines([
      JSON.stringify({
        event: "GateResult",
        at: "2026-06-21T12:39:51Z",
        project: "mission-control",
        data: {
          role: "reviewer",
          frd: "frd-10",
          wo: "WO-10-005",
          verdict: "PASS",
          mode: "powerful",
        },
      }),
    ]);
    expect(readEvents({ path: p }).events[0]?.verdict).toBe("PASS");
  });

  it("BuildComplete exposes wos + frds progress strings", () => {
    const p = writeLines([
      JSON.stringify({
        event: "BuildComplete",
        at: "2026-06-21T16:10:34Z",
        project: "mission-control",
        data: { wos: "78/78", frds: "18/18", phase: "release", last_green: "a2304e8" },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.wos).toBe("78/78");
    expect(ev.frds).toBe("18/18");
  });

  it("BuildLaunch exposes maxAgents + mode", () => {
    const p = writeLines([
      JSON.stringify({
        event: "BuildLaunch",
        at: "2026-06-21T06:23:45Z",
        project: "mission-control",
        data: { mode: "powerful", maxAgents: 100, pending_wos: 15 },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.maxAgents).toBe(100);
    expect(ev.mode).toBe("powerful");
  });

  it("BuildRelaunch exposes reason", () => {
    const p = writeLines([
      JSON.stringify({
        event: "BuildRelaunch",
        at: "2026-06-21T06:52:14Z",
        project: "mission-control",
        data: { reason: "user-interrupt", mode: "powerful", maxAgents: 100 },
      }),
    ]);
    expect(readEvents({ path: p }).events[0]?.reason).toBe("user-interrupt");
  });

  it("AgentFinding exposes blocking + important counts", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentFinding",
        at: "2026-06-16T22:54:19Z",
        project: "mission-control",
        data: { role: "reviewer", wo: "WO-13-003", verdict: "REJECTED", blocking: 1, important: 1 },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.blocking).toBe(1);
    expect(ev.important).toBe(1);
  });

  it("SubagentStop exposes agentType + nested effort.level", () => {
    const p = writeLines([
      JSON.stringify({
        event: "SubagentStop",
        at: "2026-06-13T17:10:11Z",
        data: {
          agent_type: "workflow-subagent",
          effort: { level: "xhigh" },
          cwd: "/x/manga-watch",
        },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.agentType).toBe("workflow-subagent");
    expect(ev.effortLevel).toBe("xhigh");
  });
});

describe("wo-10-009: wrong-typed fields drop individually; never throw", () => {
  it("wrong-typed verdict/result/reopen_count/blocking/maxAgents drop, event retained", () => {
    const p = writeLines([
      JSON.stringify({
        event: "GateVerdict",
        at: "2026-06-21T12:23:51Z",
        data: {
          verdict: 5,
          result: ["x"],
          reopen_count: "two",
          blocking: null,
          maxAgents: "lots",
          effort: "high",
        },
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    const ev = snap.events[0] as Event;
    expect(ev.verdict).toBeUndefined();
    expect(ev.result).toBeUndefined();
    expect(ev.reopenCount).toBeUndefined();
    expect(ev.blocking).toBeUndefined();
    expect(ev.maxAgents).toBeUndefined();
    expect(ev.effortLevel).toBeUndefined();
  });

  it("malformed effort (no .level) drops effortLevel without throwing", () => {
    const p = writeLines([
      JSON.stringify({
        event: "SubagentStop",
        at: "2026-06-13T17:10:11Z",
        data: { effort: { other: 1 } },
      }),
    ]);
    expect(() => readEvents({ path: p })).not.toThrow();
    expect(readEvents({ path: p }).events[0]?.effortLevel).toBeUndefined();
  });

  it("a legacy event without any of the new fields leaves them undefined", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        data: { role: "implementer", wo: "WO-1" },
      }),
    ]);
    const ev = readEvents({ path: p }).events[0] as Event;
    expect(ev.verdict).toBeUndefined();
    expect(ev.result).toBeUndefined();
    expect(ev.agentType).toBeUndefined();
    expect(ev.role).toBe("implementer");
  });
});
