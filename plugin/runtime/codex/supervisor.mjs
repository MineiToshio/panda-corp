#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const value = (name, required = true) => { const index = args.indexOf(`--${name}`); if (index < 0 || !args[index + 1]) { if (required) throw new Error(`missing --${name}`); return ""; } return args[index + 1]; };
const project = path.resolve(value("project"));
const runId = value("run-id");
const log = path.join(project, ".pandacorp/run/codex-supervisor.jsonl");
const checkpoint = path.join(project, ".pandacorp/run/codex-checkpoint.json");
const executorPath = process.env.PANDACORP_EXECUTOR_PATH || path.join(here, "executor.mjs");
const leaseTtlMs = Number(process.env.PANDACORP_LEASE_TTL_SECONDS || 600) * 1000;
const restartWaitMs = Number(process.env.PANDACORP_SUPERVISOR_RESTART_WAIT_MS || leaseTtlMs + 10000);
const certificationReceipt = value("certification-receipt", false);
const maxCrashes = certificationReceipt ? 1 : Number(process.env.PANDACORP_SUPERVISOR_MAX_CRASHES || 3);
if (!Number.isSafeInteger(restartWaitMs) || restartWaitMs < 1 || !Number.isSafeInteger(maxCrashes) || maxCrashes < 1) throw new Error("invalid supervisor recovery configuration");
const terminalReasons = new Set(["complete", "needs-owner", "budget", "rethink", "duration", "breaker", "uncertain", "stopped"]);
let child;
let stopping = false;
let cancelBackoff = null;
const event = (event, data = {}) => appendFile(log, `${JSON.stringify({ at: new Date().toISOString(), event, run_id: runId, ...data })}\n`, { mode: 0o600 });
const wait = (ms) => new Promise((resolve) => {
  const timer = setTimeout(() => { cancelBackoff = null; resolve(); }, ms);
  cancelBackoff = () => { clearTimeout(timer); cancelBackoff = null; resolve(); };
});
const terminal = async () => { try { const value = JSON.parse(await readFile(checkpoint, "utf8")); return value.run_id === runId ? value.terminal_reason || null : null; } catch { return null; } };
const launch = () => new Promise((resolve) => {
  const command = ["node", executorPath, ...args];
  child = spawn(command[0], command.slice(1), { cwd: project, stdio: "inherit", env: process.env }); event("worker_started", { pid: child.pid }); child.on("close", (code, signal) => resolve({ code, signal }));
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => {
  stopping = true;
  event("supervisor_signal", { signal });
  cancelBackoff?.();
  child?.kill(signal);
});

let crashes = 0;
while (!stopping) {
  const result = await launch(); const reason = await terminal(); await event("worker_stopped", { ...result, terminal_reason: reason });
  if (stopping) { await event("supervisor_terminal", { reason: reason || "stopped" }); break; }
  if (terminalReasons.has(reason)) { await event("supervisor_terminal", { reason }); break; }
  if (result.code === 0) { await event("supervisor_protocol_error", { reason: "worker exited zero without a terminal checkpoint" }); process.exitCode = 2; break; }
  crashes++;
  if (crashes >= maxCrashes) { await event("supervisor_exhausted", { crashes, reason: "unclassified-crash" }); process.exitCode = 2; break; }
  // A crash has no trustworthy outcome. Wait past the 600 s lease TTL, then let the SAME run-id
  // executor reclaim and reconcile. The executor never launches a replacement model dispatch for
  // an inflight checkpoint; it persists needs-owner instead.
  const boundedBackoffMs = Math.min(restartWaitMs * (2 ** (crashes - 1)), restartWaitMs * 4);
  await event("restart_wait", { attempt: crashes, seconds: boundedBackoffMs / 1000, reason: "unclassified-crash" }); await wait(boundedBackoffMs);
}
