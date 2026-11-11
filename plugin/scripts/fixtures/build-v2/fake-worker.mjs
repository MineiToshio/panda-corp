#!/usr/bin/env node
// fake-worker.mjs — PANDACORP_FAKE_WORKER (PLAN 3.16 A17): replaces codex-worker.mjs in tests.
//   run  [--project <dir>] [--id <worker id>] [--unit <unit id>] [--dir <work dir>] [--prompt-file <f>] [--codex-model m]
//        [--output-schema f] [--access a] [--direct] [...]   same argv as codex-worker.mjs; unknown flags are ignored
//   read [--project <dir>] --id <worker id>                  reprints the stored sealed line
// Writes <project>/.pandacorp/run/codex-workers/<id>/{state.json,exit,last.md,codex.log,result.line} and prints the
// sealed line {"r":"<payload JSON>","sum":"<fnv(r)>"} exactly like codex-worker.mjs (payload {status:"done",ok,answer|kind,detail,model,effort}).
// Unit id: --unit, else $PANDACORP_FAKE_WORKER_UNIT, else the first `u-...` token of the prompt file, else the worker id.
// Result per unit from the JSON file $PANDACORP_FAKE_WORKER_PLAN: plan[unit] ?? plan["*"] ?? "ok", where an entry is
//   "ok" | "red" | "doubt" | "limit" | "rate_limit" | "hang"          (mode shorthand)
//   {"limit":"usage_limit"|"rate_limit"} | {"hang":true}             (A17)
//   {<partial report>, "_writes": {"rel/path": "text"}}                a report object; missing report fields are filled;
//                                                                      _writes are applied under --dir (default cwd) first
// hang: writes state.json (pid) and sleeps without ever writing `exit`; SIGTERM writes exit 143 and exits.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const project = path.resolve(opt("project") || process.cwd());
const dirOf = (id) => path.join(project, ".pandacorp/run/codex-workers", id);
const seal = (payload) => { const r = JSON.stringify(payload); return JSON.stringify({ r, sum: fnv(r) }); };

if (cmd === "read") {
  const f = path.join(dirOf(opt("id")), "result.line");
  if (existsSync(f)) process.stdout.write(readFileSync(f, "utf8"));
  else process.stdout.write(`${seal({ status: "error", kind: "no-result", detail: `no result for ${opt("id")}` })}\n`);
} else if (cmd === "run") {
  const promptFile = opt("prompt-file");
  const prompt = promptFile && existsSync(promptFile) ? readFileSync(promptFile, "utf8") : "";
  const id = opt("id") || `w-${Date.now()}`;
  const unit = opt("unit") || process.env.PANDACORP_FAKE_WORKER_UNIT || prompt.match(/\bu-[a-z]+(?:-[A-Za-z0-9]+)+\b/)?.[0] || id;
  const token = prompt.match(/token\W+([A-Za-z0-9_-]{8,})/i)?.[1] || "faketoken0000000";
  const dir = dirOf(id);
  mkdirSync(dir, { recursive: true });
  const resultFile = path.join(dir, "result.line");
  if (existsSync(resultFile)) { process.stdout.write(readFileSync(resultFile, "utf8")); process.exit(0); }
  const model = opt("codex-model") || "gpt-6.1-sol";
  const effort = "medium";
  const workDir = path.resolve(opt("dir") || process.cwd());
  writeFileSync(path.join(dir, "state.json"), JSON.stringify({ pid: process.pid, cwd: workDir, model, effort, access: opt("access") || "sandbox", startedAt: process.env.PANDACORP_NOW || new Date().toISOString() }));
  const planFile = process.env.PANDACORP_FAKE_WORKER_PLAN;
  const plan = planFile && existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8")) : {};
  let entry = plan[unit] ?? plan["*"] ?? "ok";
  if (typeof entry === "string") entry = entry === "limit" ? { limit: "usage_limit" } : entry === "rate_limit" ? { limit: "rate_limit" } : entry === "hang" ? { hang: true } : { mode: entry };
  const finish = (code, payload, last) => {
    writeFileSync(path.join(dir, "last.md"), last);
    writeFileSync(path.join(dir, "exit"), `${code}\n`);
    const line = seal({ status: "done", model, effort, ...payload });
    writeFileSync(resultFile, `${line}\n`);
    process.stdout.write(`${line}\n`);
    process.exit(0);
  };
  if (entry.hang) {
    process.on("SIGTERM", () => { writeFileSync(path.join(dir, "exit"), "143\n"); process.exit(143); });
    setInterval(() => {}, 1 << 30);
  } else if (entry.limit) {
    appendFileSync(path.join(dir, "codex.log"), entry.limit === "rate_limit" ? "ERROR: 429 Too Many Requests (rate limit)\n" : "ERROR: You've hit your usage limit. Try again at 3:00 PM.\n");
    finish(1, { ok: false, kind: "limit", detail: `codex exit 1, no final message: ${entry.limit}` }, "");
  } else {
    const mode = entry.mode || "ok";
    const { _writes, mode: _m, ...given } = entry;
    for (const [rel, text] of Object.entries(_writes || {})) { const f = path.join(workDir, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text); }
    const base = { schema: 1, unit, token, status: "done", summary: `fake worker ${mode}`, files: Object.keys(_writes || {}), verification: [{ command: "fake verify", exit_code: 0, tail: "ok" }], pending: [], doubt: null, diagnosis: null, gate: null, authored_by: { runtime: "codex", model: "sol", effort: "medium" } };
    const byMode = mode === "red" ? { status: "failed", verification: [{ command: "fake verify", exit_code: 1, tail: "1 failing" }], diagnosis: { cause: "code", detail: "fake red" } }
      : mode === "doubt" ? { status: "doubt", doubt: { question: "Which approach?", options: [{ id: "a", text: "Option A" }, { id: "b", text: "Option B" }], preferred: "a", why: "fixture" } } : {};
    const answer = { ...base, ...byMode, ...given };
    finish(0, { ok: true, answer }, JSON.stringify(answer));
  }
} else { process.stdout.write(`${seal({ status: "error", kind: "usage", detail: `unknown command: ${cmd}` })}\n`); }
