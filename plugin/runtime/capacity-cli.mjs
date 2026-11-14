#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { decideCapacity, ingestClaude, normalizeClaudeUsage, readCapacity, readCodexFromRollouts } from "./capacity.mjs";

async function main() {
  const [command, ...args] = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--claude-usage-stdin") { options[key] = true; continue; }
    if (!["--task", "--only", "--log"].includes(key) || options[key] !== undefined || args[i + 1] == null) throw new Error(`Invalid option: ${key}`);
    options[key] = args[++i];
  }
  if (!["decide", "codex-reading", "ingest-claude"].includes(command)) throw new Error("Usage: capacity-cli.mjs decide --task '<json>' [--claude-usage-stdin] [--only claude|codex] [--log path] | codex-reading | ingest-claude < get-usage.json");
  if (command === "codex-reading" && args.length) throw new Error("codex-reading accepts no options");
  const now = process.env.PANDACORP_NOW ?? new Date().toISOString();
  const dir = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
  if (command === "codex-reading") return readCodexFromRollouts(dir, now);
  if (command === "ingest-claude") {
    if (args.length) throw new Error("ingest-claude accepts JSON on stdin only");
    let input = ""; for await (const chunk of process.stdin) input += chunk;
    return ingestClaude(JSON.parse(input), { now });
  }
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
  const readings = readCapacity({ now });
  if (claude) readings.claude = claude;
  const decision = decideCapacity(task, { readings, now, log: options["--log"] });
  return decision;
}

try { console.log(JSON.stringify(await main())); }
catch (error) { console.error(`capacity: ${error.message}`); process.exitCode = 1; }
