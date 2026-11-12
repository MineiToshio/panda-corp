// Landing: the land decision once the batch is complete, the integration worktree bootstrap before a landing
// (FIX-D-4), the one security audit per build (BUILD-10) and the risk zone of a review.
import { bootstrapIntegrationWorktree } from "../integrate.mjs";
import { findUnit, newUnit } from "../state.mjs";
import { FRD_WORK_KINDS, LAND_RETRY_EXITS, LAND_RETRY_S } from "./constants.mjs";
import { cellOf, err, fenceOf, fresh, integrationProductRoot, integrationRoot, mutate, nowMs, routingDeps, shapeOf, sibling } from "./context.mjs";
import { batchState } from "./scope.mjs";

export async function landDecision(run, state, pol, deferredEntries, notes = []) {
  const jobs = state.jobs.filter((j) => j.kind === "land");
  if (jobs.some((j) => j.state === "running")) return { state, action: null, waitLand: false };
  const batch = batchState(state);
  if (!batch.complete) return { state, action: null, waitLand: false };
  const last = jobs.at(-1);
  if (last && LAND_RETRY_EXITS.includes(last.exit) && nowMs(run.d) - Date.parse(last.started_at) < LAND_RETRY_S * 1000) {
    return { state, action: null, waitLand: true };
  }
  const audit = await ensureAudit(run, state, pol, deferredEntries);
  if (audit.queued) return { state: audit.state, action: null, waitLand: false };
  const boot = await ensureIntegrationBootstrap(run, state, batch, notes);
  if (!boot.ok) return { state: await fresh(run), action: null, waitLand: false, bootFailed: true, diskBlocked: boot.disk === true };
  return { state, action: "land", waitLand: false };
}

/**
 * The land job's G3 (`merge-queue.sh` -> `verify.sh`) runs in the integration worktree, so that checkout must be
 * bootstrapped before a landing is returned (FIX-D-4). Same contract as a G2 snapshot (exit 75, B5): a failed bootstrap
 * is an environment failure: no land job, no G3 verdict, no patch; the first ready unit of the batch (an FRD work unit
 * when there is one) is handed back with cause `env-infra` (it and its dependents `blocked`, R4), which counts toward the
 * ENV_INFRA_STOP streak. The bootstrap is re-run at the next landing attempt (a successful one is never repeated).
 * Runs outside the lease mutex.
 * @returns {Promise<{ok: boolean}>}
 */
async function ensureIntegrationBootstrap(run, state, batch, notes) {
  const { d, ref } = run;
  const boot = await bootstrapIntegrationWorktree({ project: ref.project, runId: state.run_id, root: integrationRoot(run, state) }, d);
  if (boot.ok) return { ok: true };
  if (boot.exit === 4) return { ok: false, disk: true };
  const ready = batch.ready.map((id) => findUnit(state, id)).filter(Boolean);
  const unit = ready.find((u) => FRD_WORK_KINDS.includes(u.kind)) ?? ready[0];
  const why = `la copia de la rama de integración no se pudo preparar para aterrizar (worktree-bootstrap.sh salió con ${boot.exit ?? "?"})`;
  if (!unit) throw err("ENGINE_FAILURE", `next: ${why} and the batch has no unit to hand back`);
  const res = await (await sibling(d, "failure", "handbackCommand"))({ ...fenceOf(run), unit: unit.id, reason: why, cause: "env-infra" }, d);
  notes.push(`No se aterriza: ${why}. Se devuelve ${unit.id} por fallo del entorno; se reintenta al aterrizar de nuevo.`);
  if (res?.notice_es) notes.push(res.notice_es);
  return { ok: false };
}

const auditUnitId = (state) => `u-audit-${state.run_id}`;

/** One security audit per build (BUILD-10): queued when the run diff asks for it and none ran or was deferred. */
async function ensureAudit(run, state, pol, deferredEntries) {
  const id = auditUnitId(state);
  if (findUnit(state, id) || deferredEntries.some((e) => e.unit === id)) return { queued: false, state };
  const risk = await runRisk(run, state);
  if (!risk.audit) return { queued: false, state };
  const { d, ref } = run;
  const cell = d.routing.builderCell({ kind: "audit", size: state.size, zone: risk.zone, attempt: 1 }, { label: state.label, zone: risk.zone, attempt: 1, quota: pol, shape: shapeOf(state), coordinator: state.coordinator }, routingDeps(d));
  if (cell.deferred) {
    // No company can audit now (BUILD-14): the audit waits in the deferred ledger; the batch lands without it.
    const author = state.units.filter((u) => u.worker && u.worker.effort && FRD_WORK_KINDS.includes(u.kind)).map((u) => cellOf(u.worker)).at(-1);
    if (!author) throw err("INVALID_STATE", "the deferred audit needs an author cell and no build unit has one", { hint: "rebuild-state" });
    await (await sibling(d, "deferred", "enqueueDeferred"))(ref.project, {
      unit: id, kind: "audit", frd: null, sha_range: `${state.integration.base_sha}..${state.integration.branch}`, author,
      reviewer_used: null, degraded: cell.degraded ?? "quota_90", needed: cell.deferred.runtime,
    }, d);
    return { queued: false, state };
  }
  const unit = newUnit({ id, kind: "audit", frd: null, wos: [], zone: risk.zone, risk_rules: risk.rules ?? [] });
  const next = await mutate(run, (s) => (findUnit(s, id) ? {} : { state: { ...s, units: [...s.units, unit] }, events: [{ type: "unit_queued", data: unit }] }));
  return { queued: true, state: next };
}

async function runRisk(run, state, head = "HEAD") {
  return run.d.risk.computeRisk({ root: await integrationProductRoot(run, state), range: `${state.integration.base_sha}..${head}` }, run.d.riskDeps ?? {});
}

/** Risk zone of the FRD review: the range the G2 judged (`base..<pinned sha>`), else `base..HEAD`. */
export async function reviewZone(run, state, head) {
  if (!state.integration?.base_sha) return null;
  const r = await runRisk(run, state, head ?? "HEAD");
  return { zone: r.zone, rules: r.rules ?? [] };
}
