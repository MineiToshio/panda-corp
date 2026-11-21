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
// five defaults to 30 (= 30% elapsed of the 5-hour window at NOW): Claude on pace, so tool choice
// follows task preference unless a test sets a deliberate imbalance (pace balancing, DR-162 amendment).
const usage = (weekly = 20, five = 30) => ({ status: "ok", plan: { windows: [
  { label: "5-hour limit", percentUsed: five, resetsAt: C5 },
  { label: "Weekly · all models", percentUsed: weekly, resetsAt: CW },
  { label: "Weekly · Fable", percentUsed: 100, resetsAt: CW },
] } });
const codex = (used = 30) => {
  const event = structuredClone(fixture); event.payload.rate_limits.primary.used_percent = used;
  return mod.normalizeCodexRateLimits(event, NOW);
};
const readings = (c = 20, x = 30, five = 30) => ({ claude: mod.normalizeClaudeUsage(usage(c, five), NOW), codex: codex(x) });
const decide = (type = "implement", rs = readings(), extra = {}, options = {}) => mod.decide({
  task: { id: "t1", type, risk: "normal", ...extra }, readings: rs, now: NOW, ...options,
});
const cell = (d, tool, model, effort) => {
  assert.equal(d.action, "run");
  assert.deepEqual(d.pin, { tool, model, effort });
  for (const key of ["tool", "model", "effort"]) assert.equal(d[key], d.pin[key]);
};

// Real quota envelopes observed on 2026-11-14, before this session renewed the rollout.
const LIVE_NOW = "2026-11-15T00:00:00.000Z";
const liveUsage = { plan: { status: "ok", plan: "Max", windows: [
  { label: "5-hour limit", percentUsed: 3, resetsAt: "2026-11-15T00:40:00.302Z" },
  { label: "Weekly · all models", percentUsed: 95, resetsAt: "2026-11-17T08:00:00.302Z" },
  { label: "Weekly · Fable", percentUsed: 25, resetsAt: "2026-11-17T08:00:00.302Z" },
], extraUsage: { enabled: false } } };
const liveRollout = { timestamp: "2026-11-14T21:38:18.672Z", type: "event_msg", payload: {
  type: "token_count", rate_limits: { limit_id: "codex", limit_name: null,
    primary: { used_percent: 39, window_minutes: 10080, resets_at: 1795108878 }, secondary: null,
    credits: { has_credits: false, unlimited: false, balance: "0" }, individual_limit: null,
    spend_control_reached: null, plan_type: "prolite", rate_limit_reached_type: null },
} };
const liveReadings = () => ({ claude: mod.normalizeClaudeUsage(liveUsage, LIVE_NOW),
  codex: mod.normalizeCodexRateLimits(liveRollout, LIVE_NOW) });
const liveDecide = (type, rs = liveReadings(), extra = {}) => mod.decide({
  task: { id: "live-regression", type, risk: "normal", ...extra }, readings: rs, now: LIVE_NOW,
});
for (const [type, risk, model, effort] of [
  ["design", "normal", "sol", "high"], ["plan", "normal", "sol", "high"],
  ["judgment", "normal", "sol", "high"], ["implement", "normal", "sol", "medium"],
  ["review", "normal", "sol", "high"], ["mechanical", "normal", "luna", "low"],
  ["review", "critical", "astra", "xhigh"], ["implement", "critical", "astra", "high"],
  ["image", "normal", "sol", "low"],
]) await test(`live 95% Claude / stale 39% Codex: ${type}/${risk} uses Codex ${model}/${effort}`, () => {
  const rs = liveReadings();
  assert.equal(rs.codex.state, "stale");
  assert.equal(rs.codex.observedAt, liveRollout.timestamp);
  const w = rs.codex.windows.find(w => w.id === "weekly");
  assert.equal(w.percentUsed, 39); assert.equal(w.effectivePercentUsed, 44); assert.equal(w.safetyMarginPp, 5);
  cell(liveDecide(type, rs, { risk }), "codex", model, effort);
});
await test("live stale Claude snapshot also retains weekly pressure and selects healthy Codex", () => {
  const rs = liveReadings();
  rs.claude = mod.normalizeClaudeUsage({ ...liveUsage, observedAt: "2026-11-14T23:00:00.000Z" }, LIVE_NOW);
  assert.equal(rs.claude.state, "stale");
  assert.equal(rs.claude.windows.find(w => w.id === "weekly").effectivePercentUsed, 100);
  cell(liveDecide("design", rs), "codex", "sol", "high");
});
await test("both high: stale Codex 88+5 beats Claude 95 by lower worst-window pressure", () => {
  const event = structuredClone(liveRollout); event.payload.rate_limits.primary.used_percent = 88;
  const rs = { ...liveReadings(), codex: mod.normalizeCodexRateLimits(event, LIVE_NOW) };
  cell(liveDecide("design", rs), "codex", "sol", "high");
  cell(liveDecide("implement", rs), "codex", "sol", "medium");
  rs.codex.windows.find(w => w.id === "weekly").percentUsed = 91;
  cell(liveDecide("implement", rs), "claude", "sonnet", "high");
  rs.codex.windows.find(w => w.id === "weekly").percentUsed = 90;
  cell(liveDecide("design", rs), "claude", "opus", "high"); // equal pressure: normal preference
  cell(liveDecide("implement", rs), "codex", "sol", "medium");
});
await test("unknown Codex beats high Claude for all eligible non-image cells", () => {
  for (const type of ["design", "implement", "review", "mechanical"]) {
    assert.equal(liveDecide(type, { claude: liveReadings().claude }).tool, "codex");
  }
  cell(decide("implement", { codex: codex(95) }), "claude", "sonnet", "high");
});
await test("pace balancing: Claude 50% at 67% of its week is behind pace and takes implementation too", () => {
  const raw = structuredClone(liveUsage); raw.plan.windows[1].percentUsed = 50;
  const rs = { ...liveReadings(), claude: mod.normalizeClaudeUsage(raw, LIVE_NOW) };
  cell(liveDecide("design", rs), "claude", "opus", "high");
  const d = liveDecide("implement", rs); // Claude slack +16.7 vs stale Codex 44% at 33% elapsed (-11) + band 15
  cell(d, "claude", "sonnet", "high"); assert.equal(d.reason, "pace_balanced");
  raw.plan.windows[1].percentUsed = 66; // Claude now ~on pace (+0.7 vs Codex -11.5+15): preference keeps Codex
  cell(liveDecide("implement", { ...liveReadings(), claude: mod.normalizeClaudeUsage(raw, LIVE_NOW) }), "codex", "sol", "medium");
});
await test("stale margins are +5 through 24h, +10 after, capped at 100 and never compounded", () => {
  for (const [seconds, margin] of [[86400, 5], [86401, 10]]) {
    const e = structuredClone(liveRollout); e.timestamp = new Date(Date.parse(LIVE_NOW) - seconds * 1000).toISOString();
    const rs = { ...liveReadings(), codex: mod.normalizeCodexRateLimits(e, LIVE_NOW) };
    const d = liveDecide("implement", rs), again = liveDecide("implement", d.readings_used);
    const w = d.readings_used.codex.windows.find(w => w.id === "weekly");
    assert.equal(w.percentUsed, 39); assert.equal(w.safetyMarginPp, margin); assert.equal(w.effectivePercentUsed, 39 + margin);
    assert.deepEqual(again, d);
    e.payload.rate_limits.primary.used_percent = 99;
    assert.equal(mod.normalizeCodexRateLimits(e, LIVE_NOW).windows.find(w => w.id === "weekly").effectivePercentUsed, 100);
  }
});
await test("stale margin drives pressure at 85 and fit reserves, not just display", () => {
  const e = structuredClone(liveRollout); e.payload.rate_limits.primary.used_percent = 80;
  const raw = structuredClone(liveUsage); raw.plan.windows[1].percentUsed = 50;
  let rs = { claude: mod.normalizeClaudeUsage(raw, LIVE_NOW), codex: mod.normalizeCodexRateLimits(e, LIVE_NOW) };
  cell(liveDecide("implement", rs), "claude", "sonnet", "high");
  e.payload.rate_limits.primary.used_percent = 88;
  e.timestamp = "2026-11-13T23:59:59.000Z";
  rs = { ...liveReadings(), codex: mod.normalizeCodexRateLimits(e, LIVE_NOW) };
  cell(liveDecide("design", rs), "claude", "opus", "high"); // 98% cannot spend emergency/image reserves
  assert.equal(liveDecide("image", rs).action, "wait");
});
await test("cached pre-fix stale_reading snapshots are reassessed using the original timestamp", () => {
  const r = liveReadings().codex; r.state = "unknown"; r.reason = "stale_reading";
  cell(liveDecide("design", { ...liveReadings(), codex: r }), "codex", "sol", "high");
});

await test("today: design, implementation, security and images use the specified Codex cells", () => {
  const rs = readings(94, 30);
  cell(decide("design", rs), "codex", "sol", "high");
  cell(decide("implement", rs), "codex", "sol", "medium");
  cell(decide("review", rs, { risk: "critical" }), "codex", "astra", "xhigh");
  cell(decide("images", rs), "codex", "sol", "low");
});
await test("ample quota follows each pure preference; Fable does not block Opus", () => {
  for (const type of ["plan", "design", "judgment"]) cell(decide(type), "claude", "opus", "high");
  for (const [type, effort] of [["implement", "medium"], ["review", "high"], ["images", "low"]]) cell(decide(type), "codex", "sol", effort);
  cell(decide("mechanical"), "codex", "luna", "low");
});
await test("exhausted Claude never stops new design when Codex fits", () => {
  cell(decide("design", readings(100, 30)), "codex", "sol", "high");
});
await test("exhausted Codex waits only its image; implementation continues on Claude", () => {
  const d = decide("images", readings(20, 100));
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, XW); assert.equal(d.tool, "codex");
  cell(decide("implement", readings(20, 100)), "claude", "sonnet", "high");
  cell(decide("review", readings(20, 100)), "claude", "opus", "low");
  cell(decide("mechanical", readings(20, 100)), "claude", "haiku", "low");
});
await test("both exhausted resume at the first cell whose blocking windows all reset", () => {
  const d = decide("design", readings(100, 100, 100));
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, CW);
});
await test("risk is a transversal floor even for mechanical work", () => {
  cell(decide("mechanical", readings(), { risk: "delicate" }), "codex", "sol", "medium");
  cell(decide("mechanical", readings(), { risk: "critical" }), "codex", "astra", "high");
  cell(decide("mechanical", readings(20, 100), { risk: "delicate" }), "claude", "sonnet", "medium");
  cell(decide("review", readings(20, 100), { risk: "delicate" }), "claude", "opus", "low");
  cell(decide("mechanical", readings(20, 100), { risk: "critical" }), "claude", "opus", "high");
});
await test("pressure starts at 85 inclusive in every applicable window", () => {
  // Codex at 50% is ahead of pace too, so below 85 the design preference keeps Claude; from 85 Claude is hot.
  cell(decide("design", readings(84.999, 50)), "claude", "opus", "high");
  cell(decide("design", readings(85, 50)), "codex", "sol", "high");
  cell(decide("design", readings(85.001, 50)), "codex", "sol", "high");
  cell(decide("design", readings(20, 20, 86)), "codex", "sol", "high");
  cell(decide("implement", readings(20, 86)), "claude", "sonnet", "high");
});
await test("pressure never waits while the preferred tool still fits", () => {
  cell(decide("design", readings(94, 100)), "claude", "opus", "high");
  cell(decide("implement", readings(100, 90)), "codex", "sol", "medium");
});
await test("Codex stale at 3601s remains known with margin and keeps implementation preference", () => {
  const event = structuredClone(fixture); event.timestamp = new Date(ms - 3601000).toISOString();
  const r = mod.normalizeCodexRateLimits(event, NOW);
  assert.equal(r.state, "stale"); assert.equal(r.ageSeconds, 3601);
  assert.equal(r.windows.find(w => w.id === "weekly").effectivePercentUsed, 35);
  cell(decide("implement", { ...readings(), codex: r }), "codex", "sol", "medium");
});
await test("freshness TTLs are inclusive and cached known readings are revalidated", () => {
  const raw = { ...usage(), observedAt: new Date(ms - 600000).toISOString() };
  assert.equal(mod.normalizeClaudeUsage(raw, NOW).state, "known");
  raw.observedAt = new Date(ms - 601000).toISOString();
  assert.equal(mod.normalizeClaudeUsage(raw, NOW).state, "stale");
  const event = structuredClone(fixture); event.timestamp = new Date(ms - 3600000).toISOString();
  assert.equal(mod.normalizeCodexRateLimits(event, NOW).state, "known");
  const later = decide("implement", readings(), {}, { now: new Date(ms + 3601000).toISOString() });
  assert.equal(later.action, "run"); // tool follows pace at the later time; the point is revalidation:
  assert.equal(later.readings_used.claude.state, "stale"); assert.equal(later.readings_used.codex.state, "stale");
});
await test("missing/both unknown readings continue on the preferred tool", () => {
  for (const rs of [{}, { claude: mod.normalizeClaudeUsage(null, NOW), codex: mod.normalizeCodexRateLimits(null, NOW) }]) {
    cell(decide("design", rs), "claude", "opus", "high");
    cell(decide("implement", rs), "codex", "sol", "medium");
    cell(decide("images", rs), "codex", "sol", "low");
  }
  cell(decide("design", { claude: null, codex: codex() }), "codex", "sol", "high");
});
await test("an unknown tool remains a last resort when the known tool cannot fit", () => {
  cell(decide("implement", { claude: null, codex: codex(100) }), "claude", "sonnet", "high");
});
await test("old high readings retain constraints and can wait when the other tool cannot fit", () => {
  assert.equal(decide("design", readings(94, 100), {}, { now: new Date(ms + 3601000).toISOString() }).action, "wait");
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
  cell(decide("implement", readings(20, 95.8)), "claude", "sonnet", "high");
  cell(decide("images", readings(20, 95.8)), "codex", "sol", "low");
  assert.equal(decide("images", readings(20, 98)).action, "wait");
  assert.equal(decide("implement", readings(20, 91), { imageDemandPp: 8, override: "codex" }).action, "wait");
  cell(decide("implement", readings(20, 91), { imageDemandPp: 2, override: "codex" }), "codex", "sol", "medium");
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
  assert.equal(decide("design", readings(99.9, 30), { pin }).action, "wait");
  cell(decide("implement", {}, { pin }), "claude", "opus", "high");
  const d = decide("design", readings(100, 30), { pin });
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, CW); assert.deepEqual(d.pin, pin);
});
await test("default costs vary by cell and custom costs can block a candidate", () => {
  const rs = readings(100, 95.7);
  cell(decide("implement", rs), "codex", "sol", "low");
  assert.equal(decide("review", rs, { risk: "critical" }).action, "wait");
  assert.equal(decide("implement", rs, {}, { costs: { "sol/medium": { five_hour: 1.6, weekly: 2 }, "sol/low": { five_hour: 1, weekly: 2 } } }).action, "wait");
  assert.throws(() => decide("implement", rs, {}, { costs: { "sol/low": { five_hour: 1, weekly: -1 } } }));
});
await test("redacted real rollout has a weekly primary and no applicable 5h", () => {
  const r = codex(); assert.equal(r.state, "known");
  assert.equal(r.windows.find(w => w.id === "weekly").percentUsed, 30);
  assert.equal(r.windows.find(w => w.id === "weekly").resetsAt, XW);
  assert.equal(r.windows.find(w => w.id === "five_hour").applicability, "not_applicable");
  assert.equal(r.windows.find(w => w.id === "five_hour").percentUsed, null);
  cell(decide("implement", { claude: null, codex: r }), "codex", "sol", "medium");
});
await test("all reported windows restrict admission; primary need not mean 5h", () => {
  const event = structuredClone(fixture);
  event.payload.rate_limits.secondary = { used_percent: 100, window_minutes: 300, resets_at: Date.parse(C5) / 1000 };
  const r = mod.normalizeCodexRateLimits(event, NOW);
  cell(decide("implement", { ...readings(), codex: r }), "claude", "sonnet", "high");
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

// Review P1 regressions: each finding has an independent contract-level reproduction.
await test("R1: pins cannot lower either risk floor, including changed metadata", () => {
  for (const risk of ["delicate", "critical"]) for (const pin of [
    { tool: "codex", model: "luna", effort: "low" }, { tool: "claude", model: "haiku", effort: "low" },
  ]) assert.throws(() => decide("mechanical", readings(), { risk, pin }), /risk floor/i);
  assert.throws(() => decide("implement", readings(), { risk: "critical", pin: { tool: "codex", model: "sol", effort: "high" } }), /risk floor/i);
  assert.throws(() => decide("implement", readings(), { risk: "critical", pin: { tool: "claude", model: "opus", effort: "low" } }), /risk floor/i);
  cell(decide("implement", readings(), { risk: "critical", pin: { tool: "codex", model: "astra", effort: "high" } }), "codex", "astra", "high");
});
await test("R2: a pin cannot silently ignore explicit tool/model/effort overrides", () => {
  const pin = { tool: "codex", model: "sol", effort: "low" };
  for (const override of ["claude", { tool: "claude" }, { tool: "codex", model: "astra" }, { tool: "codex", effort: "high" }]) {
    assert.throws(() => decide("implement", readings(), { pin, override }), /conflict/i);
  }
  cell(decide("implement", readings(), { pin, override: { ...pin } }), "codex", "sol", "low");
  for (const override of [{ tool: "codex", model: "" }, { tool: "codex", effort: null }]) {
    assert.throws(() => decide("implement", readings(), { pin, override }), /conflict/i);
    assert.throws(() => decide("implement", readings(), { override }), /qualified cell/i);
  }
});
await test("R3a: pinned implementation preserves image reserves and waits on its own tool", () => {
  const pin = { tool: "codex", model: "sol", effort: "low" };
  const d = decide("implement", readings(20, 91), { imageDemandPp: 8, pin });
  assert.equal(d.action, "wait"); assert.deepEqual(d.pin, pin); assert.equal(d.resumeAt, XW);
  cell(decide("implement", readings(20, 90), { imageDemandPp: 8, pin }), "codex", "sol", "low");
});
await test("R3b: pinned images cannot spend emergency capacity", () => {
  const pin = { tool: "codex", model: "sol", effort: "low" };
  const d = decide("images", readings(20, 99.9), { pin });
  assert.equal(d.action, "wait"); assert.deepEqual(d.pin, pin); assert.equal(d.resumeAt, XW);
});
await test("R4a: an expired five-hour reset cannot erase live weekly exhaustion", () => {
  const raw = usage(100, 100); raw.plan.windows[0].resetsAt = NOW;
  const r = mod.normalizeClaudeUsage(raw, NOW);
  const d = decide("design", { claude: r, codex: codex(100) });
  assert.equal(d.action, "wait"); assert.equal(d.resumeAt, CW);
  assert.equal(d.readings_used.claude.windows.find(w => w.id === "weekly" && w.scope === "all").percentUsed, 100);
});
await test("R4b: expired reset is pending confirmation, retains percent and loses to fresh quota", () => {
  const event = structuredClone(fixture); event.payload.rate_limits.primary.resets_at = ms / 1000;
  const r = mod.normalizeCodexRateLimits(event, NOW);
  assert.equal(r.state, "unknown");
  const w = r.windows.find(w => w.id === "weekly");
  assert.equal(w.percentUsed, 30); assert.equal(w.state, "unknown"); assert.equal(w.reason, "reset_pending_confirmation");
  cell(decide("implement", { claude: readings().claude, codex: r }), "claude", "sonnet", "high");
  cell(decide("implement", { claude: readings(100).claude, codex: r }), "codex", "sol", "medium");
});
await test("R6a: model-specific Claude quota blocks only the selected model", () => {
  const raw = usage(); raw.plan.windows.push({ label: "Weekly · Opus", percentUsed: 100, resetsAt: CW });
  const rs = { claude: mod.normalizeClaudeUsage(raw, NOW), codex: codex() };
  cell(decide("design", rs), "codex", "sol", "high");
  cell(decide("implement", rs, { override: "claude" }), "claude", "sonnet", "high");
  assert.equal(decide("design", rs, { override: "claude" }).resumeAt, CW);
  raw.plan.windows.at(-1).percentUsed = 20;
  raw.plan.windows.find(w => w.label === "Weekly · Fable").resetsAt = NOW;
  cell(decide("design", { claude: mod.normalizeClaudeUsage(raw, NOW), codex: codex() }), "claude", "opus", "high");
});
await test("R6b: model-scoped windows apply to pinned cells and pressure", () => {
  const raw = usage(); raw.plan.windows.push({ label: "Weekly · Opus", percentUsed: 86, resetsAt: CW });
  cell(decide("design", { claude: mod.normalizeClaudeUsage(raw, NOW), codex: codex() }), "codex", "sol", "high");
  raw.plan.windows.at(-1).percentUsed = 100;
  assert.equal(decide("design", { claude: mod.normalizeClaudeUsage(raw, NOW), codex: codex() }, { pin: { tool: "claude", model: "opus", effort: "high" } }).action, "wait");
});
await test("R8: resumeAt is min of each cell's final blocking reset", () => {
  const rs = readings(100, 100, 100);
  assert.equal(decide("design", rs).resumeAt, CW);
  rs.codex.windows.find(w => w.id === "weekly").resetsAt = C5;
  assert.equal(decide("design", rs).resumeAt, C5);
  assert.equal(decide("design", rs, { pin: { tool: "claude", model: "opus", effort: "high" } }).resumeAt, CW);
});
await test("R9a: timestamps require explicit zones, independent of process timezone", () => {
  for (const timestamp of ["2026-11-14T16:00:00", "2026-11-14", "2026-11-14 16:00:00Z"]) {
    assert.equal(mod.normalizeCodexRateLimits({ ...fixture, timestamp }, NOW).state, "unknown");
  }
  for (const TZ of ["UTC", "America/Lima"]) {
    const script = `import {normalizeCodexRateLimits as n} from './plugin/runtime/capacity.mjs'; console.log(n(${JSON.stringify({ ...fixture, timestamp: "2026-11-14T16:00:00" })}, ${JSON.stringify(NOW)}).state);`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: fileURLToPath(new URL("../../", import.meta.url)), env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "unknown");
  }
});
await test("R9b: impossible reset dates and offsets are rejected, leap days accepted", () => {
  for (const reset of ["2027-02-30T00:00:00Z", "2026-02-29T00:00:00Z", "2026-11-31T00:00:00-05:00", "2027-01-01T24:00:00Z", "2027-01-01T00:00:00+25:00"]) {
    const e = structuredClone(fixture); e.payload.rate_limits.primary.resets_at = reset;
    assert.equal(mod.normalizeCodexRateLimits(e, NOW).state, "unknown", reset);
  }
  const e = structuredClone(fixture); e.payload.rate_limits.primary.resets_at = "2028-02-29T00:00:00Z";
  assert.equal(mod.normalizeCodexRateLimits(e, NOW).state, "known");
});
await test("R10: image and images default omitted risk to normal", () => {
  for (const type of ["images", "image"]) {
    cell(mod.decide({ task: { id: "bare-image", type }, readings: readings(), now: NOW }), "codex", "sol", "low");
    assert.throws(() => decide(type, readings(), { risk: "critical" }));
  }
});

const sandboxRoot = fileURLToPath(new URL("../../", import.meta.url));
const dir = await mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || sandboxRoot, ".capacity-test-"));
try {
  await test("live CLI consumes the real usage payload and stale weekly-only rollout", async () => {
    const home = path.join(dir, "live-cli"), sessions = path.join(home, "sessions");
    await mkdir(sessions, { recursive: true });
    await writeFile(path.join(sessions, "rollout-live.jsonl"), JSON.stringify(liveRollout) + "\n");
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url));
    for (const [type, risk, model, effort] of [["design", "normal", "sol", "high"],
      ["implement", "normal", "sol", "medium"], ["review", "normal", "sol", "high"],
      ["mechanical", "normal", "luna", "low"], ["review", "critical", "astra", "xhigh"],
      ["image", "normal", "sol", "low"]]) {
      const r = spawnSync(process.execPath, [cli, "decide", "--task", JSON.stringify({ id: "x", type, risk }), "--claude-usage-stdin"], {
        input: JSON.stringify(liveUsage), encoding: "utf8", env: { ...process.env, CODEX_HOME: home,
          PANDACORP_CAPACITY_DIR: path.join(dir, "live-account"), PANDACORP_NOW: LIVE_NOW },
      });
      assert.equal(r.status, 0, r.stderr); cell(JSON.parse(r.stdout), "codex", model, effort);
    }
  });
  await test("R5: empty/malformed Claude telemetry stays unknown; CLI still decides", async () => {
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url));
    for (const input of ["", "{bad"]) {
      const r = spawnSync(process.execPath, [cli, "decide", "--task", '{"id":"t","type":"design","risk":"normal"}', "--claude-usage-stdin"], {
        input, encoding: "utf8", env: { ...process.env, CODEX_HOME: path.join(dir, "absent"), PANDACORP_CAPACITY_DIR: path.join(dir, "empty-cli"), PANDACORP_NOW: NOW },
      });
      assert.equal(r.status, 0, r.stderr); const d = JSON.parse(r.stdout);
      cell(d, "claude", "opus", "high"); assert.equal(d.readings_used.claude.state, "unknown");
      assert.equal(d.readings_used.claude.reason, input ? "invalid_usage_json" : "missing_usage");
    }
  });
  await test("R7: tail aligned exactly after newline retains the complete newest event", async () => {
    const tailDir = path.join(dir, "tail-boundary"); await mkdir(tailDir);
    const event = structuredClone(fixture); event.timestamp = NOW; event.payload.rate_limits.primary.used_percent = 100;
    const head = JSON.stringify(event) + "\n", tail = head + JSON.stringify({ padding: "x".repeat(262144 - Buffer.byteLength(head) - 15) }) + "\n";
    assert.equal(Buffer.byteLength(tail), 262144);
    await writeFile(path.join(tailDir, "rollout-new.jsonl"), "{}\n" + tail);
    await writeFile(path.join(tailDir, "rollout-old.jsonl"), JSON.stringify(fixture));
    const r = await mod.readCodexFromRollouts(tailDir, NOW);
    assert.equal(r.observedAt, NOW); assert.equal(r.windows.find(w => w.id === "weekly").percentUsed, 100);
  });
  await test("R9c: rollout timestamps are ordered by parsed instant across explicit offsets", async () => {
    const offsetDir = path.join(dir, "offsets"); await mkdir(offsetDir);
    const a = structuredClone(fixture); a.timestamp = "2026-11-14T16:05:00Z";
    const b = structuredClone(fixture); b.timestamp = "2026-11-14T11:06:00-05:00"; b.payload.rate_limits.primary.used_percent = 42;
    await writeFile(path.join(offsetDir, "rollout-offset.jsonl"), [JSON.stringify(b), JSON.stringify(a)].join("\n"));
    const r = await mod.readCodexFromRollouts(offsetDir, NOW);
    assert.equal(Date.parse(r.observedAt), Date.parse(b.timestamp)); assert.equal(r.windows.find(w => w.id === "weekly").percentUsed, 42);
  });
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
  await test("R2 CLI: --only cannot conflict with an existing execution pin", () => {
    const cli = fileURLToPath(new URL("../runtime/capacity-cli.mjs", import.meta.url));
    const task = { id: "conflict", type: "implement", risk: "normal", pin: { tool: "codex", model: "sol", effort: "low" } };
    const r = spawnSync(process.execPath, [cli, "decide", "--task", JSON.stringify(task), "--only", "claude"], {
      encoding: "utf8", env: { ...process.env, CODEX_HOME: path.join(dir, "absent"), PANDACORP_CAPACITY_DIR: path.join(dir, "override-cli"), PANDACORP_NOW: NOW },
    });
    assert.notEqual(r.status, 0); assert.equal(r.stdout, ""); assert.match(r.stderr, /conflict/i);
  });
  await test("R4 account: an expired newer limit cannot reveal an older healthy balance", () => {
    const env = { ...process.env, CODEX_HOME: path.join(dir, "absent"), PANDACORP_CAPACITY_DIR: path.join(dir, "pending-limit") };
    const raw = { ...usage(), observedAt: new Date(ms - 120000).toISOString() };
    mod.ingestClaude(raw, { env, now: NOW });
    const limit = { schema: 1, tool: "claude", source: "usage_limit", state: "known", observedAt: new Date(ms - 60000).toISOString(), windows:
      ["five_hour", "weekly"].map(id => ({ id, scope: "all", applicability: "required", percentUsed: 100, resetsAt: NOW })) };
    mod.writeCapacitySnapshot("claude-limit", limit, { env });
    const rs = mod.readCapacity({ env, now: NOW });
    const d = decide("design", { ...rs, codex: codex() });
    cell(d, "codex", "sol", "high"); assert.equal(d.readings_used.claude.state, "unknown");
    assert.ok(d.readings_used.claude.windows.every(w => w.percentUsed === 100 && w.reason === "reset_pending_confirmation"));
    mod.ingestClaude({ ...usage(), observedAt: NOW }, { env, now: NOW });
    cell(decide("design", { ...mod.readCapacity({ env, now: NOW }), codex: codex() }), "claude", "opus", "high");
  });
  await test("R6 Codex: every model-scoped window constrains only its matching cell", () => {
    const e = structuredClone(fixture);
    e.payload.rate_limits.secondary = { used_percent: 100, window_minutes: 300, resets_at: Date.parse(C5) / 1000, scope: "model:sol" };
    const rs = { ...readings(), codex: mod.normalizeCodexRateLimits(e, NOW) };
    cell(decide("implement", rs), "claude", "sonnet", "high");
    cell(decide("implement", rs, { risk: "critical" }), "codex", "astra", "high");
    assert.equal(decide("implement", rs, { override: "codex" }).resumeAt, C5);
  });
  await test("R7 partial tail: a cut inside a record skips that fragment and retains the next complete event", async () => {
    const tailDir = path.join(dir, "tail-partial"); await mkdir(tailDir);
    const event = structuredClone(fixture); event.timestamp = NOW; event.payload.rate_limits.primary.used_percent = 42;
    await writeFile(path.join(tailDir, "rollout-partial.jsonl"), JSON.stringify({ padding: "x".repeat(262144) }) + "\n" + JSON.stringify(event) + "\n");
    const r = await mod.readCodexFromRollouts(tailDir, NOW);
    assert.equal(r.observedAt, NOW); assert.equal(r.windows.find(w => w.id === "weekly").percentUsed, 42);
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
    await writeFile(fake, `#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' '{"type":"result","result":"fallback complete"}'\n`, { mode: 0o700 });
    env.PANDACORP_CLAUDE_BIN = fake;
    const worker = fileURLToPath(new URL("./codex-worker.mjs", import.meta.url));
    const prompt = path.join(dir, "worker-prompt.md"); await writeFile(prompt, "Fixture task");
    const { fnv } = await import("./codex-worker.mjs");
    for (const direct of [false, true]) {
      const id = direct ? "direct-fallback" : "alias-fallback";
      if (!direct) { const wd = path.join(dir, ".pandacorp/run/codex-workers", id); await mkdir(wd, { recursive: true }); await writeFile(path.join(wd, "prompt.md"), "Fixture task"); }
      const args = direct ? ["--direct", "--prompt-file", prompt, "--codex-model", "gpt-6.1-sol"] : ["--model", "sonnet", "--sum", fnv("Fixture task")];
      const r = spawnSync(process.execPath, [worker, "run", "--risk", "normal", "--project", dir, "--id", id, "--max", "3", ...args], { env, encoding: "utf8", timeout: 10000 });
      assert.equal(r.status, 0, r.stderr); const payload = JSON.parse(JSON.parse(r.stdout.trim()).r);
      assert.equal(payload.ok, true, JSON.stringify(payload)); assert.equal(payload.tool, "claude"); assert.equal(payload.model, "sonnet"); assert.equal(payload.effort, "high");
    }
    const logs = (await readFile(path.join(env.PANDACORP_CAPACITY_DIR, "decisions.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(logs.length, 2); assert.ok(logs.every(x => x.decision.tool === "claude"));
  });
} finally { await rm(dir, { recursive: true, force: true }); }
// Owner option B: independent explicit contract tables (no production resolver in the oracle).
for (const [tool, bases] of Object.entries({ codex: [["sol", "low"], ["sol", "medium"], ["sol", "high"]],
  claude: [["sonnet", "medium"], ["sonnet", "high"], ["opus", "medium"]] })) {
  for (const [i, complexity] of ["trivial", "normal", "complex"].entries()) for (const risk of ["normal", "delicate", "critical"]) {
    await test(`option B implementation ${tool}/${complexity}/${risk}`, () => {
      const expected = risk === "critical" ? [tool === "codex" ? "astra" : "opus", "high"] :
        risk === "delicate" && tool === "codex" && i === 0 ? ["sol", "medium"] : bases[i];
      const d = decide("implement", readings(), { complexity, risk, override: tool });
      cell(d, tool, ...expected);
      const reviews = { "sol/low": ["sol", "medium"], "sol/medium": ["sol", "high"], "sol/high": ["astra", "high"],
        "astra/high": ["astra", "xhigh"], "sonnet/medium": ["opus", "low"], "sonnet/high": ["opus", "low"],
        "opus/medium": ["opus", "high"], "opus/high": ["opus", "xhigh"] };
      const r = decide("review", readings(), { complexity, risk, override: tool, implementerCell: d.pin });
      cell(r, tool, ...reviews[`${d.model}/${d.effort}`]); assert.notDeepEqual(r.pin, d.pin);
    });
  }
}
await test("option B live reading: actual normal implementation medium -> its review high", () => {
  const implementation = liveDecide("implement", liveReadings(), { complexity: "normal" });
  const review = liveDecide("review", liveReadings(), { complexity: "normal", implementerCell: implementation.pin });
  cell(implementation, "codex", "sol", "medium"); cell(review, "codex", "sol", "high");
});
await test("option B cross-tool equivalents, top and health precede preference", () => {
  for (const [author, tool, expected] of [
    [{ tool: "codex", model: "sol", effort: "medium" }, "claude", ["opus", "low"]],
    [{ tool: "codex", model: "sol", effort: "high" }, "claude", ["opus", "high"]],
    [{ tool: "codex", model: "astra", effort: "high" }, "claude", ["opus", "xhigh"]],
    [{ tool: "claude", model: "opus", effort: "medium" }, "codex", ["astra", "high"]],
    [{ tool: "claude", model: "opus", effort: "high" }, "codex", ["astra", "xhigh"]],
  ]) cell(decide("review", readings(), { override: tool, implementerCell: author }), tool, ...expected);
  const author = { tool: "codex", model: "astra", effort: "high" };
  cell(decide("review", readings(20, 90), { risk: "critical", implementerCell: author }), "claude", "opus", "xhigh");
  cell(decide("review", readings(100, 20), { risk: "critical", implementerCell: author }), "codex", "astra", "xhigh");
});
await test("option B one effort reduction only after both full cells fail; floors and pins hold", () => {
  for (const [complexity, used, expected] of [["normal", 95.7, "low"], ["complex", 95.5, "medium"]]) {
    const d = decide("implement", readings(100, used), { complexity });
    cell(d, "codex", "sol", expected); assert.equal(d.reason, "complexity_effort_reduced");
  }
  cell(decide("implement", readings(20, 95.7)), "claude", "sonnet", "high");
  for (const [complexity, model, effort] of [["normal", "sonnet", "medium"], ["complex", "opus", "low"]]) {
    const d = decide("implement", readings(97.5, 100), { complexity });
    cell(d, "claude", model, effort); assert.equal(d.reason, "complexity_effort_reduced");
  }
  assert.equal(decide("implement", readings(100, 95.7), { risk: "delicate" }).action, "wait");
  assert.equal(decide("implement", readings(100, 95.7), { risk: "critical" }).action, "wait");
  assert.equal(decide("implement", readings(100, 95.8), { complexity: "complex" }).action, "wait");
  const author = { tool: "codex", model: "sol", effort: "medium" };
  assert.equal(decide("review", readings(100, 95.5), { implementerCell: author }).action, "wait");
  assert.throws(() => decide("review", readings(), { implementerCell: author, pin: author }), /reviewer floor/);
  assert.equal(decide("implement", readings(100, 95.7), { pin: author }).action, "run"); // pinned cost remains zero
  assert.throws(() => decide("implement", readings(), { complexity: "guess" }), /complexity/);
});
// Pace balancing (DR-162 amendment 2026-11-20): spend both subscriptions evenly toward their resets.
await test("pace: equal pace keeps task preference; preference band is 15 pp", () => {
  cell(decide("implement", readings(20, 30)), "codex", "sol", "medium");   // Claude 0, Codex -2: band wins
  cell(decide("design", readings(20, 30)), "claude", "opus", "high");
  cell(decide("implement", readings(20, 15)), "codex", "sol", "medium");
  // Codex 12 pp ahead of Claude's slack: still inside the band -> preference (Claude 0+15 vs Codex -14)
  cell(decide("design", readings(20, 42)), "claude", "opus", "high");
});
await test("pace: the tool far behind its schedule takes work against preference", () => {
  // Claude 5-hour 5% used at 30% elapsed (+25) vs Codex weekly 30% at 28% elapsed (-2): 25 > -2+15
  const d = decide("implement", readings(20, 30, 5));
  cell(d, "claude", "sonnet", "high"); assert.equal(d.reason, "pace_balanced");
  // Codex weekly 5% at 28% elapsed (+23) vs Claude on pace: design goes to Codex
  const e = decide("design", readings(20, 5));
  cell(e, "codex", "sol", "high"); assert.equal(e.reason, "pace_balanced");
});
await test("pace: quota about to expire unused is spent even above 85%", () => {
  // Claude weekly 88% but 99% of the week elapsed (+11 slack) vs Codex ahead of pace: use Claude.
  const late = new Date(Date.parse(CW) - 0.01 * 7 * 24 * 3600e3).toISOString();
  const fiveReset = new Date(Date.parse(late) + 3.5 * 3600e3).toISOString(); // 30% of the 5-hour window elapsed
  const raw = { status: "ok", observedAt: late, plan: { windows: [
    { label: "5-hour limit", percentUsed: 10, resetsAt: fiveReset }, // +20 slack: weekly (+11) binds
    { label: "Weekly · all models", percentUsed: 88, resetsAt: CW } ] } };
  const ev = structuredClone(fixture); ev.timestamp = late; ev.payload.rate_limits.primary.used_percent = 80;
  const rs = { claude: mod.normalizeClaudeUsage(raw, late), codex: mod.normalizeCodexRateLimits(ev, late) };
  assert.equal(rs.claude.state, "known"); assert.equal(rs.codex.state, "known");
  const d = mod.decide({ task: { id: "late", type: "implement", risk: "normal" }, readings: rs, now: late });
  assert.equal(d.tool, "claude"); assert.equal(d.reason, "pace_balanced"); // Claude +11 vs Codex -15+15
});
await test("pace: unknown reading never beats a known tool with margin", () => {
  cell(decide("implement", { claude: readings().claude }), "claude", "sonnet", "high");
  cell(decide("design", { codex: readings(20, 60).codex }), "codex", "sol", "high");
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
