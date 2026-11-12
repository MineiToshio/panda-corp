// Failure policy (pure, D21): evidence identity, the per-unit execution budget, the failure decision and the state plans
// of a requeue and a hand-back. No I/O here; ../failure.mjs is the public entry.
import { sha256Hex } from "../fsx.mjs";
import { findUnit, isTerminalUnit } from "../state.mjs";
import { EVIDENCE_SOURCES, POLICY, err, oneLine, uniqSorted, woKey } from "./common.mjs";

/**
 * Evidence of one failure as the CLI saw it (its own G1/G2 re-run plus the diff), and its identity hash.
 * The hash covers the failing test ids, the normalised command, the implicated files and the diagnosis CAUSE; the
 * diagnosis prose is left out on purpose (a model rewords it every time, which would make "identical" unreachable).
 * @param {{tests?: string[], command?: string|null, files?: string[], diagnosis?: {cause: string}|null}} input
 * @returns {{tests: string[], command: string|null, files: string[], cause: string|null, hash: string}}
 */
export function buildEvidence({ tests = [], command = null, files = [], diagnosis = null } = {}) {
  const canon = { tests: uniqSorted(tests), command: command ? oneLine(command, 2000) : null, files: uniqSorted(files), cause: diagnosis?.cause ?? null };
  return { ...canon, hash: sha256Hex(JSON.stringify(canon)) };
}

/**
 * Highest attempt already spent on any of the given work orders (build and patch units only).
 * The 3-execution budget is counted per WO as this maximum (A13).
 * @param {object} state run state
 * @param {string[]} wos work order ids
 * @returns {number} 0 when nothing ran
 */
export function executionsUsed(state, wos) {
  const wanted = new Set((wos ?? []).map(woKey));
  let used = 0;
  for (const unit of state.units) {
    if (!["build", "patch"].includes(unit.kind) || !unit.wos.some((wo) => wanted.has(woKey(wo)))) continue;
    // Unattributed gate patches have their own budget, never the batch's WO budget.
    if (unit.id === "u-patch-g3" || unit.id.startsWith("u-patch-g2-")) continue;
    used = Math.max(used, unit.attempt);
  }
  return used;
}

/** Ids of every unit that transitively `depends_on` the given one (the given unit is not included). */
export function dependentsOf(state, unitId) {
  const found = new Set();
  const queue = [unitId];
  while (queue.length) {
    const head = queue.shift();
    for (const unit of state.units) {
      if (unit.depends_on.includes(head) && !found.has(unit.id)) { found.add(unit.id); queue.push(unit.id); }
    }
  }
  return [...found];
}

/** True when the run must stop at a safe point because of consecutive `env-infra` hand-backs (BUILD-15, A11). */
export const envInfraStop = (state) => (state.handbacks_in_a_row ?? 0) >= POLICY.ENV_INFRA_STREAK_STOP;

const handbackDecision = (base, reasonCode, cause) => ({ ...base, action: "handback", attempt: null, cause, reason_code: reasonCode });

/**
 * Decide what a failed execution leads to (D21). Pure.
 *
 * `failure.source` is one of `report_rejected | report_failed | worker_failed | g1_red | review_reopen | g2_red | g3_red`
 * (`worker_failed` = the worker ended without a valid report; same-unit mode, NOT an evidence source). Report-side
 * failures re-queue the SAME unit at attempt+1 (`unit_mode:"same"`); reviewer and gate failures need a new `patch`
 * unit (`unit_mode:"patch"`) whose attempt is the number returned here.
 *
 * Actions: `requeue` (attempt 2), `escalate` (attempt 3, the CLI's own automatic escalation, journaled as `escalated`),
 * `doubt` (spec-ambiguous or a missing decision: the doubt ladder, no attempt consumed), `dispute` (test-defective, the
 * reviewer answers once: no attempt consumed), `handback` (`reason_code` says why).
 *
 * @param {{state: object, unit?: object|null, wos?: string[], failure?: {source?: string}, diagnosis?: {cause: string, detail?: string}|null,
 *   evidence?: object, reviewer_replies?: number, decision_missing?: boolean, human_gate?: string|null}} input
 *   `unit` is the failing unit (omit for a brand-new patch); `wos` defaults to `unit.wos` and must be the IMPLICATED work orders
 * @returns {{action: string, attempt: number|null, failed_attempt: number, unit_mode: "same"|"patch", cause: string, reason_code: string|null, evidence: object, evidence_hash: string}}
 */
export function decideFailure(input) {
  const { state, unit = null, failure = {}, diagnosis = null, reviewer_replies: replies = 0, decision_missing: decisionMissing = false, human_gate: humanGate = null } = input;
  const wos = input.wos ?? unit?.wos ?? [];
  const evidence = buildEvidence({ ...(input.evidence ?? {}), diagnosis });
  const failedAttempt = Math.max(unit?.attempt ?? 0, executionsUsed(state, wos), 1);
  const cause = diagnosis?.cause ?? (humanGate ? "gate" : "code");
  const mode = EVIDENCE_SOURCES.includes(failure.source) ? "patch" : "same";
  const base = { failed_attempt: failedAttempt, unit_mode: mode, cause, reason_code: null, evidence, evidence_hash: evidence.hash };

  if (humanGate) return handbackDecision(base, "human_gate", "gate");
  if (diagnosis?.cause === "spec-ambiguous" || decisionMissing) return { ...base, action: "doubt", attempt: null };
  if (diagnosis?.cause === "dependency") return handbackDecision(base, "dependency_missing", cause);
  if (diagnosis?.cause === "test-defective") {
    return replies >= 1 ? handbackDecision(base, "test_defective_disputed", cause) : { ...base, action: "dispute", attempt: null };
  }
  if (failedAttempt >= POLICY.MAX_EXECUTIONS) return handbackDecision(base, "budget_exhausted", cause);
  if (failedAttempt === 1) return { ...base, action: "requeue", attempt: 2 };

  // failedAttempt === 2: attempt 3 only with a diagnosis (or the reviewer/gate's own RED evidence) and evidence that changed.
  const hasEvidence = evidence.tests.length > 0 || evidence.files.length > 0;
  if (!diagnosis && !(EVIDENCE_SOURCES.includes(failure.source) && hasEvidence)) return handbackDecision(base, "no_diagnosis", cause);
  const previousHash = unit?.evidence_hash ?? input.previous_evidence_hash ?? null;
  if (previousHash && previousHash === evidence.hash) return handbackDecision(base, "evidence_identical", cause);
  return { ...base, action: "escalate", attempt: POLICY.MAX_EXECUTIONS };
}

/**
 * State and journal effect of a `requeue`/`escalate` decision on the SAME unit (pure): attempt+1 in place, state `queued`,
 * token released, evidence hash recorded. The journal gets the full unit (`unit_queued`, A14) and, for attempt 3, `escalated`.
 * @param {{state: object, unitId: string, decision: object}} input
 * @returns {{state: object, events: {type: string, data: object}[]}}
 */
export function planRequeue({ state, unitId, decision }) {
  if (decision.action !== "requeue" && decision.action !== "escalate") throw err("INVALID_INPUT", `cannot requeue on a ${decision.action} decision`);
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  const next = { ...unit, attempt: decision.attempt, state: "queued", token_hash: null, evidence_hash: decision.evidence_hash };
  const events = [{ type: "unit_queued", data: next }];
  if (decision.action === "escalate") {
    events.push({ type: "escalated", data: { unit: unitId, attempt: decision.attempt, evidence: { tests: decision.evidence.tests, command: decision.evidence.command, files: decision.evidence.files, cause: decision.evidence.cause } } });
  }
  return { state: { ...state, units: state.units.map((u) => (u.id === unitId ? next : u)) }, events };
}

/**
 * State and journal effect of a hand-back (pure): the unit and every non-terminal dependent become `blocked` (the run's
 * terminal state for parked work, A11), their tokens are voided, and the env-infra streak is updated like replay does.
 * The open `doubt-consult` units of a doubt raised by any of them (same `doubt_id`) are settled `blocked` too (role `consult`).
 * @param {{state: object, unitId: string, cause: string, reasonCode: string, reason: string, path?: string|null}} input
 * @returns {{state: object, events: {type: string, data: object}[], blocked: {unit: string, from: string, role: "self"|"dependent"|"consult"}[], stop_run: boolean}}
 */
export function planHandback({ state, unitId, cause, reasonCode, reason, path: handbackPath = null }) {
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (unit.kind === "doubt-consult") throw err("INVALID_INPUT", `unit ${unitId} is a doubt consult: file its answer with doubt answer, a hand-back is not allowed`);
  const targets = [{ unit, role: "self" }];
  for (const id of dependentsOf(state, unitId)) {
    const dep = findUnit(state, id);
    if (!isTerminalUnit(dep)) targets.push({ unit: dep, role: "dependent" });
  }
  // N3: a consult of a doubt raised by a handed-back unit has no depends_on edge; it is settled with it, so no
  // decision of that doubt can re-queue a blocked unit and no consult keeps running for nothing.
  const doubtIds = new Set(targets.map((t) => t.unit.doubt_id).filter(Boolean));
  for (const u of state.units) {
    if (u.kind === "doubt-consult" && doubtIds.has(u.doubt_id) && !isTerminalUnit(u)) targets.push({ unit: u, role: "consult" });
  }
  const ids = new Set(targets.map((t) => t.unit.id));
  const streak = cause === "env-infra" ? (state.handbacks_in_a_row ?? 0) + 1 : 0;
  const next = {
    ...state,
    handbacks_in_a_row: streak,
    units: state.units.map((u) => (ids.has(u.id) ? { ...u, state: "blocked", token_hash: null, parked: null, pending_answer: null, waiting_gate: null } : u)),
  };
  const events = [
    { type: "handback", data: { unit: unitId, cause, reason_code: reasonCode, reason: oneLine(reason, 400), attempt: unit.attempt, path: handbackPath, blocked: targets.map((t) => t.unit.id) } },
    ...targets.map((t) => ({ type: "unit_state", data: { unit: t.unit.id, from: t.unit.state, to: "blocked" } })),
  ];
  return { state: next, events, blocked: targets.map((t) => ({ unit: t.unit.id, from: t.unit.state, role: t.role })), stop_run: streak >= POLICY.ENV_INFRA_STREAK_STOP };
}

/**
 * Apply a pure plan under a phase-2 ctx of `fencedTwoPhase` (state first, then the journal events in order).
 * @param {{writeState: Function, appendEvent: Function}} ctx
 * @param {{state: object, events: object[]}} plan
 */
export async function commitPlan(ctx, plan) {
  await ctx.writeState(plan.state);
  for (const event of plan.events) await ctx.appendEvent(event);
}
