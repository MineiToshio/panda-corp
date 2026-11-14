#!/usr/bin/env node
// test-build-v2-next.mjs: T-C02, the official test of plugin/runtime/build/next.mjs (the scheduler behind `next`).
// Written from the contracts only (PLAN 3.3, 3.16 A11/A12/A13, RESOLUTIONS D4/D9/D16/D19/D22/D31/D32, plugin/docs/build-engine-cli.md
// 2.3, 3.8, 4, 4.1, 5, 6, 7, 8.1, 8.2, the schemas); the implementation file was NOT read. Run: node plugin/scripts/test-build-v2-next.mjs
//
// What is pinned: the 3.3 order of work; the output shape; never drains the change queue; units outside the run scope are never
// dispatched; units with a pending answer go last on the default when reversible and are parked when not (D19); admission
// (no token, no dispatch; one reading recorded per call); quota (>= 90 % on a provider = no new units there; policy result applied;
// handoff only when the drive standby is alive, else paused-quota; both >= 90 -> pause); terminal actions (A11 priority, only when
// nothing runs, applied: status, journal, lease released, status.yaml untouched); `--wait` (early return on an event, lease renewed);
// `via:"session"` (A12); tests before their build unit (D16); one audit unit; a doubt-consult unit surfaced once; a stale epoch refused.
//
// ASSUMED INTERFACE (the docs fix no export name or signature for next.mjs; the orchestrator reconciles test and module).
//   Entry point: the first existing export of next.mjs among `next`, `runNext`, `nextAction`, `schedule`, then the default export:
//       next({project, epoch, wait?, sessionModel?}, deps?) -> Promise<the CLI doc 4 object>
//     `wait` = the `--wait` seconds (default 0), `sessionModel` = `--session-model`. The result carries `action`, `units[]`, `wait{reason,
//     retry_after_s}`, `admit{decision,motivo_limite}`, `quota{claude{pct,state},codex{pct,state}}`, `epoch`, `notes_es[]`; `ok` and `cmd` are
//     only checked when present (the dispatcher may add them). FENCE / QUIESCED are THROWN (error.code), exit 3 in the CLI.
//   deps convention (same as state.mjs): `deps.env` = the PANDACORP_* hooks (the test also sets process.env); `deps.<stem>` replaces the sibling
//     module `<stem>.mjs` as a namespace object: buildState (plugin/runtime/build-state.mjs), quota, admission, routing, risk, planner, units,
//     jobs, workers, report, integrate, review, deferred, failure, park, doubts, telemetry, card. The test passes SPIES around the REAL Wave B
//     modules (buildState, quota, admission) and FAKES for the Wave C modules, named and shaped like the REAL exports of those modules (R6/R7, deps last):
//       planner.plan(input, deps) -> {units, now, ready, round, rounds?, deadlock: null | {wos, units, waits, cycles}}   (the fake IGNORES input and
//          reads state.json from disk; `round`/`ready` hold the ids it offers; tests may force naive/duplicate/deadlock)
//       planner.readPlanWorkOrders(root, deps) -> {wos, frds, frd_acs, errors}
//       units.prepareUnitWorktree({project, runId, unit: <id string>, attempt}) -> {worktree, root, branch, base_sha, created, bootstrap}
//       units.writeUnitBrief({project, state, unit: <unit object>, cell, agentType, token, schemaPath, ...}) -> {brief_path, report_path, text}
//          next derives schema_path = schemas/report.schema.json (build/tests/patch/docs), review-report.schema.json (review/audit/deferred-review)
//          and "" for a doubt-consult unit (CLI doc 4; the consult answer file is answer.json, A7).
//       doubts.pendingConsult(project, unit, deps) -> {doubt_id, unit, runtime, model, effort, via, model_slug, brief_path, report_path, schema_path, answered}
//       jobs.startJob({project, epoch, kind, frd, ...}) -> the job item; jobs.pollJob(project, job) -> {state: running|done|dead, exit, pid}
//       workers.launchWorker({project, unit, dir, ...}) -> {ok:true, workerId, pid, job, ...}; workers.pollWorker({project, workerId}) -> {state: running|done|error, ...}
//       integrate.integrateCommitted({state, runId}, deps) -> {state, integrated, conflicts, events, cleanup}; integrate.transitionWorkOrders(...)
//       report.ingestReport({project, epoch, unit, token, file}) -> {ok, cmd:"report", unit, attempt, outcome, next_attempt}
//       telemetry.emitEvent(project, {runtime, runId, name, data}) -> {ok, payload}
//       These fakes are STRICT: next calling a sibling export the test does not fake fails loudly. review/deferred/failure/park/card/risk-other are lenient
//       (logged), and the D21 case wraps the REAL failure.mjs in a spy.
//       risk.computeRisk(input, deps) -> {zone, audit, ...}; and `.pandacorp/run/build/preflight.json` carries `questions[]` (D19 shape:
//          {id,text_es,default_es,default_action,affects,reversible}) and `risk:{zone,audit}`: next reads reversibility / audit from either.
//       Running Codex workers are tracked as `state.jobs[]` items of kind "worker" (workers.mjs launchWorker `job`); step 1 polls them.
//       The fake integrate answers with `integrateAnswer` units as integrated so a committed chain counts as integrated.
//   State shape: schemas/state.schema.json; the planner is offered only units in state `queued`. A dispatched unit moves to `admitted` or `running`
//     with token_hash = sha256(token), worker, worktree and branch set; the raw token is returned once and persisted nowhere but the brief.
//   Quota: next reads build/quota.json (and the rollout tail under CODEX_HOME) through quota.mjs; the test writes quota.json with the real
//     recordClaude/recordCodex. Drive standby: build/drive/standby.json {pid, armed_at, run_id, state}.
//   Terminal-action status mapping (D32/A11): paused-quota -> status `paused`; waiting-owner -> `waiting_owner` (or `waiting_gate`
//     when every blocker is a gate); stop -> `stopped`; deadlock -> any non-active status; journal `paused{reason}` / `run_stopped{reason}`.
//   `deferred reviews`, `harvest` internals and the G2 spawn are only pinned through the call order and one jobs.* call (see the cases).
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const ENTRY_NAMES = ["next", "runNext", "nextAction", "schedule"];

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rejectsWith = async (fn, codes, what) => {
  const list = [].concat(codes);
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a rejection with code ${list.join("|")}, but it resolved`);
  if (!list.includes(err.code)) throw new Error(`${what}: expected code ${list.join("|")}, got ${err.code || "(no code)"}: ${err.message}`);
  return err;
};

// ---- loading: a missing module or export becomes a clear failure, never an obscure crash --------------------------
const loaded = {};
const load = async (file, base = BUILD) => {
  const key = path.join(base, file);
  if (!(key in loaded)) { try { loaded[key] = await import(pathToFileURL(key).href); } catch (e) { loaded[key] = { __error: e }; } }
  return loaded[key];
};
const must = async (file, base) => {
  const mod = await load(file, base);
  if (mod.__error) throw new Error(`${path.basename(base ?? BUILD)}/${file} cannot be imported: ${String(mod.__error.message).split("\n")[0]}`);
  return mod;
};
const loadNext = async () => {
  const mod = await must("next.mjs");
  for (const name of ENTRY_NAMES) if (typeof mod[name] === "function") return mod[name];
  if (typeof mod.default === "function") return mod.default;
  throw new Error(`plugin/runtime/build/next.mjs exports none of ${ENTRY_NAMES.join("|")} nor a default function (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`);
};
const fixturesMod = () => import(pathToFileURL(FIXTURES).href);
const buildStateMod = () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);

// ---- fixed instants (PANDACORP_NOW) ---------------------------------------------------------------------------------
const NOW = "2026-11-11T12:00:00.000Z";
const at = (ms, base = NOW) => new Date(Date.parse(base) + ms).toISOString();
const RUN = "run-c02";
const CATALOG_KEYS = ["haiku", "sonnet", "opus", "luna", "sol", "astra"];
const EFFORTS = ["low", "medium", "high", "xhigh"];
const TERMINAL = ["done", "paused-quota", "waiting-owner", "deadlock", "stop"];

// ---- unit and state builders ------------------------------------------------------------------------------------------
const frdOf = (wo) => (wo.startsWith("WO-01") ? "frd-01-alpha" : "frd-02-beta");
const idOf = (kind, wo) => `u-${kind}-${wo.toLowerCase()}`;
/** A build unit (one WO chain). Partial: setup() completes it with newUnit(). */
const B = (wo, over = {}) => ({ id: idOf("build", wo), kind: "build", wos: [wo], frd: frdOf(wo), chain: `c-${wo.toLowerCase()}`, ...over });
const T = (wo, over = {}) => ({ id: idOf("tests", wo), kind: "tests", wos: [wo], frd: frdOf(wo), chain: null, ...over });
const R = (frd, over = {}) => ({ id: `u-review-${frd}`, kind: "review", wos: [], frd, chain: null, ...over });
const WORKER = (over = {}) => ({ runtime: "claude", model: "sonnet", effort: "medium", via: "agent", pid: null, worker_id: null, ...over });
const FRD_WOS = { "frd-01-alpha": ["WO-01-001", "WO-01-002"], "frd-02-beta": ["WO-02-001", "WO-02-002"] };

// ---- spies and fakes ------------------------------------------------------------------------------------------------
const isClass = (f) => /^class\s/.test(Function.prototype.toString.call(f));
/** Wraps every function export of a REAL module so the call is logged (the module still does the work). */
const spyModule = (name, mod, log, replace = {}) => {
  const copy = { ...mod, ...replace };
  return new Proxy(copy, {
    get(target, key) {
      const value = target[key];
      if (typeof key !== "string" || typeof value !== "function" || isClass(value)) return value;
      return (...args) => { log.push({ mod: name, fn: key, args }); return value(...args); };
    },
  });
};
/** A fake module: functions in `impl` do the work; others are lenient (logged, `fallback`) or, when strict, a loud failure. */
const fake = (name, log, impl = {}, { strict = false, fallback = () => ({}) } = {}) => new Proxy({}, {
  get(_t, key) {
    if (typeof key === "symbol" || key === "then" || key === "toJSON") return undefined;
    if (impl[key]) return async (...args) => { log.push({ mod: name, fn: key, args }); return impl[key](...args); };
    if (strict) return async () => { throw new Error(`ASSUMED INTERFACE: next called ${name}.${key}(), but the test fakes only ${Object.keys(impl).join(", ")}`); };
    return async (...args) => { log.push({ mod: name, fn: key, args }); return fallback(key, ...args); };
  },
  has: () => false,
});

// ---- the sandbox of one case --------------------------------------------------------------------------------------------
const SAVED_ENV = { ...process.env };
const restoreEnv = () => { for (const k of Object.keys(process.env)) if (!(k in SAVED_ENV)) delete process.env[k]; Object.assign(process.env, SAVED_ENV); };
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid;

/**
 * Mission-Control-like fixture: the project (its .pandacorp/) lives in `<outer repo>/mission-control`, the git root is the parent.
 * Returns a fixture-shaped object {root, sha, git, cleanup} where root is the PROJECT dir and git runs in the OUTER repo.
 */
async function nestedFixture(dir) {
  const f = await fixturesMod();
  const seed = await f.createFixture("basic", { dir: path.join(dir, "seed-parent") });
  const outer = path.join(dir, "outer"); const prefix = "mission-control";
  await mkdir(path.join(outer, prefix), { recursive: true });
  await cp(seed.root, path.join(outer, prefix), { recursive: true, filter: (src) => path.basename(src) !== ".git" });
  f.git(outer, ["init", "-q", "-b", "main"]); f.git(outer, ["add", "-A"]); f.git(outer, ["commit", "-q", "-m", "fixture: nested initial"]);
  await seed.cleanup();
  return { root: path.join(outer, prefix), outer, prefix, sha: f.git(outer, ["rev-parse", "HEAD"]), git: (...a) => f.git(outer, a), cleanup: async () => { await rm(outer, { recursive: true, force: true }); } };
}

/**
 * Builds a fixture project, acquires a real lease (projectStatus:false), writes state.json, the signals file, optional quota,
 * preflight and admission files. Returns the case context `c`.
 */
async function setup(o = {}) {
  const { createFixture, testEnv, writeSignalsFile } = await fixturesMod();
  const bs = await buildStateMod();
  const pathsMod = await must("paths.mjs"); const stateMod = await must("state.mjs"); const fsx = await must("fsx.mjs");
  const quotaMod = await must("quota.mjs"); const admissionMod = await must("admission.mjs"); const journalMod = await must("journal.mjs");
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c02-"));
  const fx = o.nested ? await nestedFixture(dir) : await createFixture(o.preset ?? "basic", { dir });
  const env = testEnv(dir);
  if (o.realClock) delete env.PANDACORP_NOW;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  if (o.realClock) delete process.env.PANDACORP_NOW;
  await mkdir(path.join(dir, "home"), { recursive: true });
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, o.signals ?? "clean");

  const coordinator = o.coordinator ?? "claude-session";
  const label = o.label ?? (coordinator === "codex-session" ? "codex" : "claude");
  const lease = await bs.acquire(fx.root, { runtime: coordinator === "codex-session" ? "codex" : "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const P = pathsMod.buildPaths(fx.root, { env });
  let productRoot = P.integrationWorktree;
  if (o.nested) {
    fx.git("worktree", "add", "-q", "-b", P.integrationBranch(RUN), P.integrationWorktree, "main"); productRoot = path.join(P.integrationWorktree, fx.prefix);
  } else await mkdir(P.integrationWorktree, { recursive: true });
  const units = (o.units ?? []).map((u) => stateMod.newUnit(u));
  const wos = o.scope?.wos ?? [...new Set(units.flatMap((u) => u.wos))];
  const frds = o.scope?.frds ?? [...new Set(units.map((u) => u.frd).filter(Boolean))];
  const state = stateMod.newState({
    run_id: RUN, epoch: lease.epoch, coordinator, label, size: o.size ?? "feature", status: o.status ?? "active",
    scope: { card: null, frds, wos, out_of_scope: o.scope?.out_of_scope ?? [] },
    integration: { branch: o.nested ? P.integrationBranch(RUN) : `lane/${RUN}`, worktree: productRoot, base_sha: fx.sha },
    units, jobs: o.jobs ?? [], handbacks_in_a_row: o.handbacks ?? 0, answers: o.answers ?? {},
  });
  await stateMod.writeState(fx.root, state, { env });

  const c = {
    dir, fx, env, root: fx.root, bs, P, epoch: lease.epoch, token: lease.token, run: RUN, coordinator, label, realClock: !!o.realClock,
    log: [], plannerMode: o.planner ?? "honest", plannerRound: null, integrateAnswer: null, riskResult: { zone: "none", rules: [], signals: {}, irreversible: false, audit: !!o.audit, failclosed: false, unclassified: [] },
    sessionModel: o.sessionModel ?? (coordinator === "codex-session" ? "sol" : "opus"),
    quotaMod, admissionMod, journalMod, stateMod, fsx, pathsMod,
    readState: () => stateMod.readState(fx.root, { env }),
    events: async () => (await journalMod.readJournal(P.journalFile)).events,
    leaseNow: () => bs.currentLease(fx.root),
    cleanup: async () => { await fx.cleanup(); await rm(dir, { recursive: true, force: true }); restoreEnv(); },
  };
  c.writeState = async (mutate) => { const s = await c.readState(); const next = mutate(s) ?? s; await stateMod.writeState(fx.root, next, { env }); return next; };
  c.setUnitState = (id, to, extra = {}) => c.writeState((s) => { Object.assign(s.units.find((u) => u.id === id), { state: to, ...extra }); });
  if (o.questions || o.risk) await fsx.atomicWriteJson(P.preflightFile, { checked_at: NOW, row: 5, questions: o.questions ?? [], ...(o.risk ? { risk: o.risk } : {}) });
  await setQuota(c, o.quota ?? {});
  if (o.admission) await fsx.atomicWriteJson(P.admissionFile, o.admission);
  if (o.standby) await writeStandby(c, o.standby);
  return c;
}
const withCase = async (o, fn) => { const c = await setup(o); try { return await fn(c); } finally { await c.cleanup(); } };

/** claude / codex: a percentage, null = unknown, undefined = leave as is. */
async function setQuota(c, { claude, codex }) {
  const now = c.realClock ? new Date() : new Date(NOW);
  const file = c.P.quotaFile;
  if (typeof claude === "number") c.quotaMod.recordClaude({ five_hour_pct: claude, weekly_pct: Math.min(claude, 10), five_hour_resets_at: at(2 * 3600e3, now.toISOString()), weekly_resets_at: at(3 * 86400e3, now.toISOString()), status: "ok" }, { now, file });
  if (typeof codex === "number") c.quotaMod.recordCodex({ provider: "codex", state: "known", used_percent: codex, window_minutes: 300, resets_at: at(2 * 3600e3, now.toISOString()), credits: null, source: "rollout", observed_at: now.toISOString(), file: null }, { now, file });
}
/** state: standby | active | stopped; pid: "alive" | "dead". */
async function writeStandby(c, { state = "standby", pid = "alive" } = {}) {
  await c.fsx.atomicWriteJson(c.P.driveStandbyFile, { pid: pid === "alive" ? process.pid : deadPid(), armed_at: NOW, run_id: RUN, state });
}

// ---- deps for one call -----------------------------------------------------------------------------------------------------
function makeDeps(c, over = {}) {
  const { log } = c;
  const readUnits = async () => (await c.readState()).units;
  const satisfied = (u, all) => u.depends_on.every((d) => ["integrated", "landed", "verified"].includes(all.find((x) => x.id === d)?.state));
  const planRound = async () => {
    const all = await readUnits();
    const queued = all.filter((u) => u.state === "queued");
    let round;
    if (c.plannerMode === "deadlock") return { round: [], ready: [], units: [], now: [], deadlock: { wos: [], units: queued.map((u) => u.id), waits: [], cycles: [] } };
    if (c.plannerRound) round = c.plannerRound;
    else if (c.plannerMode === "naive") round = queued.map((u) => u.id).reverse();
    else round = queued.filter((u) => satisfied(u, all)).map((u) => u.id);
    return { round, ready: round, units: [], now: [], deadlock: null };
  };
  const readPlanWorkOrders = async () => ({ wos: [], frds: [], frd_acs: {}, errors: [] });
  const prepareUnitWorktree = async ({ unit, attempt = 1 }) => ({ worktree: c.P.unitWorktree(unit, attempt), root: c.P.unitWorktree(unit, attempt), branch: c.P.unitBranch(RUN, unit, attempt), base_sha: c.fx.sha, created: true, bootstrap: { ran: false, exit: null, tail: "" } });
  const writeUnitBrief = async ({ unit }) => { await mkdir(c.P.unitDir(unit.id), { recursive: true }); await writeFile(c.P.briefFile(unit.id), `# brief ${unit.id}\n`); return { brief_path: c.P.briefFile(unit.id), report_path: c.P.reportFile(unit.id), text: `# brief ${unit.id}\n` }; };
  const pendingConsult = async (_p, unit) => ({ doubt_id: unit.doubt_id, unit: unit.id, runtime: "claude", model: "opus", effort: "high", via: "agent", model_slug: null, brief_path: c.P.briefFile(unit.id), report_path: c.P.unitAnswerFile(unit.id), schema_path: c.P.schemaFile("doubt-answer"), answered: false });
  const launchWorker = async (input) => ({ ok: true, workerId: `w-${input.unit}`, dir: input.dir, pid: process.pid, startedAt: NOW, reused: false, argv: [], settled: null, job: { id: `w-${input.unit}`, kind: "worker", unit: input.unit, frd: input.frd ?? null, pid: process.pid, cwd: input.dir, h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: `w-${input.unit}` } });
  const pollWorker = async ({ workerId }) => ({ state: "running", workerId });
  const pollJob = async (_p, job) => (existsSync(c.P.jobExitFile(job.id)) ? { state: "done", exit: Number((await readFile(c.P.jobExitFile(job.id), "utf8")).trim()), pid: job.pid ?? null } : { state: "running", exit: null, pid: job.pid ?? null });
  const startJob = async (input) => ({ id: `j-${input.kind}-${input.frd ?? input.unit ?? "x"}`, kind: input.kind, unit: input.unit ?? null, frd: input.frd ?? null, pid: process.pid, cwd: input.cwd ?? c.root, h_slot: input.kind === "g2", started_at: NOW, state: "running", exit: null, worker_id: null });
  const integrateCommitted = async ({ state }) => {
    const integrated = (c.integrateAnswer ?? []).map((i) => ({ outcome: "integrated", ...i }));
    const ids = new Set(integrated.map((i) => i.unit));
    return { state: { ...state, units: state.units.map((u) => (ids.has(u.id) ? { ...u, state: "integrated" } : u)) }, integrated, conflicts: [], events: [], cleanup: [] };
  };
  const transitionWorkOrders = async ({ wos = [] }) => ({ transitioned: wos, skipped: [] });
  const ingestReport = async ({ unit }) => ({ ok: true, cmd: "report", unit, attempt: 1, outcome: "accepted", next_attempt: null });
  const emitEvent = async () => ({ ok: true, payload: {} });
  const deps = {
    env: c.env,
    buildState: spyModule("buildState", c.bs, log),
    quota: spyModule("quota", c.quotaMod, log),
    admission: spyModule("admission", c.admissionMod, log),
    risk: fake("risk", log, { computeRisk: async () => c.riskResult }),
    planner: fake("planner", log, { plan: planRound, readPlanWorkOrders }, { strict: true }),
    units: fake("units", log, { prepareUnitWorktree, writeUnitBrief }, { strict: true }),
    jobs: fake("jobs", log, { startJob, pollJob }, { strict: true }),
    workers: fake("workers", log, { launchWorker, pollWorker }, { strict: true }),
    integrate: fake("integrate", log, { integrateCommitted, transitionWorkOrders }, { strict: true }),
    report: fake("report", log, { ingestReport }, { strict: true }),
    review: fake("review", log), deferred: fake("deferred", log), failure: fake("failure", log), park: fake("park", log),
    doubts: fake("doubts", log, { pendingConsult }), telemetry: fake("telemetry", log, { emitEvent }, { strict: true }), card: fake("card", log),
    ...over,
  };
  return deps;
}

/** Calls next once; by default asserts the main checkout stayed clean and the journal chain is intact. */
async function callNext(c, input = {}, depsOver = {}, { clean = true } = {}) {
  const next = await loadNext();
  const before = c.log.length;
  const r = await next({ project: c.root, epoch: c.epoch, wait: 0, sessionModel: c.sessionModel, ...input }, makeDeps(c, depsOver));
  ok(r && typeof r === "object", `next returned ${JSON.stringify(r)} instead of the CLI doc 4 object`);
  if ("ok" in r) ok(r.ok === true, `next returned ok:${r.ok}`);
  if (clean) eq(c.fx.git("status", "--porcelain"), "", "D1: the main checkout must stay clean (the engine writes only gitignored paths there)");
  if (existsSync(c.P.journalFile)) await c.journalMod.verifyJournal(c.P.journalFile);
  r.__calls = c.log.slice(before);
  return r;
}
const unitIds = (r) => (r.units ?? []).map((u) => u.unit).sort();
const dispatchedIds = async (c) => (await c.events()).filter((e) => e.type === "unit_dispatched").map((e) => e.data.unit);
const preparedIds = (c) => c.log.filter((e) => e.mod === "units" && e.fn === "prepareUnitWorktree").map((e) => e.args[0].unit);
const stateUnit = async (c, id) => (await c.readState()).units.find((u) => u.id === id);

/** Asserts a terminal action arrived APPLIED (D32 / A11). */
async function expectApplied(c, r, { action, status, journal = [], statusYamlBefore }) {
  eq(r.action, action, "action");
  eq(r.units ?? [], [], "a terminal action carries no units");
  const state = await c.readState();
  const allowed = [].concat(status);
  ok(allowed.includes(state.status), `state.status after ${action} must be ${allowed.join("|")}, got ${state.status}`);
  ok(typeof state.status_reason === "string" && state.status_reason.length > 0, `status_reason must be set after ${action}`);
  const events = (await c.events()).map((e) => e.type);
  ok(journal.some((t) => events.includes(t)), `the journal must record ${journal.join("|")} after ${action}; has ${events.join(", ") || "nothing"}`);
  eq(await c.leaseNow(), null, `${action} must have released the lease (finalizeRelease, D32)`);
  ok(!existsSync(c.P.tokenFile), `${action} must have dropped build/lease-token.json`);
  if (statusYamlBefore !== undefined) eq(await readFile(c.P.statusYaml, "utf8"), statusYamlBefore, "status.yaml must not be projected (projectStatus:false)");
}
/** Asserts the call changed nothing observable: lease still held, status active. */
async function expectNotApplied(c) {
  const lease = await c.leaseNow();
  ok(lease && lease.epoch === c.epoch, "the lease must still be held by the caller");
  eq((await c.readState()).status, "active", "state.status must stay active");
}

const readTree = async (dir, skip = []) => {
  const out = [];
  const walk = async (d) => {
    let names; try { names = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const n of names) {
      const f = path.join(d, n.name);
      if (skip.includes(n.name)) continue;
      if (n.isDirectory()) await walk(f); else out.push([f, await readFile(f, "utf8").catch(() => "")]);
    }
  };
  await walk(dir);
  return out;
};

// =====================================================================================================================
// Output shape, persistence and token hygiene
// =====================================================================================================================
await test("dispatch: output shape, token hygiene, state and journal after one call", async () => withCase({ units: [B("WO-01-001"), B("WO-02-001")] }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "dispatch", "action");
  eq(r.epoch, c.epoch, "epoch echoed");
  ok(Array.isArray(r.units) && r.units.length >= 1 && r.units.length <= 2, `1..2 units expected, got ${JSON.stringify(unitIds(r))}`);
  eq(r.admit?.decision, "grant", "admit.decision");
  ok(r.quota && "claude" in r.quota && "codex" in r.quota, "the quota object carries claude and codex");
  for (const u of r.units) {
    ok(["u-build-wo-01-001", "u-build-wo-02-001"].includes(u.unit), `unexpected unit ${u.unit}`);
    eq(u.kind, "build", "kind"); eq(u.attempt, 1, "attempt");
    ok(typeof u.token === "string" && u.token.length >= 16, "an opaque token is returned once");
    eq(u.runtime, "claude", "label claude dispatches to the Claude column"); eq(u.via, "agent", "via");
    ok(CATALOG_KEYS.includes(u.model), `model must be a catalog key (never fable/terra), got ${u.model}`);
    ok(EFFORTS.includes(u.effort), `effort must be low..xhigh (never max/null for a routed cell), got ${u.effort}`);
    eq(u.model_slug, null, "model_slug is set only for via:cli");
    eq(u.agent_type, "pandacorp:implementer", "agent_type");
    eq(u.worktree, c.P.unitWorktree(u.unit, 1), "worktree comes from units.createUnitWorktree");
    eq(u.brief_path, c.P.briefFile(u.unit), "brief_path comes from units.writeBrief");
    eq(u.report_path, c.P.reportFile(u.unit), "report_path"); eq(path.basename(u.schema_path), "report.schema.json", "schema_path");
    ok(u.budget_calls === null || Number.isFinite(u.budget_calls), "budget_calls null or a number");
    ok(typeof u.dispatch_line === "string" && u.dispatch_line.length > 0 && !/[—–]/.test(u.dispatch_line), "dispatch_line is Spanish text without em/en dashes");
  }
  const state = await c.readState();
  const admission = JSON.parse(await readFile(c.P.admissionFile, "utf8"));
  for (const u of r.units) {
    const su = state.units.find((x) => x.id === u.unit);
    ok(["admitted", "running"].includes(su.state), `a dispatched unit is admitted|running, got ${su.state}`);
    eq(su.token_hash, sha256(u.token), "state.units[].token_hash = sha256(token)");
    eq([su.worker.runtime, su.worker.model, su.worker.effort, su.worker.via], [u.runtime, u.model, u.effort, u.via], "state worker = the dispatched cell");
    eq([su.worktree, su.branch], [u.worktree, c.P.unitBranch(RUN, u.unit, 1)], "worktree and branch recorded");
    eq(admission.tokens?.[sha256(u.token)]?.unit, u.unit, "admission.json is keyed by the token sha256 and names the unit");
  }
  const events = await c.events();
  for (const u of r.units) {
    const d = events.find((e) => e.type === "unit_dispatched" && e.data.unit === u.unit);
    ok(d, `journal unit_dispatched for ${u.unit}`);
    eq([d.data.cell.runtime, d.data.cell.model], [u.runtime, u.model], "unit_dispatched.cell");
    if ("token_hash" in d.data) eq(d.data.token_hash, sha256(u.token), "unit_dispatched.token_hash");
  }
  ok(events.some((e) => e.type === "admit"), "the admit event is journaled");
  const leaks = [];
  const files = [...await readTree(c.P.build, ["units", "wt", "integration"]), ...(await Promise.all([c.env.PANDACORP_EVENTS_FILE, c.env.PANDACORP_CODEX_EVENTS_FILE].map(async (f) => [f, await readFile(f, "utf8").catch(() => "")])))];
  for (const [f, text] of files) for (const u of r.units) if (text.includes(u.token)) leaks.push(path.basename(f));
  eq(leaks, [], "the raw unit token must never be persisted (state, journal, admission.json, events)");
}));

await test("width: with clean signals step 5 dispatches all three independent ready units", async () => withCase({ units: [B("WO-01-001"), B("WO-01-002"), B("WO-02-001")] }, async (c) => {
  const r = await callNext(c);
  eq(r.units.length, 3, "step 5 allows all three ready units");
  eq(r.admit.decision, "grant", "admit");
  const queued = (await c.readState()).units.filter((u) => u.state === "queued");
  eq(queued.length, 0, "all ready units were dispatched");
}));

await test("order of work (PLAN 3.3): harvest, then integrate, then quota and planner, then admission, then units", async () => withCase({
  units: [B("WO-01-001", { state: "committed", worker: WORKER() }), B("WO-01-002", { state: "integrated", worker: WORKER() }), B("WO-02-001"),
    B("WO-02-002", { state: "running", token_hash: sha256("t"), worker: WORKER({ runtime: "codex", model: "sol", via: "cli", pid: process.pid, worker_id: "w-u-build-wo-02-002" }) })],
  jobs: [{ id: "w-u-build-wo-02-002", kind: "worker", unit: "u-build-wo-02-002", frd: "frd-02-beta", pid: process.pid, cwd: "/tmp/x", h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: "w-u-build-wo-02-002" }],
}, async (c) => {
  c.integrateAnswer = [{ unit: "u-build-wo-01-001", sha: "a".repeat(40) }];
  const r = await callNext(c);
  const first = (pred) => c.log.findIndex(pred);
  // Harvest = polling running jobs/workers and ingesting reports; `jobs.startJob` (the G2 spawn, after integration, ruling G2) is not harvest.
  const iHarvest = first((e) => (e.mod === "jobs" && e.fn === "pollJob") || (e.mod === "workers" && e.fn === "pollWorker") || e.mod === "report");
  const iIntegrate = first((e) => e.mod === "integrate");
  const iQuota = first((e) => e.mod === "quota");
  const iPlan = first((e) => e.mod === "planner");
  const iDecide = first((e) => e.mod === "admission" && e.fn === "decide");
  const iPrepare = first((e) => e.mod === "units");
  ok(iIntegrate >= 0, "a committed chain must go through integrate.* (step 2)");
  ok(iPlan >= 0 && iQuota >= 0 && iDecide >= 0 && iPrepare >= 0, `planner, quota, admission.decide and units.* must all run (indexes ${[iPlan, iQuota, iDecide, iPrepare]})`);
  ok(iHarvest >= 0, `step 1 must poll the running Codex worker job of u-build-wo-02-002 (jobs.pollJob or workers.pollWorker); calls: ${c.log.map((e) => `${e.mod}.${e.fn}`).join(" ")}`);
  ok(iHarvest < iIntegrate, "step 1 (harvest) runs before step 2 (integrate)");
  ok(iIntegrate < iPlan, "integrate runs before the planner round");
  ok(iQuota < iPlan, "the quota policy (step 3) runs before the planner round (steps 5)");
  ok(iPlan < iDecide, "the planner round precedes admission (step 6)");
  ok(iDecide < iPrepare, "admission precedes dispatch preparation (step 7): no token, no worktree or brief");
  eq(r.action, "dispatch", "the queued unit is dispatched");
}));

await test("integration: when every unit of an FRD is integrated a G2 job is spawned for that FRD (4.1)", async () => withCase({
  units: [B("WO-01-001", { state: "committed", worker: WORKER() }), B("WO-01-002", { state: "integrated", worker: WORKER() })],
}, async (c) => {
  c.integrateAnswer = [{ unit: "u-build-wo-01-001", sha: "a".repeat(40) }];
  await callNext(c);
  const iIntegrate = c.log.findIndex((e) => e.mod === "integrate");
  const g2 = c.log.findIndex((e, i) => i > iIntegrate && e.mod === "jobs" && /g2/i.test(JSON.stringify(e.args)) && /frd-01-alpha/.test(JSON.stringify(e.args)));
  ok(iIntegrate >= 0 && g2 > iIntegrate, "after integrating the last unit of frd-01-alpha, a jobs.* call naming g2 and frd-01-alpha must follow");
}));

await test("PATCH2: unattributed gate patch dispatch keeps every WO unchanged", async () => withCase({
  units: [B("WO-01-001", { state: "verified" }), { id: "u-patch-g3", kind: "patch", frd: null, wos: ["WO-01-001"] }],
}, async (c) => {
  await mkdir(c.P.unitDir("u-patch-g3"), { recursive: true });
  await writeFile(path.join(c.P.unitDir("u-patch-g3"), "gate-failure.json"), JSON.stringify({ attributed: false }));
  const r = await callNext(c);
  eq(unitIds(r), ["u-patch-g3"], "fallback dispatched");
  ok(!c.log.some((e) => e.fn === "transitionWorkOrders"), "fallback must not reopen any WO");
}));

await test("PATCH2: selective reviews accept healthy verified siblings and explicit null-FRD patch dependencies", async () => {
  const { buildCandidates } = await import("../runtime/build/next/candidates.mjs");
  const { newUnit } = await must("state.mjs");
  for (const nullFrd of [false, true]) {
    const units = [newUnit(B("WO-01-001", { state: "verified", worker: WORKER({ model: "opus" }) })),
      newUnit({ id: "u-patch", kind: "patch", frd: nullFrd ? null : "frd-01-alpha", wos: ["WO-01-002"], state: nullFrd ? "integrated" : "reviewing", worker: WORKER() }),
      newUnit(R(nullFrd ? null : "frd-01-alpha", { depends_on: nullFrd ? ["u-patch"] : [] }))];
    await withCase({ units }, async (c) => {
      const state = await c.readState();
      const routed = [];
      const d = { env: c.env, routing: { reviewCell: (input) => { routed.push(input); return { used: { runtime: "codex", model: "sol", effort: "high" } }; } } };
      const run = { d, ref: { project: c.root, epoch: c.epoch, deps: d }, paths: c.P };
      const out = await buildCandidates(run, state, {}, { ready: [] }, {}, []);
      eq(out.list.map((x) => x.unit.id), [units[2].id], "selective review is dispatchable");
      eq(routed[0].authors.map((x) => x.model), ["sonnet"], "review routes from the patch author only");
      eq((await stateUnit(c, units[2].id)).depends_on, ["u-patch"], "review-record receives the same selective unit set");
    });
  }
});

await test("PATCH2: an integrated null-FRD fallback queues its own review and briefs only the patch diff", async () => withCase({
  nested: true,
  units: [B("WO-01-001", { state: "verified", worker: WORKER() }), R("frd-01-alpha", { state: "verified" }),
    { id: "u-patch-g3", kind: "patch", frd: null, wos: ["WO-01-001"], state: "integrated", worker: WORKER() }],
}, async (c) => {
  const root = (await c.readState()).integration.worktree;
  const before = c.fx.git("-C", root, "rev-parse", "HEAD");
  await writeFile(path.join(root, "src/alpha/list.ts"), "export const corrected = true;\n");
  c.fx.git("-C", root, "add", "src/alpha/list.ts");
  c.fx.git("-C", root, "commit", "-q", "-m", "fix: gate fallback", "-m", "Unit: u-patch-g3");
  const tip = c.fx.git("-C", root, "rev-parse", "HEAD");
  const result = await callNext(c);
  eq(unitIds(result), ["u-review-u-patch-g3"], "fallback receives an independent review");
  const brief = c.log.find((e) => e.fn === "writeUnitBrief").args[0];
  eq(brief.extra.review.range, `${before}..${tip}`, "brief excludes earlier FRD work");
  eq((await stateUnit(c, "u-build-wo-01-001")).state, "verified", "healthy WO stays verified");
  eq((await stateUnit(c, "u-patch-g3")).state, "integrated", "patch waits for the review verdict");
}));

// =====================================================================================================================
// Tests first, scope, the change queue
// =====================================================================================================================
await test("D16: a tests unit goes before its build unit (even if the planner offers the build unit first); the build follows once tests are integrated", async () => withCase({
  units: [T("WO-01-001"), B("WO-01-001", { depends_on: ["u-tests-wo-01-001"] })], planner: "naive",
}, async (c) => {
  const r1 = await callNext(c);
  eq(unitIds(r1), ["u-tests-wo-01-001"], "only the tests unit is dispatched while its build unit depends on it");
  eq(r1.units[0].agent_type, "pandacorp:test-writer", "tests units go to the test-writer");
  eq(r1.units[0].kind, "tests", "kind");
  await c.setUnitState("u-tests-wo-01-001", "integrated");
  const r2 = await callNext(c);
  eq(unitIds(r2), ["u-build-wo-01-001"], "after the tests unit is integrated the build unit is dispatched");
}));

await test("scope: a unit whose WO is in out_of_scope is never dispatched, whatever the planner offers", async () => withCase({
  units: [B("WO-01-001"), B("WO-02-001")], planner: "naive",
  scope: { frds: ["frd-01-alpha"], wos: ["WO-01-001"], out_of_scope: ["WO-02-001", "WO-02-002"] },
}, async (c) => {
  for (let i = 0; i < 2; i++) { const r = await callNext(c); ok(!unitIds(r).includes("u-build-wo-02-001"), `call ${i + 1} dispatched an out-of-scope unit`); }
  ok(!preparedIds(c).includes("u-build-wo-02-001"), "no worktree or brief was prepared for the out-of-scope unit");
  ok(!(await dispatchedIds(c)).includes("u-build-wo-02-001"), "no unit_dispatched event for it");
  eq((await stateUnit(c, "u-build-wo-02-001")).state, "queued", "it stays queued");
}));

await test("scope: an out_of_scope FRD id excludes its units too", async () => withCase({
  units: [B("WO-01-001"), B("WO-02-001")], planner: "naive",
  scope: { frds: ["frd-01-alpha"], wos: ["WO-01-001"], out_of_scope: ["frd-02-beta"] },
}, async (c) => {
  const r = await callNext(c);
  eq(unitIds(r), ["u-build-wo-01-001"], "only the in-scope unit");
}));

await test("scope: all in-scope units landed and only an out-of-scope unit queued -> done (not deadlock, not dispatch)", async () => withCase({
  units: [B("WO-01-001", { state: "landed" }), R("frd-01-alpha", { state: "verified" }), B("WO-02-001")], planner: "naive",
  scope: { frds: ["frd-01-alpha"], wos: ["WO-01-001"], out_of_scope: ["WO-02-001"] },
}, async (c) => {
  const r = await callNext(c);
  eq(r.action, "done", "out-of-scope units do not count as pending work");
  eq(r.units ?? [], [], "no units");
}));

await test("change queue: next never drains, moves or archives the owner's cards and creates no unit from them", async () => withCase({ preset: "card", units: [B("WO-01-001")] }, async (c) => {
  const dirCards = path.join(c.root, ".pandacorp", "inbox", "changes");
  const snap = async () => Object.fromEntries(await Promise.all((await readdir(dirCards)).sort().map(async (f) => [f, await readFile(path.join(dirCards, f), "utf8")])));
  const before = await snap();
  ok(Object.keys(before).length === 2, "precondition: the card preset holds two cards");
  for (let i = 0; i < 3; i++) await callNext(c);
  eq(await snap(), before, "the change queue must be byte-identical (same files, same content)");
  const state = await c.readState();
  eq(state.units.map((u) => u.id), ["u-build-wo-01-001"], "no unit was created from a card");
  eq(state.scope.card, null, "scope.card unchanged");
  const writers = c.log.filter((e) => e.mod === "card" && /archive|building|drain|write|move|consume|mark|queue/i.test(e.fn));
  eq(writers.map((e) => e.fn), [], "next must not call a card writer");
}));

// =====================================================================================================================
// Pending answers (D19)
// =====================================================================================================================
const QUESTIONS = [
  { id: "q-risk-paths", text_es: "Hay rutas de riesgo sin clasificar.", default_es: "Tratarlas como riesgo.", default_action: "use_default", affects: { wos: ["WO-02-001"] }, reversible: true },
  { id: "q-drop-table", text_es: "Se borra una tabla.", default_es: "No borrar.", default_action: "use_default", affects: { wos: ["WO-02-001"] }, reversible: false },
];

await test("D19: a unit with a pending reversible answer goes LAST: the others take the slots first, then it runs on the default", async () => withCase({
  units: [B("WO-02-001", { pending_answer: "q-risk-paths" }), B("WO-01-001"), B("WO-01-002")], questions: QUESTIONS,
}, async (c) => {
  c.plannerRound = ["u-build-wo-02-001", "u-build-wo-01-001", "u-build-wo-01-002"];
  const r1 = await callNext(c, { k: 2 });
  eq(unitIds(r1), ["u-build-wo-01-001", "u-build-wo-01-002"], "the two answer-free units take both slots; the pending unit is not first");
  eq((await stateUnit(c, "u-build-wo-02-001")).state, "queued", "the pending unit waits");
  await c.setUnitState("u-build-wo-01-001", "landed"); await c.setUnitState("u-build-wo-01-002", "landed");
  c.plannerRound = ["u-build-wo-02-001"];
  const r2 = await callNext(c);
  eq(unitIds(r2), ["u-build-wo-02-001"], "with nothing else left, the reversible pending unit is dispatched on its default");
  ok(!["parked", "blocked", "waiting_gate"].includes((await stateUnit(c, "u-build-wo-02-001")).state), "it is not parked");
}));

await test("D19: a unit with a pending IRREVERSIBLE answer is parked owner_question (journaled), never dispatched; alone -> waiting-owner", async () => withCase({
  units: [B("WO-02-001", { pending_answer: "q-drop-table" }), B("WO-01-001")], questions: QUESTIONS,
}, async (c) => {
  c.plannerRound = ["u-build-wo-02-001", "u-build-wo-01-001"];
  const r1 = await callNext(c);
  eq(unitIds(r1), ["u-build-wo-01-001"], "only the answer-free unit is dispatched");
  const p = await stateUnit(c, "u-build-wo-02-001");
  eq([p.state, p.parked], ["parked", "owner_question"], "the irreversible unit is parked owner_question");
  const ev = (await c.events()).find((e) => e.type === "parked" && e.data.unit === "u-build-wo-02-001");
  ok(ev, "a `parked` event is journaled");
  eq([ev.data.reason, ev.data.question], ["owner_question", "q-drop-table"], "parked.data = {unit, reason, question}");
  ok(!preparedIds(c).includes("u-build-wo-02-001"), "no worktree or brief for the parked unit");
  await c.setUnitState("u-build-wo-01-001", "landed");
  c.plannerMode = "deadlock";
  const statusYaml = await readFile(c.P.statusYaml, "utf8");
  const r2 = await callNext(c);
  await expectApplied(c, r2, { action: "waiting-owner", status: "waiting_owner", journal: ["paused", "run_stopped", "waiting_gate"], statusYamlBefore: statusYaml });
}));

// =====================================================================================================================
// Admission (D31, D4)
// =====================================================================================================================
const deny = (motivo) => ({ grant: null, motivo_limite: motivo, techo: 2, suelo: 2, A_ef: 1, P: -2, veto: null, h_max: 1, safe_mode: false });

await test("admission: a denied grant dispatches nothing, issues no token and returns wait with the reason and admit.motivo_limite", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  const admission = spyModule("admission", c.admissionMod, c.log, { decide: () => deny("ram") });
  const r = await callNext(c, {}, { admission });
  eq(r.action, "wait", "action"); eq(r.units ?? [], [], "no units");
  eq(r.wait?.reason, "ram", "wait.reason"); ok(Number.isFinite(r.wait?.retry_after_s) && r.wait.retry_after_s > 0, "wait.retry_after_s is a positive number");
  eq([r.admit?.decision, r.admit?.motivo_limite], ["wait", "ram"], "admit");
  const u = await stateUnit(c, "u-build-wo-01-001");
  eq([u.state, u.token_hash], ["queued", null], "the unit stays queued with no token");
  const admission2 = existsSync(c.P.admissionFile) ? JSON.parse(await readFile(c.P.admissionFile, "utf8")) : { tokens: {} };
  eq(Object.keys(admission2.tokens ?? {}), [], "no token was issued");
  eq(await dispatchedIds(c), [], "no unit_dispatched event");
  ok(c.log.filter((e) => e.mod === "admission" && e.fn === "issueToken").length === 0, "issueToken was never called");
}));

await test("admission: motivo cpu_H maps to wait.reason cpu_H", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  const admission = spyModule("admission", c.admissionMod, c.log, { decide: () => deny("cpu_H") });
  const r = await callNext(c, {}, { admission });
  eq([r.action, r.wait?.reason, r.admit?.motivo_limite], ["wait", "cpu_H", "cpu_H"], "wait on the heavy-tool slots");
}));

await test("admission: each dispatched unit holds a token that verifies against admission.json, and only dispatched units hold one", async () => withCase({ units: [B("WO-01-001"), B("WO-01-002"), B("WO-02-001")] }, async (c) => {
  const r = await callNext(c);
  const file = c.P.admissionFile;
  for (const u of r.units) { const v = c.admissionMod.verifyToken(u.unit, u.token, { file }); ok(v.ok, `token of ${u.unit} must verify (${v.reason})`); }
  const held = Object.values(JSON.parse(await readFile(file, "utf8")).tokens).map((t) => t.unit).sort();
  eq(held, unitIds(r), "the token book holds exactly the dispatched units");
}));

await test("admission: exactly one reading is recorded per call (dispatch and wait alike), history capped at 3", async () => withCase({ units: [B("WO-01-001", { state: "running", worker: WORKER(), token_hash: sha256("t") })] }, async (c) => {
  for (let n = 1; n <= 4; n++) {
    const r = await callNext(c);
    eq(r.action, "wait", `call ${n}: only a running unit -> wait`);
    eq(c.log.filter((e) => e.mod === "admission" && e.fn === "recordReading").length, n, `after call ${n}: one recordReading per call`);
    eq(JSON.parse(await readFile(c.P.admissionFile, "utf8")).history.length, Math.min(n, 3), `after call ${n}: history length`);
  }
  await c.writeState((s) => { s.units.push(c.stateMod.newUnit(B("WO-02-001"))); s.scope.wos.push("WO-02-001"); s.scope.frds.push("frd-02-beta"); });
  const before = c.log.filter((e) => e.fn === "recordReading").length;
  const r = await callNext(c);
  eq(r.action, "dispatch", "a queued unit appears: dispatch");
  eq(c.log.filter((e) => e.fn === "recordReading").length - before, 1, "a dispatching call records one reading too, not one per candidate");
}));

await test("L4 pressure: critical for any duration lowers to 1, dispatches one and preserves the lease", async () => {
  await withCase({ units: [B("WO-01-001"), B("WO-02-001")], signals: "critical" }, async (c) => {
    const r = await callNext(c); eq(r.action, "dispatch", "never a memory pause"); eq(r.units.length, 1, "one builder");
    eq((await c.readState()).status, "active", "active"); ok(await c.leaseNow(), "lease kept");
    eq(JSON.parse(await readFile(c.P.admissionFile, "utf8")).ladder.step, 1, "critical step");
    eq(c.log.filter((e) => e.fn === "emitEvent" && e.args?.[1]?.name === "build.scaled").length, 1, "scale event emitted once");
  });
});

await test("disk: low space returns wait disk, no token/worktree, Spanish note and one notification across retries", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  c.env.PANDACORP_DISK_FREE_GIB = "16.49"; const notices = [];
  for (let i = 0; i < 2; i++) {
    const r = await callNext(c, {}, { notify: (n) => notices.push(n) });
    eq(r.action, "wait", "wait"); eq(r.wait.reason, "disk", "reason"); eq(r.admit.motivo_limite, "disco", "motivo");
    ok(r.notes_es.some((n) => n.includes("Disco")), "Spanish note");
  }
  eq(notices.length, 1, "one notification");
  eq(Object.keys(JSON.parse(await readFile(c.P.admissionFile, "utf8")).tokens).length, 0, "no tokens");
  ok(!c.log.some((e) => e.fn === "prepareUnitWorktree"), "no worktree creation");
}));

await test("disk: existing attempt worktree requeue is allowed even with zero free space", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  c.env.PANDACORP_DISK_FREE_GIB = "0";
  const wt = c.P.unitWorktree("u-build-wo-01-001", 1); await mkdir(wt, { recursive: true }); await writeFile(path.join(wt, ".git"), "gitdir: fixture");
  const r = await callNext(c); eq(r.action, "dispatch", "existing worktree reused"); eq(r.units.length, 1, "one unit");
}));

await test("disk: G2 needing a fresh snapshot waits without a job or env-infra handback", async () => withCase({ units: [B("WO-01-001", { state: "integrated" })] }, async (c) => {
  c.env.PANDACORP_DISK_FREE_GIB = "16";
  const r = await callNext(c); eq(r.action, "wait", "wait"); eq(r.wait.reason, "disk", "G2 disk wait");
  ok(!c.log.some((e) => e.fn === "startJob" || e.fn === "handbackCommand"), "no G2 job or handback");
}));

// =====================================================================================================================
// Quota (D9, A11)
// =====================================================================================================================
await test("quota: both providers >= 90 %, nothing running -> paused-quota, applied (status paused, journal, lease released, status.yaml untouched)", async () => withCase({ units: [B("WO-01-001")], quota: { claude: 92, codex: 98 } }, async (c) => {
  const statusYaml = await readFile(c.P.statusYaml, "utf8");
  const r = await callNext(c);
  await expectApplied(c, r, { action: "paused-quota", status: "paused", journal: ["paused"], statusYamlBefore: statusYaml });
  eq([r.quota?.claude?.pct, r.quota?.codex?.pct], [92, 98], "the quota block reports both readings");
  eq(await dispatchedIds(c), [], "nothing was dispatched");
  ok(!c.log.some((e) => e.mod === "planner" || (e.mod === "admission" && e.fn === "issueToken")), "no planner round and no token on a quota pause");
}));

await test("quota: exactly 90 % counts as out (boundary); 89 % does not", async () => {
  await withCase({ units: [B("WO-01-001")], quota: { claude: 90, codex: 90 } }, async (c) => eq((await callNext(c)).action, "paused-quota", "90 and 90 pause"));
  await withCase({ units: [B("WO-01-001")], quota: { claude: 89, codex: 90 } }, async (c) => {
    const r = await callNext(c);
    ok(r.action !== "paused-quota", "Claude at 89 % keeps the run going");
  });
});

await test("quota: both >= 90 but a unit is still running -> wait (reason quota), nothing applied", async () => withCase({ units: [B("WO-01-001", { state: "running", worker: WORKER(), token_hash: sha256("t") }), B("WO-02-001")], quota: { claude: 93, codex: 95 } }, async (c) => {
  const r = await callNext(c);
  eq([r.action, r.wait?.reason], ["wait", "quota"], "terminal actions only when nothing runs");
  eq(r.units ?? [], [], "no new unit while both providers are out");
  await expectNotApplied(c);
}));

await test("handoff: Claude >= 95 %, claude-session coordinator, drive standby alive -> action handoff (lease kept, run active, no unit)", async () => withCase({ units: [B("WO-01-001")], quota: { claude: 96, codex: 40 }, standby: { state: "standby", pid: "alive" } }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "handoff", "action"); eq(r.units ?? [], [], "no units are dispatched on a handoff");
  await expectNotApplied(c);
}));

await test("handoff: Claude >= 95 % without a live drive standby (absent, dead pid, or not in state standby) -> paused-quota applied, never handoff", async () => {
  for (const [label, standby] of [["absent", null], ["dead pid", { state: "standby", pid: "dead" }], ["state stopped", { state: "stopped", pid: "alive" }], ["state active", { state: "active", pid: "alive" }]]) {
    await withCase({ units: [B("WO-01-001")], quota: { claude: 97, codex: 40 }, standby }, async (c) => {
      const statusYaml = await readFile(c.P.statusYaml, "utf8");
      const r = await callNext(c);
      try { await expectApplied(c, r, { action: "paused-quota", status: "paused", journal: ["paused"], statusYamlBefore: statusYaml }); } catch (e) { throw new Error(`standby ${label}: ${e.message}`); }
    });
  }
});

await test("A11 priority: both >= 90 beats the handoff even with a live standby", async () => withCase({ units: [B("WO-01-001")], quota: { claude: 96, codex: 95 }, standby: { state: "standby", pid: "alive" } }, async (c) => {
  eq((await callNext(c)).action, "paused-quota", "both out -> pause, no handoff");
}));

await test("handoff: a codex-session coordinator never hands off, whatever Claude's reading", async () => withCase({ coordinator: "codex-session", units: [B("WO-01-001")], quota: { claude: 97, codex: 40 }, standby: { state: "standby", pid: "alive" } }, async (c) => {
  const r = await callNext(c);
  ok(!["handoff", "paused-quota"].includes(r.action), `got ${r.action}`);
}));

await test("quota: Claude at 90..94 % (below the handoff threshold) -> no handoff and no new Claude unit: the builder takes the Codex column (via cli)", async () => withCase({ units: [B("WO-01-001")], quota: { claude: 90, codex: 40 }, standby: { state: "standby", pid: "alive" } }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "dispatch", "the run continues on the other company");
  ok(r.units.length >= 1, "a unit is dispatched");
  for (const u of r.units) { eq(u.runtime, "codex", "no new unit on the provider at >= 90 %"); eq(u.via, "cli", "a Codex unit is launched by the CLI"); ok(typeof u.model_slug === "string" && u.model_slug.length > 0, "model_slug is set for via:cli"); }
}));

await test("quota: Codex at 90 % with label codex -> every new unit runs on Claude (agent), none on Codex", async () => withCase({ label: "codex", units: [B("WO-01-001"), B("WO-02-001")], quota: { claude: 30, codex: 90 } }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "dispatch", "action");
  for (const u of r.units) { eq(u.runtime, "claude", "no new unit on the provider at >= 90 %"); eq(u.via, "agent", "via"); }
}));

// =====================================================================================================================
// Terminal actions (A11)
// =====================================================================================================================
await test("terminal: every unit landed / blocked / (review-type) verified -> done; the lease stays held (the session calls finish)", async () => {
  await withCase({ units: [B("WO-01-001", { state: "landed" }), B("WO-01-002", { state: "blocked" }), R("frd-01-alpha", { state: "verified" })] }, async (c) => {
    const r = await callNext(c);
    eq(r.action, "done", "action"); eq(r.units ?? [], [], "no units");
    await expectNotApplied(c);
  });
});

await test("terminal: build units verified and the FRD review verified -> land (the batch is complete)", async () => withCase({ units: [B("WO-01-001", { state: "verified" }), B("WO-01-002", { state: "verified" }), R("frd-01-alpha", { state: "verified" })] }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "land", "action");
  await expectNotApplied(c);
}));

await test("terminal: 3 consecutive env-infra hand-backs -> stop, applied (status stopped, run_stopped, lease released); 2 do not", async () => {
  await withCase({ units: [B("WO-01-001")], handbacks: 3 }, async (c) => {
    const statusYaml = await readFile(c.P.statusYaml, "utf8");
    const r = await callNext(c);
    await expectApplied(c, r, { action: "stop", status: "stopped", journal: ["run_stopped"], statusYamlBefore: statusYaml });
  });
  await withCase({ units: [B("WO-01-001")], handbacks: 2 }, async (c) => eq((await callNext(c)).action, "dispatch", "two hand-backs keep dispatching"));
});

await test("terminal: nothing can progress and the blocker is an owner answer -> waiting-owner (status waiting_owner), applied", async () => withCase({
  units: [B("WO-02-001", { state: "parked", parked: "owner_question", pending_answer: "q-drop-table" }), B("WO-02-002", { depends_on: ["u-build-wo-02-001"] })],
  questions: QUESTIONS, planner: "deadlock",
}, async (c) => {
  const statusYaml = await readFile(c.P.statusYaml, "utf8");
  const r = await callNext(c);
  await expectApplied(c, r, { action: "waiting-owner", status: "waiting_owner", journal: ["paused", "run_stopped", "waiting_gate"], statusYamlBefore: statusYaml });
}));

await test("terminal: every blocker is a gate -> waiting-owner with status waiting_gate; a gate mixed with an owner question -> waiting_owner", async () => {
  await withCase({ units: [B("WO-01-001", { state: "waiting_gate", waiting_gate: "money" })], planner: "deadlock" }, async (c) => {
    const r = await callNext(c);
    await expectApplied(c, r, { action: "waiting-owner", status: "waiting_gate", journal: ["paused", "run_stopped", "waiting_gate"] });
  });
  await withCase({ units: [B("WO-01-001", { state: "waiting_gate", waiting_gate: "money" }), B("WO-02-001", { state: "parked", parked: "owner_question", pending_answer: "q-drop-table" })], questions: QUESTIONS, planner: "deadlock" }, async (c) => {
    const r = await callNext(c);
    await expectApplied(c, r, { action: "waiting-owner", status: "waiting_owner", journal: ["paused", "run_stopped", "waiting_gate"] });
  });
});

await test("terminal: queued units but the planner can make no progress and nobody waits on the owner -> deadlock, applied", async () => withCase({ units: [B("WO-01-001", { depends_on: ["u-build-wo-02-001"] }), B("WO-02-001", { depends_on: ["u-build-wo-01-001"] })], planner: "deadlock" }, async (c) => {
  const statusYaml = await readFile(c.P.statusYaml, "utf8");
  const r = await callNext(c);
  await expectApplied(c, r, { action: "deadlock", status: ["paused", "stopped", "waiting_owner"], journal: ["paused", "run_stopped"], statusYamlBefore: statusYaml });
}));

await test("A11 priority: quota still pauses; critical memory never masks an env-infra stop", async () => {
  await withCase({ units: [B("WO-01-001")], quota: { claude: 95, codex: 95 }, signals: "critical", handbacks: 3 }, async (c) => eq((await callNext(c)).action, "paused-quota", "quota first"));
  await withCase({ units: [B("WO-01-001")], signals: "critical", handbacks: 3 }, async (c) => eq((await callNext(c)).action, "stop", "env-infra stops"));
});

await test("A11: a terminal action is returned only when nothing runs: with a running unit it is `wait` (workers_running) and nothing is applied", async () => {
  for (const [label, over] of [["3 hand-backs", { handbacks: 3 }], ["owner blocker", { planner: "deadlock" }]]) {
    await withCase({ units: [B("WO-01-001", { state: "running", worker: WORKER(), token_hash: sha256("t") }), B("WO-02-001", { state: "parked", parked: "owner_question", pending_answer: "q-drop-table" })], questions: QUESTIONS, ...over }, async (c) => {
      const r = await callNext(c);
      eq(r.action, "wait", `${label}: wait, not a terminal action`);
      ok(["workers_running", "jobs_running", "gate", "quota"].includes(r.wait?.reason), `${label}: wait.reason, got ${r.wait?.reason}`);
      await expectNotApplied(c);
    });
  }
});

await test("A11: a running G2 job keeps the run waiting (jobs_running) even when the units themselves are all integrated", async () => withCase({
  units: [B("WO-01-001", { state: "integrated", worker: WORKER() }), B("WO-01-002", { state: "integrated", worker: WORKER() })],
  jobs: [{ id: "j-g2-frd-01", kind: "g2", unit: null, frd: "frd-01-alpha", pid: process.pid, cwd: "/tmp/x", h_slot: true, started_at: NOW, state: "running", exit: null, worker_id: null }],
}, async (c) => {
  const r = await callNext(c);
  eq([r.action, r.wait?.reason], ["wait", "jobs_running"], "action and reason");
  await expectNotApplied(c);
}));

// =====================================================================================================================
// Built on assumption (BUILD-12, DG-5) and the land job (RULINGS-C1 doubt 7)
// =====================================================================================================================
const DOUBT = "d-0042";
const assumed = (wo, over = {}) => B(wo, { parked: "built_on_assumption", pending_answer: DOUBT, doubt_id: DOUBT, ...over });

await test("assumption: a queued built_on_assumption unit IS dispatched, from paths.assumeBranch(run, doubt); the flag survives dispatch; other units get no base", async () => withCase({
  units: [assumed("WO-01-001"), B("WO-02-001")],
}, async (c) => {
  const r = await callNext(c);
  eq(unitIds(r), ["u-build-wo-01-001", "u-build-wo-02-001"], "both units dispatched");
  const prep = (id) => c.log.find((e) => e.mod === "units" && e.fn === "prepareUnitWorktree" && e.args[0].unit === id)?.args[0];
  eq(prep("u-build-wo-01-001")?.base, c.P.assumeBranch(RUN, DOUBT), "assumed unit forks from the assume branch");
  ok(!prep("u-build-wo-02-001")?.base, "a normal unit gets no explicit base");
  eq((await stateUnit(c, "u-build-wo-01-001")).parked, "built_on_assumption", "the flag stays until the owner answers");
}));

await test("assumption: the unit that is never the only blocker: a run whose only queued unit is built_on_assumption is not waiting-owner or deadlock, it dispatches", async () => withCase({
  units: [assumed("WO-01-001")],
}, async (c) => {
  const r = await callNext(c);
  eq(r.action, "dispatch", "action");
  eq(unitIds(r), ["u-build-wo-01-001"], "dispatched");
}));

await test("assumption: an FRD whose units are integrated but one is built_on_assumption gets NO G2 job (G2 runs after acceptance); the control FRD does", async () => withCase({
  units: [assumed("WO-01-001", { state: "integrated", worker: WORKER() }), B("WO-01-002", { state: "integrated", worker: WORKER() }), B("WO-02-001", { state: "integrated", worker: WORKER() })],
}, async (c) => {
  await callNext(c);
  const g2 = (frd) => c.log.some((e) => e.mod === "jobs" && e.fn === "startJob" && /g2/i.test(JSON.stringify(e.args)) && JSON.stringify(e.args).includes(frd));
  ok(!g2("frd-01-alpha"), "no g2 job for the FRD holding assumption work");
  ok(g2("frd-02-beta"), "control: the other FRD, fully integrated, does get its G2 job");
}));

await test("land job: while a land job runs, next neither integrates nor dispatches and returns wait jobs_running (nothing applied)", async () => withCase({
  units: [B("WO-01-001", { state: "committed", worker: WORKER() }), B("WO-02-001")],
  jobs: [{ id: "j-land-1", kind: "land", unit: null, frd: null, pid: process.pid, cwd: "/tmp/x", h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: null }],
}, async (c) => {
  c.integrateAnswer = [{ unit: "u-build-wo-01-001", sha: "b".repeat(40) }];
  const r = await callNext(c);
  eq([r.action, r.wait?.reason], ["wait", "jobs_running"], "action and reason");
  eq(r.units ?? [], [], "no unit dispatched");
  ok(!c.log.some((e) => e.mod === "integrate" && e.fn === "integrateCommitted"), "the integration step did not run");
  ok(!c.log.some((e) => e.mod === "units" && e.fn === "prepareUnitWorktree"), "no worktree prepared");
  eq((await stateUnit(c, "u-build-wo-02-001")).state, "queued", "the queued unit stays queued");
  eq((await stateUnit(c, "u-build-wo-01-001")).state, "committed", "the committed unit stays committed");
  await expectNotApplied(c);
}));

// =====================================================================================================================
// --wait: long poll, early return, lease renewal
// =====================================================================================================================
const runningUnit = (over = {}) => B("WO-01-001", { state: "running", worker: WORKER(), token_hash: sha256("t"), ...over });

await test("--wait: returns early when a report file appears, and the lease is renewed", async () => withCase({ realClock: true, units: [runningUnit()], quota: {} }, async (c) => {
  const before = (await c.leaseNow()).renewed_at;
  await sleep(15);
  setTimeout(async () => { await mkdir(c.P.unitDir("u-build-wo-01-001"), { recursive: true }); await writeFile(c.P.reportFile("u-build-wo-01-001"), "{}\n"); }, 400);
  const t0 = Date.now();
  const r = await callNext(c, { wait: 6 }, {}, { clean: false });
  const elapsed = Date.now() - t0;
  ok(elapsed >= 250, `it must actually wait for the event (returned after ${elapsed} ms)`);
  ok(elapsed < 4000, `a report file must end the wait early (took ${elapsed} ms of the 6 s)`);
  ok(typeof r.action === "string", "an action is returned");
  ok(Date.parse((await c.leaseNow()).renewed_at) > Date.parse(before), "next --wait renews the lease");
}));

await test("--wait: with no event it waits about the requested time (a 1 s wait lasts >= 0.9 s) and returns wait; the lease is renewed", async () => withCase({ realClock: true, units: [runningUnit()] }, async (c) => {
  const before = (await c.leaseNow()).renewed_at;
  await sleep(15);
  const t0 = Date.now();
  const r = await callNext(c, { wait: 1 }, {}, { clean: false });
  const elapsed = Date.now() - t0;
  ok(elapsed >= 900 && elapsed < 5000, `waited ${elapsed} ms for wait:1`);
  eq(r.action, "wait", "nothing changed: wait");
  ok(Date.parse((await c.leaseNow()).renewed_at) > Date.parse(before), "the lease is renewed");
}));

await test("--wait: an answer_recorded journal event, a job exit file and handoff.json each end the wait early", async () => {
  const wakers = {
    answer_recorded: async (c) => { await c.journalMod.appendEvent(c.P.journalFile, { run_id: RUN, epoch: c.epoch, type: "answer_recorded", data: { question: "q-risk-paths", kind: "ask", value: "x", units: [] } }, { env: c.env }); },
    "job exit": async (c) => { await mkdir(c.P.jobDir("j-g2-frd-01"), { recursive: true }); await writeFile(c.P.jobExitFile("j-g2-frd-01"), "0\n"); },
    "handoff.json": async (c) => { await mkdir(path.dirname(c.P.handoffFile), { recursive: true }); await writeFile(c.P.handoffFile, `${JSON.stringify({ run_id: RUN, from_epoch: c.epoch, reason: "test", requested_at: new Date().toISOString() })}\n`); },
  };
  for (const [name, wake] of Object.entries(wakers)) {
    await withCase({ realClock: true, units: [runningUnit()], jobs: [{ id: "j-g2-frd-01", kind: "g2", unit: null, frd: "frd-01-alpha", pid: process.pid, cwd: "/tmp/x", h_slot: true, started_at: new Date().toISOString(), state: "running", exit: null, worker_id: null }] }, async (c) => {
      setTimeout(() => { wake(c).catch(() => {}); }, 400);
      const t0 = Date.now();
      await callNext(c, { wait: 6 }, {}, { clean: false });
      const elapsed = Date.now() - t0;
      ok(elapsed >= 250 && elapsed < 4000, `${name}: must end the wait early, took ${elapsed} ms of 6000`);
    });
  }
});

// =====================================================================================================================
// Worker failure policy (D21)
// =====================================================================================================================
await test("D21: a Codex worker that returns no valid report is RETRIED as the same unit at attempt 2, never handed back, run not stopped", async () => withCase({
  units: [B("WO-01-001", { state: "running", attempt: 1, token_hash: sha256("t"), worker: WORKER({ runtime: "codex", model: "sol", via: "cli", pid: process.pid, worker_id: "w-u-build-wo-01-001" }) })],
  jobs: [{ id: "w-u-build-wo-01-001", kind: "worker", unit: "u-build-wo-01-001", frd: "frd-01-alpha", pid: process.pid, cwd: "/tmp/x", h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: "w-u-build-wo-01-001" }],
}, async (c) => {
  const realFailure = await must("failure.mjs");
  const exit = c.P.jobExitFile("w-u-build-wo-01-001");
  await mkdir(path.dirname(exit), { recursive: true }); await writeFile(exit, "0\n");
  const workers = fake("workers", c.log, {
    launchWorker: async (input) => ({ ok: true, workerId: `w-${input.unit}`, dir: input.dir, pid: process.pid, startedAt: NOW, reused: false, argv: [], settled: null, job: { id: `w-${input.unit}`, kind: "worker", unit: input.unit, frd: input.frd ?? null, pid: process.pid, cwd: input.dir, h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: `w-${input.unit}` } }),
    pollWorker: async ({ workerId }) => ({ state: "done", workerId, outcome: "bad_report", kind: "no_answer", detail: "the worker returned no JSON answer", errors: [{ path: "", message: "no JSON answer" }], model: "sol", effort: "high" }),
  }, { strict: true });
  const r = await callNext(c, {}, { workers, failure: spyModule("failure", realFailure, c.log) });
  ok(!["stop", "deadlock", "waiting-owner"].includes(r.action), `a first failed execution does not end the run, got ${r.action}`);
  eq(c.log.filter((e) => e.mod === "failure" && e.fn === "handbackCommand").length, 0, "D21: a failed report on attempt 1 is not a hand-back");
  const u = await stateUnit(c, "u-build-wo-01-001");
  ok(!["blocked", "parked"].includes(u.state), `the unit must not be blocked or parked, got ${u.state}`);
  eq(u.attempt, 2, "the same unit is re-queued at attempt+1");
}));

// =====================================================================================================================
// via:"session" (A12)
// =====================================================================================================================
const touchUnit = (over = {}) => B("WO-01-001", over);

await test("A12: touch + build + attempt 1 + zone none + label company = coordinator company -> via:session, cell = {coordinator runtime, --session-model, null effort}", async () => {
  await withCase({ size: "touch", units: [touchUnit()], sessionModel: "opus" }, async (c) => {
    const r = await callNext(c);
    eq(r.units.length, 1, "one unit");
    const u = r.units[0];
    eq([u.via, u.runtime, u.model, u.effort], ["session", "claude", "opus", null], "claude-session / label claude");
    ok(typeof u.token === "string" && u.token.length >= 16, "a session unit still carries the unit token");
    eq(u.model_slug, null, "no slug");
    const su = await stateUnit(c, u.unit);
    eq([su.worker.via, su.worker.runtime, su.worker.model, su.worker.effort], ["session", "claude", "opus", null], "state worker keeps the null effort (legal only for session cells)");
    const d = (await c.events()).find((e) => e.type === "unit_dispatched");
    eq([d.data.cell.runtime, d.data.cell.model, d.data.cell.effort], ["claude", "opus", null], "journal cell");
  });
  await withCase({ coordinator: "codex-session", label: "codex", size: "touch", units: [touchUnit()], sessionModel: "sol" }, async (c) => {
    const u = (await callNext(c)).units[0];
    eq([u.via, u.runtime, u.model, u.effort], ["session", "codex", "sol", null], "codex-session / label codex");
  });
});

await test("A12 negatives: feature size, other company label, floor zone, attempt 2 or a non-build kind are never via:session", async () => {
  const cases = [
    ["size feature", { size: "feature", units: [touchUnit()] }],
    ["label codex under a claude session", { size: "touch", label: "codex", coordinator: "claude-session", units: [touchUnit()] }],
    ["zone floor", { size: "touch", units: [touchUnit({ zone: "floor" })] }],
    ["attempt 2", { size: "touch", units: [touchUnit({ attempt: 2 })] }],
    ["kind patch", { size: "touch", units: [{ ...touchUnit(), id: "u-patch-wo-01-001", kind: "patch" }] }],
  ];
  for (const [name, o] of cases) {
    await withCase(o, async (c) => {
      const r = await callNext(c);
      ok((r.units ?? []).length >= 1, `${name}: a unit is dispatched`);
      for (const u of r.units) ok(u.via !== "session", `${name}: via must not be session`);
    });
  }
});

// =====================================================================================================================
// audit and doubt-consult units
// =====================================================================================================================
await test("audit: with risk.audit and none ran, one audit unit is dispatched (security-auditor) before land; the next call does not create a second", async () => withCase({
  audit: true, risk: { zone: "r1", audit: true }, units: [B("WO-01-001", { state: "verified", zone: "r1" }), R("frd-01-alpha", { state: "verified" })],
}, async (c) => {
  const r1 = await callNext(c);
  eq(r1.action, "dispatch", "the audit comes before `land`");
  eq(r1.units.length, 1, "one unit"); eq(r1.units[0].kind, "audit", "kind audit"); eq(r1.units[0].agent_type, "pandacorp:security-auditor", "agent_type");
  const r2 = await callNext(c);
  eq(r2.units ?? [], [], "no second audit unit while the first is in flight");
  eq((await c.readState()).units.filter((u) => u.kind === "audit").length, 1, "exactly one audit unit in the state");
  const audit = (await c.readState()).units.find((u) => u.kind === "audit");
  await c.setUnitState(audit.id, "verified");
  eq((await callNext(c)).action, "land", "the audit is done: the batch can land");
}));

await test("audit: no audit unit when risk.audit is false", async () => withCase({ audit: false, risk: { zone: "none", audit: false }, units: [B("WO-01-001", { state: "verified" }), R("frd-01-alpha", { state: "verified" })] }, async (c) => {
  const r = await callNext(c);
  eq(r.action, "land", "straight to land"); eq((await c.readState()).units.filter((u) => u.kind === "audit").length, 0, "no audit unit");
}));

await test("doubt-consult: a consult unit is dispatched once (general-purpose, empty schema_path), even when the planner offers it twice; later calls do not surface it again", async () => withCase({
  units: [B("WO-01-001", { state: "reported", doubt_id: "d-1" }), { id: "u-doubt-consult-d-1-c1", kind: "doubt-consult", wos: [], frd: null, chain: null, doubt_id: "d-1" }],
}, async (c) => {
  c.plannerRound = ["u-doubt-consult-d-1-c1", "u-doubt-consult-d-1-c1"];
  const r1 = await callNext(c);
  eq(r1.units.map((u) => u.unit), ["u-doubt-consult-d-1-c1"], "exactly one dispatch of the consult unit in the call");
  const u = r1.units[0];
  eq([u.kind, u.agent_type, u.schema_path], ["doubt-consult", "general-purpose", ""], "doubt-consult units use general-purpose and an empty schema_path");
  ok(typeof u.token === "string" && u.token.length > 0, "token issued (the consult answer is verified with it)");
  for (let i = 0; i < 2; i++) {
    const r = await callNext(c);
    ok(!unitIds(r).includes("u-doubt-consult-d-1-c1"), `call ${i + 2} surfaced the consult unit again`);
  }
  eq((await dispatchedIds(c)).filter((x) => x === "u-doubt-consult-d-1-c1").length, 1, "one unit_dispatched event in total");
}));

// =====================================================================================================================
// Fencing
// =====================================================================================================================
await test("fence: a stale epoch is refused (FENCE) before anything happens: no state, journal, lease, admission or dispatch effect", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  const lease0 = await c.leaseNow();
  const stateBefore = await readFile(c.P.stateFile, "utf8");
  await rejectsWith(() => callNext(c, { epoch: c.epoch + 1 }, {}, { clean: false }), ["FENCE", "QUIESCED"], "next with an epoch that is not the lease's");
  eq(await readFile(c.P.stateFile, "utf8"), stateBefore, "state.json untouched");
  ok(!existsSync(c.P.journalFile) || (await c.events()).length === 0, "no journal event");
  eq((await c.leaseNow()).renewed_at, lease0.renewed_at, "a stale caller must not renew the lease");
  ok(!existsSync(c.P.admissionFile), "no admission reading or token");
  eq(c.log.filter((e) => e.mod === "units" || e.mod === "planner").length, 0, "no unit was prepared and the planner never ran");
}));

await test("fence: after a transfer (drive takeover) the old holder's epoch gets FENCE; the new holder's epoch works", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  const moved = await c.bs.transfer(c.root, { token: c.token, toRuntime: "codex", coordinator: "drive", epoch: c.epoch });
  await rejectsWith(() => callNext(c, { epoch: c.epoch }, {}, { clean: false }), ["FENCE", "QUIESCED"], "the loser of a transfer");
  ok(moved.epoch === c.epoch + 1, "precondition: the transfer bumped the epoch");
  const r = await callNext(c, { epoch: moved.epoch }, {}, { clean: false });
  ok(typeof r.action === "string", "the new holder gets an action");
}));

await test("fence: a quiesced lease refuses next (exit 3)", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  await c.bs.quiesce(c.root, c.token, c.epoch, { projectStatus: false });
  await rejectsWith(() => callNext(c, {}, {}, { clean: false }), ["FENCE", "QUIESCED"], "next on a quiesced lease");
  eq(c.log.filter((e) => e.mod === "units" || e.mod === "planner").length, 0, "nothing was planned or prepared");
}));

await test("fence: a missing or foreign lease-token file is refused", async () => withCase({ units: [B("WO-01-001")] }, async (c) => {
  await writeFile(c.P.tokenFile, `${JSON.stringify({ epoch: c.epoch, token: "f".repeat(48) })}\n`);
  await rejectsWith(() => callNext(c, {}, {}, { clean: false }), ["FENCE", "QUIESCED"], "next with a foreign token file");
}));

// ---- a missing module is one clear failure, not a crash --------------------------------------------------------------------
// =====================================================================================================================
// Judge-3 additions (RULINGS-D1): nested product root, static zones in planRound
//   ASSUMED INTERFACE: next calls planner.readPlanWorkOrders(root, {readFrd}) with root = state.integration.worktree (the PRODUCT root) and
//   readFrd(<frd id>) returning the FRD text at integration.base_sha (git show <base>:<prefix>docs/frds/...); then planner.plan(input) where
//   input.wos carries `zone`/`risk_rules`; zones come from risk.staticZones(wos, root, deps?) -> wos with zone/risk_rules.
// =====================================================================================================================
const planCapture = (c, readImpl) => {
  const captured = { reads: [], plans: [] };
  const base = makeDeps(c).planner;
  const planner = fake("planner", c.log, {
    plan: async (input, d) => { captured.plans.push(input); return base.plan(input, d); },
    readPlanWorkOrders: async (root, d) => { captured.reads.push({ root, deps: d }); return readImpl(root, d); },
  }, { strict: true });
  return { captured, planner };
};

await test("nested product root: the first next does not deadlock, reads the FRDs from the product root, and readFrd resolves the FRD at base_sha", async () => withCase({ nested: true, units: [B("WO-01-001"), B("WO-02-001")] }, async (c) => {
  const productRoot = path.join(c.P.integrationWorktree, "mission-control");
  const { captured, planner } = planCapture(c, async () => ({ wos: [], frds: [], frd_acs: {}, errors: [] }));
  const r = await callNext(c, {}, { planner });
  ok(r.action !== "deadlock", `first next in a nested project must not deadlock, got ${r.action}`);
  eq(r.action, "dispatch", "action");
  ok(captured.reads.length >= 1, "next must read the work orders through planner.readPlanWorkOrders");
  eq(path.resolve(captured.reads[0].root), path.resolve(productRoot), "readPlanWorkOrders root is the PRODUCT root (the prefix applied exactly once)");
  const readFrd = captured.reads[0].deps?.readFrd;
  ok(typeof readFrd === "function", "readPlanWorkOrders must receive deps.readFrd (FRD text at base_sha)");
  const text = await readFrd("frd-01-alpha");
  ok(typeof text === "string" && text.includes("AC-01-001.1"), `readFrd must return the FRD text at base_sha for a nested project (the repo-relative path carries the prefix); got ${JSON.stringify(text)?.slice(0, 80)}`);
}));

await test("planRound attaches static zones via risk.staticZones: only WOs that are neither VERIFIED nor already in a unit are classified; unit WOs reuse the unit's zone", async () => withCase({ units: [B("WO-01-002", { zone: "floor", risk_rules: ["R2"] }), B("WO-02-001")] }, async (c) => {
  const woRow = (id, frd, status, artifacts) => ({ id, frd, file: `${id}.md`, status, deps: [], artifacts, order: 0, reopen_count: 0, acs: [], source_change: [] });
  const read = { wos: [woRow("wo-01-001", "frd-01-alpha", "VERIFIED", ["src/alpha/list.ts"]), woRow("wo-01-002", "frd-01-alpha", "PLANNED", ["src/alpha/filter.ts"]), woRow("wo-02-001", "frd-02-beta", "PLANNED", ["src/beta/view.ts"]), woRow("wo-02-002", "frd-02-beta", "PLANNED", ["src/lib/auth/session.ts"])], frds: ["frd-01-alpha", "frd-02-beta"], frd_acs: {}, errors: [] };
  const { captured, planner } = planCapture(c, async () => structuredClone(read));
  const zoneCalls = [];
  const risk = fake("risk", c.log, {
    computeRisk: async () => c.riskResult,
    staticZones: async (wos) => { zoneCalls.push(wos.map((w) => w.id)); return wos.map((w) => ({ ...w, zone: w.artifacts?.some((a) => a.includes("auth")) ? "r1" : "none", risk_rules: w.artifacts?.some((a) => a.includes("auth")) ? ["R1"] : [] })); },
  });
  await callNext(c, {}, { planner, risk });
  ok(zoneCalls.length >= 1, "next.planRound must call risk.staticZones before planner.plan (NX-M2)");
  const asked = [...new Set(zoneCalls.flat().map((id) => String(id).toLowerCase()))].sort();
  eq(asked, ["wo-02-002"], "only the WO that is neither VERIFIED nor in a unit is classified (wo-02-001 is covered by its unit, wo-01-002 too, wo-01-001 is VERIFIED)");
  ok(captured.plans.length >= 1, "planner.plan was called");
  const wos = captured.plans[0].wos ?? captured.plans[0].workOrders;
  const byId = Object.fromEntries(wos.map((w) => [String(w.id).toLowerCase(), w]));
  eq(byId["wo-02-002"].zone, "r1", "the classified WO carries the static zone r1 into planner.plan");
  eq(byId["wo-01-002"].zone, "floor", "a WO already in a unit keeps that unit's zone");
  eq(byId["wo-01-002"].risk_rules, ["R2"], "and its risk_rules");
}));

await test("module: plugin/runtime/build/next.mjs exists and exports the scheduler entry point", async () => { await loadNext(); });

await test("DENG bootstrap exit 4 from a unit returns wait disk, requeues and releases admission", async () => withCase({ units: [B("WO-01-001")] }, async c => {
  const unit = (await c.readState()).units[0];
  const units = fake("units", c.log, { prepareUnitWorktree: async () => ({ worktree: c.P.unitWorktree(unit.id), branch: c.P.unitBranch(RUN, unit.id), bootstrap: { ran: true, exit: 4 } }) }, { strict: true });
  const r = await callNext(c, {}, { units });
  eq(r.action, "wait", "action"); eq(r.wait.reason, "disk", "reason"); eq(r.units, [], "no dispatch");
  eq((await stateUnit(c, unit.id)).state, "queued", "unit requeued"); eq((await stateUnit(c, unit.id)).attempt, 1, "no execution spent");
  const adm = JSON.parse(await readFile(c.P.admissionFile, "utf8")); ok(!adm.tokens?.[unit.id], "token released");
}));

await test("DENG integration bootstrap disk refusal waits before integration, never hands back", async () => withCase({ units: [B("WO-01-001")] }, async c => {
  await mkdir(path.join(c.P.integrationWorktree, ".pandacorp"), { recursive: true });
  await writeFile(path.join(c.P.integrationWorktree, ".pandacorp/worktree-bootstrap.sh"), "exit 4\n");
  const r = await callNext(c); eq(r.action, "wait", "action"); eq(r.wait.reason, "disk", "reason");
  eq((await c.readState()).handbacks_in_a_row, 0, "no env-infra handback"); eq(preparedIds(c), [], "no unit prepared");
}));

await test("DENG G2 bootstrap disk exit waits without gate verdict, patch or handback", async () => withCase({ units: [B("WO-01-001", { state: "integrated" })] }, async c => {
  const job = { id: "g2-disk", kind: "g2", unit: null, frd: "frd-01-alpha", pid: null, cwd: c.P.integrationWorktree, h_slot: true, started_at: NOW, state: "running", exit: null, worker_id: null };
  await c.writeState(s => ({ ...s, jobs: [job] }));
  const { G2_DISK_EXIT } = await import("../runtime/build/next/constants.mjs");
  await mkdir(c.P.jobDir(job.id), { recursive: true }); await writeFile(c.P.jobExitFile(job.id), `${G2_DISK_EXIT}\n`);
  const r = await callNext(c); eq(r.action, "wait", "action"); eq(r.wait.reason, "disk", "reason");
  const after = await c.readState(); eq(after.units[0].state, "integrated", "work unchanged"); eq(after.handbacks_in_a_row, 0, "no handback");
  ok(!after.units.some(u => u.kind === "patch"), "no patch"); ok(!(await c.events()).some(e => e.type === "gate"), "no verdict");
}));

await test("DENG blocked terminal reclaims integration while preserving its branch", async () => withCase({ nested: true, units: [B("WO-01-001", { state: "blocked" })] }, async c => {
  const r = await callNext(c); eq(r.action, "done", "blocked units are terminal");
  ok(!existsSync(c.P.integrationWorktree), "integration checkout reclaimed");
  ok(c.fx.git("for-each-ref", "--format=%(refname)", "refs/heads/").includes(c.P.integrationBranch(RUN)), "branch retained");
}));

restoreEnv();
await test("DFIX nested integration root resolves bootstrap and preserves wait disk", async () => withCase({ nested: true, units: [B("WO-01-001")] }, async c => {
  const s = await c.readState();
  await writeFile(path.join(s.integration.worktree, ".pandacorp/worktree-bootstrap.sh"), "exit 4\n");
  await c.writeState(state => { state.integration.worktree = c.P.integrationWorktree; });
  const r = await callNext(c);
  eq(r.action, "wait", "action"); eq(r.wait.reason, "disk", "nested bootstrap disk reason");
  eq(r.units, [], "nothing dispatched before bootstrap succeeds");
}));

// BL-0317: funko-tracker br-2026-11-13-02 re-ran a green G2 39 times at one sha. A docs unit is never reviewed, so a
// green G2 left it `integrated`, the FRD looked G2-ready again, and the queued review (with nothing to review) never ran.
const DOCS = (over = {}) => ({ id: "u-docs-x", kind: "docs", wos: [], frd: "frd-01-alpha", chain: null, state: "integrated", ...over });
await test("BL-0317 next: a docs-only FRD after a green G2 spawns no further G2 and settles its empty review (no endless loop)", async () => withCase({
  units: [DOCS(), { id: "u-patch-g3", kind: "patch", frd: null, wos: [], state: "blocked" }, R("frd-01-alpha", { state: "queued" })],
}, async (c) => {
  const r1 = await callNext(c);
  eq(r1.action, "wait", "the pass that settled the empty review waits (it does not stop the run)");
  const g2Spawns = c.log.filter((e) => e.mod === "jobs" && /g2/i.test(JSON.stringify(e.args)));
  eq(g2Spawns.length, 0, `no G2 job for a docs-only FRD (calls: ${g2Spawns.map((e) => e.fn).join(", ")})`);
  eq((await stateUnit(c, "u-review-frd-01-alpha")).state, "verified", "the review with nothing to review is settled");
  eq((await stateUnit(c, "u-docs-x")).state, "integrated", "the docs unit stays integrated (landable)");
  const r2 = await callNext(c);
  eq(c.log.filter((e) => e.mod === "jobs" && /g2/i.test(JSON.stringify(e.args))).length, 0, "a second pass still spawns no G2");
  ok(r2.action !== "dispatch" || !unitIds(r2).some((id) => id.startsWith("u-review")), "the review is never dispatched");
  eq(r2.action, "land", `the next pass lands the docs batch (got ${r2.action}: ${JSON.stringify(r2.notes_es)})`);
}));
await test("BL-0317 candidates: a queued FRD review WITH reviewable work is not settled (control)", async () => withCase({
  units: [B("WO-01-001", { state: "reviewing", worker: WORKER() }), DOCS(), R("frd-01-alpha", { state: "queued" })],
}, async (c) => {
  const { buildCandidates } = await import("../runtime/build/next/candidates.mjs");
  const state = await c.readState();
  const d = { env: c.env, routing: { reviewCell: () => ({ used: { runtime: "codex", model: "sol", effort: "high" } }) } };
  const out = await buildCandidates({ d, ref: { project: c.root, epoch: c.epoch, deps: d }, paths: c.P }, state, {}, { ready: [] }, {}, []);
  eq(out.list.map((x) => x.unit.id), ["u-review-frd-01-alpha"], "the review is dispatchable");
  eq((await stateUnit(c, "u-review-frd-01-alpha")).state, "queued", "not settled");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
