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
// Sibling modules (planner, integrate, jobs, workers, report, review, doubts, failure, land, units, deferred,
// telemetry) are injected through `deps`; their expected shapes are listed in `NEXT_SIBLING_CONTRACT`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import * as admissionModule from "./admission.mjs";
import { atomicWriteJson, readJson } from "./fsx.mjs";
import { readJournal } from "./journal.mjs";
import { buildPaths } from "./paths.mjs";
import * as quotaModule from "./quota.mjs";
import * as riskModule from "./risk.mjs";
import * as routingModule from "./routing.mjs";
import { REVIEW_TYPE_KINDS, fencedTwoPhase, findUnit, isTerminalUnit, newUnit, readLeaseToken, readState } from "./state.mjs";

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
const WATCH_POLL_MS = 1000;
const MAX_ATTEMPTS = 3;
const LIVE_STATES = Object.freeze(["admitted", "running"]);
const FRD_WORK_KINDS = Object.freeze(["build", "patch", "tests"]);
const PLANNED_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
const REPORT_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
const OWNER_PARKS = Object.freeze(["owner_question", "built_on_assumption"]);
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
 * Functions `next` calls on its injected siblings (Wave C). Every call is `fn(input, deps)` with `deps` = the deps
 * object given to `next`. Each mutating sibling runs its own fenced two-phase operation (`fencedTwoPhase`).
 * Listed so the assembler (Wave D) can wire or adapt them; `next` validates their presence lazily (only when used).
 */
export const NEXT_SIBLING_CONTRACT = Object.freeze({
  "planner.round": "({state, root, live: string[]}) -> {add: Unit[], ready: string[] (priority order, non-overlapping), deadlock: boolean}",
  "integrate.integrate": "({project, epoch, actor}) -> {integrated: [{unit, sha}], notes_es?: string[]} (fenced; also patching->integrated, assumption merges)",
  "integrate.markInProgress": "optional ({project, epoch, actor, root, unit, wos}) inside next's phase 2 (the mutex is held): WO IN_PROGRESS commit on lane/<run_id>",
  "jobs.spawn": "({project, kind:'g2', cmd: string[], cwd, hSlot: true, frd, unit: null}) -> jobs[] item (A18), detached, not yet in state",
  "jobs.poll": "({project, job}) -> {state: 'running'|'done'|'dead', exit: number|null}",
  "workers.launch": "({project, unit, kind, worktree, prompt_file, model_slug, output_schema, report_path}) -> {worker_id, pid}",
  "workers.harvest": "({project, worker_id, unit}) -> {state: 'running'} | {state: 'done'|'dead', exit, report: object|null, limit: 'usage_limit'|'rate_limit'|null, limit_resets_at: string|null}",
  "report.ingest": "({project, epoch, actor, unit, token, file, via: 'cli'}) -> report outcome (fenced, two-phase, G1)",
  "review.record": "({project, epoch, actor, unit, token, file, via: 'cli'}) -> review-record outcome (fenced)",
  "doubts.answer": "({project, epoch, actor, id, unit, file, token: null, via: 'cli'}) -> doubt step (fenced)",
  "failure.handback": "({project, epoch, actor, unit, reason}) -> {path} (fenced; parks dependents)",
  "land.harvest": "({project, epoch, actor, job}) -> {result, reason, mq_exit, sha, notes_es?} (fenced; maps the merge-queue exit, archives the card)",
  "units.prepare": "({project, state, unit, cell, via, token, attempt, review, question_defaults}) -> {worktree, branch, brief_path, report_path?, schema_path?} (worktree + brief with the token; outside the mutex)",
  "deferred.list": "optional ({project}) -> deferred-reviews.json items (default: read the file)",
  "deferred.queue": "({project, epoch, actor, entry}) -> entry (an audit that cannot run now, BUILD-14)",
  "telemetry.emit": "optional ({project, coordinator, name, data}) (bulkhead: a failure is logged to stderr, never fatal)",
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
  const { d, paths } = run;
  // (0) renew + the call's single admission reading (phase 1 of a fenced step).
  const signals = await readSignalsSafe(run);
  let state = await mutate(run, (s) => {
    if (signals.value && !run.recorded) {
      run.l4 = d.admission.recordReading(signals.value, admissionCtx(run));
      run.recorded = true;
    }
    return { value: s };
  });
  if (state.status !== "active") return { out: await alreadyStopped(run, state), watch: [] };
  const notes = [];

  // (1) harvest finished jobs and workers; (2) integrate committed chains, G2 bookkeeping.
  await harvest(run, state, notes);
  const integ = await sibling(d, "integrate", "integrate")({ project: run.ref.project, epoch: run.ref.epoch, actor: run.ref.actor }, d);
  notes.push(...(integ?.notes_es ?? []));
  state = await fresh(run);

  // (3) quota policy (A11 priority owned by quota.policy).
  const quota = await quotaView(run, state);
  const pol = quota.policy;

  // (4)(5) schedule next-managed units (deferred reviews, parked reviews), planner round, pending answers.
  const deferredEntries = await listDeferred(run);
  state = await scheduleManagedUnits(run, state, pol, deferredEntries);
  const plan = await planRound(run, state);
  state = plan.state;
  state = await parkIrreversiblePending(run, state);

  // Landing first (priority landing > heavy job > new builder).
  const landing = await landDecision(run, state, pol, deferredEntries);
  state = landing.state;
  if (landing.action === "land") return finish(run, state, { action: "land", quota, notes });
  if (pol.handoff) {
    notes.push(`Claude al ${quota.out.claude.pct ?? "?"} %: relevo a drive.`);
    return finish(run, state, { action: "handoff", quota, notes });
  }

  // (6)(7) admission and dispatch.
  const runParams = await readRunParams(run);
  const candidates = await buildCandidates(run, state, pol, plan, runParams, deferredEntries);
  state = candidates.state;
  const dispatch = await dispatchRound(run, state, candidates, pol, runParams, signals);
  state = dispatch.state;
  if (dispatch.units.length) return finish(run, state, { action: "dispatch", units: dispatch.units, admit: dispatch.admit, quota, notes });

  // Nothing dispatched: wait while anything runs (A11), else a terminal action.
  const running = runningSummary(state);
  if (running.any || landing.waitLand) {
    const reason = pol.paused ? "quota" : running.jobs || landing.waitLand ? "jobs_running" : "workers_running";
    return finish(run, state, { action: "wait", wait: { reason, retry_after_s: landing.waitLand ? LAND_RETRY_S : RETRY_S[reason] }, admit: dispatch.admit, quota, notes });
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

function sibling(d, name, fn) {
  const f = d[name]?.[fn];
  if (typeof f !== "function") throw err("INVALID_STATE", `next: sibling ${name}.${fn} is not wired (assembler)`);
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
  });
}

async function fresh(run) {
  const state = await readState(run.ref.project, run.d);
  if (!state) throw err("INVALID_STATE", "build/state.json disappeared during next", { hint: "rebuild-state" });
  return state;
}

const unitEvent = (unit, from, to) => ({ type: "unit_state", data: { unit, from, to } });
const integrationRoot = (run, state) => path.resolve(run.ref.project, state.integration?.worktree ?? run.paths.integrationWorktree);
const isLive = (u) => LIVE_STATES.includes(u.state);

// ---------------------------------------------------------------------------------------------
// (1) Harvest
// ---------------------------------------------------------------------------------------------

async function harvest(run, state, notes) {
  for (const job of state.jobs.filter((j) => j.state === "running")) {
    if (job.kind === "worker") await harvestWorker(run, job, notes);
    else if (job.kind === "g2") await harvestG2(run, job, notes);
    else if (job.kind === "land") await harvestLand(run, job, notes);
  }
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

async function harvestWorker(run, job, notes) {
  const { d, ref, paths } = run;
  const h = await sibling(d, "workers", "harvest")({ project: ref.project, worker_id: job.worker_id, unit: job.unit }, d);
  if (!h || h.state === "running") return;
  const state = await fresh(run);
  const unit = findUnit(state, job.unit);
  const jobEnd = { state: h.state === "dead" ? "dead" : "done", exit: Number.isInteger(h.exit) ? h.exit : null };
  if (!unit || !isLive(unit)) return finishJob(run, job, jobEnd);
  const base = { project: ref.project, epoch: ref.epoch, actor: ref.actor };

  if (h.limit) {
    await requeueAfterLimit(run, unit, job, h, jobEnd);
    notes.push(h.limit === "usage_limit" ? `Codex llegó a su límite de uso; ${unit.id} vuelve a la cola sin gastar intento.` : `Codex limitó la frecuencia; ${unit.id} vuelve a la cola sin gastar intento.`);
    return;
  }
  if (unit.kind === "doubt-consult") {
    const answer = h.report && typeof h.report === "object"
      ? { ...h.report, consulted: cellOf(unit.worker) }
      : { decision: null, rationale: "consultant returned no answer", consulted: cellOf(unit.worker), confidence: "low", reversible: false };
    const file = paths.unitAnswerFile(unit.id);
    await atomicWriteJson(file, answer, { fs: d.fs });
    await settle(() => sibling(d, "doubts", "answer")({ ...base, id: unit.doubt_id, unit: unit.id, file, token: null, via: "cli" }, d));
    return finishJob(run, job, jobEnd);
  }
  if (!h.report || typeof h.report !== "object") {
    await sibling(d, "failure", "handback")({ ...base, unit: unit.id, reason: "worker returned no report" }, d);
    return finishJob(run, job, jobEnd);
  }
  const reviewType = REVIEW_TYPE_KINDS.includes(unit.kind);
  const file = reviewType ? paths.reviewFile(unit.id) : paths.reportFile(unit.id);
  await atomicWriteJson(file, h.report, { fs: d.fs });
  const call = reviewType ? sibling(d, "review", "record") : sibling(d, "report", "ingest");
  await settle(() => call({ ...base, unit: unit.id, token: typeof h.report.token === "string" ? h.report.token : "", file, via: "cli" }, d));
  return finishJob(run, job, jobEnd);
}

// A sibling that rejects a report (exit-6/7 class codes) has already settled the unit; fences and faults propagate.
async function settle(fn) {
  try { return await fn(); } catch (error) {
    if (SETTLED_OUTCOME_CODES.includes(error?.code)) return { settled: error.code };
    throw error;
  }
}

async function requeueAfterLimit(run, unit, job, h, jobEnd) {
  const { d, paths } = run;
  let reading = null;
  if (h.limit === "usage_limit") {
    reading = d.quota.recordLimit({ provider: "codex", resetsAt: h.limit_resets_at ?? null }, { file: paths.quotaFile, deps: quotaDeps(d) });
  }
  d.admission.releaseToken(unit.id, admissionCtx(run));
  await mutate(run, (s) => {
    const u = findUnit(s, unit.id);
    const events = [];
    if (reading) events.push({ type: "quota_reading", data: { provider: "codex", source: "limit", reading } });
    events.push({ type: "job_finished", data: { id: job.id, state: jobEnd.state, exit: jobEnd.exit } });
    let units = s.units;
    if (u && isLive(u)) {
      events.push(unitEvent(u.id, u.state, "queued"));
      // Same attempt, no previous cell: a limit consumes no attempt and must not raise the effort.
      units = s.units.map((x) => (x.id === u.id ? { ...x, state: "queued", token_hash: null, worker: null, worktree: null, branch: null } : x));
    }
    return { state: { ...s, units, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, ...jobEnd } : j)) }, events };
  });
}

async function harvestG2(run, job, notes) {
  const { d, ref } = run;
  const polled = await sibling(d, "jobs", "poll")({ project: ref.project, job }, d);
  if (!polled || polled.state === "running") return;
  const exit = Number.isInteger(polled.exit) ? polled.exit : null;
  const green = polled.state === "done" && exit === 0;
  let handbackUnit = null;
  const zone = green ? await reviewZone(run, await fresh(run)) : null;
  await mutate(run, (s) => {
    const cur = s.jobs.find((j) => j.id === job.id);
    if (!cur || cur.state !== "running") return {};
    const events = [{ type: "job_finished", data: { id: job.id, state: polled.state === "dead" ? "dead" : "done", exit } }];
    let next = { ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, state: polled.state === "dead" ? "dead" : "done", exit } : j)) };
    if (polled.state === "dead") return { state: next, events }; // re-spawned by the G2 rule at this or the next pass
    events.push({ type: "gate", data: { tier: "G2", exit, frd: job.frd } });
    const work = next.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === job.frd && u.state === "integrated");
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
      handbackUnit = work[0]?.id ?? null;
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
  if (handbackUnit) {
    await sibling(d, "failure", "handback")({ project: ref.project, epoch: ref.epoch, actor: ref.actor, unit: handbackUnit, reason: `G2 en rojo en ${job.frd} tras agotar los ${MAX_ATTEMPTS} intentos` }, d);
  }
  if (!green && polled.state !== "dead") notes.push(`G2 en rojo en ${job.frd}: se encola una corrección.`);
}

async function harvestLand(run, job, notes) {
  const { d, ref } = run;
  const polled = await sibling(d, "jobs", "poll")({ project: ref.project, job }, d);
  if (!polled || polled.state === "running") return;
  const res = await sibling(d, "land", "harvest")({ project: ref.project, epoch: ref.epoch, actor: ref.actor, job }, d);
  notes.push(...(res?.notes_es ?? []));
  await finishJob(run, job, { state: polled.state === "dead" ? "dead" : "done", exit: Number.isInteger(polled.exit) ? polled.exit : null });
}

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

async function listDeferred(run) {
  const { d, paths, ref } = run;
  const list = typeof d.deferred?.list === "function" ? await d.deferred.list({ project: ref.project }, d) : await readJson(paths.deferredReviewsFile, { fs: d.fs });
  if (list !== null && !Array.isArray(list)) throw err("LEDGER_CORRUPT", "deferred-reviews.json is not an array", { hint: "rebuild-state" });
  return list ?? [];
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

async function planRound(run, state) {
  const { d } = run;
  const plan = await sibling(d, "planner", "round")({ state, root: integrationRoot(run, state), live: state.units.filter(isLive).map((u) => u.id) }, d);
  const add = (plan?.add ?? []).filter((u) => inScope(state, u));
  let next = state;
  if (add.length) {
    next = await mutate(run, (s) => {
      const fresh = add.filter((u) => !findUnit(s, u.id)).map((u) => newUnit(u));
      if (!fresh.length) return {};
      return { state: { ...s, units: [...s.units, ...fresh] }, events: fresh.map((u) => ({ type: "unit_queued", data: u })) };
    });
  }
  return { state: next, ready: Array.isArray(plan?.ready) ? plan.ready : [], deadlock: plan?.deadlock === true };
}

/** First-minute questions (`build/preflight.json`), by id: `{reversible, default_es, default_action}`. */
async function readQuestions(run) {
  const preflight = await readJson(run.paths.preflightFile, { fs: run.d.fs });
  const out = new Map();
  for (const check of preflight?.checks ?? []) if (check?.question?.id) out.set(check.question.id, check.question);
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
      events.push({ type: "parked", data: { unit: u.id, reason: "owner_question", question: u.pending_answer } });
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
  const roots = state.units.filter((u) => !isTerminalUnit(u) && (u.parked || u.state === "waiting_gate" || u.state === "parked"));
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
  const { all } = blockedClosure(state);
  const active = state.units.filter((u) => !isTerminalUnit(u) && !all.has(u.id));
  const ready = active.filter(landReady);
  return { complete: ready.length > 0 && active.every(landReady), ready: ready.map((u) => u.id) };
}

async function landDecision(run, state, pol, deferredEntries) {
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
  return { state, action: "land", waitLand: false };
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
    await sibling(d, "deferred", "queue")({
      project: ref.project, epoch: ref.epoch, actor: ref.actor,
      entry: { unit: id, kind: "audit", frd: null, sha_range: `${state.integration.base_sha}..${state.integration.branch}`, needed: cell.deferred.runtime, reviewer: cell.deferred, degraded: cell.degraded ?? "quota_90" },
    }, d);
    return { queued: false, state };
  }
  const unit = newUnit({ id, kind: "audit", frd: null, wos: [], zone: risk.zone, risk_rules: risk.rules ?? [] });
  const next = await mutate(run, (s) => (findUnit(s, id) ? {} : { state: { ...s, units: [...s.units, unit] }, events: [{ type: "unit_queued", data: unit }] }));
  return { queued: true, state: next };
}

async function runRisk(run, state) {
  return run.d.risk.computeRisk({ root: integrationRoot(run, state), range: `${state.integration.base_sha}..HEAD` }, run.d.riskDeps ?? {});
}

async function reviewZone(run, state) {
  if (!state.integration?.base_sha) return null;
  const r = await runRisk(run, state);
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

/** A unit is in scope unless it touches an out-of-scope WO/FRD, or (no card) a WO outside `scope.wos`. */
export function inScope(state, unit) {
  const scope = state.scope ?? { card: null, wos: [], frds: [], out_of_scope: [] };
  const out = new Set((scope.out_of_scope ?? []).map((x) => String(x).toLowerCase()));
  const wos = (unit.wos ?? []).map((w) => String(w).toLowerCase());
  if (wos.some((w) => out.has(w)) || (unit.frd && out.has(String(unit.frd).toLowerCase()))) return false;
  if (scope.card) return true;
  const allowed = new Set((scope.wos ?? []).map((w) => String(w).toLowerCase()));
  return wos.every((w) => allowed.has(w));
}

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
  const queued = (u) => u.state === "queued" && !u.parked && inScope(state, u);

  for (const u of state.units.filter((x) => x.kind === "deferred-review" && queued(x))) {
    const entry = deferredEntries.find((e) => deferredUnitId(e.id) === u.id);
    if (!entry) continue;
    const cell = entry.kind === "audit"
      ? d.routing.builderCell({ kind: "audit", size: state.size, zone: u.zone, attempt: 1 }, { ...ctx, zone: u.zone, attempt: 1, sessionModel: null }, routingDeps(d))
      : d.routing.reviewCell({ authors: [entry.author], kind: state.size === "touch" ? "touch" : "frd", zone: u.zone, availability: avail, shape: ctx.shape }, routingDeps(d)).used;
    if (!cell || cell.deferred || cell.paused || cell.runtime !== entry.needed) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: viaOf(cell), review: { deferred_entry: entry.id } });
  }

  for (const u of state.units.filter((x) => x.kind === "doubt-consult" && queued(x))) {
    const record = u.doubt_id ? await readJson(run.paths.doubtFile(u.doubt_id), { fs: d.fs }) : null;
    const n = Number(u.id.match(/-c(\d+)$/)?.[1] ?? 0);
    const consult = record?.consults?.[n - 1];
    if (!consult) throw err("INVALID_STATE", `consult unit ${u.id} has no consult ${n} in its doubt record`, { hint: "rebuild-state" });
    out.push({ unit: u, cell: { runtime: consult.runtime, model: consult.model, effort: consult.effort }, via: consult.via, consultBrief: consult.brief_path ?? null });
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
  const planned = plan.ready.map((id) => findUnit(state, id)).filter((u) => u && PLANNED_KINDS.includes(u.kind) && queued(u) && readyIds.has(u.id));
  const ordered = [...planned.filter((u) => u.kind === "tests"), ...planned.filter((u) => u.kind !== "tests")];
  const last = ordered.filter((u) => u.pending_answer && !(u.pending_answer in state.answers));
  const first = ordered.filter((u) => !last.includes(u));
  const reopen = ordered.some((u) => u.kind === "build" || u.kind === "patch") ? await readReopenCounts(integrationRoot(run, state), d.fs) : new Map();
  for (const u of [...first, ...last]) {
    const reopenCount = Math.max(0, ...u.wos.map((w) => reopen.get(String(w).toLowerCase()) ?? 0));
    const previousCell = u.attempt > 1 ? cellOf(u.worker) : null;
    const cell = d.routing.builderCell({ kind: u.kind, size: state.size, zone: u.zone, attempt: u.attempt }, { ...ctx, zone: u.zone, attempt: u.attempt, reopen_count: reopenCount, previousCell }, routingDeps(d));
    if (cell.paused || cell.deferred) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: cell.via, pendingDefault: last.includes(u) ? u.pending_answer : null });
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

/** FRDs whose build/patch/tests units are all integrated and have no live G2 job: they need a G2 (D7, D22). */
export function frdsNeedingG2(state) {
  const frds = [...new Set(state.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd).map((u) => u.frd))];
  return frds.filter((frd) => {
    const work = state.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === frd && u.state !== "blocked" && u.state !== "landed");
    if (!work.length || !work.every((u) => u.state === "integrated")) return false;
    return !state.jobs.some((j) => j.kind === "g2" && j.frd === frd && j.state === "running");
  });
}

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

async function dispatchRound(run, state, candidates, pol, params, signals) {
  const { d, ref, paths } = run;
  const blockedDispatch = pol.paused || state.handbacks_in_a_row >= ENV_INFRA_STOP || run.l4?.paused_infra === true;
  const g2 = blockedDispatch ? [] : frdsNeedingG2(state);
  const list = blockedDispatch ? [] : candidates.list;
  if (!g2.length && !list.length) return { state, units: [], admit: null, admissionBlocked: null };
  const reservations = await reservationsOf(run, state);
  const hostHeld = d.admission.countHostSlots({ host: paths.hostDir }).held;
  const quotaNow = { claude: null, codex: null };

  const result = await fencedTwoPhase(ref,
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
        const cur = findUnit(s, c.unit.id);
        const eligible = cur && (cur.state === "queued") && (!cur.parked || (c.unit.kind === "review" && cur.parked === "no_reviewer"));
        if (!eligible) continue;
        const decision = d.admission.decide({ ...base, live, heavyQueued: heavyLeft, readyWidth: list.length - i, want: "B", candidate: REVIEW_TYPE_KINDS.includes(c.unit.kind) ? "reviewer" : "builder" });
        lastDecision = decision;
        admitEvent(c.unit.id, decision, "B");
        if (decision.grant !== "B") { blocked = blocked ?? decision.motivo_limite; break; }
        const issued = d.admission.issueToken(c.unit.id, "B", adm);
        grants.push({ ...c, token: issued.token, token_hash: issued.token_hash });
        events.push(unitEvent(c.unit.id, cur.state, "admitted"));
        units = units.map((u) => (u.id === c.unit.id ? { ...u, state: "admitted", parked: null, token_hash: issued.token_hash } : u));
        live.B += 1;
        if (REVIEW_TYPE_KINDS.includes(c.unit.kind)) live.R += 1;
        res.push(c.via === "cli" ? { class: "B", origin: "cli", runtime: "codex", started_ms: nowMs(d), rss_gib: 0 } : { class: "B", origin: "agent", started_ms: nowMs(d) });
      }
      for (const ev of events) await ctx.appendEvent(ev);
      if (grants.length) await ctx.writeState({ ...s, units });
      return { grants, g2Grants, blocked, lastDecision };
    },
    async (intent) => {
      if (!intent.grants.length && !intent.g2Grants.length) return { prepared: [], jobs: [] };
      const current = await fresh(run);
      const root = integrationRoot(run, current);
      const prepared = [];
      for (const g of intent.grants) {
        const slug = g.cell.runtime === "codex" ? d.routing.modelSlug(g.cell, routingDeps(d)) : null;
        const prep = await sibling(d, "units", "prepare")({
          project: ref.project, state: current, unit: findUnit(current, g.unit.id), cell: g.cell, via: g.via, token: g.token,
          attempt: g.unit.attempt, review: g.review ?? null, consult_brief: g.consultBrief ?? null,
          question_defaults: g.pendingDefault ? [g.pendingDefault] : [],
        }, d);
        const files = unitFiles(paths, g.unit, g.via, prep);
        let worker = null;
        if (g.via === "cli") {
          worker = await sibling(d, "workers", "launch")({
            project: ref.project, unit: g.unit.id, kind: g.unit.kind, worktree: prep.worktree, prompt_file: files.brief_path,
            model_slug: slug, output_schema: files.schema_path, report_path: files.report_path,
          }, d);
        }
        prepared.push({ ...g, slug, prep, files, worker });
      }
      const jobs = [];
      for (const frd of intent.g2Grants) {
        const job = await sibling(d, "jobs", "spawn")({ project: ref.project, kind: "g2", cmd: ["bash", ".pandacorp/verify.sh", "--since", current.integration.base_sha], cwd: root, hSlot: true, frd, unit: null }, d);
        jobs.push({ ...job, kind: "g2", frd, unit: null, h_slot: true, state: job.state ?? "running", exit: job.exit ?? null, worker_id: null });
      }
      return { prepared, jobs, root };
    },
    async (work, intent, ctx) => {
      if (!work.prepared.length && !work.jobs.length) return { ...intent, ...work };
      const s = await ctx.readState();
      const events = [];
      let units = s.units;
      let jobs = s.jobs;
      const quotaAtUnit = { ...s.quota_at_unit };
      for (const p of work.prepared) {
        const cur = findUnit(s, p.unit.id);
        if (!cur || cur.state !== "admitted" || cur.token_hash !== p.token_hash) throw err("INVALID_STATE", `unit ${p.unit.id} changed during dispatch`, { hint: "rebuild-state" });
        const worker = { ...p.cell, via: p.via, pid: p.worker?.pid ?? null, worker_id: p.worker?.worker_id ?? null };
        units = units.map((u) => (u.id === cur.id ? { ...u, state: "running", worker, worktree: p.prep.worktree ?? null, branch: p.prep.branch ?? null } : u));
        events.push(unitEvent(cur.id, "admitted", "running"));
        events.push({ type: "unit_dispatched", data: { unit: cur.id, cell: p.cell, via: p.via, worktree: p.prep.worktree ?? null, branch: p.prep.branch ?? null, token_hash: p.token_hash, worker_id: worker.worker_id, pid: worker.pid } });
        if (p.via === "cli") {
          const job = { id: `w-${p.worker.worker_id}`, kind: "worker", unit: cur.id, frd: null, pid: p.worker.pid ?? null, cwd: p.prep.worktree, h_slot: false, started_at: nowIsoOf(d), state: "running", exit: null, worker_id: p.worker.worker_id };
          jobs = [...jobs, job];
          events.push({ type: "job_started", data: job });
        }
        quotaAtUnit[cur.id] = { ...(quotaAtUnit[cur.id] ?? {}), start: { claude: quotaNow.claude, codex: quotaNow.codex, at: nowIsoOf(d) } };
        if (typeof d.integrate?.markInProgress === "function" && ["build", "patch"].includes(cur.kind) && cur.wos.length) {
          await d.integrate.markInProgress({ project: ref.project, epoch: ref.epoch, actor: ref.actor, root: work.root, unit: cur.id, wos: cur.wos }, d);
        }
      }
      for (const job of work.jobs) {
        jobs = [...jobs, job];
        events.push({ type: "job_started", data: job });
      }
      for (const ev of events) await ctx.appendEvent(ev);
      await ctx.writeState({ ...s, units, jobs, quota_at_unit: quotaAtUnit });
      return { ...intent, ...work };
    });

  for (const p of result.prepared ?? []) emit(run, state, "AgentWorking", { role: AGENT_TYPE[p.unit.kind], model: p.cell.model, unit: p.unit.id });
  const admit = result.lastDecision ? { decision: result.prepared?.length || result.jobs?.length ? "grant" : "wait", motivo_limite: result.lastDecision.motivo_limite } : null;
  if (admit) emit(run, state, "AdmitDecision", { ...admit, unit: result.prepared?.[0]?.unit.id ?? null });
  const units = (result.prepared ?? []).map((p) => unitOutput(state, p));
  return { state: await fresh(run), units, admit, admissionBlocked: result.blocked && !units.length ? motivoToWait(result.blocked) : (result.blocked ? motivoToWait(result.blocked) : null), g2Spawned: (result.jobs ?? []).length };
}

function unitFiles(paths, unit, via, prep) {
  const reviewType = ["review", "audit", "deferred-review"].includes(unit.kind);
  const consult = unit.kind === "doubt-consult";
  const defaults = {
    brief_path: paths.briefFile(unit.id),
    report_path: consult ? paths.unitAnswerFile(unit.id) : reviewType ? paths.reviewFile(unit.id) : paths.reportFile(unit.id),
    schema_path: consult ? (via === "cli" ? paths.schemaFile("doubt-answer") : "") : paths.schemaFile(reviewType ? "review-report" : "report"),
  };
  return {
    brief_path: prep?.brief_path ?? defaults.brief_path,
    report_path: prep?.report_path ?? defaults.report_path,
    schema_path: prep?.schema_path ?? defaults.schema_path,
  };
}

function unitOutput(state, p) {
  const u = p.unit;
  return {
    unit: u.id, kind: u.kind, attempt: u.attempt, token: p.token,
    runtime: p.cell.runtime, model: p.cell.model, model_slug: p.via === "cli" ? p.slug : null, effort: p.cell.effort ?? null,
    budget_calls: u.kind === "review" && state.size === "touch" ? 10 : null,
    worktree: p.prep.worktree ?? null, brief_path: p.files.brief_path, report_path: p.files.report_path, schema_path: p.files.schema_path,
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

function emit(run, state, name, data) {
  const f = run.d.telemetry?.emit;
  if (typeof f !== "function") return;
  Promise.resolve()
    .then(() => f({ project: run.ref.project, coordinator: state.coordinator, name, data }, run.d))
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
  const queued = nonTerminal.some((u) => u.state === "queued" && !u.parked);
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
  });
  const bs = d.buildState ?? await import("../build-state.mjs");
  const token = await readLeaseToken(ref.project, ref.epoch, d);
  await bs.quiesce(ref.project, token, Number(ref.epoch), { projectStatus: false });
  await bs.finalizeRelease(ref.project, token, Number(ref.epoch));
  if (stopped && typeof d.telemetry?.emit === "function") {
    await Promise.resolve(d.telemetry.emit({ project: ref.project, coordinator: state.coordinator, name: "BuildStopped", data: { reason: terminal.reason } }, d))
      .catch((error) => d.log(`next: telemetry BuildStopped failed: ${error?.message ?? error}`));
  }
  return state;
}

/** A run that is no longer active (a terminal action whose release was interrupted): finish the release, report it. */
async function alreadyStopped(run, state) {
  const action = state.status === "finished" ? "done"
    : state.status === "waiting_owner" || state.status === "waiting_gate" ? "waiting-owner"
      : state.status === "paused" ? (state.status_reason === "infra_L4" ? "paused-infra" : "paused-quota")
        : state.status_reason === "deadlock" ? "deadlock" : "stop";
  if (state.status !== "finished") {
    const bs = run.d.buildState ?? await import("../build-state.mjs");
    const token = await readLeaseToken(run.ref.project, run.ref.epoch, run.d);
    await bs.quiesce(run.ref.project, token, run.ref.epoch, { projectStatus: false });
    await bs.finalizeRelease(run.ref.project, token, run.ref.epoch);
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
