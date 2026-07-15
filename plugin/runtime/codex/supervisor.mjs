#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { consumeBySupervisor, terminalAttendedPermit } from "./attended-permit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here,"../..");
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
const executionProfile = value("execution-profile");
const change = value("change", false), frds = value("frds", false);
const targeted = Boolean(change) !== Boolean(frds) && (!change || /^[a-z0-9-]+$/.test(change)) && (!frds || /^frd-[a-z0-9-]+$/.test(frds));
const maxDuration = Number(value("max-duration"));
const attendedPermit = value("attended-permit", false);
const attendedFd = Number(value("attended-fd", false));
if (!new Set(["attended_foreground", "certification"]).has(executionProfile)) throw new Error("unsupported Codex execution profile");
if (executionProfile === "attended_foreground" && (certificationReceipt || !targeted || !Number.isSafeInteger(maxDuration) || maxDuration > 7200 || !attendedPermit || !Number.isSafeInteger(attendedFd) || attendedFd < 3)) throw new Error("attended_foreground supervisor contract violated");
if (executionProfile === "certification" && !certificationReceipt) throw new Error("certification supervisor requires a receipt");
let executorSecret = "";
if (executionProfile === "attended_foreground") { const policy=JSON.parse(await readFile(path.join(pluginRoot,"runtime/skill-runtime-policy.json"),"utf8"));if(policy.overrides?.implement?.codex?.status!=="EXPERIMENTAL")throw new Error("attended_foreground is not enabled by canonical policy");const preflight=spawnSync("bash",[path.join(pluginRoot,"scripts/preflight-implement.sh"),project,"--target-runtime","codex","--run-mode","auto"],{cwd:project,encoding:"utf8"});if(preflight.status!==0)throw new Error(`attended supervisor preflight failed: ${preflight.stdout}${preflight.stderr}`);const launcherSecret=readFileSync(attendedFd,"utf8").trim(); ({ executorSecret } = await consumeBySupervisor(project, attendedPermit, { runId, change, frds, maxSpend: Number(value("max-spend")), maxDuration, maxRetries: Number(value("max-retries")), maxBlocks: Number(value("max-blocks")) }, launcherSecret)); }
const maxCrashes = executionProfile === "attended_foreground" || certificationReceipt ? 1 : Number(process.env.PANDACORP_SUPERVISOR_MAX_CRASHES || 3);
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
  const childArgs=[...args]; if(executionProfile==="attended_foreground"){const i=childArgs.indexOf("--attended-fd");childArgs[i+1]="3";}
  const command = ["node", executorPath, ...childArgs];
  child = spawn(command[0], command.slice(1), { cwd: project, stdio: executionProfile==="attended_foreground" ? ["ignore","inherit","inherit","pipe"] : "inherit", env: process.env }); if(executionProfile==="attended_foreground") child.stdio[3].end(executorSecret); event("worker_started", { pid: child.pid }); child.on("close", (code, signal) => resolve({ code, signal }));
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
if (executionProfile === "attended_foreground") await terminalAttendedPermit(project, attendedPermit, await terminal() || (stopping ? "stopped" : "supervisor-exit"));
