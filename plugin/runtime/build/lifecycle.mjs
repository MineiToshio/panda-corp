// Effects of `start --run`, `start --resume`, `stop`, `finish` and the read-only views `status` and `plan` (build-engine-cli
// 3.3, 3.4, 3.19, 3.20, 3.21, 3.6; PLAN 3.16 A4, A9, A23). The dispatcher (pandacorp-build.mjs) maps error codes to exits.
// Never writes a tracked file in the main checkout: tracked writes happen in the integration worktree, by other modules.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { installPrePush } from "../../scripts/install-pre-push.mjs";
import * as buildStateModule from "../build-state.mjs";
import { applyStartAnswers, readAnswersArg, readQuestions } from "./answers.mjs";
import { buildingCardAction, cardCheckCommand, markCardBuilding, readCard, resetCardReady } from "./card.mjs";
import { detect } from "./detect.mjs";
import { armDrive, readStandby } from "./drive.mjs";
import { releaseToken } from "./admission.mjs";
import { atomicWriteJson, atomicWriteText, assertNotTracked, defaultExec, nowIso, readJson, validate, loadSchema } from "./fsx.mjs";
import { createIntegrationWorktree, moveWorktreesUnder, removeWorktree } from "./integrate.mjs";
import { appendEvent } from "./journal.mjs";
import { applyTerminal, inScope } from "./next.mjs";
import { buildPaths } from "./paths.mjs";
import { loadFreshPreflight } from "./preflight.mjs";
import { lintPlan, plan, planView, readPlanWorkOrders } from "./planner.mjs";
import { staticZones } from "./risk.mjs";
import { fencedTwoPhase, isTerminalUnit, newState, newUnit, readLeaseToken, readState, rebuildState, writeState } from "./state.mjs";
import { readSummary, renderReportEs } from "./summary.mjs";
import { emitEvent } from "./telemetry.mjs";
import { productPrefix, productRoot, restoreUnitWorktree } from "./units.mjs";
import { dispatchOf, peekWorker, stopWorkers, workerIdFor } from "./workers.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const LEASE_TTL_S = 1800;
const COORDINATORS = Object.freeze({ claude: "claude-session", codex: "codex-session" });
const SIZE_RANK = Object.freeze({ touch: 0, feature: 1, giant: 2 });
const RESUMABLE_STATUSES = Object.freeze(["active", "paused", "waiting_owner", "waiting_gate", "stopped"]);

const depsOf = (deps) => ({ ...deps, env: deps.env ?? process.env });
const bsOf = (d) => d.buildState ?? buildStateModule;
const clockMs = (d) => (d.env.PANDACORP_NOW ? Date.parse(d.env.PANDACORP_NOW) : d.clock ? d.clock().getTime() : Date.now());
const runtimeOf = (state) => (state?.coordinator === "claude-session" ? "claude" : "codex");
const isAliveDefault = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
};
const shapeOf = (state) => (state.coordinator === "codex-session" ? "R-B" : state.coordinator === "drive" ? "drive" : state.label === "codex" ? "R-C" : "R-A");

async function readStateLoose(project, d) {
  try { return await readState(project, d); } catch (error) { if (error?.code === "INVALID_STATE" || error?.code === "LEDGER_CORRUPT") return null; throw error; }
}

const journal = (p, runId, epoch, type, data, d, actor = "cli") => appendEvent(p.journalFile, { run_id: runId, epoch, actor, type, data }, d);

async function emit(project, state, name, data, d) {
  const sent = await emitEvent(project, { runtime: runtimeOf(state), runId: state.run_id, name, data }, d);
  return sent.ok ? null : `event ${name} not emitted: ${sent.error}`;
}

const git = async (d, cwd, args) => (d.exec ?? defaultExec)("git", args, { cwd });

// ---------------------------------------------------------------------------------------------------------------
// Moves of build/ (A4): archive, suspend, restore. Registered worktrees move with `git worktree move`.
// ---------------------------------------------------------------------------------------------------------------

const exists = (target) => fsp.lstat(target).then(() => true, () => false);

async function mergeMove(src, dst) {
  if (!(await exists(dst))) { await fsp.mkdir(path.dirname(dst), { recursive: true }); await fsp.rename(src, dst); return; }
  const [a, b] = await Promise.all([fsp.lstat(src), fsp.lstat(dst)]);
  if (!a.isDirectory() || !b.isDirectory()) throw err("INVALID_STATE", `cannot move ${src}: ${dst} already exists`);
  for (const name of await fsp.readdir(src)) await mergeMove(path.join(src, name), path.join(dst, name));
  await fsp.rmdir(src);
}

/** Move everything of `from` into `to` (worktrees first, then plain entries); `keep` names stay, `drop` names are deleted. */
async function moveBuildDir({ project, from, to, keep = [], drop = [] }, d) {
  if (await exists(to)) throw err("INVALID_STATE", `${to} already exists (run id collision)`);
  await fsp.mkdir(to, { recursive: true });
  await moveWorktreesUnder({ project, from, to }, d);
  for (const name of await fsp.readdir(from).catch(() => [])) {
    if (keep.includes(name)) continue;
    if (drop.includes(name)) { await fsp.rm(path.join(from, name), { force: true }); continue; }
    await mergeMove(path.join(from, name), path.join(to, name));
  }
}

async function restoreSuspended({ project, runId }, d) {
  const p = buildPaths(project, d);
  const from = p.buildSuspendedDir(runId);
  if (!(await exists(from))) throw err("INVALID_STATE", `no suspended run ${runId}`);
  await moveWorktreesUnder({ project, from, to: p.build }, d);
  for (const name of await fsp.readdir(from)) await mergeMove(path.join(from, name), path.join(p.build, name));
  await fsp.rmdir(from);
}

async function nextRunId(project, p, d) {
  const day = new Date(clockMs(d)).toISOString().slice(0, 10);
  const used = [];
  const take = (name) => { const m = new RegExp(`^br-${day}-(\\d+)$`).exec(String(name ?? "")); if (m) used.push(Number(m[1])); };
  for (const dir of [p.buildArchiveRoot, p.buildSuspendedRoot]) for (const name of await fsp.readdir(dir).catch(() => [])) take(name);
  take((await readJson(p.stateFile).catch(() => null))?.run_id);
  const refs = await git(d, project, ["for-each-ref", "--format=%(refname:short)", "refs/heads/lane/"]);
  for (const ref of refs.stdout.split("\n")) take(ref.split("/")[1]);
  return `br-${day}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}

/** Terminal run in build/ goes to the archive, a non-terminal non-active one to build-suspended/; an active one is refused. */
async function clearBuildDir(project, p, d) {
  const state = await readJson(p.stateFile).catch(() => { throw err("INVALID_STATE", "build/state.json is unreadable: stop or rebuild the run first", { hint: "rebuild-state" }); });
  if (!state) return null;
  if (state.status === "active") throw err("INVALID_STATE", "a run is active: resume or stop the run first");
  const dest = state.status === "finished" ? p.buildArchiveDir(state.run_id) : p.buildSuspendedDir(state.run_id);
  await moveBuildDir({ project, from: p.build, to: dest, keep: ["preflight.json"], drop: ["lease-token.json"] }, d);
  return { run_id: state.run_id, moved_to: dest };
}

// ---------------------------------------------------------------------------------------------------------------
// Planning helpers shared by start --run and the plan views
// ---------------------------------------------------------------------------------------------------------------

async function planInput({ root, state, scope, questions, cardType, params }, d) {
  const read = await readPlanWorkOrders(root, d);
  const wos = await staticZones(read.wos, root, d.riskDeps ?? {});
  return {
    read,
    input: {
      wos, frd_acs: read.frd_acs, scope, units: state?.units ?? [], label: state?.label ?? "claude", size: state?.size ?? "feature",
      questions, card_type: cardType ?? null, shape: state ? shapeOf(state) : undefined, coordinator: state?.coordinator, session_model: params?.sessionModel ?? null,
    },
  };
}

/**
 * `plan` and `lint-plan` views over the live run's scope, or over `scopeFile` (default: every WO) without a run.
 * @returns {Promise<{ok: boolean, body: object}>} `ok:false` (lint with errors) makes the dispatcher exit 6
 */
export async function planCommand({ project, scopeFile = null, explain = false, strict = false, lint = false }, deps = {}) {
  const d = depsOf(deps);
  const state = await readStateLoose(project, d);
  const run = state && !["finished"].includes(state.status) ? state : null;
  const p = buildPaths(project, d);
  const root = run ? path.resolve(project, run.integration.worktree) : project;
  let scope = run?.scope;
  if (scopeFile) { const raw = await readJson(path.resolve(scopeFile), { required: true }); scope = { card: null, frds: [], wos: [], out_of_scope: [], ...(raw.scope ?? raw) }; }
  if (!scope) scope = { card: null, frds: (await readPlanWorkOrders(root, d)).frds, wos: [], out_of_scope: [] };
  const preflight = await readJson(p.preflightFile).catch(() => null);
  const answered = new Set(Object.keys(run?.answers ?? {}));
  const questions = (preflight?.questions ?? []).filter((q) => !answered.has(q.id));
  const { input } = await planInput({ root, state: run, scope, questions }, d);
  if (lint) { const r = lintPlan({ ...input, strict }, d); return { ok: r.ok, body: { strict: r.strict, issues: r.issues } }; }
  const result = plan(input, d);
  return { ok: true, body: planView(result, { explain, queued: [] }) };
}

// ---------------------------------------------------------------------------------------------------------------
// start --run
// ---------------------------------------------------------------------------------------------------------------

async function ensurePrePush(project, launched) {
  if (!launched) return "not_needed";
  const r = installPrePush({ project });
  if (r.code === 0) return "installed";
  if (r.code === 3) throw err("INVALID_STATE", `the pre-push hook cannot be installed: ${r.message}`, { prepush: "refused" });
  throw err("INVALID_STATE", `the pre-push hook could not be installed: ${r.message}`, { prepush: "failed" });
}

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
  await soft(() => removeWorktree({ project, worktree }, d));
  await soft(() => git(d, project, ["branch", "-D", branch]));
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
    const planned = plan(pin, d);
    if (planned.deadlock) throw err("INVALID_STATE", `the scope is not buildable: deadlock (${planned.deadlock.wos.join(", ") || planned.deadlock.units.join(", ")})`, { deadlock: planned.deadlock });
    const nowIds = new Set(planned.now);
    const add = planned.units.filter((u) => nowIds.has(u.id) && inScope(state, u)).map((u) => newUnit(u));
    if (queued.length === 0 && add.length === 0 && planned.units.length === 0) throw err("INVALID_STATE", "the scope is not buildable: nothing to build");
    state = { ...state, units: [...queued, ...add] };
    const applied = applyStartAnswers(state, { answers, questions: await readQuestions(project, d) });
    state = applied.state;

    await fencedTwoPhase({ project, epoch: lease.epoch, deps: d }, undefined, undefined, async (_r, _i, fctx) => {
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

// ---------------------------------------------------------------------------------------------------------------
// start --resume
// ---------------------------------------------------------------------------------------------------------------

/**
 * A lease mutex whose holder died inside it (a kill -9 of drive in the middle of a fenced mutation) would block every
 * command for build-state's 60-s staleness window. It is reclaimed at once when the pid in its `owner.json` is dead;
 * a live, unreadable or not yet written owner is left alone (the 60-s rule still applies to it).
 * @returns {Promise<boolean>} true when a dead holder's mutex was removed
 */
async function reclaimDeadLeaseMutex(p, isAlive) {
  let owner;
  try { owner = JSON.parse(await fsp.readFile(path.join(p.leaseMutex, "owner.json"), "utf8")).owner; } catch { return false; }
  const pid = Number.parseInt(String(owner).split("-")[0], 10);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid || isAlive(pid)) return false;
  const tomb = `${p.leaseMutex}.dead-${pid}-${process.pid}`;
  try { await fsp.rename(p.leaseMutex, tomb); } catch { return false; }
  await fsp.rm(tomb, { recursive: true, force: true });
  return true;
}

async function takeLease({ project, p, state, coordinator, ownerConfirmed }, d) {
  const bs = bsOf(d);
  const lease = await bs.currentLease(project);
  if (!lease) {
    const got = await bs.acquire(project, { runtime: coordinator, runId: state.run_id, ttlSeconds: LEASE_TTL_S, coordinator: "session", projectStatus: false });
    return { epoch: got.epoch, token: got.token };
  }
  if (lease.run_id !== state.run_id) throw err("CONTENDED", `the lease belongs to run ${lease.run_id}`);
  const fresh = bs.isFresh(lease, clockMs(d));
  if (!fresh && lease.coordinator !== "drive" && lease.runtime !== coordinator && !ownerConfirmed) {
    throw err("INVALID_INPUT", "the lease of another company's session is stale: pass --owner-confirmed after checking it is dead");
  }
  let token = null;
  try { token = await readLeaseToken(project, lease.epoch, d); } catch { token = null; }
  if (token) return bs.transfer(project, { token, toRuntime: coordinator, coordinator: "session", epoch: lease.epoch });
  if (!fresh && bs.isReclaimable(lease, clockMs(d))) {
    const got = await bs.reclaim(project, { runtime: coordinator, runId: state.run_id, ttlSeconds: LEASE_TTL_S });
    return { epoch: got.epoch, token: got.token };
  }
  throw err("CONTENDED", "the lease is held by a live run whose token this checkout cannot read");
}

/**
 * What a resume does with an `admitted|running` unit whose recorded pids are dead (CLI 3.4, A13, D21):
 *  - `adopt`: a `via:"cli"` dispatch recorded in phase 2 whose worker sealed (or exited): its outcome is this
 *    dispatch's, under this dispatch's token, so it is harvested, never redone or charged to a new attempt;
 *  - `orphan`: a Codex worker launched by a dispatch that never reached phase 2 (its id is derived from the unit's
 *    admission token) and still alive: it is stopped, because its token is released and its result could never be
 *    ingested, and it would otherwise write into the worktree of the next dispatch;
 *  - `requeue`: anything else.
 * @returns {{kind: "adopt", workerId: string, pid: number|null} | {kind: "orphan", workerId: string} | {kind: "requeue"}}
 */
function resumeVerdict(state, u, project, d) {
  const recorded = u.state === "running" && u.worker?.via === "cli" && u.worker.worker_id ? u.worker.worker_id : null;
  let workerId = recorded;
  if (!workerId && dispatchOf(u.token_hash)) {
    try { workerId = workerIdFor({ runId: state.run_id, unit: u.id, attempt: u.attempt, dispatch: dispatchOf(u.token_hash) }); } catch { workerId = null; }
  }
  if (!workerId) return { kind: "requeue" };
  const peek = peekWorker({ project, workerId }, { env: d.env, ...(d.isAlive ? { isAlive: d.isAlive } : {}) });
  if (recorded && (peek.sealed || peek.state === "exited")) return { kind: "adopt", workerId, pid: peek.pid };
  if (peek.state === "running") return recorded ? { kind: "adopt", workerId, pid: peek.pid } : { kind: "orphan", workerId };
  return { kind: "requeue" };
}

/** The `running` worker job of an adopted unit (reopened when a harvest had already closed it). */
function reopenWorkerJob(jobs, u, verdict, project, d) {
  const current = jobs.find((j) => j.kind === "worker" && (j.worker_id === verdict.workerId || j.id === verdict.workerId));
  if (current?.state === "running") return { jobs, event: null };
  const job = current
    ? { ...current, state: "running", exit: null }
    : { id: verdict.workerId, kind: "worker", unit: u.id, frd: u.frd ?? null, pid: verdict.pid ?? null, cwd: u.worktree ?? project, h_slot: false, started_at: new Date(clockMs(d)).toISOString(), state: "running", exit: null, worker_id: verdict.workerId };
  return { jobs: [...jobs.filter((j) => j !== current), job], event: { type: "job_started", data: job } };
}

/**
 * `start --resume`: re-enter a non-terminal run (transfer or acquire), re-attach live units, requeue dead ones, re-arm drive.
 * @param {{project: string, coordinator: "claude"|"codex", sessionModel?: string|null, runId?: string|null, ownerConfirmed?: boolean}} input
 */
export async function startResume(input, deps = {}) {
  const d = depsOf(deps);
  const { project, coordinator, sessionModel = null, runId = null, ownerConfirmed = false } = input;
  if (!COORDINATORS[coordinator]) throw err("USAGE", "--coordinator debe ser claude o codex");
  const p = buildPaths(project, d);
  const isAlive = d.isAlive ?? isAliveDefault;
  const current = await readJson(p.stateFile).catch(() => null);
  if (runId && current && current.status !== "finished") throw err("INVALID_STATE", "build/ holds a non-terminal run: resume it, or stop it first");
  if (runId) { await clearBuildDir(project, p, d); await restoreSuspended({ project, runId }, d); }

  let state = await readStateLoose(project, d);
  let rebuilt = false;
  if (!state) {
    try { state = (await rebuildState({ project, deps: d })).state; rebuilt = true; } catch { throw err("INVALID_STATE", "nothing to resume: no readable run in build/"); }
  }
  if (!RESUMABLE_STATUSES.includes(state.status)) throw err("INVALID_STATE", `nothing to resume: the run is ${state.status}`);
  const prior = state.status;
  await reclaimDeadLeaseMutex(p, isAlive);
  const got = await takeLease({ project, p, state, coordinator, ownerConfirmed }, d);

  const result = await fencedTwoPhase({ project, epoch: got.epoch, deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const reattached = [];
    const adopted = [];
    const requeued = [];
    const events = [];
    let jobs = state.jobs;
    const units = [];
    for (const u of state.units) {
      if (u.state !== "admitted" && u.state !== "running") { units.push(u); continue; }
      const pids = [u.worker?.pid, ...state.jobs.filter((j) => j.unit === u.id && j.state === "running").map((j) => j.pid)];
      if (pids.some((pid) => isAlive(pid))) { reattached.push(u.id); units.push(u); continue; }
      const verdict = resumeVerdict(state, u, project, d);
      if (verdict.kind === "adopt") {
        // The worker of THIS dispatch finished but its result was never ingested (the coordinator died between the seal
        // and the report's phase 2): keep the unit running under its own token and reopen its job, so the next `next`
        // harvests it; `report` completes an interrupted ingest from the engine's own unit commit (report.mjs).
        const reopened = reopenWorkerJob(jobs, u, verdict, project, d);
        jobs = reopened.jobs;
        if (reopened.event) events.push(reopened.event);
        adopted.push(u.id); reattached.push(u.id); units.push(u);
        continue;
      }
      if (verdict.kind === "orphan") stopWorkers(project, [verdict.workerId], d);
      const reset = await restoreUnitWorktree({ project, runId: state.run_id, unit: u, base: u.parked === "built_on_assumption" && u.pending_answer ? p.assumeBranch(state.run_id, u.pending_answer) : undefined }, d);
      requeued.push(u.id);
      events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to: "queued", reason: "resume", ...(reset.reset ? { worktree_reset: { discarded_commits: reset.discarded_commits, dirty: reset.dirty, head: reset.head } } : {}), ...(verdict.kind === "orphan" ? { orphan_worker: verdict.workerId } : {}) } });
      units.push({ ...u, state: "queued", token_hash: null, worker: null });
    }
    // A dead coordinator may also have died between a unit's settle and its token release: no unit outside
    // admitted/running holds an admission reservation after a resume.
    for (const u of units) if (u.state !== "admitted" && u.state !== "running") { try { releaseToken(u.id, { file: p.admissionFile }); } catch { /* the token file may be gone */ } }
    await ctx.appendEvent({ type: "run_resumed", data: { from: prior, coordinator: COORDINATORS[coordinator], session_model: sessionModel, reattached, requeued, adopted, rebuilt } });
    for (const ev of events) await ctx.appendEvent(ev);
    await ctx.writeState({ ...state, units, jobs, coordinator: COORDINATORS[coordinator], status: "active", status_reason: null });
    return { reattached, requeued };
  });
  await createIntegrationWorktree({ project, runId: state.run_id }, d).catch(() => {});
  const launched = (await detect({ project, args: "", sessionRuntime: coordinator }, d)).signals.launched === true;
  await ensurePrePush(project, launched).catch(() => {});
  const drive = await armDrive({ project, runId: state.run_id, launched, appendEvent: (ev) => journal(p, state.run_id, got.epoch, ev.type, ev.data, d) }, d.driveDeps);
  return { run_id: state.run_id, epoch: got.epoch, ...result, drive };
}

// ---------------------------------------------------------------------------------------------------------------
// stop, finish, handoff
// ---------------------------------------------------------------------------------------------------------------

/**
 * `stop [--epoch N]` or `stop --dead --owner-confirmed`. Fenced with an epoch; `--dead` force-releases a reclaimable lease.
 * @returns {Promise<{released: boolean, run_id?: string|null}>}
 */
export async function stopRun({ project, epoch = null, dead = false, ownerConfirmed = false, reason = "owner_request" }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const bs = bsOf(d);
  if (epoch !== null && epoch !== undefined) {
    const state = await applyTerminal({ project, epoch: Number(epoch), actor: "cli", deps: d }, { action: "stop", status: "stopped", reason }, d);
    return { released: true, run_id: state.run_id };
  }
  if (dead && !ownerConfirmed) throw err("INVALID_INPUT", "`stop --dead` needs --owner-confirmed");
  const lease = await bs.currentLease(project);
  const state = await readStateLoose(project, d);
  if (!dead && lease) throw err("FENCE", "a lease is held: pass --epoch (or --dead --owner-confirmed for a dead owner)");
  let released = false;
  if (lease) {
    try { await bs.forceRelease(project, { ownerConfirmed: true, now: clockMs(d) }); released = true; } catch (error) {
      if (error?.code === "CONTENDED") throw err("INVALID_INPUT", "the lease is live: its owner may still be running");
      throw error;
    }
  }
  if (state && ["active", "paused", "waiting_owner", "waiting_gate"].includes(state.status)) {
    await journal(p, state.run_id, lease?.epoch ?? state.epoch, "run_stopped", { reason: dead ? "dead_owner" : reason }, d);
    await writeState(project, { ...state, status: "stopped", status_reason: dead ? "dead_owner" : reason }, d);
    await emit(project, state, "build.stopped", { reason: dead ? "dead_owner" : reason }, d);
  }
  return { released, run_id: state?.run_id ?? null };
}

async function closeRun(ctx, state, waiting, d) {
  const to = waiting ? { status: "waiting_gate", status_reason: "waiting_gate" } : { status: "finished", status_reason: null };
  await ctx.appendEvent(waiting ? { type: "paused", data: { reason: "waiting_gate", status: "waiting_gate" } } : { type: "run_finished", data: {} });
  return ctx.writeState({ ...state, ...to });
}

/**
 * `finish --epoch N`: close a run whose units are all terminal (or whose status is not active). Only `waiting_gate` units left:
 * the run ends as waiting (`waiting_gate: true`, the dispatcher exits 7). Writes the Spanish report; never projects status.yaml.
 * @returns {Promise<{report_path: string, summary: object, waiting_gate: boolean}>}
 */
export async function finishRun({ project, epoch = null, actor = "cli" }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const bs = bsOf(d);
  const lease = await bs.currentLease(project);
  const state0 = await readState(project, d);
  if (!state0) throw err("INVALID_STATE", "no run to finish");
  let waiting = false;
  const decide = (s) => {
    if (s.status === "finished") return "already";
    const open = s.units.filter((u) => !isTerminalUnit(u));
    waiting = open.length > 0 && open.every((u) => u.state === "waiting_gate");
    if (s.status === "active" && open.length > 0 && !waiting) throw err("INVALID_STATE", "the run is active with units not finished: go back to the loop");
    return waiting ? "waiting" : "finish";
  };
  if (lease) {
    const token = await readLeaseToken(project, epoch, d);
    const mode = await fencedTwoPhase({ project, epoch: Number(epoch), actor, deps: d }, undefined, undefined, async (_r, _i, ctx) => {
      const s = await ctx.readState();
      if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
      const m = decide(s);
      if (m !== "already") await closeRun(ctx, s, waiting, d);
      return m;
    });
    if (mode !== "already") {
      await bs.quiesce(project, token, Number(epoch), { projectStatus: false });
      await bs.finalizeRelease(project, token, Number(epoch));
    }
  } else {
    if (Number(epoch) !== state0.epoch) throw err("FENCE", "finish: --epoch does not match the run's last epoch");
    const mode = decide(state0);
    if (mode !== "already") {
      const ctx = { appendEvent: (ev) => journal(p, state0.run_id, state0.epoch, ev.type, ev.data, d, actor), writeState: (s) => writeState(project, s, d) };
      await closeRun(ctx, state0, waiting, d);
    }
  }
  const summary = await readSummary(project, d);
  const rel = path.join(".pandacorp", "comms", `informe-build-${state0.run_id}.md`);
  await assertNotTracked(project, rel, { exec: d.exec });
  const reportPath = path.join(project, rel);
  await atomicWriteText(reportPath, renderReportEs(summary));
  const warning = waiting ? null : await emit(project, state0, "build.complete", { run_id: state0.run_id, status: "finished" }, d);
  return { report_path: reportPath, summary, waiting_gate: waiting, ...(warning ? { warnings: [warning] } : {}) };
}

/** `handoff --epoch N --reason R`: write build/handoff.json (drive consumes it), journal `handoff_requested`, emit `build.handoff`. */
export async function requestHandoff({ project, epoch, reason }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const written = await fencedTwoPhase({ project, epoch: Number(epoch), deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const body = { run_id: ctx.runId, from_epoch: Number(epoch), reason, requested_at: nowIso(d) };
    const check = validate(await loadSchema("handoff"), body);
    if (!check.ok) throw err("INVALID_INPUT", `handoff request invalid: ${JSON.stringify(check.errors)}`);
    await atomicWriteJson(p.handoffFile, body);
    await ctx.appendEvent({ type: "handoff_requested", data: { reason, from_epoch: Number(epoch) } });
    return body;
  });
  const state = await readStateLoose(project, d);
  const warning = state ? await emit(project, state, "build.handoff", { reason, from_epoch: Number(epoch) }, d) : null;
  return { handoff_path: p.handoffFile, ...(warning ? { warnings: [warning] } : {}), request: written };
}

// ---------------------------------------------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------------------------------------------

/**
 * `status`: the run snapshot of build-engine-cli 3.21. Without a run every field is null/empty. `gaps` lists unreadable signals
 * (the dispatcher then exits 9).
 */
export async function statusSnapshot(project, deps = {}) {
  const d = depsOf(deps);
  const bs = bsOf(d);
  const p = buildPaths(project, d);
  const gaps = [];
  const state = await readState(project, d);
  if (!state) return { run_id: null, epoch: null, coordinator: null, status: null, status_reason: null, label: null, size: null, units_by_state: {}, lease: { renewed_at: null, ttl_seconds: null, live: false }, quota: { claude: null, codex: null }, drive: { armed: false, state: null }, deferred_pending: 0, open_questions: [], gaps };
  const lease = await bs.currentLease(project);
  const summary = await readSummary(project, d);
  let drive = { armed: false, state: null };
  try {
    const standby = await readStandby(project, { ...d, isAlive: d.isAlive });
    if (standby) drive = { armed: (d.isAlive ?? isAliveDefault)(standby.pid) && standby.state !== "stopped", state: standby.state ?? null };
  } catch { gaps.push("drive"); }
  return {
    run_id: state.run_id, epoch: lease?.epoch ?? state.epoch, coordinator: state.coordinator, status: state.status, status_reason: state.status_reason ?? null,
    label: state.label, size: state.size, units_by_state: summary.units_by_state ?? {},
    lease: lease ? { renewed_at: lease.renewed_at, ttl_seconds: lease.ttl_seconds, live: bs.isFresh(lease, clockMs(d)) } : { renewed_at: null, ttl_seconds: null, live: false },
    quota: summary.quota ?? { claude: null, codex: null }, drive, deferred_pending: summary.deferred_pending, open_questions: summary.open_questions, gaps,
  };
}

/** `rebuild-state --epoch N`: replay the journal and the integration worktree's frontmatter; write `state.json` when it differs. */
export async function rebuildStateCommand({ project, epoch }, deps = {}) {
  const d = depsOf(deps);
  return fencedTwoPhase({ project, epoch: Number(epoch), deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const rebuilt = await rebuildState({ project, deps: d });
    const { changed, added, removed, fields } = rebuilt.diff;
    if (changed.length + added.length + removed.length + fields.length > 0) await ctx.writeState(rebuilt.state);
    return { units: rebuilt.state.units.length, diff_vs_cache: { changed, added, removed }, fields, conflicts: rebuilt.conflicts };
  });
}

