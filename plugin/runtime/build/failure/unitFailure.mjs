// Applying the D21 policy to one failed execution of a unit (`report` failures and `fail`). ../failure.mjs is the public entry.
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { atomicWriteJson } from "../fsx.mjs";
import { fencedTwoPhase, findUnit, patchUnit } from "../state.mjs";
import { err } from "./common.mjs";
import { handBack } from "./handback.mjs";
import { decideFailure, planRequeue } from "./policy.mjs";
import { openUnitDoubt } from "./unitDoubt.mjs";

const FAILABLE_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
const FAILABLE_STATES = Object.freeze(["admitted", "running", "reported"]);
const OUTCOME_OF_SOURCE = Object.freeze({ report_rejected: "rejected", g1_red: "rejected", report_failed: "failed", worker_failed: "failed" });

/**
 * Apply the D21 policy to one failed execution of a unit, inside a fencedTwoPhase phase 2 (the caller holds the mutex).
 * The one shared derivation of "what happens next" for `report` (rejected/failed/blocked) and for a worker that ended
 * without a valid report (`failUnit`): requeue at attempt+1, escalate at attempt 3, doubt ladder, dispute, or hand-back.
 * Idempotency key is `input.attempt`: a unit that already moved past it (attempt changed, or `blocked|queued`) is a no-op.
 * @param {{readState: Function, writeState: Function, appendEvent: Function, paths: object, project: string, runId: string}} ctx
 * @param {{unitId: string, attempt: number, source: "report_rejected"|"report_failed"|"worker_failed",
 *   diagnosis?: {cause: string, detail?: string}|null, evidence?: {tests?: string[], command?: string|null, files?: string[]}, reasons: string[],
 *   failure?: {command?: string|null, tail?: string}, override?: "worker_blocked"|null, receivedEvent?: object|null, outcome?: string}} input
 *   `outcome` (optional) labels `attempt-<n>.json` (`rejected|failed|blocked`); by default it follows `source` (`blocked` under the override)
 * @param {object} [deps] see handBack
 * @returns {Promise<{applied: boolean, reason: null|"already_applied", action: "requeue"|"escalate"|"doubt"|"dispute"|"handback",
 *   next_attempt: number|null, cause: string, reason_code: string|null, handback?: {path: string, blocked: string[], stop_run: boolean, notice_es: string, reason_code: string}}>}
 * @throws INVALID_STATE (unknown unit, or a unit that is not admitted/running/reported); INVALID_INPUT (a review-type or consult unit)
 */
export async function applyUnitFailure(ctx, input, deps = {}) {
  const { unitId, attempt, source, diagnosis = null, evidence = {}, reasons = [], failure = {}, override = null, receivedEvent = null } = input;
  const state = await ctx.readState();
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (!FAILABLE_KINDS.includes(unit.kind)) throw err("INVALID_INPUT", `unit ${unitId} is a ${unit.kind} unit: ${unit.kind === "doubt-consult" ? "doubt answer" : "review-record"} files its result, not a failure`);
  if (unit.attempt !== attempt || unit.state === "blocked" || unit.state === "queued") {
    const requeued = unit.state === "queued" && unit.attempt > attempt;
    return { applied: false, reason: "already_applied", action: unit.state === "blocked" ? "handback" : "requeue", next_attempt: requeued ? unit.attempt : null, cause: diagnosis?.cause ?? "code", reason_code: null };
  }
  if (!FAILABLE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} is ${unit.state}: it has no execution to fail`);

  let decision = decideFailure({ state, unit, wos: unit.wos, failure: { source }, diagnosis, evidence });
  if (override === "worker_blocked" && (decision.action === "requeue" || decision.action === "escalate")) {
    decision = { ...decision, action: "handback", attempt: null, cause: diagnosis?.cause ?? "owner", reason_code: "worker_blocked" };
  }
  const tests = decision.evidence.tests;
  await atomicWriteJson(path.join(ctx.paths.unitDir(unit.id), `attempt-${unit.attempt}.json`), {
    attempt: unit.attempt, outcome: input.outcome ?? (decision.reason_code === "worker_blocked" ? "blocked" : OUTCOME_OF_SOURCE[source] ?? "failed"),
    reason: reasons.join("; "), failing: tests, tail: failure.tail ?? "", diagnosis,
  }, { fs: deps.fs });
  releaseToken(unit.id, { file: ctx.paths.admissionFile });
  const base = { applied: true, reason: null, action: decision.action, next_attempt: null, cause: decision.cause, reason_code: decision.reason_code };

  if (decision.action === "requeue" || decision.action === "escalate") {
    const plan = planRequeue({ state, unitId: unit.id, decision });
    await ctx.writeState(plan.state);
    for (const event of [...(receivedEvent ? [receivedEvent] : []), ...plan.events]) await ctx.appendEvent(event);
    return { ...base, next_attempt: decision.attempt };
  }
  if (decision.action === "doubt" || decision.action === "dispute") {
    await ctx.writeState(patchUnit(state, unit.id, { state: "reported", token_hash: null }));
    if (receivedEvent) await ctx.appendEvent(receivedEvent);
    await ctx.appendEvent({ type: "unit_state", data: { unit: unit.id, from: unit.state, to: "reported" } });
    return base;
  }
  if (receivedEvent) await ctx.appendEvent(receivedEvent);
  const back = await handBack(ctx, {
    unitId: unit.id, cause: decision.cause, reasonCode: decision.reason_code, reason: reasons.join("; "),
    failure: { command: failure.command ?? evidence.command ?? null, tail: failure.tail ?? "" }, diagnosis,
  }, deps);
  return { ...base, handback: { path: back.path, blocked: back.blocked.map((b) => b.unit), stop_run: back.stop_run, notice_es: back.notice_es, reason_code: decision.reason_code } };
}

/**
 * Fenced: a unit's execution failed without a valid report (worker crashed, watchdog, unreadable or invalid report.json).
 * Policy is the unchanged D21 one via {@link applyUnitFailure} (source `worker_failed`): attempt 1 -> attempt 2 on the same unit,
 * attempt 2 -> attempt 3 only when the evidence changed with a diagnosis, otherwise hand-back; budget 3 -> hand-back.
 * Not a public CLI command (no dispatcher entry); `next` calls it outside its own mutex section.
 * @param {{project: string, epoch: number, unit: string, attempt: number, cause?: "env-infra"|"code", detail: string,
 *   command?: string|null, tail?: string}} input
 * @param {object} [deps] see handBack
 * @returns {Promise<{ok: true, cmd: "fail", unit: string, applied: boolean, reason: string|null, action: string,
 *   next_attempt: number|null, handback?: object}>}
 * @throws USAGE (missing unit/attempt/detail), FENCE (exit 3), INVALID_STATE, INVALID_INPUT
 */
export async function failUnit(input, deps = {}) {
  const { project, epoch, unit, attempt, cause, detail, command = null, tail = "" } = input ?? {};
  if (!unit) throw err("USAGE", "fail needs a unit");
  if (!Number.isInteger(Number(attempt)) || attempt === null || attempt === undefined || attempt === "") throw err("USAGE", "fail needs the attempt of the failed execution");
  if (!String(detail ?? "").trim()) throw err("USAGE", "fail needs a detail");
  const diagnosis = { cause: cause ?? "code", detail };
  const out = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
    const res = await applyUnitFailure(ctx, {
      unitId: unit, attempt: Number(attempt), source: "worker_failed", diagnosis,
      evidence: { tests: [], command: command ?? null, files: [] }, reasons: [detail], failure: { command, tail },
    }, deps);
    return { ok: true, cmd: "fail", unit, applied: res.applied, reason: res.reason, action: res.action, next_attempt: res.next_attempt, ...(res.handback ? { handback: res.handback } : {}) };
  });
  // A doubt/dispute decision leaves the unit `reported` with no doubt record: open it now (B2), outside the mutex section.
  if (out.applied && (out.action === "doubt" || out.action === "dispute")) {
    const opened = await openUnitDoubt({ project, epoch, unit, diagnosis, actor: deps.actor }, deps);
    return opened.opened ? { ...out, doubt_opened: opened } : { ...out, action: "handback", next_attempt: null, handback: opened.handback };
  }
  return out;
}
