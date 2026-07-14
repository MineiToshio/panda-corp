#!/usr/bin/env node
import { chmod, copyFile, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
const exec = promisify(execFile); const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."); const permit = path.join(root, "plugin/runtime/codex/certification-permit.mjs");
let passed = 0; const ok = (v, m) => { if (!v) throw new Error(m); passed++; console.log(`PASS ${m}`); };
const base = await mkdtemp(path.join(os.tmpdir(), "r10-permit-")); const canaries = path.join(base, "pandacorp-canaries"); const project = path.join(canaries, "fixture"); const engineFile = path.join(project, ".claude/engines/pandacorp-build.js"); await mkdir(path.dirname(engineFile), { recursive: true }); await mkdir(path.join(project, ".pandacorp/certification"), { recursive: true }); await mkdir(path.join(project, ".pandacorp/run"), { recursive: true });
const pluginVersion = JSON.parse(await readFile(path.join(root, "plugin/runtime/plugin-metadata.json"), "utf8")).version;
const run = async (args, env = {}) => { try { const r = await exec("node", [permit, ...args], { env: { ...process.env, NODE_ENV: "test", PANDACORP_CANARY_ROOT: canaries, ...env } }); return { code: 0, out: r.stdout + r.stderr }; } catch (e) { return { code: e.code || 1, out: `${e.stdout || ""}${e.stderr || ""}` }; } };
const git = (...args) => exec("git", ["-C", project, ...args]);
await git("init", "-q"); await git("config", "user.email", "fixture@example.invalid"); await git("config", "user.name", "R10 fixture");
await copyFile(path.join(root, "plugin/templates/shared/.claude/engines/pandacorp-build.js"), engineFile); await writeFile(path.join(project, ".gitignore"), ".pandacorp/run/*\n.pandacorp/pandacorp-build.js\n"); await writeFile(path.join(project, ".pandacorp/status.yaml"), 'running: false\noverlay_version: "8.75.0"\nlast_green_sha: ""\n'); await git("add", "."); await git("commit", "-qm", "test: seed"); const seed = (await git("rev-parse", "HEAD")).stdout.trim();
const stage1RunId = "claude-stage-1-run"; const stage1Epoch = 1; const stage1Started = "2026-07-14T00:00:00.000Z";
await writeFile(path.join(project, ".pandacorp/status.yaml"), `phase: implementation\nrunning: false\nrun_started_at: "${stage1Started}"\nbuild_run_id: "${stage1RunId}"\nbuild_runtime: "claude"\nbuild_lease_epoch: ${stage1Epoch}\noverlay_version: "8.75.0"\nlast_green_sha: "${seed}"\n`);
const engine = createHash("sha256").update(await readFile(engineFile)).digest("hex"); const fixture = randomUUID(); const limits = { max_spend: 4, max_duration: 900, max_retries: 0, max_blocks: 1 };
await writeFile(path.join(project, ".pandacorp/certification/r10.json"), `${JSON.stringify({ schema: 1, kind: "pandacorp-r10-installed-canary", fixture_uuid: fixture, seed_commit: seed, stage: "codex-frd-b", frds: ["frd-b-multiply"], limits, launch_mode: "foreground", plugin_version: pluginVersion, overlay_version: "8.75.0", engine_sha256: engine }, null, 2)}\n`); await git("add", "."); await git("commit", "-qm", "test: clean Claude safe point"); const head = (await git("rev-parse", "HEAD")).stdout.trim();
await writeFile(path.join(project, ".pandacorp/run/r10-stage-1.json"), `${JSON.stringify({ runtime:"claude", plugin_version:pluginVersion, overlay_version:"8.75.0", engine_sha256:engine, initial_head:seed, build_run_id:stage1RunId, lease_epoch:stage1Epoch, target_frds:["frd-a-add"], max_agents:24, max_frds:1, snapshot_head:seed, safe_point_head:head, final_head:head, implementation_files:["src/add.mjs","tests/add.test.mjs"] })}\n`);
const authFile = path.join(base, "authorization.json"); const nonce = randomUUID(); const auth = { schema: 1, kind: "pandacorp-r10-owner-authorization", fixture_uuid: fixture, seed_commit: seed, authorized_head: head, stage: "codex-frd-b", nonce, frds: ["frd-b-multiply"], limits, launch_mode: "foreground", plugin_version: pluginVersion, overlay_version: "8.75.0", engine_sha256: engine }; await writeFile(authFile, `${JSON.stringify(auth)}\n`);
const common = ["--project", project, "--authorization", authFile, "--frds", "frd-b-multiply", "--max-spend", "4", "--max-duration", "900", "--max-retries", "0", "--max-blocks", "1"];
let result = await run(["--mode", "check", ...common]); ok(result.code === 0, "real managed-overlay installed-canary permit checks green");
await git("update-index", "--assume-unchanged", ".pandacorp/status.yaml");
for (const [field, replacement] of [["phase", "architecture"], ["build_run_id", "wrong"], ["build_runtime", "codex"], ["build_lease_epoch", "99"], ["run_started_at", ""]]) {
  const original = await readFile(path.join(project, ".pandacorp/status.yaml"), "utf8");
  const changed = original.replace(new RegExp(`^${field}:.*$`, "m"), `${field}: ${replacement === "" ? '""' : JSON.stringify(replacement)}`);
  await writeFile(path.join(project, ".pandacorp/status.yaml"), changed);
  result = await run(["--mode", "check", ...common]); ok(result.code !== 0 && /Stage 1 handoff projection|cold continuation/.test(result.out), `R10 rejects drifted Stage 1 ${field}`);
  await writeFile(path.join(project, ".pandacorp/status.yaml"), original);
}
await git("update-index", "--no-assume-unchanged", ".pandacorp/status.yaml");
ok(!result.out.includes(nonce) && !result.out.includes(auth.nonce), "check stdout discloses no nonce or authorization secret");
await writeFile(path.join(project, ".pandacorp/pandacorp-build.js"), await readFile(engineFile)); result = await run(["--mode", "check", ...common]); ok(result.code === 0, "invented legacy path is ignored when canonical engine is valid"); await rm(path.join(project, ".pandacorp/pandacorp-build.js"));
const originalEngine = await readFile(engineFile); await git("update-index", "--assume-unchanged", ".claude/engines/pandacorp-build.js"); await writeFile(engineFile, "tampered\n"); result = await run(["--mode", "check", ...common]); ok(result.code !== 0 && /engine pin mismatch/.test(result.out), "wrong canonical engine fails closed"); await writeFile(engineFile, originalEngine);
await rm(engineFile); result = await run(["--mode", "check", ...common]); ok(result.code !== 0 && /canonical managed engine is missing/.test(result.out), "missing canonical engine fails closed"); await writeFile(engineFile, originalEngine);
const engineTarget = path.join(base, "engine-target.js"); await writeFile(engineTarget, originalEngine); await rm(engineFile); await symlink(engineTarget, engineFile); result = await run(["--mode", "check", ...common]); ok(result.code !== 0 && /symlink|regular versioned overlay/.test(result.out), "symlink canonical engine fails closed"); await rm(engineFile); await writeFile(engineFile, originalEngine); await rm(engineTarget);
const linked = path.join(canaries, "linked-fixture"); await symlink(project, linked); result = await run(["--mode", "check", ...common.map((v, i) => i && common[i - 1] === "--project" ? linked : v)]); ok(result.code !== 0 && /symlink/.test(result.out), "symlink fixture fails closed");
const outside = path.join(base, "outside"); await mkdir(outside); result = await run(["--mode", "check", ...common.map((v, i) => i && common[i - 1] === "--project" ? outside : v)]); ok(result.code !== 0 && /outside/.test(result.out), "non-canary path fails closed");
result = await run(["--mode", "check", ...common.map((v, i) => i && common[i - 1] === "--frds" ? "frd-a-add" : v)]); ok(result.code !== 0 && /FRD target/.test(result.out), "wrong FRD fails closed");
result = await run(["--mode", "check", ...common.map((v, i) => i && common[i - 1] === "--max-spend" ? "5" : v)]); ok(result.code !== 0 && /limit mismatch/.test(result.out), "wrong limit fails closed");
result = await run(["--mode", "consume", ...common, "--run-id", "r10-test"]); ok(result.code === 0, "permit is consumed atomically");
result = await run(["--mode", "consume", ...common, "--run-id", "r10-test"]); ok(result.code !== 0 && /already consumed/.test(result.out), "consumed fixture stage cannot retry");
result = await run(["--mode", "terminal", ...common, "--run-id", "r10-test", "--terminal-reason", "test-green"]); const receipt = JSON.parse(await readFile(path.join(project, ".pandacorp/run/r10-certification-receipt.json"))); ok(result.code === 0 && receipt.status === "revoked", "terminal path revokes permit");
result = await run(["--mode", "check", ...common]); ok(result.code !== 0 && /already consumed/.test(result.out), "revoked permit remains one-shot");

// BL-0077: while implement is FALLBACK, the normal launcher must not turn an omitted
// authorization into permission to write build state.
const bin = path.join(base, "bin"); await mkdir(bin); const fakeCodex = path.join(bin, "codex");
await writeFile(fakeCodex, "#!/bin/sh\n[ \"${1:-}\" = login ] && exit 0\nexit 99\n"); await chmod(fakeCodex, 0o755);
try {
  await exec("bash", [path.join(root, "plugin/scripts/launch-codex-implement.sh"), project, "4", "900", "0", "1", "", "frd-b-multiply", "auto", "foreground", ""], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  ok(false, "empty authorization fails closed while Codex implement is FALLBACK");
} catch (error) {
  ok(/FALLBACK.*certification authorization/i.test(`${error.stdout || ""}${error.stderr || ""}`), "empty authorization fails closed while Codex implement is FALLBACK");
}

// R11 is a distinct one-shot contract. It binds the Codex-only executor surfaces,
// an exact multi-FRD scope and the unattended ceilings without widening R10.
const hashes = {};
for (const [key, file] of Object.entries({ executor_sha256: "plugin/runtime/codex/executor.mjs", supervisor_sha256: "plugin/runtime/codex/supervisor.mjs", launcher_sha256: "plugin/scripts/launch-codex-implement.sh" })) hashes[key] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
const r11Limits = { max_spend: 24, max_duration: 28800, max_retries: 2, max_blocks: 3 };
const r11Frds = ["frd-a-overnight", "frd-b-overnight"];
const canonicalProject = await realpath(project);
await writeFile(path.join(project, ".pandacorp/certification/r11.json"), `${JSON.stringify({ schema: 1, kind: "pandacorp-r11-installed-canary", fixture_uuid: fixture, fixture_path: canonicalProject, seed_commit: seed, stage: "codex-live-overnight", frds: r11Frds, limits: r11Limits, launch_mode: "foreground", plugin_version: pluginVersion, overlay_version: "8.75.0", ...hashes }, null, 2)}\n`);
await git("add", ".pandacorp/certification/r11.json"); await git("commit", "-qm", "test: bind R11 certification fixture"); const r11Head = (await git("rev-parse", "HEAD")).stdout.trim();
const r11AuthFile = path.join(base, "r11-authorization.json"); const r11Nonce = randomUUID();
const r11Auth = { schema: 1, kind: "pandacorp-r11-owner-authorization", fixture_uuid: fixture, fixture_path: canonicalProject, seed_commit: seed, authorized_head: r11Head, stage: "codex-live-overnight", nonce: r11Nonce, frds: r11Frds, limits: r11Limits, launch_mode: "foreground", plugin_version: pluginVersion, overlay_version: "8.75.0", ...hashes };
await writeFile(r11AuthFile, `${JSON.stringify(r11Auth)}\n`);
const r11Common = ["--project", project, "--authorization", r11AuthFile, "--frds", r11Frds.join(","), "--max-spend", "24", "--max-duration", "28800", "--max-retries", "2", "--max-blocks", "3"];
result = await run(["--mode", "check", ...r11Common]); ok(result.code === 0, `R11 installed-canary permit checks green independently of R10: ${result.out}`);
const forgedAuth = path.join(base, "r11-forged.json"); await writeFile(forgedAuth, `${JSON.stringify({ ...r11Auth, launcher_sha256: "0".repeat(64) })}\n`);
result = await run(["--mode", "check", ...r11Common.map((v, i) => i && r11Common[i - 1] === "--authorization" ? forgedAuth : v)]); ok(result.code !== 0 && /launcher pin mismatch/.test(result.out), "R11 launcher hash drift fails closed");
const linkedAuth = path.join(base, "r11-linked-auth.json"); await symlink(r11AuthFile, linkedAuth);
result = await run(["--mode", "check", ...r11Common.map((v, i) => i && r11Common[i - 1] === "--authorization" ? linkedAuth : v)]); ok(result.code !== 0 && /authorization is a symlink/.test(result.out), "R11 symlink authorization fails closed");
result = await run(["--mode", "consume", ...r11Common, "--run-id", "r11-test"]); ok(result.code === 0, "R11 authority is consumed atomically before build ownership");
result = await run(["--mode", "consume", ...r11Common, "--run-id", "r11-test"]); ok(result.code !== 0 && /already consumed/.test(result.out), "R11 consumed authority cannot replay");
result = await run(["--mode", "terminal", ...r11Common, "--run-id", "r11-test", "--terminal-reason", "test-green"]); const r11Receipt = JSON.parse(await readFile(path.join(project, ".pandacorp/run/r11-certification-receipt.json"))); ok(result.code === 0 && r11Receipt.status === "revoked", "R11 terminal path revokes its distinct receipt");
result = await run(["--mode", "check", ...r11Common]); ok(result.code !== 0 && /already consumed/.test(result.out), "R11 revoked receipt blocks resume and retry");

const recoveryProject = path.join(canaries, "recovery-fixture"); await exec("git", ["clone", "-q", project, recoveryProject]);
await mkdir(path.join(recoveryProject, ".pandacorp/run"), { recursive: true });
const cloneCommon = r11Common.map((v, i) => i && r11Common[i - 1] === "--project" ? recoveryProject : v);
result = await run(["--mode", "check", ...cloneCommon]); ok(result.code !== 0 && /exact fixture path/.test(result.out), "a cloned fixture cannot reuse R11 authority");
await exec("git", ["-C", recoveryProject, "config", "user.email", "fixture@example.invalid"]); await exec("git", ["-C", recoveryProject, "config", "user.name", "R11 recovery fixture"]);
const canonicalRecoveryProject = await realpath(recoveryProject); const recoveryFixture = randomUUID(); const recoveryMarker = { ...JSON.parse(await readFile(path.join(recoveryProject, ".pandacorp/certification/r11.json"))), fixture_uuid: recoveryFixture, fixture_path: canonicalRecoveryProject };
await writeFile(path.join(recoveryProject, ".pandacorp/certification/r11.json"), `${JSON.stringify(recoveryMarker, null, 2)}\n`); await exec("git", ["-C", recoveryProject, "add", ".pandacorp/certification/r11.json"]); await exec("git", ["-C", recoveryProject, "commit", "-qm", "test: bind recovery fixture"]); const recoveryHead = (await exec("git", ["-C", recoveryProject, "rev-parse", "HEAD"])).stdout.trim();
const recoveryAuthFile = path.join(base, "r11-recovery-authorization.json"); const recoveryAuth = { ...r11Auth, fixture_uuid: recoveryFixture, fixture_path: canonicalRecoveryProject, authorized_head: recoveryHead, nonce: randomUUID() }; await writeFile(recoveryAuthFile, `${JSON.stringify(recoveryAuth)}\n`);
const recoveryCommon = r11Common.map((v, i) => i && r11Common[i - 1] === "--project" ? recoveryProject : i && r11Common[i - 1] === "--authorization" ? recoveryAuthFile : v);
result = await run(["--mode", "consume", ...recoveryCommon, "--run-id", "r11-recovery"]); ok(result.code === 0, `R11 recovery fixture consumes once: ${result.out}`);
result = await run(["--mode", "check", ...recoveryCommon]); const recoveryReceipt = JSON.parse(await readFile(path.join(recoveryProject, ".pandacorp/run/r11-certification-receipt.json"))); ok(result.code !== 0 && recoveryReceipt.status === "revoked" && recoveryReceipt.terminal_reason === "recovery-reentry", "R11 resumed path revokes consumed authority before refusing recovery");
const foreignValidReceiptFile = path.join(recoveryProject, ".pandacorp/run/foreign-valid-r11-receipt.json"); await writeFile(foreignValidReceiptFile, `${JSON.stringify({ ...recoveryReceipt, status: "consumed", run_id: "foreign-valid-run", stage: "codex-live-overnight" })}\n`);
try {
  await exec("node", [path.join(root, "plugin/runtime/codex/executor.mjs"), "--project", recoveryProject, "--run-id", "foreign-valid-run", "--max-spend", "24", "--max-duration", "28800", "--max-retries", "2", "--max-blocks", "3", "--frds", r11Frds.join(","), "--certification-receipt", foreignValidReceiptFile]);
  ok(false, "executor rejects a valid-shaped R11 receipt at a foreign in-tree path before lease acquisition");
} catch (error) {
  const leaseExists = await readFile(path.join(recoveryProject, ".pandacorp/run/build.lease/lease.json")).then(() => true).catch(() => false);
  ok(/invalid, drifted or unconsumed certification receipt/.test(`${error.stdout || ""}${error.stderr || ""}`) && !leaseExists, "executor rejects a valid-shaped R11 receipt at a foreign in-tree path before lease acquisition");
}
const forgedReceiptFile = path.join(recoveryProject, ".pandacorp/run/forged-certification-receipt.json"); await writeFile(forgedReceiptFile, `${JSON.stringify({ ...recoveryReceipt, status: "consumed", run_id: "forged-run", stage: "codex-frd-b" })}\n`);
try {
  await exec("node", [path.join(root, "plugin/runtime/codex/executor.mjs"), "--project", recoveryProject, "--run-id", "forged-run", "--max-spend", "24", "--max-duration", "28800", "--max-retries", "2", "--max-blocks", "3", "--frds", r11Frds.join(","), "--certification-receipt", forgedReceiptFile]);
  ok(false, "executor rejects a certification kind/stage mismatch before lease acquisition");
} catch (error) {
  const leaseExists = await readFile(path.join(recoveryProject, ".pandacorp/run/build.lease/lease.json")).then(() => true).catch(() => false);
  ok(/invalid, drifted or unconsumed certification receipt/.test(`${error.stdout || ""}${error.stderr || ""}`) && !leaseExists, "executor rejects a certification kind/stage mismatch before lease acquisition");
}

// The foreground launcher must leave CERT_CONSUMED set when its first terminal
// revoke fails so the EXIT trap performs a second, successful revocation.
const launcherProject = path.join(canaries, "launcher-revoke-fixture"); await exec("git", ["clone", "-q", project, launcherProject]);
await exec("git", ["-C", launcherProject, "config", "user.email", "fixture@example.invalid"]); await exec("git", ["-C", launcherProject, "config", "user.name", "R11 launcher fixture"]); await mkdir(path.join(launcherProject, ".pandacorp/run"), { recursive: true });
const canonicalLauncherProject = await realpath(launcherProject); const launcherFixture = randomUUID();
const launcherMarker = { ...JSON.parse(await readFile(path.join(launcherProject, ".pandacorp/certification/r11.json"))), fixture_uuid: launcherFixture, fixture_path: canonicalLauncherProject };
await writeFile(path.join(launcherProject, ".pandacorp/certification/r11.json"), `${JSON.stringify(launcherMarker, null, 2)}\n`); await exec("git", ["-C", launcherProject, "add", ".pandacorp/certification/r11.json"]); await exec("git", ["-C", launcherProject, "commit", "-qm", "test: bind launcher fixture"]); const launcherHead = (await exec("git", ["-C", launcherProject, "rev-parse", "HEAD"])).stdout.trim();
const launcherAuthFile = path.join(base, "r11-launcher-authorization.json"); await writeFile(launcherAuthFile, `${JSON.stringify({ ...r11Auth, fixture_uuid: launcherFixture, fixture_path: canonicalLauncherProject, authorized_head: launcherHead, nonce: randomUUID() })}\n`);
const launcherRoot = path.join(base, "launcher-plugin"); await mkdir(path.join(launcherRoot, "scripts"), { recursive: true }); await mkdir(path.join(launcherRoot, "runtime/codex"), { recursive: true });
await copyFile(path.join(root, "plugin/scripts/launch-codex-implement.sh"), path.join(launcherRoot, "scripts/launch-codex-implement.sh")); await copyFile(path.join(root, "plugin/runtime/skill-runtime-policy.json"), path.join(launcherRoot, "runtime/skill-runtime-policy.json"));
await writeFile(path.join(launcherRoot, "scripts/resolve-build-run-id.mjs"), 'console.log(JSON.stringify({run_id:"launcher-revoke-run",continuation:false,reason:"test"}));\n');
await writeFile(path.join(launcherRoot, "scripts/preflight-implement.sh"), "#!/bin/sh\nexit 0\n"); await chmod(path.join(launcherRoot, "scripts/preflight-implement.sh"), 0o755);
await writeFile(path.join(launcherRoot, "scripts/preflight-codex-unattended.mjs"), "process.exit(0);\n");
await writeFile(path.join(launcherRoot, "runtime/codex/supervisor.mjs"), "setTimeout(()=>process.exit(0),1500);\n");
const terminalCount = path.join(base, "terminal-count");
await writeFile(path.join(launcherRoot, "runtime/codex/certification-permit.mjs"), `import{readFileSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';const f=process.env.PANDACORP_TERMINAL_COUNT;const terminal=process.argv.includes('--mode')&&process.argv[process.argv.indexOf('--mode')+1]==='terminal';let n=0;try{n=Number(readFileSync(f,'utf8'))||0}catch{}if(terminal){n++;writeFileSync(f,String(n));if(n===1)process.exit(91)}const r=spawnSync(process.execPath,[${JSON.stringify(permit)},...process.argv.slice(2)],{stdio:'inherit',env:process.env});process.exit(r.status??92);\n`);
const launcherBin = path.join(base, "launcher-bin"); await mkdir(launcherBin); await writeFile(path.join(launcherBin, "codex"), "#!/bin/sh\nexit 0\n"); await chmod(path.join(launcherBin, "codex"), 0o755); await writeFile(path.join(launcherBin, "caffeinate"), "#!/bin/sh\npid=${4:-0}\nwhile kill -0 \"$pid\" 2>/dev/null; do sleep 0.1; done\n"); await chmod(path.join(launcherBin, "caffeinate"), 0o755);
try {
  await exec("bash", [path.join(launcherRoot, "scripts/launch-codex-implement.sh"), launcherProject, "24", "28800", "2", "3", "", r11Frds.join(","), "auto", "foreground", launcherAuthFile], { env: { ...process.env, NODE_ENV: "test", PANDACORP_CANARY_ROOT: canaries, PANDACORP_TERMINAL_COUNT: terminalCount, PATH: `${launcherBin}:${process.env.PATH}` } });
  ok(false, "foreground launcher fails closed and retries terminal revocation from EXIT after the first revoke fails");
} catch (error) {
  const finalReceipt = JSON.parse(await readFile(path.join(launcherProject, ".pandacorp/run/r11-certification-receipt.json"))); const calls = Number(await readFile(terminalCount, "utf8"));
  ok(error.code === 3 && calls === 2 && finalReceipt.status === "revoked", "foreground launcher fails closed and retries terminal revocation from EXIT after the first revoke fails");
}

await rm(base, { recursive: true, force: true }); console.log(`${passed}/${passed} passed`);
