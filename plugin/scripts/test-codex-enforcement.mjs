#!/usr/bin/env node
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
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
// Every `codex` CLI call is bounded (BL-0221): `codex doctor` was seen to run past 10 minutes, which hung the whole
// run-engine-tests.sh battery. A timed-out call fails its test loudly with the reason instead of blocking the runner.
const CODEX_CLI_TIMEOUT_MS = Number(process.env.PANDACORP_CODEX_CLI_TIMEOUT_MS) || 180_000;
const codexCli = (args, options = {}) => spawnSync("codex", args, { cwd: root, encoding: "utf8", timeout: CODEX_CLI_TIMEOUT_MS, killSignal: "SIGKILL", ...options, env: { ...process.env, CODEX_HOME: path.join(eventsScratchDir, "codex-home"), ...options.env } });
const codexFailure = (result, fallback) => (result.error?.code === "ETIMEDOUT" ? `codex timed out after ${CODEX_CLI_TIMEOUT_MS} ms` : result.error ? `codex failed to run: ${result.error.message}` : result.stderr || fallback);

// A "stop" hook run reaches verify-before-stop.sh, which (F2, DR-...) emits a StopGate event and
// falls back to the REAL $HOME/.claude/dashboard-events.ndjson when PANDACORP_EVENTS_LOG is unset
// (BL-0146: this suite's mkdtemp "pc-enforcement-*" fixtures were leaking StopGate lines into the
// live telemetry stream every run). Every hook() invocation gets a scratch events log by default,
// the same isolation pattern test-verify-before-stop.sh already uses — the real stream must never
// see one of these fixtures.
const eventsScratchDir = await mkdtemp(path.join(os.tmpdir(), "pc-enforcement-events-"));
const EVENTS_SCRATCH = path.join(eventsScratchDir, "dashboard-events.ndjson");
const hook = (runtime, event, payload, env) => spawnSync(process.execPath, [adapter, "--runtime", runtime, "--event", event], { input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8", env: { ...process.env, ...env, PANDACORP_EVENTS_LOG: EVENTS_SCRATCH } });
const project = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pc-enforcement-"));
  await mkdir(path.join(dir, ".pandacorp", "run"), { recursive: true });
  await writeFile(path.join(dir, ".pandacorp", "status.yaml"), "phase: implementation\nrunning: false\nsupervisor_heartbeat: \"\"\n");
  await writeFile(path.join(dir, "CLAUDE.md"), "@AGENTS.md\n");
  await writeFile(path.join(dir, "AGENTS.md"), "# Pandacorp\n");
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

  await test(`${runtime}: shim-only CLAUDE.md is in scope without status.yaml`, async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "pc-shim-"));
    try {
      spawnSync("git", ["init", "-q"], { cwd });
      await writeFile(path.join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
      await writeFile(path.join(cwd, "AGENTS.md"), "# Pandacorp\n");
      await mkdir(path.join(cwd, "src/deep"), { recursive: true });
      for (const command of ["git push --force origin main", "vercel --prod", "git reset --hard HEAD~1", "rm -rf .pandacorp"]) {
        const payload = runtime === "claude"
          ? { cwd: path.join(cwd, "src/deep"), tool_name: "Bash", tool_input: { command } }
          : { cwd: path.join(cwd, "src/deep"), toolName: "exec_command", input: { cmd: command } };
        const result = hook(runtime, "pre-tool", payload);
        ok(result.status === 2 && /BLOCKED/.test(result.stderr), `${command}: expected deny, got ${result.status}`);
      }
    } finally { await rm(cwd, { recursive: true, force: true }); }
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

await test("Codex 0.144.1 strict config accepts generated config and rejects unknown fields offline", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "pc-strict-config-"));
  try {
    // An EOF-only app server parses config without requesting a model or probing provider health.
    // Load the exact generated content as user config so project trust cannot bypass validation.
    const config = await readFile(path.join(root, ".codex/config.toml"), "utf8");
    const file = path.join(home, "config.toml");
    const options = { input: "", env: { ...process.env, CODEX_HOME: home } };
    await writeFile(file, config);
    const valid = codexCli(["--strict-config", "app-server", "--stdio"], options);
    ok(valid.status === 0, codexFailure(valid, "strict config rejected"));
    await writeFile(file, `pandacorp_unknown_config_field = true\n${config}`);
    const invalid = codexCli(["--strict-config", "app-server", "--stdio"], options);
    ok(invalid.status !== 0 && /unknown configuration field `pandacorp_unknown_config_field`/.test(invalid.stderr), codexFailure(invalid, "strict config accepted an unknown field"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

await test("Codex execpolicy forbids destructive command and leaves safe command unmatched", async () => {
  const denied = codexCli(["execpolicy", "check", "--rules", rules, "git", "reset", "--hard", "HEAD"]);
  const allowed = codexCli(["execpolicy", "check", "--rules", rules, "git", "status"]);
  ok(denied.status === 0, codexFailure(denied, "execpolicy check failed"));
  ok(JSON.parse(denied.stdout).decision === "forbidden", "destructive command not forbidden");
  ok(allowed.status === 0, codexFailure(allowed, "execpolicy check failed"));
  ok(!JSON.parse(allowed.stdout).decision, "safe command unexpectedly decided");
});

const generatorRoot = path.join(eventsScratchDir, "generator");
await mkdir(path.join(generatorRoot, "plugin/scripts"), { recursive: true });
await mkdir(path.join(generatorRoot, "plugin/runtime"), { recursive: true });
await copyFile(path.join(root, "plugin/scripts/generate-codex-enforcement.mjs"), path.join(generatorRoot, "plugin/scripts/generate-codex-enforcement.mjs"));
await copyFile(path.join(root, "plugin/runtime/enforcement-policy.json"), path.join(generatorRoot, "plugin/runtime/enforcement-policy.json"));
const generator = path.join(generatorRoot, "plugin/scripts/generate-codex-enforcement.mjs");
for (const file of [".codex/config.toml", ".codex/rules/pandacorp.rules", "plugin/templates/shared/.codex/config.toml", "plugin/templates/shared/.codex/rules/pandacorp.rules", "plugin/hooks/codex-hooks.json"]) {
  await mkdir(path.dirname(path.join(generatorRoot, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(generatorRoot, file));
}

await test("generated Codex enforcement projections are deterministic", async () => {
  const tracked = [".codex/config.toml", ".codex/rules/pandacorp.rules", "plugin/templates/shared/.codex/config.toml", "plugin/templates/shared/.codex/rules/pandacorp.rules", "plugin/hooks/codex-hooks.json"];
  const before = await Promise.all(tracked.map((file) => readFile(path.join(generatorRoot, file), "utf8")));
  const result = spawnSync(process.execPath, [generator], { cwd: generatorRoot, encoding: "utf8" });
  ok(result.status === 0, result.stderr);
  const after = await Promise.all(tracked.map((file) => readFile(path.join(generatorRoot, file), "utf8")));
  ok(before.every((body, index) => body === after[index]), "second generation changed output");
});

// BL-0169: reproduced live -- two `run-engine-tests.sh` invocations sharing this checkout raced a
// non-atomic writeFileSync(.codex/config.toml) (this generator) against a concurrent
// `codex --strict-config doctor` read, which observed a truncated file and failed "strict config
// rejected" with empty stderr. Fixed by writing to a sibling temp file and renaming into place
// (atomic on the same filesystem). This test exercises that race directly: it hammers the
// generator with concurrent invocations while continuously reading the target file, and fails if
// any read ever observes anything other than the complete, current content (a torn/partial read).
await test("concurrent regeneration of .codex/config.toml never exposes a torn read (BL-0169)", async () => {
  const target = path.join(generatorRoot, ".codex/config.toml");
  const expected = await readFile(target, "utf8");
  let stop = false;
  let torn = null;
  const reader = (async () => {
    while (!stop) {
      const body = await readFile(target, "utf8").catch(() => null);
      if (body !== null && body !== expected) { torn = body; break; }
    }
  })();
  const generators = Array.from({ length: 12 }, () => new Promise((resolve) => {
    const child = spawn(process.execPath, [generator], { cwd: generatorRoot, stdio: "ignore" });
    child.on("close", (code) => resolve(code));
  }));
  const statuses = await Promise.all(generators);
  stop = true;
  await reader;
  ok(statuses.every((code) => code === 0), `a concurrent generation exited non-zero: ${statuses.join(",")}`);
  ok(torn === null, `torn read observed during concurrent regeneration: ${JSON.stringify(torn?.slice(0, 80))}`);
  ok((await readFile(target, "utf8")) === expected, "config.toml content changed after concurrent regeneration");
});

// BL-0146: verify isolation through the hook environment, without reading the live events file.
await test("hook telemetry stays in the task scratch directory", async () => {
  const events = await readFile(EVENTS_SCRATCH, "utf8");
  ok(events.includes("pc-enforcement-"), "fixture StopGate events did not reach scratch telemetry");
});

await rm(eventsScratchDir, { recursive: true, force: true });

process.stdout.write(`RESULT: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
