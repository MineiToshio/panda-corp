import path from "node:path";
import { cache } from "react";
import { now } from "../clock/clock";
import { isLive } from "../status/liveness";
import { performanceJournalPath, readPerformance } from "./performance";
import { schemaError } from "./schema";
import { readBuildSchema } from "./schema-source";
import { parseJson, readSource } from "./sources";
import type { BuildAdmission, BuildRun, BuildRunState, BuildSourceError } from "./types";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function text(value: unknown): value is string {
  return typeof value === "string";
}
function texts(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}
function nullableText(value: unknown): boolean {
  return value === null || text(value);
}
function fields(
  value: unknown,
  keys: readonly string[],
  check: (field: unknown) => boolean,
): boolean {
  return object(value) && keys.every((key) => check(value[key]));
}
function unitShape(value: unknown): boolean {
  if (!object(value)) return false;
  return (
    fields(value, ["id", "kind", "state"], text) &&
    fields(value, ["frd", "branch", "pending_answer", "parked", "waiting_gate"], nullableText) &&
    texts(value.wos) &&
    texts(value.depends_on) &&
    Number.isSafeInteger(value.attempt) &&
    (value.worker === null ||
      (fields(value.worker, ["runtime", "model"], text) &&
        fields(value.worker, ["effort"], nullableText)))
  );
}
function jobShape(value: unknown): boolean {
  return (
    fields(value, ["id", "kind", "state", "started_at"], text) &&
    fields(value, ["unit", "frd"], nullableText) &&
    fields(value, ["h_slot"], (field) => typeof field === "boolean")
  );
}
/** The producer schema may evolve independently; check the containers this projection consumes. */
function stateShape(value: unknown): boolean {
  if (!object(value)) return false;
  return (
    value.schema === 2 &&
    value.engine === "v2" &&
    fields(value, ["run_id", "coordinator", "label", "size", "status"], text) &&
    nullableText(value.status_reason) &&
    Number.isSafeInteger(value.epoch) &&
    scopeShape(value.scope) &&
    fields(value.integration, ["branch"], text) &&
    Array.isArray(value.units) &&
    value.units.every(unitShape) &&
    Array.isArray(value.jobs) &&
    value.jobs.every(jobShape) &&
    stateMetadataShape(value)
  );
}
function scopeShape(value: unknown): boolean {
  return (
    fields(value, ["card"], nullableText) && fields(value, ["frds", "wos", "out_of_scope"], texts)
  );
}
function stateMetadataShape(value: Record<string, unknown>): boolean {
  return (
    (value.tranche === null || fields(value.tranche, ["index", "of"], Number.isSafeInteger)) &&
    (value.last_safe_point === null || fields(value.last_safe_point, ["sha", "kind", "at"], text))
  );
}
function readState(raw: string, file: string, errors: BuildSourceError[]): BuildRunState | null {
  const value = parseJson(raw, file, errors);
  if (value === undefined) return null;
  const schema = readBuildSchema("state", errors);
  if (!schema) return null;
  const reason = schemaError(value, schema);
  if (reason) {
    errors.push({ path: file, reason });
    return null;
  }
  if (!stateShape(value)) {
    errors.push({
      path: file,
      reason: "Estructura del estado incompatible con el lector de builds",
    });
    return null;
  }
  const state = value as BuildRunState;
  if (
    !state.run_id ||
    state.epoch < 1 ||
    new Set(state.units.map((u) => u.id)).size !== state.units.length
  ) {
    errors.push({ path: file, reason: "Identidad del build o unidades duplicadas inválidas" });
    return null;
  }
  return {
    schema: state.schema,
    engine: state.engine,
    run_id: state.run_id,
    epoch: state.epoch,
    coordinator: state.coordinator,
    label: state.label,
    size: state.size,
    status: state.status,
    status_reason: state.status_reason,
    tranche: state.tranche,
    scope: state.scope,
    integration: { branch: state.integration.branch },
    last_safe_point: state.last_safe_point,
    units: state.units.map((u) => ({
      id: u.id,
      kind: u.kind,
      wos: u.wos,
      frd: u.frd,
      state: u.state,
      attempt: u.attempt,
      worker: u.worker
        ? { runtime: u.worker.runtime, model: u.worker.model, effort: u.worker.effort }
        : null,
      branch: u.branch,
      depends_on: u.depends_on,
      pending_answer: u.pending_answer,
      parked: u.parked,
      waiting_gate: u.waiting_gate,
    })),
    jobs: state.jobs.map((j) => ({
      id: j.id,
      kind: j.kind,
      unit: j.unit,
      frd: j.frd,
      h_slot: j.h_slot,
      state: j.state,
      started_at: j.started_at,
    })),
  };
}
function readLease(raw: string, file: string, errors: BuildSourceError[]): BuildRun["lease"] {
  const value = parseJson(raw, file, errors);
  if (value === undefined) return null;
  if (
    !object(value) ||
    !stamp(value.renewed_at) ||
    typeof value.ttl_seconds !== "number" ||
    !Number.isFinite(value.ttl_seconds) ||
    value.ttl_seconds <= 0
  ) {
    errors.push({ path: file, reason: "Lease con fecha o TTL inválidos" });
    return null;
  }
  if (
    typeof value.run_id !== "string" ||
    !value.run_id.trim() ||
    !Number.isSafeInteger(value.epoch) ||
    Number(value.epoch) < 1
  ) {
    errors.push({ path: file, reason: "Lease con run o epoch inválidos" });
    return null;
  }
  if (
    (value.quiesced_at !== undefined && !stamp(value.quiesced_at)) ||
    (value.released_at !== undefined && !stamp(value.released_at))
  ) {
    errors.push({ path: file, reason: "Lease con cierre inválido" });
    return null;
  }
  return {
    run_id: typeof value.run_id === "string" ? value.run_id : undefined,
    epoch: typeof value.epoch === "number" ? value.epoch : undefined,
    renewed_at: value.renewed_at,
    ttl_seconds: value.ttl_seconds,
    quiesced_at: typeof value.quiesced_at === "string" ? value.quiesced_at : undefined,
    released_at: typeof value.released_at === "string" ? value.released_at : undefined,
  };
}
function readAdmission(
  raw: string,
  file: string,
  errors: BuildSourceError[],
): BuildAdmission | null {
  const value = parseJson(raw, file, errors);
  if (value === undefined) return null;
  if (
    !object(value) ||
    !object(value.tokens) ||
    !Array.isArray(value.history) ||
    (value.disk_waiting !== undefined && typeof value.disk_waiting !== "boolean")
  ) {
    errors.push({ path: file, reason: "Formato de admisión inválido" });
    return null;
  }
  if (value.ladder === null || value.ladder === undefined) return null;
  const ladder = value.ladder;
  if (
    !object(ladder) ||
    typeof ladder.step !== "number" ||
    ![1, 2, 3, 5, 8].includes(ladder.step) ||
    typeof ladder.motivo !== "string" ||
    !stamp(ladder.changed_at)
  ) {
    errors.push({ path: file, reason: "Escalón de admisión inválido" });
    return null;
  }
  return {
    step: ladder.step,
    reason: value.disk_waiting ? "disco" : ladder.motivo,
    changedAt: ladder.changed_at,
    diskWaiting: value.disk_waiting === true,
  };
}
/** Read-only v2 resolver. No engine imports, child processes, writes or token-file reads. */
export function readBuildRun(
  project: string,
  options: { nowMs?: number; hostDir?: string; includePerformance?: boolean } = {},
): BuildRun {
  const errors: BuildSourceError[] = [];
  const stateFile = path.join(project, ".pandacorp/run/build/state.json");
  const leaseFile = path.join(project, ".pandacorp/run/build.lease/lease.json");
  const admissionFile = path.join(project, ".pandacorp/run/build/admission.json");
  const source = readSource(stateFile, errors),
    leaseSource = readSource(leaseFile, errors);
  const admissionSource = readSource(admissionFile, errors);
  const present = Boolean(
    source || leaseSource || errors.some((e) => e.path === stateFile || e.path === leaseFile),
  );
  const state = source ? readState(source.raw, stateFile, errors) : null;
  const lease = leaseSource ? readLease(leaseSource.raw, leaseFile, errors) : null;
  const admission = admissionSource
    ? readAdmission(admissionSource.raw, admissionFile, errors)
    : null;
  const matchesLease = Boolean(
    state && lease && state.run_id === lease.run_id && state.epoch === lease.epoch,
  );
  if (state && lease && !matchesLease)
    errors.push({ path: leaseFile, reason: "Run o epoch no coinciden con state.json" });
  const nowMs = options.nowMs ?? now().getTime();
  const result: BuildRun = {
    present,
    state,
    lease,
    admission,
    matchesLease,
    live: false,
    stateMtimeMs: source?.mtimeMs ?? null,
    admissionMtimeMs: admissionSource?.mtimeMs ?? null,
    performance:
      options.includePerformance === false
        ? []
        : readPerformance(project, performanceJournalPath(options.hostDir), errors),
    performanceIdentity: "basename-only",
    errors,
  };
  return { ...result, live: isLive({ buildRun: result }, nowMs) };
}
/** Request-scoped reader shared by server surfaces; clock freshness is evaluated on every request. */
export const getBuildRun = cache(
  (project: string, view: "full" | "status" = "full"): BuildRun =>
    readBuildRun(project, { includePerformance: view === "full" }),
);
