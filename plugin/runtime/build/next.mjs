// next.mjs: the scheduler behind `pandacorp-build next` (CLI doc section 4, PLAN 3.3, D19, D32, AR2 A11/A12).
// One call = harvest finished jobs and workers -> integrate committed chains -> G2 bookkeeping -> land when the batch
// is complete -> quota policy (handoff) -> admission and dispatch -> wait or a terminal action.
// Invariants:
//   - every call renews the lease (each fenced step's phase 1 renews it, `projectStatus:false`); that is the liveness;
//   - one admission reading is recorded per call (`recordReading`), never more;
//   - a terminal action is returned only when no unit, job or worker of the run is running (A11), already applied
//     (status, journal, quiesce + finalizeRelease with `projectStatus:false`) except `done` (the session calls `finish`);
//   - the change queue (`.pandacorp/inbox/changes/`) is never read nor drained here; no unit outside the run scope is
//     ever returned;
//   - the A11 quota priority lives in `quota.policy({..., driveAlive})`; this module applies it and never re-derives it.
// Sibling modules are injected as namespaces `deps.<stem>` (default: the real `./<stem>.mjs`, imported lazily so a missing
// sibling fails only the step that needs it); the functions used are listed in `NEXT_SIBLING_CONTRACT`. Pure readers of
// sibling modules (`frdsReadyForG2`, `readDeferred`, `productPrefix`) are imported statically.
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import path from "node:path";
import * as admissionModule from "./admission.mjs";
import { readDeferred } from "./deferred.mjs";
import { atomicWriteJson, readJson } from "./fsx.mjs";
import { bootstrapIntegrationWorktree, dropBootstrapManifests, frdsReadyForG2 } from "./integrate.mjs";
import { readJournal } from "./journal.mjs";
import { assertSafeId, buildPaths, resolveInside } from "./paths.mjs";
import * as quotaModule from "./quota.mjs";
import * as riskModule from "./risk.mjs";
import * as routingModule from "./routing.mjs";
import { REVIEW_TYPE_KINDS, fencedTwoPhase, findUnit, isTerminalUnit, newUnit, readLeaseToken, readState } from "./state.mjs";
import { productPrefix, productRoot } from "./units.mjs";
import { dispatchOf } from "./workers.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Every action `next` can return (CLI doc section 4). */
export const NEXT_ACTIONS = Object.freeze(["dispatch", "wait", "handoff", "land", "done", "paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"]);
/** Terminal actions (A11); all but `done` arrive already applied. */
export const TERMINAL_ACTIONS = Object.freeze(["done", "paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"]);
/** `--wait` upper bound in seconds (BUILD-7 constants). */
export const MAX_WAIT_S = 300;
/** Consecutive `env-infra` hand-backs that stop the run (D21). */
export const ENV_INFRA_STOP = 3;

const RETRY_S = Object.freeze({ ram: 30, cpu_H: 30, workers_running: 30, jobs_running: 30, gate: 60, quota: 60 });
const LAND_RETRY_EXITS = Object.freeze([12, 14, 20]);
const LAND_RETRY_S = 60;
// G2 snapshot worktrees (B5): `<build>/g2/<frd>-<pinned sha>`, one per job, never the integration worktree itself.
const G2_SNAPSHOT_DIR = "g2";

/** Consecutive passes a G2 snapshot may fail to be created before the FRD is handed back as an environment failure (NB2). */
export const G2_SNAPSHOT_FAIL_MAX = 3;
const SHA_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const G2_SNAPSHOT_RE = /^(.+)-([0-9a-f]{40}(?:[0-9a-f]{24})?)$/;
/** Exit code of a G2 job whose snapshot could not be bootstrapped (`worktree-bootstrap.sh` failed): no verdict, env-infra. */
export const G2_BOOTSTRAP_EXIT = 75;
// The G2 job body: bootstrap the fresh snapshot (deps are not tracked), then the gate. argv: $0 label, $1 integration base sha.
const G2_SCRIPT = `if [ -f .pandacorp/worktree-bootstrap.sh ]; then bash .pandacorp/worktree-bootstrap.sh || exit ${G2_BOOTSTRAP_EXIT}; fi
exec bash .pandacorp/verify.sh --since "$1"`;
const WATCH_POLL_MS = 1000;
const GIT_SHOW_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const LIVE_STATES = Object.freeze(["admitted", "running"]);
const FRD_WORK_KINDS = Object.freeze(["build", "patch", "tests"]);
const PLANNED_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
const OWNER_PARKS = Object.freeze(["owner_question", "built_on_assumption"]);
// Worker outcomes (workers.pollWorker) that mean the environment, not the code, failed the unit.
const ENV_WORKER_OUTCOMES = Object.freeze(["worker_error", "watchdog"]);
// Report/review/doubt outcomes the sibling modules signal by throwing: the unit was already settled (rejected,
// re-queued or handed back) by that module, so the harvest goes on.
const SETTLED_OUTCOME_CODES = Object.freeze(["INVALID_INPUT", "EVIDENCE", "INVALID_PATH", "GATE_RED", "WAITING_GATE"]);

const AGENT_TYPE = Object.freeze({
  docs: "pandacorp:implementer", build: "pandacorp:implementer", patch: "pandacorp:implementer",
  tests: "pandacorp:test-writer", review: "pandacorp:reviewer", "deferred-review": "pandacorp:reviewer",
  audit: "pandacorp:security-auditor", "doubt-consult": "general-purpose",
});
const VERB_ES = Object.freeze({
  docs: "documenta", tests: "escribe pruebas de", build: "construye", patch: "corrige", review: "revisa",
  audit: "audita la seguridad de", "doubt-consult": "consulta la duda", "deferred-review": "revisa (diferida)",
});

/**
 * Sibling functions `next` calls, by their real exports (every one deps-last). `deps.<stem>` replaces the module
 * namespace; each mutating sibling runs its own fenced two-phase operation, so `next` calls it outside its own mutex.
 */
export const NEXT_SIBLING_CONTRACT = Object.freeze({
  "planner.readPlanWorkOrders": "(root, deps) -> {wos[], frds[], frd_acs, errors[]}",
  "planner.plan": "({wos, scope, units, label, size, questions, frd_acs, quota, shape, coordinator, session_model}, deps) -> {units[], now[], ready[], round[], deadlock: null|object}",
  "integrate.integrateCommitted": "({state, runId}, deps + {project}) -> {integrated: [{unit, sha, assumption?}], merged: [{doubt, sha}], conflicts: [{unit, doubt?}]} (git work only; next records the state)",
  "integrate.transitionWorkOrders": "({integration, runId, wos, to: 'IN_PROGRESS', reason, unitId}, deps) -> WO commit on lane/<run_id>",
  "units.prepareUnitWorktree": "({project, runId, unit, attempt, base?}, deps) -> {worktree, branch} (base = the assume branch for work built on an assumption)",
  "units.writeUnitBrief": "({project, state, unit, cell, agentType, token, schemaPath, worktree, reportPath, extra}, deps) -> {brief_path, report_path}",
  "jobs.startJob": "({project, epoch, actor, kind: 'g2', cmd, cwd, frd, unit: null}, deps) -> jobs[] item (fenced; records the job; cwd = the G2 snapshot <build>/g2/<frd>-<sha>)",
  "jobs.pollJob": "(project, job, deps) -> {state: 'running'|'done'|'dead', exit}",
  "workers.launchWorker": "({project, runId, unit, attempt, frd, cell, schemaFile, dir, briefFile}, deps) -> {ok, workerId, pid, job} | {ok:false, kind, detail}",
  "workers.pollWorker": "({project, workerId, unit, schemaFile, reportFile, epoch}, deps) -> {state: 'running'|'done'|'error', outcome, report?, limit?}",
  "report.ingestReport": "({project, epoch, unit, token, file, openDoubt: true}, deps) (fenced; G1, commit; opens a doubt outcome: doubt_opened | handback)",
  "review.reviewRecord": "({project, epoch, unit, token, file, openDoubt: true}, deps) (fenced; a doubt verdict leaves the unit reported)",
  "answers.answerNotes": "(state, unit, {questions}) -> string[] (the owner's recorded answers a unit's brief carries: gate OK, answered asks)",
  "doubts.pendingConsult": "(project, unit, deps) -> {runtime, model, effort, via, model_slug, brief_path, report_path, schema_path, answered}",
  "doubts.answerDoubt": "({project, epoch, id, file, token: null}, deps) (fenced; a via:'cli' consult answer)",
  "failure.handbackCommand": "({project, epoch, unit, reason, cause}, deps) (fenced; blocks dependents)",
  "failure.openUnitDoubt": "({project, epoch, unit, doubt?, diagnosis?, actor}, deps) -> {opened:true, doubt_id, step, ...} | {opened:false, handback} (fenced)",
  "failure.failUnit": "({project, epoch, unit, attempt, cause, detail, command, tail}, deps) (fenced; D21 policy for a worker with no valid report)",
  "land.harvestLand": "({project, epoch, actor}, deps) -> {harvested, exit?, output?} (fenced; finishes the land job)",
  "deferred.enqueueDeferred": "(project, entry, deps) -> {entry, created} (an audit that cannot run now, BUILD-14)",
  "risk.computeRisk": "({root, range}, deps) -> {zone, rules, audit, irreversible, ...}",
  "telemetry.emitEvent": "(project, {runtime, runId, name, data}, deps) (never throws; bulkhead)",
});

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

/**
 * The `next` command: decide and apply what the coordinator does next.
 * @param {{project: string, epoch: number, wait?: number, actor?: "cli"|"drive", sessionModel?: string|null, k?: number|null}} input
 *   `sessionModel`/`k` override the values the run journaled at start/resume (`run_started|run_resumed.data.session_model|k`).
 * @param {object} [deps] state deps (`fs` promises API, `env`, `homedir`, `clock`, `buildState`) plus the sibling
 *   modules of {@link NEXT_SIBLING_CONTRACT} and optional overrides `quota`, `admission`, `routing`, `risk`,
 *   `thresholds`, `tiers`, `riskDeps`, `signalExec`, `isAlive`, `sleep`, `monotonic`, `pollMs`, `log`.
 * @returns {Promise<object>} `{ok, cmd:"next", epoch, action, units, wait, admit, quota, notes_es}`
 * @throws USAGE (bad args), FENCE/QUIESCED (exit 3), INVALID_STATE/LEDGER_CORRUPT/JOURNAL_CHAIN (5), anything else = engine failure (8)
 */
export async function next(input = {}, deps = {}) {
  const { project, actor = "cli" } = input;
  if (typeof project !== "string" || !project) throw err("USAGE", "next: --project is required");
  const epoch = Number(input.epoch);
  if (!Number.isInteger(epoch) || epoch < 0) throw err("USAGE", "next: --epoch <n> is required");
  const waitS = input.wait === undefined || input.wait === null ? 0 : Number(input.wait);
  if (!Number.isFinite(waitS) || waitS < 0 || waitS > MAX_WAIT_S) throw err("USAGE", `next: --wait must be 0..${MAX_WAIT_S} seconds`);
  if (actor !== "cli" && actor !== "drive") throw err("USAGE", `next: bad actor ${actor}`);

  const d = resolveDeps(deps);
  const run = {
    ref: { project, epoch, actor, deps: d }, d, paths: buildPaths(project, d),
    overrides: { sessionModel: input.sessionModel ?? null, k: input.k ?? null }, l4: null, recorded: false,
  };
  const started = d.monotonic();
  const first = await step(run);
  if (first.out.action !== "wait" || waitS === 0) return first.out;
  const cap = ["ram", "cpu_H"].includes(first.out.wait.reason) ? Math.min(waitS, first.out.wait.retry_after_s) : waitS;
  await waitForChange(run, first.watch, started + cap * 1000);
  return (await step(run)).out;
}

// ---------------------------------------------------------------------------------------------
// One scheduling pass
// ---------------------------------------------------------------------------------------------

async function step(run) {
  const { d } = run;
  // (0) renew + the call's single admission reading (phase 1 of a fenced step).
  const signals = await readSignalsSafe(run);
  let state = await mutate(run, (s, ctx) => {
    run.leaseRuntime = ctx.lease?.runtime ?? run.leaseRuntime ?? null;
    if (signals.value && !run.recorded) {
      run.l4 = d.admission.recordReading(signals.value, admissionCtx(run));
      run.recorded = true;
    }
    return { value: s };
  });
  if (state.status !== "active") return { out: await alreadyStopped(run, state), watch: [] };
  const notes = [];

  // (1) harvest finished jobs and workers; (2) integrate committed chains (the G2 spawn rides on admission, step 6).
  await harvest(run, await fresh(run), notes);
  // The land job rebases and fast-forwards the integration branch: nothing else writes it meanwhile (C05).
  if (!landRunning(await fresh(run))) await integrateStep(run, await fresh(run), notes);
  state = await fresh(run);

  // (3) quota policy (the A11 priority is owned by quota.policy): handoff, or the paused-quota terminal action.
  const quota = await quotaView(run, state);
  const pol = quota.policy;
  if (pol.handoff) {
    notes.push(`Claude al ${quota.out.claude.pct ?? "?"} %: relevo a drive.`);
    return finish(run, state, { action: "handoff", quota, notes });
  }
  if (pol.paused) {
    if (runningSummary(state).any) return finish(run, state, { action: "wait", wait: { reason: "quota", retry_after_s: RETRY_S.quota }, quota, notes });
    const terminal = { action: "paused-quota", status: "paused", reason: quota.bothOut ? "quota" : "quota_claude_no_drive" };
    notes.push(...terminalNotes(terminal, quota));
    state = await applyTerminal(run.ref, terminal, d);
    return finish(run, state, { action: terminal.action, quota, notes });
  }

  // (4)(5) deferred reviews first, planner round, pending answers (D19).
  const deferredEntries = await listDeferred(run);
  state = await scheduleManagedUnits(run, state, pol, deferredEntries);
  const plan = await planRound(run, state, pol);
  state = plan.state;
  state = await parkIrreversiblePending(run, state);

  // Landing first (priority landing > heavy job > new builder).
  const landing = await landDecision(run, state, pol, deferredEntries, notes);
  state = landing.state;
  if (landing.action === "land") return finish(run, state, { action: "land", quota, notes });
  if (landRunning(state)) return finish(run, state, { action: "wait", wait: { reason: "jobs_running", retry_after_s: RETRY_S.jobs_running }, quota, notes });

  // (6)(7) admission and dispatch.
  const runParams = await readRunParams(run);
  const candidates = await buildCandidates(run, state, pol, plan, runParams, deferredEntries);
  state = candidates.state;
  const dispatch = await dispatchRound(run, state, candidates, runParams, signals, quota);
  state = dispatch.state;
  const g2Fails = dispatch.g2Fails ?? {};
  for (const frd of dispatch.g2Failed ?? []) {
    notes.push(`G2 de ${frd} no arrancó: no se pudo crear su copia de la rama de integración (fallo ${g2Fails[frd] ?? 1} de ${G2_SNAPSHOT_FAIL_MAX}); ${(g2Fails[frd] ?? 1) >= G2_SNAPSHOT_FAIL_MAX ? "se devuelve por fallo del entorno" : "se reintenta en el siguiente paso"}.`);
  }
  if (dispatch.units.length) return finish(run, state, { action: "dispatch", units: dispatch.units, admit: dispatch.admit, quota, notes });

  // Nothing dispatched: wait while anything runs (A11), else a terminal action.
  const running = runningSummary(state);
  if (running.any || landing.waitLand) {
    const reason = running.jobs || landing.waitLand ? "jobs_running" : "workers_running";
    return finish(run, state, { action: "wait", wait: { reason, retry_after_s: landing.waitLand ? LAND_RETRY_S : RETRY_S[reason] }, admit: dispatch.admit, quota, notes });
  }
  if ((dispatch.g2Failed ?? []).length) {
    // A G2 snapshot that could not be created leaves nothing running: wait and retry it at the next call, or hand the FRD
    // back as an environment failure once it has failed G2_SNAPSHOT_FAIL_MAX passes in a row (never a silent stop: NB2).
    const retrying = await handBackExhaustedG2(run, state, dispatch.g2Failed, g2Fails, notes);
    state = await fresh(run);
    if (retrying.length) return finish(run, state, { action: "wait", wait: { reason: "jobs_running", retry_after_s: RETRY_S.gate }, admit: dispatch.admit, quota, notes });
  }
  if (landing.bootFailed && state.handbacks_in_a_row < ENV_INFRA_STOP) {
    // The landing retries (and re-runs the bootstrap) at the next call: a quiet pass here is not "no progress". The
    // ENV_INFRA_STOP streak of hand-backs ends the run through chooseTerminal (FIX-D-4).
    return finish(run, state, { action: "wait", wait: { reason: "gate", retry_after_s: RETRY_S.gate }, admit: dispatch.admit, quota, notes });
  }
  const terminal = chooseTerminal(state, { pol, l4: run.l4, plan, candidates, dispatch });
  if (terminal.action === "wait") {
    return finish(run, state, { action: "wait", wait: { reason: terminal.reason, retry_after_s: RETRY_S[terminal.reason] }, admit: dispatch.admit, quota, notes });
  }
  notes.push(...terminalNotes(terminal, quota));
  if (terminal.action !== "done") state = await applyTerminal(run.ref, terminal, d);
  return finish(run, state, { action: terminal.action, admit: dispatch.admit, quota, notes });
}

function finish(run, state, { action, units = [], wait = null, admit = null, quota, notes = [] }) {
  const out = {
    ok: true, cmd: "next", epoch: run.ref.epoch, action, units, wait,
    admit: admit ?? null, quota: quota?.out ?? null, notes_es: notes.filter(Boolean),
  };
  return { out, watch: watchList(run, state) };
}

// ---------------------------------------------------------------------------------------------
// Deps, state access
// ---------------------------------------------------------------------------------------------

function resolveDeps(deps) {
  const env = deps.env ?? process.env;
  return {
    ...deps,
    env,
    quota: deps.quota ?? quotaModule,
    admission: deps.admission ?? admissionModule,
    routing: deps.routing ?? routingModule,
    risk: deps.risk ?? riskModule,
    monotonic: deps.monotonic ?? (() => performance.now()),
    sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    isAlive: deps.isAlive ?? defaultIsAlive,
    pollMs: deps.pollMs ?? WATCH_POLL_MS,
    log: deps.log ?? ((line) => process.stderr.write(`${line}\n`)),
  };
}

const defaultIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
};

function nowMs(d) {
  const forced = d.env.PANDACORP_NOW;
  if (forced) return Date.parse(forced);
  return d.clock ? d.clock().getTime() : Date.now();
}
const nowIsoOf = (d) => new Date(nowMs(d)).toISOString();

/** The sibling function `<stem>.<fn>`: `deps.<stem>` when injected, else the real module (imported on first use). */
async function sibling(d, stem, fn) {
  let ns = d[stem];
  if (!ns) {
    try { ns = await import(`./${stem}.mjs`); } catch (error) {
      throw err("ENGINE_FAILURE", `next: sibling module ${stem}.mjs cannot be loaded: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    d[stem] = ns;
  }
  const f = ns[fn];
  if (typeof f !== "function") throw err("ENGINE_FAILURE", `next: sibling ${stem}.${fn} is not a function`);
  return f;
}

const quotaDeps = (d) => ({ env: d.env, homedir: d.homedir, thresholds: d.thresholds });
const routingDeps = (d) => (d.tiers ? { tiers: d.tiers } : undefined);
const admissionCtx = (run) => ({ file: run.paths.admissionFile, now: () => nowMs(run.d) });

/**
 * One fenced step: phase 1 (renews the lease) reads the state, `fn(state, ctx)` returns `{state?, events?, value?}`;
 * events are journaled first (the journal is the replay source), then the state is written.
 */
async function mutate(run, fn) {
  return fencedTwoPhase(run.ref, async (ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no build/state.json for this run", { hint: "rebuild-state" });
    if (state.run_id !== ctx.runId) throw err("FENCE", `state run ${state.run_id} is not the lease run ${ctx.runId}`);
    const out = (await fn(state, ctx)) ?? {};
    for (const event of out.events ?? []) await ctx.appendEvent(event);
    if (out.state) await ctx.writeState(out.state);
    return out.value !== undefined ? out.value : (out.state ?? state);
  }, passIntent);
}

// `fencedTwoPhase` returns the work step's result when phase 2 is omitted: a phase-1-only mutation passes its intent through.
const passIntent = (intent) => intent;

async function fresh(run) {
  const state = await readState(run.ref.project, run.d);
  if (!state) throw err("INVALID_STATE", "build/state.json disappeared during next", { hint: "rebuild-state" });
  return state;
}

const unitEvent = (unit, from, to) => ({ type: "unit_state", data: { unit, from, to } });
const integrationRoot = (run, state) => path.resolve(run.ref.project, state.integration?.worktree ?? run.paths.integrationWorktree);
const isLive = (u) => LIVE_STATES.includes(u.state);
/** A unit built on an assumption the owner has not answered (BUILD-12): dispatchable, never landed until accepted. */
const isAssumed = (u) => u?.parked === "built_on_assumption";
/** Built-on-assumption work that can still run (not integrated on its assume branch yet). */
const assumedRunnable = (u) => isAssumed(u) && !["integrated", "reviewing", "patching", "verified", "landed"].includes(u.state);

// ---------------------------------------------------------------------------------------------
// (1) Harvest
// ---------------------------------------------------------------------------------------------

async function harvest(run, state, notes) {
  for (const job of state.jobs.filter((j) => j.state === "running")) {
    if (job.kind === "worker") await harvestWorker(run, job, notes);
    else if (job.kind === "g2") await harvestG2(run, job, notes);
  }
  if (state.jobs.some((j) => j.kind === "land" && j.state === "running")) await harvestLand(run, notes);
}

async function finishJob(run, job, { state: jobState, exit }) {
  await mutate(run, (s) => {
    const cur = s.jobs.find((j) => j.id === job.id);
    if (!cur || cur.state !== "running") return {};
    return {
      state: { ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, state: jobState, exit: exit ?? null } : j)) },
      events: [{ type: "job_finished", data: { id: job.id, state: jobState, exit: exit ?? null } }],
    };
  });
}

const fenceOf = (run) => ({ project: run.ref.project, epoch: run.ref.epoch });

/** One CLI-launched worker (`via:"cli"`): poll it with `read`; a sealed result is ingested like a session report. */
async function harvestWorker(run, job, notes) {
  const { d, ref, paths } = run;
  const state0 = await fresh(run);
  const unit0 = findUnit(state0, job.unit);
  const reviewType = unit0 ? REVIEW_TYPE_KINDS.includes(unit0.kind) && unit0.kind !== "doubt-consult" : false;
  const consult = unit0?.kind === "doubt-consult";
  const reportFile = !unit0 ? null : consult ? paths.unitAnswerFile(unit0.id) : reviewType ? paths.reviewFile(unit0.id) : paths.reportFile(unit0.id);
  const schemaFile = !unit0 ? null : paths.schemaFile(consult ? "doubt-answer" : reviewType ? "review-report" : "report");
  const h = await (await sibling(d, "workers", "pollWorker"))({ project: ref.project, workerId: job.worker_id, unit: job.unit, schemaFile, reportFile, epoch: ref.epoch }, d);
  if (!["running", "done", "error"].includes(h?.state)) throw err("ENGINE_FAILURE", `workers.pollWorker returned no worker state for ${job.worker_id}`);
  if (h.state === "running") return;
  if (h.state === "error") {
    // The `read` itself failed (timeout, unreadable seal): the worker is not settled; the next pass polls again.
    d.log(`next: worker ${job.worker_id} could not be read (${h.kind ?? "error"}): ${h.detail ?? ""}`);
    return;
  }
  const state = await fresh(run);
  const unit = findUnit(state, job.unit);
  const jobEnd = { state: h.outcome === "worker_error" && h.kind === "dead" ? "dead" : "done", exit: Number.isInteger(h.exit) ? h.exit : null };
  if (!unit || !isLive(unit)) return finishJob(run, job, jobEnd);

  if (h.outcome === "limit") {
    await requeueAfterLimit(run, unit, job, jobEnd);
    notes.push(h.limit === "usage_limit" ? `Codex llegó a su límite de uso; ${unit.id} vuelve a la cola sin gastar intento.` : `Codex limitó la frecuencia; ${unit.id} vuelve a la cola sin gastar intento.`);
    return;
  }
  if (consult) {
    if (h.outcome === "report" && h.report && typeof h.report === "object") await atomicWriteJson(reportFile, { ...h.report, consulted: cellOf(unit.worker) }, { fs: d.fs });
    else await atomicWriteJson(reportFile, { decision: null, rationale: "consultant returned no answer", consulted: cellOf(unit.worker), confidence: "low", reversible: false }, { fs: d.fs });
    await settle(run, unit.id, async () => (await sibling(d, "doubts", "answerDoubt"))({ ...fenceOf(run), id: unit.doubt_id, file: reportFile, token: null }, d));
    return finishJob(run, job, jobEnd);
  }
  if (h.outcome !== "report" || !h.report || typeof h.report !== "object") {
    const cause = ENV_WORKER_OUTCOMES.includes(h.outcome) ? "env-infra" : "code";
    await finishJob(run, job, jobEnd);
    // A failed execution, not a hand-back: the D21 policy decides (attempt 1 -> attempt 2 on the same unit).
    const detail = `el worker de Codex no entregó un informe válido (${h.outcome ?? "?"}${h.kind ? `: ${h.kind}` : ""})${h.detail ? `: ${String(h.detail).slice(0, 300)}` : ""}`;
    await (await sibling(d, "failure", "failUnit"))({ ...fenceOf(run), unit: unit.id, attempt: unit.attempt, cause, detail, command: null, tail: String(h.detail ?? "") }, d);
    return;
  }
  if (!h.reportFile) await atomicWriteJson(reportFile, h.report, { fs: d.fs });
  await finishJob(run, job, jobEnd);
  const call = reviewType ? await sibling(d, "review", "reviewRecord") : await sibling(d, "report", "ingestReport");
  // A `via:"cli"` worker has no shell to run `doubt open`: the engine opens its doubt (B2). `openDoubt` asks the sibling to
  // do it right after settling; `openReportedDoubt` covers whatever is still `reported` without an open doubt.
  const res = await settle(run, unit.id, () => call({ ...fenceOf(run), unit: unit.id, token: typeof h.report.token === "string" ? h.report.token : "", file: reportFile, openDoubt: true }, d));
  notes.push(...doubtNotes(unit.id, res?.doubt_opened, res?.handback));
  await openReportedDoubt(run, unit.id, h.report, notes);
}

/** Open doubt-ladder steps (`doubt.schema.json` `step`); `parked` and `decided` are closed. */
const OPEN_DOUBT_STEPS = Object.freeze(["sources", "consult1", "consult2"]);

/**
 * A unit left `reported` by a worker or reviewer doubt with no open doubt record (B2): open it through
 * `failure.openUnitDoubt` (fenced; it hands the unit back when the doubt cannot be built or the ladder refuses it), so
 * the unit never stays `reported` for good. The doubt object is the report's own; a diagnosis-only report (a `blocked`
 * worker whose policy action was `doubt`/`dispute`) is synthesized from its diagnosis by failure.mjs.
 */
async function openReportedDoubt(run, unitId, report, notes) {
  const { d } = run;
  const unit = findUnit(await fresh(run), unitId);
  if (!unit || unit.state !== "reported") return;
  if (unit.doubt_id) {
    const record = await readJson(run.paths.doubtFile(unit.doubt_id), { fs: d.fs });
    if (record && OPEN_DOUBT_STEPS.includes(record.step)) return;
  }
  const doubt = report && typeof report.doubt === "object" && report.doubt !== null ? report.doubt : null;
  const diagnosis = report && typeof report.diagnosis === "object" && report.diagnosis !== null ? report.diagnosis : null;
  const opened = await (await sibling(d, "failure", "openUnitDoubt"))({ ...fenceOf(run), unit: unitId, doubt, diagnosis, actor: run.ref.actor }, d);
  if (opened?.opened === false) notes.push(...doubtNotes(unitId, null, opened.handback));
  else if (opened?.opened) notes.push(...doubtNotes(unitId, opened, null));
}

/** Owner-facing lines for a doubt the engine opened (or the hand-back that replaced it). */
function doubtNotes(unitId, opened, handback) {
  if (handback) return [handback.notice_es ?? `${unitId} se devuelve: su duda no se pudo abrir.`];
  if (!opened?.doubt_id || opened.applied === false) return [];
  if (opened.notice_es) return [opened.notice_es];
  if (opened.step === "sources") return [`${unitId} planteó la duda ${opened.doubt_id}: falta el paso de fuentes (doubt answer con el archivo ${opened.doubt_id}.sources.json).`];
  return [`${unitId} planteó la duda ${opened.doubt_id}: se consulta (${opened.step}).`];
}

// A sibling that rejects a report with a thrown exit-6/7 class code has usually settled the unit (a verdict recorded,
// the unit parked or re-queued). The exception is a refusal raised BEFORE anything was written (a rejected token, an
// invalid review report): the unit is then still live with its job already closed, and swallowing it would leave the
// unit running forever. Such a refusal is routed, never ignored: a unit the D21 policy can fail (docs, tests, build,
// patch) is failed through `failure.failUnit` (worker_failed, cause `code`); any other kind raises ENGINE_FAILURE.
// Fences and faults propagate.
async function settle(run, unitId, fn) {
  try { return await fn(); } catch (error) {
    if (!SETTLED_OUTCOME_CODES.includes(error?.code)) throw error;
    const unit = findUnit(await fresh(run), unitId);
    if (!unit || !isLive(unit)) return { settled: error.code };
    const detail = `el informe de ${unit.id} fue rechazado sin registrarse (${error.code}): ${String(error.message ?? "").slice(0, 300)}`;
    if (!PLANNED_KINDS.includes(unit.kind)) throw err("ENGINE_FAILURE", `next: ${detail}; the ${unit.kind} unit is still ${unit.state} and nothing settled it`, { cause: error });
    await (await sibling(run.d, "failure", "failUnit"))({ ...fenceOf(run), unit: unit.id, attempt: unit.attempt, cause: "code", detail, command: null, tail: String(error.message ?? "") }, run.d);
    return { refused: error.code, failed: unit.id };
  }
}

/** A usage or rate limit consumes no attempt: the unit returns to the queue with its token released (pollWorker already recorded the reading). */
async function requeueAfterLimit(run, unit, job, jobEnd) {
  const { d } = run;
  d.admission.releaseToken(unit.id, admissionCtx(run));
  await mutate(run, (s) => {
    const u = findUnit(s, unit.id);
    const events = [{ type: "job_finished", data: { id: job.id, state: jobEnd.state, exit: jobEnd.exit } }];
    let units = s.units;
    if (u && isLive(u)) {
      events.push(unitEvent(u.id, u.state, "queued"));
      // Same attempt, no previous cell: a limit consumes no attempt and must not raise the effort.
      units = s.units.map((x) => (x.id === u.id ? { ...x, state: "queued", token_hash: null, worker: null, worktree: null, branch: null } : x));
    }
    return { state: { ...s, units, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, ...jobEnd } : j)) }, events };
  });
}

/**
 * One finished G2 job. Its verdict belongs to the integration sha its snapshot was pinned at (B5): it applies to the FRD
 * units whose integrated sha is contained in that pin; when one of them is not (it was integrated after the pin), the
 * verdict is stale and dropped, and the G2 rule re-spawns the gate at the current tip. Merges of OTHER FRDs after the pin
 * never invalidate it. A job without a pin (spawned before snapshots) keeps the old rule. The snapshot is removed here.
 */
async function harvestG2(run, job, notes) {
  const { d, ref } = run;
  const polled = await (await sibling(d, "jobs", "pollJob"))(ref.project, job, d);
  if (!["running", "done", "dead"].includes(polled?.state)) throw err("ENGINE_FAILURE", `jobs.pollJob returned no job state for ${job.id}`);
  if (polled.state === "running") return;
  const exit = Number.isInteger(polled.exit) ? polled.exit : null;
  const judged = polled.state === "done" && exit !== null && exit !== G2_BOOTSTRAP_EXIT;
  const pin = g2PinOf(run.paths, job);
  const before = await fresh(run);
  const checked = judged && pin ? await staleCheck(run, before, job.frd, pin.sha) : { stale: false, units: null };
  const green = judged && !checked.stale && exit === 0;
  let handback = null;
  const zone = green ? await reviewZone(run, before, pin?.sha) : null;
  await mutate(run, (s) => {
    const cur = s.jobs.find((j) => j.id === job.id);
    if (!cur || cur.state !== "running") return {};
    const ended = polled.state === "dead" ? "dead" : "done";
    const events = [{ type: "job_finished", data: { id: job.id, state: ended, exit } }];
    let next = { ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, state: ended, exit } : j)) };
    const work = next.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === job.frd && u.state === "integrated");
    if (polled.state === "done" && exit === G2_BOOTSTRAP_EXIT) {
      // The snapshot could not be prepared: the environment failed, not the code (D21 env-infra hand-back, no patch).
      handback = work[0] ? { unit: work[0].id, reason: `G2 de ${job.frd} no pudo preparar su copia de trabajo (worktree-bootstrap.sh falló)`, cause: "env-infra" } : null;
      return { state: next, events };
    }
    if (!judged) return { state: next, events }; // dead: re-spawned by the G2 rule at this or the next pass
    const stale = checked.stale || (checked.units !== null && work.some((u) => !checked.units.includes(u.id)));
    events.push({ type: "gate", data: { tier: "G2", exit, frd: job.frd, ...(pin ? { sha: pin.sha } : {}), ...(stale ? { stale: true } : {}) } });
    if (stale) return { state: next, events }; // judged an older tree of this FRD: the G2 rule re-runs it at the tip
    if (green) {
      for (const u of work) events.push(unitEvent(u.id, u.state, "reviewing"));
      next = { ...next, units: next.units.map((u) => (work.includes(u) ? { ...u, state: "reviewing" } : u)) };
      const reviewId = `u-review-${job.frd}`;
      const existing = findUnit(next, reviewId);
      if (!existing) {
        const review = newUnit({ id: reviewId, kind: "review", frd: job.frd, wos: unionWos(work), zone: maxZone(work.map((u) => u.zone).concat(zone?.zone ?? "none")), risk_rules: zone?.rules ?? [] });
        next = { ...next, units: [...next.units, review] };
        events.push({ type: "unit_queued", data: review });
      } else if (existing.state === "verified") {
        // The FRD changed after its last pass (a G3 patch): the review re-runs.
        events.push(unitEvent(existing.id, existing.state, "queued"));
        next = { ...next, units: next.units.map((u) => (u.id === reviewId ? { ...u, state: "queued", token_hash: null } : u)) };
      }
      return { state: next, events };
    }
    const attempt = Math.max(0, ...work.map((u) => u.attempt)) + 1;
    if (attempt > MAX_ATTEMPTS || work.length === 0) {
      handback = work[0] ? { unit: work[0].id, reason: `G2 en rojo en ${job.frd} tras agotar los ${MAX_ATTEMPTS} intentos`, cause: "code" } : null;
      return { state: next, events };
    }
    const patchId = `u-patch-${job.frd}`;
    const existing = findUnit(next, patchId);
    if (existing) {
      events.push(unitEvent(patchId, existing.state, "queued"));
      next = { ...next, units: next.units.map((u) => (u.id === patchId ? { ...u, state: "queued", attempt, token_hash: null } : u)) };
    } else {
      const patch = newUnit({ id: patchId, kind: "patch", frd: job.frd, wos: unionWos(work), zone: maxZone(work.map((u) => u.zone)), attempt });
      next = { ...next, units: [...next.units, patch] };
      events.push({ type: "unit_queued", data: patch });
    }
    return { state: next, events };
  });
  if (pin) await removeG2Snapshot(run, pin.dir);
  if (handback) await (await sibling(d, "failure", "handbackCommand"))({ ...fenceOf(run), ...handback }, d);
  if (checked.stale) notes.push(`G2 de ${job.frd} juzgó ${pin.sha.slice(0, 12)}, pero el FRD cambió después: se repite sobre la rama actual.`);
  else if (judged && exit !== 0) notes.push(`G2 en rojo en ${job.frd}: se encola una corrección.`);
}

/**
 * Is a G2 verdict pinned at `pin` stale for `frd`? Stale iff an integrated unit of the FRD has an `integrated` journal sha
 * that is not contained in `pin` (pure sha comparison, B5). Returns the unit ids it checked so the harvest can treat a
 * unit integrated in between as stale too.
 */
async function staleCheck(run, state, frd, pin) {
  const units = state.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === frd && u.state === "integrated");
  const shaOf = new Map();
  for (const ev of (await readJournal(run.paths.journalFile, run.d)).events) {
    if (ev.type === "integrated" && typeof ev.data?.unit === "string" && typeof ev.data.sha === "string") shaOf.set(ev.data.unit, ev.data.sha);
  }
  for (const u of units) {
    const sha = shaOf.get(u.id);
    if (sha && sha !== pin && !(await gitOk(run.ref.project, ["merge-base", "--is-ancestor", sha, pin]))) return { stale: true, units: units.map((x) => x.id) };
  }
  return { stale: false, units: units.map((x) => x.id) };
}

// ---------------------------------------------------------------------------------------------
// G2 snapshot worktrees (B5): every G2 job judges its own detached checkout of a pinned integration sha
// ---------------------------------------------------------------------------------------------

const g2SnapshotRoot = (paths) => path.join(paths.build, G2_SNAPSHOT_DIR);

/** `<build>/g2/<frd>-<sha>`: the frd and sha make it unique per job (one live G2 per FRD, A18). */
function g2SnapshotDir(paths, frd, sha) {
  if (!SHA_RE.test(sha)) throw err("INVALID_STATE", `G2 pin is not a commit sha: ${JSON.stringify(sha)}`);
  return resolveInside(g2SnapshotRoot(paths), `${assertSafeId(frd, "frd id")}-${sha}`);
}

/** The snapshot directory and pinned sha of a G2 job, read back from its `cwd`; null for a job with no snapshot. */
export function g2PinOf(paths, job) {
  if (job?.kind !== "g2" || typeof job.cwd !== "string") return null;
  const root = g2SnapshotRoot(paths);
  const rel = path.relative(root, path.resolve(job.cwd));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const top = rel.split(path.sep)[0];
  const m = G2_SNAPSHOT_RE.exec(top);
  return m ? { dir: path.join(root, top), frd: m[1], sha: m[2] } : null;
}

/** `git <args>` in `cwd`; resolves `{code, stdout, stderr}` (never rejects). */
function gitRun(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: GIT_SHOW_TIMEOUT_MS * 8 }, (error, stdout, stderr) => resolve({ code: error ? (Number.isInteger(error.code) ? error.code : 1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }));
  });
}

async function gitOut(cwd, args) {
  const res = await gitRun(cwd, args);
  if (res.code !== 0) throw err("INVALID_STATE", `git ${args.slice(0, 2).join(" ")} failed in ${cwd}: ${res.stderr.trim().split("\n")[0]}`);
  return res.stdout.trim();
}

/** Registered worktree paths (realpath spelling) of the project's repository. */
async function registeredWorktrees(run) {
  const out = await gitOut(run.ref.project, ["worktree", "list", "--porcelain"]);
  const fs = run.d.fs ?? fsp;
  const real = async (p) => { try { return await fs.realpath(p); } catch { return path.resolve(p); } };
  return Promise.all(out.split("\n").filter((l) => l.startsWith("worktree ")).map((l) => real(l.slice(9))));
}

/**
 * Create the detached snapshot worktree of one G2 job at the integration tip (work phase, no mutex). A leftover at the same
 * path (a dead job of the same FRD and sha) is removed first; nothing outside `<build>/g2/` is ever touched.
 * @returns {Promise<{dir: string, cwd: string, sha: string}>} `cwd` is the product root inside the snapshot (nested projects)
 */
async function createG2Snapshot(run, state, frd) {
  const fs = run.d.fs ?? fsp;
  const branch = state.integration?.branch;
  const viaBranch = branch ? await gitRun(run.ref.project, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`]) : { code: 1 };
  const sha = viaBranch.code === 0 ? viaBranch.stdout.trim() : await gitOut(integrationRoot(run, state), ["rev-parse", "--verify", "HEAD^{commit}"]);
  const dir = g2SnapshotDir(run.paths, frd, sha);
  await removeG2Snapshot(run, dir, { strict: true });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const registered = path.join(await fs.realpath(path.dirname(dir)), path.basename(dir));
  await gitOut(run.ref.project, ["worktree", "add", "--detach", registered, sha]);
  if (run.prefix === undefined) run.prefix = await productPrefix(run.ref.project, { env: run.d.env });
  return { dir, cwd: productRoot(dir, run.prefix), sha };
}

/**
 * Remove one G2 snapshot (`git worktree remove --force`, then prune; a stray unregistered directory under `<build>/g2/` is
 * deleted). Cleanup after a harvest is best effort: a failure is logged and the leftover is replaced at the next spawn.
 */
async function removeG2Snapshot(run, dir, { strict = false } = {}) {
  const fs = run.d.fs ?? fsp;
  try {
    resolveInside(g2SnapshotRoot(run.paths), path.relative(g2SnapshotRoot(run.paths), dir));
    const real = await fs.realpath(dir).catch(() => null);
    if (real && (await registeredWorktrees(run)).includes(real)) await gitOut(run.ref.project, ["worktree", "remove", "--force", real]);
    await gitOut(run.ref.project, ["worktree", "prune"]);
    await fs.rm(dir, { recursive: true, force: true });
    // The snapshot's bootstrap left a manifest entry in the main checkout (Mission Control lists it as a pending worktree).
    await dropBootstrapManifests(run.ref.project, real ?? dir, { fs, env: run.d.env });
  } catch (error) {
    if (strict) throw error;
    run.d.log(`next: the G2 snapshot ${dir} could not be removed: ${error?.message ?? error}`);
  }
}

/**
 * Remove every G2 snapshot of the run (`<build>/g2/*`) and its bootstrap manifest entry, except (unless `all`) the snapshot
 * a `running` G2 job of `state` still judges: that one is removed by its own harvest. Called when the run stops (terminal
 * actions, `stop`), finishes, and on `start --resume` (leftovers of a crash between a snapshot and its job). Never runs
 * under the lease mutex; best effort: a failure is logged, never thrown (NB5).
 * @param {{project: string, state?: object|null, all?: boolean}} input `state` defaults to `build/state.json`
 * @param {object} [deps] `fs`, `env`, `homedir`, `log`
 * @returns {Promise<{removed: string[], kept: string[]}>}
 */
export async function removeAllG2Snapshots({ project, state = null, all = false }, deps = {}) {
  const d = resolveDeps(deps);
  const fs = d.fs ?? fsp;
  const run = { ref: { project }, d, paths: buildPaths(project, d) };
  const root = g2SnapshotRoot(run.paths);
  const removed = [];
  const kept = [];
  try {
    const names = await fs.readdir(root).catch((error) => { if (error?.code === "ENOENT") return []; throw error; });
    if (!names.length) return { removed, kept };
    let live = new Set();
    if (!all) {
      const s = state ?? await readState(project, d).catch(() => null);
      live = new Set((s?.jobs ?? []).filter((j) => j.kind === "g2" && j.state === "running").map((j) => g2PinOf(run.paths, j)?.dir).filter(Boolean));
    }
    for (const name of names) {
      const dir = path.join(root, name);
      if (live.has(dir)) { kept.push(dir); continue; }
      await removeG2Snapshot(run, dir);
      removed.push(dir);
    }
    await gitRun(project, ["worktree", "prune"]);
  } catch (error) {
    d.log(`next: the G2 snapshots under ${root} could not be cleaned: ${error?.message ?? error}`);
  }
  return { removed, kept };
}

const g2FailuresFile = (paths) => path.join(paths.build, "g2-snapshot-failures.json");

/** `{<frd>: consecutive failed snapshot passes}`, persisted under `<build>/` (untracked) because every `next` call is a new process. */
async function readG2Failures(run) {
  try {
    const counts = await readJson(g2FailuresFile(run.paths), { fs: run.d.fs });
    return counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {};
  } catch (error) {
    if (error.code === "LEDGER_CORRUPT") return {};
    throw error;
  }
}

/** Reset the counter of the FRDs whose snapshot was made and add one to the failed ones; returns the counts of the failed FRDs. */
async function trackG2SnapshotFailures(run, okFrds, failedFrds) {
  if (!okFrds.length && !failedFrds.length) return {};
  const counts = await readG2Failures(run);
  for (const frd of okFrds) delete counts[frd];
  for (const frd of failedFrds) counts[frd] = (Number(counts[frd]) || 0) + 1;
  await atomicWriteJson(g2FailuresFile(run.paths), counts, { fs: run.d.fs });
  return Object.fromEntries(failedFrds.map((frd) => [frd, counts[frd]]));
}

/**
 * Hand back (cause `env-infra`, the unit and its dependents `blocked`, R4) the first integrated work unit of every FRD whose
 * G2 snapshot has failed `G2_SNAPSHOT_FAIL_MAX` passes in a row, and reset its counter.
 * @returns {Promise<string[]>} the FRDs that are still retrying (their snapshot failed fewer times)
 */
async function handBackExhaustedG2(run, state, failedFrds, fails, notes) {
  const retrying = [];
  const counts = await readG2Failures(run);
  for (const frd of failedFrds) {
    if ((fails[frd] ?? counts[frd] ?? 1) < G2_SNAPSHOT_FAIL_MAX) { retrying.push(frd); continue; }
    delete counts[frd];
    const work = state.units.find((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === frd && u.state === "integrated");
    if (!work) {
      // The FRD left `integrated` since the failed passes (nothing waits on its G2 any more): nothing to hand back, but
      // the dropped retry is reported, never silent (DR1c-N2).
      notes.push(`G2 de ${frd}: no se pudo crear su copia de la rama de integración ${G2_SNAPSHOT_FAIL_MAX} veces seguidas, pero ya no queda ninguna unidad integrada que devolver; se deja de reintentar.`);
      run.d.log(`next: G2 snapshot of ${frd} failed ${G2_SNAPSHOT_FAIL_MAX} times and the FRD has no integrated unit left to hand back`);
      continue;
    }
    const res = await (await sibling(run.d, "failure", "handbackCommand"))({ ...fenceOf(run), unit: work.id, reason: `G2 de ${frd}: no se pudo crear su copia de la rama de integración ${G2_SNAPSHOT_FAIL_MAX} veces seguidas`, cause: "env-infra" }, run.d);
    if (res?.notice_es) notes.push(res.notice_es);
  }
  await atomicWriteJson(g2FailuresFile(run.paths), counts, { fs: run.d.fs });
  return retrying;
}

/** The land job is harvested by land.mjs itself (job_finished, D24 exit map, card archive) under its own fence. */
async function harvestLand(run, notes) {
  const { d, ref } = run;
  const res = await (await sibling(d, "land", "harvestLand"))({ project: ref.project, epoch: ref.epoch, actor: ref.actor }, d);
  if (res?.harvested && res.output?.notes_es) notes.push(...res.output.notes_es);
}

// ---------------------------------------------------------------------------------------------
// (2) Integration (CLI doc 4.1): git work outside the mutex, state and journal under it
// ---------------------------------------------------------------------------------------------

async function integrateStep(run, state, notes) {
  const { d, ref } = run;
  const committed = state.units.some((u) => u.state === "committed" && PLANNED_KINDS.includes(u.kind));
  if (!committed && !(await acceptedAssumptionPending(run, state))) return;
  const res = await fencedTwoPhase(run.ref,
    async (ctx) => {
      const s = await ctx.readState();
      if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
      return s;
    },
    async (s) => (await sibling(d, "integrate", "integrateCommitted"))({ state: s, runId: s.run_id }, { ...d, project: ref.project }),
    async (result, _intent, ctx) => {
      const s = await ctx.readState();
      const done = (Array.isArray(result?.integrated) ? result.integrated : []).filter((x) => x && typeof x.unit === "string");
      const merged = (Array.isArray(result?.merged) ? result.merged : []).filter((x) => x && typeof x.doubt === "string");
      const events = [];
      let units = s.units;
      let safe = s.last_safe_point;
      const safePoint = (sha) => {
        events.push({ type: "safe_point", data: { kind: "integration-land", sha } });
        safe = { sha, kind: "integration-land", at: nowIsoOf(d) };
      };
      // Accepted assumption branches merged first (they precede the chains integrated after them).
      for (const m of merged) {
        events.push({ type: "integrated", data: { unit: null, doubt: m.doubt, sha: m.sha ?? null } });
        if (typeof m.sha === "string") safePoint(m.sha);
      }
      for (const item of done) {
        const u = findUnit(s, item.unit);
        if (!u || u.state !== "committed") continue;
        units = units.map((x) => (x.id === u.id ? { ...x, state: "integrated" } : x));
        const onAssumption = typeof item.assumption === "string" ? item.assumption : null;
        events.push({ type: "integrated", data: { unit: u.id, sha: item.sha ?? null, ...(onAssumption ? { assumption: onAssumption } : {}) } });
        events.push(unitEvent(u.id, "committed", "integrated"));
        // A chain integrated on an assume branch is not a safe point of the integration branch.
        if (typeof item.sha === "string" && !onAssumption) safePoint(item.sha);
      }
      for (const ev of events) await ctx.appendEvent(ev);
      if (events.length) await ctx.writeState({ ...s, units, last_safe_point: safe });
      return { conflicts: Array.isArray(result?.conflicts) ? result.conflicts : [] };
    });
  for (const c of res.conflicts) {
    const unitId = c?.unit?.id ?? c?.unit;
    if (typeof unitId !== "string") continue;
    const reason = typeof c.doubt === "string"
      ? `conflicto al unir la rama de la suposición aceptada (${c.doubt}) con la rama de integración`
      : typeof c.assumption === "string"
        ? `conflicto al integrar la cadena en la rama de la suposición ${c.assumption}`
        : "conflicto al integrar la cadena en la rama de integración";
    await (await sibling(d, "failure", "handbackCommand"))({ ...fenceOf(run), unit: unitId, reason, cause: "code" }, d);
    notes.push(typeof c.doubt === "string" ? `La suposición aceptada ${c.doubt} chocó al unirse: se devuelve ${unitId}.` : `${unitId} chocó al integrarse: se devuelve.`);
  }
}

/**
 * Is there an assumption the owner accepted whose branch is not merged into the integration branch yet? Reads the doubt
 * records of the answered questions (`state.answers`) and checks ancestry with git; integrate.mjs does the merge (C10).
 */
async function acceptedAssumptionPending(run, state) {
  const branchOf = state.integration?.branch;
  if (!branchOf) return false;
  for (const id of Object.keys(state.answers ?? {})) {
    let file;
    try { file = run.paths.doubtFile(id); } catch { continue; }
    const record = await readJson(file, { fs: run.d.fs }).catch(() => null);
    if (!record?.assumption || !record.decision || !Object.hasOwn(record.decision, "value")) continue;
    if (JSON.stringify(record.decision.value) !== JSON.stringify(record.assumption.option)) continue;
    const branch = run.paths.assumeBranch(state.run_id, id);
    if (!(await gitOk(integrationRoot(run, state), ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]))) continue;
    if (!(await gitOk(integrationRoot(run, state), ["merge-base", "--is-ancestor", branch, branchOf]))) return true;
  }
  return false;
}

/** `git <args>` exit 0? (read-only checks; a git error reads as false). */
function gitOk(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: GIT_SHOW_TIMEOUT_MS }, (error) => resolve(!error));
  });
}

const landRunning = (state) => state.jobs.some((j) => j.kind === "land" && j.state === "running");

// ---------------------------------------------------------------------------------------------
// (3) Quota
// ---------------------------------------------------------------------------------------------

async function quotaView(run, state) {
  const { d, paths } = run;
  const q = await d.quota.readQuota({ file: paths.quotaFile, codexHome: paths.codexHome, coordinator: state.coordinator }, quotaDeps(d));
  const driveAlive = await driveStandbyAlive(run);
  const policy = d.quota.policy({ claude: q.effective.claude, codex: q.effective.codex, coordinator: state.coordinator, driveAlive, deps: quotaDeps(d), thresholds: d.thresholds });
  const view = (e) => ({ pct: e?.pct ?? null, state: e?.state ?? "unknown" });
  return {
    policy, driveAlive, raw: q,
    out: { claude: view(q.effective.claude), codex: view(q.effective.codex) },
    bothOut: !policy.claude_new_units && !policy.codex_new_units,
    resets: { claude: d.quota.resetsAtOf?.(q.claude) ?? null, codex: d.quota.resetsAtOf?.(q.codex) ?? null },
  };
}

/** Drive standby alive = `build/drive/standby.json` names a live pid in state `standby` (A11). */
async function driveStandbyAlive(run) {
  const standby = await readJson(run.paths.driveStandbyFile, { fs: run.d.fs }).catch((error) => {
    if (error.code === "LEDGER_CORRUPT") return null;
    throw error;
  });
  return Boolean(standby && standby.state === "standby" && run.d.isAlive(Number(standby.pid)));
}

const availabilityOf = (pol) => ({ claude: pol.claude_new_units ? "ok" : "quota", codex: pol.codex_new_units ? "ok" : "quota" });
const shapeOf = (state) => (state.coordinator === "codex-session" ? "R-B" : state.coordinator === "drive" ? "drive" : state.label === "codex" ? "R-C" : "R-A");

// ---------------------------------------------------------------------------------------------
// (4)(5) Units managed by next, planner round, pending answers
// ---------------------------------------------------------------------------------------------

/** The deferred-review ledger (missing file = empty; an invalid one fails loud through deferred.readDeferred). */
async function listDeferred(run) {
  return readDeferred(run.ref.project, { fs: run.d.fs, env: run.d.env });
}

const deferredUnitId = (entryId) => `u-deferred-review-${entryId}`;

/** Deferred reviews whose needed company is below the stop threshold become queued units first (BUILD-10, D11). */
async function scheduleManagedUnits(run, state, pol, entries) {
  const avail = availabilityOf(pol);
  const servable = entries.filter((e) => e.status === "pending" && avail[e.needed] === "ok" && !findUnit(state, deferredUnitId(e.id)));
  if (!servable.length) return state;
  return mutate(run, (s) => {
    const add = servable.filter((e) => !findUnit(s, deferredUnitId(e.id))).map((e) => newUnit({
      id: deferredUnitId(e.id), kind: "deferred-review", frd: e.frd ?? null,
      wos: unionWos(s.units.filter((u) => e.frd && u.frd === e.frd && FRD_WORK_KINDS.includes(u.kind))),
      zone: maxZone(s.units.filter((u) => e.frd && u.frd === e.frd).map((u) => u.zone)),
    }));
    if (!add.length) return {};
    return { state: { ...s, units: [...s.units, ...add] }, events: add.map((u) => ({ type: "unit_queued", data: u })) };
  });
}

/** Product root of the integration worktree (the project may live under a prefix of its git repository). */
async function integrationProductRoot(run, state) {
  // `state.integration.worktree` is already the PRODUCT root (lifecycle stores `<git worktree>/<prefix>`); the prefix is still
  // computed because repo-relative reads (`git show <base>:<prefix>docs/...`) need it.
  if (run.prefix === undefined) run.prefix = await productPrefix(run.ref.project, { env: run.d.env });
  return state.integration?.worktree
    ? path.resolve(run.ref.project, state.integration.worktree)
    : productRoot(run.paths.integrationWorktree, run.prefix);
}

/** `git show <rev>:<rel>` text, or null when the path does not exist at that revision. */
function gitShow(cwd, rev, rel) {
  return new Promise((resolve) => {
    execFile("git", ["show", `${rev}:${rel}`], { cwd, timeout: GIT_SHOW_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => resolve(error ? null : stdout));
  });
}

/**
 * (5) One planner round over the integration worktree's work orders: queue the new units that are ready now (in scope
 * only) and return the dispatchable round. The FRD AC ids come from `integration.base_sha` (A13 tests-first trigger).
 */
async function planRound(run, state, pol) {
  const { d } = run;
  const root = await integrationProductRoot(run, state);
  const base = state.integration?.base_sha;
  const prefix = run.prefix ?? "";
  const readFrd = base ? (frd) => gitShow(root, base, `${prefix}docs/frds/${frd}/frd.md`) : undefined;
  const read = await (await sibling(d, "planner", "readPlanWorkOrders"))(root, { ...d, ...(readFrd ? { readFrd } : {}) });
  const wos = await withZones(run, state, read?.wos ?? [], root);
  const questions = [...(await readQuestions(run)).values()].filter((q) => !(q.id in (state.answers ?? {})));
  const params = await readRunParams(run);
  const plan = await (await sibling(d, "planner", "plan"))({
    wos, frd_acs: read?.frd_acs ?? {}, scope: state.scope, units: state.units, label: state.label, size: state.size,
    questions, quota: pol, shape: shapeOf(state), coordinator: state.coordinator, session_model: params.sessionModel,
  }, d);
  const nowIds = Array.isArray(plan?.now) ? new Set(plan.now) : null;
  const add = (plan?.units ?? []).filter((u) => u && (!nowIds || nowIds.has(u.id)) && inScope(state, u));
  let next = state;
  if (add.length) {
    next = await mutate(run, (s) => {
      const fresh = add.filter((u) => !findUnit(s, u.id)).map((u) => newUnit(u));
      if (!fresh.length) return {};
      return { state: { ...s, units: [...s.units, ...fresh] }, events: fresh.map((u) => ({ type: "unit_queued", data: u })) };
    });
  }
  const round = Array.isArray(plan?.round) ? plan.round : Array.isArray(plan?.ready) ? plan.ready : [];
  return { state: next, ready: [...new Set(round)], deadlock: Boolean(plan?.deadlock) };
}

/**
 * Static risk zones on the work orders the planner may still plan (floor/r1 chain cuts, `floor_frds`, A13 tests-first).
 * VERIFIED WOs never matter to the planner; a WO already in a build/patch unit reuses that unit's `zone`/`risk_rules`, so
 * the classifier (`risk.staticZones`, one spawn per WO) runs only on the rest.
 */
async function withZones(run, state, readWos, root) {
  const { d } = run;
  const covered = new Map(state.units.filter((u) => u.kind === "build" || u.kind === "patch")
    .flatMap((u) => (u.wos ?? []).map((w) => [String(w).toLowerCase(), u])));
  const isCovered = (w) => covered.has(String(w.id).toLowerCase());
  const need = readWos.filter((w) => w.status !== "VERIFIED" && !isCovered(w));
  let zoned = new Map();
  if (need.length) {
    const fn = typeof d.risk.staticZones === "function" ? d.risk.staticZones : riskModule.staticZones;
    if (typeof fn !== "function") throw err("ENGINE_FAILURE", "risk.staticZones is missing: work orders cannot get their static zones");
    const res = await fn(need, root, d.riskDeps ?? {});
    if (!Array.isArray(res)) throw err("ENGINE_FAILURE", "risk.staticZones returned no work-order list");
    zoned = new Map(res.map((w) => [w.id, w]));
  }
  return readWos.map((w) => {
    if (zoned.has(w.id)) return zoned.get(w.id);
    if (!isCovered(w)) return w;
    const u = covered.get(String(w.id).toLowerCase());
    return { ...w, zone: u.zone ?? "none", risk_rules: u.risk_rules ?? [] };
  });
}

/**
 * First-minute questions (D19), by id: `{id, reversible, affects, default_es, default_action}`. The source is the preflight
 * THIS run started from (`run_started.data.preflight` in its journal); `build/preflight.json` belongs to the latest
 * `--preflight` and is only the fallback for a journal without it (N5).
 */
async function readQuestions(run) {
  if (run.preflight === undefined) {
    const started = (await readJournal(run.paths.journalFile, run.d)).events.find((ev) => ev.type === "run_started");
    const journaled = started?.data?.preflight;
    run.preflight = journaled && typeof journaled === "object" ? journaled : await readJson(run.paths.preflightFile, { fs: run.d.fs });
  }
  const preflight = run.preflight;
  const out = new Map();
  for (const q of preflight?.questions ?? []) if (q?.id) out.set(q.id, q);
  for (const check of preflight?.checks ?? []) if (check?.question?.id && !out.has(check.question.id)) out.set(check.question.id, check.question);
  return out;
}

/** Queued units waiting on an irreversible (or unknown) first-minute answer park as `owner_question` (D19). */
async function parkIrreversiblePending(run, state) {
  const waiting = state.units.filter((u) => u.state === "queued" && u.pending_answer && !u.parked && !(u.pending_answer in state.answers));
  if (!waiting.length) return state;
  const questions = await readQuestions(run);
  const toPark = waiting.filter((u) => questions.get(u.pending_answer)?.reversible !== true);
  if (!toPark.length) return state;
  return mutate(run, (s) => {
    const ids = new Set(toPark.map((u) => u.id));
    const events = [];
    const units = s.units.map((u) => {
      if (!ids.has(u.id) || u.state !== "queued" || u.parked) return u;
      // `parked` carries the reason, `unit_state` the state: a rebuild-state replays both (N11b).
      events.push({ type: "parked", data: { unit: u.id, reason: "owner_question", question: u.pending_answer } });
      events.push(unitEvent(u.id, u.state, "parked"));
      return { ...u, parked: "owner_question", state: "parked" };
    });
    return events.length ? { state: { ...s, units }, events } : {};
  });
}

// ---------------------------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------------------------

/**
 * Units that wait on the owner or have no reviewer, plus everything that depends on them (transitively through
 * `depends_on`, and the FRD units of a parked review). They are out of the batch and out of the progress test.
 * @returns {{all: Set<string>, ownerRoots: object[]}}
 */
export function blockedClosure(state) {
  // Work built on an assumption is progress while it can still run; it becomes an owner root once integrated (C10).
  const roots = state.units.filter((u) => !isTerminalUnit(u) && ((u.parked && !assumedRunnable(u)) || u.state === "waiting_gate" || u.state === "parked"));
  const blocked = new Set(roots.map((u) => u.id));
  for (const review of roots.filter((u) => u.kind === "review" && u.frd)) {
    for (const u of state.units) if (FRD_WORK_KINDS.includes(u.kind) && u.frd === review.frd && !isTerminalUnit(u)) blocked.add(u.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of state.units) {
      if (blocked.has(u.id) || isTerminalUnit(u)) continue;
      if ((u.depends_on ?? []).some((dep) => blocked.has(dep))) { blocked.add(u.id); grew = true; }
    }
  }
  const ownerRoots = roots.filter((u) => OWNER_PARKS.includes(u.parked) || u.state === "waiting_gate" || (u.state === "parked" && u.parked !== "no_reviewer"));
  return { all: blocked, ownerRoots };
}

const landReady = (u) => (FRD_WORK_KINDS.includes(u.kind) && u.state === "verified") || (u.kind === "docs" && (u.state === "integrated" || u.state === "verified"));

/**
 * Is the batch complete (CLI 3.11: every non-parked unit of the run, or tranche, is ready to land)?
 * @returns {{complete: boolean, ready: string[]}}
 */
export function batchState(state) {
  state = scopedState(state);
  const { all } = blockedClosure(state);
  const active = state.units.filter((u) => !isTerminalUnit(u) && !all.has(u.id));
  const ready = active.filter(landReady);
  return { complete: ready.length > 0 && active.every(landReady), ready: ready.map((u) => u.id) };
}

async function landDecision(run, state, pol, deferredEntries, notes = []) {
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
  if (!boot.ok) return { state: await fresh(run), action: null, waitLand: false, bootFailed: true };
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
async function reviewZone(run, state, head) {
  if (!state.integration?.base_sha) return null;
  const r = await runRisk(run, state, head ?? "HEAD");
  return { zone: r.zone, rules: r.rules ?? [] };
}

// ---------------------------------------------------------------------------------------------
// (6) Candidates and cells
// ---------------------------------------------------------------------------------------------

/** session_model / k: the call's overrides, else the last `run_started|run_resumed` data that carries them. */
async function readRunParams(run) {
  const params = { sessionModel: run.overrides.sessionModel, k: run.overrides.k };
  if (params.sessionModel !== null && params.k !== null) return params;
  const { events } = await readJournal(run.paths.journalFile, run.d);
  for (const ev of events) {
    if (ev.type !== "run_started" && ev.type !== "run_resumed") continue;
    const data = ev.data ?? {};
    if (run.overrides.sessionModel === null && typeof data.session_model === "string") params.sessionModel = data.session_model;
    if (run.overrides.k === null && Number.isInteger(data.k) && data.k > 0) params.k = data.k;
  }
  return params;
}

/**
 * Is a unit inside the run scope? Never when it touches an out-of-scope WO or FRD. With a card, everything else is in.
 * Without a card, each of its WOs must be listed in `scope.wos` or belong to an FRD of `scope.frds` (a WO a docs unit
 * created inside an in-scope FRD); units without WOs (reviews, the audit, consults) are in scope.
 */
export function inScope(state, unit) {
  const scope = state.scope ?? { card: null, wos: [], frds: [], out_of_scope: [] };
  const out = new Set((scope.out_of_scope ?? []).map((x) => String(x).toLowerCase()));
  const wos = (unit.wos ?? []).map((w) => String(w).toLowerCase());
  if (wos.some((w) => out.has(w)) || (unit.frd && out.has(String(unit.frd).toLowerCase()))) return false;
  if (scope.card) return true;
  const allowed = new Set((scope.wos ?? []).map((w) => String(w).toLowerCase()));
  const frds = new Set((scope.frds ?? []).map((f) => String(f).toLowerCase()));
  const frdIn = unit.frd && frds.has(String(unit.frd).toLowerCase());
  return wos.every((w) => allowed.has(w) || frdIn);
}

/** The state restricted to the units of the run scope: out-of-scope units are never pending work (CLI 4). */
const scopedState = (state) => ({ ...state, units: state.units.filter((u) => inScope(state, u)) });

const DEPS_DONE = Object.freeze(["integrated", "reviewing", "patching", "verified", "landed"]);
/** Every `depends_on` unit is integrated or later (D16: a build unit waits for its tests unit). Unknown ids are not met. */
const depsMet = (state, unit) => (unit.depends_on ?? []).every((id) => DEPS_DONE.includes(findUnit(state, id)?.state));

/** reopen_count per WO id (lowercase), from the integration worktree frontmatter. */
async function readReopenCounts(root, fs = fsp) {
  const out = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code === "ENOENT") return out; throw error; }
  for (const frd of frds) {
    let names = [];
    try { names = await fs.readdir(path.join(frdsDir, frd, "work-orders")); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of names.filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md")) {
      const text = await fs.readFile(path.join(frdsDir, frd, "work-orders", name), "utf8");
      const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (block.match(/^id:[ \t]*["']?([^"'\s]+)/m)?.[1] ?? name.replace(/\.md$/, "")).toLowerCase();
      const reopen = Number(block.match(/^reopen_count:[ \t]*(\d+)/m)?.[1] ?? 0);
      out.set(id, reopen);
      // A WO file is usually named `<id>-<slug>.md`: index the id prefix too.
      const prefix = name.match(/^(wo-\d+-\d+)/i)?.[1]?.toLowerCase();
      if (prefix && !out.has(prefix)) out.set(prefix, reopen);
    }
  }
  return out;
}

const cellOf = (worker) => (worker ? { runtime: worker.runtime, model: worker.model, effort: worker.effort } : null);
const authorOf = (worker) => ({ runtime: worker.runtime, model: worker.model, effort: worker.effort, origin: worker.via === "session" ? "session" : "unit", via: worker.via });

/**
 * Ordered dispatch candidates with their cells: deferred reviews, doubt consults, FRD reviews, the audit, then the
 * planner's ready build-type units (tests units first; units on a reversible pending answer last).
 */
async function buildCandidates(run, state, pol, plan, params, deferredEntries) {
  const { d } = run;
  const ctx = { label: state.label, quota: pol, shape: shapeOf(state), coordinator: state.coordinator, sessionModel: params.sessionModel };
  const avail = availabilityOf(pol);
  const out = [];
  let quotaBlocked = false;
  const toParkNoReviewer = [];
  const toUnpark = [];
  const queued = (u) => u.state === "queued" && (!u.parked || isAssumed(u)) && inScope(state, u);

  for (const u of state.units.filter((x) => x.kind === "deferred-review" && queued(x))) {
    const entry = deferredEntries.find((e) => deferredUnitId(e.id) === u.id);
    if (!entry) continue;
    const cell = entry.kind === "audit"
      ? d.routing.builderCell({ kind: "audit", size: state.size, zone: u.zone, attempt: 1 }, { ...ctx, zone: u.zone, attempt: 1, sessionModel: null }, routingDeps(d))
      : d.routing.reviewCell({ authors: [entry.author], kind: state.size === "touch" ? "touch" : "frd", zone: u.zone, availability: avail, shape: ctx.shape }, routingDeps(d)).used;
    if (!cell || cell.deferred || cell.paused || cell.runtime !== entry.needed) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: viaOf(cell), review: { deferred_entry: entry.id } });
  }

  // A consult is dispatched exactly once, with the cell, via and brief its doubt record announced (CLI 3.12).
  for (const u of state.units.filter((x) => x.kind === "doubt-consult" && queued(x))) {
    const consult = await (await sibling(d, "doubts", "pendingConsult"))(run.ref.project, u, d);
    if (!consult || typeof consult.runtime !== "string" || typeof consult.model !== "string" || !["agent", "cli"].includes(consult.via)) {
      throw err("INVALID_STATE", `consult unit ${u.id} has no consult in its doubt record`, { hint: "rebuild-state" });
    }
    if (consult.answered) continue;
    out.push({ unit: u, cell: { runtime: consult.runtime, model: consult.model, effort: consult.effort ?? null }, via: consult.via, consult });
  }

  for (const u of state.units.filter((x) => x.kind === "review" && (queued(x) || x.parked === "no_reviewer") && inScope(state, x))) {
    const work = state.units.filter((x) => FRD_WORK_KINDS.includes(x.kind) && x.frd === u.frd && x.state !== "blocked");
    if (!work.length || !work.every((x) => x.state === "reviewing")) continue;
    const authors = dedupeCells(work.filter((x) => x.worker).map((x) => authorOf(x.worker)));
    if (!authors.length) throw err("INVALID_STATE", `review ${u.id}: no author cell among its units`, { hint: "rebuild-state" });
    const rc = d.routing.reviewCell({ authors, kind: state.size === "touch" ? "touch" : "frd", zone: u.zone, availability: avail, shape: ctx.shape }, routingDeps(d));
    if (rc.parked) { if (u.parked !== "no_reviewer") toParkNoReviewer.push(u.id); continue; }
    if (u.parked === "no_reviewer") toUnpark.push(u.id);
    out.push({ unit: { ...u, parked: null, state: "queued" }, cell: cellOnly(rc.used), via: viaOf(rc.used), review: { primary: rc.primary, degraded: rc.degraded, deferred: rc.deferred } });
  }

  for (const u of state.units.filter((x) => x.kind === "audit" && queued(x))) {
    const cell = d.routing.builderCell({ kind: "audit", size: state.size, zone: u.zone, attempt: u.attempt }, { ...ctx, zone: u.zone, attempt: u.attempt, sessionModel: null }, routingDeps(d));
    if (cell.paused || cell.deferred) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: cell.via });
  }

  const readyIds = new Set(plan.ready);
  const planned = plan.ready.map((id) => findUnit(state, id)).filter((u) => u && PLANNED_KINDS.includes(u.kind) && queued(u) && readyIds.has(u.id) && depsMet(state, u));
  const ordered = [...planned.filter((u) => u.kind === "tests"), ...planned.filter((u) => u.kind !== "tests")];
  const last = ordered.filter((u) => u.pending_answer && !(u.pending_answer in state.answers));
  const first = ordered.filter((u) => !last.includes(u));
  const reopen = ordered.some((u) => u.kind === "build" || u.kind === "patch") ? await readReopenCounts(await integrationProductRoot(run, state), d.fs) : new Map();
  for (const u of [...first, ...last]) {
    const reopenCount = Math.max(0, ...u.wos.map((w) => reopen.get(String(w).toLowerCase()) ?? 0));
    const previousCell = u.attempt > 1 ? cellOf(u.worker) : null;
    const cell = d.routing.builderCell({ kind: u.kind, size: state.size, zone: u.zone, attempt: u.attempt }, { ...ctx, zone: u.zone, attempt: u.attempt, reopen_count: reopenCount, previousCell }, routingDeps(d));
    if (cell.paused || cell.deferred) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: cell.via, pendingDefault: last.includes(u) && !isAssumed(u) ? u.pending_answer : null });
  }

  let next = state;
  if (toParkNoReviewer.length || toUnpark.length) {
    next = await mutate(run, (s) => {
      const events = [];
      const units = s.units.map((u) => {
        if (toParkNoReviewer.includes(u.id) && u.parked !== "no_reviewer") { events.push({ type: "parked", data: { unit: u.id, reason: "no_reviewer", question: null } }); return { ...u, parked: "no_reviewer" }; }
        if (toUnpark.includes(u.id) && u.parked === "no_reviewer") { events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } }); return { ...u, parked: null }; }
        return u;
      });
      return events.length ? { state: { ...s, units }, events } : {};
    });
  }
  return { list: out, quotaBlocked, state: next };
}

const cellOnly = (c) => ({ runtime: c.runtime, model: c.model, effort: c.effort ?? null });
const viaOf = (c) => (c.via ?? (c.runtime === "codex" ? "cli" : "agent"));
function dedupeCells(cells) {
  const seen = new Set();
  return cells.filter((c) => { const key = `${c.runtime}/${c.model}/${c.effort}/${c.origin}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

/** FRDs that need a G2 now (integrate.frdsReadyForG2, CLI 4.1) and have no live G2 job. */
const g2Needed = (state) => frdsReadyForG2(state).filter((frd) => !state.jobs.some((j) => j.kind === "g2" && j.frd === frd && j.state === "running"));

// ---------------------------------------------------------------------------------------------
// (6)(7) Admission and dispatch (one fenced two-phase transaction)
// ---------------------------------------------------------------------------------------------

async function readSignalsSafe(run) {
  const { d } = run;
  try {
    return { value: await d.admission.readSignals({ signalsFile: d.env.PANDACORP_SIGNALS_FILE || null, exec: d.signalExec }), error: null };
  } catch (error) {
    if (error?.name !== "SignalError") throw error;
    return { value: null, error: error.message };
  }
}

async function reservationsOf(run, state) {
  const { d } = run;
  const adm = (await readJson(run.paths.admissionFile, { fs: d.fs })) ?? { tokens: {} };
  const startedOf = (unitId) => {
    const entry = Object.values(adm.tokens ?? {}).find((t) => t.unit === unitId);
    const ms = entry ? Date.parse(entry.at) : NaN;
    return Number.isFinite(ms) ? ms : nowMs(d);
  };
  const rss = (pid) => (Number.isInteger(pid) ? d.admission.rssTreeGib(pid, { exec: d.signalExec }) : null);
  const out = [];
  for (const u of state.units.filter(isLive)) {
    if (u.worker?.via === "cli") out.push({ class: "B", origin: "cli", runtime: "codex", started_ms: startedOf(u.id), rss_gib: (await rss(u.worker.pid)) ?? 0 });
    else out.push({ class: "B", origin: "agent", started_ms: startedOf(u.id) });
  }
  for (const j of state.jobs.filter((x) => x.kind === "g2" && x.state === "running")) out.push({ class: "H", origin: "cli", started_ms: Date.parse(j.started_at), rss_gib: (await rss(j.pid)) ?? 0 });
  return out;
}

const motivoToWait = (motivo) => (motivo === "cpu_H" ? "cpu_H" : "ram");

async function dispatchRound(run, state, candidates, params, signals, quota) {
  const { d, ref, paths } = run;
  const blockedDispatch = state.handbacks_in_a_row >= ENV_INFRA_STOP || run.l4?.paused_infra === true;
  const g2 = blockedDispatch ? [] : g2Needed(state);
  const list = blockedDispatch ? [] : candidates.list;
  if (!g2.length && !list.length) return { state, units: [], admit: null, admissionBlocked: null, g2Failed: [], g2Fails: {} };
  const reservations = await reservationsOf(run, state);
  const hostHeld = d.admission.countHostSlots({ host: paths.hostDir }).held;

  const result = await fencedTwoPhase(ref,
    // Phase 1 (mutex): one admission decision per candidate, a token per granted unit, units -> admitted.
    async (ctx) => {
      const s = await ctx.readState();
      if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
      const adm = admissionCtx(run);
      const history = d.admission.readHistory(adm);
      const prior = run.recorded && signals.value ? history.slice(0, -1) : history;
      const live = { B: s.units.filter(isLive).length, H: hostHeld, R: s.units.filter((u) => isLive(u) && REVIEW_TYPE_KINDS.includes(u.kind)).length };
      const res = [...reservations];
      const base = { signals: signals.value, history: prior, reservations: res, caps: { kOwner: params.k ?? undefined }, runtimeShape: shapeOf(s), nowMs: nowMs(d) };
      const events = [];
      const grants = [];
      const g2Grants = [];
      const granted = new Set();
      let lastDecision = null;
      let blocked = null;
      const admitEvent = (unitId, decision, cls) => {
        events.push({ type: "admit", data: { unit: unitId, class: cls, decision: decision.grant ? "grant" : "wait", motivo_limite: decision.motivo_limite, techo: decision.techo, suelo: decision.suelo, A_ef: decision.A_ef, P: decision.P, signals: signals.value, safe_mode: decision.safe_mode === true } });
      };
      for (let i = 0; i < g2.length; i++) {
        const decision = d.admission.decide({ ...base, live, heavyQueued: g2.length - i, readyWidth: list.length, want: "H" });
        lastDecision = decision;
        admitEvent(`g2-${g2[i]}`, decision, "H");
        if (decision.grant !== "H") { blocked = decision.motivo_limite; break; }
        g2Grants.push(g2[i]);
        live.H += 1;
        res.push({ class: "H", origin: "cli", started_ms: nowMs(d), rss_gib: 0 });
      }
      const heavyLeft = g2.length - g2Grants.length;
      let units = s.units;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (granted.has(c.unit.id)) continue;
        const cur = findUnit(s, c.unit.id);
        const eligible = cur && cur.state === "queued" && (!cur.parked || isAssumed(cur) || (c.unit.kind === "review" && cur.parked === "no_reviewer"));
        if (!eligible) continue;
        const decision = d.admission.decide({ ...base, live, heavyQueued: heavyLeft, readyWidth: list.length - i, want: "B", candidate: REVIEW_TYPE_KINDS.includes(c.unit.kind) ? "reviewer" : "builder" });
        lastDecision = decision;
        admitEvent(c.unit.id, decision, "B");
        if (decision.grant !== "B") { blocked = blocked ?? decision.motivo_limite; break; }
        const issued = d.admission.issueToken(c.unit.id, "B", adm);
        granted.add(c.unit.id);
        grants.push({ ...c, unit: { ...cur, ...(c.unit.kind === "review" ? { parked: null } : {}) }, token: issued.token, token_hash: issued.token_hash });
        events.push(unitEvent(c.unit.id, cur.state, "admitted"));
        units = units.map((u) => (u.id === c.unit.id ? { ...u, state: "admitted", parked: isAssumed(u) ? u.parked : null, token_hash: issued.token_hash } : u));
        live.B += 1;
        if (REVIEW_TYPE_KINDS.includes(c.unit.kind)) live.R += 1;
        res.push(c.via === "cli" ? { class: "B", origin: "cli", runtime: "codex", started_ms: nowMs(d), rss_gib: 0 } : { class: "B", origin: "agent", started_ms: nowMs(d) });
      }
      for (const ev of events) await ctx.appendEvent(ev);
      if (grants.length) await ctx.writeState({ ...s, units });
      return { grants, g2Grants, blocked, lastDecision };
    },
    // Work (no mutex): WO IN_PROGRESS on lane/<run_id>, unit worktree, brief, Codex launch, G2 jobs.
    async (intent) => {
      if (!intent.grants.length && !intent.g2Grants.length) return { prepared: [] };
      const current = await fresh(run);
      const prepared = [];
      for (const g of intent.grants) prepared.push(await prepareGrant(run, current, g));
      // Each G2 judges its own detached snapshot of the integration tip (B5): never the integration worktree that later
      // merges move, never a directory another G2 uses. A snapshot that cannot be made skips this G2 (retried next pass).
      let g2 = 0;
      const g2Failed = [];
      const g2Ok = [];
      for (const frd of intent.g2Grants) {
        let snap;
        try { snap = await createG2Snapshot(run, current, frd); } catch (error) {
          d.log(`next: G2 of ${frd} not started, its snapshot could not be created: ${error?.message ?? error}`);
          g2Failed.push(frd);
          continue;
        }
        try {
          await (await sibling(d, "jobs", "startJob"))({
            project: ref.project, epoch: ref.epoch, actor: ref.actor, kind: "g2",
            cmd: ["bash", "-c", G2_SCRIPT, "pandacorp-g2", current.integration.base_sha], cwd: snap.cwd, frd, unit: null,
          }, d);
        } catch (error) {
          await removeG2Snapshot(run, snap.dir);
          throw error;
        }
        g2 += 1;
        g2Ok.push(frd);
      }
      const g2Fails = await trackG2SnapshotFailures(run, g2Ok, g2Failed);
      return { prepared, g2, g2Failed, g2Fails };
    },
    // Phase 2 (mutex, epoch re-verified): admitted -> running, dispatch journal, worker jobs.
    async (work, intent, ctx) => {
      if (!work.prepared.length) return { ...intent, ...work };
      const s = await ctx.readState();
      const events = [];
      let units = s.units;
      let jobs = s.jobs;
      const quotaAtUnit = { ...s.quota_at_unit };
      const startQuota = { claude: quota.out.claude.pct, codex: quota.out.codex.pct, at: nowIsoOf(d) };
      for (const p of work.prepared) {
        const cur = findUnit(s, p.unit.id);
        if (!cur || cur.state !== "admitted" || cur.token_hash !== p.token_hash) throw err("INVALID_STATE", `unit ${p.unit.id} changed during dispatch`, { hint: "rebuild-state" });
        const worker = { ...p.cell, via: p.via, pid: p.launched?.pid ?? null, worker_id: p.launched?.workerId ?? null };
        units = units.map((u) => (u.id === cur.id ? { ...u, state: "running", worker, worktree: p.worktree, branch: p.branch } : u));
        events.push(unitEvent(cur.id, "admitted", "running"));
        events.push({ type: "unit_dispatched", data: { unit: cur.id, cell: p.cell, via: p.via, worktree: p.worktree, branch: p.branch, token_hash: p.token_hash, worker_id: worker.worker_id, pid: worker.pid } });
        if (p.launched) {
          const job = { ...p.launched.job, kind: "worker", unit: cur.id, h_slot: false, state: "running", exit: null, worker_id: p.launched.workerId };
          jobs = [...jobs.filter((j) => j.id !== job.id), job];
          events.push({ type: "job_started", data: job });
        }
        quotaAtUnit[cur.id] = { ...(quotaAtUnit[cur.id] ?? {}), start: startQuota };
      }
      for (const ev of events) await ctx.appendEvent(ev);
      await ctx.writeState({ ...s, units, jobs, quota_at_unit: quotaAtUnit });
      return { ...intent, ...work };
    });

  for (const p of result.prepared ?? []) emit(run, state, "agent.working", { role: AGENT_TYPE[p.unit.kind], model: p.cell.model, unit: p.unit.id });
  const anyGrant = (result.prepared?.length ?? 0) > 0 || (result.g2 ?? 0) > 0;
  const admit = result.lastDecision ? { decision: anyGrant ? "grant" : "wait", motivo_limite: result.lastDecision.motivo_limite } : null;
  if (admit) emit(run, state, "admit.decision", { ...admit, unit: result.prepared?.[0]?.unit.id ?? null });
  const units = (result.prepared ?? []).map((p) => unitOutput(state, p));
  return { state: await fresh(run), units, admit, admissionBlocked: result.blocked ? motivoToWait(result.blocked) : null, g2Failed: result.g2Failed ?? [], g2Fails: result.g2Fails ?? {} };
}

/** Work phase of one granted unit: WO IN_PROGRESS commit, unit worktree, brief (with the token), Codex launch for `via:"cli"`. */
async function prepareGrant(run, current, g) {
  const { d, ref, paths } = run;
  const unit = findUnit(current, g.unit.id);
  const files = unitFiles(paths, unit, g.via);
  const slug = g.via === "cli" ? (g.consult?.model_slug ?? d.routing.modelSlug(g.cell, routingDeps(d))) : null;
  let worktree = null;
  let branch = null;
  if (unit.kind !== "doubt-consult") {
    if (["build", "patch"].includes(unit.kind) && unit.wos.length) {
      await (await sibling(d, "integrate", "transitionWorkOrders"))({ integration: current.integration, runId: current.run_id, wos: unit.wos, to: "IN_PROGRESS", reason: "dispatch", unitId: unit.id }, { ...d, project: ref.project });
    }
    // Work built on an assumption forks from (and integrates into) lane/<run_id>/assume-<doubt> (BUILD-12).
    const base = isAssumed(unit) ? paths.assumeBranch(current.run_id, unit.pending_answer) : undefined;
    const wt = await (await sibling(d, "units", "prepareUnitWorktree"))({ project: ref.project, runId: current.run_id, unit: unit.id, attempt: unit.attempt, ...(base ? { base } : {}) }, d);
    worktree = wt?.worktree ?? null;
    branch = wt?.branch ?? null;
  }
  let briefPath = g.consult?.brief_path ?? null;
  if (!briefPath) {
    const brief = await (await sibling(d, "units", "writeUnitBrief"))({
      project: ref.project, state: current, unit: { ...unit, worktree }, cell: g.cell, agentType: AGENT_TYPE[unit.kind], token: g.token,
      schemaPath: files.schema_path, worktree, reportPath: files.report_path, extra: await briefExtra(run, current, g),
    }, d);
    briefPath = brief?.brief_path ?? paths.briefFile(unit.id);
  }
  let launched = null;
  if (g.via === "cli") {
    const dir = worktree ?? await integrationProductRoot(run, current);
    const res = await (await sibling(d, "workers", "launchWorker"))({
      project: ref.project, runId: current.run_id, unit: unit.id, attempt: unit.attempt, frd: unit.frd ?? null,
      cell: g.cell, schemaFile: files.schema_path || null, dir, briefFile: briefPath, dispatch: dispatchOf(g.token_hash),
    }, d);
    if (!res?.ok) throw err("ENGINE_FAILURE", `the Codex worker of ${unit.id} did not start (${res?.kind ?? "unknown"}): ${res?.detail ?? ""}`);
    launched = res;
  }
  return { ...g, unit, slug, worktree, branch, files: { ...files, brief_path: briefPath }, launched };
}

/** Extra brief sections: the review routing facts, and the default each pending reversible answer runs on (D19). */
async function briefExtra(run, state, g) {
  const extra = {};
  if (g.review) extra.review = g.review;
  if (g.pendingDefault) {
    const q = (await readQuestions(run)).get(g.pendingDefault);
    extra.decision = { question: g.pendingDefault, default_es: q?.default_es ?? null, default_action: q?.default_action ?? null, provisional: true };
  }
  if (g.unit.kind === "doubt-consult") extra.doubt = { id: g.unit.doubt_id };
  // The owner's recorded answers that concern the unit (the gate OK of `g-<unit>`, answered first-minute asks): CLI 3.13.
  const notes = (await sibling(run.d, "answers", "answerNotes"))(state, g.unit, { questions: await readQuestions(run) });
  if (notes.length) extra.notes = notes;
  return extra;
}

function unitFiles(paths, unit, via) {
  const reviewType = ["review", "audit", "deferred-review"].includes(unit.kind);
  const consult = unit.kind === "doubt-consult";
  return {
    brief_path: paths.briefFile(unit.id),
    report_path: consult ? paths.unitAnswerFile(unit.id) : reviewType ? paths.reviewFile(unit.id) : paths.reportFile(unit.id),
    schema_path: consult ? (via === "cli" ? paths.schemaFile("doubt-answer") : "") : paths.schemaFile(reviewType ? "review-report" : "report"),
  };
}

function unitOutput(state, p) {
  const u = p.unit;
  return {
    unit: u.id, kind: u.kind, attempt: u.attempt, token: p.token,
    runtime: p.cell.runtime, model: p.cell.model, model_slug: p.via === "cli" ? p.slug : null, effort: p.cell.effort ?? null,
    budget_calls: u.kind === "review" && state.size === "touch" ? 10 : null,
    worktree: p.worktree, brief_path: p.files.brief_path, report_path: p.files.report_path, schema_path: p.files.schema_path,
    agent_type: AGENT_TYPE[u.kind], via: p.via, dispatch_line: dispatchLine(u, p.cell, p.slug),
  };
}

/** The one-line Spanish announcement of a dispatch (no dashes; the middle dot is the separator). */
export function dispatchLine(unit, cell, slug = null) {
  const who = cell.runtime === "codex" ? `Codex ${slug ?? cell.model}` : `Claude ${cell.model}`;
  const target = unit.kind === "audit" ? "la corrida"
    : unit.kind === "doubt-consult" ? (unit.doubt_id ?? unit.id)
      : ["review", "deferred-review"].includes(unit.kind) && unit.frd ? unit.frd.toUpperCase()
        : unit.wos?.length ? unit.wos.map((w) => String(w).toUpperCase()).join(", ") : (unit.frd ?? unit.id).toUpperCase();
  return `→ ${who} · ${cell.effort ?? "sesión"} · ${VERB_ES[unit.kind] ?? unit.kind} ${target}`;
}

/** Telemetry is a bulkhead: emitted in the background to the coordinator company's events file, never fatal. */
function emit(run, state, name, data) {
  const runtime = run.leaseRuntime ?? (state.coordinator === "codex-session" ? "codex" : "claude");
  Promise.resolve()
    .then(async () => (await sibling(run.d, "telemetry", "emitEvent"))(run.ref.project, { runtime, runId: state.run_id, name, data }, run.d))
    .catch((error) => run.d.log(`next: telemetry ${name} failed: ${error?.message ?? error}`));
}

// ---------------------------------------------------------------------------------------------
// Terminal actions (A11, D32)
// ---------------------------------------------------------------------------------------------

function runningSummary(state) {
  const units = state.units.filter(isLive);
  const jobs = state.jobs.filter((j) => j.state === "running" && j.kind !== "worker");
  const workers = state.jobs.filter((j) => j.state === "running" && j.kind === "worker");
  return { any: units.length > 0 || jobs.length > 0 || workers.length > 0, jobs: jobs.length > 0, workers: units.length > 0 || workers.length > 0 };
}

/**
 * A11 selection when nothing runs and nothing was dispatched, first match. Pure.
 * @returns {{action: string, status?: string, reason: string}} `action:"wait"` (admission blocked) carries a wait reason
 */
export function chooseTerminal(state, { pol, l4, plan, candidates, dispatch }) {
  state = scopedState(state);
  const bothOut = pol && !pol.claude_new_units && !pol.codex_new_units;
  if (pol?.paused) return { action: "paused-quota", status: "paused", reason: bothOut ? "quota" : "quota_claude_no_drive" };
  if (l4?.paused_infra) return { action: "paused-infra", status: "paused", reason: "infra_L4" };
  if (state.handbacks_in_a_row >= ENV_INFRA_STOP) return { action: "stop", status: "stopped", reason: "env_infra_handbacks" };
  if (state.units.every(isTerminalUnit)) return { action: "done", status: state.status, reason: "done" };
  if (dispatch?.admissionBlocked) return { action: "wait", reason: dispatch.admissionBlocked };
  const nonTerminal = state.units.filter((u) => !isTerminalUnit(u));
  const { all, ownerRoots } = blockedClosure(state);
  if (ownerRoots.length && nonTerminal.every((u) => all.has(u.id))) {
    const gatesOnly = ownerRoots.every((u) => u.state === "waiting_gate" || u.waiting_gate);
    return { action: "waiting-owner", status: gatesOnly ? "waiting_gate" : "waiting_owner", reason: gatesOnly ? "gate" : "owner_answer" };
  }
  const queued = nonTerminal.some((u) => u.state === "queued" && (!u.parked || isAssumed(u)));
  if (queued && (plan?.deadlock || !candidates?.quotaBlocked)) return { action: "deadlock", status: "stopped", reason: "deadlock" };
  return { action: "stop", status: "stopped", reason: "no_progress" };
}

function terminalNotes(terminal, quota) {
  switch (terminal.action) {
    case "paused-quota": return [`Pausa por cupo: Claude al ${quota.out.claude.pct ?? "?"} %, Codex al ${quota.out.codex.pct ?? "?"} %. Claude vuelve ${quota.resets.claude ?? "sin fecha conocida"}; Codex vuelve ${quota.resets.codex ?? "sin fecha conocida"}.`];
    case "paused-infra": return ["Pausa por presión de memoria crítica durante más de 10 minutos."];
    case "waiting-owner": return [terminal.status === "waiting_gate" ? "Todo lo que queda espera tu firma en una puerta humana." : "Todo lo que queda espera tu respuesta."];
    case "deadlock": return ["El plan no puede avanzar: hay unidades en cola sin dependencias resolubles."];
    case "stop": return [terminal.reason === "env_infra_handbacks" ? "Me detengo: tres devoluciones seguidas por fallos del entorno." : "Me detengo: nada más puede avanzar."];
    default: return [];
  }
}

/**
 * Apply a non-`done` terminal action (D32): status and reason, journal `paused{reason,status}` or `run_stopped{reason}`,
 * then `quiesce` + `finalizeRelease` with `projectStatus:false` (nothing runs, so no worker is stopped).
 * Exported for the lifecycle module (D01), which applies the same contract.
 * @param {{project: string, epoch: number, actor?: string, deps?: object}} ref
 * @param {{action: string, status: string, reason: string}} terminal
 * @param {object} [deps]
 * @returns {Promise<object>} the written state
 */
export async function applyTerminal(ref, terminal, deps = {}) {
  const d = resolveDeps(deps);
  const runRef = { ...ref, deps: d };
  const stopped = terminal.action === "stop" || terminal.action === "deadlock";
  const state = await fencedTwoPhase(runRef, async (ctx) => {
    const s = await ctx.readState();
    if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
    await ctx.appendEvent(stopped
      ? { type: "run_stopped", data: { reason: terminal.reason } }
      : { type: "paused", data: { reason: terminal.reason, status: terminal.status, action: terminal.action } });
    const next = { ...s, status: terminal.status, status_reason: terminal.reason };
    await ctx.writeState(next);
    return next;
  }, passIntent);
  const bs = d.buildState ?? await import("../build-state.mjs");
  const token = await readLeaseToken(ref.project, ref.epoch, d);
  await bs.quiesce(ref.project, token, Number(ref.epoch), { projectStatus: false });
  await bs.finalizeRelease(ref.project, token, Number(ref.epoch));
  // After the release (never under the mutex): the run's G2 snapshots go, except one a still-running G2 job judges (NB5).
  await removeAllG2Snapshots({ project: ref.project, state }, d);
  if (stopped) {
    const runtime = state.coordinator === "codex-session" ? "codex" : "claude";
    await Promise.resolve()
      .then(async () => (await sibling(d, "telemetry", "emitEvent"))(ref.project, { runtime, runId: state.run_id, name: "build.stopped", data: { reason: terminal.reason } }, d))
      .catch((error) => d.log(`next: telemetry build.stopped failed: ${error?.message ?? error}`));
  }
  return state;
}

/** A run that is no longer active (a terminal action whose release was interrupted): finish the release, report it. */
async function alreadyStopped(run, state) {
  const action = state.status === "finished" ? "done"
    : state.status === "waiting_owner" || state.status === "waiting_gate" ? "waiting-owner"
      : state.status === "paused" ? (state.status_reason === "infra_L4" ? "paused-infra" : "paused-quota")
        : state.status_reason === "deadlock" ? "deadlock" : "stop";
  const bs = run.d.buildState ?? await import("../build-state.mjs");
  try {
    const token = await readLeaseToken(run.ref.project, run.ref.epoch, run.d);
    // A lease already quiesced (the previous `next` crashed between quiesce and release) is only released (NB3).
    const lease = typeof bs.currentLease === "function" ? await bs.currentLease(run.ref.project) : null;
    if (!lease?.quiesced_at) await bs.quiesce(run.ref.project, token, run.ref.epoch, { projectStatus: false });
    await bs.finalizeRelease(run.ref.project, token, run.ref.epoch);
  } catch (error) {
    // A finished run whose release already completed has no lease left to fence against: that is the expected idempotent case.
    if (state.status !== "finished" || error.code !== "FENCE") throw error;
  }
  return { ok: true, cmd: "next", epoch: run.ref.epoch, action, units: [], wait: null, admit: null, quota: null, notes_es: [] };
}

// ---------------------------------------------------------------------------------------------
// --wait: early return on a report/review/answer file, a job or worker exit, a journal append, handoff.json
// ---------------------------------------------------------------------------------------------

function watchList(run, state) {
  const { paths } = run;
  const list = [paths.journalFile, paths.handoffFile];
  for (const u of state.units.filter(isLive)) {
    list.push(paths.reportFile(u.id), paths.reviewFile(u.id), paths.unitAnswerFile(u.id), paths.unitDoubtFile(u.id));
  }
  for (const j of state.jobs.filter((x) => x.state === "running")) {
    list.push(j.kind === "worker" && j.worker_id ? path.join(paths.codexWorkerDir(j.worker_id), "exit") : paths.jobExitFile(j.id));
  }
  return list;
}

async function signature(list, fs) {
  const out = [];
  for (const file of list) {
    try { const st = await fs.stat(file); out.push(`${st.mtimeMs}:${st.size}`); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      out.push("-");
    }
  }
  return out.join("|");
}

async function waitForChange(run, list, deadline) {
  const { d } = run;
  const fs = d.fs ?? fsp;
  const before = await signature(list, fs);
  while (d.monotonic() < deadline) {
    await d.sleep(Math.max(1, Math.min(d.pollMs, deadline - d.monotonic())));
    if (await signature(list, fs) !== before) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

function unionWos(units) {
  return [...new Set(units.flatMap((u) => u.wos ?? []))];
}

function maxZone(zones) {
  const order = ["none", "floor", "r1"];
  return zones.reduce((acc, z) => (order.indexOf(z) > order.indexOf(acc) ? z : acc), "none");
}
