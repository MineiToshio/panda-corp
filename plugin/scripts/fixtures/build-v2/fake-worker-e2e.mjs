#!/usr/bin/env node
// fake-worker-e2e.mjs — PANDACORP_FAKE_WORKER for the end-to-end suite (test-build-v2-e2e.mjs). It honors the same
// contract as fake-worker.mjs (codex-worker.mjs argv, `codex-workers/<id>/{state.json,exit,last.md,codex.log,result.line}`,
// one sealed line {"r":"<payload JSON>","sum":"<fnv(r)>"} on stdout) but derives everything from the unit BRIEF the engine
// wrote (build-engine-cli.md section 11.1), so it works for any unit id and kind the planner emits:
//   build | patch   appends one line to every literal path of "Write allowlist (`artifacts`)" (fallback: the fixture's
//                   WO -> artifact map over "- work orders:") inside --dir and reports those files, status done
//   review | deferred-review | audit
//                   returns a review-report.schema.json object: verdict pass, no findings, reviewer = the brief's cell
//   doubt-consult   returns {decision: <first option id or null>, rationale, confidence:"high", reversible:true}
//   docs | tests    status done, no files
// The answer is also written to the brief's report path when one is found (harmless when the engine writes it too).
// Plan ($PANDACORP_FAKE_WORKER_PLAN, optional): plan[unit] ?? plan["kind:<kind>"] ?? plan["*"] ?? "ok", where an entry is
//   "ok" | "limit" | "hang" | {"limit":"usage_limit"|"rate_limit"} | {"hang":true} | {"_push":"main"} (with "ok" otherwise)
//   _push: creates a dangling commit object (never moves a ref, never touches the worktree) and runs
//   `git push origin <sha>:refs/heads/<branch>` from --dir, appending {unit, exit, stderr} to $PANDACORP_E2E_PUSH_LOG.
//   A worker never commits and never sets PANDACORP_OWNER_RELEASE_OK; the push is the "rogue worker" of Y 3.3.1.
// Never touches anything outside --project/--dir; no network (the only remote is the fixture's bare repo).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (n) => { const i = argv.indexOf(`--${n}`); if (i >= 0) return argv[i + 1]; const eqArg = argv.find((a) => a.startsWith(`--${n}=`)); return eqArg ? eqArg.slice(n.length + 3) : undefined; };
const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const seal = (payload) => { const r = JSON.stringify(payload); return JSON.stringify({ r, sum: fnv(r) }); };
const project = path.resolve(opt("project") || process.cwd());
const dirOf = (id) => path.join(project, ".pandacorp/run/codex-workers", id);
const WO_ARTIFACTS = { "wo-01-001": ["src/alpha/list.ts"], "wo-01-002": ["src/alpha/filter.ts"], "wo-02-001": ["src/beta/view.ts"], "wo-02-002": ["src/lib/auth/session.ts"] };
const CATALOG = ["haiku", "sonnet", "opus", "fable", "luna", "terra", "sol", "astra"];
const SLUG_TO_KEY = { "gpt-6-luna": "luna", "gpt-6.1-terra": "terra", "gpt-6.1-sol": "sol", "gpt-6-astra": "astra" };

function parseBrief(text) {
  const head = text.match(/^#\s*Unit\s+(\S+?):\s*([a-z-]+)/m);
  const unit = head?.[1] || text.match(/^-\s*id:\s*(\S+)/m)?.[1] || text.match(/\bu-[a-z]+(?:-[A-Za-z0-9]+)+\b/)?.[0] || null;
  const kind = head?.[2] || text.match(/^-\s*kind:\s*([a-z-]+)/m)?.[1] || null;
  const tokens = [...text.matchAll(/^\s*token:\s*`?([^\s`]+)`?\s*$/gim)].map((m) => m[1]);
  const allow = text.match(/Write allowlist[^:]*:\s*(.+)$/m)?.[1] || "";
  const allowPaths = [...allow.matchAll(/`([^`]+)`/g)].map((m) => m[1]).concat(allow.includes("`") ? [] : allow.split(/[,\s]+/)).map((s) => s.trim()).filter((s) => s && !s.includes("*") && !/^<|^\(/.test(s) && /[./]/.test(s));
  const wos = (text.match(/^-\s*work orders:\s*(.+)$/m)?.[1] || "").split(/[,\s]+/).map((s) => s.replace(/[`[\]]/g, "").toLowerCase()).filter((s) => /^wo-\d/.test(s));
  const reportPath = text.match(/to\s+`([^`]+\.json)`/)?.[1] || text.match(/report path[^`]*`([^`]+\.json)`/i)?.[1] || null;
  const cell = text.match(/Runtime:\s*`?(claude|codex)`?,\s*model\s*`?([a-z0-9.-]+)`?,\s*effort\s*`?([a-z]+)`?/i);
  return { unit, kind, token: tokens.at(-1) || null, allowPaths, wos, reportPath, cell: cell ? { runtime: cell[1], model: cell[2], effort: cell[3] } : null };
}

if (cmd === "read") {
  const f = path.join(dirOf(opt("id")), "result.line");
  process.stdout.write(existsSync(f) ? readFileSync(f, "utf8") : `${seal({ status: "error", kind: "no-result", detail: `no result for ${opt("id")}` })}\n`);
} else if (cmd === "run") {
  const promptFile = opt("prompt-file");
  const brief = parseBrief(promptFile && existsSync(promptFile) ? readFileSync(promptFile, "utf8") : "");
  const unit = opt("unit") || process.env.PANDACORP_FAKE_WORKER_UNIT || brief.unit || opt("id") || "u-unknown";
  const kind = brief.kind || (unit.match(/^u-([a-z]+(?:-review|-consult)?)/)?.[1] ?? "build");
  const id = opt("id") || `w-${unit}-${process.pid}`;
  const dir = dirOf(id);
  mkdirSync(dir, { recursive: true });
  const resultFile = path.join(dir, "result.line");
  // Every `run` is a fresh dispatch (a re-queued unit may reuse its worker id after a takeover): stale results are replaced.
  for (const f of ["exit", "result.line", "last.md"]) rmSync(path.join(dir, f), { force: true });
  const slug = opt("codex-model") || "gpt-6.1-sol";
  const workDir = path.resolve(opt("dir") || process.cwd());
  writeFileSync(path.join(dir, "state.json"), JSON.stringify({ pid: process.pid, cwd: workDir, model: slug, effort: "medium", access: opt("access") || "sandbox", startedAt: process.env.PANDACORP_NOW || new Date().toISOString() }));
  const planFile = process.env.PANDACORP_FAKE_WORKER_PLAN;
  const plan = planFile && existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8")) : {};
  let entry = plan[unit] ?? plan[`kind:${kind}`] ?? plan["*"] ?? "ok";
  if (typeof entry === "string") entry = entry === "limit" ? { limit: "usage_limit" } : entry === "rate_limit" ? { limit: "rate_limit" } : entry === "hang" ? { hang: true } : {};
  const finish = (code, payload, last) => {
    writeFileSync(path.join(dir, "last.md"), last);
    writeFileSync(path.join(dir, "exit"), `${code}\n`);
    const line = seal({ status: "done", model: slug, effort: "medium", ...payload });
    writeFileSync(resultFile, `${line}\n`);
    process.stdout.write(`${line}\n`);
    process.exit(0);
  };
  if (entry.hang) {
    process.on("SIGTERM", () => { writeFileSync(path.join(dir, "exit"), "143\n"); process.exit(143); });
    setInterval(() => {}, 1 << 30);
  } else if (entry.limit) {
    const text = entry.limit === "rate_limit" ? "ERROR: 429 Too Many Requests (rate limit)\n" : "ERROR: You've hit your usage limit. Try again at 3:00 PM.\n";
    appendFileSync(path.join(dir, "codex.log"), text);
    finish(1, { ok: false, kind: "limit", detail: `codex exit 1, no final message: ${entry.limit}` }, text);
  } else {
    if (entry._push) {
      const env = { ...process.env };
      delete env.PANDACORP_OWNER_RELEASE_OK;
      const run = (args) => spawnSync("git", args, { cwd: workDir, env, encoding: "utf8" });
      const commit = run(["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "rogue worker push (fixture)"]);
      const sha = (commit.stdout || "").trim();
      const push = sha ? run(["push", "origin", `${sha}:refs/heads/${entry._push}`]) : { status: -1, stderr: commit.stderr };
      if (process.env.PANDACORP_E2E_PUSH_LOG) appendFileSync(process.env.PANDACORP_E2E_PUSH_LOG, `${JSON.stringify({ unit, sha, exit: push.status, stderr: String(push.stderr || "").slice(0, 2000) })}\n`);
    }
    const key = SLUG_TO_KEY[slug] || (CATALOG.includes(brief.cell?.model) ? brief.cell.model : "sol");
    let answer;
    if (["review", "deferred-review", "audit"].includes(kind)) {
      const reviewer = brief.cell && CATALOG.includes(brief.cell.model) ? { runtime: brief.cell.runtime.toLowerCase(), model: brief.cell.model, effort: ["minimal", "low", "medium", "high", "xhigh"].includes(brief.cell.effort) ? brief.cell.effort : "high" } : { runtime: "codex", model: key, effort: "high" };
      answer = { schema: 1, unit, token: brief.token || "faketoken0000000", reviewer, verdict: "pass", findings: [], probes: [], traceability: [], doubt: null };
    } else if (kind === "doubt-consult") {
      answer = { decision: null, rationale: "no source answers", confidence: "high", reversible: true };
    } else {
      const files = [];
      if (kind === "build" || kind === "patch") {
        const targets = brief.allowPaths.length ? brief.allowPaths : brief.wos.flatMap((w) => WO_ARTIFACTS[w] || []);
        for (const rel of [...new Set(targets)]) {
          const f = path.join(workDir, rel);
          mkdirSync(path.dirname(f), { recursive: true });
          appendFileSync(f, `export const e2e_${unit.replace(/[^A-Za-z0-9]/g, "_")} = 1;\n`);
          files.push(rel);
        }
      }
      answer = { schema: 1, unit, token: brief.token || "faketoken0000000", status: "done", summary: `fake e2e worker ${kind}`, files, verification: [{ command: "fake verify", exit_code: 0, tail: "ok" }], pending: [], doubt: null, diagnosis: null, gate: null, authored_by: { runtime: "codex", model: key, effort: "medium" } };
    }
    if (brief.reportPath && path.isAbsolute(brief.reportPath)) { try { mkdirSync(path.dirname(brief.reportPath), { recursive: true }); writeFileSync(brief.reportPath, `${JSON.stringify(answer)}\n`); } catch { /* the engine owns the report path; a write failure here changes nothing */ } }
    finish(0, { ok: true, answer }, JSON.stringify(answer));
  }
} else { process.stdout.write(`${seal({ status: "error", kind: "usage", detail: `unknown command: ${cmd}` })}\n`); }
