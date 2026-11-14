#!/usr/bin/env node
// DR-162 supersedes conserve policy; preserve the unrelated BL-0321 patch ownership regression.
import assert from "node:assert/strict";
import { effective, policy } from "../runtime/build/quota.mjs";
import { builderCell, reviewCell } from "../runtime/build/routing.mjs";
import { patchSupersedes } from "../runtime/build/next/harvest.mjs";
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}: ${e.message}`); } };
const eq = (a,b,m) => assert.deepEqual(a,b,m);
const known = pct => ({ state: "known", pct });
const author = { runtime: "codex", model: "sol", effort: "low" };
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

console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
