#!/usr/bin/env node
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const adapter = path.join(root, "plugin/scripts/pandacorp-hook-adapter.mjs");
const rules = path.join(root, ".codex/rules/pandacorp.rules");
let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  try { await fn(); process.stdout.write(`PASS  ${name}\n`); passed++; }
  catch (error) { process.stderr.write(`FAIL  ${name}: ${error.stack || error}\n`); failed++; }
};
const ok = (condition, message) => { if (!condition) throw new Error(message); };
const hook = (runtime, event, payload, env = process.env) => spawnSync(process.execPath, [adapter, "--runtime", runtime, "--event", event], { input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8", env });
const project = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pc-enforcement-"));
  await mkdir(path.join(dir, ".pandacorp", "run"), { recursive: true });
  await writeFile(path.join(dir, ".pandacorp", "status.yaml"), "phase: implementation\nrunning: false\nsupervisor_heartbeat: \"\"\n");
  await writeFile(path.join(dir, "CLAUDE.md"), "# Pandacorp\n");
  spawnSync("git", ["init", "-q"], { cwd: dir });
  return dir;
};

for (const runtime of ["claude", "codex"]) {
  await test(`${runtime}: dangerous command is denied through normalized payload`, async () => {
    const cwd = await project();
    const payload = runtime === "claude"
      ? { cwd, tool_name: "Bash", tool_input: { command: "git push --force origin main" } }
      : { cwd, toolName: "exec_command", input: { cmd: "git push --force origin main" } };
    const result = hook(runtime, "pre-tool", payload);
    ok(result.status === 2 && /BLOCKED/.test(result.stderr), `expected deny, got ${result.status}`);
    await rm(cwd, { recursive: true });
  });

  await test(`${runtime}: protected state recursive delete is denied`, async () => {
    const cwd = await project();
    const result = hook(runtime, "pre-tool", { cwd, tool_name: "Bash", tool_input: { command: "rm -rf .pandacorp" } });
    ok(result.status === 2 && /protected Pandacorp state/.test(result.stderr), "protected state was not denied");
    await rm(cwd, { recursive: true });
  });

  await test(`${runtime}: invalid payload fails closed`, async () => {
    const result = hook(runtime, "pre-tool", "{not-json");
    ok(result.status === 2 && /invalid JSON/.test(result.stderr), "invalid payload did not fail closed");
  });
}

await test("Codex: direct governed apply_patch is denied", async () => {
  const cwd = await project();
  const result = hook("codex", "pre-tool", { cwd, tool_name: "apply_patch", tool_input: { patch: "*** Update File: .pandacorp/status.yaml\n+running: true" } });
  ok(result.status === 2 && /governed build state/.test(result.stderr), "governed write was not denied");
  await rm(cwd, { recursive: true });
});

await test("Codex: Claude runtime dispatch is denied", async () => {
  const cwd = await project();
  const result = hook("codex", "pre-tool", { cwd, tool_name: "exec_command", tool_input: { command: "claude -p build" } });
  ok(result.status === 2 && /may not dispatch/.test(result.stderr), "cross-runtime dispatch was not denied");
  await rm(cwd, { recursive: true });
});

await test("Claude: Codex runtime dispatch is denied", async () => {
  const cwd = await project();
  const result = hook("claude", "pre-tool", { cwd, tool_name: "Bash", tool_input: { command: "codex exec build" } });
  ok(result.status === 2 && /may not dispatch/.test(result.stderr), "cross-runtime dispatch was not denied");
  await rm(cwd, { recursive: true });
});

await test("Codex: fenced CLI requires local runtime and fence arguments", async () => {
  const cwd = await project();
  const foreign = hook("codex", "pre-tool", { cwd, tool_name: "exec_command", tool_input: { command: "node plugin/scripts/pandacorp-build-state.mjs acquire --runtime claude --run-id x" } });
  const unfenced = hook("codex", "pre-tool", { cwd, tool_name: "exec_command", tool_input: { command: "node plugin/scripts/pandacorp-build-state.mjs renew --epoch 2" } });
  const transition = hook("codex", "pre-tool", { cwd, tool_name: "exec_command", tool_input: { command: "node plugin/scripts/pandacorp-build-state.mjs transition-wo --file docs/frds/x/work-orders/wo-1.md --to VERIFIED" } });
  ok(foreign.status === 2 && unfenced.status === 2 && transition.status === 2, "lease ownership precheck was bypassed");
  await rm(cwd, { recursive: true });
});

await test("Codex: red Stop gate denies completion", async () => {
  const cwd = await project();
  await writeFile(path.join(cwd, ".pandacorp", "verify.sh"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  const result = hook("codex", "stop", { cwd, session_id: "s1", stop_hook_active: false });
  ok(result.status === 2 && /verify gate FAILED/.test(result.stderr), `red stop returned ${result.status}`);
  await rm(cwd, { recursive: true });
});

await test("Codex: neither a fresh legacy lock nor a live Codex lease can silence a red Stop gate", async () => {
  const cwd = await project(); const run = path.join(cwd, ".pandacorp", "run");
  await writeFile(path.join(cwd, ".pandacorp", "verify.sh"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  await writeFile(path.join(run, "build.lock"), "");
  let result = hook("codex", "stop", { cwd, session_id: "s1", stop_hook_active: false });
  ok(result.status === 2, "legacy lock silenced Codex verification");
  await mkdir(path.join(run, "build.lease"));
  await writeFile(path.join(run, "build.lease", "lease.json"), `${JSON.stringify({ runtime: "codex", renewed_at: new Date().toISOString(), ttl_seconds: 600 })}\n`);
  result = hook("codex", "stop", { cwd, session_id: "s1", stop_hook_active: false });
  ok(result.status === 2, "live Codex lease silenced verification before ownership certification"); await rm(cwd, { recursive: true });
});

await test("Claude: only a valid live Claude lease suppresses its known-good Stop gate", async () => {
  const cwd = await project(); const leaseDir = path.join(cwd, ".pandacorp", "run", "build.lease"); await mkdir(leaseDir);
  await writeFile(path.join(cwd, ".pandacorp", "verify.sh"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  await writeFile(path.join(leaseDir, "lease.json"), `${JSON.stringify({ runtime: "claude", renewed_at: new Date().toISOString(), ttl_seconds: 600 })}\n`);
  const result = hook("claude", "stop", { cwd, session_id: "s1", stop_hook_active: false }); ok(result.status === 0, `live Claude owner was not honored: ${result.stderr}`); await rm(cwd, { recursive: true });
});

await test("malformed lease evidence makes both Stop adapters fail closed", async () => {
  const cwd = await project(); const leaseDir = path.join(cwd, ".pandacorp", "run", "build.lease"); await mkdir(leaseDir);
  await writeFile(path.join(cwd, ".pandacorp", "verify.sh"), "#!/bin/bash\nexit 0\n", { mode: 0o755 }); await writeFile(path.join(leaseDir, "lease.json"), "{}\n");
  for (const runtime of ["claude", "codex"]) { const result = hook(runtime, "stop", { cwd, session_id: "s1", stop_hook_active: false }); ok(result.status === 2, `${runtime} accepted malformed lease evidence`); }
  await rm(cwd, { recursive: true });
});

await test("both adapters fail closed when jq is absent", async () => {
  const cwd = await project();
  const bin = await mkdtemp(path.join(os.tmpdir(), "pc-no-jq-"));
  for (const executable of ["git", "grep", "sed", "find", "date", "head", "sort", "comm", "tail", "mkdir", "dirname", "basename"]) {
    const resolved = spawnSync("/usr/bin/which", [executable], { encoding: "utf8" }).stdout.trim();
    if (resolved) await symlink(resolved, path.join(bin, executable));
  }
  const env = { ...process.env, PATH: bin };
  for (const runtime of ["claude", "codex"]) {
    const result = hook(runtime, "pre-tool", { cwd, tool_name: "Bash", tool_input: { command: "git status" } }, env);
    ok(result.status === 2 && /jq missing/.test(result.stderr), `${runtime} allowed without jq`);
  }
  await rm(bin, { recursive: true });
  await rm(cwd, { recursive: true });
});

await test("Codex 0.144.1 strict config accepts generated project config", async () => {
  const result = spawnSync("codex", ["--strict-config", "doctor", "--summary", "--no-color"], { cwd: root, encoding: "utf8", env: { ...process.env, TERM: process.env.TERM === "dumb" ? "xterm-256color" : process.env.TERM } });
  ok(result.status === 0 && /config\s+loaded/.test(result.stdout), result.stderr || "strict config rejected");
});

await test("Codex execpolicy forbids destructive command and leaves safe command unmatched", async () => {
  const denied = spawnSync("codex", ["execpolicy", "check", "--rules", rules, "git", "reset", "--hard", "HEAD"], { cwd: root, encoding: "utf8" });
  const allowed = spawnSync("codex", ["execpolicy", "check", "--rules", rules, "git", "status"], { cwd: root, encoding: "utf8" });
  ok(denied.status === 0 && JSON.parse(denied.stdout).decision === "forbidden", "destructive command not forbidden");
  ok(allowed.status === 0 && !JSON.parse(allowed.stdout).decision, "safe command unexpectedly decided");
});

await test("generated Codex enforcement projections are deterministic", async () => {
  const tracked = [".codex/config.toml", ".codex/rules/pandacorp.rules", "plugin/templates/shared/.codex/config.toml", "plugin/templates/shared/.codex/rules/pandacorp.rules", "plugin/hooks/codex-hooks.json"];
  const before = await Promise.all(tracked.map((file) => readFile(path.join(root, file), "utf8")));
  const result = spawnSync(process.execPath, [path.join(root, "plugin/scripts/generate-codex-enforcement.mjs")], { cwd: root, encoding: "utf8" });
  ok(result.status === 0, result.stderr);
  const after = await Promise.all(tracked.map((file) => readFile(path.join(root, file), "utf8")));
  ok(before.every((body, index) => body === after[index]), "second generation changed output");
});

process.stdout.write(`RESULT: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
