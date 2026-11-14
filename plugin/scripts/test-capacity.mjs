#!/usr/bin/env node
// Contract fixtures follow FINAL §2 priors and the owner's phase-1 continuity rules.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, spawn } from "node:child_process";

let passed = 0, failed = 0, mod;
try { mod = await import("../runtime/capacity.mjs"); } catch (error) { console.error(error.message); }
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`PASS  ${name}`); }
  catch (error) { failed++; console.error(`FAIL  ${name}: ${error.stack}`); }
};
const NOW = "2026-11-14T16:07:00.000Z", ms = Date.parse(NOW);
const C5 = "2026-11-14T19:39:59.000Z", CW = "2026-11-17T07:59:59.000Z", XW = "2026-11-19T17:21:18.000Z";
const fixture = JSON.parse(await readFile(new URL("./fixtures/capacity-rollout.jsonl", import.meta.url), "utf8"));
const usage = (weekly = 20, five = 7) => ({ status: "ok", plan: { windows: [
  { label: "5-hour limit", percentUsed: five, resetsAt: C5 },
  { label: "Weekly · all models", percentUsed: weekly, resetsAt: CW },
  { label: "Weekly · Fable", percentUsed: 100, resetsAt: CW },
] } });
const codex = (used = 30) => {
  const event = structuredClone(fixture); event.payload.rate_limits.primary.used_percent = used;
  return mod.normalizeCodexRateLimits(event, NOW);
};
const readings = (c = 20, x = 30, five = 7) => ({ claude: mod.normalizeClaudeUsage(usage(c, five), NOW), codex: codex(x) });
const decide = (type = "implement", rs = readings(), extra = {}, options = {}) => mod.decide({
  task: { id: "t1", type, risk: "normal", ...extra }, readings: rs, now: NOW, ...options,
});
const cell = (d, tool, model, effort) => {
  assert.equal(d.action, "run");
  assert.deepEqual(d.pin, { tool, model, effort });
  for (const key of ["tool", "model", "effort"]) assert.equal(d[key], d.pin[key]);
};

await test("today: design, implementation, security and images use the specified Codex cells", () => {
  const rs = readings(94, 30);
  cell(decide("design", rs), "codex", "sol", "high");
  cell(decide("implement", rs), "codex", "sol", "low");
  cell(decide("review", rs, { risk: "critical" }), "codex", "astra", "high");
  cell(decide("images", rs), "codex", "sol", "low");
});
await test("ample quota follows each pure preference; Fable does not block Opus", () => {
  for (const type of ["plan", "design", "judgment"]) cell(decide(type), "claude", "opus", "high");
  for (const type of ["implement", "review", "images"]) cell(decide(type), "codex", "sol", "low");
  cell(decide("mechanical"), "codex", "luna", "low");
});
await test("exhausted Claude never stops new design when Codex fits", () => {
  cell(decide("design", readings(100, 30)), "codex", "sol", "high");
});
await test("exhausted Codex waits only its image; implementation continues on Claude", () => {
  const d = decide("images", readings(20, 100));
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, XW); assert.equal(d.tool, "codex");
  cell(decide("implement", readings(20, 100)), "claude", "sonnet", "medium");
  cell(decide("review", readings(20, 100)), "claude", "opus", "low");
  cell(decide("mechanical", readings(20, 100)), "claude", "haiku", "low");
});
await test("both exhausted wake at the nearest blocking reset, without inventing a balance", () => {
  const d = decide("design", readings(100, 100, 100));
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, C5);
});
await test("risk is a transversal floor even for mechanical work", () => {
  cell(decide("mechanical", readings(), { risk: "delicate" }), "codex", "sol", "medium");
  cell(decide("mechanical", readings(), { risk: "critical" }), "codex", "astra", "high");
  cell(decide("mechanical", readings(20, 100), { risk: "delicate" }), "claude", "sonnet", "medium");
  cell(decide("review", readings(20, 100), { risk: "delicate" }), "claude", "sonnet", "medium");
  cell(decide("mechanical", readings(20, 100), { risk: "critical" }), "claude", "opus", "high");
});
await test("85 exactly preserves preference, pressure in either window switches at >85", () => {
  cell(decide("design", readings(85, 20)), "claude", "opus", "high");
  cell(decide("design", readings(85.001, 20)), "codex", "sol", "high");
  cell(decide("design", readings(20, 20, 86)), "codex", "sol", "high");
  cell(decide("implement", readings(20, 86)), "claude", "sonnet", "medium");
});
await test("pressure never waits while the preferred tool still fits", () => {
  cell(decide("design", readings(94, 100)), "claude", "opus", "high");
  cell(decide("implement", readings(100, 90)), "codex", "sol", "low");
});
await test("Codex stale at 3601s is unknown and healthy Claude wins", () => {
  const event = structuredClone(fixture); event.timestamp = new Date(ms - 3601000).toISOString();
  const r = mod.normalizeCodexRateLimits(event, NOW);
  assert.equal(r.state, "unknown"); assert.equal(r.ageSeconds, 3601);
  cell(decide("implement", { ...readings(), codex: r }), "claude", "sonnet", "medium");
});
await test("freshness TTLs are inclusive and cached known readings are revalidated", () => {
  const raw = { ...usage(), observedAt: new Date(ms - 600000).toISOString() };
  assert.equal(mod.normalizeClaudeUsage(raw, NOW).state, "known");
  raw.observedAt = new Date(ms - 601000).toISOString();
  assert.equal(mod.normalizeClaudeUsage(raw, NOW).state, "unknown");
  const event = structuredClone(fixture); event.timestamp = new Date(ms - 3600000).toISOString();
  assert.equal(mod.normalizeCodexRateLimits(event, NOW).state, "known");
  cell(decide("implement", readings(), {}, { now: new Date(ms + 3601000).toISOString() }), "codex", "sol", "low");
});
await test("missing/both unknown readings continue on the preferred tool", () => {
  for (const rs of [{}, { claude: mod.normalizeClaudeUsage(null, NOW), codex: mod.normalizeCodexRateLimits(null, NOW) }]) {
    cell(decide("design", rs), "claude", "opus", "high");
    cell(decide("implement", rs), "codex", "sol", "low");
    cell(decide("images", rs), "codex", "sol", "low");
  }
  cell(decide("design", { claude: null, codex: codex() }), "codex", "sol", "high");
});
await test("an unknown tool remains a last resort when the known tool cannot fit", () => {
  cell(decide("implement", { claude: null, codex: codex(100) }), "claude", "sonnet", "medium");
});
await test("old high percentages cannot reorder two unknown tools", () => {
  cell(decide("design", readings(94, 100), {}, { now: new Date(ms + 3601000).toISOString() }), "claude", "opus", "high");
});
await test("contradictory/invalid inputs are unknown, never fake zero or a quota wait", () => {
  const raw = usage(); raw.plan.windows.push({ label: "Weekly · all models", percentUsed: 99, resetsAt: CW });
  const r = mod.normalizeClaudeUsage(raw, NOW); assert.equal(r.state, "unknown");
  cell(decide("design", { ...readings(), claude: r }), "codex", "sol", "high");
  for (const bad of [null, "30", -1, 101, NaN]) {
    const event = structuredClone(fixture); event.payload.rate_limits.primary.used_percent = bad;
    assert.equal(mod.normalizeCodexRateLimits(event, NOW).state, "unknown");
  }
});
await test("expired reset and bad/future timestamps invalidate telemetry", () => {
  for (const timestamp of ["invalid", new Date(ms + 31000).toISOString()]) {
    assert.equal(mod.normalizeCodexRateLimits({ ...fixture, timestamp }, NOW).state, "unknown");
  }
  const event = structuredClone(fixture); event.payload.rate_limits.primary.resets_at = ms / 1000;
  assert.equal(mod.normalizeCodexRateLimits(event, NOW).state, "unknown");
});
await test("images alone may use their dynamic weekly reserve; emergency is never spent", () => {
  cell(decide("implement", readings(20, 95.8)), "claude", "sonnet", "medium");
  cell(decide("images", readings(20, 95.8)), "codex", "sol", "low");
  assert.equal(decide("images", readings(20, 98)).action, "wait");
  assert.equal(decide("implement", readings(20, 91), { imageDemandPp: 8, override: "codex" }).action, "wait");
  cell(decide("implement", readings(20, 91), { imageDemandPp: 2, override: "codex" }), "codex", "sol", "low");
  assert.equal(decide("implement", readings(20, 91), { imageDemandPp: 100, override: "codex" }).action, "wait");
});
await test("explicit overrides constrain tool and cannot downgrade risk or enable Fable", () => {
  cell(decide("design", readings(94, 30), { override: "claude" }), "claude", "opus", "high");
  assert.equal(decide("implement", readings(20, 100), { override: { tool: "codex" } }).action, "wait");
  assert.throws(() => decide("implement", readings(), { risk: "critical", override: { tool: "codex", model: "sol", effort: "low" } }));
  assert.throws(() => decide("design", readings(), { override: { tool: "claude", model: "fable" } }));
  assert.throws(() => decide("images", readings(), { override: "claude" }));
});
await test("pins survive pressure, changed task metadata and unknown readings", () => {
  const pin = { tool: "claude", model: "opus", effort: "high" };
  cell(decide("design", readings(94, 30), { pin }), "claude", "opus", "high");
  cell(decide("design", readings(99.9, 30), { pin }), "claude", "opus", "high");
  cell(decide("implement", {}, { pin }), "claude", "opus", "high");
  const d = decide("design", readings(100, 30), { pin });
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, CW); assert.deepEqual(d.pin, pin);
});
await test("default costs vary by cell and custom costs can block a candidate", () => {
  const rs = readings(100, 95.6);
  cell(decide("implement", rs), "codex", "sol", "low");
  assert.equal(decide("review", rs, { risk: "critical" }).action, "wait");
  assert.equal(decide("implement", rs, {}, { costs: { "sol/low": { five_hour: 1, weekly: 2 } } }).action, "wait");
  assert.throws(() => decide("implement", rs, {}, { costs: { "sol/low": { five_hour: 1, weekly: -1 } } }));
});
await test("redacted real rollout has a weekly primary and no applicable 5h", () => {
  const r = codex(); assert.equal(r.state, "known");
  assert.equal(r.windows.find(w => w.id === "weekly").percentUsed, 30);
  assert.equal(r.windows.find(w => w.id === "weekly").resetsAt, XW);
  assert.equal(r.windows.find(w => w.id === "five_hour").applicability, "not_applicable");
  assert.equal(r.windows.find(w => w.id === "five_hour").percentUsed, null);
  cell(decide("implement", { claude: null, codex: r }), "codex", "sol", "low");
});
await test("all reported windows restrict admission; primary need not mean 5h", () => {
  const event = structuredClone(fixture);
  event.payload.rate_limits.secondary = { used_percent: 100, window_minutes: 300, resets_at: Date.parse(C5) / 1000 };
  const r = mod.normalizeCodexRateLimits(event, NOW);
  cell(decide("implement", { ...readings(), codex: r }), "claude", "sonnet", "medium");
});
await test("decisions are deterministic, pure, explainable and never automatically Fable", () => {
  const input = { task: { id: "t", type: "design", risk: "normal" }, readings: readings(94, 30), now: NOW };
  const copy = structuredClone(input), d = mod.decide(input);
  assert.deepEqual(d, mod.decide(input)); assert.deepEqual(input, copy);
  assert.equal(mod.explain(d).split("\n").length, 1); assert.match(mod.explain(d), /Codex/i);
  for (const type of ["plan", "design", "judgment", "implement", "review", "mechanical", "images"]) {
    for (const rs of [readings(), readings(100, 100), {}]) assert.notEqual(decide(type, rs).model, "fable");
  }
  assert.throws(() => decide("unknown"));
});

const sandboxRoot = fileURLToPath(new URL("../../", import.meta.url));
const dir = await mkdtemp(path.join(sandboxRoot, ".capacity-test-"));
try {
  await test("rollout reader chooses event time across files/lines, not mtime, and skips broken JSON", async () => {
    const nested = path.join(dir, "sessions", "2026", "11", "14"); await mkdir(nested, { recursive: true });
    const old = { ...fixture, timestamp: "2026-11-14T16:05:00Z" };
    const newestFile = path.join(nested, "rollout-a.jsonl"), oldFile = path.join(nested, "rollout-z.jsonl");
    await writeFile(newestFile, ["garbage", JSON.stringify(fixture), JSON.stringify(old), '{"partial":'].join("\n"));
    await writeFile(oldFile, JSON.stringify(old));
    await utimes(oldFile, new Date(ms), new Date(ms));
    await utimes(newestFile, new Date(ms - 100000), new Date(ms - 100000));
    const r = await mod.readCodexFromRollouts(path.join(dir, "sessions"), NOW);
    assert.equal(r.observedAt, fixture.timestamp); assert.equal(r.file, newestFile); assert.equal(r.state, "known");
    const future = { ...fixture, timestamp: new Date(ms + 60000).toISOString() };
    await writeFile(oldFile, [JSON.stringify(future), JSON.stringify({ ...fixture, timestamp: "bad" })].join("\n"));
    assert.equal((await mod.readCodexFromRollouts(path.join(dir, "sessions"), NOW)).observedAt, fixture.timestamp);
    assert.equal((await mod.readCodexFromRollouts(path.join(dir, "missing"), NOW)).state, "unknown");
  });
  await test("same-time contradictory rollout events become unknown, not a fabricated balance", async () => {
    const conflictDir = path.join(dir, "conflict"); await mkdir(conflictDir);
    const conflict = structuredClone(fixture); conflict.payload.rate_limits.primary.used_percent = 99;
    await writeFile(path.join(conflictDir, "rollout-conflict.jsonl"), [JSON.stringify(fixture), JSON.stringify(conflict)].join("\n"));
    const r = await mod.readCodexFromRollouts(conflictDir, NOW);
    assert.equal(r.state, "unknown"); assert.equal(r.reason, "conflicting_events");
  });
  await test("CLI consumes stdin, supports --only, prints JSON and appends decision records", async () => {
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url)), log = path.join(dir, "decisions.jsonl");
    const invoke = (args, input) => {
      const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", input, env: { ...process.env, CODEX_HOME: dir, PANDACORP_CAPACITY_DIR: path.join(dir, "capacity"), PANDACORP_NOW: NOW } });
      assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
    };
    const task = JSON.stringify({ id: "t1", type: "design", risk: "normal" });
    cell(invoke(["decide", "--task", task, "--claude-usage-stdin", "--log", log], JSON.stringify(usage(94))), "codex", "sol", "high");
    cell(invoke(["decide", "--task", task, "--claude-usage-stdin", "--only", "claude", "--log", log], JSON.stringify(usage(94))), "claude", "opus", "high");
    const records = (await readFile(log, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(records.length, 2); assert.equal(records[0].at, NOW); assert.equal(records[0].task.id, "t1");
    assert.ok(records[0].reason); assert.equal(typeof records[0].readings_used.codex.ageSeconds, "number");
    assert.equal(invoke(["codex-reading"]).state, "known");
    const bad = spawnSync(process.execPath, [cli, "decide", "--task", "{bad"], { encoding: "utf8" });
    assert.notEqual(bad.status, 0); assert.equal(bad.stdout, "");
  });

  await test("ingest-claude persists observedAt and decide uses the account snapshot without stdin", async () => {
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url));
    const env = { ...process.env, CODEX_HOME: dir, PANDACORP_CAPACITY_DIR: path.join(dir, "ingestion"), PANDACORP_NOW: NOW };
    const result = spawnSync(process.execPath, [cli, "ingest-claude"], { encoding: "utf8", input: JSON.stringify(usage(94)), env });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).observedAt, NOW);
    const decision = spawnSync(process.execPath, [cli, "decide", "--task", JSON.stringify({ id: "cached-design", type: "design", risk: "normal" })], { encoding: "utf8", env });
    assert.equal(decision.status, 0, decision.stderr); cell(JSON.parse(decision.stdout), "codex", "sol", "high");
    const stored = JSON.parse(await readFile(path.join(env.PANDACORP_CAPACITY_DIR, "claude.json"), "utf8"));
    assert.equal(stored.observedAt, NOW); assert.equal((await stat(path.join(env.PANDACORP_CAPACITY_DIR, "claude.json"))).mode & 0o777, 0o600);
    assert.equal((await readFile(path.join(env.PANDACORP_CAPACITY_DIR, "decisions.jsonl"), "utf8")).trim().split("\n").length, 1);
  });
  await test("malformed account snapshots stay unknown and never fabricate zero or block a healthy tool", async () => {
    const env = { ...process.env, PANDACORP_CAPACITY_DIR: path.join(dir, "corrupt"), CODEX_HOME: dir };
    await mkdir(env.PANDACORP_CAPACITY_DIR); await writeFile(path.join(env.PANDACORP_CAPACITY_DIR, "claude.json"), "{partial");
    const readings = mod.readCapacity({ env, now: NOW }); assert.equal(readings.claude.state, "unknown");
    cell(mod.decide({ task: { id: "corrupt", type: "design", risk: "normal" }, readings, now: NOW }), "codex", "sol", "high");
  });
  await test("concurrent lock-free ingestion exposes only complete private JSON snapshots and leaves no temps", async () => {
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url));
    const env = { ...process.env, PANDACORP_CAPACITY_DIR: path.join(dir, "atomic"), PANDACORP_NOW: NOW };
    mod.ingestClaude(usage(), { env, now: NOW });
    const file = path.join(env.PANDACORP_CAPACITY_DIR, "claude.json");
    let done = false, reads = 0;
    const writers = Promise.all(Array.from({ length: 16 }, (_, i) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "ingest-claude"], { env, stdio: ["pipe", "ignore", "pipe"] });
      let stderr = ""; child.stderr.on("data", chunk => stderr += chunk);
      child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(stderr)));
      child.stdin.end(JSON.stringify(usage(i)));
    }))).finally(() => { done = true; });
    while (!done) {
      const snapshot = JSON.parse(await readFile(file, "utf8")); assert.equal(snapshot.schema, 1); assert.equal(snapshot.tool, "claude"); reads++;
    }
    await writers; assert.ok(reads > 0); assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(env.PANDACORP_CAPACITY_DIR), ["claude.json"]);
  });
  await test("quota adapter and legacy probe never launch a model, even with probe requested", async () => {
    const quota = await import("../runtime/build/quota.mjs");
    let calls = 0;
    const env = { ...process.env, CODEX_HOME: path.join(dir, "no-rollouts"), PANDACORP_CAPACITY_DIR: path.join(dir, "no-probe"), PANDACORP_NOW: NOW };
    const exec = () => { calls++; throw new Error("must never launch"); };
    await quota.probeCodex({ env, now: NOW, exec });
    const r = await quota.readQuota({ now: NOW, probe: true }, { env, exec });
    assert.equal(calls, 0); assert.equal(r.needs_probe, false);
  });
  await test("codex-image with Codex exhausted exits 75 with resumeAt and never starts a model", async () => {
    const home = path.join(dir, "image-codex"), sessions = path.join(home, "sessions"); await mkdir(sessions, { recursive: true });
    const event = structuredClone(fixture); event.payload.rate_limits.primary.used_percent = 100;
    await writeFile(path.join(sessions, "rollout-image.jsonl"), JSON.stringify(event));
    const env = { ...process.env, CODEX_HOME: home, PANDACORP_CAPACITY_DIR: path.join(dir, "image-capacity"), PANDACORP_NOW: NOW };
    const script = fileURLToPath(new URL("../skills/design/scripts/codex-image.sh", import.meta.url));
    const r = spawnSync("zsh", [script, dir, "blocked-image"], { env, encoding: "utf8", timeout: 10000 });
    assert.equal(r.status, 75, r.stderr); const decision = JSON.parse(r.stdout);
    assert.equal(decision.action, "wait"); assert.equal(decision.resumeAt, XW);
  });
  await test("worker alias and direct consult capacity and fallback to an isolated Claude process", async () => {
    const home = path.join(dir, "worker-codex"), sessions = path.join(home, "sessions"); await mkdir(sessions, { recursive: true });
    const event = structuredClone(fixture); event.payload.rate_limits.primary.used_percent = 100;
    await writeFile(path.join(sessions, "rollout-worker.jsonl"), JSON.stringify(event));
    const env = { ...process.env, CODEX_HOME: home, PANDACORP_CAPACITY_DIR: path.join(dir, "worker-capacity"), PANDACORP_NOW: NOW,
      PANDACORP_EVENTS_FILE: path.join(dir, "events"), CODEX_WORKER_TRANSCRIPTS: path.join(dir, "no-transcripts") };
    mod.ingestClaude(usage(20), { env, now: NOW });
    const fake = path.join(dir, "fake-claude.sh");
    await writeFile(fake, '#!/bin/sh\ncat >/dev/null\nprintf "fallback complete\\n"\n', { mode: 0o700 });
    env.PANDACORP_CLAUDE_BIN = fake;
    const worker = fileURLToPath(new URL("./codex-worker.mjs", import.meta.url));
    const prompt = path.join(dir, "worker-prompt.md"); await writeFile(prompt, "Fixture task");
    const { fnv } = await import("./codex-worker.mjs");
    for (const direct of [false, true]) {
      const id = direct ? "direct-fallback" : "alias-fallback";
      if (!direct) { const wd = path.join(dir, ".pandacorp/run/codex-workers", id); await mkdir(wd, { recursive: true }); await writeFile(path.join(wd, "prompt.md"), "Fixture task"); }
      const args = direct ? ["--direct", "--prompt-file", prompt, "--codex-model", "gpt-6.1-sol"] : ["--model", "sonnet", "--sum", fnv("Fixture task")];
      const r = spawnSync(process.execPath, [worker, "run", "--project", dir, "--id", id, "--max", "3", ...args], { env, encoding: "utf8", timeout: 10000 });
      assert.equal(r.status, 0, r.stderr); const payload = JSON.parse(JSON.parse(r.stdout.trim()).r);
      assert.equal(payload.ok, true, JSON.stringify(payload)); assert.equal(payload.tool, "claude"); assert.equal(payload.model, "sonnet"); assert.equal(payload.effort, "medium");
    }
    const logs = (await readFile(path.join(env.PANDACORP_CAPACITY_DIR, "decisions.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(logs.length, 2); assert.ok(logs.every(x => x.decision.tool === "claude"));
  });
} finally { await rm(dir, { recursive: true, force: true }); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
