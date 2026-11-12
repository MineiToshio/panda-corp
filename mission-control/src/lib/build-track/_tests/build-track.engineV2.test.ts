/**
 * Engine v2 telemetry (PLAN 3.14, task C08) as Mission Control's existing readers see it.
 *
 * Feeds v2-shaped `track.jsonl` lines through `readBuildTimeline` (build-track.ts) and v2-shaped
 * events (the event-transport.mjs payload) through `readEvents` (events.ts), pinning that:
 *   - the five track shapes the engine writes keep producing real durations, states and review verdicts;
 *   - v2 extras (admission decisions, unknown kinds, extra keys) are skipped or tolerated, never thrown;
 *   - every event name the engine emits resolves to a registered semantic name (never `legacy.*`);
 *   - the lease-only liveness case waits for task D06.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeEventName } from "@/lib/events/event-contract";
import { readEvents } from "@/lib/events/events";
import { readBuildTimeline } from "../build-track";

const FRD = "frd-01-alpha";
const FRD_B = "frd-02-beta";
const NEW_ENGINE_NAMES = [
  "ReviewRecorded",
  "QuotaReading",
  "EngineFailure",
  "AutonomousDecision",
  "BuildHandoff",
  "WaitingGate",
  "UnitParked",
  "AdmitDecision",
] as const;
const EXISTING_ENGINE_NAMES = [
  "BuildLaunch",
  "AgentWorking",
  "AgentDone",
  "wo_commit",
  "GateVerdict",
  "BuildComplete",
  "BuildStopped",
  "worker_started",
  "worker_stopped",
] as const;

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-engine-v2-"));
});

afterEach(() => {
  delete process.env.PANDACORP_EVENTS_FILE;
  delete process.env.PANDACORP_CODEX_EVENTS_FILE;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeTrack(lines: readonly object[]): string {
  const dir = path.join(tmpRoot, ".pandacorp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "track.jsonl"),
    `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`,
    "utf-8",
  );
  return tmpRoot;
}

function at(minute: number): string {
  return new Date(Date.UTC(2026, 10, 11, 12, minute, 0, 0)).toISOString();
}

describe("v2 track.jsonl through readBuildTimeline", () => {
  it("reads the five v2 shapes: durations, review verdict and a done rollup", () => {
    const project = writeTrack([
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(0) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(10), state: "in_review" },
      { kind: "wo_start", frd: FRD, wo: "WO-01-002", at: at(10) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-002", at: at(25), state: "in_review" },
      { kind: "review_start", frd: FRD, at: at(25) },
      { kind: "review_end", frd: FRD, at: at(31), verdict: "pass" },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(31), state: "verified" },
      { kind: "wo_end", frd: FRD, wo: "WO-01-002", at: at(31), state: "verified" },
      { kind: "frd_end", frd: FRD, at: at(32) },
    ]);
    const tl = readBuildTimeline(project, []);
    expect(tl.source).toBe("track");
    expect(tl.hasDurations).toBe(true);
    const frd = tl.frds.find((f) => f.id === FRD);
    expect(frd?.state).toBe("done");
    expect(frd?.endMs).toBe(Date.parse(at(32)));
    expect(frd?.review?.verdict).toBe("pass");
    expect(frd?.review?.durationMin).toBe(6);
    expect(frd?.workOrders.map((w) => w.id)).toEqual(["WO-01-001", "WO-01-002"]);
    expect(frd?.workOrders.every((w) => w.state === "done")).toBe(true);
    expect(tl.buildStartMs).toBe(Date.parse(at(0)));
  });

  it("maps wo_end states in_review -> review, failed -> fail, and an open wo_start -> in_progress", () => {
    const project = writeTrack([
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(0) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(5), state: "in_review" },
      { kind: "wo_start", frd: FRD, wo: "WO-01-002", at: at(5) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-002", at: at(9), state: "failed" },
      { kind: "wo_start", frd: FRD, wo: "WO-01-003", at: at(9) },
    ]);
    const frd = readBuildTimeline(project, []).frds.find((f) => f.id === FRD);
    const byId = new Map(frd?.workOrders.map((w) => [w.id, w.state]));
    expect(byId.get("WO-01-001")).toBe("review");
    expect(byId.get("WO-01-002")).toBe("fail");
    expect(byId.get("WO-01-003")).toBe("in_progress");
    expect(frd?.state).toBe("fail");
  });

  it("a patch re-execution (second wo_start) counts as an attempt and a reject verdict is kept", () => {
    const project = writeTrack([
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(0) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(8), state: "in_review" },
      { kind: "review_start", frd: FRD, at: at(8) },
      { kind: "review_end", frd: FRD, at: at(12), verdict: "reject" },
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(12) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(20), state: "in_review" },
    ]);
    const frd = readBuildTimeline(project, []).frds.find((f) => f.id === FRD);
    expect(frd?.workOrders[0]?.attempts).toBe(2);
    expect(frd?.workOrders[0]?.durationMin).toBe(8);
    expect(frd?.review?.verdict).toBe("reject");
  });

  it("two FRDs interleaved by lanes group per FRD and sort by their first start", () => {
    const project = writeTrack([
      { kind: "wo_start", frd: FRD_B, wo: "WO-02-001", at: at(0) },
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(2) },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(6), state: "verified" },
      { kind: "wo_end", frd: FRD_B, wo: "WO-02-001", at: at(9), state: "verified" },
    ]);
    const tl = readBuildTimeline(project, []);
    expect(tl.frds.map((f) => f.id)).toEqual([FRD_B, FRD]);
    expect(tl.frds.every((f) => f.state === "done")).toBe(true);
  });

  it("skips unknown kinds, admission-style lines and lines with a bad timestamp; tolerates extra keys", () => {
    const project = writeTrack([
      { kind: "admit_decision", frd: FRD, at: at(0), limit: "ram" },
      { kind: "wo_start", frd: FRD, wo: "WO-01-001", at: at(1), run_id: "run-1", unit: "u-build-WO-01-001" },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: "not-a-date", state: "verified" },
      { kind: "wo_end", frd: FRD, wo: "WO-01-001", at: at(7), state: "verified", sha: "abc1234" },
    ]);
    const frd = readBuildTimeline(project, []).frds.find((f) => f.id === FRD);
    expect(frd?.workOrders).toHaveLength(1);
    expect(frd?.workOrders[0]?.state).toBe("done");
    expect(frd?.workOrders[0]?.durationMin).toBe(6);
  });

  it("a missing track file never throws and falls back (no fabricated durations)", () => {
    const tl = readBuildTimeline(tmpRoot, []);
    expect(tl.source).toBe("empty");
    expect(tl.hasDurations).toBe(false);
  });
});

describe("v2 events through readEvents", () => {
  function payload(event: string, data: Record<string, unknown>, over: Record<string, unknown> = {}) {
    return {
      at: "2026-11-11T12:00:00.000Z",
      runtime: "claude",
      run_id: "run-1",
      event_id: `ev-${event}-${Math.random().toString(36).slice(2)}`,
      event,
      semantic_name: "ignored-by-reader",
      project: "demo",
      subject: "demo",
      data,
      ...over,
    };
  }

  function writeEvents(file: string, lines: readonly object[]): string {
    fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
    return file;
  }

  it("parses the engine's existing event names with their data fields", () => {
    const file = writeEvents(path.join(tmpRoot, "events.ndjson"), [
      payload("BuildLaunch", { mode: "v2" }),
      payload("AgentWorking", { role: "implementer", unit: "u-build-WO-01-001" }),
      payload("AgentDone", { role: "implementer", model: "sonnet", unit: "u-build-WO-01-001", result: "green" }),
      payload("wo_commit", { wo: "WO-01-001", frd: FRD }),
      payload("GateVerdict", { frd: FRD, verdict: "PASS" }),
      payload("BuildComplete", {}),
    ]);
    const events = readEvents({ path: file, cap: 50 }).events;
    expect(events.map((e) => e.event)).toEqual([
      "BuildLaunch",
      "AgentWorking",
      "AgentDone",
      "wo_commit",
      "GateVerdict",
      "BuildComplete",
    ]);
    const done = events.find((e) => e.event === "AgentDone");
    expect(done).toMatchObject({ result: "green", role: "implementer", runId: "run-1", project: "demo" });
    expect(events.find((e) => e.event === "GateVerdict")).toMatchObject({ verdict: "PASS" });
  });

  it("filters by the basename project and keeps the codex transport distinct from the claude one", () => {
    const claude = writeEvents(path.join(tmpRoot, "claude.ndjson"), [
      payload("BuildLaunch", {}, { project: "demo" }),
      payload("BuildLaunch", {}, { project: "other" }),
    ]);
    const codex = writeEvents(path.join(tmpRoot, "codex.ndjson"), [
      payload("AgentWorking", { role: "implementer" }, { runtime: "codex", project: "demo" }),
    ]);
    process.env.PANDACORP_EVENTS_FILE = claude;
    process.env.PANDACORP_CODEX_EVENTS_FILE = codex;
    const events = readEvents({ cap: 50, project: "demo" }).events;
    expect(events.map((e) => [e.event, e.runtime])).toEqual([
      ["BuildLaunch", "claude"],
      ["AgentWorking", "codex"],
    ]);
  });

  it("every existing engine event name resolves to a registered semantic name (not legacy.*)", () => {
    for (const name of EXISTING_ENGINE_NAMES) {
      expect(normalizeEventName(name).semanticName, name).not.toMatch(/^legacy\./);
    }
  });

  it("the 8 new engine vocabulary names resolve to registered semantic names (AX1 regenerates the MC copy)", () => {
    for (const name of NEW_ENGINE_NAMES) {
      expect(normalizeEventName(name).semanticName, name).not.toMatch(/^legacy\./);
    }
  });

  it("the new engine names are read as events, not dropped, with their run id", () => {
    const file = writeEvents(
      path.join(tmpRoot, "events.ndjson"),
      NEW_ENGINE_NAMES.map((name) => payload(name, { unit: "u-x" })),
    );
    const events = readEvents({ path: file, cap: 50 }).events;
    expect(events.map((e) => e.event)).toEqual([...NEW_ENGINE_NAMES]);
    expect(events.every((e) => e.runId === "run-1")).toBe(true);
  });

  it("an engine build_usable event does not exist in the vocabulary (it would surface as legacy.*)", () => {
    expect(normalizeEventName("build_usable").semanticName).toMatch(/^legacy\./);
  });
});

describe("v2 lease-only liveness (task D06)", () => {
  it.todo(
    "isLive treats a lease renewed within its ttl_seconds as live without status.yaml running:true (liveness.ts, after D06)",
  );
  it.todo("a lease with a malformed renewed_at or ttl_seconds <= 0 blanks the live status (liveness.ts, after D06)");
});
