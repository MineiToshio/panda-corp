// workers.mjs — Codex workers of the v2 build engine (D6, PLAN 3.7 and 3.16 A16/A17/A18, CLI doc sections 4 and 11).
//
// A `via:"cli"` unit is written by a Codex worker that the engine CLI launches through the existing
// `plugin/scripts/codex-worker.mjs run --direct` (or the executable in PANDACORP_FAKE_WORKER in tests) and harvests with
// `read`. The worker owns its own layout `.pandacorp/run/codex-workers/<worker_id>/`; the result is the sealed line
// `{"r":"<payload JSON>","sum":"<fnv(r)>"}`, never the process exit code. This module only builds the argv, launches,
// polls, verifies the seal, classifies the payload and hands limits to quota.mjs. It never touches state.json, the
// journal or git: the caller (next/drive) records the job, ingests the report through report.mjs and decides the
// attempt budget. Every function takes the injected `deps` as its LAST optional argument.
//
// deps: {env, fs, spawn, sleep, tiers, recordLimit, stopWorkers, isAlive, fnv, launchTimeoutMs, readTimeoutMs}.
import { spawn as nodeSpawn } from "node:child_process";
import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopCodexWorkers } from "../codex-workers.mjs";
import { atomicWriteJson, validate } from "./fsx.mjs";
import { assertSafeId, buildPaths } from "./paths.mjs";
import { classifyLimitText, limitResetsAt, recordLimit as quotaRecordLimit } from "./quota.mjs";
import { modelSlug } from "./routing.mjs";

const WORKER_SCRIPT = fileURLToPath(new URL("../../scripts/codex-worker.mjs", import.meta.url));
const WORKER_ID_MAX = 120; // codex-worker.mjs ID_RE
const LAUNCH_WAIT_S = 2; // `run --max`: the launcher returns CODEX-RUNNING right after starting Codex
const LAUNCH_GRACE_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;
const SEAL_RETRIES = 2;
const RATE_LIMIT_RETRY_S = 60; // BUILD-11: retry once after 60 s
const DIRECT_EFFORTS = new Set(["low", "medium", "high", "xhigh"]);
const WATCHDOG_KINDS = new Set(["start-hang", "stall", "cap"]);
// The Codex hook adapter denies a shell command containing this word, so no value the engine composes may carry it.
const FORBIDDEN_WORD = /claude/i;
// argv values that are filesystem paths of the host: they come from the owner's machine, not from the engine.
const PATH_FLAGS = new Set(["--project", "--prompt-file", "--output-schema", "--dir"]);

/** Error with a stable `code`: USAGE (bad input), INVALID_PATH (unsafe id), FORBIDDEN_WORD, INVALID_STATE. */
export class WorkersError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkersError";
    this.code = code;
  }
}

const fsOf = (deps) => deps?.fs ?? nodeFs;
const envOf = (deps) => deps?.env ?? process.env;

/** FNV-1a 32-bit over UTF-16 code units: the checksum codex-worker.mjs seals results with. */
const fnvOf = (deps) =>
  deps?.fnv ??
  ((text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  });

/**
 * Worker id of a unit attempt: `w-<run id>-<unit id>[-a<n>]` (the run id keeps a later run from re-reading an older
 * run's sealed result, which `codex-worker.mjs run` would reprint verbatim).
 * @param {{runId?: string, unit: string, attempt?: number}} input
 * @returns {string} a safe id of at most 120 characters
 */
export function workerIdFor({ runId, unit, attempt = 1 }) {
  const suffix = Number(attempt) >= 2 ? `-a${Number(attempt)}` : "";
  const id = `w-${runId ? `${assertSafeId(runId, "run id")}-` : ""}${assertSafeId(unit, "unit id")}${suffix}`;
  if (id.length > WORKER_ID_MAX) throw new WorkersError("USAGE", `worker id longer than ${WORKER_ID_MAX} characters: ${id}`);
  return assertSafeId(id, "worker id");
}

/** True when a composed argv value contains the word the Codex hook adapter blocks. */
export const containsForbiddenWord = (value) => FORBIDDEN_WORD.test(String(value));

/**
 * The command that launches or polls a worker: the real `codex-worker.mjs` under Node, or the executable named by
 * PANDACORP_FAKE_WORKER (a `.mjs`/`.js` file runs under Node, anything else is executed directly).
 * @returns {{bin: string, prefix: string[], fake: boolean}}
 */
function workerCommand(deps) {
  const fake = envOf(deps).PANDACORP_FAKE_WORKER;
  if (!fake) return { bin: process.execPath, prefix: [WORKER_SCRIPT], fake: false };
  return /\.(?:mjs|js|cjs)$/.test(fake) ? { bin: process.execPath, prefix: [fake], fake: true } : { bin: fake, prefix: [], fake: true };
}

/** Rejects any engine-composed argv value (never a host path) that carries the forbidden word. */
function assertArgvClean(args) {
  for (let i = 0; i < args.length; i++) {
    if (i > 0 && PATH_FLAGS.has(args[i - 1])) continue;
    if (containsForbiddenWord(args[i])) throw new WorkersError("FORBIDDEN_WORD", `argv value carries a word the Codex hook adapter blocks: ${args[i]}`);
  }
}

/**
 * Argv of `codex-worker.mjs run --direct` for one unit (A16): prompt file = the unit brief, `--codex-model` = the catalog
 * slug of the cell, `--output-schema`, `--dir` = the unit worktree, `--access sandbox` (the workspace-write sandbox keeps
 * `.git` read-only, so a worker can edit and test but never commit: the CLI commits), no `--sum`.
 * @param {{project: string, workerId: string, unit: string, cell: {runtime: string, model: string, effort: string},
 *          promptFile: string, schemaFile?: string|null, dir: string, maxSeconds?: number}} input
 * @param {object} [deps] {env, tiers}
 * @returns {{bin: string, args: string[], fake: boolean}}
 */
export function buildWorkerArgv(input, deps) {
  const { project, workerId, unit, cell, promptFile, schemaFile = null, dir, maxSeconds = LAUNCH_WAIT_S } = input;
  if (!cell || cell.runtime !== "codex") throw new WorkersError("USAGE", `a Codex worker needs a codex cell, got ${JSON.stringify(cell)}`);
  const slug = modelSlug(cell, deps);
  const effort = cell.effort === "max" ? "xhigh" : cell.effort;
  if (!DIRECT_EFFORTS.has(effort)) throw new WorkersError("USAGE", `a Codex worker needs an explicit effort (low|medium|high|xhigh), got ${String(cell.effort)}`);
  for (const [label, value] of [["project", project], ["promptFile", promptFile], ["dir", dir]]) {
    if (typeof value !== "string" || !path.isAbsolute(value)) throw new WorkersError("USAGE", `${label} must be an absolute path`);
  }
  if (schemaFile !== null && !path.isAbsolute(schemaFile)) throw new WorkersError("USAGE", "schemaFile must be an absolute path");
  const { bin, prefix, fake } = workerCommand(deps);
  const args = [
    "run", "--direct", "--project", project, "--id", assertSafeId(workerId, "worker id"), "--unit", assertSafeId(unit, "unit id"),
    "--prompt-file", promptFile, "--codex-model", slug, "--effort", effort,
    ...(schemaFile ? ["--output-schema", schemaFile] : []),
    "--dir", dir, "--access", "sandbox", "--max", String(Math.max(1, Math.floor(maxSeconds))),
  ];
  assertArgvClean(args);
  return { bin, args: [...prefix, ...args], fake };
}

/** Runs a command to completion (or `timeoutMs`), capturing stdout. The child is detached so it leads its own group. */
function runCapture(bin, args, { cwd, env, timeoutMs, isWorkerItself }, deps) {
  const spawn = deps?.spawn ?? nodeSpawn;
  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer = null;
    let watcher = null;
    const finish = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watcher) clearInterval(watcher);
      resolve({ pid: child?.pid ?? null, stdout, stderr, child, ...extra });
    };
    try {
      child = spawn(bin, args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      finish({ code: null, timedOut: false, spawnError: error.message });
      return;
    }
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => finish({ code: null, timedOut: false, spawnError: error.message }));
    child.once("close", (code) => finish({ code, timedOut: false }));
    timer = setTimeout(() => finish({ code: null, timedOut: true }), timeoutMs);
    // A launcher that IS the worker (the fake in `hang` mode) never returns: stop waiting as soon as its state names its pid.
    watcher = isWorkerItself ? setInterval(() => { if (isWorkerItself(child.pid)) finish({ code: null, timedOut: true }); }, 100) : null;
  });
}

/** Stops listening to a launcher we let go of, so nothing of it keeps the engine process alive. */
function releaseChild(child) {
  try { child?.stdout?.destroy(); child?.stderr?.destroy(); child?.unref(); } catch { /* already closed */ }
}

const lastLine = (text) => String(text ?? "").split("\n").map((line) => line.trim()).filter(Boolean).pop() ?? "";

/**
 * Parses and verifies one sealed line.
 * @param {string} line `{"r":"<payload JSON>","sum":"<fnv(r)>"}`
 * @param {object} [deps] {fnv}
 * @returns {{ok: true, payload: object} | {ok: false, kind: "garbled"|"checksum", detail: string}}
 */
export function parseSealedLine(line, deps) {
  let envelope;
  try { envelope = JSON.parse(line); } catch { return { ok: false, kind: "garbled", detail: `not JSON: ${String(line).slice(0, 120)}` }; }
  if (typeof envelope?.r !== "string" || typeof envelope?.sum !== "string") return { ok: false, kind: "garbled", detail: "envelope lacks r or sum" };
  const expected = fnvOf(deps)(envelope.r);
  if (expected !== envelope.sum) return { ok: false, kind: "checksum", detail: `checksum ${expected} != sealed ${envelope.sum}` };
  try {
    const payload = JSON.parse(envelope.r);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, kind: "garbled", detail: "payload is not an object" };
    return { ok: true, payload };
  } catch { return { ok: false, kind: "garbled", detail: "payload is not JSON" }; }
}

const processAlive = (pid, deps) => {
  if (deps?.isAlive) return deps.isAlive(pid);
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
};

const readJsonSync = (file, deps) => {
  try { return JSON.parse(fsOf(deps).readFileSync(file, "utf8")); } catch { return null; }
};

/**
 * Cheap local look at a worker (no process spawned): for the drive loop's 30 s `exit` polling and for resume re-attachment.
 * @param {{project: string, workerId: string}} input
 * @param {object} [deps]
 * @returns {{state: "none"|"running"|"exited"|"dead", pid: number|null, exit: number|null, sealed: boolean}}
 */
export function peekWorker({ project, workerId }, deps) {
  const dir = buildPaths(project).codexWorkerDir(workerId);
  const fs = fsOf(deps);
  const state = readJsonSync(path.join(dir, "state.json"), deps);
  const sealed = fs.existsSync(path.join(dir, "result.line"));
  if (!state) return { state: "none", pid: null, exit: null, sealed };
  const pid = Number.isInteger(state.pid) ? state.pid : null;
  if (fs.existsSync(path.join(dir, "exit"))) {
    const code = Number.parseInt(String(fs.readFileSync(path.join(dir, "exit"), "utf8")).trim(), 10);
    return { state: "exited", pid, exit: Number.isFinite(code) ? code : null, sealed };
  }
  return { state: pid !== null && processAlive(pid, deps) ? "running" : "dead", pid, exit: null, sealed };
}

/** The `jobs[]` item (A18) of a launched worker, ready for the caller to record. */
const jobItem = ({ workerId, unit, frd, pid, cwd, startedAt, state = "running", exit = null }) =>
  ({ id: workerId, kind: "worker", unit, frd: frd ?? null, pid, cwd, h_slot: false, started_at: startedAt, state, exit, worker_id: workerId });

/**
 * Launches the Codex worker of one unit (idempotent per worker id: a worker that already runs or has a sealed result is
 * not started again, so a resume that re-adopts it cannot double-run it). Waits only for the launcher, never for Codex.
 * @param {{project: string, runId?: string, unit: string, attempt?: number, frd?: string|null,
 *          cell: {runtime: string, model: string, effort: string}, schemaFile?: string|null, dir: string,
 *          briefFile?: string, workerId?: string}} input `dir` = the unit worktree
 * @param {object} [deps]
 * @returns {Promise<{ok: true, workerId: string, dir: string, pid: number|null, startedAt: string|null, job: object,
 *                    reused: boolean, argv: string[], settled: object|null} | {ok: false, kind: string, detail: string}>}
 *   `settled` carries the parsed sealed payload when the worker finished before the launcher returned.
 */
export async function launchWorker(input, deps) {
  const { project, unit, frd = null, dir } = input;
  const paths = buildPaths(project);
  const workerId = input.workerId ?? workerIdFor({ runId: input.runId, unit, attempt: input.attempt });
  const fs = fsOf(deps);
  const promptFile = input.briefFile ?? paths.briefFile(unit);
  if (!fs.existsSync(promptFile)) return { ok: false, kind: "brief_missing", detail: `unit brief not found: ${promptFile}` };
  if (input.schemaFile && !fs.existsSync(input.schemaFile)) return { ok: false, kind: "schema_missing", detail: `output schema not found: ${input.schemaFile}` };
  if (!fs.existsSync(dir)) return { ok: false, kind: "worktree_missing", detail: `unit worktree not found: ${dir}` };
  const { bin, args, fake } = buildWorkerArgv({ project: paths.project, workerId, unit, cell: input.cell, promptFile, schemaFile: input.schemaFile ?? null, dir }, deps);
  const workerDir = paths.codexWorkerDir(workerId);
  const existing = peekWorker({ project, workerId }, deps);
  const adopted = (pid, startedAt, settled) => ({ ok: true, workerId, dir: workerDir, pid, startedAt, job: jobItem({ workerId, unit, frd, pid, cwd: dir, startedAt }), reused: true, argv: args, settled });
  if (existing.sealed || existing.state === "running" || existing.state === "exited") {
    const state = readJsonSync(path.join(workerDir, "state.json"), deps);
    return adopted(existing.pid, state?.startedAt ?? null, null);
  }
  const wait = await runCapture(bin, args, { cwd: paths.project, env: { ...process.env, ...envOf(deps) }, timeoutMs: deps?.launchTimeoutMs ?? LAUNCH_WAIT_S * 1000 + LAUNCH_GRACE_MS, isWorkerItself: fake ? (launcherPid) => readJsonSync(path.join(workerDir, "state.json"), deps)?.pid === launcherPid : null }, deps);
  const state = readJsonSync(path.join(workerDir, "state.json"), deps);
  const startedAt = state?.startedAt ?? null;
  const pid = Number.isInteger(state?.pid) ? state.pid : null;
  const fresh = (settled) => ({ ok: true, workerId, dir: workerDir, pid, startedAt, job: jobItem({ workerId, unit, frd, pid, cwd: dir, startedAt, state: settled ? "done" : "running", exit: settled ? peekWorker({ project, workerId }, deps).exit : null }), reused: false, argv: args, settled });
  if (wait.spawnError) return { ok: false, kind: "launch_failed", detail: wait.spawnError };
  if (wait.timedOut) {
    // A launcher that does not return: it is the worker itself only for the fake (its pid is the state pid); otherwise it is stuck.
    if (state && fake && pid === wait.pid) { releaseChild(wait.child); return fresh(null); }
    killGroup(wait.pid, deps);
    releaseChild(wait.child);
    return state ? fresh(null) : { ok: false, kind: "launch_failed", detail: `launcher did not return and wrote no state in ${workerDir}` };
  }
  releaseChild(wait.child);
  const line = lastLine(wait.stdout);
  if (line.startsWith("CODEX-RUNNING")) return state ? fresh(null) : { ok: false, kind: "launch_failed", detail: `launcher reported running but wrote no state in ${workerDir}` };
  const sealed = parseSealedLine(line, deps);
  if (!sealed.ok) return { ok: false, kind: "launch_failed", detail: `launcher output not usable (${sealed.detail}); stderr: ${wait.stderr.slice(0, 200)}` };
  if (sealed.payload.status === "error") return { ok: false, kind: `launch_${sealed.payload.kind ?? "error"}`, detail: String(sealed.payload.detail ?? "").slice(0, 300) };
  return fresh(sealed.payload);
}

function killGroup(pid, deps) {
  if (!Number.isInteger(pid)) return;
  const kill = deps?.kill ?? process.kill;
  try { kill(-pid, "SIGKILL"); } catch { try { kill(pid, "SIGKILL"); } catch { /* already gone */ } }
}

/**
 * Classifies one sealed payload (pure). Outcomes:
 *  report (an `answer` object that passes the schema) | text (no schema was asked) | bad_report (answer missing, not an
 *  object or invalid: consumes an attempt) | limit (`usage_limit` | `rate_limit`: consumes no attempt) | watchdog
 *  (start-hang | stall | cap) | failed (Codex exited without a usable final message) | worker_error (the launcher itself).
 * @param {object} payload sealed payload of codex-worker.mjs
 * @param {{unit?: string, schema?: object|null}} [context] `schema` = the parsed output schema; `unit` = the expected report unit
 * @returns {{outcome: string, report?: object, text?: string, kind?: string, detail?: string, limit?: string,
 *            resetsAt?: string|null, retryAfterS?: number, errors?: object[]}}
 */
export function classifyWorkerPayload(payload, { unit, schema = null } = {}) {
  const detail = String(payload.detail ?? "").slice(0, 600);
  if (payload.status === "error") return { outcome: "worker_error", kind: String(payload.kind ?? "error"), detail };
  const limit = payload.limit ?? (payload.ok === false ? classifyLimitText(`${payload.kind ?? ""} ${detail}`) : null);
  if (payload.ok === false && (payload.kind === "limit" || limit)) {
    const kind = limit === "rate_limit" ? "rate_limit" : "usage_limit";
    return { outcome: "limit", limit: kind, detail, resetsAt: limitResetsAt(detail), ...(kind === "rate_limit" ? { retryAfterS: RATE_LIMIT_RETRY_S } : {}) };
  }
  if (payload.ok === false && WATCHDOG_KINDS.has(payload.kind)) return { outcome: "watchdog", kind: payload.kind, detail };
  if (payload.ok === false && payload.kind === "bad-answer") return { outcome: "bad_report", kind: "bad_answer", detail, errors: [{ path: "", message: detail }] };
  if (payload.ok === false) return { outcome: "failed", kind: String(payload.kind ?? "error"), detail };
  if (payload.answer === undefined) {
    return typeof payload.text === "string" && !schema ? { outcome: "text", text: payload.text } : { outcome: "bad_report", kind: "no_answer", detail: "the worker returned no JSON answer", errors: [{ path: "", message: "no JSON answer" }] };
  }
  if (payload.answer === null || typeof payload.answer !== "object" || Array.isArray(payload.answer)) {
    return { outcome: "bad_report", kind: "bad_answer", detail: "the answer is not a JSON object", errors: [{ path: "", message: "answer is not an object" }] };
  }
  const errors = schema ? validate(schema, payload.answer).errors : [];
  if (unit && payload.answer.unit !== undefined && payload.answer.unit !== unit) errors.push({ path: "/unit", message: `report is for ${String(payload.answer.unit)}, expected ${unit}` });
  return errors.length ? { outcome: "bad_report", kind: "schema", detail: errors.map((e) => `${e.path || "/"}: ${e.message}`).join("; ").slice(0, 600), errors } : { outcome: "report", report: payload.answer };
}

const readSchema = (file, deps) => (file ? JSON.parse(fsOf(deps).readFileSync(file, "utf8")) : null);

/**
 * One poll of a worker with `read`: still running, or its sealed result classified. A usage limit is recorded through
 * quota.mjs `recordLimit` for provider `codex`; a rate limit only carries `retryAfterS` (BUILD-11).
 * @param {{project: string, workerId: string, unit?: string, schemaFile?: string|null, reportFile?: string|null,
 *          epoch?: number, now?: Date|number|string}} input `reportFile`: when given and the outcome is `report`, the
 *          report object is written there atomically (the file `report.mjs` ingests)
 * @param {object} [deps]
 * @returns {Promise<{state: "running"|"done"|"error", workerId: string, outcome?: string, ...object}>}
 */
export async function pollWorker(input, deps) {
  const { project, workerId, unit, schemaFile = null, reportFile = null, epoch, now } = input;
  const paths = buildPaths(project);
  paths.codexWorkerDir(workerId);
  const { bin, prefix } = workerCommand(deps);
  const argv = [...prefix, "read", "--project", paths.project, "--id", workerId];
  assertArgvClean(argv.slice(prefix.length));
  let sealed = null;
  for (let attempt = 0; attempt <= SEAL_RETRIES; attempt++) {
    const out = await runCapture(bin, argv, { cwd: paths.project, env: { ...process.env, ...envOf(deps) }, timeoutMs: deps?.readTimeoutMs ?? READ_TIMEOUT_MS }, deps);
    if (out.timedOut) { killGroup(out.pid, deps); releaseChild(out.child); return { state: "error", workerId, kind: "read_timeout", detail: "worker read did not return" }; }
    releaseChild(out.child);
    const line = lastLine(out.stdout);
    if (!line) return { state: "error", workerId, kind: "read_failed", detail: out.spawnError ?? `read printed nothing (exit ${out.code}): ${out.stderr.slice(0, 200)}` };
    if (line.startsWith("CODEX-RUNNING")) return { state: "running", workerId };
    sealed = parseSealedLine(line, deps);
    if (sealed.ok) break;
    if (deps?.sleep) await deps.sleep(200);
  }
  if (!sealed.ok) return { state: "error", workerId, kind: `bad_seal_${sealed.kind}`, detail: sealed.detail };
  const { payload } = sealed;
  if (payload.status === "error" && payload.kind === "no-result") {
    // A worker that never sealed: still running (fake hang, or the real one between `exit` and `settle`) or gone.
    const peek = peekWorker({ project, workerId }, deps);
    if (peek.state === "running") return { state: "running", workerId };
    return { state: "done", workerId, outcome: "worker_error", kind: "dead", detail: `worker ${workerId} left no sealed result (${peek.state})`, payload };
  }
  const verdict = classifyWorkerPayload(payload, { unit, schema: readSchema(schemaFile, deps) });
  const result = { state: "done", workerId, ...verdict, model: payload.model ?? null, effort: payload.effort ?? null };
  if (verdict.outcome === "limit" && verdict.limit === "usage_limit") {
    const record = deps?.recordLimit ?? quotaRecordLimit;
    result.recorded = record({ provider: "codex", resetsAt: verdict.resetsAt ?? null }, { now, file: paths.quotaFile, epoch, deps });
  }
  if (verdict.outcome === "report" && reportFile) {
    await atomicWriteJson(reportFile, verdict.report);
    result.reportFile = reportFile;
  }
  return result;
}

/**
 * Stops running workers of a project (all, or the listed ids): the single stopping point is `stopCodexWorkers`.
 * @param {string} project
 * @param {string[]} [ids]
 * @param {object} [deps] {stopWorkers}
 * @returns {string[]} ids signalled
 */
export function stopWorkers(project, ids, deps) {
  return (deps?.stopWorkers ?? stopCodexWorkers)(path.resolve(project), ids);
}
