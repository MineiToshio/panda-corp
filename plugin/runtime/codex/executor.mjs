#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquire, applyChangePlan, assertFence, currentLease, finalizeRelease, isFresh, pauseForOwner, quiesce, reclaim, reconcileBuildingChange, recoverChangeTransactions, renew, reserveDispatch, setHealth, setPendingDecisions, setProjectPhase, stampChangeIntegration, stampLastGreen, transitionWorkOrder } from "../build-state.mjs";
import { createRuntimeEventEmitter } from "../event-transport.mjs";
import { consumeByExecutor } from "./attended-permit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const plugin = path.resolve(here, "../..");
const arg = (name, fallback = "") => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const numberArg = (name, fallback, { min = 0 } = {}) => { const value = Number(arg(name, String(fallback))); if (!Number.isSafeInteger(value) || value < min) throw Object.assign(new Error(`invalid --${name}`), { code: "USAGE" }); return value; };
const project = path.resolve(arg("project", "."));
const projectReal = await realpath(project).catch(() => { throw Object.assign(new Error("project root is unavailable"), { code: "INVALID_PATH" }); });
async function assertRealRuntimePath(absolute, type) {
  const target = path.resolve(absolute); if (target !== project && !target.startsWith(`${project}${path.sep}`)) throw Object.assign(new Error("runtime path escapes project"), { code: "INVALID_PATH" });
  const [entry, actual] = await Promise.all([lstat(target), realpath(target)]).catch(() => { throw Object.assign(new Error("runtime path is unavailable"), { code: "INVALID_PATH" }); });
  const expected = path.join(projectReal, path.relative(project, target)); const rightType = type === "directory" ? entry.isDirectory() : entry.isFile();
  if (entry.isSymbolicLink() || !rightType || actual !== expected) throw Object.assign(new Error(`runtime ${type} must be real and in-tree`), { code: "INVALID_PATH" }); return target;
}
const runId = arg("run-id", `codex-${Date.now()}`);
const certificationReceipt = arg("certification-receipt", "");
const maxSpend = numberArg("max-spend", 12, { min: 1 });
const maxRetries = numberArg("max-retries", 2);
const maxBlocks = numberArg("max-blocks", 3, { min: 1 });
const maxDuration = numberArg("max-duration", 21600, { min: 30 });
const leaseTtlSeconds = Number(process.env.PANDACORP_LEASE_TTL_SECONDS || 600);
const renewIntervalMs = Number(process.env.PANDACORP_LEASE_RENEW_MS || 120000);
if (!Number.isSafeInteger(leaseTtlSeconds) || leaseTtlSeconds < 3 || !Number.isSafeInteger(renewIntervalMs) || renewIntervalMs < 100 || renewIntervalMs > Math.floor(leaseTtlSeconds * 1000 / 3)) {
  throw Object.assign(new Error("invalid lease heartbeat configuration: renewal must be <= TTL/3"), { code: "USAGE" });
}
const codexBin = process.env.PANDACORP_CODEX_BIN || "codex";
const requestedChange = arg("change", "");
const requestedFrds = arg("frds", "").split(",").map((item) => item.trim()).filter(Boolean);
const targeted = Boolean(requestedChange || requestedFrds.length);
const executionProfile = arg("execution-profile", "");
const attendedPermit = arg("attended-permit", "");
const attendedFd = numberArg("attended-fd", 0);
if (!new Set(["attended_foreground", "certification"]).has(executionProfile)) throw Object.assign(new Error("explicit Codex execution profile required"), { code: "PROFILE" });
const exactAttendedTarget = Boolean(requestedChange) !== Boolean(requestedFrds.length) && requestedFrds.length <= 1 && (!requestedChange || /^[a-z0-9-]+$/.test(requestedChange)) && (!requestedFrds.length || /^frd-[a-z0-9-]+$/.test(requestedFrds[0]));
if (executionProfile === "attended_foreground" && (certificationReceipt || !exactAttendedTarget || maxDuration > 7200 || !attendedPermit || attendedFd < 3)) throw Object.assign(new Error("attended_foreground requires one exact target, an inherited secret FD, a consumable permit and max-duration <= 7200"), { code: "PROFILE" });
if (executionProfile === "certification" && !certificationReceipt) throw Object.assign(new Error("certification profile requires its consumed receipt"), { code: "PROFILE" });
if (certificationReceipt) {
  const receiptPath = await assertRealRuntimePath(certificationReceipt, "file");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const contracts = {
    "pandacorp-r10-certification-receipt": { stage: "codex-frd-b", file: "r10-certification-receipt.json" },
    "pandacorp-r11-certification-receipt": { stage: "codex-live-overnight", file: "r11-certification-receipt.json" },
  };
  const contract = contracts[receipt.kind];
  const canonicalPath = contract ? path.join(project, ".pandacorp/run", contract.file) : "";
  const exactLimits = receipt.limits?.max_spend === maxSpend && receipt.limits?.max_duration === maxDuration && receipt.limits?.max_retries === maxRetries && receipt.limits?.max_blocks === maxBlocks;
  const exactScope = !requestedChange && Array.isArray(receipt.frds) && receipt.frds.join(",") === requestedFrds.join(",");
  if (!contract || receiptPath !== canonicalPath || receipt.status !== "consumed" || receipt.run_id !== runId || receipt.stage !== contract.stage || !exactLimits || !exactScope) throw Object.assign(new Error("invalid, drifted or unconsumed certification receipt"), { code: "CERTIFICATION" });
}
if (executionProfile === "attended_foreground") await consumeByExecutor(project, attendedPermit, { runId, change: requestedChange, frds: requestedFrds[0] || "", maxSpend, maxDuration, maxRetries, maxBlocks }, readFileSync(attendedFd,"utf8").trim());
const runDir = path.join(project, ".pandacorp/run");
const checkpointFile = path.join(runDir, "codex-checkpoint.json");
const journalFile = path.join(runDir, "codex-executor.jsonl");
const tiers = JSON.parse(await readFile(path.join(plugin, "runtime/model-tiers.json"), "utf8")).tiers;
const reviewerSource = await readFile(path.join(plugin, "agents/reviewer.md"), "utf8");
const wholeFrdOracle = reviewerSource.match(/<!-- WHOLE_FRD_ORACLE_START -->([\s\S]*?)<!-- WHOLE_FRD_ORACLE_END -->/)?.[1]?.trim().replace(/\s+/g, " ");
if (!wholeFrdOracle) throw Object.assign(new Error("canonical whole-FRD reviewer oracle is unavailable"), { code: "CONTRACT" });
const schema = path.join(here, "result.schema.json");
const changeSchema = path.join(here, "change-result.schema.json");
let budgetStartedAt = Date.now();
const testAfterDispatchDelay = Number(process.env.PANDACORP_TEST_AFTER_DISPATCH_MS || 0);
let lease;
let stopping = false;
let renewTimer;
let activeChild = null;
let activeClose = null;
let signalRequested = null;
let shutdownStarted = false;
let state = { version: 2, run_id: runId, budget_started_at: new Date(budgetStartedAt).toISOString(), inflight: null, attempts: {}, implementation_commits: {}, attempt_commits: {}, consecutive_blocks: 0, terminal_reason: null, change_plan_pending: null, active_change_frds: {}, deferred_changes: [] };

const EXIT = { complete: 0, "needs-owner": 20, budget: 21, rethink: 22, duration: 23, breaker: 24, uncertain: 25, stopped: 26, error: 2 };
const runtimePath = (file) => file === ".pandacorp/run" || file.startsWith(".pandacorp/run/");
const governedPath = (file) => file === ".pandacorp/status.yaml" || file === ".pandacorp/track.jsonl" || /^docs\/frds\/[^/]+\/(frd|blueprint)\.md$/.test(file) || /^docs\/frds\/[^/]+\/work-orders\/wo-[^/]+\.md$/.test(file);
const testPath = (file) => /(^|\/)(__tests__|tests?|e2e)(\/|$)|\.(test|spec)\.[^.]+$/i.test(file);
const atomic = async (file, value) => { const tmp = `${file}.tmp-${process.pid}-${randomUUID()}`; await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await rename(tmp, file); };
const checkpoint = async (patch = {}, transitionAt = new Date().toISOString()) => { state = { ...state, ...patch, version: 2, run_id: runId, updated_at: transitionAt }; await atomic(checkpointFile, state); };
const event = createRuntimeEventEmitter({ runtime: "codex", runId, project, journalFile });
const notify = (message) => { if (process.platform !== "darwin") return; const child = spawn("osascript", ["-e", `display notification ${JSON.stringify(message)} with title "Pandacorp Codex"`], { stdio: "ignore" }); child.unref(); };
const killTree = (child, signal = "SIGTERM") => { if (!child?.pid) return; try { if (process.platform === "win32") child.kill(signal); else process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch {} } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const throwIfStopping = () => { if (signalRequested) throw Object.assign(new Error(`signal requested: ${signalRequested}`), { code: "STOPPED" }); };
const quiesceActive = async (reason) => { const child = activeChild, closed = activeClose; if (!child || !closed) return; await event("dispatch_quiesce", { reason, pid: child.pid }); killTree(child, "SIGTERM"); await Promise.race([closed, wait(250)]); killTree(child, "SIGKILL"); await closed; await wait(50); };
const exec = (cmd, args, { timeoutMs = 0, managed = false, ...options } = {}) => new Promise((resolve) => {
  const child = spawn(cmd, args, { cwd: project, stdio: ["ignore", "pipe", "pipe"], detached: managed && process.platform !== "win32", ...options }); let out = "", err = "", timedOut = false;
  let closeResolve; const closed = new Promise((done) => { closeResolve = done; }); if (managed) { if (activeChild) throw Object.assign(new Error("concurrent managed dispatch forbidden"), { code: "OWNERSHIP" }); activeChild = child; activeClose = closed; }
  child.stdout?.on("data", (d) => out += d); child.stderr?.on("data", (d) => err += d);
  const timer = timeoutMs ? setTimeout(() => { timedOut = true; killTree(child, "SIGTERM"); setTimeout(() => killTree(child, "SIGKILL"), 5000).unref(); }, timeoutMs) : null;
  child.on("close", (code, signal) => { if (timer) clearTimeout(timer); closeResolve(); if (managed && activeChild === child) { activeChild = null; activeClose = null; } resolve({ code, signal, out, err, timedOut }); });
});
const fm = (body, key) => body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
const listValue = (value = "") => value.replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter((x) => x && x !== "—" && x !== "-");
const normalizeDeps = (deps) => [...new Set(deps)].sort();

function parseBuildPlan(blueprint, frd) {
  const heading = /^##(?:\s+\d+\.)?\s+Build Plan[^\n]*$/mi.exec(blueprint); let section = "";
  if (heading) { const rest = blueprint.slice(heading.index + heading[0].length); const next = rest.search(/^##\s/m); section = next < 0 ? rest : rest.slice(0, next); }
  if (!section) throw Object.assign(new Error(`${frd} has no authoritative Build Plan section`), { code: "PLAN" });
  const rows = new Map();
  for (const line of section.split("\n")) {
    if (!/^\|\s*WO-[A-Za-z0-9-]+\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((x) => x.trim().replace(/`/g, "")); const id = cells[0]; const deps = listValue(cells[1] || "");
    if (rows.has(id)) throw Object.assign(new Error(`${frd} Build Plan duplicates ${id}`), { code: "PLAN" }); rows.set(id, { deps, order: rows.size });
  }
  if (!rows.size) throw Object.assign(new Error(`${frd} Build Plan has no mandatory DAG table rows`), { code: "PLAN" });
  return rows;
}

async function workOrders() {
  const root = path.join(project, "docs/frds"); await assertRealRuntimePath(root, "directory"); const result = []; const ids = new Set();
  for (const directory of (await readdir(root, { withFileTypes: true })).filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const frd = directory.name; const frdDir = path.join(root, frd); await assertRealRuntimePath(frdDir, "directory"); const woDir = path.join(frdDir, "work-orders"); let names = [];
    try { await assertRealRuntimePath(woDir, "directory"); names = (await readdir(woDir)).filter((name) => /^wo-.*\.md$/.test(name)); } catch (error) { if (error.code === "INVALID_PATH" && !await lstat(woDir).then(() => true).catch(() => false)) continue; throw error; }
    const blueprintFile = path.join(frdDir, "blueprint.md"); await assertRealRuntimePath(blueprintFile, "file"); const blueprint = await readFile(blueprintFile, "utf8"); const plan = parseBuildPlan(blueprint, frd);
    for (const name of names) {
      const absoluteFile = path.join(woDir, name); await assertRealRuntimePath(absoluteFile, "file"); const file = path.relative(project, absoluteFile); const body = await readFile(absoluteFile, "utf8"); const id = fm(body, "id") || name.replace(/\.md$/, "");
      if (ids.has(id)) throw Object.assign(new Error(`duplicate WO id ${id}`), { code: "PLAN" }); ids.add(id);
      const row = plan.get(id); if (!row) throw Object.assign(new Error(`${id} missing from ${frd} Build Plan DAG table`), { code: "PLAN" });
      const deps = listValue(fm(body, "dependsOn") || fm(body, "depends_on") || "");
      if (JSON.stringify(normalizeDeps(deps)) !== JSON.stringify(normalizeDeps(row.deps))) throw Object.assign(new Error(`${id} dependency drift: frontmatter=[${deps}] Build Plan=[${row.deps}]`), { code: "PLAN" });
      result.push({ frd, file, id, status: fm(body, "implementation_status"), deps, order: row.order });
    }
    for (const id of plan.keys()) if (!result.some((wo) => wo.frd === frd && wo.id === id)) throw Object.assign(new Error(`${frd} Build Plan references missing ${id}`), { code: "PLAN" });
  }
  const byId = new Map(result.map((wo) => [wo.id, wo])); const ordered = [], visiting = new Set(), done = new Set();
  const visit = (wo) => { if (done.has(wo.id)) return; if (visiting.has(wo.id)) throw Object.assign(new Error(`dependency cycle at ${wo.id}`), { code: "PLAN" }); visiting.add(wo.id); for (const dep of wo.deps) { if (!byId.has(dep)) throw Object.assign(new Error(`unknown dependency ${dep}`), { code: "PLAN" }); visit(byId.get(dep)); } visiting.delete(wo.id); done.add(wo.id); ordered.push(wo); };
  for (const wo of [...result].sort((a, b) => a.frd.localeCompare(b.frd) || a.order - b.order)) visit(wo);
  return ordered;
}

async function changedPaths() {
  const [tracked, untracked] = await Promise.all([exec("git", ["diff", "--name-only", "-z", "HEAD"]), exec("git", ["ls-files", "--others", "--exclude-standard", "-z"])]);
  if (tracked.code || untracked.code) throw Object.assign(new Error("cannot inspect git ownership"), { code: "GIT" });
  return [...new Set(`${tracked.out}${untracked.out}`.split("\0").filter(Boolean))].sort();
}
const statusPath = ".pandacorp/status.yaml";
const contentAt = async (file) => readFile(path.join(project, file)).then((body) => body.toString("base64")).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
const snapshot = async () => {
  const dirty = await changedPaths();
  const files = new Set([...dirty, statusPath]);
  return new Map(await Promise.all([...files].map(async (file) => [file, await contentAt(file)])));
};
const projectionKeys = ["phase", "running", "run_started_at", "build_run_id", "build_runtime", "build_lease_epoch", "supervisor_heartbeat"];
const parseStatusProjection = (body) => {
  const lines = body.split("\n"); const found = Object.fromEntries(projectionKeys.map((key) => [key, []]));
  for (const line of lines) for (const key of Object.keys(found)) { const match = line.match(new RegExp(`^${key}:\\s*(.*)$`)); if (match) found[key].push(match[1].trim()); }
  return found;
};
const normalizeStatusProjection = (body) => body.split("\n").map((line) => projectionKeys.some((key) => line.startsWith(`${key}:`)) ? `${line.slice(0, line.indexOf(":"))}: <controller-projection>` : line).join("\n");
const unquote = (value) => String(value || "").replace(/^['"]|['"]$/g, "");
async function controllerOnlyStatusDelta(beforeEncoded, afterEncoded) {
  if (beforeEncoded === null || afterEncoded === null) return false;
  const before = Buffer.from(beforeEncoded, "base64").toString("utf8"); let candidate = Buffer.from(afterEncoded, "base64").toString("utf8");
  for (let attempt = 0; attempt < 5; attempt++) {
    const ownedLease = await assertFence(project, lease.token, lease.epoch);
    if (ownedLease.runtime !== "codex" || ownedLease.run_id !== runId || ownedLease.epoch !== lease.epoch || !isFresh(ownedLease)) return false;
    const values = parseStatusProjection(candidate);
    const expected = { phase: ownedLease.project_phase || "implementation", running: "true", run_started_at: ownedLease.acquired_at, build_run_id: ownedLease.run_id, build_runtime: ownedLease.runtime, build_lease_epoch: String(ownedLease.epoch), supervisor_heartbeat: ownedLease.renewed_at };
    const projected = projectionKeys.every((key) => values[key].length === 1 && unquote(values[key][0]) === expected[key]);
    if (projected && normalizeStatusProjection(before) === normalizeStatusProjection(candidate)) return true;
    // Renewal can race the initial content read. Re-read under two identical fenced lease views;
    // a worker's non-liveness edit survives renew and therefore cannot normalize away here.
    candidate = await readFile(path.join(project, statusPath), "utf8");
    const stable = await assertFence(project, lease.token, lease.epoch);
    if (stable.renewed_at !== ownedLease.renewed_at) continue;
  }
  return false;
}
const delta = async (before) => {
  const current = new Set(await changedPaths()); const candidates = new Set([...before.keys(), ...current]); const changed = [];
  for (const file of [...candidates].sort()) {
    if (runtimePath(file)) continue;
    const after = await contentAt(file); const prior = before.get(file);
    if (after === prior) continue;
    if (file === statusPath && await controllerOnlyStatusDelta(prior, after)) continue;
    changed.push(file);
  }
  return changed;
};
async function commitPaths(message, paths, kind) {
  const wanted = [...new Set(paths)].filter((file) => !runtimePath(file)); const dirty = new Set(await changedPaths()); const files = wanted.filter((file) => dirty.has(file));
  if (kind === "state" && files.some((file) => !governedPath(file))) throw Object.assign(new Error(`state commit contains non-governed files: ${files.filter((f) => !governedPath(f)).join(",")}`), { code: "OWNERSHIP" });
  if (kind === "change-plan" && files.some((file) => !file.startsWith("docs/frds/") && file !== ".pandacorp/status.yaml")) throw Object.assign(new Error(`change-plan commit escaped canonical FRD docs: ${files.filter((file) => !file.startsWith("docs/frds/") && file !== ".pandacorp/status.yaml").join(",")}`), { code: "OWNERSHIP" });
  if (!new Set(["state", "change-plan"]).has(kind) && files.some(governedPath)) throw Object.assign(new Error(`worker touched governed paths: ${files.filter(governedPath).join(",")}`), { code: "OWNERSHIP" });
  if (kind === "review" && files.some((file) => !testPath(file))) throw Object.assign(new Error(`reviewer changed non-test files: ${files.filter((f) => !testPath(f)).join(",")}`), { code: "OWNERSHIP" });
  if (!files.length) return null;
  let result = await exec("git", ["add", "--", ...files]); if (result.code) throw Object.assign(new Error(result.err), { code: "GIT" });
  result = await exec("git", ["diff", "--cached", "--name-only", "-z"]); const staged = result.out.split("\0").filter(Boolean).sort();
  if (JSON.stringify(staged) !== JSON.stringify([...files].sort())) throw Object.assign(new Error(`staging ownership mismatch: ${staged.join(",")}`), { code: "OWNERSHIP" });
  result = await exec("git", ["commit", "-m", message]); if (result.code) throw Object.assign(new Error(result.err), { code: "GIT" }); return (await exec("git", ["rev-parse", "HEAD"])).out.trim();
}
const stateFiles = (wo) => [wo.file, `docs/frds/${wo.frd}/frd.md`, `docs/frds/${wo.frd}/blueprint.md`, ".pandacorp/status.yaml", ".pandacorp/track.jsonl"];
async function stateCommit(message, wo) { const items = Array.isArray(wo) ? wo : wo ? [wo] : []; return commitPaths(message, items.length ? items.flatMap(stateFiles) : [".pandacorp/status.yaml", ".pandacorp/track.jsonl"], "state"); }
const appendTrack = async (kind, data = {}) => appendFile(path.join(project, ".pandacorp/track.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), kind, project: path.basename(project), runtime: "codex", run_id: runId, ...data })}\n`);
const appendProgress = async (line) => { const file = path.join(project, ".pandacorp/comms/progress.md"); await mkdir(path.dirname(file), { recursive: true }); await appendFile(file, `\n- ${new Date().toISOString()} — ${line}\n`); };

function validateResult(value) { if (!value || typeof value !== "object" || typeof value.done !== "boolean" || !["green", "red", "needs-owner", "retry"].includes(value.verdict) || typeof value.summary !== "string" || !Array.isArray(value.findings) || value.findings.some((item) => typeof item !== "string")) throw Object.assign(new Error("Codex result violates result.schema.json"), { code: "INVALID_RESULT" }); return value; }
function validateReviewResult(value) {
  validateResult(value);
  const classes = ["requirement", "acceptance-criterion", "invariant", "edge-case", "limit", "error", "exclusion"];
  if (!Array.isArray(value.traceability) || classes.some((kind) => !value.traceability.some((entry) => entry?.contract_class === kind))) throw Object.assign(new Error("review verdict lacks whole-FRD traceability inventory"), { code: "INVALID_RESULT" });
  const invalid = value.traceability.some((entry) => !entry || !classes.includes(entry.contract_class) || !["pass", "fail", "not-applicable"].includes(entry.status) || !Array.isArray(entry.tests) || (["edge-case", "limit"].includes(entry.contract_class) && entry.status === "pass" && entry.tests.length === 0));
  if (invalid || (value.verdict === "green" && value.traceability.some((entry) => entry.status === "fail"))) throw Object.assign(new Error("review verdict contradicts whole-FRD traceability or lacks boundary evidence"), { code: "INVALID_RESULT" });
  return value;
}
function validateChangeResult(value) { validateResult(value); if (!["bug", "feature", "change"].includes(value.change_kind) || !Array.isArray(value.affected_frds) || !value.affected_frds.length || !Array.isArray(value.mutations) || !Array.isArray(value.reopen_work_orders)) throw Object.assign(new Error("Codex change plan violates change-result.schema.json"), { code: "INVALID_RESULT" }); return value; }
function classifyProviderFailure(result) {
  const diagnostic = `${result.out || ""}\n${result.err || ""}`.toLowerCase();
  if (/usage limit|insufficient[_ -]?quota|purchase more credits|credit balance/.test(diagnostic)) return "usage_limit";
  if (/rate limit|too many requests|\b429\b/.test(diagnostic)) return "rate_limit";
  if (/unauthori[sz]ed|authentication|not authenticated|expired (token|auth)|login required|\b401\b/.test(diagnostic)) return "auth";
  if (/approval (denied|required)|denied by policy|permission denied|operation not permitted/.test(diagnostic)) return "approval";
  if (result.timedOut || /network|connection (reset|refused|closed)|enotfound|econn|etimedout|socket|dns/.test(diagnostic)) return "network";
  return "unknown";
}
async function dispatch({ id, tier, prompt, units = 1, outputSchema = schema, validator = validateResult }) {
  throwIfStopping();
  await reserveDispatch(project, lease.token, lease.epoch, { id, units, limit: maxSpend }); const resultFile = path.join(runDir, `${id}.result.json`); await checkpoint({ inflight: { id, tier, result_file: resultFile, started_at: new Date().toISOString() } }); await event("dispatch_started", { dispatch_id: id, tier });
  const mapping = tiers[tier].codex; const args = ["exec", "--ignore-user-config", "--strict-config", "--json", "--output-schema", outputSchema, "--output-last-message", resultFile, "-C", project, "-s", "workspace-write", "-m", mapping.model, "-c", `model_reasoning_effort=\"${mapping.effort}\"`, prompt];
  const result = await exec(codexBin, args, { timeoutMs: Math.max(1000, maxDuration * 1000 - (Date.now() - budgetStartedAt)), managed: true });
  throwIfStopping();
  if (result.code !== 0) { const errorClass = classifyProviderFailure(result); const uncertain = { ...state.inflight, error_class: errorClass, exit_code: result.code, timed_out: result.timedOut }; await event("dispatch_uncertain", { dispatch_id: id, code: result.code, signal: result.signal, timed_out: result.timedOut, error_class: errorClass }); await checkpoint({ uncertain }); throw Object.assign(new Error(`Codex dispatch outcome is uncertain: ${id}; provider class=${errorClass}; blind retry forbidden`), { code: result.timedOut ? "DURATION" : "UNCERTAIN", providerClass: errorClass }); }
  const parsed = validator(JSON.parse(await readFile(resultFile, "utf8"))); await event("dispatch_finished", { dispatch_id: id, verdict: parsed.verdict }); await checkpoint({ inflight: null, uncertain: null, last_dispatch: id }); if (process.env.PANDACORP_TEST_AFTER_DISPATCH_BARRIER === "1") { await writeFile(path.join(runDir, "after-dispatch.barrier"), `${id}\n`); while (!signalRequested) await wait(10); } else if (testAfterDispatchDelay > 0) await wait(Math.min(testAfterDispatchDelay, 5000)); throwIfStopping(); return parsed;
}
async function verify(label) { throwIfStopping(); const result = await exec("bash", [".pandacorp/verify.sh"], { timeoutMs: Math.max(1000, maxDuration * 1000 - (Date.now() - budgetStartedAt)), managed: true }); throwIfStopping(); await event("verify_finished", { label, code: result.code, signal: result.signal, timed_out: result.timedOut, output_tail: `${result.out}\n${result.err}`.slice(-4000) }); return result.code === 0 && !result.timedOut; }
async function mutationGate(frd) {
  if (executionProfile !== "attended_foreground") return true;
  throwIfStopping();
  const commits = state.implementation_commits[frd] || []; if (!commits.length) return false;
  const remaining = Math.max(2000, maxDuration * 1000 - (Date.now() - budgetStartedAt));
  const result = await exec("node", [path.join(plugin, "scripts/run-frd-mutation-gate.mjs"), "--project", project, "--frd", frd, "--commits", commits.join(","), "--timeout-ms", String(Math.max(1000, remaining - 1000))], { timeoutMs: remaining, managed: true });
  throwIfStopping();
  let receipt = null; try { receipt = JSON.parse(result.out); } catch {}
  const green = result.code === 0 && !result.timedOut && receipt?.schema === 1 && receipt?.frd === frd && receipt?.verdict === "green";
  await event(green ? "test.green" : "test.failed", { label: `mutation-${frd}`, code: result.code, receipt, output_tail: `${result.out}\n${result.err}`.slice(-4000) });
  return green;
}
async function safePoint() { if (signalRequested) return "stopped"; if (Date.now() - budgetStartedAt >= maxDuration * 1000) return "duration"; try { await stat(path.join(runDir, "stop")); return "stopped"; } catch {} const status = await readFile(path.join(project, ".pandacorp/status.yaml"), "utf8"); if (/^rethink_pending:\s*true\s*$/m.test(status)) return "rethink"; if (state.consecutive_blocks >= maxBlocks) return "breaker"; return null; }
async function honorSafePoint(stop) { if (!stop) return false; finalReason = stop; await terminal(stop); return true; }
const changeDirectory = path.join(project, ".pandacorp/inbox/changes");
const cardField = (body, key) => body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
const normalizeChangeFile = (value) => { const slug = value.replace(/^\.pandacorp\/inbox\/changes\//, "").replace(/\.md$/, ""); if (!/^[a-z0-9-]+$/.test(slug)) throw Object.assign(new Error(`invalid change slug ${value}`), { code: "USAGE" }); return `.pandacorp/inbox/changes/${slug}.md`; };
async function readChangeCard(file) { const absolute = path.join(project, file); await assertRealRuntimePath(absolute, "file"); return readFile(absolute, "utf8"); }
async function changeCards(status) { let names; try { await assertRealRuntimePath(changeDirectory, "directory"); names = await readdir(changeDirectory); } catch (error) { if (error.code === "INVALID_PATH" && !await lstat(changeDirectory).then(() => true).catch(() => false)) return []; throw error; } const cards = []; for (const name of names.filter((item) => /^[a-z0-9-]+\.md$/.test(item) && item !== "README.md").sort()) { const file = `.pandacorp/inbox/changes/${name}`; const body = await readChangeCard(file); if (!status || cardField(body, "status") === status) cards.push({ file, body, class: cardField(body, "class"), type: cardField(body, "type") }); } return cards.sort((a, b) => (a.class === "expedite" ? -1 : 0) - (b.class === "expedite" ? -1 : 0) || a.file.localeCompare(b.file)); }
const changeCommitPaths = (affectedFrds, mutationPaths = []) => [...new Set([...mutationPaths, ...affectedFrds.flatMap((frd) => [`docs/frds/${frd}/frd.md`, `docs/frds/${frd}/blueprint.md`]), ".pandacorp/status.yaml"])];
async function applyPendingChangePlan(pending) { const before = await snapshot(); const applied = await applyChangePlan(project, lease.token, lease.epoch, { ...pending.plan, faultAfter: process.env.PANDACORP_TEST_CHANGE_FAULT_AFTER || "" }); const files = [...new Set([...await delta(before), ...changeCommitPaths(applied.affected_frds, applied.mutation_paths)])]; const sha = await commitPaths(`docs(change): integrate ${path.basename(pending.plan.changeFile, ".md")}`, files, "change-plan") || pending.integration_sha; if (!sha) throw Object.assign(new Error("change integration has no canonical commit evidence"), { code: "EVIDENCE" }); await checkpoint({ change_plan_pending: { ...pending, integration_sha: sha } }); await stampChangeIntegration(project, lease.token, lease.epoch, { changeFile: pending.plan.changeFile, sha }); state.active_change_frds[pending.plan.changeFile] = pending.plan.affectedFrds; await checkpoint({ change_plan_pending: null }); await event("change_integrated", { change_file: pending.plan.changeFile, affected_frds: pending.plan.affectedFrds, integration_sha: sha }); return pending.plan.affectedFrds; }
async function recoverOrphanChangeTransactions() { const before = await snapshot(); const recovered = await recoverChangeTransactions(project, lease.token, lease.epoch); const files = await delta(before); const applies = recovered.filter((item) => item.action === "apply-replayed"); if (applies.length) { const canonical = applies.flatMap((item) => changeCommitPaths(item.affected_frds, item.mutation_paths)); const sha = await commitPaths("docs(change): recover interrupted integration", [...new Set([...files, ...canonical])], "change-plan"); if (!sha) throw Object.assign(new Error("replayed change integration has no canonical commit evidence"), { code: "EVIDENCE" }); for (const item of applies) { await stampChangeIntegration(project, lease.token, lease.epoch, { changeFile: item.change_file, sha }); state.active_change_frds[item.change_file] = item.affected_frds; } await checkpoint(); } return recovered; }
async function processChange(card) {
  const status = cardField(card.body, "status"); if (status !== "ready") throw Object.assign(new Error(`target change is ${status || "invalid"}, not ready`), { code: "CHANGE" });
  const before = await snapshot(); const result = await dispatch({ id: `process-change-${path.basename(card.file, ".md")}`, tier: "JUDGE", units: 2, outputSchema: changeSchema, validator: validateChangeResult, prompt: `Integrate queued change ${card.file} through the canonical ${card.type === "bug" ? "bug" : "iterate"} contract. Read the card, PRD, affected FRD/blueprint/Build Plan and WOs. ${card.type === "bug" ? "Plan a regression-test-first WO." : "Plan the minimum canonical FRD/WO change."} Do NOT write files or state. Return complete proposed markdown files in mutations; every new/reopened WO must appear in the authoritative Build Plan DAG with identical dependsOn. affected_frds must be exact. The fenced controller alone applies and stamps the plan.` });
  const unauthorized = await delta(before); if (unauthorized.length) throw Object.assign(new Error(`change planner wrote files directly: ${unauthorized.join(",")}`), { code: "OWNERSHIP" }); if (result.verdict === "needs-owner") await needsOwner(card.file, result.summary); if (result.verdict !== "green") { state.deferred_changes = [...new Set([...(state.deferred_changes || []), card.file])]; await checkpoint(); return []; }
  if (result.change_kind !== card.type && !(card.type === "feature" && result.change_kind === "change")) throw Object.assign(new Error(`change type drift: card=${card.type} plan=${result.change_kind}`), { code: "CHANGE" });
  const plan = { changeFile: card.file, affectedFrds: result.affected_frds, mutations: result.mutations, reopenWorkOrders: result.reopen_work_orders }; const pending = { plan, planned_at: new Date().toISOString() }; await checkpoint({ change_plan_pending: pending }); if (process.env.PANDACORP_TEST_CRASH_BEFORE_CHANGE_APPLY === "1") throw Object.assign(new Error("injected controller crash before change apply"), { code: "CRASH_TEST" }); return applyPendingChangePlan(pending);
}
async function drainReadyChanges() { if (targeted) return []; const affected = []; for (const card of await changeCards("ready")) { if ((state.deferred_changes || []).includes(card.file)) continue; affected.push(...await processChange(card)); } return [...new Set(affected)]; }
async function reconcileChangeCards() { for (const card of await changeCards("building")) { const result = await reconcileBuildingChange(project, lease.token, lease.epoch, { changeFile: card.file }); if (result.action === "reset-ready") { state.deferred_changes = [...new Set([...(state.deferred_changes || []), card.file])]; await checkpoint(); } await event("change_reconciled", { change_file: card.file, action: result.action }); } }
async function reconcileAnsweredDecisions(allowedFrds) {
  const file = path.join(project, ".pandacorp/inbox/decisions.md"); let body = ""; try { body = await readFile(file, "utf8"); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const blocks = body.split(/^##\s+/m).slice(1); const terminal = (block) => /\*\*Estado:\*\*\s*(RESUELTO|OBSOLETO)\b/i.test(block) || /^.*\((resuelto|obsoleto)\)/mi.test(block); const terminalBlocks = blocks.filter(terminal);
  await setPendingDecisions(project, lease.token, lease.epoch, blocks.filter((block) => !terminal(block)).length);
  const answeredIds = new Set(terminalBlocks.flatMap((block) => block.match(/\bWO-[A-Za-z0-9-]+\b/g) || [])); if (!answeredIds.size) return [];
  const reopened = [];
  for (const wo of await workOrders()) {
    if (!answeredIds.has(wo.id) || wo.status !== "BLOCKED" || targeted && !allowedFrds.has(wo.frd)) continue;
    const content = await readFile(path.join(project, wo.file), "utf8"); if (!/^blocked_reason:\s*needs-owner\s*$/m.test(content)) continue;
    await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "PLANNED" }); await appendTrack("wo_reopen", { frd: wo.frd, wo: wo.id, cause: "answered-decision" }); reopened.push(wo);
  }
  if (reopened.length) { await stateCommit("chore: reopen work answered by owner", reopened); await appendProgress(`Decisión resuelta: se reabrió ${reopened.map((wo) => wo.id).join(", ")} para continuar la implementación.`); }
  return reopened;
}
async function terminal(reason, detail = {}) { const transitionAt = new Date().toISOString(); await checkpoint({ inflight: null, ...detail, terminal_reason: reason, terminal_at: transitionAt }, transitionAt); await event(reason === "complete" ? "build.complete" : "build.stopped", { reason, ...detail }); }
async function needsOwner(subject, summary, code = "NEEDS_OWNER") { await pauseForOwner(project, lease.token, lease.epoch, { subject, summary }); await stateCommit("chore: persist owner-decision state", null); await terminal("needs-owner", { subject, summary }); throw Object.assign(new Error(summary), { code }); }
async function reconcileInflight(cp) { if (!cp?.inflight && !cp?.uncertain) return; const inflight = cp.uncertain || cp.inflight; const errorClass = inflight.error_class || "unknown"; await event("uncertain_requires_owner", { dispatch_id: inflight.id, error_class: errorClass }); await needsOwner(inflight.id, `A previous Codex dispatch ended without a trustworthy terminal result (provider class: ${errorClass}). No retry was launched; inspect its durable result and git delta before deciding.`, "UNCERTAIN"); }
async function preserveTests(frd, attempt, files) { for (const file of files.filter(testPath)) { const destination = path.join(runDir, "preserved-tests", frd, `attempt-${attempt}`, file); await mkdir(path.dirname(destination), { recursive: true }); await copyFile(path.join(project, file), destination); } }
async function preservedContext(frd) { const relative = `.pandacorp/run/preserved-tests/${frd}`; try { const entries = await readdir(path.join(project, relative)); return entries.length ? `Before changing code, read and execute the preserved RED baseline under ${relative}; carry those exact assertions forward into the active test tree. Do not stage files from .pandacorp/run itself.` : ""; } catch { return ""; } }
async function rollback(frd, attempt, testFiles) { await preserveTests(frd, attempt, testFiles); const commits = state.attempt_commits[frd] || []; for (const sha of [...commits].reverse()) { const result = await exec("git", ["revert", "--no-edit", sha]); if (result.code) await needsOwner(frd, `Deterministic rollback failed at ${sha}: ${result.err}`); } state.attempt_commits[frd] = []; state.implementation_commits[frd] = []; await checkpoint(); }
async function commitAndRevert(files, message) { const sha = await commitPaths(message, files, "implementation"); if (!sha) return; const reverted = await exec("git", ["revert", "--no-edit", sha]); if (reverted.code) await needsOwner(message, `Deterministic rollback failed: ${reverted.err}`); }
async function recordCommit(frd, sha, implementation = false) { if (!sha) return; state.attempt_commits[frd] = [...(state.attempt_commits[frd] || []), sha]; if (implementation) state.implementation_commits[frd] = [...(state.implementation_commits[frd] || []), sha]; await checkpoint(); }
async function shutdown(reason) { if (shutdownStarted) return; shutdownStarted = true; stopping = true; clearInterval(renewTimer); if (lease) { try { await quiesce(project, lease.token, lease.epoch); await commitPaths("chore: quiesce Codex build lease", [".pandacorp/status.yaml"], "state"); await finalizeRelease(project, lease.token, lease.epoch); await event("lease_released", { reason }); } catch (error) { await event("lease_release_failed", { reason, error: error.message }); } } }
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => { if (signalRequested) return; signalRequested = signal; stopping = true; void quiesceActive(signal); });

let finalReason = "error";
try {
  await mkdir(runDir, { recursive: true });
  try { const saved = JSON.parse(await readFile(checkpointFile, "utf8")); if (saved.run_id === runId) state = { ...state, ...saved }; } catch {}
  budgetStartedAt = Date.parse(state.budget_started_at); if (!Number.isFinite(budgetStartedAt) || budgetStartedAt > Date.now()) throw Object.assign(new Error("durable duration origin is invalid"), { code: "EVIDENCE" }); await checkpoint({ budget_started_at: new Date(budgetStartedAt).toISOString() });
  const baseline = (await changedPaths()).filter((file) => !runtimePath(file)); if (baseline.length && !state.inflight && !state.uncertain && !state.change_plan_pending) throw Object.assign(new Error(`dirty baseline: ${baseline.join(",")}`), { code: "DIRTY" });
  const prior = await currentLease(project); if (prior) { if (prior.runtime !== "codex" || prior.run_id !== runId || isFresh(prior)) throw Object.assign(new Error("foreign or still-live lease"), { code: "CONTENDED" }); lease = await reclaim(project, { runtime: "codex", runId, ttlSeconds: leaseTtlSeconds }); } else lease = await acquire(project, { runtime: "codex", runId, ttlSeconds: leaseTtlSeconds });
  await event("executor_started", { epoch: lease.epoch, targeted, lease_ttl_seconds: leaseTtlSeconds, heartbeat_interval_ms: renewIntervalMs }); renewTimer = setInterval(() => renew(project, lease.token, lease.epoch).catch(async (error) => { await event("lease_lost", { error: error.message }); process.kill(process.pid, "SIGTERM"); }), renewIntervalMs); renewTimer.unref(); await reconcileInflight(state); if (state.change_plan_pending) await applyPendingChangePlan(state.change_plan_pending); else await recoverOrphanChangeTransactions();

  const scopeFrds = new Set(requestedFrds);
  if (requestedChange) { const file = normalizeChangeFile(requestedChange); const body = await readChangeCard(file); const status = cardField(body, "status"); if (status === "ready") for (const frd of await processChange({ file, body, type: cardField(body, "type"), class: cardField(body, "class") })) scopeFrds.add(frd); else if (status === "building") for (const frd of listValue(cardField(body, "affected_frds"))) scopeFrds.add(frd); else throw Object.assign(new Error(`target change is ${status}, not ready/building`), { code: "CHANGE" }); }

  let passes = 0;
  while (true) {
    const stop = await safePoint(); if (await honorSafePoint(stop)) break;
    await reconcileChangeCards(); await reconcileAnsweredDecisions(scopeFrds); await drainReadyChanges(); const every = await workOrders(); const all = scopeFrds.size ? every.filter((wo) => scopeFrds.has(wo.frd)) : every; if (!all.length && scopeFrds.size) await needsOwner("target-scope", `Targeted FRDs have no work orders: ${[...scopeFrds].join(", ")}`); if (all.every((wo) => wo.status === "VERIFIED")) { await reconcileChangeCards(); finalReason = targeted ? "complete" : every.every((wo) => wo.status === "VERIFIED") ? "hardening" : "complete"; break; }
    let progress = false;
    for (const frd of [...new Set(all.map((wo) => wo.frd))]) {
      let group = (await workOrders()).filter((wo) => wo.frd === frd); if (group.every((wo) => wo.status === "VERIFIED" || wo.status === "BLOCKED")) continue;
      for (let wo of group) {
        if (["VERIFIED", "IN_REVIEW", "BLOCKED"].includes(wo.status)) continue;
        const fresh = await workOrders(); const byId = new Map(fresh.map((item) => [item.id, item])); const ready = wo.deps.every((id) => { const dep = byId.get(id); return dep.status === "VERIFIED" || (dep.frd === wo.frd && dep.status === "IN_REVIEW"); }); if (!ready) continue;
        const stopNow = await safePoint(); if (await honorSafePoint(stopNow)) break;
        if (wo.status === "IN_PROGRESS") await needsOwner(wo.id, "WO remained IN_PROGRESS without an inflight dispatch; deterministic ownership cannot be reconstructed.");
        await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "IN_PROGRESS" }); await appendTrack("wo_start", { frd: wo.frd, wo: wo.id }); await stateCommit(`chore(${wo.id}): start work order`, wo);
        const before = await snapshot(); const preserved = await preservedContext(frd); const result = await dispatch({ id: `implement-${wo.id}-p${passes}`, tier: "STANDARD", prompt: `Implement exactly ${wo.file}. Read the authoritative Build Plan, FRD, blueprint and acceptance criteria. ${preserved} TDD; production code and tests only. Never edit governed frontmatter/status, .pandacorp/run, lease, ledger or phase. Do not commit. Return schema JSON; green means your bounded self-test passed.` }); const files = await delta(before); throwIfStopping();
        if (files.some(governedPath)) throw Object.assign(new Error(`implementer touched governed state: ${files.filter(governedPath)}`), { code: "OWNERSHIP" });
        const sha = await commitPaths(`feat(${wo.id}): implementation attempt`, files, "implementation"); await recordCommit(frd, sha, true);
        if (result.verdict === "needs-owner") { await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "BLOCKED", reason: "needs-owner" }); await stateCommit(`chore(${wo.id}): block for owner`, wo); await needsOwner(wo.id, result.summary); }
        if (result.verdict !== "green") { await rollback(frd, state.attempts[frd] || 0, files); await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "PLANNED" }); await stateCommit(`chore(${wo.id}): reset failed implementation`, wo); continue; }
        await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "IN_REVIEW" }); await appendTrack("wo_end", { frd: wo.frd, wo: wo.id, state: "in_review" }); await stateCommit(`chore(${wo.id}): hand off for review`, wo); progress = true;
      }
      if (finalReason !== "error") break;
      group = (await workOrders()).filter((wo) => wo.frd === frd); if (!group.every((wo) => ["IN_REVIEW", "VERIFIED"].includes(wo.status))) continue;
      const attempt = state.attempts[frd] || 0; await appendTrack("review_start", { frd, attempt }); const reviewBefore = await snapshot(); const preserved = await preservedContext(frd); const review = await dispatch({ id: `review-${frd}-a${attempt}`, tier: "JUDGE", units: 2, validator: validateReviewResult, prompt: `Independently review ${frd} as a fresh judge. ${wholeFrdOracle} ${preserved} Write adversarial TESTS only; never production code or governed state. Run .pandacorp/verify.sh, but report facts honestly—the controller independently reruns it. Your schema verdict must include traceability for every normative contract class; use explicit not-applicable entries where the FRD has none. Return needs-owner only for a genuine owner gate.` }); const reviewFiles = await delta(reviewBefore); throwIfStopping(); const reviewSha = await commitPaths(`test(${frd}): adversarial review attempt ${attempt}`, reviewFiles, "review"); await recordCommit(frd, reviewSha);
      let green = review.verdict === "green" && await verify(`review-${frd}-a${attempt}`) && await mutationGate(frd); let evidenceFiles = [...reviewFiles];
      if (!green && review.verdict !== "needs-owner") { const repairBefore = await snapshot(); const repair = await dispatch({ id: `repair-${frd}-a${attempt}`, tier: "STANDARD", prompt: `Repair only the recorded review findings for ${frd}. Bounded production/test changes; no governed state or commits. Return green only after your focused checks pass.` }); const repairFiles = await delta(repairBefore); if (repairFiles.some(governedPath)) throw Object.assign(new Error("repair touched governed state"), { code: "OWNERSHIP" }); const repairSha = await commitPaths(`fix(${frd}): review repair attempt ${attempt}`, repairFiles, "implementation"); await recordCommit(frd, repairSha); evidenceFiles.push(...repairFiles); green = repair.verdict === "green" && await verify(`repair-${frd}-a${attempt}`) && await mutationGate(frd); }
      if (review.verdict === "needs-owner") { const active = group.filter((x) => x.status === "IN_REVIEW"); for (const wo of active) await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "BLOCKED", reason: "needs-owner" }); await stateCommit(`chore(${frd}): block for owner`, active); await needsOwner(frd, review.summary); }
      if (green) { const active = group.filter((x) => x.status === "IN_REVIEW"); for (const wo of active) await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: "VERIFIED" }); await appendTrack("review_end", { frd, verdict: "pass" }); await appendTrack("frd_end", { frd }); await stateCommit(`chore(${frd}): verify feature`, active); const sha = (await exec("git", ["rev-parse", "--short", "HEAD"])).out.trim(); await stampLastGreen(project, lease.token, lease.epoch, sha); await stateCommit(`chore(${frd}): stamp green`, null); await appendProgress(`${frd} verificado: sus work orders pasaron revisión independiente, pruebas completas y mutation gate.`); state.consecutive_blocks = 0; await setHealth(project, lease.token, lease.epoch, 0); await checkpoint(); }
      else { await appendTrack("review_end", { frd, verdict: "red" }); await rollback(frd, attempt, evidenceFiles); state.attempts[frd] = attempt + 1; const active = group.filter((x) => x.status === "IN_REVIEW"); for (const wo of active) await transitionWorkOrder(project, lease.token, lease.epoch, { file: wo.file, to: state.attempts[frd] > maxRetries ? "BLOCKED" : "PLANNED", reason: "error" }); await stateCommit(`chore(${frd}): record rejected gate`, active); if (state.attempts[frd] > maxRetries) { state.consecutive_blocks++; await setHealth(project, lease.token, lease.epoch, state.consecutive_blocks); } await checkpoint(); }
      progress = true;
    }
    if (finalReason !== "error") break;
    passes++; if (!progress) await needsOwner("dependency-plan", "No build progress is possible: unresolved dependency, BLOCKED prerequisite, or non-convergent state.");
  }

  if (finalReason === "hardening") {
    const auditBefore = await snapshot(); const audit = await dispatch({ id: "hardening-audit", tier: "JUDGE", units: 2, prompt: "READ-ONLY independent final audit. Inspect security, quality and telemetry; do not edit any file, do not fix and do not commit. Return findings in schema JSON. Green means no blocking findings; red means the separate implementer must repair." }); const auditFiles = await delta(auditBefore); if (auditFiles.length) { if (auditFiles.some(governedPath)) await needsOwner("hardening-audit", `Read-only auditor violated governed state: ${auditFiles.filter(governedPath).join(",")}`); await commitAndRevert(auditFiles, "chore: quarantine read-only auditor violation"); await needsOwner("hardening-audit", `Read-only auditor wrote files and was rolled back: ${auditFiles.join(",")}`); } if (audit.verdict === "needs-owner") await needsOwner("hardening-audit", audit.summary);
    const before = await snapshot(); const hard = await dispatch({ id: "hardening-fix", tier: "STANDARD", units: 2, prompt: `Act as the separate hardening implementer. Repair these independent-auditor findings: ${JSON.stringify(audit.findings || [audit.summary])}. Write a dated docs/reviews/security-YYYY-MM-DD.md and add the exact standalone heading "## Verification" (nothing else on that heading line) with evidence in docs/analytics/events.md. Do not edit governed status/phase/rollups or commit. The controller independently verifies artifacts and the full gate.` }); const files = await delta(before); if (files.some(governedPath)) throw Object.assign(new Error("hardening implementer touched governed state"), { code: "OWNERSHIP" });
    const day = new Date().toISOString().slice(0, 10); const security = `docs/reviews/security-${day}.md`; const analytics = "docs/analytics/events.md"; const hasEvidence = files.includes(security) || await readFile(path.join(project, security), "utf8").then(() => true).catch(() => false); const telemetry = await readFile(path.join(project, analytics), "utf8").catch(() => ""); const hardGreen = hard.verdict === "green" && hasEvidence && /^## Verification\s*$/m.test(telemetry) && await verify("hardening-controller");
    const hardSha = await commitPaths("chore: controller-inspected hardening candidate", files, "implementation");
    if (!hardGreen) { if (hardSha) { const reverted = await exec("git", ["revert", "--no-edit", hardSha]); if (reverted.code) await needsOwner("hardening", `Hardening rollback failed: ${reverted.err}`); } await needsOwner("hardening", hard.summary || "Controller-side hardening evidence or deterministic verify is red."); }
    await recordCommit("hardening", hardSha);
    await setProjectPhase(project, lease.token, lease.epoch, "release"); await stateCommit("chore: close construction", null); finalReason = "complete"; await terminal("complete"); notify("Build Codex completado");
  }
  if (finalReason === "complete" && !state.terminal_reason) await terminal("complete");
  if (!["complete", "needs-owner"].includes(finalReason) && !state.terminal_reason) await terminal(finalReason);
  await shutdown(finalReason); process.exitCode = EXIT[finalReason] ?? 2;
} catch (error) {
  {
    const reason = error.code === "NEEDS_OWNER" ? "needs-owner" : error.code === "UNCERTAIN" ? "uncertain" : error.code === "DURATION" ? "duration" : error.code === "SPEND" ? "budget" : error.code === "STOPPED" ? "stopped" : "error"; finalReason = reason;
    await quiesceActive(reason);
    if (["uncertain", "duration"].includes(reason) && lease) { const errorClass = error.providerClass || state.uncertain?.error_class || "unknown"; await pauseForOwner(project, lease.token, lease.epoch, { subject: state.uncertain?.id || state.inflight?.id || "uncertain-dispatch", summary: `Codex exited without a trustworthy terminal result (provider class: ${errorClass}). The executor did not retry; inspect the durable result and git delta before deciding.` }).catch(() => {}); await stateCommit("chore: persist uncertain-dispatch state", null).catch(() => {}); }
    if (!state.terminal_reason) await terminal(reason, { error: error.message, code: error.code || "ERROR" }); await event("executor_stopped", { error: error.message, code: error.code || "ERROR" }); const providerClass = error.providerClass || state.uncertain?.error_class; notify(`Build Codex detenido: ${reason}${providerClass ? ` (${providerClass})` : ""}`); await shutdown(reason); process.exitCode = EXIT[reason] ?? 2;
  }
}
