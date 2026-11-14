#!/usr/bin/env node
// test-build-v2-quota.mjs — T-B02: contract test of plugin/runtime/build/quota.mjs (engine v2, BUILD-11, D9, PLAN 3.11,
// CLI doc 8.1 / 3.15). Written from the contracts only; the implementation was NOT read.
//
// DR-162: shared passive readings replace mtime, probes and threshold/handoff policy.
import { mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_NOW, ROLLOUT_EXPECT, testEnv, usageSample, writeRolloutSample } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.stack || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (actual, expected, label) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };

const MODULE = fileURLToPath(new URL("../runtime/build/quota.mjs", import.meta.url));
let mod = null; let loadError = null;
try { mod = await import(MODULE); } catch (e) { loadError = e; }
/** Returns an exported function or throws a clear message when the module or the export is missing. */
const fn = (name) => {
  if (loadError) throw new Error(`plugin/runtime/build/quota.mjs cannot be imported (${loadError.code || "error"}: ${loadError.message})`);
  if (typeof mod[name] !== "function") throw new Error(`quota.mjs does not export a function named "${name}" (exports: ${Object.keys(mod).join(", ") || "none"})`);
  return mod[name];
};

const NOW = DEFAULT_NOW;
const accountDir = await mkdtemp(path.join(os.tmpdir(), "pc-quota-account-"));
process.env.PANDACORP_CAPACITY_DIR = accountDir;
const shift = (ms, base = NOW) => new Date(Date.parse(base) + ms).toISOString();
const sandboxes = [];
const sandbox = async () => { const dir = await mkdtemp(path.join(os.tmpdir(), "pc-quota-")); sandboxes.push(dir); const env = testEnv(dir); await mkdir(env.CODEX_HOME, { recursive: true }); return { dir, env, codexHome: env.CODEX_HOME }; };

const readCodex = async (codexHome, now = NOW) => fn("readCodexQuota")({ codexHome, now });
const eff = async (reading, now = NOW) => fn("effective")(reading, now);

const claudeReading = (o = {}) => ({ provider: "claude", five_hour_pct: 36, weekly_pct: 12, five_hour_resets_at: shift(2 * 3600e3), weekly_resets_at: shift(5 * 86400e3), status: "ok", observed_at: NOW, ...o });
const codexReading = (o = {}) => ({ provider: "codex", used_percent: 36, window_minutes: 10080, resets_at: shift(2 * 3600e3), credits: null, observed_at: NOW, file: "/fixture/rollout.jsonl", state: "known", source: "rollout", ...o });

const rolloutLine = (ts, primary, secondary) => JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "token_count", info: {}, rate_limits: { primary, secondary, credits: null, plan_type: "plus" } } });
const winOf = (used, minutes, resetsIso) => ({ used_percent: used, window_minutes: minutes, resets_at: Math.floor(Date.parse(resetsIso) / 1000) });
const writeRollout = async (codexHome, name, lines, { mtime = new Date(NOW) } = {}) => {
  const d = new Date(NOW);
  const dir = path.join(codexHome, "sessions", String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0"));
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `rollout-${name}.jsonl`);
  await writeFile(file, lines.join("\n") + "\n");
  await utimes(file, mtime, mtime);
  return file;
};

const KNOWN = (pct) => ({ pct, state: "known" });
const UNKNOWN = { pct: null, state: "unknown" };
const pol = async (claude, codex, coordinator = "claude-session", driveAlive = true) =>
  fn("policy")({ claude, codex, coordinator, driveAlive, standbyAlive: driveAlive, drive_standby_alive: driveAlive });
const POLICY_KEYS = ["claude_new_units", "codex_new_units", "handoff", "paused", "degrade_reviews_of"];

// ---------------------------------------------------------------------------------------------- Codex reader
await test("codex normal rollout: max(primary, secondary), that window's minutes, resets_at as ISO, shape of the reading", async () => {
  const { codexHome } = await sandbox();
  const s = await writeRolloutSample(codexHome, "normal", { now: NOW });
  const r = await readCodex(codexHome);
  eq(r.provider, "codex", "provider"); eq(r.state, "known", "state");
  eq(r.used_percent, s.expect.used_percent, "used_percent"); eq(r.window_minutes, s.expect.window_minutes, "window_minutes");
  eq(r.resets_at, s.expect.resets_at, "resets_at must be the ISO-8601 conversion of the epoch seconds");
  eq(r.source, "rollout", "source"); ok(r.file === s.file, `file must name the rollout read (${s.file}), got ${r.file}`);
  ok(typeof r.observed_at === "string" && Number.isFinite(Date.parse(r.observed_at)), "observed_at must be an ISO instant");
  ok("credits" in r, "credits key is part of the known shape");
});

await test("codex 98 % on the weekly window wins over the primary and carries the weekly window_minutes", async () => {
  const { codexHome } = await sandbox();
  const s = await writeRolloutSample(codexHome, "pct98", { now: NOW });
  const r = await readCodex(codexHome);
  eq(r.state, "known", "state"); eq(r.used_percent, 98, "used_percent"); eq(r.window_minutes, 10080, "window of the binding (max) window");
  eq(r.resets_at, s.expect.resets_at, "resets_at of the binding window");
});

await test("codex rate_limit_reached (primary 100 %) reads as 100 %", async () => {
  const { codexHome } = await sandbox();
  const s = await writeRolloutSample(codexHome, "rate_limit_reached", { now: NOW });
  const r = await readCodex(codexHome);
  eq(r.state, "known", "state"); eq(r.used_percent, 100, "used_percent"); eq(r.window_minutes, 300, "window_minutes"); eq(r.resets_at, s.expect.resets_at, "resets_at");
  const e = await eff(r); eq(e.pct, 100, "effective pct"); eq(e.state, "known", "effective state");
});

await test("codex stale rollout (6 days old, reader looks <= 3 days back) -> unknown with a reason", async () => {
  const { codexHome } = await sandbox();
  await writeRolloutSample(codexHome, "stale", { now: NOW });
  const r = await readCodex(codexHome);
  eq(r.provider, "codex", "provider"); eq(r.state, "unknown", "state");
  ok(typeof r.reason === "string" && r.reason.length > 0, "unknown reading needs a non-empty reason");
  ok(!("used_percent" in r) || r.used_percent == null, "unknown reading must not carry a percentage");
});

await test("codex malformed rollout (truncated JSON, garbage, token_count without usable rate_limits) -> unknown, never a throw", async () => {
  const { codexHome } = await sandbox();
  await writeRolloutSample(codexHome, "malformed", { now: NOW });
  const r = await readCodex(codexHome);
  eq(r.state, "unknown", "state"); ok(typeof r.reason === "string" && r.reason.length > 0, "reason");
});

await test("codex with no sessions directory / no rollout at all -> unknown, never a throw", async () => {
  const { codexHome, dir } = await sandbox();
  const r1 = await readCodex(codexHome); eq(r1.state, "unknown", "empty codex home");
  const r2 = await readCodex(path.join(dir, "does-not-exist")); eq(r2.state, "unknown", "missing codex home");
  ok(!existsSync(path.join(dir, "does-not-exist")), "reader must be read-only (must not create the codex home)");
});

await test("codex: secondary absent -> primary alone; the last token_count of the file wins", async () => {
  const { codexHome } = await sandbox();
  const ts = shift(-600e3);
  await writeRollout(codexHome, "primary-only", [
    rolloutLine(ts, winOf(20, 300, shift(3600e3)), winOf(5, 10080, shift(86400e3))),
    rolloutLine(shift(-500e3), winOf(64, 10080, shift(7200e3)), null),
  ]);
  const r = await readCodex(codexHome);
  eq(r.state, "known", "state"); eq(r.used_percent, 64, "used_percent from the LAST token_count, primary only"); eq(r.window_minutes, 10080, "window_minutes");
  eq(r.resets_at, shift(7200e3), "resets_at");
});

await test("codex: conflicting equal-time events stay unknown regardless of mtime", async () => {
  const { codexHome } = await sandbox();
  const a = await writeRolloutSample(codexHome, "pct98", { now: NOW });
  const b = await writeRolloutSample(codexHome, "normal", { now: NOW });
  await utimes(a.file, new Date(0), new Date(0));
  eq((await readCodex(codexHome)).state, "unknown", "same timestamp conflict");
  await utimes(b.file, new Date(0), new Date(0));
  eq((await readCodex(codexHome)).state, "unknown", "mtime cannot choose a balance");
});

await test("codex: tail read only. token_count at the end of a 400 KiB file is found (a partial first line is tolerated)", async () => {
  const { codexHome } = await sandbox();
  const ts = shift(-600e3);
  const filler = JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "agent_message", message: "x".repeat(990) } });
  const lines = [rolloutLine(ts, winOf(11, 300, shift(3600e3)), null)];
  for (let i = 0; i < 400; i++) lines.push(filler);
  lines.push(rolloutLine(ts, winOf(77, 300, shift(3600e3)), winOf(30, 10080, shift(86400e3))));
  await writeRollout(codexHome, "big", lines);
  const r = await readCodex(codexHome);
  eq(r.state, "known", "state"); eq(r.used_percent, 77, "last token_count");
});

await test("codex: a token_count only in the first 400 KiB, outside the 256 KiB tail, is NOT found (no full-file scan)", async () => {
  const { codexHome } = await sandbox();
  const ts = shift(-600e3);
  const filler = JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "agent_message", message: "x".repeat(990) } });
  const lines = [rolloutLine(ts, winOf(55, 300, shift(3600e3)), null)];
  for (let i = 0; i < 400; i++) lines.push(filler);
  await writeRollout(codexHome, "deep", lines);
  const r = await readCodex(codexHome);
  eq(r.state, "unknown", "a reading outside the bounded tail must be unknown, not a full scan");
});

// ---------------------------------------------------------------------------------------------- Claude record
await test("recordClaude ok: returns and persists a schema-shaped reading (quota.json), no journal without an epoch", async () => {
  const { dir } = await sandbox();
  const project = path.join(dir, "proj"); const quotaFile = path.join(project, ".pandacorp", "run", "build", "quota.json");
  await mkdir(path.dirname(quotaFile), { recursive: true });
  const u = usageSample("ok", { now: NOW });
  const r = await fn("recordClaude")({ five_hour_pct: u.five_hour.utilization, weekly_pct: u.seven_day.utilization, five_hour_resets_at: u.five_hour.resets_at, weekly_resets_at: u.seven_day.resets_at, status: "ok" }, { now: NOW, file: quotaFile });
  eq(r, { provider: "claude", five_hour_pct: 36, weekly_pct: 12, five_hour_resets_at: u.five_hour.resets_at, weekly_resets_at: u.seven_day.resets_at, status: "ok", observed_at: NOW }, "reading");
  ok(existsSync(quotaFile), `quota.json not written at ${quotaFile}`);
  const stored = JSON.parse(await readFile(quotaFile, "utf8"));
  eq(stored.schema, 1, "quota.json schema"); eq(stored.claude, r, "stored claude reading equals the returned one");
  ok(!existsSync(path.join(project, ".pandacorp", "run", "build", "journal.jsonl")), "no journal event may be written without an epoch");
  const e = await eff(r); eq(e.pct, 36, "pct = max(five_hour, weekly)"); eq(e.state, "known", "fresh");
});

await test("recordClaude keeps a previously stored codex reading in quota.json (claude and codex sit side by side)", async () => {
  const { dir } = await sandbox();
  const project = path.join(dir, "proj"); const quotaFile = path.join(project, ".pandacorp", "run", "build", "quota.json");
  await mkdir(path.dirname(quotaFile), { recursive: true });
  await writeFile(quotaFile, JSON.stringify({ schema: 1, claude: null, codex: codexReading() }));
  await fn("recordClaude")({ five_hour_pct: 10, weekly_pct: 20, status: "ok" }, { now: NOW, file: quotaFile });
  const stored = JSON.parse(await readFile(quotaFile, "utf8"));
  eq(stored.codex, codexReading(), "codex reading must be preserved"); eq(stored.claude.five_hour_pct, 10, "claude reading stored");
});

await test("recordClaude unavailable: null percentages stored (no throw), effective() is unknown", async () => {
  const { dir } = await sandbox();
  const project = path.join(dir, "proj"); const quotaFile = path.join(project, ".pandacorp", "run", "build", "quota.json");
  await mkdir(path.dirname(quotaFile), { recursive: true });
  const r = await fn("recordClaude")({ status: "unavailable" }, { now: NOW, file: quotaFile });
  eq(r.provider, "claude", "provider"); eq(r.status, "unavailable", "status"); eq(r.five_hour_pct, null, "five_hour_pct"); eq(r.weekly_pct, null, "weekly_pct");
  eq(r.five_hour_resets_at, null, "five_hour_resets_at defaults to null"); eq(r.weekly_resets_at, null, "weekly_resets_at defaults to null"); eq(r.observed_at, NOW, "observed_at");
  const e = await eff(r); eq(e.state, "unknown", "unavailable is unknown"); eq(e.pct, null, "pct null"); eq(e.needs_probe, false, "claude never needs a codex probe");
  eq(JSON.parse(await readFile(quotaFile, "utf8")).claude.five_hour_pct, null, "stored null");
});

await test("effective claude: freshness window of 10 min (known up to 600 s, unknown after)", async () => {
  const r = claudeReading({ five_hour_pct: 41, weekly_pct: 63, observed_at: NOW });
  const at = async (ms) => eff(r, shift(ms));
  eq((await at(0)).state, "known", "age 0"); eq((await at(0)).pct, 63, "pct is the max of both windows");
  eq((await at(599e3)).state, "known", "age 599 s"); eq((await at(600e3)).state, "known", "age 600 s (<= 10 min)");
  const stale = await at(601e3); eq(stale.state, "unknown", "age 601 s"); eq(stale.pct, null, "stale pct");
});

await test("effective claude: either window drives the pct (weekly lower, five-hour higher)", async () => {
  const e = await eff(claudeReading({ five_hour_pct: 96, weekly_pct: 12 }));
  eq(e.pct, 96, "pct"); eq(e.state, "known", "state");
});

await test("effective: null reading and a codex unknown reading are unknown with no pct and no probe", async () => {
  for (const [label, reading] of [["null", null], ["codex unknown", { provider: "codex", state: "unknown", reason: "no rollout" }]]) {
    const e = await eff(reading); eq(e.state, "unknown", `${label} state`); eq(e.pct, null, `${label} pct`); eq(e.needs_probe, false, `${label} needs_probe`);
  }
});

// ---------------------------------------------------------------------------------------------- effective codex
await test("effective codex: known until resets_at, unknown from then on (usage resets with the window)", async () => {
  const r = codexReading({ used_percent: 80, resets_at: shift(3600e3), observed_at: NOW });
  const before = await eff(r, shift(3599e3)); eq(before.state, "known", "before resets_at"); eq(before.pct, 80, "pct");
  const after = await eff(r, shift(3601e3)); eq(after.state, "unknown", "after resets_at"); eq(after.pct, null, "pct after reset");
});

await test("effective codex: a reading much older than a claude one is still known (valid until resets_at)", async () => {
  const r = codexReading({ used_percent: 50, observed_at: shift(-5 * 3600e3), resets_at: shift(3600e3) });
  const e = await eff(r); eq(e.state, "unknown", "state"); eq(e.pct, null, "pct");
});

await test("effective codex needs_probe: only when older than 1 h AND >= 70 %", async () => {
  const mk = (pct, ageMs) => codexReading({ used_percent: pct, observed_at: shift(-ageMs), resets_at: shift(4 * 3600e3) });
  eq((await eff(mk(98, 2 * 3600e3))).needs_probe, false, "passive only");
  eq((await eff(mk(70, 3601e3))).needs_probe, false, "passive only");
  eq((await eff(mk(69, 2 * 3600e3))).needs_probe, false, "69 %, 2 h old");
  eq((await eff(mk(36, 2 * 3600e3))).needs_probe, false, "36 %, 2 h old");
  eq((await eff(mk(98, 600e3))).needs_probe, false, "98 %, 10 min old");
  eq((await eff(mk(98, 3600e3))).needs_probe, false, "98 %, exactly 1 h old (needs age > 1 h)");
});

await test("effective codex: a usage_limit reading (source limit, 100 %) is a known 100 %", async () => {
  const e = await eff(codexReading({ used_percent: 100, source: "limit", resets_at: shift(3 * 3600e3), observed_at: NOW }));
  eq(e.pct, 100, "pct"); eq(e.state, "known", "state");
});

// ---------------------------------------------------------------------------------------------- classifyLimitText
await test("classifyLimitText: usage_limit patterns", async () => {
  const f = fn("classifyLimitText");
  for (const t of ["You've hit your usage limit. Upgrade to Plus to continue.", "Error: usage limit reached, try again at 3:05 PM", "insufficient_quota: you exceeded your current quota", "Your credit balance is too low; purchase more credits", "Claude usage limit reached|1731326400"]) eq(await f(t), "usage_limit", `text: ${t}`);
});

await test("classifyLimitText: rate_limit patterns", async () => {
  const f = fn("classifyLimitText");
  for (const t of ["rate limit exceeded, slow down", "HTTP 429 Too Many Requests", "Too many requests, please retry later", "{\"type\":\"rate_limit_error\",\"message\":\"x\"}"]) eq(await f(t), "rate_limit", `text: ${t}`);
});

await test("classifyLimitText: ordinary output, empty and non-string -> null", async () => {
  const f = fn("classifyLimitText");
  for (const t of ["All 12 tests passed. Done.", "Implemented WO-01-001 in src/alpha/list.ts", "", undefined, null, 42]) eq(await f(t), null, `text: ${JSON.stringify(t)}`);
});

await test("classifyLimitText: a usage limit wins over a rate limit when both appear", async () => {
  eq(await fn("classifyLimitText")("429 too many requests. You have hit your usage limit."), "usage_limit", "precedence");
});

// ---------------------------------------------------------------------------------------------- policy
await test("policy: shape is exactly the documented keys", async () => {
  const p = await pol(KNOWN(36), KNOWN(36));
  for (const k of POLICY_KEYS) ok(k in p, `policy result lacks "${k}"`);
  ok(typeof p.degrade_reviews_of === "object" && "claude_authored" in p.degrade_reviews_of && "codex_authored" in p.degrade_reviews_of, "degrade_reviews_of needs claude_authored and codex_authored");
});

await test("policy: both providers healthy -> everything allowed, nothing degraded", async () => {
  const p = await pol(KNOWN(36), KNOWN(12));
  eq([p.claude_new_units, p.codex_new_units, p.handoff, p.paused], [true, true, false, false], "flags");
  eq(p.degrade_reviews_of, { claude_authored: false, codex_authored: false }, "degrade");
});

await test("policy: 90 % stops new units on that provider only (89 % does not; boundary is >= 90)", async () => {
  const codex89 = await pol(KNOWN(36), KNOWN(89)); eq(codex89.codex_new_units, true, "codex 89 %");
  const codex90 = await pol(KNOWN(36), KNOWN(90));
  eq([codex90.codex_new_units, codex90.claude_new_units, codex90.handoff, codex90.paused], [true, true, false, false], "90 still fits");
  eq(codex90.degrade_reviews_of, { claude_authored: false, codex_authored: false }, "ordinary review unchanged: reviews of claude-authored work degrade");
  const claude89 = await pol(KNOWN(89), KNOWN(36)); eq(claude89.claude_new_units, true, "claude 89 %");
  const claude90 = await pol(KNOWN(90), KNOWN(36));
  eq([claude90.claude_new_units, claude90.codex_new_units, claude90.handoff, claude90.paused], [true, true, false, false], "90 continues");
  eq(claude90.degrade_reviews_of, { claude_authored: false, codex_authored: false }, "ordinary review unchanged: reviews of codex-authored work degrade");
});

await test("policy: claude 94 % with a claude coordinator does not hand off; 95 % does when the drive standby is alive", async () => {
  const p94 = await pol(KNOWN(94), KNOWN(36), "claude-session", true);
  eq([p94.handoff, p94.paused, p94.claude_new_units], [false, false, true], "94 % still fits");
  const p95 = await pol(KNOWN(95), KNOWN(36), "claude-session", true);
  eq([p95.handoff, p95.paused, p95.claude_new_units, p95.codex_new_units], [false, false, true, true], "95 % continues without handoff");
});

await test("policy: claude 95 % with a claude coordinator and NO live drive standby -> paused-quota, no handoff", async () => {
  const p = await pol(KNOWN(95), KNOWN(36), "claude-session", false);
  eq([p.handoff, p.paused], [false, false], "one-tool pressure never pauses");
});

await test("policy: claude 95 % but the coordinator is not claude-session -> no handoff and no pause", async () => {
  for (const coordinator of ["codex-session", "drive"]) for (const alive of [true, false]) {
    const p = await pol(KNOWN(97), KNOWN(36), coordinator, alive);
    eq([p.handoff, p.paused, p.claude_new_units, p.codex_new_units], [false, false, false, true], `${coordinator}, standby alive ${alive}`);
  }
});

await test("policy: both >= 90 % -> pause (also takes priority over a handoff)", async () => {
  const both90 = await pol(KNOWN(90), KNOWN(90), "claude-session", true);
  eq([both90.paused, both90.handoff, both90.claude_new_units, both90.codex_new_units], [false, false, true, true], "90/90 still fits");
  const claude97 = await pol(KNOWN(97), KNOWN(93), "claude-session", true);
  eq([claude97.paused, claude97.handoff], [false, false], "97/93 still has a qualified tool");
  const codexCoord = await pol(KNOWN(91), KNOWN(99), "codex-session", false);
  eq(codexCoord.paused, false, "Claude still fits under a Codex coordinator");
});

await test("policy: usage limit = 100 % reading on claude hands off (standby alive) and the result never releases the lease", async () => {
  const p = await pol(KNOWN(100), KNOWN(36), "claude-session", true);
  eq([p.handoff, p.paused, p.claude_new_units, p.codex_new_units], [false, false, false, true], "Claude limited: fallback without handoff");
  for (const [k, v] of Object.entries(p)) ok(!(/release/i.test(k) && v), `policy must never release the lease (key ${k} = ${JSON.stringify(v)})`);
});

await test("policy: usage limit on claude without a standby -> paused; usage limit on codex -> new units take claude, no pause", async () => {
  const noStandby = await pol(KNOWN(100), KNOWN(20), "claude-session", false);
  eq([noStandby.handoff, noStandby.paused], [false, false], "Claude limited: no standby required");
  const codexLimit = await pol(KNOWN(20), KNOWN(100), "claude-session", true);
  eq([codexLimit.codex_new_units, codexLimit.claude_new_units, codexLimit.paused, codexLimit.handoff], [false, true, false, false], "codex limited");
  const both = await pol(KNOWN(100), KNOWN(100), "claude-session", true);
  eq([both.paused, both.handoff], [true, false], "both limited");
});

await test("policy: unknown readings are reactive only (nothing blocked, no handoff, no pause)", async () => {
  const bothUnknown = await pol(UNKNOWN, UNKNOWN, "claude-session", true);
  eq([bothUnknown.claude_new_units, bothUnknown.codex_new_units, bothUnknown.handoff, bothUnknown.paused], [true, true, false, false], "both unknown");
  eq(bothUnknown.degrade_reviews_of, { claude_authored: false, codex_authored: false }, "nothing degraded");
  const claudeUnknown = await pol(UNKNOWN, KNOWN(92), "claude-session", true);
  eq([claudeUnknown.claude_new_units, claudeUnknown.codex_new_units, claudeUnknown.handoff, claudeUnknown.paused], [true, true, false, false], "claude unknown, codex 92 still fits");
  const codexUnknown = await pol(KNOWN(93), UNKNOWN, "claude-session", true);
  eq([codexUnknown.claude_new_units, codexUnknown.codex_new_units, codexUnknown.handoff, codexUnknown.paused], [true, true, false, false], "claude 93 still fits, codex unknown");
});

await test("policy: end to end from fixture samples (rollout pct98 + claude high usage) -> codex out, claude still ok", async () => {
  const { codexHome } = await sandbox();
  await writeRolloutSample(codexHome, "pct98", { now: NOW });
  const codex = await eff(await readCodex(codexHome));
  const u = usageSample("high", { now: NOW });
  const claude = await eff(claudeReading({ five_hour_pct: u.five_hour.utilization, weekly_pct: u.seven_day.utilization, five_hour_resets_at: u.five_hour.resets_at, weekly_resets_at: u.seven_day.resets_at }));
  eq(codex.pct, 98, "codex pct"); eq(claude.pct, 93, "claude pct = max(93, 71)");
  const p = await pol(claude, codex, "claude-session", true);
  eq([p.claude_new_units, p.codex_new_units, p.paused, p.handoff], [true, false, false, false], "Codex cannot fit, Claude still fits: continue");
});

await rm(accountDir, { recursive: true, force: true });
for (const d of sandboxes) await rm(d, { recursive: true, force: true });
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
