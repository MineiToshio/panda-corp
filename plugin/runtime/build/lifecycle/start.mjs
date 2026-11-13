// `start --run`: take the lease, create the run, its integration worktree and its first units.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { initializeAdmission, readDiskFreeGib } from "../admission.mjs";
import { initializePerformance, startRecommendation } from "../perf.mjs";
import { applyStartAnswers, readAnswersArg, readQuestions } from "../answers.mjs";
import { buildingCardAction, cardCheckCommand, markCardBuilding, readCard, resetCardReady } from "../card.mjs";
import { detect } from "../detect.mjs";
import { armDrive } from "../drive.mjs";
import { readJson } from "../fsx.mjs";
import { createIntegrationWorktree, removeWorktree } from "../integrate.mjs";
import { inScope } from "../next.mjs";
import { buildPaths } from "../paths.mjs";
import { plan } from "../planner.mjs";
import { loadFreshPreflight } from "../preflight.mjs";
import { fencedTwoPhase, newState, newUnit } from "../state.mjs";
import { productPrefix, productRoot } from "../units.mjs";
import { clearBuildDir, nextRunId } from "./buildDir.mjs";
import { COORDINATORS, LEASE_TTL_S, SIZE_RANK, clockMs, bsOf, depsOf, emit, ensurePrePush, err, git, journal } from "./common.mjs";
import { planInput } from "./plan.mjs";

async function readScope(file) {
  const raw = await readJson(path.resolve(file), { required: true }).catch((e) => { throw err("INVALID_INPUT", `--scope-json unreadable: ${e.message}`); });
  const s = raw.scope ?? raw;
  const list = (v) => (Array.isArray(v) ? v.map(String) : []);
  return { card: typeof s.card === "string" && s.card ? s.card : null, frds: list(s.frds), wos: list(s.wos) };
}

async function takeCard(project, runId, scope, ctxLease, d) {
  if (!scope.card) return { card: null, marked: false };
  const check = await cardCheckCommand(project, path.join(".pandacorp", "inbox", "changes", `${scope.card}.md`), {}, d);
  const card = await readCard(project, scope.card, { where: "any" }, d);
  if (!check.ok || !card) throw err("INVALID_INPUT", `card ${scope.card} failed card check: ${(check.errors ?? ["not found"]).join("; ")}`, { errors: check.errors ?? [] });
  const p = buildPaths(project, d);
  if (card.status === "building" && card.run_id !== runId) {
    const other = (await readJson(path.join(p.buildArchiveDir(card.run_id), "state.json")).catch(() => null))?.status
      ?? (await readJson(path.join(p.buildSuspendedDir(card.run_id), "state.json")).catch(() => null))?.status ?? null;
    const action = buildingCardAction(card, { runId, otherRunStatus: other });
    if (action.action === "reset_ready") await resetCardReady(project, scope.card, `reopened: ${card.run_id} ended without landing`, d);
    else if (action.action === "reconcile_v1") {
      const rel = path.join(".pandacorp", "inbox", "changes", `${scope.card}.md`);
      await bsOf(d).reconcileBuildingChange(project, ctxLease.token, ctxLease.epoch, { changeFile: rel });
    } else if (action.action !== "resume") throw err("INVALID_STATE", `card ${scope.card} is being built: ${action.reason}`);
  }
  await markCardBuilding(project, scope.card, { runId }, d);
  return { card, marked: true };
}

async function rollbackStart({ project, p, runId, lease, branch, worktree, markedCard }, d) {
  const bs = bsOf(d);
  const soft = (fn) => fn().catch(() => {});
  if (markedCard) await soft(() => resetCardReady(project, markedCard, "run could not start", d));
  await soft(() => removeWorktree({ project, runId, worktree }, d));
  await soft(() => bs.quiesce(project, lease.token, lease.epoch, { projectStatus: false }));
  await soft(() => bs.finalizeRelease(project, lease.token, lease.epoch));
  await soft(() => fsp.rm(p.stateFile, { force: true }));
  await soft(() => fsp.rm(p.journalFile, { force: true }));
}

/**
 * `start --run`: take the lease, create the run, its integration worktree and its first units, apply the owner's answers,
 * install the pre-push hook (launched projects) and arm drive.
 * @param {{project: string, scopeFile: string, label?: string, coordinator: "claude"|"codex", k?: number|null, mode?: string|null,
 *   sessionModel?: string|null, answers?: string|null}} input
 * @returns {Promise<{run_id: string, epoch: number, integration: object, drive: object, prepush: string}>}
 */
export async function startRun(input, deps = {}) {
  const d = depsOf(deps);
  const { project, coordinator } = input;
  const p = buildPaths(project, d);
  const bs = bsOf(d);
  if (!COORDINATORS[coordinator]) throw err("USAGE", "--coordinator debe ser claude o codex");
  const scope = await readScope(input.scopeFile);
  if (!scope.card && scope.wos.length === 0) throw err("INVALID_STATE", "the scope is not buildable: no card and no work orders");

  const saved = await readJson(p.preflightFile).catch(() => null);
  const fresh = saved ? await loadFreshPreflight({ project, row: saved.row, scope }, d) : { ok: false };
  if (!fresh.ok) throw err("INVALID_STATE", "re-run preflight: build/preflight.json is missing, older than 15 minutes or for another scope");
  const pre = fresh.preflight;
  const label = input.label ?? pre.label ?? (coordinator === "codex" ? "codex" : "claude");
  const size = [pre.announce?.size ?? "feature", input.mode ?? "touch"].reduce((a, b) => (SIZE_RANK[b] > SIZE_RANK[a] ? b : a));
  const det = await detect({ project, args: "", resume: pre.row === 2, sessionRuntime: label }, d);
  if (scope.card) {
    const check = await cardCheckCommand(project, path.join(".pandacorp", "inbox", "changes", `${scope.card}.md`), {}, d);
    if (!check.ok) throw err("INVALID_INPUT", `card ${scope.card} failed card check: ${check.errors.join("; ")}`, { errors: check.errors });
  }

  if ((await bs.currentLease(project)) && !((await readJson(p.stateFile).catch(() => null))?.status === "active")) throw err("CONTENDED", "the lease is held; use `stop --dead --owner-confirmed` when its owner is dead");
  const prepush = await ensurePrePush(project, det.signals.launched === true);
  await clearBuildDir(project, p, d);

  const runId = await nextRunId(project, p, d);
  const lease = await bs.acquire(project, { runtime: coordinator, runId, ttlSeconds: LEASE_TTL_S, coordinator: "session", projectStatus: false });
  const branch = p.integrationBranch(runId);
  const ctx = { project, p, runId, lease, branch, worktree: p.integrationWorktree, markedCard: null };
  try {
    const created = await createIntegrationWorktree({ project, runId }, d);
    const prefix = await productPrefix(project, d);
    const root = path.resolve(productRoot(created.worktree, prefix));
    const taken = await takeCard(project, runId, scope, lease, d);
    ctx.markedCard = taken.marked ? scope.card : null;

    let state = newState({
      run_id: runId, epoch: lease.epoch, coordinator: COORDINATORS[coordinator], label, size,
      // The detect scope verbatim (D33): the planner owns the rule that a card with no work orders yet owns only the WOs its docs unit creates.
      scope: { ...scope, out_of_scope: [] }, integration: { branch, worktree: root, base_sha: created.base_sha },
    });
    const queued = [];
    if (scope.card && scope.wos.length === 0) queued.push(newUnit({ id: `u-docs-${scope.card}`, kind: "docs", frd: taken.card?.frd || null }));
    state = { ...state, units: queued };
    const answers = await readAnswersArg(input.answers, d);
    const questions = (pre.questions ?? []).filter((q) => !(q.id in answers));
    const { input: pin } = await planInput({ root, state, scope: state.scope, questions, cardType: taken.card?.type, params: { sessionModel: input.sessionModel } }, d);
    const learned = await startRecommendation(d);
    const planned = plan({ ...pin, ceiling: learned.step }, d);
    if (planned.deadlock) throw err("INVALID_STATE", `the scope is not buildable: deadlock (${planned.deadlock.wos.join(", ") || planned.deadlock.units.join(", ")})`, { deadlock: planned.deadlock });
    const nowIds = new Set(planned.now);
    const add = planned.units.filter((u) => nowIds.has(u.id) && inScope(state, u)).map((u) => newUnit(u));
    if (queued.length === 0 && add.length === 0 && planned.units.length === 0) throw err("INVALID_STATE", "the scope is not buildable: nothing to build");
    state = { ...state, units: [...queued, ...add] };
    const applied = applyStartAnswers(state, { answers, questions: await readQuestions(project, d) });
    state = applied.state;

    const diskFreeGib = readDiskFreeGib(project, d);
    await initializePerformance({ project, runId, step: learned.step, diskFreeGib }, d);
    await fencedTwoPhase({ project, epoch: lease.epoch, deps: d }, undefined, undefined, async (_r, _i, fctx) => {
      initializeAdmission(learned, { file: p.admissionFile, now: () => clockMs(d) });
      await fctx.appendEvent({ type: "run_started", data: { detect: { signals: det.signals, row: pre.row, scope }, preflight: pre, state: { ...state, units: [] }, session_model: input.sessionModel ?? null, k: input.k ?? null, answers: applied.applied } });
      for (const u of state.units) await fctx.appendEvent({ type: "unit_queued", data: u });
      await fctx.writeState(state);
    });
    const warning = await emit(project, state, "build.launch", { run_id: runId, label, size, coordinator, frds: scope.frds, wos: scope.wos, card: scope.card, engine: "v2" }, d);
    const drive = await armDrive({ project, runId, launched: det.signals.launched === true, appendEvent: (ev) => journal(p, runId, lease.epoch, ev.type, ev.data, d) }, d.driveDeps);
    return { run_id: runId, epoch: lease.epoch, integration: { branch, worktree: root }, drive, prepush, ...(warning ? { warnings: [warning] } : {}) };
  } catch (error) {
    await rollbackStart(ctx, d);
    throw error;
  }
}
