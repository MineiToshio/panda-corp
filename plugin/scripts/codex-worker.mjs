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
//   fnv  --file <path>   prints the checksum the engine expects for that file (tests and manual runs).
//   read --project <dir> --id <id>   reprints the final sealed line (the engine's re-read when a copy was garbled).
//   stop --project <dir> (--id <id> | --all)   kills running Codex workers (a stopped or lost build leaves none behind).
//
// The relay writes the task to <project>/.pandacorp/run/codex-workers/<id>/prompt.md with its Write tool; --sum is
// the engine's FNV-1a of that text, so a truncated or altered copy is refused (status:error, kind:prompt-mismatch).
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, openSync, closeSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopCodexWorkers } from "../runtime/codex-workers.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS = process.env.PANDACORP_EVENTS_FILE || path.join(os.homedir(), ".claude/dashboard-events.ndjson");
const CODEX_BIN = process.env.PANDACORP_CODEX_BIN || "codex";
const ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const TASK_BEGIN = "<<<CODEX-TASK-BEGIN>>>";
const TASK_END = "<<<CODEX-TASK-END>>>";
const TRANSCRIPT_MAX_AGE_MS = 60 * 60 * 1000;

// Codex's own usage-limit / rate-limit wording (an exhausted subscription window, not a defect of the work).
const LIMIT_RE = /usage limit|rate[ _-]?limit|too many requests|\b429\b|quota|upgrade to (?:plus|pro)|try again (?:at|in)/i;

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
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

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

function start(dir, id) {
  const promptFile = path.join(dir, "prompt.md");
  let recovered = null;
  try { recovered = promptFromTranscript(id, opt("sum")); }
  catch (e) { process.stderr.write(`codex-worker: transcript not usable, falling back to the relay's copy (${e.message})\n`); }
  if (recovered !== null) writeFileSync(promptFile, recovered);
  const mismatch = (why) => { process.stdout.write(`CODEX-PROMPT-MISMATCH ${why}: rewrite prompt.md exactly, then run the same command again\n`); process.exit(0); };
  if (!existsSync(promptFile)) mismatch(`missing ${promptFile}`);
  const task = readFileSync(promptFile, "utf8").trimEnd();
  if (fnv(task) !== opt("sum")) mismatch(`checksum ${fnv(task)} != expected ${opt("sum")} (${task.length} chars)`);
  const cwd = workDir();
  if (!existsSync(cwd)) fail("bad-dir", `work dir does not exist: ${cwd}`);
  const role = roleInstructions(opt("role"));
  const full = [
    role && `# Your role\n\n${role}`,
    "# Runtime note\n\nYou are running as a Codex worker dispatched by the Pandacorp build engine. Where the task below mentions Claude tools (Read/Write/Edit/Bash/Grep/Glob), use your own equivalent tools. Do everything the task asks inside the working directory; the engine verifies your result independently.",
    `# Task\n\n${task}`,
    flag("json-answer") && "# Final answer\n\nYour FINAL message must be exactly ONE JSON object (no prose before or after it, no code fence) that validates against the JSON Schema given in the task.",
  ].filter(Boolean).join("\n\n");
  writeFileSync(path.join(dir, "full-prompt.md"), full);
  const tier = codexTier(opt("model"), opt("effort"));
  // --access sandbox (default): Codex's workspace-write sandbox with network. It keeps every `.git` read-only even
  // under --add-dir (verified 2026-10-29: `git commit` fails on index.lock), so a sandboxed worker can edit and test
  // but never commit. --access full gives the worker the reach of the Claude worker it replaces; it is the owner's
  // explicit launch choice (launch-implement.sh --codex-access full), never a default this script picks.
  const access = opt("access") === "full"
    ? ["-s", "danger-full-access"]
    : ["-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true"];
  const args = ["exec", "--ignore-user-config", "--skip-git-repo-check", "--json", "-C", cwd, ...access,
    "-m", tier.model, "-c", `model_reasoning_effort="${tier.effort}"`, "-o", path.join(dir, "last.md"), "-"];
  const q = (s) => `'${String(s).replaceAll("'", `'"'"'`)}'`;
  // The shell wrapper records the exit code: the next `run` may be a different process than the one that spawned Codex.
  const script = `${[CODEX_BIN, ...args].map(q).join(" ")} < ${q(path.join(dir, "full-prompt.md"))}; echo $? > ${q(path.join(dir, "exit"))}`;
  const out = openSync(path.join(dir, "codex.log"), "a");
  const child = spawn("/bin/sh", ["-c", script], { cwd, detached: true, stdio: ["ignore", out, out] });
  closeSync(out);
  child.unref();
  writeFileSync(path.join(dir, "state.json"), JSON.stringify({ pid: child.pid, cwd, model: tier.model, effort: tier.effort, access: opt("access") || "sandbox", startedAt: new Date().toISOString() }));
  telemetry("worker_started", { id, role: opt("role"), model: tier.model, effort: tier.effort, access: opt("access") || "sandbox" });
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
  const last = existsSync(path.join(dir, "last.md")) ? readFileSync(path.join(dir, "last.md"), "utf8") : "";
  const log = existsSync(path.join(dir, "codex.log")) ? readFileSync(path.join(dir, "codex.log"), "utf8") : "";
  const base = { status: "done", model: state.model, effort: state.effort };
  if (code !== 0 || !last.trim()) {
    const errors = log.split("\n").filter((l) => /error|limit|fail/i.test(l)).slice(-5).join(" | ");
    return { ...base, ok: false, kind: LIMIT_RE.test(errors) ? "limit" : "error", detail: `codex exit ${code}${last.trim() ? "" : ", no final message"}: ${errors}`.slice(0, 600) };
  }
  if (!flag("json-answer")) return { ...base, ok: true, text: last };
  const answer = lastJsonObject(last);
  return answer ? { ...base, ok: true, answer } : { ...base, ok: false, kind: "bad-answer", detail: `final message is not one JSON object: ${last.slice(0, 300)}` };
}

async function run() {
  const id = opt("id");
  const dir = workerDir(id);
  mkdirSync(dir, { recursive: true });
  const resultFile = path.join(dir, "result.line");
  if (existsSync(resultFile)) { process.stdout.write(readFileSync(resultFile, "utf8")); return; }
  let state = readJson(path.join(dir, "state.json"));
  if (!state) { start(dir, id); state = readJson(path.join(dir, "state.json")); }
  const deadline = Date.now() + Math.min(Number(opt("max")) || 540, 570) * 1000;
  while (!existsSync(path.join(dir, "exit"))) {
    if (!alive(state.pid)) { await new Promise((r) => setTimeout(r, 1000)); if (!existsSync(path.join(dir, "exit"))) writeFileSync(path.join(dir, "exit"), "137\n"); break; }
    // Plain text on purpose: the relay only has to spot this word and run the same command again.
    if (Date.now() >= deadline) { process.stdout.write(`CODEX-RUNNING ${id} since ${state.startedAt}: run the same command again\n`); return; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const result = finish(dir, state);
  writeFileSync(resultFile, `${emit(result)}\n`);
  telemetry("worker_stopped", { id, role: opt("role"), model: state.model, effort: state.effort, ok: result.ok, kind: result.kind || "", seconds: Math.round((Date.now() - Date.parse(state.startedAt)) / 1000) });
}

function stop() {
  if (!flag("all")) workerDir(opt("id"));   // validates the id
  emit({ status: "done", ok: true, killed: stopCodexWorkers(project, flag("all") ? undefined : [opt("id")]) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!isMain) { /* imported by a test: expose the helpers only */ }
else if (cmd === "run") await run();
else if (cmd === "read") {
  const file = path.join(workerDir(opt("id")), "result.line");
  if (existsSync(file)) process.stdout.write(readFileSync(file, "utf8")); else fail("no-result", `no result for ${opt("id")}`);
} else if (cmd === "stop") stop();
else if (cmd === "fnv") process.stdout.write(`${fnv(readFileSync(opt("file"), "utf8").trimEnd())}\n`);
else if (cmd) fail("usage", `unknown command: ${cmd}`);
