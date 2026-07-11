#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const policy = JSON.parse(readFileSync(path.join(root, "plugin/runtime/enforcement-policy.json"), "utf8"));
const argv = process.argv.slice(2);
const value = (flag) => { const index = argv.indexOf(`--${flag}`); return index < 0 ? "" : argv[index + 1] || ""; };
const runtime = value("runtime");
const event = value("event");

const deny = (message) => {
  process.stderr.write(`Pandacorp enforcement BLOCKED: ${message}\n`);
  process.exit(2);
};

if (!Object.hasOwn(policy.runtime_local_dispatch, runtime)) deny(`unsupported runtime adapter: ${runtime || "missing"}`);
if (!new Set(["pre-tool", "stop"]).has(event)) deny(`unsupported hook event: ${event || "missing"}`);

let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 1024 * 1024) deny("hook payload exceeds 1 MiB");
}

let payload;
try { payload = JSON.parse(raw); } catch { deny("invalid JSON hook payload"); }
if (!payload || Array.isArray(payload) || typeof payload !== "object") deny("hook payload must be an object");
const cwd = payload.cwd;
if (typeof cwd !== "string" || cwd.length === 0) deny("hook payload is missing cwd");

const input = payload.tool_input ?? payload.toolInput ?? payload.input;
const toolName = String(payload.tool_name ?? payload.toolName ?? payload.tool ?? "");
const normalized = { ...payload, cwd, pandacorp_runtime: runtime };

const runHandler = (relative, body) => {
  const absolute = path.join(root, relative);
  const child = spawnSync("/bin/bash", [absolute], {
    input: `${JSON.stringify(body)}\n`,
    encoding: "utf8",
    env: process.env,
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) deny(`handler failed to start: ${child.error.message}`);
  process.exit(child.status ?? 2);
};

if (event === "stop") {
  runHandler(policy.handlers.stop_gate, normalized);
}

if (!input || Array.isArray(input) || typeof input !== "object") deny("PreToolUse payload is missing tool input");
const command = input.command ?? input.cmd;
const patch = input.patch ?? input.diff ?? input.content ?? "";
const filePath = input.file_path ?? input.filePath ?? input.path ?? "";
const looksCommand = typeof command === "string" || /Bash|exec_command|shell|unified_exec/i.test(toolName);
const looksWrite = typeof patch === "string" && patch.length > 0 || typeof filePath === "string" && filePath.length > 0 || /Write|Edit|apply_patch/i.test(toolName);

if (looksCommand) {
  if (typeof command !== "string" || command.trim().length === 0) deny("command hook payload has no command string");
  const forbiddenRuntime = policy.runtime_local_dispatch[runtime];
  const runtimePattern = new RegExp(`(^|[;&|()\\s/])${forbiddenRuntime}(?=\\s|$)`, "i");
  if (runtimePattern.test(command)) deny(`${runtime} may not dispatch the ${forbiddenRuntime} runtime`);

  if (command.includes(policy.fenced_cli.path_suffix) || command.includes("pandacorp-build-state.mjs")) {
    const commandMatch = command.match(/pandacorp-build-state\.mjs["']?\s+([a-z-]+)/);
    const cliCommand = commandMatch?.[1] || "";
    if (!cliCommand) deny("build-state CLI command is missing");
    if (policy.fenced_cli.runtime_commands.includes(cliCommand)) {
      const runtimeMatch = command.match(/--runtime(?:=|\s+)([a-z-]+)/);
      if (runtimeMatch?.[1] !== runtime) deny(`build-state ${cliCommand} must declare --runtime ${runtime}`);
    }
    if (policy.fenced_cli.fenced_commands.includes(cliCommand)) {
      if (!/--token(?:=|\s+)\S+/.test(command) || !/--epoch(?:=|\s+)\d+/.test(command)) deny(`build-state ${cliCommand} requires token + epoch fencing`);
    }
  }
  normalized.tool_name = toolName || "Bash";
  normalized.tool_input = { ...input, command };
  runHandler(policy.handlers.dangerous_command, normalized);
}

if (looksWrite) {
  const material = `${filePath}\n${patch}`;
  if (runtime === "codex" && policy.governed_build_markers.some((marker) => material.includes(marker))) {
    deny("Codex may not directly mutate governed build state; use the fenced transition CLI after its R6 slice is certified");
  }
  normalized.tool_name = toolName || "Write";
  normalized.tool_input = { ...input, file_path: filePath, patch };
  runHandler(policy.handlers.write_nudge, normalized);
}

deny(`unrecognized PreToolUse payload for tool ${toolName || "missing"}`);
