import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBuildRun } from "../build-run";

const roots: string[] = [];
const at = "2026-11-12T12:00:00Z";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-v2-"));
  roots.push(root);
  const write = (rel: string, value: unknown) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  };
  const state = {
    schema: 2,
    engine: "v2",
    run_id: "run-a",
    epoch: 2,
    coordinator: "codex-session",
    label: "codex",
    size: "feature",
    status: "active",
    status_reason: null,
    tranche: null,
    scope: { card: null, frds: ["FRD-04"], wos: ["WO-04-001"], out_of_scope: [] },
    integration: {
      branch: "lane/run-a/integration",
      worktree: "/removed/worktree",
      base_sha: "abc",
    },
    last_safe_point: null,
    units: [],
    jobs: [],
    handbacks_in_a_row: 0,
    doubts_consulted: 0,
    answers: {},
    quota_at_unit: {},
  };
  const lease = {
    run_id: "run-a",
    epoch: 2,
    renewed_at: at,
    ttl_seconds: 1800,
    token_hash: "private",
  };
  write(".pandacorp/run/build/state.json", state);
  write(".pandacorp/run/build.lease/lease.json", lease);
  return {
    root,
    state,
    lease,
    write,
    options: { nowMs: Date.parse(at), hostDir: path.join(root, "host") },
  };
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("v2 read-only run boundary (FRD-04 REQ-017/018)", () => {
  it("reads the producer schema and a matching lease without legacy running or worktrees", () => {
    const f = fixture();
    const result = readBuildRun(f.root, f.options);
    expect(result).toMatchObject({
      present: true,
      live: true,
      errors: [],
      state: { run_id: "run-a" },
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result.stateMtimeMs).toBeGreaterThan(0);
  });
  it("keeps durable siblings usable and reports malformed present sources", () => {
    const f = fixture();
    f.write(".pandacorp/run/build/state.json", { ...f.state, units: [{}] });
    f.write(".pandacorp/run/build/admission.json", {
      tokens: {},
      history: [],
      ladder: { step: 0 },
    });
    expect(readBuildRun(f.root, f.options)).toMatchObject({
      present: true,
      live: false,
      state: null,
    });
    expect(readBuildRun(f.root, f.options).errors).toHaveLength(2);
  });
  it.each([
    "finished",
    "stopped",
    "paused",
    "waiting_owner",
    "waiting_gate",
  ])("never revives %s from a fresh lease", (status) => {
    const f = fixture();
    f.write(".pandacorp/run/build/state.json", { ...f.state, status });
    expect(readBuildRun(f.root, f.options).live).toBe(false);
  });
  it("rejects contradictory identity/epoch and quiescence, and expires at the lease TTL", () => {
    const f = fixture();
    f.write(".pandacorp/run/build.lease/lease.json", { ...f.lease, epoch: 3 });
    expect(readBuildRun(f.root, f.options)).toMatchObject({ live: false, matchesLease: false });
    expect(readBuildRun(f.root, f.options).errors[0]?.path).toContain("lease.json");
    f.write(".pandacorp/run/build.lease/lease.json", { ...f.lease, quiesced_at: at });
    expect(readBuildRun(f.root, f.options).live).toBe(false);
    f.write(".pandacorp/run/build.lease/lease.json", f.lease);
    expect(readBuildRun(f.root, { ...f.options, nowMs: Date.parse(at) + 1800000 }).live).toBe(
      false,
    );
  });
  it("redacts admission tokens and separates step change time from observed freshness", () => {
    const f = fixture();
    f.write(".pandacorp/run/build/admission.json", {
      tokens: { secret: { unit: "u1" } },
      history: [],
      disk_waiting: true,
      ladder: { step: 3, motivo: "swapouts", changed_at: at },
    });
    const result = readBuildRun(f.root, f.options);
    expect(result.admission).toEqual({
      step: 3,
      reason: "disco",
      changedAt: at,
      diskWaiting: true,
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.admissionMtimeMs).toBeGreaterThan(0);
  });
  it("missing optional files are empty and never materialized", () => {
    const f = fixture();
    const root = path.join(f.root, "missing");
    expect(readBuildRun(root, f.options)).toMatchObject({
      present: false,
      state: null,
      performance: [],
      errors: [],
    });
    expect(fs.existsSync(root)).toBe(false);
  });
});

it("performance follows the real producer schema, retaining valid siblings and nulls", () => {
  const f = fixture();
  const record = {
    run_id: "run-a",
    project: path.basename(f.root),
    plugin_version: "10.0.0",
    start: at,
    end: "2026-11-12T12:10:00Z",
    outcome: "finished",
    units_by_kind: { build: { count: 1, p50_s: 4, p90_s: 4 } },
    workers_over_time: [{ t: at, step: 5, live_b: 2, live_h: 1 }],
    ram_gib: { min: null, max: 5 },
    swap_mb: { start: 100, peak: 200, end: 100 },
    scale_events: [{ at, from: 5, to: 3, reason: "swapouts" }],
    start_step: 5,
    sustained_step: null,
    recommended_start: 3,
    disk_free_gib: { start: 42, end: 41 },
  };
  const file = path.join(f.options.hostDir, "perf/journal.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    [
      JSON.stringify(record),
      "broken-json",
      JSON.stringify({ ...record, project: "other" }),
      JSON.stringify({ run_id: "malformed" }),
    ].join("\n"),
  );
  const result = readBuildRun(f.root, f.options);
  expect(result.performance).toEqual([record]);
  expect(result.performanceIdentity).toBe("basename-only");
  expect(result.errors).toHaveLength(2);
  expect(result.performance[0]?.ram_gib.min).toBeNull();
});

it("all status consumers see v2 liveness even when YAML running is false or absent", async () => {
  const { readStatus } = await import("../../status/status");
  const { isLive } = await import("../../status/liveness");
  const { buildSignal } = await import("../../fragua/build-signal");
  const { buildSnapshot } = await import("../../snapshot/snapshot");
  const f = fixture();
  fs.writeFileSync(
    path.join(f.root, ".pandacorp/status.yaml"),
    "running: false\nlast_green_sha: abc\n",
  );
  const result = readStatus(f.root);
  if (!result.present) throw new Error("Missing fixture status");
  expect(isLive(result.status, f.options.nowMs)).toBe(true);
  expect(buildSignal({ ...result.status, nowMs: f.options.nowMs }).kind).toBe("live");
  expect(buildSnapshot("fixture", result.status, f.options.nowMs)?.buildingNow).toBe(
    "building now",
  );
  f.write(".pandacorp/run/build/state.json", { ...f.state, status: "finished" });
  const finished = readStatus(f.root);
  if (!finished.present) throw new Error("Missing fixture status");
  expect(isLive({ ...finished.status, running: true, lastEventAt: at }, f.options.nowMs)).toBe(
    false,
  );
  expect(buildSnapshot("fixture", finished.status, f.options.nowMs)?.buildingNow).toBeUndefined();
});

it("fingerprints observe admission, mirror resolution and backwards file changes without events", async () => {
  const { stateVersion } = await import("../../status/state-version");
  const { stateVersionMoved } = await import("../../status/state-version-moved");
  const f = fixture();
  const before = stateVersion(f.root);
  const ref = { current: before ?? null };
  f.write(".pandacorp/run/build/admission.json", { tokens: {}, history: [], ladder: null });
  const admission = stateVersion(f.root);
  expect(admission).not.toBe(before);
  expect(stateVersionMoved(admission, ref)).toBe(true);
  f.write(".pandacorp/inbox/decisions.pending.md", "resolved mirror");
  const decisions = stateVersion(f.root);
  expect(decisions).not.toBe(admission);
  const stateFile = path.join(f.root, ".pandacorp/run/build/state.json");
  fs.utimesSync(stateFile, 1, 1);
  expect(stateVersion(f.root)).not.toBe(decisions);
  fs.unlinkSync(path.join(f.root, ".pandacorp/inbox/decisions.pending.md"));
  expect(stateVersion(f.root)).not.toBe(decisions);
});

it("client clock regrading cannot revive terminal or mismatched v2 signals", async () => {
  const { buildSignal } = await import("../../fragua/build-signal");
  const f = fixture();
  for (const state of [
    { ...f.state, status: "finished" },
    { ...f.state, epoch: 3 },
  ]) {
    f.write(".pandacorp/run/build/state.json", state);
    const signal = buildSignal({
      buildRun: readBuildRun(f.root, f.options),
      nowMs: f.options.nowMs,
    });
    const clientSignal = buildSignal({
      running: signal.kind !== "idle",
      lastEventAt: signal.lastSignalAt,
      leaseRenewedAt: signal.leaseRenewedAt,
      leaseTtlSeconds: signal.leaseTtlSeconds,
      nowMs: f.options.nowMs,
    });
    expect(clientSignal.kind).not.toBe("live");
  }
});
