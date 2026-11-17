// DR-164: one supervised escape from technical fences, with a fresh review before re-ingestion.
// The lease, protected oracles, full verify and actual human gates are never escape hatches.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { assertValid, loadSchema, atomicWriteJson, atomicWriteText, defaultExec, readJson, sha256Hex } from "./fsx.mjs";
import { fencedTwoPhase, findUnit, isTerminalUnit, patchUnit, readState } from "./state.mjs";
import { buildPaths } from "./paths.mjs";
import { git, productPrefix, productRoot, prepareUnitWorktree, readUnitWorkOrders } from "./units.mjs";
import { releaseToken } from "./admission.mjs";
import { readQuota } from "./quota.mjs";
import { builderCell } from "./routing.mjs";
import { inScope } from "./next/scope.mjs";
import { planTestRepair } from "./recovery.mjs";
import { continuationDecision, backoffSeconds } from "../capacity/scheduler.mjs";
import { isTestSurface } from "./units.mjs";
import { assertTaskCell } from "../capacity.mjs";
import * as workers from "./workers.mjs";
import { computeRisk } from "./risk.mjs";
import { readCard } from "./card.mjs";
import { readDeferred, entryForUnit } from "./deferred.mjs";

const err = (code, message) => Object.assign(new Error(message), { code });
const GATES = new Set(["production", "money", "delete", "external"]);
const isGateFile = file => /^(?:\.pandacorp\/|\.github\/|AGENTS\.md$|CLAUDE\.md$|package\.json$)|(?:vitest|playwright|jest|pytest|tox|gate-budget|test-inventory).*\.(?:[cm]?[jt]s|json|ini|toml)$/.test(file);
const SKIPPED = ["ordinary artifact allowlist", "ordinary report/G1 transport", "ordinary attempt budget"];
const fsOf = d => d.fs ?? fsp;
const clean = text => String(text ?? "").replace(/\s+/g, " ").slice(0, 1200);
const protectedHashes = state => Object.assign({}, ...state.units.map(u => ({ ...u.test_hashes, ...u.probe_hashes })));

/** Same class AND same unit/file, independent of attempt, error prose or coordinator epoch. */
export function failureIdentity(unit, failure) {
  const files = [...new Set(failure.files ?? clean(failure.detail).match(/(?:[\w@.\-[\]]+\/)+[\w.\-[\]]+/g) ?? [])].sort();
  return JSON.stringify([failure.code ?? failure.cause ?? "no_progress", unit.id, files]);
}

export function observeTechnicalFailure(state, unitId, failure) {
  const unit = findUnit(state, unitId);
  if (!unit || unit.state === "abandoned" || !inScope(state, unit) || unit.state === "waiting_gate" || (GATES.has(unit.waiting_gate) || GATES.has(unit.protected_action))) return { state, events: [], action: "gate" };
  const history = [...(unit.technical_failures ?? []), { key: failureIdentity(unit, failure), code: failure.code ?? failure.cause ?? "no_progress", detail: clean(failure.detail), files: failure.files ?? [] }];
  const last = history.at(-1);
  const repeated = history.filter(f => f.key === last.key).length >= 2;
  let next = { ...unit, technical_failures: history };
  let type = "technical_failure", action = "retry";
  if (unit.rescue && unit.rescue.phase !== "failed") {
    next = { ...next, state: "abandoned", token_hash: null, parked: null, pending_answer: null,
      rescue: { ...unit.rescue, phase: "failed", failure: last.detail || last.code } };
    type = "unit_abandoned"; action = "abandoned";
  } else if (repeated && !unit.rescue) {
    next = { ...next, state: "rescue", parked: null, pending_answer: null, token_hash: null,
      rescue: { phase: "work", cause: last.key, skipped: SKIPPED, history, protected: protectedHashes(state), worker: null, credential: null } };
    type = "rescue_started"; action = "rescue";
  }
  const retired = ["rescue", "abandoned"].includes(action) ? (state.jobs ?? []).filter(j => j.unit === unitId && j.kind === "worker" && j.state === "running") : [];
  if (retired.length) next.rescue = { ...next.rescue, previous_jobs: [...(next.rescue.previous_jobs ?? []), ...retired] };
  const retiredIds = new Set(retired.map(j => j.id));
  return { state: { ...patchUnit(state, unitId, next), jobs: (state.jobs ?? []).map(j => retiredIds.has(j.id) ? { ...j, state: "done", exit: null } : j), ...(action === "rescue" ? { status: "active", status_reason: null, resumeAt: null } : {}) }, events: [{ type, data: { unit: unitId, cause: last.key, unit_snapshot: next } },
    ...retired.map(j => ({ type: "job_finished", data: { id: j.id, state: "done", exit: null } })),
    ...(action === "rescue" && state.status !== "active" ? [{ type: "capacity_state", data: { patch: { status: "active", status_reason: null, resumeAt: null } } }] : [])], action };
}

async function save(ctx, result) {
  for (const event of result.events) await ctx.appendEvent(event);
  await ctx.writeState(result.state);
  return result;
}

/** Called by failure handlers already holding the mutex; never nests a fence. */
export async function recordTechnicalFailure(ctx, unit, failure, deps = {}) {
  const state = await ctx.readState();
  if (state.run_id !== ctx.runId) throw err("FENCE", "rescue state does not belong to the lease run");
  let result = observeTechnicalFailure(state, unit, failure);
  releaseToken(unit, { file: ctx.paths.admissionFile });
  await save(ctx, result);
  if (result.action === "abandoned") await abandonDependents(ctx, unit, deps);
  return result;
}

async function abandonDependents(ctx, rootId, deps) {
  let state = await ctx.readState();
  const lost = new Set(state.units.filter(u => u.state === "abandoned").map(u => u.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const u of state.units) {
      if (isTerminalUnit(u) || u.state === "waiting_gate" || lost.has(u.id)) continue;
      if (!(u.depends_on ?? []).some(id => lost.has(id))) continue;
      // An FRD-wide reviewer/audit can still judge surviving independent units.
      if (["review", "audit"].includes(u.kind) && u.depends_on.some(id => !lost.has(id))) continue;
      const retired = (state.jobs ?? []).filter(j => j.unit === u.id && j.kind === "worker" && j.state === "running");
      const next = { ...u, state: "abandoned", token_hash: null, rescue: { ...(u.rescue ?? {}), previous_jobs: [...(u.rescue?.previous_jobs ?? []), ...retired], phase: "failed", failure: `dependency abandoned: ${rootId}`, skipped: [], cause: `dependency:${rootId}` } };
      releaseToken(u.id, { file: ctx.paths.admissionFile });
      await ctx.appendEvent({ type: "unit_abandoned", data: { unit: u.id, unit_snapshot: next } });
      for (const j of retired) await ctx.appendEvent({ type: "job_finished", data: { id: j.id, state: "done", exit: null } });
      state = { ...patchUnit(state, u.id, next), jobs: (state.jobs ?? []).map(j => retired.some(r => r.id === j.id) ? { ...j, state: "done", exit: null } : j) }; lost.add(u.id); grew = true;
    }
  }
  await ctx.writeState(state);
  const root = findUnit(state, rootId);
  await atomicWriteJson(path.join(ctx.paths.unitDir(rootId), "abandoned.json"), { unit: rootId, reason: root?.rescue?.failure, history: root?.technical_failures, uncompleted: [...lost] }, { fs: fsOf(deps) });
}

/** Select the actual unresolved work, never turn completed preparation into a spurious failure. */
export async function recoverTechnicalStall(ref, reason, deps = {}) {
  return fencedTwoPhase({ ...ref, deps }, async ctx => {
    const state = await ctx.readState();
    const target = state.units.filter(u => inScope(state, u)).find(u => !isTerminalUnit(u) && u.state !== "waiting_gate" && !u.protected_action && !["integrated", "verified"].includes(u.state))
      ?? state.units.filter(u => inScope(state, u)).find(u => !isTerminalUnit(u) && u.state !== "waiting_gate" && !u.protected_action);
    if (!target) return null;
    return recordTechnicalFailure(ctx, target.id, { code: reason, detail: `Scheduler cannot advance ${target.id}: ${reason}` }, deps);
  }, value => value);
}

async function assertProtected(root, hashes, deps) {
  for (const [file, hash] of Object.entries(hashes)) {
    let content;
    try { content = await fsOf(deps).readFile(path.join(root, file)); } catch { throw err("EVIDENCE", `protected oracle deleted or unreadable: ${file}`); }
    if (sha256Hex(content) !== hash) throw err("EVIDENCE", `protected oracle changed: ${file}; use independent causal oracle repair`);
  }
}

const phasePaths = (paths, id, phase) => ({ brief: path.join(paths.unitDir(id), `rescue-${phase}.md`), report: path.join(paths.unitDir(id), `rescue-${phase}.json`), schema: paths.schemaFile("rescue-report") });

async function updateRescue(ref, id, patch, deps) {
  return fencedTwoPhase({ ...ref, deps }, async ctx => {
    const state = await ctx.readState(), unit = findUnit(state, id);
    const next = { ...unit, rescue: { ...unit.rescue, ...patch } };
    await ctx.appendEvent({ type: "rescue_stage", data: { unit: id, unit_snapshot: next } });
    await ctx.writeState(patchUnit(state, id, next));
  }, value => value);
}

/** Prepare one rescue stage. App lead writes work directly; drive and every review use fresh CLI contexts. */
export async function advanceRescues(ref, deps = {}) {
  const state = await readState(ref.project, deps);
  const approved = state.units.find(u => inScope(state, u) && u.rescue && u.state === "reported" && state.answers?.[`g-${u.id}`] === true);
  if (approved) {
    await fencedTwoPhase({ ...ref, deps }, async ctx => {
      const s = await ctx.readState(), current = findUnit(s, approved.id);
      const next = { ...current, state: "rescue", waiting_gate: null, rescue: { ...current.rescue, authorized_gates: [...new Set([...(current.rescue.authorized_gates ?? []), current.rescue.pending_gate].filter(Boolean))], pending_gate: null } };
      await ctx.appendEvent({ type: "rescue_stage", data: { unit: next.id, unit_snapshot: next } });
      await ctx.writeState(patchUnit(s, next.id, next));
    }, value => value);
    return advanceRescues(ref, deps);
  }
  const unit = state.units.find(u => inScope(state, u) && u.state === "rescue");
  if (!unit) return null;
  const r = unit.rescue, paths = buildPaths(ref.project, deps), files = phasePaths(paths, unit.id, r.phase);
  const out = extra => ({ ok: true, cmd: "next", epoch: ref.epoch, action: "rescue", units: [], notes_es: [`Rescate de ${unit.id}: ${r.phase}. Causa: ${r.cause}.`], ...extra });
  const q = await (deps.quota?.readQuota ?? readQuota)({ file: paths.quotaFile, codexHome: paths.codexHome }, deps);
  if (r.suspension) {
    const projected = { ...unit, worker: { ...r.cell, session_id: r.suspension.sessionId }, pin: { tool: r.cell.runtime, model: r.cell.model, effort: r.cell.effort }, suspension: r.suspension };
    const verdict = continuationDecision(projected, q.readings, Date.now(), state);
    if (!verdict.ready) { await updateRescue(ref, unit.id, { capacity_wait: verdict.resumeAt }, deps); return null; }
    const resumed = await (deps.workers ?? workers).resumeWorker({ project: ref.project, workerId: r.worker.workerId, unit: unit.id, dir: productRoot(unit.worktree, await productPrefix(ref.project, deps)), sequence: r.suspension.sequence, task: r.task, cell: r.cell }, deps);
    if (!resumed.ok) return out({ wait: { reason: "quota", retry_after_s: 60 } });
    await fencedTwoPhase({ ...ref, deps }, async ctx => {
      const s = await ctx.readState(), next = { ...findUnit(s, unit.id), rescue: { ...r, suspension: null } };
      await ctx.appendEvent({ type: "rescue_stage", data: { unit: unit.id, unit_snapshot: next } });
      await ctx.writeState(patchUnit(s, unit.id, next));
    }, value => value);
    return out({ wait: { reason: "workers_running", retry_after_s: 1 } });
  }
  if (r.worker) {
    const h = await (deps.workers ?? workers).pollWorker({ project: ref.project, workerId: r.worker.workerId, unit: unit.id, schemaFile: files.schema, reportFile: files.report }, deps);
    if (h.state === "error") {
      const key = `${h.kind ?? "read"}:${clean(h.detail)}`;
      const count = r.poll_error?.key === key ? r.poll_error.count + 1 : 1;
      if (count >= 2) return failRescue(ref, unit.id, `rescue worker result unreadable twice: ${key}`, deps);
      await updateRescue(ref, unit.id, { poll_error: { key, count } }, deps);
    }
    if (h.state !== "done") return out({ wait: { reason: "workers_running", retry_after_s: 5 } });
    if (h.outcome === "limit" || h.outcome === "capacity_wait") {
      if (h.outcome === "capacity_wait") {
        await updateRescue(ref, unit.id, { worker: null, credential: null, capacity_wait: h.resumeAt }, deps);
        return null;
      }
      const now = Date.now(), rate = h.limit === "rate_limit";
      const reset = h.resetsAt ?? h.resumeAt ?? new Date(now + 60000).toISOString();
      const suspension = { reason: rate ? "rate_limit" : "usage_limit", at: new Date(now).toISOString(), resetAt: reset,
        resumeAt: rate ? new Date(now + backoffSeconds(r.rateAttempts ?? 0, h.retryAfterS) * 1000).toISOString() : reset,
        sessionId: h.sessionId, sequence: (r.resumeSequence ?? 0) + 1, readRetries: 0 };
      await fencedTwoPhase({ ...ref, deps }, async ctx => {
        const s = await ctx.readState(), next = { ...findUnit(s, unit.id), rescue: { ...r, suspension, resumeSequence: suspension.sequence, rateAttempts: (r.rateAttempts ?? 0) + 1 } };
        await ctx.appendEvent({ type: "rescue_stage", data: { unit: unit.id, unit_snapshot: next } });
        await ctx.writeState(patchUnit(s, unit.id, next));
      }, value => value);
      await updateRescue(ref, unit.id, { capacity_wait: suspension.resumeAt }, deps);
      return null;
    }
    if (h.outcome !== "report") return failRescue(ref, unit.id, h.detail ?? h.outcome, deps);
    await atomicWriteJson(files.report, h.report, { fs: fsOf(deps) });
    await rescueResult({ ...ref, unit: unit.id, token: r.credential, file: files.report }, deps);
    return out({ wait: { reason: "gate", retry_after_s: 1 } });
  }
  if (r.credential && state.coordinator === "drive" && !r.worker) {
    await updateRescue(ref, unit.id, { credential: null }, deps);
    return advanceRescues(ref, deps);
  }
  if (r.credential) return out({ rescue: { unit: unit.id, phase: r.phase, via: "session", token: r.credential, worktree: unit.worktree, brief_path: files.brief, report_path: files.report, schema_path: files.schema } });
  const sourceAuthors = state.units.filter(u => (r.review_targets ?? []).includes(u.id)).map(u => u.worker);
  if (unit.kind === "deferred-review") sourceAuthors.push(entryForUnit(await readDeferred(ref.project, deps), unit)?.author);
  const taskUnit = { ...unit, state: "queued", rescue: null, kind: r.phase === "work" ? "build" : "audit", role: r.phase === "work" ? "implementer" : "review", implementerCells: r.author ? [r.author, unit.worker, ...sourceAuthors].filter(Boolean) : undefined,
    unknownImplementer: r.phase !== "work" && (sourceAuthors.some(a => !a) || ["review", "audit", "deferred-review"].includes(unit.kind) && !sourceAuthors.length) };
  const cell = (deps.routing?.builderCell ?? builderCell)(taskUnit, { label: state.label, coordinator: "drive", quota: { readings: q.readings }, shape: "drive", sessionModel: null });
  if (cell.paused) { await updateRescue(ref, unit.id, { capacity_wait: cell.resumeAt, task: cell.task }, deps); return null; }
  const direct = state.coordinator !== "drive" && r.phase === "work";
  const prepared = await fencedTwoPhase({ ...ref, deps }, async ctx => {
    const current = findUnit(await ctx.readState(), unit.id);
    if (current.rescue.credential || current.rescue.worker) throw err("INVALID_STATE", "rescue already dispatched");
    return current;
  }, async current => {
    const integrationTree = path.resolve(ref.project, state.integration.worktree);
    // An engine exception may leave the original CLI writer alive. A signal alone is not
    // proof of termination: preserve its checkout and fork a rescue checkout if uncertain.
    const oldJobs = [...(current.rescue.previous_jobs ?? []), ...(state.jobs ?? []).filter(j => j.unit === current.id && j.state === "running")];
    const oldIds = [...new Set([current.worker?.via === "cli" ? current.worker.worker_id : null, ...oldJobs.map(j => j.worker_id)].filter(Boolean))];
    let displaced = current.rescue.displaced_worker ?? null;
    if (!current.rescue.ownership_settled && (current.worker?.via === "agent" || current.worker?.via === "cli" && !oldIds.length)) displaced = { worktree: current.worktree, worker: current.worker, ids: oldIds };
    if (!current.rescue.ownership_settled && oldIds.length) {
      const api = deps.workers ?? workers;
      try { await (api.stopWorkers ?? workers.stopWorkers)(ref.project, oldIds, deps); } catch { /* isolate when termination cannot be proven */ }
      const observations = await Promise.all(oldIds.map(async workerId => {
        try { return await (api.peekWorker ?? workers.peekWorker)({ project: ref.project, workerId }, deps); } catch { return { state: "unknown" }; }
      }));
      if (observations.some(o => !["dead", "exited"].includes(o.state))) displaced = { worktree: current.worktree, worker: current.worker, ids: oldIds };
    }
    const refs = !displaced && current.worktree && path.resolve(current.worktree) !== integrationTree && await fsOf(deps).stat(current.worktree).then(() => true, () => false)
      ? { worktree: current.worktree, branch: current.branch }
      : displaced && current.rescue.ownership_settled ? { worktree: current.worktree, branch: current.branch }
      : await prepareUnitWorktree({ project: ref.project, runId: state.run_id, unit: displaced ? `${current.id}-rescue` : current.id, attempt: displaced ? 1 : current.attempt }, deps);
    const prefix = await productPrefix(ref.project, deps), root = productRoot(refs.worktree, prefix);
    const wos = await readUnitWorkOrders(root, current.wos, deps);
    const card = state.scope?.card ? await readCard(ref.project, state.scope.card, { where: "any" }, deps) : null;
    const frozen = { ...current.rescue.protected };
    const listed = (await git(deps, root, ["ls-tree", "-r", "--name-only", state.integration.branch, "--", "."])).stdout.split("\n").filter(Boolean);
    for (const file of listed.filter(f => isTestSurface(f) || isGateFile(f))) {
      const content = (await git(deps, root, ["show", `${state.integration.branch}:./${file}`])).stdout;
      frozen[file] = sha256Hex(content);
    }
    // Existing independently repaired hashes are authoritative over their frozen predecessors.
    Object.assign(frozen, protectedHashes(state));
    current.rescue.protected = frozen;
    const token = randomBytes(24).toString("hex");
    const text = ["# Supervised rescue", `Unit: ${unit.id}; stage: ${r.phase}; worktree: ${root}`,
      `Cause: ${r.cause}`, `Exceptions: ${SKIPPED.join(", ")}`, "Complete only this unit's approved objective and necessary consumers. Preserve scope, lease and human gates. Never set PANDACORP_OWNER_RELEASE_OK. Never commit: the CLI records the Rescue trailer.",
      ...(displaced ? [`The previous worker's termination is unproven. Its checkout ${displaced.worktree} is preserved for read-only inspection; never write there. Complete the objective in this isolated rescue checkout.`] : []),
      `Approved run scope: ${JSON.stringify(state.scope)}. Unit kind: ${unit.kind}; role: ${unit.role ?? unit.kind}.`,
      ...(card ? [`Approved objective (Dentro): ${JSON.stringify(card.dentro)}. Excluded work (Fuera): ${JSON.stringify(card.fuera)}.`] : []),
      `Recorded authorization for this rescue: ${JSON.stringify(r.authorized_gates ?? [])}. Reuse only these exact authorized action kinds; other protected actions remain gated.`,
      "Protected oracles MUST NOT be deleted, edited or weakened. For a wrong oracle return status repair with oracle_repair: {files: [protected path], contract: cited AC/framework contract, reason: incompatibility and replacement justification}. The CLI schedules a separate independent tests execution; never bless your own test.",
      "Run bash .pandacorp/verify.sh (full, no partial flags). A fresh independent reviewer must pass before integration.",
      r.phase === "review" ? `Independently inspect and rerun full verify on commit ${r.commit}. Do not edit any file. Reject weakened tests, scope creep and missing acceptance criteria. This is a fresh context, not the author.` : "Execute directly as the supervising coordinator, outside the failed ordinary artifact/report fences. Preserve useful partial work.",
      `Protected hashes: ${JSON.stringify(frozen)}`, `Failure history: ${JSON.stringify(unit.technical_failures)}`,
      `Independent oracle replacement provenance: ${JSON.stringify(r.oracle_repair ?? null)}. Review its cited contract, predecessor and replacement in git; reject a deletion or weaker assertions, including loss of malformed-input coverage.`,
      ...wos.map(w => `## ${w.file}\n${w.text}`),
      `Write JSON to ${files.report} using ${files.schema}: {status: 'done'|'repair'|'failed'|'waiting_gate', summary: string, authored_by: {runtime,model,effort}, gate: null|'production'|'money'|'delete'|'external'}. Return the same JSON.`,
    ].join("\n\n");
    await atomicWriteText(files.brief, text, { fs: fsOf(deps) });
    const worker = direct ? null : await (deps.workers ?? workers).launchWorker({ project: ref.project, runId: state.run_id, unit: unit.id, attempt: unit.attempt, workerId: `rescue-${sha256Hex(`${state.run_id}/${unit.id}/${r.phase}/${r.dispatchSeq ?? 0}`).slice(0, 24)}`, dir: root, briefFile: files.brief, schemaFile: files.schema, cell, task: cell.task }, deps);
    if (worker && !worker.ok) throw err("RESCUE_LAUNCH", worker.detail);
    return { ...refs, root, token, worker, frozen, displaced, scope_base: current.rescue.scope_base ?? (await git(deps, root, ["merge-base", state.integration.branch, "HEAD"])).stdout.trim() };
  }, async (work, _intent, ctx) => {
    const s = await ctx.readState(), current = findUnit(s, unit.id);
    const review_targets = ["review", "audit", "deferred-review"].includes(current.kind) ? s.units.filter(u => ["build", "patch", "tests"].includes(u.kind) && ["integrated", "reviewing", "verified", "landed"].includes(u.state) && (current.kind === "audit" || (current.frd ? u.frd === current.frd : current.depends_on.includes(u.id)))).map(u => u.id) : [];
    const next = { ...current, worktree: work.worktree, branch: work.branch, rescue: { ...current.rescue, ownership_settled: true, displaced_worker: work.displaced, review_targets, scope_base: work.scope_base, dispatchSeq: (r.dispatchSeq ?? 0) + 1, capacity_wait: null, protected: work.frozen, credential: work.token, cell: { runtime: cell.runtime, model: cell.model, effort: cell.effort }, task: cell.task, worker: work.worker, base: current.rescue.base ?? (await git(deps, work.root, ["rev-parse", "HEAD"])).stdout.trim() } };
    await ctx.appendEvent({ type: "rescue_stage", data: { unit: unit.id, phase: r.phase, unit_snapshot: next } });
    await ctx.writeState(patchUnit(s, unit.id, next));
    return { ...work, current: next };
  });
  return out({ rescue: { unit: unit.id, phase: r.phase, via: direct ? "session" : "cli", token: direct ? prepared.token : undefined, worktree: prepared.root, brief_path: files.brief, report_path: files.report, schema_path: files.schema } });
}

async function failRescue(ref, unit, detail, deps) {
  await fencedTwoPhase({ ...ref, deps }, ctx => recordTechnicalFailure(ctx, unit, { code: "rescue_failed", detail }, deps), value => value);
  return { ok: true, cmd: "next", action: "rescue", outcome: "abandoned", unit, units: [], wait: { reason: "gate", retry_after_s: 1 }, notes_es: [`Rescate fallido de ${unit}: continúa el trabajo independiente.`] };
}

/** Fenced re-ingestion. A self-report never certifies success: hash, review cell, tree and full verify are rechecked. */
export async function rescueResult({ project, epoch, unit: id, token, file, actor = "cli" }, deps = {}) {
  const ref = { project, epoch, actor };
  const report = await readJson(file, { fs: fsOf(deps) });
  assertValid(await loadSchema("rescue-report", { fs: fsOf(deps) }), report, { label: "rescue report", code: "INVALID_INPUT" });
  return fencedTwoPhase({ ...ref, deps }, async ctx => {
    const state = await ctx.readState(), unit = findUnit(state, id);
    if (!unit || unit.state !== "rescue" || !token || unit.rescue.credential !== token) throw err("FENCE", "stale rescue stage credential");
    if (!report || !["done", "repair", "failed", "waiting_gate"].includes(report.status) || !clean(report.summary)) throw err("INVALID_INPUT", "invalid rescue result");
    return { state, unit };
  }, async ({ state, unit }) => {
    const r = unit.rescue, prefix = await productPrefix(project, deps), root = productRoot(unit.worktree, prefix);
    if (report.status === "waiting_gate") {
      if (!GATES.has(report.gate)) throw err("INVALID_INPUT", "rescue gate must name an actual protected action");
      return { gate: report.gate };
    }
    if (report.status === "failed") return { failure: report.summary };
    if (report.status === "repair") {
      if (r.phase !== "work" || !report.oracle_repair?.files?.length || !report.oracle_repair.contract || !report.oracle_repair.reason) throw err("INVALID_INPUT", "oracle repair requires files, contract and justification");
      await assertProtected(root, r.protected, deps);
      return { repair: report.oracle_repair };
    }
    try {
      assertTaskCell(r.task, report.authored_by);
      if (r.worker && ["runtime", "model", "effort"].some(k => report.authored_by[k] !== r.cell[k])) throw err("EVIDENCE", "rescue author must match the dispatched worker cell");
      if (r.phase === "review" && JSON.stringify(report.authored_by) !== JSON.stringify(r.cell)) {
        const c = report.authored_by;
        if (!c || ["runtime", "model", "effort"].some(k => c[k] !== r.cell[k])) throw err("EVIDENCE", "review must match the independent dispatched cell");
      }
      const hashes = { ...r.protected, ...protectedHashes(state) };
      await assertProtected(root, hashes, deps);
      if (r.phase === "review") {
        if ((await git(deps, root, ["rev-parse", "HEAD"])).stdout.trim() !== r.commit || (await git(deps, root, ["status", "--porcelain"])).stdout.trim()) throw err("EVIDENCE", "review changed the candidate tree");
      }
      const machineChanges = (await git(deps, root, ["diff", "--name-only", r.base])).stdout;
      if (machineChanges.split("\n").some(isGateFile)) throw err("EVIDENCE", "rescue cannot alter gate or state machinery");
      if ((await git(deps, root, ["rev-parse", "HEAD"])).stdout.trim() !== (r.phase === "work" ? r.base : r.commit)) throw err("EVIDENCE", "only the CLI may commit rescue work");
      const verified = await (deps.verifyRescue ?? (async root => (deps.exec ?? defaultExec)("bash", [".pandacorp/verify.sh"], { cwd: root })))(root);
      if (verified.code !== 0) throw err("EVIDENCE", "full project verify is red during rescue");
      await assertProtected(root, hashes, deps);
      if (r.phase === "review" && (await git(deps, root, ["status", "--porcelain"])).stdout.trim()) throw err("EVIDENCE", "full review verify changed the candidate tree");
      if (r.phase === "work") {
        const changed = (await git(deps, root, ["diff", "--name-only", r.scope_base ?? r.base])).stdout.split("\n").filter(Boolean);
        const added = (await git(deps, root, ["ls-files", "--others", "--exclude-standard"])).stdout.split("\n").filter(Boolean);
        const risk = changed.length || added.length ? await (deps.computeRisk ?? computeRisk)({ root, files: [...new Set([...changed, ...added])] }, deps) : { failclosed: false };
        if ((risk.failclosed || risk.signals?.classify?.some(h => h.signal === "S8")) && !(r.authorized_gates ?? []).includes("delete")) return { gate: "delete" };
        // Actual dirty diff must be inspected as well as committed history.
        const changes = (await git(deps, root, ["diff", "--name-only", "HEAD"])).stdout;
        if (/^\.pandacorp\/(?:verify\.sh|status\.yaml)|^AGENTS\.md|^CLAUDE\.md/m.test(changes)) throw err("EVIDENCE", "rescue cannot alter gate or state machinery");
        const testFiles = [...new Set([...(await git(deps, root, ["ls-files"])).stdout.split("\n"), ...added])].filter(isTestSurface);
        for (const file of testFiles) if (await fsOf(deps).stat(path.join(root, file)).then(s => s.isFile(), () => false)) hashes[file] = sha256Hex(await fsOf(deps).readFile(path.join(root, file)));
        await git(deps, root, ["add", "-A"]);
        await git(deps, root, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "--no-verify", "-m", `fix(build): rescue ${id}\n\nUnit: ${id}\nRescue: ${id} ${clean(r.cause)}`]);
        return { commit: (await git(deps, root, ["rev-parse", "HEAD"])).stdout.trim(), author: report.authored_by, hashes };
      }
      return { success: true, commit: r.commit };
    } catch (error) { return { failure: clean(error.message) }; }
  }, async (result, intent, ctx) => {
    const state = await ctx.readState(), unit = findUnit(state, id), r = unit.rescue;
    if (r.credential !== intent.unit.rescue.credential) throw err("FENCE", "rescue stage changed");
    if (result.repair) {
      const request = result.repair, record = { id: `rescue-${id}`, unit: id, question: `${request.contract}: ${request.files.join(", ")}`, why: request.reason, options: [{ id: "fix-test", text: request.reason }] };
      const tests = Object.fromEntries(Object.entries(r.protected).filter(([file]) => isTestSurface(file)));
      const planned = planTestRepair(patchUnit(state, id, { test_hashes: { ...unit.test_hashes, ...tests } }), record);
      for (const event of planned.events) await ctx.appendEvent(event);
      await ctx.writeState(planned.state);
      return { ok: true, cmd: "rescue", unit: id, outcome: "oracle_repair" };
    }
    if (result.failure) { await recordTechnicalFailure(ctx, id, { code: "rescue_failed", detail: result.failure }, deps); return { ok: true, cmd: "rescue", unit: id, outcome: "abandoned", reason: result.failure }; }
    let next;
    if (result.gate) next = { ...unit, state: "waiting_gate", waiting_gate: result.gate, rescue: { ...r, pending_gate: result.gate, credential: null, worker: null } };
    else if (result.success) next = { ...unit, ...(unit.kind === "tests" ? { test_hashes: r.protected } : {}), state: "committed", worker: { ...r.author, via: "session", pid: null, worker_id: null }, rescue: { ...r, phase: "completed", credential: null, worker: null, reviewer: report.authored_by }, review: { verdict: "pass", reviewer: report.authored_by, degraded: null, deferred_id: null } };
    else next = { ...unit, rescue: { ...r, phase: "review", credential: null, worker: null, commit: result.commit, author: result.author, protected: result.hashes } };
    await ctx.appendEvent({ type: result.success ? "rescue_completed" : "rescue_stage", data: { unit: id, skipped: SKIPPED, unit_snapshot: next } });
    if (result.gate) await ctx.appendEvent({ type: "waiting_gate", data: { unit: id, kind: result.gate } });
    await ctx.writeState(patchUnit(state, id, next));
    return { ok: true, cmd: "rescue", unit: id, outcome: result.gate ? "waiting_gate" : result.success ? "committed" : "review" };
  });
}
