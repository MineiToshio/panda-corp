// Deps, clock, paths, forbidden-word guard, log and owner notification of the drive relay (split from drive.mjs).
import { execFile, spawn as nodeSpawn } from "node:child_process";
import nodeFs from "node:fs";
import path from "node:path";
import { notifyOwner } from "../notify.mjs";
import { buildPaths } from "../paths.mjs";
import { loadThresholds } from "../quota.mjs";
import { FORBIDDEN_WORD, LOG_ROTATE_BYTES, err } from "./constants.mjs";

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
export const limitsOf = (d) => {
  const limits = loadThresholds({ thresholds: d.thresholds });
  const poll = Number(d.env?.PANDACORP_DRIVE_POLL_S);
  return Number.isFinite(poll) && poll > 0 ? { ...limits, drive_poll_s: poll } : limits;
};

export const withDefaults = (deps) => (deps?.__drive ? deps : { ...driveDeps(deps ?? {}), __drive: true });
export const nowMs = (d) => d.now();
export const isoAt = (ms) => new Date(ms).toISOString();
export const buildStateOf = async (d) => d.buildState ?? import("../../build-state.mjs");
export const pathsOf = (project, d) => buildPaths(project, { env: d.env, homedir: d.homedir });
export const stateDeps = (d, bs) => ({ env: d.env, homedir: d.homedir, buildState: bs });

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

export const say = async (event, data, d) => {
  try {
    if (typeof d.notify === "function") return await d.notify(event, data);
    return await notifyOwner(event, data, { env: d.env, platform: d.platform, ...(typeof d.notifyExec === "function" ? { exec: d.notifyExec } : {}) });
  } catch (error) {
    return { sent: false, reason: error.message };
  }
};
