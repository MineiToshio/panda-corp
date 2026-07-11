import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeAgentLevel } from "../../gamification/agents";
import { semanticLedger } from "../event-contract";
import { type Event, readEvents } from "../events";

const roots: string[] = [];
afterEach(() => {
  delete process.env.PANDACORP_EVENTS_FILE;
  delete process.env.PANDACORP_CODEX_EVENTS_FILE;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function temp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-r9-events-"));
  roots.push(root);
  return root;
}

function line(over: Record<string, unknown>): string {
  return JSON.stringify({ at: "2026-07-11T03:00:00Z", project: "demo", ...over });
}

describe("R9 runtime-neutral event contract", () => {
  it("dual-reads legacy Claude and enriched Codex while preserving La Fragua names", () => {
    const root = temp();
    const claude = path.join(root, "claude.ndjson");
    const codex = path.join(root, "codex.ndjson");
    fs.writeFileSync(
      claude,
      `${line({ event: "AgentWorking", data: { role: "reviewer", wo: "WO-1" } })}\n`,
    );
    fs.writeFileSync(
      codex,
      `${line({ event: "agent_done", runtime: "codex", run_id: "run-1", event_id: "ev-2", subject: "WO-1", data: { role: "reviewer", wo: "WO-1", result: "green" } })}\n`,
    );
    process.env.PANDACORP_EVENTS_FILE = claude;
    process.env.PANDACORP_CODEX_EVENTS_FILE = codex;

    const events = readEvents({ cap: 20 }).events;
    expect(events.map((event) => event.event)).toEqual(["AgentWorking", "AgentDone"]);
    expect(events[0]?.runtime).toBe("claude");
    expect(events[1]).toMatchObject({
      runtime: "codex",
      runId: "run-1",
      eventId: "ev-2",
      semanticName: "agent.done",
    });
  });

  it("deduplicates exact event_id and ledgers vocabulary variants by (run,event,subject)", () => {
    const root = temp();
    const claude = path.join(root, "claude.ndjson");
    const codex = path.join(root, "codex.ndjson");
    const exact = line({
      event: "AgentDone",
      runtime: "claude",
      run_id: "run-1",
      event_id: "same",
      subject: "WO-1",
      agent: "reviewer",
      work_order: "WO-1",
      status: "ok",
    });
    fs.writeFileSync(claude, `${exact}\n${exact}\n`);
    fs.writeFileSync(
      codex,
      `${line({ event: "agent_done", runtime: "codex", run_id: "run-1", event_id: "other-transport", subject: "WO-1", agent: "reviewer", work_order: "WO-1", status: "ok" })}\n`,
    );
    process.env.PANDACORP_EVENTS_FILE = claude;
    process.env.PANDACORP_CODEX_EVENTS_FILE = codex;

    const events = readEvents({ cap: 20 }).events;
    expect(events).toHaveLength(2);
    expect(semanticLedger(events)).toHaveLength(1);
    expect(computeAgentLevel("reviewer", events).xp).toBe(1);
  });

  it("does not mutate canonical phase/WO/build files when streams change or disappear", () => {
    const root = temp();
    const eventsPath = path.join(root, "events.ndjson");
    const statusPath = path.join(root, ".pandacorp/status.yaml");
    const woPath = path.join(root, "docs/frds/frd-1/work-orders/wo-1.md");
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.mkdirSync(path.dirname(woPath), { recursive: true });
    fs.writeFileSync(statusPath, "phase: implementation\nrunning: false\n");
    fs.writeFileSync(woPath, "---\nimplementation_status: VERIFIED\n---\n");
    const beforeStatus = fs.readFileSync(statusPath);
    const beforeWo = fs.readFileSync(woPath);
    fs.writeFileSync(
      eventsPath,
      `${line({ event: "BuildComplete", runtime: "codex", run_id: "run-1", event_id: "fake", subject: "demo" })}\n`,
    );
    readEvents({ path: eventsPath });
    fs.writeFileSync(
      eventsPath,
      `${line({ event: "BuildLaunch", runtime: "codex", run_id: "run-2", event_id: "mutated", subject: "demo" })}\n`,
    );
    readEvents({ path: eventsPath });
    fs.rmSync(eventsPath);
    expect(readEvents({ path: eventsPath }).events).toEqual([]);
    expect(fs.readFileSync(statusPath)).toEqual(beforeStatus);
    expect(fs.readFileSync(woPath)).toEqual(beforeWo);
  });

  it("preserves repeated pre-contract legacy events because they have no trustworthy run boundary", () => {
    const legacy: Event[] = [
      { event: "BuildRelaunch", at: "a", project: "demo" },
      { event: "BuildRelaunch", at: "b", project: "demo" },
    ];
    expect(semanticLedger(legacy)).toHaveLength(2);
  });

  it("does not collapse dispatch completion or change reconciliation into result-bearing acts", () => {
    const root = temp();
    const file = path.join(root, "events.ndjson");
    fs.writeFileSync(
      file,
      [
        line({
          event: "dispatch_finished",
          runtime: "codex",
          run_id: "run-1",
          event_id: "d1",
          subject: "WO-1",
        }),
        line({
          event: "agent_done",
          runtime: "codex",
          run_id: "run-1",
          event_id: "d2",
          subject: "WO-1",
          data: { result: "green" },
        }),
        line({
          event: "change_integrated",
          runtime: "codex",
          run_id: "run-1",
          event_id: "c1",
          subject: "change-1",
        }),
        line({
          event: "change_reconciled",
          runtime: "codex",
          run_id: "run-1",
          event_id: "c2",
          subject: "change-1",
        }),
      ].join("\n"),
    );
    const events = readEvents({ path: file }).events;
    expect(events.map((event) => event.semanticName)).toEqual([
      "dispatch.finished",
      "agent.done",
      "change.integrated",
      "change.reconciled",
    ]);
    expect(semanticLedger(events)).toHaveLength(4);
  });

  it("merges transports chronologically before applying the tail cap", () => {
    const root = temp();
    const claude = path.join(root, "claude.ndjson");
    const codex = path.join(root, "codex.ndjson");
    fs.writeFileSync(
      claude,
      `${line({ at: "2026-07-11T05:00:00Z", event: "BuildComplete", event_id: "new" })}\n`,
    );
    fs.writeFileSync(
      codex,
      `${line({ at: "2026-07-11T01:00:00Z", event: "BuildLaunch", event_id: "old" })}\n`,
    );
    process.env.PANDACORP_EVENTS_FILE = claude;
    process.env.PANDACORP_CODEX_EVENTS_FILE = codex;
    expect(readEvents({ cap: 1 }).events.map((event) => event.eventId)).toEqual(["new"]);
  });

  it("reads the same physical transport only once", () => {
    const root = temp();
    const shared = path.join(root, "shared.ndjson");
    fs.writeFileSync(shared, `${line({ event: "AgentWorking" })}\n`);
    process.env.PANDACORP_EVENTS_FILE = shared;
    process.env.PANDACORP_CODEX_EVENTS_FILE = shared;
    expect(readEvents().events).toHaveLength(1);
  });
});
