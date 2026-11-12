/** Public, serializable run projection. Secret hashes, paths and token files never cross this boundary. */
export interface BuildRunState {
  schema: 2;
  engine: "v2";
  run_id: string;
  epoch: number;
  coordinator: "claude-session" | "codex-session" | "drive";
  label: "claude" | "codex";
  size: "touch" | "feature" | "giant";
  status: "active" | "paused" | "waiting_owner" | "waiting_gate" | "finished" | "stopped";
  status_reason: string | null;
  tranche: { index: number; of: number } | null;
  scope: { card: string | null; frds: string[]; wos: string[]; out_of_scope: string[] };
  integration: { branch: string };
  last_safe_point: { sha: string; kind: string; at: string } | null;
  units: BuildRunUnit[];
  jobs: {
    id: string;
    kind: "g2" | "land" | "worker";
    unit: string | null;
    frd: string | null;
    h_slot: boolean;
    state: "running" | "done" | "dead";
    started_at: string;
  }[];
}
/** Engine unit states stay distinct from work-order frontmatter states. */
export interface BuildRunUnit {
  id: string;
  kind:
    | "docs"
    | "tests"
    | "build"
    | "patch"
    | "review"
    | "audit"
    | "doubt-consult"
    | "deferred-review";
  wos: string[];
  frd: string | null;
  state:
    | "queued"
    | "admitted"
    | "running"
    | "reported"
    | "committed"
    | "integrated"
    | "reviewing"
    | "patching"
    | "verified"
    | "landed"
    | "parked"
    | "waiting_gate"
    | "blocked";
  attempt: number;
  worker: { runtime: "claude" | "codex"; model: string; effort: string | null } | null;
  branch: string | null;
  depends_on: string[];
  pending_answer: string | null;
  parked: "owner_question" | "built_on_assumption" | "no_reviewer" | null;
  waiting_gate: "production" | "money" | "delete" | "external" | null;
}
/** Retrospective host journal record; RAM means available memory and null never means zero. */
export interface PerformanceRecord {
  run_id: string;
  project: string;
  plugin_version: string;
  start: string;
  end: string;
  outcome: string;
  units_by_kind: Record<string, { count: number; p50_s: number | null; p90_s: number | null }>;
  workers_over_time: { t: string; step: number; live_b: number; live_h: number }[];
  ram_gib: { min: number | null; max: number | null };
  swap_mb: { start: number | null; peak: number | null; end: number | null };
  scale_events: { at: string; from: number; to: number; reason: string }[];
  start_step: number;
  sustained_step: number | null;
  recommended_start: number;
  disk_free_gib: { start: number | null; end: number | null };
}
/** Present source failures are data, never disguised as absent input. */
export interface BuildSourceError {
  path: string;
  reason: string;
}
/** Sanitized admission data: step-change timestamp is not a heartbeat. */
export interface BuildAdmission {
  step: number;
  reason: string;
  changedAt: string;
  diskWaiting: boolean;
}
/** Shared reader result. Performance attribution is basename-only, as in the producer schema. */
export interface BuildRun {
  present: boolean;
  state: BuildRunState | null;
  admission: BuildAdmission | null;
  stateMtimeMs: number | null;
  admissionMtimeMs: number | null;
  lease: {
    run_id?: string;
    epoch?: number;
    renewed_at: string;
    ttl_seconds: number;
    quiesced_at?: string;
    released_at?: string;
  } | null;
  matchesLease: boolean;
  live: boolean;
  performance: PerformanceRecord[];
  performanceIdentity: "basename-only";
  errors: BuildSourceError[];
}
