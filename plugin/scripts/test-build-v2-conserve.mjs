#!/usr/bin/env node
// DR-162 supersedes conserve policy; preserve the unrelated BL-0321 patch ownership regression.
import assert from "node:assert/strict";
import { effective, policy, QUOTA_CONSERVE_DEFAULT } from "../runtime/build/quota.mjs";
import { builderCell, reviewCell, loadTiers } from "../runtime/build/routing.mjs";
import { availabilityOf } from "../runtime/build/next/context.mjs";
import { availabilityOf as preflightAvailability } from "../runtime/build/preflight/gates.mjs";
import { patchSupersedes } from "../runtime/build/next/harvest.mjs";
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}: ${e.message}`); } };
const eq = (a,b,m) => assert.deepEqual(a,b,m);
const known = pct => ({ state: "known", pct });
const author = { runtime: "codex", model: "sol", effort: "low" };
test("restored compatibility metadata: historical conserve threshold remains 85 without policy authority", () => {
  eq(loadTiers().thresholds.quota_conserve, 85); eq(QUOTA_CONSERVE_DEFAULT, 85);
});
test("85/90/95 are not global veto or handoff thresholds", () => {
  for (const pct of [85, 90, 94, 95]) {
    const p = policy({ claude: known(pct), codex: known(20) });
    eq([p.paused, p.handoff, p.claude_conserve, p.codex_conserve], [false, false, false, false]);
  }
});
test("legacy conserve input causes per-task selection, no forced Astra or deferred review", () => {
  const r = reviewCell({ authors: [author], kind: "frd", zone: "none", availability: { claude: "conserve", codex: "ok" } });
  eq([r.used.runtime, r.used.model, r.used.effort, r.deferred, r.degraded], ["codex", "sol", "low", null, null]);
});
test("label no longer pins a conserved provider", () => {
  const b = builderCell({ kind: "build", size: "feature", zone: "none" }, { label: "claude", quota: { claude: "conserve", codex: "ok" } });
  eq([b.runtime,b.model,b.effort], ["codex","sol","low"]);
});
test("same-model mixed-author review is allowed in fresh context", () => {
  const r = reviewCell({ authors: [author, { runtime: "codex", model: "astra", effort: "high" }], kind: "frd", zone: "floor", availability: { claude: "quota", codex: "ok" } });
  eq([r.used.model, r.used.effort, r.parked, r.deferred], ["sol","medium",null,null]);
});
test("stale high Claude observations are unknown, never sticky conserve", () => {
  const e = effective({ provider: "claude", status: "ok", observed_at: "2026-11-14T04:00:00Z", five_hour_pct: 91, weekly_pct: 20,
    five_hour_resets_at: "2026-11-17T00:00:00Z", weekly_resets_at: "2026-11-17T00:00:00Z" }, "2026-11-14T05:00:00Z");
  eq(e, { state: "unknown", pct: null, needs_probe: false });
});
test("BL-0321: an integrated review-reopen patch supersedes the patching units of its FRD that own its work orders", () => {
  const units = [
    { id: "u-build-wo-01-017", kind: "build", frd: "frd-01", state: "patching", wos: ["wo-01-017", "wo-01-018"] },
    { id: "u-build-wo-01-020", kind: "build", frd: "frd-01", state: "patching", wos: ["wo-01-020"] },
    { id: "u-build-wo-02-001", kind: "build", frd: "frd-02", state: "patching", wos: ["WO-01-017"] },
    { id: "u-patch-wo-01-017", kind: "patch", frd: "frd-01", state: "integrated", wos: ["WO-01-017", "wo-01-018"] },
  ];
  const patch = units[3];
  eq(patchSupersedes({ units }, patch, null), ["u-build-wo-01-017"], "same FRD + shared WO (case-insensitive) only");
  eq(patchSupersedes({ units }, patch, { fixes: ["u-build-wo-01-020", "u-patch-wo-01-017"] }), ["u-build-wo-01-020"], "a gate patch keeps its gate-failure.json list");
});

test("restored: next and preflight map ordinary/unknown/pressure/exhaustion consistently", () => {
  for (const c of [null, 20, 85, 90, 95, 100]) for (const x of [null, 20, 85, 90, 95, 100]) {
    const p = policy({ claude: c === null ? { state: "unknown", pct: null } : known(c), codex: x === null ? { state: "unknown", pct: null } : known(x) });
    const expected = { claude: c === 100 ? "quota" : "ok", codex: x === 100 ? "quota" : "ok" };
    eq(availabilityOf(p), expected); eq(preflightAvailability(p, true), expected);
    eq(preflightAvailability(p, false), { ...expected, codex: "unreachable" });
    eq([p.claude_conserve, p.codex_conserve], [false, false]); eq(p.paused, c === 100 && x === 100);
  }
});
test("restored: neither unknown nor two pressured providers impose a global stop", () => {
  for (const pct of [84, 85, 89, 90, 94, 95]) {
    for (const c of [known(pct), { state: "unknown", pct: null }]) {
      const p = policy({ claude: c, codex: known(pct) }); eq(p.paused, false); eq(p.handoff, false);
      eq([p.claude_conserve, p.codex_conserve], [false, false]);
    }
  }
});
test("restored: symmetric review fallback preserves risk and fresh context", () => {
  for (const zone of ["none", "floor", "r1"]) {
    const r = reviewCell({ authors: [{ runtime: "claude", model: "sonnet", effort: "medium" }], kind: "frd", zone, availability: { claude: "ok", codex: "quota" } });
    eq([r.used.runtime, r.used.model, r.used.effort], ["claude", zone === "floor" ? "sonnet" : "opus", zone === "none" ? "low" : zone === "floor" ? "medium" : "high"]);
    eq([r.independent_context, r.deferred, r.degraded, r.parked], [true, null, null, null]);
  }
});
test("restored: mixed-author order and unavailable provider never force ordinary Astra or park", () => {
  const authors = [author, { runtime: "codex", model: "astra", effort: "high" }];
  for (const claude of ["quota", "conserve", "unreachable", "ok"]) for (const zone of ["none", "floor", "r1"]) {
    const input = { authors, kind: "frd", zone, availability: { claude, codex: "ok" } };
    const a = reviewCell(input), b = reviewCell({ ...input, authors: [...authors].reverse() });
    eq(a, b); eq([a.parked, a.deferred, a.degraded, a.independent_context], [null, null, null, true]);
    eq(a.used.model, zone === "r1" ? "astra" : "sol");
  }
});
test("restored: audit keeps security floor and uses either eligible provider without deferral", () => {
  for (const quota of [{ claude: "conserve", codex: "ok" }, { claude: "quota", codex: "ok" }, { claude: "ok", codex: "quota" }]) {
    const c = builderCell({ kind: "audit", size: "feature", zone: "r1" }, { label: "codex", quota });
    eq(c.model, quota.codex === "quota" ? "opus" : "astra"); eq(c.effort, "high"); eq(c.deferred, undefined);
  }
});
test("restored: stale/reset/missing-reset and fresh Claude controls retain honest percentages", () => {
  const now = "2026-11-14T05:00:00Z", future = "2026-11-17T00:00:00Z", past = "2026-11-14T04:30:00Z";
  const raw = (pct, reset, observed_at) => ({ provider: "claude", status: "ok", observed_at, five_hour_pct: 11, weekly_pct: pct, five_hour_resets_at: future, weekly_resets_at: reset });
  for (const pct of [60, 91]) {
    eq(effective(raw(pct, future, "2026-11-14T04:00:00Z"), now), { state: "unknown", pct: null, needs_probe: false });
    eq(effective(raw(pct, future, "2026-11-14T04:58:00Z"), now), { state: "known", pct, needs_probe: false });
    for (const reset of [null, past]) eq(effective(raw(pct, reset, "2026-11-14T04:58:00Z"), now).state, "unknown");
  }
});

console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
