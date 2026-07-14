#!/usr/bin/env node
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

const project = await realpath(path.resolve(process.argv[2] || "."));
const run = path.join(project, ".pandacorp/run");
const plugin = path.resolve(new URL("..", import.meta.url).pathname);
const json = async (name) => JSON.parse(await readFile(path.join(run, name), "utf8"));
const lines = async (name) => {
  const body = (await readFile(path.join(run, name), "utf8")).trim();
  return body ? body.split("\n").map((line) => JSON.parse(line)) : [];
};
const reject = (message) => { throw new Error(`unattended evidence is missing, corrupt, or inconsistent: ${message}`); };
const safePositive = (value) => Number.isSafeInteger(value) && value > 0;
const collectedAt = new Date().toISOString();
const collectedAtMs = Date.parse(collectedAt);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const regularJson = async (file, label) => {
  const entry = await lstat(file); const actual = await realpath(file);
  if (entry.isSymbolicLink() || !entry.isFile() || actual !== file) reject(`${label} is not a real regular file`);
  return JSON.parse(await readFile(file, "utf8"));
};

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
const resumeAuthorization = Array.isArray(launch.resume_argv) && launch.resume_argv.length === 12 ? await realpath(path.resolve(launch.resume_argv[11] || "")).catch(() => "") : "";
const certificationResume = Array.isArray(launch.resume_argv) && launch.resume_argv.length === 12 && launch.resume_argv[9] === runId && launch.resume_argv[10] === "foreground" && resumeAuthorization.startsWith(`${run}${path.sep}`);
if ((!normalResume && !certificationResume) || launch.resume_argv[0] !== "bash" || path.basename(launch.resume_argv[1] || "") !== "launch-codex-implement.sh") reject("resume argv is not the exact guarded launcher continuation");
if (Boolean(certificationPath) !== certificationResume) reject("certification receipt and guarded launcher argv disagree");
let certification = null;
if (certificationPath) {
  const input = path.resolve(certificationPath); const entry = await lstat(input); const absolute = await realpath(input);
  if (entry.isSymbolicLink() || absolute !== path.join(run, "r11-certification-receipt.json")) reject("R11 receipt path is not the exact real in-tree path");
  certification = JSON.parse(await readFile(absolute, "utf8"));
  const expectedLimits = { max_spend: Number(launch.resume_argv[3]), max_duration: Number(launch.resume_argv[4]), max_retries: Number(launch.resume_argv[5]), max_blocks: Number(launch.resume_argv[6]) };
  const marker = await regularJson(path.join(project, ".pandacorp/certification/r11.json"), "R11 marker");
  const authorizationInput = path.resolve(launch.resume_argv[11] || "");
  const authorizationEntry = await lstat(authorizationInput); const authorizationPath = await realpath(authorizationInput);
  if (authorizationEntry.isSymbolicLink()) reject("R11 authorization path is not canonical");
  if (authorizationPath !== path.join(run, "r11-owner-authorization.json")) reject("R11 authorization path is not canonical");
  const authorization = await regularJson(authorizationPath, "R11 owner authorization");
  const pinKeys = ["executor_sha256", "supervisor_sha256", "launcher_sha256"];
  const pinsMatch = pinKeys.every((key) => /^[0-9a-f]{64}$/.test(certification[key] || "") && certification[key] === marker[key] && certification[key] === authorization[key]);
  const identityMatches = certification.schema === 1 && certification.kind === "pandacorp-r11-certification-receipt" && certification.certification === "r11" && certification.stage === "codex-live-overnight" && certification.status === "revoked" && certification.run_id === runId && /^[0-9a-f-]{36}$/i.test(certification.fixture_uuid || "") && certification.fixture_uuid === marker.fixture_uuid && certification.fixture_uuid === authorization.fixture_uuid && /^[0-9a-f-]{36}$/i.test(certification.nonce || "") && certification.nonce === authorization.nonce && /^[0-9a-f-]{36}$/i.test(certification.launcher_instance || "");
  const scopeMatches = marker.schema === 1 && marker.kind === "pandacorp-r11-installed-canary" && authorization.schema === 1 && authorization.kind === "pandacorp-r11-owner-authorization" && marker.fixture_path === project && authorization.fixture_path === project && typeof marker.seed_commit === "string" && marker.seed_commit && authorization.seed_commit === marker.seed_commit && typeof authorization.authorized_head === "string" && authorization.authorized_head && marker.launch_mode === "foreground" && authorization.launch_mode === "foreground" && marker.stage === certification.stage && authorization.stage === certification.stage && same(certification.frds, marker.frds) && same(certification.frds, authorization.frds) && certification.frds?.join(",") === launch.resume_argv[8] && same(certification.limits, expectedLimits) && same(certification.limits, marker.limits) && same(certification.limits, authorization.limits) && certification.plugin_version === marker.plugin_version && certification.plugin_version === authorization.plugin_version && certification.overlay_version === marker.overlay_version && certification.overlay_version === authorization.overlay_version;
  if (!identityMatches || !scopeMatches || !pinsMatch) reject("R11 certification receipt is absent, incomplete, forged, or drifted from marker/authorization");
}

const start = Date.parse(launch.started_at);
const end = Date.parse(checkpoint.terminal_at);
if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) reject("invalid wall-clock interval");
if (checkpoint.terminal_reason !== "complete") reject(`terminal checkpoint is ${checkpoint.terminal_reason || "absent"}, not complete`);
if (checkpoint.updated_at !== checkpoint.terminal_at) reject("terminal checkpoint does not represent one atomic instant");
if (checkpoint.version !== 2 || checkpoint.inflight !== null || checkpoint.uncertain !== null) reject("terminal checkpoint is not a clean version-2 terminal state");
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
const buildStartedAt = launches[0].at; const buildStarted = Date.parse(buildStartedAt); const launcherReceiptAt = Date.parse(launch.started_at);
if (!Number.isFinite(buildStarted) || !Number.isFinite(launcherReceiptAt) || launcherReceiptAt > end || launcherReceiptAt > collectedAtMs) reject("launcher/build start evidence is invalid or post-terminal");
const causal = certification ? [["receipt consumption", certification.consumed_at], ["executor build launch", buildStartedAt]] : [["executor build launch", buildStartedAt]];
causal.push(["checkpoint", checkpoint.terminal_at], ["executor completion", completes[0]?.at], ["lease release", releases[0]?.at], ["supervisor terminal", supervisorTerminals[0]?.at]);
if (certification) {
  const revokedAt = Date.parse(certification.terminal_at);
  const consumedAt = Date.parse(certification.consumed_at);
  if (certification.terminal_reason !== "exit-0" || !Number.isFinite(consumedAt) || consumedAt > start || !Number.isFinite(revokedAt)) reject("R11 receipt does not match successful terminal completion");
  causal.push(["receipt revocation", certification.terminal_at]);
}
let previous = -Infinity;
for (const [label, value] of causal) {
  const observed = Date.parse(value);
  if (!Number.isFinite(observed) || observed < previous || observed > collectedAtMs) reject(`${label} violates terminal causal order`);
  previous = observed;
}
const heartbeat = launches[0];
if (!Number.isSafeInteger(heartbeat.data?.lease_ttl_seconds) || heartbeat.data.lease_ttl_seconds < 3 || !Number.isSafeInteger(heartbeat.data?.heartbeat_interval_ms) || heartbeat.data.heartbeat_interval_ms < 100) reject("heartbeat contract is invalid");
const heartbeatWithinTtlThird = heartbeat.data.heartbeat_interval_ms <= heartbeat.data.lease_ttl_seconds * 1000 / 3;
if (!heartbeatWithinTtlThird) reject("heartbeat exceeds TTL/3");
const dispatchIds = new Set(executor.filter((item) => item.subject && item.semantic_name === "agent.working").map((item) => item.data?.dispatch_id).filter(Boolean));
if (dispatchIds.size !== ledger.dispatch_count || ledger.spend_units < ledger.dispatch_count) reject("journal dispatches do not match the durable ledger");
if (await lstat(path.join(run, "build.lease")).then(() => true).catch((error) => error.code === "ENOENT" ? false : Promise.reject(error))) reject("build lease still exists after terminal completion");

const reviewTargets = certification?.frds || [...dispatchIds].map((id) => /^review-(.+)-a\d+$/.exec(id)?.[1]).filter(Boolean);
const contractClasses = ["requirement", "acceptance-criterion", "invariant", "edge-case", "limit", "error", "exclusion"];
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const validGreenReview = (result) => exactKeys(result, ["done", "verdict", "summary", "findings", "traceability"]) && result.done === true && result.verdict === "green" && typeof result.summary === "string" && Array.isArray(result.findings) && result.findings.every((item) => typeof item === "string") && Array.isArray(result.traceability) && result.traceability.every((entry) => exactKeys(entry, ["contract", "contract_class", "status", "tests"]) && typeof entry.contract === "string" && contractClasses.includes(entry.contract_class) && ["pass", "not-applicable"].includes(entry.status) && Array.isArray(entry.tests) && entry.tests.every((item) => typeof item === "string") && (!new Set(["edge-case", "limit"]).has(entry.contract_class) || entry.status !== "pass" || entry.tests.length > 0)) && contractClasses.every((kind) => result.traceability.some((entry) => entry.contract_class === kind));
const reviewedFrds = new Set();
for (const frd of reviewTargets) {
  const prefix = `review-${frd}-a`;
  const candidates = [...dispatchIds].filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)));
  for (const id of candidates) {
    const starts = executor.filter((item) => item.semantic_name === "agent.working" && item.data?.dispatch_id === id);
    const finishes = executor.filter((item) => item.semantic_name === "dispatch.finished" && item.data?.dispatch_id === id);
    if (starts.length !== 1 || finishes.length !== 1) continue;
    const startedReview = starts[0], finishedReview = finishes[0]; const reviewStart = Date.parse(startedReview.at), reviewFinish = Date.parse(finishedReview.at);
    if (!Number.isFinite(reviewStart) || !Number.isFinite(reviewFinish) || reviewStart < buildStarted || reviewStart > reviewFinish || reviewFinish > end) continue;
    if (startedReview?.data?.tier !== "JUDGE" || finishedReview?.data?.verdict !== "green") continue;
    const resultFile = path.join(run, `${id}.result.json`);
    let result;
    try { result = await regularJson(resultFile, `${id} result`); } catch { continue; }
    if (validGreenReview(result)) { reviewedFrds.add(frd); break; }
  }
}
const durationSeconds = Math.floor((end - buildStarted) / 1000);
if (certification && reviewedFrds.size !== certification.frds.length) reject("R11 target lacks completed green independent review evidence");
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
  started_at: buildStartedAt,
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
  collected_at: collectedAt,
};
const output = path.join(run, `codex-unattended-evidence-${runId}.json`);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ...evidence, output }, null, 2)}\n`);
