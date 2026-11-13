import type { BuildRun, BuildRunUnit, PerformanceRecord } from "@/lib/build-run/types";
export function unit(overrides: Partial<BuildRunUnit> = {}): BuildRunUnit {
  return {
    id: "u-build",
    kind: "build",
    state: "running",
    wos: ["WO-04-001"],
    frd: "FRD-04",
    attempt: 1,
    worker: { runtime: "codex", model: "gpt-6.1-sol", effort: "low" },
    branch: "lane/run-a/u-build",
    depends_on: [],
    pending_answer: null,
    parked: null,
    waiting_gate: null,
    ...overrides,
  };
}
export function run(): BuildRun {
  return {
    present: true,
    live: true,
    matchesLease: true,
    state: {
      schema: 2,
      engine: "v2",
      run_id: "run-a",
      epoch: 1,
      coordinator: "codex-session",
      label: "codex",
      size: "feature",
      status: "active",
      status_reason: null,
      tranche: null,
      scope: { card: null, frds: [], wos: [], out_of_scope: [] },
      integration: { branch: "lane/run-a/integration" },
      last_safe_point: null,
      units: [unit(), unit({ id: "u-review", kind: "review" })],
      jobs: [],
    },
    admission: { step: 3, reason: "presion", changedAt: "2026-11-12T12:00:00Z", diskWaiting: true },
    stateMtimeMs: null,
    admissionMtimeMs: null,
    lease: null,
    performance: [],
    performanceIdentity: "basename-only",
    errors: [],
  };
}
export function performance(): PerformanceRecord {
  return {
    run_id: "run-a",
    project: "demo",
    plugin_version: "10.0.0",
    start: "2026-11-12T12:00:00Z",
    end: "2026-11-12T12:02:00Z",
    outcome: "finished",
    units_by_kind: { build: { count: 2, p50_s: null, p90_s: 12 } },
    workers_over_time: [{ t: "2026-11-12T12:00:30Z", step: 3, live_b: 2, live_h: 1 }],
    ram_gib: { min: null, max: 4 },
    swap_mb: { start: 0, peak: 5, end: null },
    scale_events: [{ at: "2026-11-12T12:00:30Z", from: 5, to: 3, reason: "presion" }],
    start_step: 5,
    sustained_step: null,
    recommended_start: 3,
    disk_free_gib: { start: 20, end: null },
  };
}
