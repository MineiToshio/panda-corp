#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decide, normalizeClaudeUsage, readCodexFromRollouts } from "./capacity.mjs";

async function main() {
  const [command, ...args] = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--claude-usage-stdin") { options[key] = true; continue; }
    if (!["--task", "--only", "--log"].includes(key) || options[key] !== undefined || args[i + 1] == null) throw new Error(`Invalid option: ${key}`);
    options[key] = args[++i];
  }
  if (!["decide", "codex-reading"].includes(command)) throw new Error("Usage: capacity-cli.mjs decide --task '<json>' [--claude-usage-stdin] [--only claude|codex] [--log path] | codex-reading");
  if (command === "codex-reading" && args.length) throw new Error("codex-reading accepts no options");
  const now = process.env.PANDACORP_NOW ?? new Date().toISOString();
  const dir = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
  if (command === "codex-reading") return readCodexFromRollouts(dir, now);
  const task = JSON.parse(options["--task"] ?? "null");
  if (!task || Array.isArray(task) || typeof task !== "object") throw new Error("--task must contain a task object");
  if (options["--only"]) task.override = { ...(typeof task.override === "object" ? task.override : {}), tool: options["--only"] };
  let claude = null;
  if (options["--claude-usage-stdin"]) {
    let input = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) input += chunk;
    claude = normalizeClaudeUsage(JSON.parse(input), now);
  }
  const readings = { claude, codex: await readCodexFromRollouts(dir, now) };
  const decision = decide({ task, readings, now });
  if (options["--log"]) {
    const { id, type, risk, override, pin, imageDemandPp } = task;
    await appendFile(options["--log"], JSON.stringify({ at: new Date(now).toISOString(), task: { id, type, risk, override, pin, imageDemandPp },
      decision, reason: decision.reason, readings_used: decision.readings_used }) + "\n", { mode: 0o600 });
  }
  return decision;
}

try { console.log(JSON.stringify(await main())); }
catch (error) { console.error(`capacity: ${error.message}`); process.exitCode = 1; }
