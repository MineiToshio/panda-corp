// `drive`: the Codex relay of the v2 build engine (BUILD-14; D10 as amended by PLAN 3.16 A9, A10, A21).
// A long-lived Node process of the same CLI with NO LLM of its own that never calls Claude (LESSON-0501).
//   - Armed by `start --run` / `start --resume` (lifecycle calls `armDrive`): detached standby, `caffeinate -i -w <pid>`.
//     Codex quota is NOT checked at arming; never armed when `codex login status` fails or, in a launched project,
//     the pre-push hook is not verified.
//   - Standby polls every `drive_poll_s`: (a) `build/handoff.json`; (b) Claude's usage-limit text in the run's
//     unit reports / worker output (or an optional transcript); (c) no lease renewal for `drive_silent_s` AND pending
//     work AND the last Claude reading >= `drive_trigger_c_min_pct` or unknown. It exits when the run is not `active`.
//   - Takeover = the same-run epoch `transfer` (build-state.mjs): epoch+1, new token file, no quiesce, workers and
//     jobs survive and are adopted, the previous holder is fenced (exit 3). Codex re-read at takeover: >= quota_stop
//     -> `paused-quota` (both resets_at, lease released) once nothing runs; otherwise the loop.
//   - Loop: the same `next` logic with coordinator `drive` (routing shape `drive`: builders Codex, Claude counted as
//     out, reviews degraded and queued for re-review, the security audit deferred to Claude opus high), `land`,
//     `finish`; the lease is renewed every iteration (that renewal is also how a resumed owner is detected: FENCE ->
//     the relay yields and exits cleanly). Only Codex units launched by the CLI (`via:"cli"`) are accepted.
// Everything time- or process-related is injected (clock, sleep, spawn, isAlive, exec) so tests run on fixture clocks.
// Sibling engine modules (next, land, finish, workers, failure) are injected by the dispatcher, never imported here.
import { execFile, spawn as nodeSpawn } from "node:child_process";
import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, readJson, validate, loadSchema } from "./fsx.mjs";
import { readJournal } from "./journal.mjs";
import { notifyOwner } from "./notify.mjs";
import { buildPaths } from "./paths.mjs";
import { classifyLimitText, effective, limitResetsAt, loadThresholds, readCodexQuota, readQuotaFile, resetsAtOf } from "./quota.mjs";
import { fencedTwoPhase, isTerminalUnit, readLeaseToken, readState } from "./state.mjs";
import { enqueueDeferred } from "./deferred.mjs";
import { restoreUnitWorktree } from "./units.mjs";
import { MODEL_STRENGTH } from "./routing.mjs";

// The owner's production-release token must never reach a spawned child (D1 guard).
const withoutReleaseOk = (env) => { const e = { ...env }; delete e.PANDACORP_OWNER_RELEASE_OK; return e; };

/** The CLI entry the standby process is spawned through (`node pandacorp-build.mjs drive --standby --run R`). */
export const CLI_ENTRY = fileURLToPath(new URL("../../scripts/pandacorp-build.mjs", import.meta.url));
const INSTALL_PRE_PUSH = new URL("../../scripts/install-pre-push.mjs", import.meta.url);
/** States of `build/drive/standby.json`. */
export const STANDBY_STATES = Object.freeze(["standby", "active", "stopped"]);
/** Why a takeover happened: (a) handoff file, (b) Claude limit text, (c) silent lease, `test` (`--handoff-after`), `direct` (`drive --run`). */
export const TRIGGERS = Object.freeze(["a", "b", "c", "test", "direct"]);
const TERMINAL_ACTIONS = new Set(["paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"]);
const IN_FLIGHT = new Set(["admitted", "running"]);
const LOG_ROTATE_BYTES = 5 * 1024 * 1024;
const STATE_ERRORS_BEFORE_EXIT = 10;
// The Codex hook adapter denies any shell command containing this word: nothing drive passes as an argument may carry it.
const FORBIDDEN_WORD = /claude/i;

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const isFenceError = (error) => error?.code === "FENCE" || error?.code === "QUIESCED";

// ------------------------------------------------------------------------------------------------ dependencies

const defaultIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
};

/**
 * Real process primitives, each replaceable. Sibling engine functions (`next`, `land`, `finish`, `workers`,
 * `engineFailure`, `deferAudit`, `engineDeps`) have no default: the dispatcher injects them.
 * @param {object} [overrides]
 * @returns {object} the deps object every function of this module takes as its LAST argument
 */
export function driveDeps(overrides = {}) {
  const env = overrides.env ?? process.env;
  const clock = typeof overrides.clock === "function" ? overrides.clock : null;
  return {
    env,
    platform: process.platform,
    pid: process.pid,
    execPath: process.execPath,
    // The engine clock: `PANDACORP_NOW` wins (as everywhere in the engine), then an injected `clock() -> Date`.
    now: () => (env.PANDACORP_NOW ? Date.parse(env.PANDACORP_NOW) : clock ? new Date(clock()).getTime() : Date.now()),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    spawn: nodeSpawn,
    isAlive: defaultIsAlive,
    exec: envExec(env),
    // An injected `exec` also runs `osascript` (notify.mjs); otherwise notify uses its own runner with a timeout.
    notifyExec: overrides.notifyExec ?? overrides.exec ?? null,
    buildState: null,
    maxPolls: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

// `execFile` with the drive's own env (the fake codex of the tests reads its switches from it); never rejects.
const envExec = (env) => (cmd, args, { cwd } = {}) => new Promise((resolve) => {
  execFile(cmd, args, { cwd, env, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
    resolve({ code: error ? (typeof error.code === "number" ? error.code : 127) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
  });
});

/**
 * The quota thresholds drive uses, with the `PANDACORP_DRIVE_POLL_S` test hook (a positive number of seconds) replacing
 * `drive_poll_s` for the standby and loop polls (default 30 s from the thresholds file).
 */
const limitsOf = (d) => {
  const limits = loadThresholds({ thresholds: d.thresholds });
  const poll = Number(d.env?.PANDACORP_DRIVE_POLL_S);
  return Number.isFinite(poll) && poll > 0 ? { ...limits, drive_poll_s: poll } : limits;
};

const withDefaults = (deps) => (deps?.__drive ? deps : { ...driveDeps(deps ?? {}), __drive: true });
const nowMs = (d) => d.now();
const isoAt = (ms) => new Date(ms).toISOString();
const buildStateOf = async (d) => d.buildState ?? import("../build-state.mjs");
const pathsOf = (project, d) => buildPaths(project, { env: d.env, homedir: d.homedir });
const stateDeps = (d, bs) => ({ env: d.env, homedir: d.homedir, buildState: bs });

/**
 * Throw when any argument drive builds carries the forbidden word (the Codex hook adapter would deny the command).
 * The executable and the entry-script path are environmental and are not passed here; ids, flags and values are.
 * @param {string[]} args
 * @param {string} [label]
 * @throws FORBIDDEN_WORD
 */
export function assertNoForbiddenWord(args, label = "argv") {
  for (const arg of args) {
    if (FORBIDDEN_WORD.test(String(arg))) throw err("FORBIDDEN_WORD", `${label} carries a word the Codex hook adapter denies`);
  }
}

// ------------------------------------------------------------------------------------------------------- log

/**
 * Append one line to `build/drive/drive.log` (rotated to `drive.log.1` at 5 MB). Never throws.
 * @param {string} project
 * @param {string} line
 * @param {object} [deps]
 */
export function driveLog(project, line, deps) {
  const d = withDefaults(deps);
  if (typeof d.log === "function") { d.log(line); return; }
  try {
    const file = pathsOf(project, d).driveLogFile;
    nodeFs.mkdirSync(path.dirname(file), { recursive: true });
    try { if (nodeFs.statSync(file).size >= LOG_ROTATE_BYTES) nodeFs.renameSync(file, `${file}.1`); } catch { /* no log yet */ }
    nodeFs.appendFileSync(file, `${isoAt(nowMs(d))} ${line}\n`, { mode: 0o600 });
  } catch { /* logging must never break the relay */ }
}

const say = async (event, data, d) => {
  try {
    if (typeof d.notify === "function") return await d.notify(event, data);
    return await notifyOwner(event, data, { env: d.env, platform: d.platform, ...(typeof d.notifyExec === "function" ? { exec: d.notifyExec } : {}) });
  } catch (error) {
    return { sent: false, reason: error.message };
  }
};

// --------------------------------------------------------------------------------------------- standby file

/**
 * Read `build/drive/standby.json` (`{pid, armed_at, run_id, state}`); null when absent or unreadable.
 * @param {string} project
 * @param {object} [deps]
 */
export async function readStandby(project, deps) {
  const d = withDefaults(deps);
  try { return await readJson(pathsOf(project, d).driveStandbyFile); } catch { return null; }
}

/**
 * Is the drive standby alive (pid alive and `state: standby`, optionally of `runId`)? The `driveAlive` input of
 * `quota.policy` (A11): `next` returns `handoff` only when this is true.
 * @param {string} project
 * @param {{runId?: string}} [opts]
 * @param {object} [deps] `isAlive`
 * @returns {Promise<boolean>}
 */
export async function isStandbyAlive(project, { runId } = {}, deps) {
  const d = withDefaults(deps);
  const standby = await readStandby(project, d);
  if (!standby || standby.state !== "standby") return false;
  if (runId && standby.run_id !== runId) return false;
  return Boolean(d.isAlive(standby.pid));
}

const writeStandby = (project, value, d) => atomicWriteJson(pathsOf(project, d).driveStandbyFile, value);

// Only the process named in standby.json may change it (a re-armed standby must not be clobbered by an old drive).
async function setOwnStandbyState(project, state, d) {
  const current = await readStandby(project, d);
  if (current && current.pid !== d.pid) return false;
  await writeStandby(project, { pid: d.pid, armed_at: current?.armed_at ?? isoAt(nowMs(d)), run_id: current?.run_id ?? null, state }, d);
  return true;
}

// ---------------------------------------------------------------------------------------------- keep awake

/**
 * Keep the Mac awake while `pid` lives (`caffeinate -i -w <pid>`); writes `build/drive/caffeinate.pid`.
 * Off macOS (or when `deps.keepAwake` is injected) it does nothing of its own.
 * @param {string} project
 * @param {number} pid
 * @param {object} [deps] `keepAwake(pid) -> {pid}|null` replaces the real call
 * @returns {Promise<{pid: number|null}>}
 */
export async function keepAwake(project, pid, deps) {
  const d = withDefaults(deps);
  let child = null;
  if (typeof d.keepAwake === "function") {
    child = await d.keepAwake(pid);
  } else if (d.platform === "darwin") {
    const args = ["-i", "-w", String(pid)];
    assertNoForbiddenWord(args, "caffeinate argv");
    const proc = d.spawn("caffeinate", args, { detached: true, stdio: "ignore" });
    proc.unref?.();
    child = { pid: proc.pid ?? null };
  }
  const caffeinatePid = child?.pid ?? null;
  if (caffeinatePid) {
    const file = pathsOf(project, d).driveCaffeinatePidFile;
    nodeFs.mkdirSync(path.dirname(file), { recursive: true });
    nodeFs.writeFileSync(file, `${caffeinatePid}\n`, { mode: 0o600 });
  }
  return { pid: caffeinatePid };
}

// -------------------------------------------------------------------------------------------------- arming

/** The argument list of the standby process (after the entry script). */
export function standbyArgs(runId, { transcript } = {}) {
  const args = ["drive", "--standby", "--run", String(runId)];
  if (transcript) args.push("--transcript", String(transcript));
  return args;
}

/**
 * Arm the relay in standby (called by `start --run` and `start --resume`, inside their own flow).
 * Codex quota is not checked. Not arming is never an error: `{armed:false, reason}`.
 * Reasons: `codex_login_failed` (`codex login status` failed), `prepush_not_verified` (launched project whose
 * pre-push hook `--check` is not exit 0), `spawn_failed`.
 * An alive standby of the same run is reused; a stale standby.json (dead pid) is replaced.
 * @param {{project: string, runId: string, launched?: boolean, transcript?: string|null, appendEvent?: Function}} input
 *   `appendEvent` (optional): the caller's fenced journal append; called with `{type:"drive_armed", data}`
 * @param {object} [deps] `exec` (codex login), `prePushCheck(project) -> {code}`, `spawn`, `isAlive`, `execPath`, `env`
 * @returns {Promise<{armed: boolean, pid: number|null, reason: string|null}>}
 */
export async function armDrive({ project, runId, launched, transcript = null, appendEvent } = {}, deps) {
  const d = withDefaults(deps);
  if (!project || !runId) throw err("USAGE", "armDrive needs project and runId");
  const paths = pathsOf(project, d);

  const existing = await readStandby(project, d);
  if (existing && existing.run_id === runId && existing.state === "standby" && d.isAlive(existing.pid)) {
    return { armed: true, pid: existing.pid, reason: null };
  }

  const codexBin = d.env.PANDACORP_CODEX_BIN || "codex";
  const loginArgs = ["login", "status"];
  assertNoForbiddenWord(loginArgs, "codex login argv");
  let login;
  try { login = await d.exec(codexBin, loginArgs, { cwd: project }); } catch (error) { login = { code: 1, stderr: error.message }; }
  if (login?.code !== 0) return { armed: false, pid: null, reason: "codex_login_failed" };

  if (launched ?? await isLaunchedProject(project, d)) {
    let check;
    try {
      check = typeof d.prePushCheck === "function"
        ? await d.prePushCheck(project)
        : (await import(INSTALL_PRE_PUSH.href)).installPrePush({ project, check: true });
    } catch (error) { check = { code: 1, message: error.message }; }
    if (check?.code !== 0) return { armed: false, pid: null, reason: "prepush_not_verified" };
  }

  let usableTranscript = transcript;
  if (transcript && FORBIDDEN_WORD.test(String(transcript))) {
    usableTranscript = null; // trigger (b) then reads unit and worker output only
    driveLog(project, "arm: transcript path dropped (it carries a word the Codex hook adapter denies)", d);
  }
  const args = standbyArgs(runId, { transcript: usableTranscript });
  assertNoForbiddenWord(args, "drive argv");

  let child;
  try {
    nodeFs.mkdirSync(paths.driveDir, { recursive: true });
    const fd = nodeFs.openSync(paths.driveLogFile, "a", 0o600);
    try {
      // cwd = project: the CLI resolves the project from it, so no project path travels in argv.
      child = d.spawn(d.execPath, [CLI_ENTRY, ...args], { cwd: project, detached: true, stdio: ["ignore", fd, fd], env: withoutReleaseOk(d.env) });
    } finally {
      nodeFs.closeSync(fd);
    }
    child.unref?.();
  } catch (error) {
    driveLog(project, `arm: spawn failed: ${error.message}`, d);
    return { armed: false, pid: null, reason: "spawn_failed" };
  }
  const pid = Number.isInteger(child?.pid) ? child.pid : null;
  if (!pid) return { armed: false, pid: null, reason: "spawn_failed" };

  await writeStandby(project, { pid, armed_at: isoAt(nowMs(d)), run_id: runId, state: "standby" }, d);
  driveLog(project, `armed: standby pid ${pid} for ${runId}`, d);
  if (typeof appendEvent === "function") await appendEvent({ type: "drive_armed", data: { pid, run_id: runId } });
  return { armed: true, pid, reason: null };
}

// Launched = detect.mjs `signals.launched` (the one implementation of the rule). Anything detect cannot read counts as
// launched: the pre-push hook is then required (fail closed).
async function isLaunchedProject(project, d) {
  try {
    const { detect } = await import("./detect.mjs");
    return (await detect({ project }, { env: d.env, homedir: d.homedir })).signals?.launched === true;
  } catch { return true; }
}

// ----------------------------------------------------------------------------------------------- triggers

const pendingWork = (state) => state.units.some((u) => !isTerminalUnit(u)) || state.jobs.some((j) => j.state === "running");
const anyRunning = (state) => state.units.some((u) => IN_FLIGHT.has(u.state)) || state.jobs.some((j) => j.state === "running");
const readText = (file) => { try { return nodeFs.readFileSync(file, "utf8"); } catch { return null; } };

async function readHandoff(paths, runId) {
  let value;
  try { value = await readJson(paths.handoffFile); } catch { return { file: true, valid: false }; }
  if (!value) return null;
  const check = validate(await loadSchema("handoff"), value);
  if (!check.ok || value.run_id !== runId) return { file: true, valid: false, value };
  return { file: true, valid: true, value };
}

// Trigger (b) (DEC-3): Claude's usage-limit text only. Codex's own limit is quota.policy's business (R3), never a
// reason to take a run from the session. Sources: the report of an in-flight unit a Claude agent or session is
// writing, a worker output of THIS run (state units/jobs) that carries Claude's envelope (`usage limit reached|<ts>`),
// and the optional transcript.
const limitHit = (file) => { const text = readText(file); return Boolean(text) && classifyLimitText(text) === "usage_limit"; };
const claudeEnvelope = (file) => Boolean(limitResetsAt(readText(file) ?? ""));

function claudeLimitSeen(project, state, transcript, d) {
  const paths = pathsOf(project, d);
  for (const unit of state.units) {
    if (!IN_FLIGHT.has(unit.state)) continue;
    const w = unit.worker;
    const byClaude = w && (w.runtime === "claude" || w.via === "agent" || w.via === "session");
    if (byClaude && limitHit(paths.reportFile(unit.id))) return `report ${unit.id}`;
  }
  const workerIds = new Set([...state.units.map((u) => u.worker?.worker_id), ...state.jobs.map((j) => j.worker_id)].filter((id) => typeof id === "string" && id));
  for (const id of workerIds) {
    let file;
    try { file = path.join(paths.codexWorkerDir(id), "last.md"); } catch { continue; }
    if (claudeEnvelope(file)) return `worker ${id}`;
  }
  if (transcript && limitHit(transcript)) return "transcript";
  return null;
}

async function committedCount(paths) {
  try {
    const { events } = await readJournal(paths.journalFile);
    return events.filter((e) => e.type === "wo_committed").length;
  } catch { return 0; }
}

/**
 * One standby poll: should the relay take over, keep waiting, or leave?
 * @param {{project: string, runId: string, transcript?: string|null, handoffAfter?: number|null}} input
 * @param {object} [deps] `now`, `buildState`, `thresholds`, `pid`
 * @returns {Promise<{trigger: string|null, exit: string|null, detail: string|null}>}
 *   exit reasons: `run_not_active`, `run_changed`, `no_lease`, `drive_active`, `replaced`
 */
export async function checkTriggers({ project, runId, transcript = null, handoffAfter = null }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  const paths = pathsOf(project, d);
  const limits = limitsOf(d);
  const none = { trigger: null, exit: null, detail: null };

  const state = await readState(project, { env: d.env, homedir: d.homedir });
  if (!state) return { ...none, exit: "run_not_active", detail: "no state.json" };
  if (state.run_id !== runId) return { ...none, exit: "run_changed", detail: state.run_id };
  if (state.status !== "active") return { ...none, exit: "run_not_active", detail: state.status };

  const standby = await readStandby(project, d);
  if (standby && standby.pid !== d.pid && d.isAlive(standby.pid)) return { ...none, exit: "replaced", detail: String(standby.pid) };

  const lease = await bs.currentLease(project);
  if (!lease) return { ...none, exit: "no_lease", detail: null };
  if (lease.run_id !== runId) return { ...none, exit: "run_changed", detail: lease.run_id };
  const now = nowMs(d);
  const silentMs = now - Date.parse(lease.renewed_at);
  const silent = Number.isFinite(silentMs) && silentMs >= limits.drive_silent_s * 1000;
  if (lease.coordinator === "drive" && !silent) return { ...none, exit: "drive_active", detail: `epoch ${lease.epoch}` };

  // (a) handoff file of this run, requested from the current epoch.
  const handoff = await readHandoff(paths, runId);
  if (handoff?.valid) {
    if (handoff.value.from_epoch === lease.epoch) return { ...none, trigger: "a", detail: handoff.value.reason };
    driveLog(project, `standby: stale handoff from epoch ${handoff.value.from_epoch} (lease epoch ${lease.epoch}) ignored`, d);
    try { nodeFs.renameSync(paths.handoffFile, paths.handoffConsumedFile(handoff.value.from_epoch)); } catch { /* raced */ }
  } else if (handoff?.file && handoff.valid === false) {
    driveLog(project, "standby: invalid handoff.json ignored", d);
  }

  // (b) Claude's usage-limit text in the run's output.
  const seen = claudeLimitSeen(project, state, transcript, d);
  if (seen) return { ...none, trigger: "b", detail: seen };

  // Test-only: the session "hands off" after N committed WOs (`--handoff-after N`).
  if (Number.isInteger(handoffAfter) && handoffAfter >= 0 && (await committedCount(paths)) >= handoffAfter) {
    return { ...none, trigger: "test", detail: `handoff-after ${handoffAfter}` };
  }

  // (c) silent lease AND pending work AND Claude >= drive_trigger_c_min_pct or unknown (A21).
  if (silent && pendingWork(state)) {
    let claude = { pct: null, state: "unknown" };
    try { claude = effective(readQuotaFile(paths.quotaFile).claude, now, { thresholds: limits }); } catch { /* unreadable = unknown */ }
    if (claude.state === "unknown" || claude.pct >= limits.drive_trigger_c_min_pct) {
      return { ...none, trigger: "c", detail: `silent ${Math.round(silentMs / 1000)} s, claude ${claude.state === "known" ? `${claude.pct} %` : "unknown"}` };
    }
  }
  return none;
}

// ------------------------------------------------------------------------------------------------ takeover

function codexAtTakeover(project, now, limits, d) {
  const paths = pathsOf(project, d);
  let stored = null;
  try { stored = readQuotaFile(paths.quotaFile).codex; } catch { /* corrupt store: rely on the rollout */ }
  let fresh = null;
  try { fresh = typeof d.readCodexQuota === "function" ? d.readCodexQuota() : readCodexQuota({ now }, { env: d.env }); } catch { /* unknown */ }
  const options = { thresholds: limits };
  const candidates = [fresh, stored].map((reading) => ({ reading, eff: effective(reading, now, options) })).filter((c) => c.eff.state === "known");
  if (!candidates.length) return { eff: { pct: null, state: "unknown" }, reading: fresh ?? stored };
  candidates.sort((x, y) => y.eff.pct - x.eff.pct);
  return candidates[0];
}

/**
 * Take the run over: re-read Codex quota, `transfer` (A10), set `state.coordinator = "drive"`, requeue the units a
 * Claude agent or session was writing (their late reports are fenced out), journal `drive_takeover`, and either
 * stop at `paused-quota` (Codex >= quota_stop and nothing running: both resets_at, lease released) or hand back to
 * the loop. Never quiesces a running run, never stops workers.
 * @param {{project: string, runId: string, trigger: string, detail?: string|null}} input
 * @param {object} [deps]
 * @returns {Promise<{outcome: "loop"|"paused-quota"|"retry", epoch: number|null, codex: object, requeued: string[]}>}
 */
export async function takeOver({ project, runId, trigger, detail = null }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  const paths = pathsOf(project, d);
  const limits = limitsOf(d);
  const now = nowMs(d);

  const lease = await bs.currentLease(project);
  let held = null;
  try { held = await readJson(paths.tokenFile); } catch { /* unreadable */ }
  if (!lease || lease.run_id !== runId || !held || typeof held.token !== "string" || held.epoch !== lease.epoch) {
    driveLog(project, "takeover: lease and token file disagree, retrying at the next poll", d);
    return { outcome: "retry", epoch: null, codex: null, requeued: [] };
  }

  const codex = codexAtTakeover(project, now, limits, d);
  let claude = { pct: null, state: "unknown" };
  let claudeReading = null;
  try { claudeReading = readQuotaFile(paths.quotaFile).claude; claude = effective(claudeReading, now, { thresholds: limits }); } catch { /* unknown */ }
  const codexOut = codex.eff.state === "known" && codex.eff.pct >= limits.quota_stop;

  let moved;
  try {
    moved = await bs.transfer(project, { token: held.token, toRuntime: "codex", coordinator: "drive", epoch: lease.epoch });
  } catch (error) {
    if (!isFenceError(error)) throw error;
    driveLog(project, `takeover: transfer fenced (${error.message}), retrying at the next poll`, d);
    return { outcome: "retry", epoch: null, codex: codex.eff, requeued: [] };
  }
  const { epoch } = moved;
  try { nodeFs.renameSync(paths.handoffFile, paths.handoffConsumedFile(epoch)); } catch { /* no handoff file */ }
  await setOwnStandbyState(project, "active", d);

  const resets = { claude: resetsAtOf(claudeReading), codex: resetsAtOf(codex.reading) };
  // From here drive holds the lease: a failure must carry the epoch so the failure path can release it.
  const intent = await withEpoch(epoch, () => fencedTwoPhase({ project, epoch, actor: "drive", deps: stateDeps(d, bs) }, undefined, undefined, async (_result, _intent, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "state.json disappeared during takeover");
    const requeued = [];
    const units = [];
    for (const unit of state.units) {
      const byClaude = unit.worker && (unit.worker.via === "agent" || unit.worker.via === "session");
      if (!IN_FLIGHT.has(unit.state) || !byClaude) { units.push(unit); continue; }
      requeued.push({ unit: unit.id, from: unit.state, token_hash: unit.token_hash, worktree: unit.worktree ?? null, attempt: unit.attempt, parked: unit.parked ?? null, pending_answer: unit.pending_answer ?? null });
      units.push({ ...unit, state: "queued", token_hash: null, worker: null });
    }
    const next = { ...state, units, coordinator: "drive" };
    for (const r of requeued) await ctx.appendEvent({ type: "unit_state", data: { unit: r.unit, from: r.from, to: "queued", reason: "drive_takeover" } });
    await ctx.appendEvent({
      type: "drive_takeover",
      data: { trigger, detail, from_epoch: lease.epoch, to_epoch: epoch, codex: codex.eff, claude, requeued: requeued.map((r) => r.unit) },
    });
    const pause = codexOut && !anyRunning(next);
    if (pause) {
      next.status = "paused";
      next.status_reason = "paused-quota";
      await ctx.appendEvent({ type: "paused", data: { reason: "paused-quota", resets_at: resets } });
    }
    await ctx.writeState(next);
    return { pause, requeued };
  }));

  if (intent.requeued.length) await releaseRequeuedTokens(project, intent.requeued, d);
  // Same attempt, new dispatch: the Claude dispatch's output can never be accepted (its token is released, its late
  // report fenced), so neither its uncommitted edits nor the engine commit of a report fenced before phase 2 may reach
  // drive's worker on that branch (it would be rejected as "the worker committed" and charged an attempt). Done
  // before drive's first dispatch; drive is the only coordinator from here.
  for (const r of intent.requeued) await restoreRequeued(project, runId, { id: r.unit, worktree: r.worktree, attempt: r.attempt, parked: r.parked, pending_answer: r.pending_answer }, d);
  const requeued = intent.requeued.map((r) => r.unit);
  driveLog(project, `takeover: trigger ${trigger}${detail ? ` (${detail})` : ""}, epoch ${lease.epoch} -> ${epoch}, codex ${codex.eff.state === "known" ? `${codex.eff.pct} %` : "unknown"}${requeued.length ? `, requeued ${requeued.join(",")}` : ""}`, d);

  if (intent.pause) {
    await withEpoch(epoch, async () => {
      await bs.quiesce(project, moved.token, epoch, { projectStatus: false });
      await bs.finalizeRelease(project, moved.token, epoch);
    });
    driveLog(project, "takeover: Codex at the stop threshold, run paused (paused-quota), lease released", d);
    await say("paused-quota", { project, resets: resets.codex ?? resets.claude ?? null }, d);
    return { outcome: "paused-quota", epoch, codex: codex.eff, requeued };
  }
  await say("takeover", { project }, d);
  return { outcome: "loop", epoch, codex: codex.eff, requeued };
}

/** Restore the worktree of a unit requeued by the takeover (units.restoreUnitWorktree); the outcome goes to drive.log. */
async function restoreRequeued(project, runId, unit, d) {
  const p = pathsOf(project, d);
  const base = unit.parked === "built_on_assumption" && unit.pending_answer ? p.assumeBranch(runId, unit.pending_answer) : undefined;
  try {
    const reset = await restoreUnitWorktree({ project, runId, unit, base }, { exec: d.exec, env: d.env });
    if (reset.reset) driveLog(project, `takeover: worktree of ${unit.id} restored (${reset.discarded_commits} commit(s) discarded, dirty ${reset.dirty}, head was ${reset.head})`, d);
  } catch (error) {
    driveLog(project, `takeover: worktree of ${unit.id} NOT restored: ${error.message}`, d);
  }
}

const withEpoch = async (epoch, fn) => {
  try { return await fn(); } catch (error) {
    if (error && typeof error === "object" && error.epoch === undefined) error.epoch = epoch;
    throw error;
  }
};

// A requeued unit's admission reservation is void (it gets a new token at its next dispatch).
async function releaseRequeuedTokens(project, requeued, d) {
  try {
    const admission = d.admission ?? (await import("./admission.mjs"));
    const file = pathsOf(project, d).admissionFile;
    for (const r of requeued) admission.releaseToken(r.unit, { file });
  } catch (error) {
    driveLog(project, `takeover: admission token release failed: ${error.message}`, d);
  }
}

// ---------------------------------------------------------------------------------------------------- loop

// Workers facade handed to `next`: drive launches Codex workers only, and nothing it passes carries the forbidden word.
function codexOnlyWorkers(workers) {
  if (!workers) return workers;
  const guard = (input) => {
    const cell = input?.cell ?? {};
    if (cell.runtime !== undefined && cell.runtime !== "codex") throw err("ENGINE_FAILURE", `drive refused a ${cell.runtime} worker`);
    assertNoForbiddenWord([cell.model, cell.effort, input?.modelSlug, input?.model_slug, input?.unit, input?.workerId].filter((v) => v != null), "worker argv");
  };
  return new Proxy(workers, {
    get(target, prop) {
      const value = target[prop];
      if (prop === "launchWorker" && typeof value === "function") return (input, deps) => { guard(input); return value.call(target, input, deps); };
      return value;
    },
  });
}

// A land job counts as alive while it is recorded running and its pid (when known) is alive.
const landJobAlive = (state, d) => state.jobs.some((j) => j.kind === "land" && j.state === "running" && (!Number.isInteger(j.pid) || d.isAlive(j.pid)));

const STRENGTH = MODEL_STRENGTH;
const SCHEMA_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);

/**
 * Default deferral of a security audit that reached drive (BUILD-14: never run under drive): append a pending
 * `deferred-reviews.json` entry for Claude (opus high, `degraded: quota_90`), mark the audit unit `verified` as a
 * review-type terminal (its real verdict comes from the deferred re-review) and journal it, all under drive's epoch.
 * @param {{project: string, epoch: number, unit: object}} input `unit` = the dispatch cell `next` returned
 * @param {object} [deps]
 * @returns {Promise<{entry: object}>}
 */
export async function deferAuditUnit({ project, epoch, unit }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  return fencedTwoPhase({ project, epoch, actor: "drive", deps: stateDeps(d, bs) }, undefined, undefined, async (_r, _i, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no state.json");
    const record = state.units.find((u) => u.id === unit.unit) ?? null;
    const authors = state.units.map((u) => u.worker).filter((w) => w && ["claude", "codex"].includes(w.runtime) && STRENGTH[w.model]);
    const strongest = authors.reduce((best, a) => (!best || STRENGTH[a.model] > STRENGTH[best.model] ? a : best), null);
    // Without a recorded builder the author is drive's own column (Codex); the ledger requires one.
    const author = strongest
      ? { runtime: strongest.runtime, model: strongest.model, effort: SCHEMA_EFFORTS.has(strongest.effort) ? strongest.effort : "high" }
      : { runtime: "codex", model: "sol", effort: "high" };
    const base = state.integration?.base_sha ?? "HEAD";
    const { entry } = await enqueueDeferred(project, {
      unit: unit.unit, kind: "audit", frd: record?.frd ?? unit.frd ?? null, sha_range: `${base}..${pathsOf(project, d).integrationBranch(state.run_id)}`,
      author, reviewer_used: null, degraded: "quota_90", needed: "claude",
    }, { env: d.env, homedir: d.homedir, clock: () => new Date(nowMs(d)) });
    await ctx.appendEvent({ type: "deferred_review_queued", data: { id: entry.id, unit: unit.unit, frd: entry.frd, needed: "claude", degraded: "quota_90", reviewer_used: null } });
    if (record && !isTerminalUnit(record)) {
      await ctx.appendEvent({ type: "unit_state", data: { unit: record.id, from: record.state, to: "verified", reason: "audit_deferred_to_claude" } });
      await ctx.writeState({ ...state, units: state.units.map((u) => (u.id === record.id ? { ...u, state: "verified", token_hash: null, worker: null } : u)) });
    }
    return { entry };
  });
}

/**
 * The active relay loop for the run at `epoch` (drive holds the lease). Ends at a terminal action (already applied by
 * `next`), `done` (then `finish`), a fence (the owner resumed: yield, exit 0) or an engine failure (exit 8).
 * @param {{project: string, epoch: number}} input
 * @param {object} deps must carry `next`, `land`, `finish`; optional `workers`, `engineDeps`, `engineFailure`, `deferAudit`
 * @returns {Promise<{outcome: string, action: string|null, exitCode: number}>}
 */
export async function driveLoop({ project, epoch }, deps) {
  const d = withDefaults(deps);
  const deferAudit = typeof d.deferAudit === "function" ? d.deferAudit : (input) => deferAuditUnit(input, d);
  for (const name of ["next", "land", "finish"]) if (typeof d[name] !== "function") throw err("USAGE", `drive loop needs deps.${name}`);
  const bs = await buildStateOf(d);
  const limits = limitsOf(d);
  const pollMs = limits.drive_poll_s * 1000;
  const engineDeps = { ...(d.engineDeps ?? {}), ...(d.workers ? { workers: codexOnlyWorkers(d.workers) } : {}) };
  const ref = { project, epoch, actor: "drive", coordinator: "drive" };

  for (let i = 0; i < d.maxPolls; i++) {
    let out;
    try {
      // Renewing first is also how a resumed owner is noticed: the token file now names another epoch -> FENCE.
      const token = await readLeaseToken(project, epoch, { env: d.env, homedir: d.homedir });
      await bs.renew(project, token, epoch, { projectStatus: false });
      out = await d.next({ ...ref, wait: 0 }, engineDeps);
      for (const line of out?.notes_es ?? []) driveLog(project, `next: ${line}`, d);

      switch (out?.action) {
        case "dispatch": {
          for (const unit of out.units ?? []) {
            if (unit.runtime === "codex" && unit.via === "cli") { driveLog(project, `dispatch: ${unit.unit} ${unit.kind} codex ${unit.model} ${unit.effort}`, d); continue; }
            if (unit.kind === "audit") {
              await deferAudit({ ...ref, unit }, engineDeps);
              driveLog(project, `dispatch: security audit ${unit.unit} deferred to a Claude re-review (opus high)`, d);
              continue;
            }
            throw err("ENGINE_FAILURE", `next returned a ${unit.runtime}/${unit.via} unit (${unit.unit}) to drive, which runs Codex only`);
          }
          break;
        }
        case "wait":
          await d.sleep(Math.min(pollMs, Math.max(1000, (out.wait?.retry_after_s ?? limits.drive_poll_s) * 1000)));
          break;
        case "land": {
          const state = await readState(project, { env: d.env, homedir: d.homedir });
          if (state && landJobAlive(state, d)) { await d.sleep(pollMs); break; }
          let landed;
          try { landed = await d.land(ref, engineDeps); } catch (error) {
            if (error?.code !== "WAITING_GATE") throw error;
            landed = { result: "waiting_gate", reason: error.message };
          }
          driveLog(project, `land: ${landed?.result ?? "?"}${landed?.reason ? ` (${landed.reason})` : ""}`, d);
          if (landed?.result === "waiting_gate") await say("waiting-gate", { project, kind: "production" }, d);
          if (landed?.result === "running" || landed?.result === "nothing_to_land") await d.sleep(pollMs);
          break;
        }
        case "done": {
          let finished;
          try { finished = await d.finish(ref, engineDeps); } catch (error) {
            if (error?.code !== "WAITING_GATE") throw error;
            finished = { waiting_gate: true };
          }
          driveLog(project, `done: finish ${finished?.report_path ?? ""}`.trim(), d);
          await say(finished?.waiting_gate ? "waiting-gate" : "done", { project }, d);
          await setOwnStandbyState(project, "stopped", d);
          return { outcome: "done", action: "done", exitCode: 0 };
        }
        case "handoff":
          throw err("ENGINE_FAILURE", "next returned handoff to drive (a drive coordinator never hands off)");
        default:
          if (TERMINAL_ACTIONS.has(out?.action)) {
            driveLog(project, `terminal: ${out.action} (applied by next)`, d);
            let event = out.action;
            if (out.action === "waiting-owner") {
              const after = await readState(project, { env: d.env, homedir: d.homedir }).catch(() => null);
              if (after?.status === "waiting_gate") event = "waiting-gate";
            }
            await say(event, { project }, d);
            await setOwnStandbyState(project, "stopped", d);
            return { outcome: out.action, action: out.action, exitCode: 0 };
          }
          throw err("ENGINE_FAILURE", `next returned an unknown action: ${String(out?.action)}`);
      }
    } catch (error) {
      if (isFenceError(error)) {
        driveLog(project, `yield: fenced at epoch ${epoch} (${error.message}); the owner's session holds the run now`, d);
        await setOwnStandbyState(project, "stopped", d);
        return { outcome: "yielded", action: out?.action ?? null, exitCode: 0 };
      }
      return engineFailure(project, epoch, error, d, engineDeps);
    }
  }
  driveLog(project, "loop: poll budget exhausted (test bound)", d);
  return { outcome: "poll_budget", action: null, exitCode: 0 };
}

/**
 * The active loop under its contract name (`{project, runId?, epoch}`); `runId`, when given, must match state.json.
 * @param {{project: string, runId?: string, epoch: number}} input
 * @param {object} deps as `driveLoop`
 */
export async function runLoop({ project, runId, epoch }, deps) {
  if (runId) {
    const d = withDefaults(deps);
    const state = await readState(project, { env: d.env, homedir: d.homedir }).catch(() => null);
    if (state && state.run_id !== runId) {
      driveLog(project, `loop: run ${runId} is not the current run (${state.run_id}); nothing to do`, d);
      return { outcome: "run_changed", action: null, exitCode: 0 };
    }
  }
  return driveLoop({ project, epoch }, deps);
}

async function engineFailure(project, epoch, error, d, engineDeps) {
  driveLog(project, `engine failure: ${error?.code ?? "ERROR"}: ${error?.message ?? String(error)}`, d);
  if (typeof d.engineFailure === "function") {
    try { await d.engineFailure({ project, epoch, actor: "drive", error }, engineDeps); } catch (inner) {
      driveLog(project, `engine failure handler failed: ${inner.message}`, d);
    }
  }
  await say("engine-failure", { project }, d);
  await setOwnStandbyState(project, "stopped", d);
  return { outcome: "engine_failure", action: null, exitCode: 8 };
}

// --------------------------------------------------------------------------------------------------- entry

/**
 * Standby: poll the triggers until the run leaves `active` (exit) or a trigger fires (takeover, then the loop).
 * @param {{project: string, runId: string, transcript?: string|null, handoffAfter?: number|null}} input
 * @param {object} [deps]
 * @returns {Promise<{outcome: string, trigger: string|null, exitCode: number}>}
 */
export async function runStandby({ project, runId, transcript = null, handoffAfter = null }, deps) {
  const d = withDefaults(deps);
  const limits = limitsOf(d);
  const current = await readStandby(project, d);
  await writeStandby(project, { pid: d.pid, armed_at: current?.pid === d.pid ? current.armed_at : isoAt(nowMs(d)), run_id: runId, state: "standby" }, d);
  try { await keepAwake(project, d.pid, d); } catch (error) { driveLog(project, `standby: keep-awake failed: ${error.message}`, d); }
  driveLog(project, `standby: pid ${d.pid} watching ${runId}`, d);

  let stateErrors = 0;
  for (let i = 0; i < d.maxPolls; i++) {
    let verdict;
    try {
      verdict = await checkTriggers({ project, runId, transcript, handoffAfter }, d);
      stateErrors = 0;
    } catch (error) {
      stateErrors += 1;
      driveLog(project, `standby: poll failed (${error.code ?? "ERROR"}: ${error.message})`, d);
      if (stateErrors >= STATE_ERRORS_BEFORE_EXIT) { await setOwnStandbyState(project, "stopped", d); return { outcome: "standby_exit", trigger: null, exitCode: 0 }; }
      await d.sleep(limits.drive_poll_s * 1000);
      continue;
    }
    if (verdict.exit) {
      driveLog(project, `standby: exit (${verdict.exit}${verdict.detail ? `: ${verdict.detail}` : ""})`, d);
      await setOwnStandbyState(project, "stopped", d);
      return { outcome: "standby_exit", trigger: null, reason: verdict.exit, exitCode: 0 };
    }
    if (verdict.trigger) {
      const taken = await takeOverAndLoop({ project, runId, trigger: verdict.trigger, detail: verdict.detail }, d);
      if (taken) return taken;
    }
    await d.sleep(limits.drive_poll_s * 1000);
  }
  return { outcome: "poll_budget", trigger: null, exitCode: 0 };
}

async function takeOverAndLoop(input, d) {
  let taken;
  try { taken = await takeOver(input, d); } catch (error) {
    driveLog(input.project, `takeover failed: ${error.code ?? "ERROR"}: ${error.message}`, d);
    if (isFenceError(error)) return null;
    return { ...(await engineFailure(input.project, error?.epoch ?? null, error, d, d.engineDeps ?? {})), trigger: input.trigger };
  }
  if (taken.outcome === "retry") return null;
  if (taken.outcome === "paused-quota") {
    await setOwnStandbyState(input.project, "stopped", d);
    return { outcome: "paused-quota", trigger: input.trigger, exitCode: 0 };
  }
  const looped = await driveLoop({ project: input.project, epoch: taken.epoch }, d);
  return { ...looped, trigger: input.trigger };
}

/**
 * Parse `drive` arguments: `--standby --run R [--transcript <path>]` or `--run R [--handoff-after N]`.
 * @param {string[]} argv arguments after the `drive` subcommand
 * @returns {{standby: boolean, runId: string, handoffAfter: number|null, transcript: string|null}}
 * @throws USAGE
 */
export function parseDriveArgs(argv) {
  const out = { standby: false, runId: null, handoffAfter: null, transcript: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = String(argv[i]).split(/=(.*)/s, 2);
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (flag === "--standby") out.standby = true;
    else if (flag === "--run") out.runId = value();
    else if (flag === "--handoff-after") out.handoffAfter = Number(value());
    else if (flag === "--transcript") out.transcript = value();
    else if (flag === "--project") i += inline !== undefined ? 0 : 1; // resolved by the dispatcher
    else throw err("USAGE", `unknown drive flag ${flag}`);
  }
  if (!out.runId) throw err("USAGE", "drive needs --run <run_id>");
  if (out.handoffAfter !== null && !(Number.isInteger(out.handoffAfter) && out.handoffAfter >= 0)) throw err("USAGE", "--handoff-after needs a non-negative integer");
  if (out.standby && out.handoffAfter !== null) throw err("USAGE", "--handoff-after is for the direct form (drive --run R)");
  return out;
}

/**
 * Entry of the `drive` subcommand (the dispatcher resolves the project and injects the engine functions).
 * `--standby`: wait for a trigger. `--run R --handoff-after N` (test only): take over after N committed WOs.
 * `--run R`: take over now (trigger `direct`) and run the loop. Writes nothing to stdout; logs to drive.log.
 * @param {{project: string, argv: string[]}} input
 * @param {object} [deps]
 * @returns {Promise<number>} process exit code (0, or 8 after an engine failure)
 */
export async function runDrive({ project, argv }, deps) {
  const d = withDefaults(deps);
  const args = parseDriveArgs(argv);
  if (args.standby || args.handoffAfter !== null) {
    const result = await runStandby({ project, runId: args.runId, transcript: args.transcript, handoffAfter: args.handoffAfter }, d);
    return result.exitCode;
  }
  await writeStandby(project, { pid: d.pid, armed_at: isoAt(nowMs(d)), run_id: args.runId, state: "active" }, d);
  try { await keepAwake(project, d.pid, d); } catch (error) { driveLog(project, `keep-awake failed: ${error.message}`, d); }
  const result = await takeOverAndLoop({ project, runId: args.runId, trigger: "direct", detail: null }, d);
  if (!result) { await setOwnStandbyState(project, "stopped", d); return 0; }
  return result.exitCode;
}
