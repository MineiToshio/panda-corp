#!/usr/bin/env node
// codex-worker.mjs — the Codex worker relay of the Claude build engine (`/pandacorp:implement codex`, DR-142).
//
// Why it exists: a Workflow script has no shell, and its agent() only spawns Claude agents. With
// args.workers === 'codex' the engine hands every NON-mechanical agent call (builder, reviewer, repair, planner…)
// to a cheap MECH relay agent instead, and that relay runs THIS script, which executes the same prompt with
// `codex exec` on the owner's Codex subscription. The engine stays the only orchestrator: Codex is a subordinate
// worker with no lease, no build state of its own and no authority beyond what the Claude worker had.
//
//   run  --project <dir> --id <id> --sum <fnv> --model <claude alias> [--effort e] [--role pandacorp:x]
//        [--dir <path>] [--nest] [--json-answer] [--access sandbox|full] [--max <seconds>]
//        First call starts Codex in the background (detached, so it survives the relay's 10-minute Bash cap);
//        every call waits up to --max seconds. Still working → the plain line `CODEX-RUNNING …` (run it again);
//        a bad prompt copy → `CODEX-PROMPT-MISMATCH …`; finished → ONE sealed line {"r":"<payload JSON>","sum":"<fnv(r)>"}
//        whose payload is {status:'done', ok, kind, text|answer, detail, model, effort}.
//   run --direct --project <dir> --id <id> --prompt-file <abs> --codex-model <slug> [--effort e] [--output-schema <abs>]
//        [--dir <path>] [--access sandbox|full] [--writable-dir <abs dir>]... [--max <seconds>] [--start-hang-s N] [--stall-s N] [--cap-s N]
//        --writable-dir (repeatable, sandbox access only) adds one more writable root (`codex exec --add-dir`): the
//        engine passes the unit's own build/units/<unit>/ so the worker can write its report_path (BL-0313).
//        The v2 build engine's mode (D6, A16): the CLI wrote the prompt file itself, so there is no --sum, no transcript
//        recovery and no relay; the prompt is passed to Codex verbatim. The model is an explicit Codex catalog slug
//        (e.g. gpt-6-astra), not a Claude alias. The result is ONE sealed line (same {"r","sum"} envelope) whose payload is
//        {status:'done', ok, kind, answer|text, detail, limit, model, effort}; the process exit code is never the result.
//        A detached watchdog kills the worker on start-hang (no output in 120 s), stall (no output for 20 min) or the
//        wall-clock cap (120 min) and the payload then carries kind 'start-hang' | 'stall' | 'cap'. `read` of a direct
//        worker that finished (exit file) seals and prints the result itself; still running → CODEX-RUNNING.
//   fnv  --file <path>   prints the checksum the engine expects for that file (tests and manual runs).
//   read --project <dir> --id <id>   reprints the final sealed line (the engine's re-read when a copy was garbled).
//   stop --project <dir> (--id <id> | --all)   kills running Codex workers (a stopped or lost build leaves none behind).
//
// The relay writes the task to <project>/.pandacorp/run/codex-workers/<id>/prompt.md with its Write tool; --sum is
// the engine's FNV-1a of that text, so a truncated or altered copy is refused (status:error, kind:prompt-mismatch).
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, openSync, closeSync, renameSync, fsyncSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decide, decideCapacity } from "../runtime/capacity.mjs";
import { stopCodexWorkers } from "../runtime/codex-workers.mjs";
import * as fsp from "node:fs/promises";
import { withAppendLock } from "../runtime/build/fsx.mjs";
import { classifyLimitText } from "../runtime/build/quota.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS = process.env.PANDACORP_EVENTS_FILE || path.join(os.homedir(), ".claude/dashboard-events.ndjson");
const CODEX_BIN = process.env.PANDACORP_CODEX_BIN || "codex";
const ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const TASK_BEGIN = "<<<CODEX-TASK-BEGIN>>>";
const TASK_END = "<<<CODEX-TASK-END>>>";
const TRANSCRIPT_MAX_AGE_MS = 60 * 60 * 1000;

// Codex's own usage-limit / rate-limit wording (an exhausted subscription window, not a defect of the work).
const LIMIT_RE = { test: (text) => classifyLimitText(text) !== null };

/** FNV-1a 32-bit over UTF-16 code units — the same function the engine computes (no crypto in a Workflow). */
export const fnv = (text) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
};

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? "" : argv[i + 1] || ""; };
const flag = (name) => argv.includes(`--${name}`);
/** Every value of a repeatable flag, in argv order. */
const opts = (name) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] && !argv[i + 1].startsWith("--") ? [argv[i + 1]] : []));

const emit = (payload) => {
  const r = JSON.stringify(payload);
  const line = JSON.stringify({ r, sum: fnv(r) });
  process.stdout.write(`${line}\n`);
  return line;
};
const fail = (kind, detail) => { emit({ status: "error", kind, detail: String(detail).slice(0, 600) }); process.exit(0); };

const project = path.resolve(opt("project") || ".");
const root = path.join(project, ".pandacorp/run/codex-workers");
const workerDir = (id) => { if (!ID_RE.test(id)) fail("bad-id", `invalid worker id: ${id}`); return path.join(root, id); };
const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
const alive = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const workerAlive = (state) => {
  if (alive(state.pid)) return true;
  // A killed runner may leave its provider in the SAME process group. Never replay that session.
  if (!state.continuationRunner || !Number.isInteger(state.pid) || state.pid <= 0) return false;
  try { process.kill(-state.pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
};

/** Maps the engine's Claude model/effort to the Codex tier of plugin/runtime/model-tiers.json (single source). */
export function codexTier(model, effort) {
  const tiers = JSON.parse(readFileSync(path.join(PLUGIN, "runtime/model-tiers.json"), "utf8")).tiers;
  const alias = String(model || "sonnet").toLowerCase();
  const tier = Object.values(tiers).find((t) => (t.aliases || []).some((a) => alias.includes(a))) || tiers.STANDARD;
  const wanted = effort === "minimal" ? "low" : effort;
  return { model: tier.codex.model, effort: EFFORTS.has(wanted) ? wanted : tier.codex.effort };
}

/** The role's own agent instructions (plugin/agents/<role>.md without frontmatter) — Codex has no Claude agent types. */
function roleInstructions(role) {
  const name = String(role || "").replace(/^pandacorp:/, "");
  if (!/^[a-z-]+$/.test(name)) return "";
  const file = path.join(PLUGIN, "agents", `${name}.md`);
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

/** Mission Control's event stream (worker_started / worker_stopped, executor codex). Telemetry is a bulkhead: a
 *  failed append is reported on stderr and never fails the worker or changes its sealed result. */
function telemetry(event, data) {
  try {
    appendFileSync(EVENTS, `${JSON.stringify({ event, at: new Date().toISOString(), project: path.basename(project), data: { executor: "codex", ...data } })}\n`);
  } catch (e) { process.stderr.write(`codex-worker: telemetry not recorded (${e.message})\n`); }
}

function workDir() {
  const base = path.resolve(opt("dir") || project);
  if (!flag("nest")) return base;
  // A gate worktree holds the WHOLE repo: the project lives at the same repo-relative prefix inside it.
  const prefix = execFileSync("git", ["-C", project, "rev-parse", "--show-prefix"], { encoding: "utf8" }).trim();
  return path.join(base, prefix);
}

/**
 * The engine's exact task text, read from the relay agent's own transcript. A relay model retyping a long prompt
 * changes words, so copying is only the fallback; the transcript holds the bytes the engine computed.
 * @param {string} id worker id, matched against the relay's own command line
 * @param {string} sum expected checksum of the task text
 * @returns {string|null} the verified task text, or null when no transcript yields it
 */
function promptFromTranscript(id, sum) {
  const base = process.env.CODEX_WORKER_TRANSCRIPTS || path.join(os.homedir(), ".claude/projects");
  const needle = `run --id ${id} --sum ${sum}`;
  const cutoff = Date.now() - TRANSCRIPT_MAX_AGE_MS;
  const files = [];
  for (const entry of readdirSync(base, { recursive: true, withFileTypes: true })) {
    if (!/^agent-.*\.jsonl$/.test(entry.name)) continue;
    const file = path.join(entry.parentPath, entry.name);
    const mtime = statSync(file).mtimeMs;
    if (mtime >= cutoff) files.push({ file, mtime });
  }
  for (const { file } of files.sort((a, b) => b.mtime - a.mtime)) {
    const raw = readFileSync(file, "utf8");
    if (!raw.includes(needle)) continue;
    for (const line of raw.split("\n")) {
      if (!line.includes(needle) || !line.includes(TASK_BEGIN)) continue;
      const content = JSON.parse(line).message?.content;
      for (const block of typeof content === "string" ? [{ text: content }] : content || []) {
        const text = block.text || "";
        const from = text.indexOf(TASK_BEGIN);
        const to = text.indexOf(TASK_END);
        if (!text.includes(needle) || from < 0 || to < from) continue;
        // The Workflow harness indents every relayed line by two spaces.
        const task = text.slice(from, to).split("\n").slice(1).map((l) => l.replace(/^ {1,2}/, "")).join("\n").trimEnd();
        if (fnv(task) === sum) return task;
      }
    }
  }
  return null;
}

/** Starts `codex exec` detached with its stdout/stderr in codex.log; the shell wrapper records the exit code because the
 *  next `run` may be a different process than the one that spawned Codex. */
function writePrivate(file, data) {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tmp, "wx", 0o600);
  try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, file);
}

function childEnv() {
  const env = { ...process.env };
  delete env.PANDACORP_OWNER_RELEASE_OK;
  return env;
}

function launch(dir, cwd, args, tool = "codex", prompt = path.join(dir, "full-prompt.md"), detached = true) {
  const q = (s) => `'${String(s).replaceAll("'", `'"'"'`)}'`;
  const bin = tool === "claude" ? process.env.PANDACORP_CLAUDE_BIN || "claude" : CODEX_BIN;
  const command = `${[bin, ...args].map(q).join(" ")} < ${q(prompt)}`;
  const script = tool === "claude"
    ? `{ ${command}; echo $? > ${q(path.join(dir, "provider-exit"))}; } | tee ${q(path.join(dir, "last.md"))}; cat ${q(path.join(dir, "provider-exit"))} > ${q(path.join(dir, "exit"))}`
    : `${command}; echo $? > ${q(path.join(dir, "exit"))}`;
  const out = openSync(path.join(dir, "codex.log"), "a");
  const child = spawn("/bin/sh", ["-c", script], { cwd, detached, stdio: ["ignore", out, out], env: childEnv() });
  closeSync(out);
  if (detached) child.unref();
  return child;
}

function start(dir, id, allocation) {
  const promptFile = path.join(dir, "prompt.md");
  let recovered = null;
  try { recovered = promptFromTranscript(id, opt("sum")); }
  catch (e) { process.stderr.write(`codex-worker: transcript not usable, falling back to the relay's copy (${e.message})\n`); }
  if (recovered !== null) writePrivate(promptFile, recovered);
  else if (existsSync(promptFile)) chmodSync(promptFile, 0o600);
  const mismatch = (why) => { process.stdout.write(`CODEX-PROMPT-MISMATCH ${why}: rewrite prompt.md exactly, then run the same command again\n`); process.exit(0); };
  if (!existsSync(promptFile)) mismatch(`missing ${promptFile}`);
  const task = readFileSync(promptFile, "utf8").trimEnd();
  if (fnv(task) !== opt("sum")) mismatch(`checksum ${fnv(task)} != expected ${opt("sum")} (${task.length} chars)`);
  const cwd = workDir();
  if (!existsSync(cwd)) fail("bad-dir", `work dir does not exist: ${cwd}`);
  const role = roleInstructions(opt("role"));
  const full = [
    role && `# Your role\n\n${role}`,
    "# Runtime note\n\nYou are running as an isolated CLI worker dispatched by the Pandacorp build engine. Where the task below mentions Claude tools (Read/Write/Edit/Bash/Grep/Glob), use your own equivalent tools. Do everything the task asks inside the working directory; the engine verifies your result independently.",
    `# Task\n\n${task}`,
    flag("json-answer") && "# Final answer\n\nYour FINAL message must be exactly ONE JSON object (no prose before or after it, no code fence) that validates against the JSON Schema given in the task.",
  ].filter(Boolean).join("\n\n");
  writePrivate(path.join(dir, "full-prompt.md"), full);
  const tier = allocatedTier(allocation);
  // --access sandbox (default): Codex's workspace-write sandbox with network. It keeps every `.git` read-only even
  // under --add-dir (verified 2026-10-29: `git commit` fails on index.lock), so a sandboxed worker can edit and test
  // but never commit. --access full gives the worker the reach of the Claude worker it replaces; it is the owner's
  // explicit CLI choice (--access full), never a default this script picks.
  const access = opt("access") === "full"
    ? ["-s", "danger-full-access"]
    : ["-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true"];
  const args = ["exec", "--ignore-user-config", "--skip-git-repo-check", "--json", "-C", cwd, ...access,
    "-m", tier.model, "-c", `model_reasoning_effort="${tier.effort}"`, "-o", path.join(dir, "last.md"), "-"];
  const sessionId = allocation.tool === "claude" ? randomUUID() : null;
  const actualArgs = allocation.tool === "claude" ? ["-p", "--session-id", sessionId, "--model", allocation.model, "--effort", allocation.effort, "--output-format", "stream-json", "--verbose", "--include-partial-messages"] : args;
  const child = launch(dir, cwd, actualArgs, allocation.tool);
  writePrivate(path.join(dir, "state.json"), JSON.stringify({ pid: child.pid, cwd, tool: allocation.tool, capacity: allocation, sessionId, model: tier.model, effort: tier.effort, access: opt("access") || "sandbox", startedAt: new Date().toISOString() }));
  telemetry("worker_started", { id, role: opt("role"), model: tier.model, effort: tier.effort, access: opt("access") || "sandbox" });
}

const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const DIRECT_EFFORTS = new Set(["low", "medium", "high", "xhigh"]);
const WATCHDOG_DEFAULTS_S = { "start-hang-s": 120, "stall-s": 20 * 60, "cap-s": 120 * 60 };
/** Watchdog threshold in seconds: --<name> flag, else PANDACORP_CODEX_<NAME> env (test hook), else the default. */
const watchdogS = (name) => {
  const n = Number(opt(name) || process.env[`PANDACORP_CODEX_${name.toUpperCase().replaceAll("-", "_")}`]);
  return n > 0 ? n : WATCHDOG_DEFAULTS_S[name];
};

/**
 * Extra writable roots of a sandboxed direct worker (BL-0313): each `--writable-dir` must be an absolute, existing
 * directory that neither contains the project nor the work dir, and is not inside a `.git` directory.
 * Under full access the flag is ignored (everything is writable already).
 */
function writableDirs(cwd) {
  if (opt("access") === "full") return [];
  const out = [];
  for (const raw of opts("writable-dir")) {
    if (!path.isAbsolute(raw)) fail("bad-writable-dir", `--writable-dir must be absolute: ${raw}`);
    const dir = path.resolve(raw);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) fail("bad-writable-dir", `--writable-dir does not exist: ${dir}`);
    const inside = (child, parent) => child === parent || child.startsWith(`${parent}${path.sep}`);
    if (inside(project, dir) || inside(path.resolve(cwd), dir)) fail("bad-writable-dir", `--writable-dir may not contain the project or the work dir: ${dir}`);
    if (dir.split(path.sep).includes(".git")) fail("bad-writable-dir", `--writable-dir may not be inside a .git directory: ${dir}`);
    out.push(dir);
  }
  return out;
}

/** v2 direct start: the prompt file is written by the engine CLI and passed to Codex verbatim (no checksum, no relay). */
function startDirect(dir, id, allocation) {
  const promptSrc = opt("prompt-file");
  if (!promptSrc || !existsSync(promptSrc)) fail("bad-prompt-file", `missing --prompt-file: ${promptSrc || "(none)"}`);
  const requestedSlug = opt("codex-model");
  const tier = allocatedTier(allocation);
  const slug = tier.model;
  if (!SLUG_RE.test(requestedSlug)) fail("bad-model", `--codex-model must be a Codex catalog slug: ${slug || "(none)"}`);
  const schema = opt("output-schema") ? path.resolve(opt("output-schema")) : "";
  if (schema && !existsSync(schema)) fail("bad-schema", `--output-schema file does not exist: ${schema}`);
  const cwd = workDir();
  if (!existsSync(cwd)) fail("bad-dir", `work dir does not exist: ${cwd}`);
  const effort = tier.effort;
  const task = readFileSync(promptSrc, "utf8");
  writePrivate(path.join(dir, "prompt.md"), task);
  writePrivate(path.join(dir, "full-prompt.md"), task);
  const access = opt("access") === "full"
    ? ["-s", "danger-full-access"]
    : ["-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", ...writableDirs(cwd).flatMap((d) => ["--add-dir", d])];
  const args = ["exec", "--ignore-user-config", "--skip-git-repo-check", "--json", "-C", cwd, ...access,
    "-m", slug, "-c", `model_reasoning_effort="${effort}"`, ...(schema ? ["--output-schema", schema] : []),
    "-o", path.join(dir, "last.md"), "-"];
  const sessionId = allocation.tool === "claude" ? randomUUID() : null;
  const actualArgs = allocation.tool === "claude" ? ["-p", "--session-id", sessionId, "--model", allocation.model, "--effort", allocation.effort, "--output-format", "stream-json", "--verbose", "--include-partial-messages"] : args;
  const child = launch(dir, cwd, actualArgs, allocation.tool);
  const wd = Object.fromEntries(Object.keys(WATCHDOG_DEFAULTS_S).map((k) => [k, watchdogS(k)]));
  writePrivate(path.join(dir, "state.json"), JSON.stringify({ pid: child.pid, cwd, tool: allocation.tool, capacity: allocation, sessionId, schema, writableDirs: writableDirs(cwd), watchdog: wd, model: slug, effort, access: opt("access") || "sandbox", direct: true, json: Boolean(schema) || flag("json-answer"), role: opt("role"), startedAt: new Date().toISOString() }));
  const watcherArgs = ["watch", "--project", project, "--id", id, ...Object.entries(wd).flatMap(([k, v]) => [`--${k}`, String(v)])];
  spawn(process.execPath, [fileURLToPath(import.meta.url), ...watcherArgs], { detached: true, stdio: "ignore", env: childEnv() }).unref();
  telemetry("worker_started", { id, role: opt("role"), model: slug, effort, access: opt("access") || "sandbox", direct: true });
}

/** Detached watchdog of one direct worker: kills its process group on start-hang, stall or the wall-clock cap, recording
 *  the cause in watchdog.json BEFORE the kill (and the exit file, since the killed shell wrapper cannot write it). */
async function watch() {
  const dir = workerDir(opt("id"));
  const startHang = watchdogS("start-hang-s") * 1000;
  const stall = watchdogS("stall-s") * 1000;
  const cap = watchdogS("cap-s") * 1000;
  const poll = Math.max(50, Math.min(2000, Math.floor(Math.min(startHang, stall, cap) / 4)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const exitFile = path.join(dir, "exit");
  for (;;) {
    const state = readJson(path.join(dir, "state.json"));
    if (!state || existsSync(exitFile)) return;
    if (!workerAlive(state)) { await sleep(1000); if (!existsSync(exitFile)) writeFileSync(exitFile, "137\n"); return; }
    const now = Date.now();
    const age = now - Date.parse(state.startedAt);
    let log = null;
    for (const name of state.tool === "claude" ? ["codex.log", "last.md"] : ["codex.log"]) {
      try {
        const observed = statSync(path.join(dir, name));
        if (observed.size > 0 && (!log || observed.mtimeMs > log.mtimeMs)) log = observed;
      } catch { /* not created yet */ }
    }
    const verdict = age >= cap ? ["cap", `wall-clock cap of ${cap / 1000} s reached`]
      : !log || log.size === 0 ? (age >= startHang ? ["start-hang", `no output from Codex within ${startHang / 1000} s`] : null)
      : now - log.mtimeMs >= stall ? ["stall", `no output from Codex for ${stall / 1000} s`] : null;
    if (verdict) {
      if (existsSync(exitFile)) return;
      writeFileSync(path.join(dir, "watchdog.json"), JSON.stringify({ kind: verdict[0], detail: verdict[1], at: new Date().toISOString() }));
      try { process.kill(-state.pid, "SIGTERM"); } catch { /* already gone */ }
      for (let i = 0; i < 50 && workerAlive(state); i++) await sleep(100);
      if (workerAlive(state)) { try { process.kill(-state.pid, "SIGKILL"); } catch { /* already gone */ } }
      if (!existsSync(exitFile)) writeFileSync(exitFile, "124\n");
      return;
    }
    await sleep(poll);
  }
}

/** Direct-mode usage-limit vs rate-limit (429) wording, for the engine's quota handling. */
const limitKind = classifyLimitText;

function sessionFromLog(log) {
  for (const line of log.split("\n")) {
    try { const e = JSON.parse(line); if (e.type === "thread.started" && typeof e.thread_id === "string") return e.thread_id; } catch { /* stderr */ }
  }
  return null;
}

function lastJsonObject(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { return JSON.parse(trimmed); } catch { /* fall through to the last balanced object */ }
  for (let end = trimmed.lastIndexOf("}"); end >= 0; end = trimmed.lastIndexOf("}", end - 1)) {
    for (let begin = trimmed.lastIndexOf("{", end); begin >= 0; begin = trimmed.lastIndexOf("{", begin - 1)) {
      try { const v = JSON.parse(trimmed.slice(begin, end + 1)); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* keep widening */ }
    }
  }
  return null;
}

function finish(dir, state) {
  const code = Number(readFileSync(path.join(dir, "exit"), "utf8").trim());
  let last = existsSync(path.join(dir, "last.md")) ? readFileSync(path.join(dir, "last.md"), "utf8") : "";
  const log = existsSync(path.join(dir, "codex.log")) ? readFileSync(path.join(dir, "codex.log"), "utf8") : "";
  const sessionId = state.sessionId ?? sessionFromLog(log);
  if (sessionId && !state.sessionId) { state.sessionId = sessionId; writePrivate(path.join(dir, "state.json"), JSON.stringify(state)); }
  let providerError = "";
  if (state.tool === "claude") {
    // stream-json supplies heartbeats to the watchdog. Only the terminal result is an answer;
    // progress and partial messages must never become the worker's final report.
    const envelope = last.split("\n").flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } })
      .findLast(event => event.type === "result" || Object.hasOwn(event, "result"));
    if (envelope) {
      providerError = envelope.is_error ? String(envelope.result ?? envelope.error ?? "") : "";
      last = String(envelope.result ?? "");
    } else last = "";
  }
  const base = { status: "done", tool: state.tool ?? "codex", model: state.model, effort: state.effort, sessionId };
  const watchdog = state.direct ? readJson(path.join(dir, "watchdog.json")) : null;
  if (watchdog) return { ...base, ok: false, kind: watchdog.kind, detail: `watchdog: ${watchdog.detail}`.slice(0, 600) };
  if (code !== 0 || !last.trim() || providerError) {
    const errors = providerError || log.split("\n").filter((l) => /error|limit|fail|429|529/i.test(l)).slice(-5).join(" | ");
    const failed = { ...base, ok: false, kind: LIMIT_RE.test(errors) ? "limit" : "error", detail: `codex exit ${code}${last.trim() ? "" : ", no final message"}: ${errors}`.slice(0, 600) };
    return state.direct && failed.kind === "limit" ? { ...failed, limit: limitKind(errors) } : failed;
  }
  if (!(state.direct ? state.json : flag("json-answer"))) return { ...base, ok: true, text: last };
  const answer = lastJsonObject(last);
  return answer ? { ...base, ok: true, answer } : { ...base, ok: false, kind: "bad-answer", detail: `final message is not one JSON object: ${last.slice(0, 300)}` };
}

/** Seals the finished worker's result into result.line (idempotent for the caller: later runs/reads reprint it). */
function settle(dir, id, state) {
  const result = finish(dir, state);
  writeFileSync(path.join(dir, "result.line"), `${emit(result)}\n`);
  telemetry("worker_stopped", { id, role: opt("role") || state.role || "", model: state.model, effort: state.effort, ok: result.ok, kind: result.kind || "", seconds: Math.round((Date.now() - Date.parse(state.startedAt)) / 1000) });
}

function allocatedTier(decision) {
  const catalog = JSON.parse(readFileSync(path.join(PLUGIN, "runtime/model-tiers.json"), "utf8")).catalog;
  return { model: decision.tool === "codex" ? catalog.codex[decision.model] : decision.model, effort: decision.effort };
}
function allocate(id) {
  let task;
  if (opt("capacity-task")) task = JSON.parse(opt("capacity-task"));
  else {
    const role = opt("role");
    const type = /planner|architect|design/.test(role) ? "design" : /review|audit/.test(role) ? "review" : /mechanic|tier-mech/.test(role) ? "mechanical" : "implement";
    task = { id, type, ...(opt("risk") ? { risk: opt("risk") } : {}) };
  }
  // Security is a floor even when an old caller supplies a lower --risk/task risk.
  if (/security-auditor/.test(opt("role"))) task.risk = "critical";
  // Existing engine run path is authoritative; standalone calls use the host account log.
  const build = path.join(project, ".pandacorp/run/build");
  const log = readJson(path.join(build, "state.json"))?.status === "active" ? path.join(build, "capacity-decisions.jsonl") : undefined;
  const allocation = decideCapacity(task, { log });
  // Explicit legacy model/effort flags must not silently execute a different cell. Engine callers
  // pass a validated capacity-task pin; standalone callers should migrate to task type/risk.
  if (allocation.action === "run" && !opt("capacity-task")) {
    // Legacy Codex flags describe the task's qualified Codex cell, not a provider pin:
    // a capacity fallback may still execute the corresponding Claude cell.
    const nominal = decide({ task: { ...task, override: "codex" }, readings: {}, now: process.env.PANDACORP_NOW ?? Date.now() });
    const tier = allocatedTier(nominal);
    if (opt("codex-model") && SLUG_RE.test(opt("codex-model")) && opt("codex-model") !== tier.model ||
        opt("effort") && opt("effort") !== tier.effort)
      fail("incompatible-cell", "Requested model/effort disagrees with the task/risk allocation; supply a qualified --capacity-task or correct --risk/role");
  }
  return allocation;
}

async function run() {
  const id = opt("id");
  const dir = workerDir(id);
  mkdirSync(dir, { recursive: true });
  const resultFile = path.join(dir, "result.line");
  if (existsSync(resultFile)) { process.stdout.write(readFileSync(resultFile, "utf8")); return; }
  let state = readJson(path.join(dir, "state.json"));
  if (!state) {
    const allocation = allocate(id);
    if (allocation.action === "wait") {
      const receipt = emit({ status: "done", ok: false, kind: "capacity_wait", tool: allocation.tool,
        detail: "Shared capacity wait before launch", resumeAt: allocation.resumeAt, capacity: allocation });
      writePrivate(resultFile, `${receipt}\n`);
      return;
    }
    (flag("direct") ? startDirect : start)(dir, id, allocation); state = readJson(path.join(dir, "state.json"));
  }
  const deadline = Date.now() + Math.min(Number(opt("max")) || 540, 570) * 1000;
  while (!existsSync(path.join(dir, "exit"))) {
    if (!workerAlive(state)) { await new Promise((r) => setTimeout(r, 1000)); if (!existsSync(path.join(dir, "exit"))) writeFileSync(path.join(dir, "exit"), "137\n"); break; }
    // Plain text on purpose: the relay only has to spot this word and run the same command again.
    if (Date.now() >= deadline) { process.stdout.write(`CODEX-RUNNING ${id} since ${state.startedAt}: run the same command again\n`); return; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  settle(dir, id, state);
}

/** Continuation never allocates or reconstructs a prompt/task: it resumes the saved provider session in-place. */
async function resume() {
  const refuse = (kind, detail) => emit({ status: "error", kind, detail });
  const id = opt("id"), dir = workerDir(id), sequence = Number(opt("resume-sequence"));
  if (!Number.isInteger(sequence) || sequence < 1) return refuse("bad-sequence", "resume requires a positive sequence");
  // The shared crash-recoverable mutex serializes reclaimers as well as ordinary calls.
  return withAppendLock(path.join(dir, "resume"), fsp, async () => {
    const state = readJson(path.join(dir, "state.json"));
    if (!state) return refuse("missing-state", "cannot resume a worker without its state");
    if ((state.resumeSequence ?? 0) >= sequence) {
      if (existsSync(path.join(dir, "result.line"))) process.stdout.write(readFileSync(path.join(dir, "result.line"), "utf8"));
      else process.stdout.write(`CODEX-RUNNING ${id} continuation ${state.resumeSequence}\n`);
      return;
    }
    if (workerAlive(state) && !existsSync(path.join(dir, "exit"))) return refuse("still-running", "previous worker has not exited");
    const log = existsSync(path.join(dir, "codex.log")) ? readFileSync(path.join(dir, "codex.log"), "utf8") : "";
    const sessionId = state.sessionId ?? sessionFromLog(log);
    if (!sessionId) return refuse("missing-session", "limit checkpoint has no provider session; refusing a fresh task");
    const archive = path.join(dir, "continuations", String(sequence));
    mkdirSync(archive, { recursive: true });
    for (const name of ["result.line", "exit", "last.md", "watchdog.json"]) {
      const file = path.join(dir, name);
      if (existsSync(file)) renameSync(file, path.join(archive, name));
    }
    const prompt = path.join(dir, "resume-prompt.md");
    writePrivate(prompt, "Continue the same unit from the checkpoint. Preserve existing edits and completed work, cell and report token. Follow the original brief and return its required JSON report.\n");
    const args = state.tool === "claude"
      ? ["-p", "--resume", sessionId, "--model", state.model, "--effort", state.effort, "--output-format", "stream-json", "--verbose", "--include-partial-messages"]
      : ["exec", "resume", "--ignore-user-config", "--skip-git-repo-check", "--json", "-m", state.model,
        "-c", `model_reasoning_effort="${state.effort}"`, "-c", `sandbox_mode="${state.access === "full" ? "danger-full-access" : "workspace-write"}"`,
        "-c", "sandbox_workspace_write.network_access=true",
        "-c", `sandbox_workspace_write.writable_roots=${JSON.stringify(state.writableDirs ?? [])}`,
        ...(state.schema ? ["--output-schema", state.schema] : []), "-o", path.join(dir, "last.md"), sessionId, "-"];
    const intentFile = path.join(archive, "intent.json");
    const receiptFile = path.join(archive, "runner.json");
    // Intent precedes spawn. A runner cannot execute the provider until its PID and sequence
    // have been atomically adopted in state.json. A killed launcher leaves an adoptable runner.
    writePrivate(intentFile, JSON.stringify({ dir, cwd: state.cwd, args, tool: state.tool, prompt, sequence }));
    let receipt = readJson(receiptFile);
    if (!receipt || !alive(receipt.pid)) {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "continue-provider", "--intent", intentFile],
        { detached: true, stdio: "ignore", env: childEnv() });
      child.unref();
      for (let i = 0; i < 500; i++) {
        receipt = readJson(receiptFile);
        if (receipt && alive(receipt.pid)) break;
        await new Promise(r => setTimeout(r, 10));
      }
    }
    if (!receipt || !alive(receipt.pid)) return refuse("resume-busy", "continuation runner not ready; retry the same sequence");
    writePrivate(path.join(dir, "state.json"), JSON.stringify({ ...state, sessionId, resumeSequence: sequence, continuationRunner: true, pid: receipt.pid, startedAt: receipt.startedAt }));
    if (state.direct) spawn(process.execPath, [fileURLToPath(import.meta.url), "watch", "--project", project, "--id", id,
      ...Object.entries(state.watchdog ?? {}).flatMap(([k,v]) => [`--${k}`, String(v)])], { detached: true, stdio: "ignore", env: childEnv() }).unref();
    process.stdout.write(`CODEX-RUNNING ${id} continuation ${sequence}\n`);
  });
}

async function continueProvider() {
  const intentFile = opt("intent"), intent = readJson(intentFile);
  if (!intent) throw new Error("missing continuation intent");
  await withAppendLock(path.join(path.dirname(intentFile), "provider"), fsp, async () => {
    const receiptFile = path.join(path.dirname(intentFile), "runner.json");
    const previous = readJson(receiptFile);
    // A committed sequence may have executed already: never replay it after runner death.
    if (previous && readJson(path.join(intent.dir, "state.json"))?.resumeSequence >= intent.sequence) return;
    const receipt = { pid: process.pid, startedAt: new Date().toISOString() };
    writePrivate(receiptFile, JSON.stringify(receipt));
    for (;;) {
      const state = readJson(path.join(intent.dir, "state.json"));
      if (state?.resumeSequence === intent.sequence && state.pid === process.pid) break;
      await new Promise(r => setTimeout(r, 25));
    }
    const child = launch(intent.dir, intent.cwd, intent.args, intent.tool, intent.prompt, false);
    await new Promise(resolve => child.once("exit", resolve));
  });
}

/** `read`: the sealed result. A v1 worker without one is an error; a finished direct worker is sealed here, because the
 *  engine CLI polls with `read` and no relay re-runs `run`; a direct worker still working answers CODEX-RUNNING. */
function read() {
  const id = opt("id");
  const dir = workerDir(id);
  const file = path.join(dir, "result.line");
  if (existsSync(file)) { process.stdout.write(readFileSync(file, "utf8")); return; }
  const state = readJson(path.join(dir, "state.json"));
  if (!state?.direct) fail("no-result", `no result for ${id}`);
  if (!existsSync(path.join(dir, "exit"))) {
    if (workerAlive(state)) { process.stdout.write(`CODEX-RUNNING ${id} since ${state.startedAt}: read again later\n`); return; }
    writeFileSync(path.join(dir, "exit"), "137\n");
  }
  settle(dir, id, state);
  process.stdout.write(readFileSync(file, "utf8"));
}

function stop() {
  if (!flag("all")) workerDir(opt("id"));   // validates the id
  emit({ status: "done", ok: true, killed: stopCodexWorkers(project, flag("all") ? undefined : [opt("id")]) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!isMain) { /* imported by a test: expose the helpers only */ }
else if (cmd === "run") await run();
else if (cmd === "resume") await resume();
else if (cmd === "continue-provider") await continueProvider();
else if (cmd === "read") read();
else if (cmd === "watch") await watch();
else if (cmd === "stop") stop();
else if (cmd === "fnv") process.stdout.write(`${fnv(readFileSync(opt("file"), "utf8").trimEnd())}\n`);
else if (cmd) fail("usage", `unknown command: ${cmd}`);
