#!/usr/bin/env node
// DR-162 replaces the old author/attempt matrix. Expectations below are owner contract cells, not catalog snapshots.
import assert from "node:assert/strict";
import { builderCell, reviewCell, consultCell, loadTiers, createRouter, sessionEligible } from "../runtime/build/routing.mjs";
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } };
const pick = c => c && [c.runtime, c.model, c.effort];
const authors = [{ runtime: "codex", model: "sol", effort: "low" }];
const now = "2026-11-14T16:07:00Z";
const reading = (tool, pct) => ({ schema: 1, tool, state: "known", observedAt: now, windows:
  (tool === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id => ({ id, scope: "all", applicability: "required", percentUsed: pct, resetsAt: "2026-11-17T16:07:00Z" })) });
const quota = (c, x) => ({ now, readings: { claude: reading("claude", c), codex: reading("codex", x) } });
const build = (kind = "build", zone = "none", ctx = {}, unit = {}) => builderCell({ kind, zone, size: "feature", ...unit }, { label: "claude", ...ctx });
test("catalog guards reject invalid metadata and never enable Fable/Terra", () => {
  const tiers = loadTiers(); assert.equal(tiers.version, 2); assert.throws(() => createRouter({}));
  for (const model of ["fable", "terra", "bad"]) assert.throws(() => createRouter(tiers).assertCell({ runtime: "codex", model, effort: "low" }, "test"));
});
test("Claude 94 percent: design continues on Codex Sol high", () => assert.deepEqual(pick(build("docs", "none", { quota: quota(94, 30) })), ["codex", "sol", "high"]));
test("Codex exhausted: implementation continues on Claude Sonnet medium", () => assert.deepEqual(pick(build("build", "none", { quota: quota(30, 100) })), ["claude", "sonnet", "medium"]));
test("both exhausted: wait has the nearest reset, including review", () => {
  const q = quota(100, 100); q.readings.codex.windows[0].resetsAt = "2026-11-15T16:07:00Z";
  const b = build("build", "none", { quota: q }); assert.equal(b.paused, "quota"); assert.equal(b.resumeAt, "2026-11-15T16:07:00.000Z");
  const r = reviewCell({ authors, kind: "frd", zone: "none", availability: q }); assert.equal(r.used, null); assert.equal(r.resumeAt, b.resumeAt);
});
test("via session cannot bypass an exhausted provider or change the selected model", () => {
  const ctx = { coordinator: "claude-session", sessionModel: "opus", quota: quota(100, 10) };
  const b = build("build", "none", ctx, { size: "touch" }); assert.equal(b.via, "cli"); assert.equal(b.runtime, "codex");
  const c = build("build", "none", { coordinator: "codex-session", sessionModel: "sol" }, { size: "touch" });
  assert.equal(c.via, "session"); assert.deepEqual(pick(c), ["codex", "sol", "low"]);
});
test("reviews use independent context even with the same author model", () => {
  for (const model of ["luna", "sol", "astra"]) {
    const r = reviewCell({ authors: [{ runtime: "codex", model, effort: "high" }], kind: "frd", zone: "none" });
    assert.deepEqual(pick(r.used), ["codex", "sol", "low"]); assert.equal(r.independent_context, true); assert.equal(r.deferred, null);
  }
});
test("attempts/reopens/previous cells never force escalation or a tool change", () => {
  for (const attempt of [1, 2, 3]) for (const reopen_count of [0, 4]) {
    const b = build("patch", "none", { attempt, reopen_count, previousCell: { runtime: "codex", model: "sol", effort: "low" } });
    assert.deepEqual(pick(b), ["codex", "sol", "low"]); assert.equal(b.bumped, false);
  }
});
test("risk from risk.mjs governs transversal floors, audits can use either tool", () => {
  assert.deepEqual(pick(build("build", "floor")), ["codex", "sol", "medium"]);
  assert.deepEqual(pick(build("build", "r1")), ["codex", "astra", "high"]);
  assert.deepEqual(pick(build("audit", "r1", { quota: quota(100, 20) })), ["codex", "astra", "high"]);
  assert.deepEqual(pick(build("audit", "r1", { quota: quota(20, 100) })), ["claude", "opus", "high"]);
});
test("role mapping: planner/architect/design, builder/implementer, reviewer and mechanical", () => {
  for (const role of ["planner", "architect", "design"]) assert.deepEqual(pick(build("build", "none", {}, { role })), ["claude", "opus", "high"]);
  for (const role of ["builder", "implementer"]) assert.deepEqual(pick(build("build", "none", {}, { role })), ["codex", "sol", "low"]);
  assert.deepEqual(pick(build("mechanical")), ["codex", "luna", "low"]);
});
test("all runtime shapes allow capacity fallback through their qualified transport", () => {
  for (const shape of ["R-A", "R-B", "R-C", "drive"]) {
    const c = build("build", "none", { shape, quota: quota(20, 100), coordinator: shape === "drive" ? "drive" : "codex-session" });
    assert.deepEqual(pick(c), ["claude", "sonnet", "medium"]); assert.equal(c.via, "cli");
  }
});
test("unknown kind/zone/label/shape/attempt and mismatched author are refused", () => {
  for (const ctx of [{ label: "bad" }, { zone: "bad" }, { shape: "bad" }, { attempt: 0 }, { attempt: 4 }]) assert.throws(() => build("build", "none", ctx));
  assert.throws(() => build("bad")); assert.throws(() => reviewCell({ authors: [], kind: "frd", zone: "none" }));
  assert.throws(() => reviewCell({ authors: [{ runtime: "claude", model: "sol" }], kind: "frd", zone: "none" }));
  assert.throws(() => consultCell({ origin: "bad", consultNo: 1 }));
});
test("exhaustive cells are deterministic, catalog-qualified, immutable and never attempt-escalated", () => {
  const tiers = loadTiers();
  for (const kind of ["docs", "tests", "build", "patch", "audit"]) for (const zone of ["none", "floor", "r1"]) for (const label of ["claude", "codex"]) for (const attempt of [1, 2, 3]) for (const size of ["touch", "feature", "giant"]) for (const bounded of [false, true]) for (const reopen_count of [0, 2]) for (const quotaCase of [quota(20,20), quota(100,20), quota(20,100)]) {
    const unit = Object.freeze({ kind, zone, size, attempt, bounded }); const ctx = Object.freeze({ label, now, quota: quotaCase, reopen_count });
    const a = builderCell(unit, ctx), b = builderCell(unit, ctx); assert.deepEqual(a, b);
    assert.ok(tiers.catalog[a.runtime][a.model]); assert.ok(!["fable", "terra"].includes(a.model)); assert.notEqual(a.effort, "max");
    if (zone !== "r1") assert.notEqual(a.model, "astra");
    const r = reviewCell({ authors: [{ runtime: a.runtime, model: a.model, effort: a.effort }], kind: "frd", zone });
    assert.ok(r.used); assert.equal(r.deferred, null); if (zone !== "r1") assert.notEqual(r.used.model, "astra");
  }
});
test("consultation uses design capacity without an author/origin Astra escalation", () => {
  for (const origin of ["claude", "codex", "drive", "codex_app"]) for (const consultNo of [1, 2]) assert.deepEqual(pick(consultCell({ origin, consultNo })), ["claude", "opus", "high"]);
  assert.equal(consultCell({ origin: "claude", consultNo: 3 }), null);
});
console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
