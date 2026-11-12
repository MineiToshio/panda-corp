// Detached long jobs of the v2 build engine (D5, D6, D7; PLAN 3.4, 3.16 A1 + A18).
// A job is a command that must outlive the CLI call that started it: the G2 gate run (`g2`) and the landing through
// merge-queue.sh (`land`). It is spawned detached through THIS file used as a small Node wrapper (`node jobs.mjs --wrap <jobDir>`),
// which writes `cmd.json` (before), `out.log` (the command's output) and `exit` (the exit code, atomically) in
// `.pandacorp/run/build/jobs/<job_id>/`. The job is recorded in `state.jobs[]` and harvested later by WHOEVER HOLDS THE CURRENT
// EPOCH (adoption after a transfer: nothing in a job item names an epoch or an owner process).
//   - `g2`: the wrapper takes a host heavy-job slot (admission.acquireHostSlot/waitHostSlot, pid = the wrapper's, kind `g2`)
//     before running the command and releases it when the command ends. `h_slot` is true only for `g2`.
//   - `land`: the wrapper takes NO slot; merge-queue.sh takes its own around verify.sh (A1).
//   - `worker` jobs (Codex workers) are not spawned here: workers.mjs owns `.pandacorp/run/codex-workers/<id>/`; this module only
//     polls that directory so one harvest pass covers every job of the run.
// A dead pid without an `exit` file is `dead` (never a guess of success). Nothing here kills a job except `stopJob`, which only
// the documented stop path (the owner's `stop`) calls; polling, harvesting and adoption never signal a process.
import { spawn as nodeSpawn } from "node:child_process";
import * as nodeFsp from "node:fs/promises";
import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitHostSlot } from "./admission.mjs";
import { atomicWriteJson, atomicWriteText, nowIso, readJson } from "./fsx.mjs";
import { assertSafeId, buildPaths } from "./paths.mjs";
import { fencedTwoPhase, readState, upsertJob, writeState } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Job kinds this module can spawn (`worker` jobs are spawned by workers.mjs). */
export const SPAWNABLE_KINDS = Object.freeze(["g2", "land"]);
/** First argv after the script path that switches this file into wrapper mode. */
export const WRAP_FLAG = "--wrap";
/** Absolute path of the wrapper entry (this file). */
export const JOBS_ENTRY = fileURLToPath(import.meta.url);

/** `kill -0` liveness; EPERM means the process exists (same rule as admission.mjs host slots). */
const defaultIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
};

// ---------------------------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------------------------

function newJobId(kind, frd, unit, deps) {
  const stamp = new Date(deps.clock ? deps.clock() : Date.now()).getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const label = String(frd ?? unit ?? "run").replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 60);
  return assertSafeId(`${kind}-${label}-${stamp}${rand}`, "job id");
}

/**
 * Spawn one detached job and return its `state.jobs[]` item (A18). Low level: it does NOT write state or the journal; a caller
 * that is already inside its own two-phase mutation records the item with `upsertJob` + a `job_started` event (data = the item).
 * `startJob` below does both under the fence.
 * @param {{project: string, kind: "g2"|"land", cmd: string[], cwd: string, unit?: string|null, frd?: string|null,
 *          jobId?: string, hMax?: number}} input `cmd` is argv (no shell); `cwd` is the directory the command runs in;
 *   `hMax` overrides the host slot count for a `g2` job (tests)
 * @param {{fs?: object, env?: object, homedir?: string, clock?: () => Date, spawn?: Function, execPath?: string}} [deps]
 * @returns {Promise<object>} the job item `{id, kind, unit, frd, pid, cwd, h_slot, started_at, state:"running", exit:null, worker_id:null}`
 * @throws USAGE for a bad input; INVALID_STATE when the job id already has a directory
 */
export async function spawnJob({ project, kind, cmd, cwd, unit = null, frd = null, jobId, hMax }, deps = {}) {
  if (!SPAWNABLE_KINDS.includes(kind)) throw err("USAGE", `spawnJob: kind must be ${SPAWNABLE_KINDS.join("|")}, got ${JSON.stringify(kind)}`);
  if (!Array.isArray(cmd) || cmd.length === 0 || cmd.some((a) => typeof a !== "string")) throw err("USAGE", "spawnJob: cmd must be a non-empty string array");
  if (typeof cwd !== "string" || !path.isAbsolute(cwd)) throw err("USAGE", "spawnJob: cwd must be an absolute path");
  const fs = deps.fs ?? nodeFsp;
  const paths = buildPaths(project, deps);
  const id = jobId ? assertSafeId(jobId, "job id") : newJobId(kind, frd, unit, deps);
  const dir = paths.jobDir(id);
  await fs.mkdir(paths.jobsDir, { recursive: true });
  try {
    await fs.mkdir(dir);
  } catch (e) {
    if (e.code === "EEXIST") throw err("INVALID_STATE", `job ${id} already exists`);
    throw e;
  }
  const startedAt = nowIso(deps);
  const hSlot = kind === "g2";
  await atomicWriteJson(paths.jobCmdFile(id), {
    job_id: id, kind, cmd, cwd, project: paths.project, unit, frd, h_slot: hSlot, ...(hSlot && hMax ? { h_max: hMax } : {}), started_at: startedAt,
  }, { fs: deps.fs });
  await atomicWriteText(paths.jobOutFile(id), "", { fs: deps.fs });
  const child = (deps.spawn ?? nodeSpawn)(deps.execPath ?? process.execPath, [JOBS_ENTRY, WRAP_FLAG, dir], {
    detached: true, stdio: "ignore", cwd: paths.project, env: deps.env ?? process.env,
  });
  // A spawn failure surfaces asynchronously; the job then has no live pid and no exit file, i.e. `dead`.
  child.on?.("error", () => {});
  child.unref?.();
  if (!Number.isInteger(child.pid)) throw err("ENGINE_FAILURE", `job ${id}: the wrapper process did not start`);
  return { id, kind, unit, frd, pid: child.pid, cwd, h_slot: hSlot, started_at: startedAt, state: "running", exit: null, worker_id: null };
}

/**
 * Spawn a job and record it, under the fence: phase 1 (mutex held) verifies the epoch, refuses a second live `land` job (drive never
 * spawns a landing while one is alive) or a second live `g2` job for the same FRD, spawns, upserts `state.jobs[]` and journals
 * `job_started`. The spawn happens under the mutex on purpose: a job is never left running without a state record.
 * @param {{project: string, epoch: number, actor?: "cli"|"drive"} & Parameters<typeof spawnJob>[0]} input
 * @param {object} [deps] as `spawnJob` plus `fencedTwoPhase` deps (`buildState`)
 * @returns {Promise<object>} the job item
 * @throws FENCE/QUIESCED (exit 3), INVALID_STATE when a conflicting job is alive
 */
export async function startJob({ epoch, actor = "cli", ...input }, deps = {}) {
  const { project, kind, frd = null } = input;
  return fencedTwoPhase({ project, epoch, actor, deps }, async (ctx) => {
    const state = await ctx.readState();
    for (const existing of state.jobs) {
      if (existing.state !== "running" || existing.kind !== kind) continue;
      if (kind === "g2" && existing.frd !== frd) continue;
      if ((await pollJob(project, existing, deps)).state !== "running") continue;
      throw err("INVALID_STATE", kind === "land" ? `a land job is already running (${existing.id})` : `a g2 job for ${frd} is already running (${existing.id})`);
    }
    const job = await spawnJob(input, deps);
    await ctx.writeState(upsertJob(state, job));
    await ctx.appendEvent({ type: "job_started", data: job });
    return job;
  }, async (intent) => intent);
}

// ---------------------------------------------------------------------------------------------
// Poll, harvest, adoption
// ---------------------------------------------------------------------------------------------

async function readExitFile(file, fs) {
  let text;
  try { text = await fs.readFile(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? { code: Number(trimmed) } : { code: null, bad: true };
}

/**
 * Current status of one job (read-only; never signals a process).
 * `done{exit}` when the exit file exists; `running` while the job's pid is alive; otherwise `dead` (the process is gone and left
 * no exit file, or an unreadable one: `reason` says which). A job already `done`/`dead` in state is returned unchanged.
 * `worker` jobs read `codex-workers/<worker_id>/exit` and `state.json`; their result is the sealed worker line, never this code.
 * @param {string} project absolute project root
 * @param {object} job a `state.jobs[]` item
 * @param {{fs?: object, isAlive?: (pid:number)=>boolean, env?: object, homedir?: string}} [deps]
 * @returns {Promise<{state: "running"|"done"|"dead", exit: number|null, pid: number|null, reason?: string}>}
 */
export async function pollJob(project, job, deps = {}) {
  if (job.state !== "running") return { state: job.state, exit: job.exit ?? null, pid: job.pid ?? null };
  const fs = deps.fs ?? nodeFsp;
  const isAlive = deps.isAlive ?? defaultIsAlive;
  const paths = buildPaths(project, deps);
  const isWorker = job.kind === "worker";
  const dir = isWorker ? paths.codexWorkerDir(job.worker_id) : paths.jobDir(job.id);
  const exitFile = isWorker ? path.join(dir, "exit") : paths.jobExitFile(job.id);
  const finished = (found) => (found.bad
    ? { state: "dead", exit: null, pid: job.pid ?? null, reason: "exit_unreadable" }
    : { state: "done", exit: found.code, pid: job.pid ?? null });
  const first = await readExitFile(exitFile, fs);
  if (first) return finished(first);
  let pid = job.pid ?? null;
  if (isWorker && !Number.isInteger(pid)) {
    const meta = await readJson(path.join(dir, "state.json"), { fs: deps.fs }).catch(() => null);
    pid = Number.isInteger(meta?.pid) ? meta.pid : null;
  }
  if (isAlive(pid)) return { state: "running", exit: null, pid };
  // The process may have written its exit file between the two checks.
  const second = await readExitFile(exitFile, fs);
  if (second) return finished(second);
  return { state: "dead", exit: null, pid, reason: pid === null ? "no_pid" : "pid_gone_without_exit" };
}

/**
 * Poll every `running` job of a list (read-only).
 * @returns {Promise<{job: object, poll: object}[]>} one entry per job that was `running`
 */
export async function pollJobs(project, jobs, deps = {}) {
  const running = jobs.filter((j) => j.state === "running");
  return Promise.all(running.map(async (job) => ({ job, poll: await pollJob(project, job, deps) })));
}

/**
 * Apply poll results to a state (pure): every polled job that is no longer `running` gets its new `state`/`exit`.
 * @returns {{state: object, finished: object[], events: {type: "job_finished", data: {id: string, state: string, exit: number|null}}[]}}
 */
export function applyJobPolls(state, polls) {
  const byId = new Map(polls.filter(({ poll }) => poll.state !== "running").map(({ job, poll }) => [job.id, poll]));
  const finished = [];
  const events = [];
  const jobs = state.jobs.map((job) => {
    const poll = byId.get(job.id);
    if (!poll || job.state !== "running") return job;
    const next = { ...job, state: poll.state, exit: poll.exit };
    finished.push(next);
    events.push({ type: "job_finished", data: { id: job.id, state: poll.state, exit: poll.exit } });
    return next;
  });
  return { state: { ...state, jobs }, finished, events };
}

/**
 * Harvest the jobs of the run as the current epoch holder: phase 1 verifies the fence (a holder that lost the epoch gets FENCE and
 * must not harvest), the polling runs outside the mutex, phase 2 re-reads the state under the mutex, records each finished job
 * (`done{exit}` or `dead`) and journals `job_finished`. This IS adoption: a job spawned under an older epoch (by the CLI, by drive,
 * by a previous session) is harvested by whoever holds the epoch now. Does not interpret results (G2/land/worker result handling
 * belongs to the callers) and never kills anything. `next` runs its own two-phase pass and uses `pollJobs` + `applyJobPolls` directly.
 * @param {{project: string, epoch: number, actor?: "cli"|"drive"}} ref
 * @param {object} [deps] `fs, isAlive, env, homedir, clock, buildState`
 * @returns {Promise<{finished: object[], running: object[]}>} `finished` = items now `done`/`dead`; `running` = items still alive
 */
export async function harvestJobs({ project, epoch, actor = "cli" }, deps = {}) {
  return fencedTwoPhase({ project, epoch, actor, deps }, async (ctx) => (await ctx.readState()).jobs.filter((j) => j.state === "running"),
    async (intent) => pollJobs(project, intent, deps),
    async (polls, _intent, ctx) => {
      const current = await ctx.readState();
      const { state, finished, events } = applyJobPolls(current, polls);
      if (finished.length > 0) {
        await ctx.writeState(state);
        for (const event of events) await ctx.appendEvent(event);
      }
      return { finished, running: state.jobs.filter((j) => j.state === "running") };
    });
}

/** Read-only convenience: the run's state with every running job's live status attached (for `status`). */
export async function describeJobs(project, deps = {}) {
  const state = await readState(project, deps);
  return Promise.all(state.jobs.map(async (job) => ({ ...job, poll: await pollJob(project, job, deps) })));
}

/**
 * Stop one job: SIGTERM to its process group (the wrapper is the group leader, so the command and its children go too). The ONLY
 * function in this module that signals a process; called solely by the documented stop path (the owner's `stop` / quiesce for
 * workers), never by poll, harvest or adoption.
 * @param {object} job a `state.jobs[]` item
 * @param {{kill?: (pid:number, sig:string)=>void}} [deps]
 * @returns {boolean} true when a signal was delivered
 */
export function stopJob(job, deps = {}) {
  if (!Number.isInteger(job.pid) || job.pid <= 0 || job.state !== "running") return false;
  try { (deps.kill ?? process.kill)(-job.pid, "SIGTERM"); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------------------------
// Wrapper process (`node jobs.mjs --wrap <jobDir>`): runs detached, outlives the parent
// ---------------------------------------------------------------------------------------------

const SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"];
const signalExitCode = (name) => 128 + (os.constants.signals[name] ?? 15);

/**
 * Body of the wrapper process. Reads `cmd.json`, waits for a host slot when `h_slot`, runs the command with its output appended
 * to `out.log`, writes the `exit` file (atomically, `<code>\n`; 128+n when the command died by signal n, 127 when it could
 * not start) and releases the slot. A termination signal received by the wrapper is forwarded to the command; the wrapper
 * still writes `exit` and releases the slot. `kill -9` of the wrapper leaves no exit file (poll: `dead`) and its slot is reclaimed
 * by the next acquirer because the owner pid is gone.
 * @param {string} jobDir absolute `build/jobs/<id>` directory
 * @param {{fs?: object, spawn?: Function, waitSlot?: Function}} [deps]
 * @returns {Promise<number>} the code written to the exit file
 */
export async function runJobWrapper(jobDir, deps = {}) {
  const fs = deps.fs ?? nodeFsp;
  const spec = JSON.parse(await fs.readFile(path.join(jobDir, "cmd.json"), "utf8"));
  const logFd = await fs.open(path.join(jobDir, "out.log"), "a");
  const log = (line) => logFd.appendFile(`[jobs] ${line}\n`).catch(() => {});
  let aborted = null;
  let child = null;
  const onSignal = (name) => { aborted = name; if (child) child.kill(name); };
  for (const name of SIGNALS) process.on(name, onSignal);
  let slot = null;
  let code = 127;
  try {
    if (spec.h_slot) {
      await log("waiting for a host heavy-job slot");
      const sleep = (ms) => new Promise((resolve, reject) => {
        const timer = setInterval(() => { if (aborted) { clearInterval(timer); reject(err("ABORTED", `terminated by ${aborted} while waiting for a slot`)); } }, 200);
        setTimeout(() => { clearInterval(timer); resolve(); }, ms);
      });
      slot = await (deps.waitSlot ?? waitHostSlot)({ kind: "g2", project: spec.project, pid: process.pid, sleep, ...(spec.h_max ? { max: spec.h_max } : {}) });
      await log(`host slot ${slot.index} taken`);
    }
    if (aborted) throw err("ABORTED", `terminated by ${aborted}`);
    code = await new Promise((resolve) => {
      try {
        child = (deps.spawn ?? nodeSpawn)(spec.cmd[0], spec.cmd.slice(1), { cwd: spec.cwd, stdio: ["ignore", logFd.fd, logFd.fd], env: process.env });
      } catch (e) { log(`cannot start: ${e.message}`).then(() => resolve(127)); return; }
      child.on("error", (e) => { log(`cannot start: ${e.message}`).then(() => resolve(127)); });
      child.on("close", (exitCode, signal) => resolve(exitCode ?? signalExitCode(signal)));
    });
  } catch (e) {
    await log(e.message);
    code = aborted ? signalExitCode(aborted) : 127;
  } finally {
    if (slot) slot.release();
    await atomicWriteText(path.join(jobDir, "exit"), `${code}\n`, { fs: deps.fs });
    await logFd.close().catch(() => {});
    for (const name of SIGNALS) process.off(name, onSignal);
  }
  return code;
}

const isMain = (() => {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(JOBS_ENTRY) && process.argv[2] === WRAP_FLAG; } catch { return false; }
})();
if (isMain) {
  const jobDir = process.argv[3];
  runJobWrapper(jobDir).then(() => process.exit(0), (e) => { process.stderr.write(`jobs wrapper failed: ${e.message}\n`); process.exit(70); });
}
