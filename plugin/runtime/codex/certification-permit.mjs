#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, required = true) => { const i = argv.indexOf(`--${name}`); const value = i >= 0 ? argv[i + 1] : ""; if (required && !value) throw new Error(`missing --${name}`); return value; };
const fail = (message) => { throw new Error(`CERTIFICATION BLOCKED: ${message}`); };
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const git = (project, ...args) => execFileSync("git", ["-C", project, ...args], { encoding: "utf8" }).trim();
const yaml = (text, key) => (text.match(new RegExp(`^${key}:\\s*["']?([^"'#\\s]+)`, "m")) || [])[1] || "";
const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const assertRegular = async (file, label) => { const entry = await lstat(file); if (entry.isSymbolicLink() || !entry.isFile()) fail(`${label} is a symlink or not a regular file`); };

const mode = arg("mode");
const projectInput = arg("project");
const authInput = arg("authorization");
const frds = arg("frds");
const limits = { max_spend: Number(arg("max-spend")), max_duration: Number(arg("max-duration")), max_retries: Number(arg("max-retries")), max_blocks: Number(arg("max-blocks")) };
const pluginRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const projectStat = await lstat(projectInput);
if (projectStat.isSymbolicLink()) fail("project path is a symlink");
const project = await realpath(projectInput);
const canaryRoot = await realpath(process.env.NODE_ENV === "test" && process.env.PANDACORP_CANARY_ROOT ? process.env.PANDACORP_CANARY_ROOT : "/Users/Shared/Proyectos/pandacorp-canaries");
if (project === canaryRoot || !project.startsWith(`${canaryRoot}${path.sep}`)) fail("project is outside the disposable canary root");
if (git(project, "rev-parse", "--show-toplevel") !== project) fail("project is not a standalone fixture repository");

const authFile = path.resolve(authInput);
await assertRegular(authFile, "authorization");
const auth = await readJson(authFile);
const contracts = {
  "pandacorp-r10-owner-authorization": { name: "r10", markerKind: "pandacorp-r10-installed-canary", receiptKind: "pandacorp-r10-certification-receipt", stage: "codex-frd-b", marker: ".pandacorp/certification/r10.json", receipt: ".pandacorp/run/r10-certification-receipt.json" },
  "pandacorp-r11-owner-authorization": { name: "r11", markerKind: "pandacorp-r11-installed-canary", receiptKind: "pandacorp-r11-certification-receipt", stage: "codex-live-overnight", marker: ".pandacorp/certification/r11.json", receipt: ".pandacorp/run/r11-certification-receipt.json" },
};
const contract = contracts[auth.kind];
if (auth.schema !== 1 || !contract || !/^[0-9a-f-]{36}$/i.test(auth.nonce || "")) fail("invalid owner authorization");
const receiptFile = path.join(project, contract.receipt);

// Terminal revocation intentionally does not re-check HEAD or a clean tree: a valid
// certification run changes both. It only revokes the exact already-consumed authority.
if (mode === "terminal") {
  const receipt = await readJson(receiptFile);
  if (receipt.kind !== contract.receiptKind || receipt.nonce !== auth.nonce || receipt.status !== "consumed" || receipt.run_id !== arg("run-id") || receipt.stage !== contract.stage) fail("terminal revocation has no matching consumed receipt");
  const revoked = { ...receipt, status: "revoked", terminal_at: new Date().toISOString(), terminal_reason: arg("terminal-reason") };
  const tmp = `${receiptFile}.tmp-${process.pid}`; await writeFile(tmp, `${JSON.stringify(revoked, null, 2)}\n`, { mode: 0o600, flag: "wx" }); await rename(tmp, receiptFile);
  process.stdout.write(JSON.stringify({ ok: true, certification: contract.name, status: revoked.status, receipt: receiptFile })); process.exit(0);
}

const markerFile = path.join(project, contract.marker);
await assertRegular(markerFile, "marker");
const marker = await readJson(markerFile);
if (marker.schema !== 1 || marker.kind !== contract.markerKind || !/^[0-9a-f-]{36}$/i.test(marker.fixture_uuid || "")) fail("invalid versioned fixture marker");
if (auth.fixture_uuid !== marker.fixture_uuid || auth.stage !== marker.stage || auth.stage !== contract.stage) fail("authorization is not tied to this fixture and stage");
if (contract.name === "r11" && (marker.fixture_path !== project || auth.fixture_path !== project)) fail("R11 authorization is not tied to this exact fixture path");
if (!Array.isArray(marker.frds) || !Array.isArray(auth.frds) || marker.frds.join(",") !== frds || auth.frds.join(",") !== frds || new Set(marker.frds).size !== marker.frds.length) fail("FRD target is not the exact certification target");
if (contract.name === "r10" && (marker.frds.length !== 1 || frds.includes(","))) fail("R10 requires one exact FRD target");
if (contract.name === "r11" && (marker.frds.length < 2 || limits.max_duration < 10800)) fail("R11 requires at least two exact FRDs and a three-hour-or-longer duration ceiling");
for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || marker.limits?.[key] !== value || auth.limits?.[key] !== value) fail(`limit mismatch: ${key}`);
if (marker.launch_mode !== "foreground" || auth.launch_mode !== "foreground") fail("certification must run in foreground");
if (git(project, "status", "--porcelain")) fail("fixture worktree is not clean");
if (git(project, "ls-files", "--error-unmatch", contract.marker) !== contract.marker) fail("fixture marker is not versioned");
try { git(project, "merge-base", "--is-ancestor", marker.seed_commit, "HEAD"); } catch { fail("fixture seed is not an ancestor of HEAD"); }
if (auth.seed_commit !== marker.seed_commit || auth.authorized_head !== git(project, "rev-parse", "HEAD")) fail("authorization is not tied to the current fixture head");

const status = await readFile(path.join(project, ".pandacorp/status.yaml"), "utf8");
if (yaml(status, "running") !== "false") fail("fixture is not quiesced at a clean safe point");
try { await lstat(path.join(project, ".pandacorp/run/build.lease/lease.json")); fail("a build lease still exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const metadata = await readJson(path.join(pluginRoot, "runtime/plugin-metadata.json"));
if (metadata.version !== marker.plugin_version || auth.plugin_version !== marker.plugin_version) fail("plugin pin mismatch");
if (yaml(status, "overlay_version") !== marker.overlay_version || auth.overlay_version !== marker.overlay_version) fail("overlay pin mismatch");

if (contract.name === "r10") {
  const lastGreen = yaml(status, "last_green_sha");
  if (!lastGreen || git(project, "merge-base", "--is-ancestor", lastGreen, "HEAD") !== "") fail("last_green_sha is missing or not an ancestor");
  const engineFile = path.join(project, ".claude/engines/pandacorp-build.js");
  try { await assertRegular(engineFile, "managed engine"); } catch (error) { if (error?.code === "ENOENT") fail("canonical managed engine is missing"); throw error; }
  if (git(project, "ls-files", "--error-unmatch", ".claude/engines/pandacorp-build.js") !== ".claude/engines/pandacorp-build.js") fail("managed engine is not versioned at the canonical overlay path");
  if (await sha256(engineFile) !== marker.engine_sha256 || auth.engine_sha256 !== marker.engine_sha256) fail("engine pin mismatch");
} else {
  const pins = { executor: "runtime/codex/executor.mjs", supervisor: "runtime/codex/supervisor.mjs", launcher: "scripts/launch-codex-implement.sh" };
  for (const [label, relative] of Object.entries(pins)) {
    const key = `${label}_sha256`; const actual = await sha256(path.join(pluginRoot, relative));
    if (!/^[0-9a-f]{64}$/.test(marker[key] || "") || actual !== marker[key] || auth[key] !== marker[key]) fail(`${label} pin mismatch`);
  }
}

let existingReceipt = null;
try { existingReceipt = await readJson(receiptFile); } catch (error) { if (error?.code !== "ENOENT") throw error; }
if (existingReceipt) {
  if (mode === "check" && existingReceipt.kind === contract.receiptKind && existingReceipt.status === "consumed" && existingReceipt.nonce === auth.nonce) {
    const revoked = { ...existingReceipt, status: "revoked", terminal_at: new Date().toISOString(), terminal_reason: "recovery-reentry" };
    const tmp = `${receiptFile}.tmp-${process.pid}`; await writeFile(tmp, `${JSON.stringify(revoked, null, 2)}\n`, { mode: 0o600, flag: "wx" }); await rename(tmp, receiptFile);
  }
  fail("this fixture certification stage was already consumed");
}
if (mode === "check") { process.stdout.write(JSON.stringify({ ok: true, certification: contract.name, fixture_uuid: marker.fixture_uuid, stage: marker.stage, receipt: receiptFile })); process.exit(0); }
if (mode !== "consume") fail("invalid permit operation");
const receipt = { schema: 1, kind: contract.receiptKind, certification: contract.name, fixture_uuid: marker.fixture_uuid, stage: marker.stage, nonce: auth.nonce, run_id: arg("run-id"), status: "consumed", consumed_at: new Date().toISOString(), launcher_instance: randomUUID(), frds: marker.frds, limits, plugin_version: marker.plugin_version, overlay_version: marker.overlay_version };
if (contract.name === "r10") receipt.engine_sha256 = marker.engine_sha256;
else Object.assign(receipt, { executor_sha256: marker.executor_sha256, supervisor_sha256: marker.supervisor_sha256, launcher_sha256: marker.launcher_sha256 });
const tmp = `${receiptFile}.tmp-${process.pid}`; await writeFile(tmp, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" }); await rename(tmp, receiptFile);
process.stdout.write(JSON.stringify({ ok: true, certification: contract.name, status: receipt.status, receipt: receiptFile }));
