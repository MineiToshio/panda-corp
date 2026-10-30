#!/usr/bin/env node
// test-codex-worker.mjs — codex-worker.mjs (DR-142) against a FAKE `codex` binary (PANDACORP_CODEX_BIN): the tier
// mapping, the exact `codex exec` argv, the prompt checksum guard, the long-run RUNNING/resume loop, the sealed
// result and its re-read, usage-limit classification and stop. Exit 0 green / 1 red; ends in `RESULT: N passed, M failed`.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codexTier, fnv } from "./codex-worker.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "codex-worker.mjs");
let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`); } else { failed++; console.log(`FAIL  ${msg}`); } };

const tmp = mkdtempSync(path.join(os.tmpdir(), "codex-worker-test-"));
const fake = path.join(tmp, "fake-codex.mjs");
// The fake records its argv + stdin, then behaves per FAKE_MODE: json | text | limit | slow.
writeFileSync(fake, `#!/usr/bin/env node
import { writeFileSync, readFileSync } from "node:fs";
const argv = process.argv.slice(2);
const out = argv[argv.indexOf("-o") + 1];
const stdin = readFileSync(0, "utf8");
writeFileSync(out + ".argv.json", JSON.stringify({ argv, stdin, cwd: process.cwd() }));
const mode = process.env.FAKE_MODE;
if (mode === "limit") { console.error("ERROR: You've hit your usage limit. Try again at 3pm."); process.exit(1); }
if (mode === "slow") await new Promise((r) => setTimeout(r, 4000));
writeFileSync(out, mode === "text" ? "built it\\n" : 'Done.\\n{"done":true,"sha":"abc123"}\\n');
`);
chmodSync(fake, 0o755);

const project = path.join(tmp, "proj");
mkdirSync(project, { recursive: true });
const runCli = (args, env = {}) => execFileSync("node", [CLI, ...args], { encoding: "utf8", env: { ...process.env, PANDACORP_CODEX_BIN: fake, ...env } }).trim();
const unseal = (line) => { const s = JSON.parse(line); return fnv(s.r) === s.sum ? JSON.parse(s.r) : null; };
const prep = (id, text) => { const dir = path.join(project, ".pandacorp/run/codex-workers", id); mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, "prompt.md"), `${text}\n`); return { dir, sum: fnv(text) }; };

// Tier mapping — model-tiers.json is the single source.
ok(JSON.stringify(codexTier("haiku")) === JSON.stringify({ model: "gpt-6-luna", effort: "low" }), "haiku → MECH tier (gpt-6-luna low)");
ok(JSON.stringify(codexTier("sonnet", "medium")) === JSON.stringify({ model: "gpt-6.1-sol", effort: "medium" }), "sonnet + medium → gpt-6.1-sol at the engine's effort");
ok(JSON.stringify(codexTier("opus")) === JSON.stringify({ model: "gpt-6.1-sol", effort: "high" }), "opus without effort → JUDGE tier default (high)");
ok(codexTier("sonnet", "minimal").effort === "low" && codexTier("weird-model").model === "gpt-6.1-sol", "minimal → low (Codex rejects it); an unknown alias → STANDARD");

// Happy path with a JSON answer.
{
  const { dir, sum } = prep("w1", "Build the thing.");
  const p = unseal(runCli(["run", "--project", project, "--id", "w1", "--sum", sum, "--model", "sonnet", "--effort", "medium", "--role", "pandacorp:implementer", "--json-answer", "--max", "20"], { FAKE_MODE: "json" }));
  ok(p && p.status === "done" && p.ok === true && p.answer.done === true && p.answer.sha === "abc123", "a JSON final message after prose → ok with the parsed answer");
  const rec = JSON.parse(readFileSync(path.join(dir, "last.md.argv.json"), "utf8"));
  const a = rec.argv;
  ok(a[0] === "exec" && a.includes("--ignore-user-config") && a[a.indexOf("-m") + 1] === "gpt-6.1-sol" && a.includes('model_reasoning_effort="medium"') && a.at(-1) === "-", "codex exec argv: ignores the user config, carries model + effort, prompt on stdin");
  ok(a[a.indexOf("-s") + 1] === "workspace-write" && a.includes("sandbox_workspace_write.network_access=true") && !a.includes("danger-full-access"), "default access is the workspace-write sandbox with network");
  ok(rec.stdin.includes("# Your role") && rec.stdin.includes("# Task\n\nBuild the thing.") && rec.stdin.includes("exactly ONE JSON object"), "the prompt carries the role instructions, the task and the JSON-answer rule");
  ok(path.resolve(rec.cwd) === path.resolve(project) || rec.cwd.endsWith("/proj"), "Codex runs in the project dir by default");
  const again = runCli(["run", "--project", project, "--id", "w1", "--sum", sum, "--model", "sonnet", "--max", "5"]);
  ok(unseal(again) && unseal(again).answer.sha === "abc123", "a repeated run returns the stored result, never a second Codex run");
  ok(unseal(runCli(["read", "--project", project, "--id", "w1"])).ok === true, "read reprints the sealed result");
}
// Full access is explicit.
{
  const { dir, sum } = prep("w2", "Commit it.");
  runCli(["run", "--project", project, "--id", "w2", "--sum", sum, "--model", "sonnet", "--access", "full", "--max", "20"], { FAKE_MODE: "text" });
  const a = JSON.parse(readFileSync(path.join(dir, "last.md.argv.json"), "utf8")).argv;
  ok(a[a.indexOf("-s") + 1] === "danger-full-access", "--access full → danger-full-access");
}
// Text answer, prompt mismatch, limit, long run.
{
  const { sum } = prep("w3", "Say something.");
  const p = unseal(runCli(["run", "--project", project, "--id", "w3", "--sum", sum, "--model", "haiku", "--max", "20"], { FAKE_MODE: "text" }));
  ok(p && p.ok && p.text === "built it\n" && p.model === "gpt-6-luna", "no --json-answer → the final message as text");
  prep("w4", "Original task.");
  const bad = runCli(["run", "--project", project, "--id", "w4", "--sum", fnv("A different task."), "--model", "haiku", "--max", "5"]);
  ok(/^CODEX-PROMPT-MISMATCH /.test(bad), "a prompt.md that differs from the engine's text is refused before Codex starts");
  const { sum: s5 } = prep("w5", "Hit the limit.");
  const lim = unseal(runCli(["run", "--project", project, "--id", "w5", "--sum", s5, "--model", "sonnet", "--max", "20"], { FAKE_MODE: "limit" }));
  ok(lim && lim.ok === false && lim.kind === "limit", "a Codex usage-limit exit is classified as limit");
  const { sum: s6 } = prep("w6", "Take a while.");
  const first = runCli(["run", "--project", project, "--id", "w6", "--sum", s6, "--model", "sonnet", "--json-answer", "--max", "1"], { FAKE_MODE: "slow" });
  ok(/^CODEX-RUNNING w6 /.test(first), "a worker still running past --max answers CODEX-RUNNING (the relay runs the command again)");
  let last = first;
  for (let i = 0; i < 15 && /^CODEX-RUNNING/.test(last); i++) last = runCli(["run", "--project", project, "--id", "w6", "--sum", s6, "--model", "sonnet", "--json-answer", "--max", "1"]);
  ok(unseal(last) && unseal(last).ok === true, "the same command later returns the finished result (Codex survived the earlier call's exit)");
  const { sum: s7 } = prep("w7", "Run long, then be stopped.");
  runCli(["run", "--project", project, "--id", "w7", "--sum", s7, "--model", "sonnet", "--max", "1"], { FAKE_MODE: "slow" });
  ok(unseal(runCli(["stop", "--project", project, "--all"])).killed.includes("w7"), "stop --all kills a running worker");
  ok(/^\{"r":"\{\\"status\\":\\"error\\",\\"kind\\":\\"bad-id\\"/.test(runCli(["run", "--project", project, "--id", "../escape", "--sum", "0", "--model", "x"])), "a worker id with path characters is refused");
}

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
