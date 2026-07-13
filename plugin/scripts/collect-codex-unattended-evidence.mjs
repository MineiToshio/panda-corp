#!/usr/bin/env node
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const project = path.resolve(process.argv[2] || ".");
const run = path.join(project, ".pandacorp/run");
const plugin = path.resolve(new URL("..", import.meta.url).pathname);
const json = async (name) => JSON.parse(await readFile(path.join(run, name), "utf8"));
const lines = async (name) => {
  const body = (await readFile(path.join(run, name), "utf8")).trim();
  return body ? body.split("\n").map((line) => JSON.parse(line)) : [];
};
const reject = (message) => { throw new Error(`unattended evidence is missing, corrupt, or inconsistent: ${message}`); };
const safePositive = (value) => Number.isSafeInteger(value) && value > 0;

const launch = await json("codex-launch.json");
const checkpoint = await json("codex-checkpoint.json");
const ledger = await json("run-ledger.json");
const supervisorAll = await lines("codex-supervisor.jsonl");
const executorAll = await lines("codex-executor.jsonl");
const runId = launch.run_id;

if (typeof runId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(runId)) reject("invalid launch run id");
if (launch.runtime !== "codex" || checkpoint.run_id !== runId || ledger.run_id !== runId) reject("launch/checkpoint/ledger run ids differ");
if (!safePositive(launch.supervisor_pid ?? launch.pid) || !safePositive(launch.sleep_inhibitor_pid)) reject("invalid launcher PIDs");
if (!Array.isArray(launch.supervisor_argv) || !launch.supervisor_argv.includes("--run-id") || launch.supervisor_argv[launch.supervisor_argv.indexOf("--run-id") + 1] !== runId) reject("supervisor argv is absent or belongs to another run");
const certificationIndex = launch.supervisor_argv.indexOf("--certification-receipt");
const certificationPath = certificationIndex >= 0 ? launch.supervisor_argv[certificationIndex + 1] : "";
const normalResume = Array.isArray(launch.resume_argv) && launch.resume_argv.length === 11 && launch.resume_argv.at(-2) === runId && ["background", "foreground"].includes(launch.resume_argv.at(-1));
const certificationResume = Array.isArray(launch.resume_argv) && launch.resume_argv.length === 12 && launch.resume_argv[9] === runId && launch.resume_argv[10] === "foreground" && path.resolve(launch.resume_argv[11] || "").startsWith(`${run}${path.sep}`);
if ((!normalResume && !certificationResume) || launch.resume_argv[0] !== "bash" || path.basename(launch.resume_argv[1] || "") !== "launch-codex-implement.sh") reject("resume argv is not the exact guarded launcher continuation");
if (Boolean(certificationPath) !== certificationResume) reject("certification receipt and guarded launcher argv disagree");
let certification = null;
if (certificationPath) {
  const absolute = path.resolve(certificationPath); const entry = await lstat(absolute);
  if (entry.isSymbolicLink() || absolute !== path.join(run, "r11-certification-receipt.json")) reject("R11 receipt path is not the exact real in-tree path");
  certification = JSON.parse(await readFile(absolute, "utf8"));
  const expectedLimits = { max_spend: Number(launch.resume_argv[3]), max_duration: Number(launch.resume_argv[4]), max_retries: Number(launch.resume_argv[5]), max_blocks: Number(launch.resume_argv[6]) };
  if (certification.kind !== "pandacorp-r11-certification-receipt" || certification.stage !== "codex-live-overnight" || certification.status !== "revoked" || certification.run_id !== runId || certification.frds?.join(",") !== launch.resume_argv[8] || Object.entries(expectedLimits).some(([key, value]) => certification.limits?.[key] !== value)) reject("R11 certification receipt is absent, live, forged, or drifted");
}

const start = Date.parse(launch.started_at);
const end = Date.parse(checkpoint.terminal_at);
if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) reject("invalid wall-clock interval");
if (checkpoint.terminal_reason !== "complete") reject(`terminal checkpoint is ${checkpoint.terminal_reason || "absent"}, not complete`);
if (!Number.isSafeInteger(ledger.spend_units) || ledger.spend_units < 0 || !Number.isSafeInteger(ledger.dispatch_count) || ledger.dispatch_count < 0) reject("invalid durable ledger counters");

for (const item of executorAll) {
  if (item?.runtime !== "codex" || typeof item.run_id !== "string" || typeof item.event_id !== "string" || !item.event_id || typeof item.semantic_name !== "string") reject("executor journal contains an unnormalized record");
}
for (const item of supervisorAll) if (typeof item?.run_id !== "string" || typeof item.event !== "string") reject("supervisor journal contains an unnormalized record");
const executor = executorAll.filter((item) => item.run_id === runId);
const supervisor = supervisorAll.filter((item) => item.run_id === runId);
const eventIds = executor.map((item) => item.event_id);
if (new Set(eventIds).size !== eventIds.length) reject("duplicate executor event ids");

const launches = executor.filter((item) => item.semantic_name === "build.launch");
const completes = executor.filter((item) => item.semantic_name === "build.complete" && item.data?.reason === "complete");
const releases = executor.filter((item) => item.semantic_name === "lease.released" && item.data?.reason === "complete");
const supervisorTerminals = supervisor.filter((item) => item.event === "supervisor_terminal" && item.reason === "complete");
if (launches.length !== 1 || completes.length !== 1 || releases.length !== 1 || supervisorTerminals.length !== 1) reject("terminal event chain is absent, duplicated, or has a foreign reason");
const heartbeat = launches[0];
if (!Number.isSafeInteger(heartbeat.data?.lease_ttl_seconds) || heartbeat.data.lease_ttl_seconds < 3 || !Number.isSafeInteger(heartbeat.data?.heartbeat_interval_ms) || heartbeat.data.heartbeat_interval_ms < 100) reject("heartbeat contract is invalid");
const heartbeatWithinTtlThird = heartbeat.data.heartbeat_interval_ms <= heartbeat.data.lease_ttl_seconds * 1000 / 3;
if (!heartbeatWithinTtlThird) reject("heartbeat exceeds TTL/3");
const dispatchIds = new Set(executor.filter((item) => item.subject && item.semantic_name === "agent.working").map((item) => item.data?.dispatch_id).filter(Boolean));
if (dispatchIds.size !== ledger.dispatch_count || ledger.spend_units < ledger.dispatch_count) reject("journal dispatches do not match the durable ledger");
if (await lstat(path.join(run, "build.lease")).then(() => true).catch((error) => error.code === "ENOENT" ? false : Promise.reject(error))) reject("build lease still exists after terminal completion");

const reviewedFrds = new Set();
for (const id of dispatchIds) {
  const match = /^review-(.+)-a\d+$/.exec(id);
  if (match) reviewedFrds.add(match[1]);
}
const durationSeconds = Math.floor((end - start) / 1000);
const overnightEligible = durationSeconds >= 3 * 60 * 60 && reviewedFrds.size >= 2;
const policy = JSON.parse(await readFile(path.join(plugin, "runtime/skill-runtime-policy.json"), "utf8"));
const implementStatus = policy.overrides?.implement?.codex?.status || policy.defaults?.codex?.status;
if (overnightEligible && implementStatus !== "PROVEN" && !certification) reject("LIVE_OVERNIGHT while FALLBACK lacks the one-shot R11 receipt");
const evidence = {
  schema_version: 2,
  evidence_class: overnightEligible ? "LIVE_OVERNIGHT" : "LIVE_SHORT",
  verdict: "GO",
  project,
  run_id: runId,
  started_at: launch.started_at,
  terminal_at: checkpoint.terminal_at,
  duration_seconds: durationSeconds,
  terminal_reason: checkpoint.terminal_reason,
  representative_frd_count: reviewedFrds.size,
  overnight_eligible: overnightEligible,
  certification: certification ? "R11_ONE_SHOT" : null,
  lease_ttl_seconds: heartbeat.data.lease_ttl_seconds,
  heartbeat_interval_ms: heartbeat.data.heartbeat_interval_ms,
  heartbeat_within_ttl_third: heartbeatWithinTtlThird,
  durable_spend_units: ledger.spend_units,
  durable_dispatch_count: ledger.dispatch_count,
  supervisor_terminal: true,
  lease_released: true,
  collected_at: new Date().toISOString(),
};
const output = path.join(run, `codex-unattended-evidence-${runId}.json`);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ...evidence, output }, null, 2)}\n`);
