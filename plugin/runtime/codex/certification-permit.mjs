#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, required = true) => { const i = argv.indexOf(`--${name}`); const v = i >= 0 ? argv[i + 1] : ""; if (required && !v) throw new Error(`missing --${name}`); return v; };
const mode = arg("mode");
const projectInput = arg("project");
const authInput = arg("authorization");
const frds = arg("frds");
const limits = { max_spend: Number(arg("max-spend")), max_duration: Number(arg("max-duration")), max_retries: Number(arg("max-retries")), max_blocks: Number(arg("max-blocks")) };
const pluginRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const git = (project, ...args) => execFileSync("git", ["-C", project, ...args], { encoding: "utf8" }).trim();
const yaml = (text, key) => (text.match(new RegExp(`^${key}:\\s*["']?([^"'#\\s]+)`, "m")) || [])[1] || "";
const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const fail = (message) => { throw new Error(`CERTIFICATION BLOCKED: ${message}`); };

const projectStat = await lstat(projectInput);
if (projectStat.isSymbolicLink()) fail("project path is a symlink");
const project = await realpath(projectInput);
const canaryRoot = await realpath(process.env.NODE_ENV === "test" && process.env.PANDACORP_CANARY_ROOT ? process.env.PANDACORP_CANARY_ROOT : "/Users/Shared/Proyectos/pandacorp-canaries");
if (project === canaryRoot || !project.startsWith(`${canaryRoot}${path.sep}`)) fail("project is outside the disposable canary root");
if (git(project, "rev-parse", "--show-toplevel") !== project) fail("project is not a standalone fixture repository");
const markerFile = path.join(project, ".pandacorp/certification/r10.json");
const markerStat = await lstat(markerFile); if (markerStat.isSymbolicLink()) fail("marker is a symlink");
const marker = await readJson(markerFile);
const authFile = path.resolve(authInput); const authStat = await lstat(authFile); if (authStat.isSymbolicLink()) fail("authorization is a symlink");
const auth = await readJson(authFile);
const receiptFile = path.join(project, ".pandacorp/run/r10-certification-receipt.json");
if (mode === "terminal") {
  const receipt = await readJson(receiptFile);
  if (receipt.nonce !== auth.nonce || receipt.status !== "consumed" || receipt.run_id !== arg("run-id")) fail("terminal revocation has no matching consumed receipt");
  const revoked = { ...receipt, status: "revoked", terminal_at: new Date().toISOString(), terminal_reason: arg("terminal-reason") };
  const tmp = `${receiptFile}.tmp-${process.pid}`; await writeFile(tmp, `${JSON.stringify(revoked, null, 2)}\n`, { mode: 0o600, flag: "wx" }); await rename(tmp, receiptFile);
  process.stdout.write(JSON.stringify({ ok: true, status: revoked.status, receipt: receiptFile })); process.exit(0);
}
if (marker.schema !== 1 || marker.kind !== "pandacorp-r10-installed-canary" || !/^[0-9a-f-]{36}$/i.test(marker.fixture_uuid || "")) fail("invalid versioned fixture marker");
if (auth.schema !== 1 || auth.kind !== "pandacorp-r10-owner-authorization" || !/^[0-9a-f-]{36}$/i.test(auth.nonce || "")) fail("invalid owner authorization");
if (auth.fixture_uuid !== marker.fixture_uuid || auth.stage !== marker.stage || auth.stage !== "codex-frd-b") fail("authorization is not tied to this fixture and stage");
if (marker.frds.join(",") !== frds || auth.frds.join(",") !== frds || frds.includes(",")) fail("FRD target is not the exact single certification target");
for (const [key, value] of Object.entries(limits)) if (marker.limits?.[key] !== value || auth.limits?.[key] !== value) fail(`limit mismatch: ${key}`);
if (marker.launch_mode !== "foreground" || auth.launch_mode !== "foreground") fail("certification must run in foreground");
if (git(project, "status", "--porcelain")) fail("fixture worktree is not clean");
if (git(project, "ls-files", "--error-unmatch", ".pandacorp/certification/r10.json") !== ".pandacorp/certification/r10.json") fail("fixture marker is not versioned");
try { git(project, "merge-base", "--is-ancestor", marker.seed_commit, "HEAD"); } catch { fail("fixture seed is not an ancestor of HEAD"); }
if (auth.seed_commit !== marker.seed_commit || auth.authorized_head !== git(project, "rev-parse", "HEAD")) fail("authorization is not tied to the current fixture head");
const status = await readFile(path.join(project, ".pandacorp/status.yaml"), "utf8");
if (yaml(status, "running") !== "false") fail("Claude did not quiesce at a clean safe point");
const lastGreen = yaml(status, "last_green_sha");
if (!lastGreen || git(project, "merge-base", "--is-ancestor", lastGreen, "HEAD") !== "") fail("last_green_sha is missing or not an ancestor");
try { await lstat(path.join(project, ".pandacorp/run/build.lease/lease.json")); fail("a build lease still exists"); } catch (error) { if (!String(error.message).includes("ENOENT")) throw error; }
const metadata = await readJson(path.join(pluginRoot, "runtime/plugin-metadata.json"));
if (metadata.version !== marker.plugin_version || auth.plugin_version !== marker.plugin_version) fail("plugin pin mismatch");
if (yaml(status, "overlay_version") !== marker.overlay_version || auth.overlay_version !== marker.overlay_version) fail("overlay pin mismatch");
const engineHash = await sha256(path.join(project, ".pandacorp/pandacorp-build.js"));
if (engineHash !== marker.engine_sha256 || auth.engine_sha256 !== marker.engine_sha256) fail("engine pin mismatch");
try { await readJson(receiptFile); fail("this fixture certification stage was already consumed"); } catch (error) { if (!String(error.message).includes("ENOENT")) throw error; }
if (mode === "check") { process.stdout.write(JSON.stringify({ ok: true, fixture_uuid: marker.fixture_uuid, stage: marker.stage, nonce: auth.nonce })); process.exit(0); }
if (mode !== "consume") fail("invalid permit operation");
const now = new Date().toISOString();
let receipt;
receipt = { schema: 1, kind: "pandacorp-r10-certification-receipt", fixture_uuid: marker.fixture_uuid, stage: marker.stage, nonce: auth.nonce, run_id: arg("run-id"), status: "consumed", consumed_at: now, launcher_instance: randomUUID(), frds: marker.frds, limits, plugin_version: marker.plugin_version, overlay_version: marker.overlay_version, engine_sha256: marker.engine_sha256 };
const tmp = `${receiptFile}.tmp-${process.pid}`; await writeFile(tmp, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" }); await rename(tmp, receiptFile);
process.stdout.write(JSON.stringify({ ok: true, status: receipt.status, receipt: receiptFile }));
