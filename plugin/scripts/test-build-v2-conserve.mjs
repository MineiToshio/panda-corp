#!/usr/bin/env node
// test-build-v2-conserve.mjs: DR-161 / BL-0320. When the company that would review has less than 15 % of its quota left
// (a known reading at or above quota_conserve = 85 % used, 5-hour or weekly, and below the 90 % stop), reviews stay in the
// author's company with a DIFFERENT model (Sol-built -> Astra, Astra-built -> Sol), builds keep the run label's company,
// and no cross-company deferred re-review is queued. Run: node plugin/scripts/test-build-v2-conserve.mjs
import { effective, policy, QUOTA_CONSERVE_DEFAULT } from "../runtime/build/quota.mjs";
import { builderCell, loadTiers, reviewCell } from "../runtime/build/routing.mjs";
import { availabilityOf } from "../runtime/build/next/context.mjs";
import { patchSupersedes } from "../runtime/build/next/harvest.mjs";
import { availabilityOf as preflightAvailability } from "../runtime/build/preflight/gates.mjs";

let passed = 0; let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (v, m) => { if (!v) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };
const known = (pct) => ({ state: "known", pct });
const cell = (c) => c && { runtime: c.runtime, model: c.model, effort: c.effort };
const SOL = { runtime: "codex", model: "sol", effort: "medium" };
const ASTRA = { runtime: "codex", model: "astra", effort: "high" };
const SONNET = { runtime: "claude", model: "sonnet", effort: "medium" };

test("model-tiers.json carries quota_conserve 85 and the default matches", () => {
  eq(loadTiers().thresholds.quota_conserve, 85, "threshold in model-tiers.json");
  eq(QUOTA_CONSERVE_DEFAULT, 85, "code default");
});

test("policy: conserve from 85 % (inclusive) to below 90 %; out at 90 %; unknown never conserved", () => {
  for (const [pct, conserve, units] of [[84, false, true], [85, true, true], [89, true, true], [90, false, false], [99, false, false]]) {
    const p = policy({ claude: known(pct), codex: known(10), coordinator: "claude-session" });
    eq([p.claude_conserve, p.claude_new_units], [conserve, units], `claude at ${pct} %`);
  }
  const unknown = policy({ claude: { state: "unknown", pct: null }, codex: known(86), coordinator: "claude-session" });
  eq([unknown.claude_conserve, unknown.codex_conserve], [false, true], "unknown claude is not conserved; codex at 86 is");
  eq(policy({ claude: known(86), codex: known(86), coordinator: "claude-session" }).paused, false, "two conserved providers never pause the run");
});

test("availability maps conserve for next and for the preflight preview", () => {
  const pol = policy({ claude: known(87), codex: known(20), coordinator: "claude-session" });
  eq(availabilityOf(pol), { claude: "conserve", codex: "ok" }, "next/context");
  eq(preflightAvailability(pol, true), { claude: "conserve", codex: "ok" }, "preflight gates");
  eq(availabilityOf(policy({ claude: known(95), codex: known(20), coordinator: "claude-session" })).claude, "quota", "out stays quota");
});

const review = (author, zone, claude) => reviewCell({ authors: [author], kind: "frd", zone, availability: { claude, codex: "ok" } });

test("Claude conserved: a Sol-built FRD is reviewed by Codex Astra high, degraded conserve, NO deferred re-review", () => {
  const r = review(SOL, "none", "conserve");
  eq(cell(r.used), { runtime: "codex", model: "astra", effort: "high" }, "reviewer");
  eq(r.degraded, "conserve", "degraded label"); eq(r.deferred, null, "no cross-company re-review"); eq(r.parked, null, "not parked");
});

test("Claude conserved: an Astra-built FRD is reviewed by Codex Sol (a different model), never Astra itself", () => {
  const none = review(ASTRA, "none", "conserve");
  eq(cell(none.used), { runtime: "codex", model: "sol", effort: "high" }, "none zone");
  eq(none.deferred, null, "no deferred");
  const r1 = review(ASTRA, "r1", "conserve");
  eq(cell(r1.used), { runtime: "codex", model: "sol", effort: "xhigh" }, "r1 zone: Sol xhigh instead of parking for Claude");
  eq(r1.parked, null, "an r1 Astra review no longer parks waiting for Claude");
});

test("controls: Claude available keeps the cross-company reviewer; Claude out (>= 90) also stays in Codex with another model and no deferred re-review", () => {
  eq(cell(review(SOL, "none", "ok").used).runtime, "claude", "cross-company when Claude has quota");
  const out = review(SOL, "none", "quota");
  eq([cell(out.used).model, out.degraded, out.deferred], ["astra", "quota_90", null], "Claude out: Astra reviews, no deferred re-review (< 15 % left)");
  const astraOut = review(ASTRA, "floor", "quota");
  eq([cell(astraOut.used), astraOut.parked, astraOut.deferred], [{ runtime: "codex", model: "sol", effort: "xhigh" }, null, null], "Astra floor on quota: Sol xhigh, never parked (BL-0321)");
  const unreach = review(ASTRA, "none", "unreachable");
  eq(unreach.degraded, "same_model", "Claude unreachable (not quota) keeps the N7 analog with its deferred re-review"); ok(unreach.deferred, "unreachable still defers");
});

test("symmetric: Codex conserved, a Sonnet-built FRD stays in Claude with a different model and no deferred re-review", () => {
  const r = reviewCell({ authors: [SONNET], kind: "frd", zone: "none", availability: { claude: "ok", codex: "conserve" } });
  ok(r.used && r.used.runtime === "claude" && r.used.model !== "sonnet", `reviewer stays in Claude, other model: ${JSON.stringify(r.used)}`);
  eq(r.deferred, null, "no deferred re-review");
});

test("builds keep the run label's company when the other company is conserved (and when the label's own company is)", () => {
  const codexBuild = builderCell({ kind: "build", size: "feature", zone: "none" }, { label: "codex", quota: { claude: "conserve", codex: "ok" } });
  eq(codexBuild.runtime, "codex", "label codex builds on Codex");
  const claudeBuild = builderCell({ kind: "build", size: "feature", zone: "none" }, { label: "claude", quota: { claude: "conserve", codex: "ok" } });
  eq(claudeBuild.runtime, "claude", "a conserved label company still takes its own units (only cross reviews avoid it)");
});

test("the security audit (pinned to Claude) waits in the deferred ledger while Claude is conserved, and runs when it is not", () => {
  const conserved = builderCell({ kind: "audit", size: "feature", zone: "r1", attempt: 1 }, { label: "codex", zone: "r1", attempt: 1, quota: { claude: "conserve", codex: "ok" } });
  ok(conserved.deferred && !conserved.runtime, `audit deferred, not dispatched on Claude: ${JSON.stringify(conserved)}`);
  const normal = builderCell({ kind: "audit", size: "feature", zone: "r1", attempt: 1 }, { label: "codex", zone: "r1", attempt: 1, quota: { claude: "ok", codex: "ok" } });
  eq(normal.runtime, "claude", "audit on Claude when it has quota");
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

test("BL-0322: Sol + Astra authored and Claude out: Sol (the cell of the strongest author) reviews, same_model, never parked", () => {
  const SOL_H = { runtime: "codex", model: "sol", effort: "high" };
  for (const claude of ["quota", "conserve"]) {
    const r = reviewCell({ authors: [SOL_H, ASTRA], kind: "frd", zone: "floor", availability: { claude, codex: "ok" } });
    eq([cell(r.used), r.degraded, r.deferred, r.parked], [{ runtime: "codex", model: "sol", effort: "xhigh" }, "same_model", null, null], `Claude ${claude}`);
    const rev = reviewCell({ authors: [ASTRA, SOL_H], kind: "frd", zone: "floor", availability: { claude, codex: "ok" } });
    eq(cell(rev.used), cell(r.used), "author order does not change the reviewer");
  }
  eq(reviewCell({ authors: [SOL_H, ASTRA], kind: "frd", zone: "floor", availability: { claude: "unreachable", codex: "ok" } }).parked, "no_reviewer", "unreachable (not scarce) still parks");
  eq(cell(reviewCell({ authors: [SOL_H, ASTRA], kind: "frd", zone: "floor", availability: { claude: "ok", codex: "ok" } }).used).runtime, "claude", "Claude with quota reviews");
});

test("BL-0322: a stale Claude reading at or above 85 % stays known until that window resets; below 85 % or past reset it is unknown", () => {
  const now = Date.parse("2026-11-14T05:00:00Z");
  const old = "2026-11-14T04:00:00Z"; const future = "2026-11-17T00:00:00Z"; const past = "2026-11-14T04:30:00Z";
  const r = (weekly, wAt, fh = 11, fhAt = future) => ({ provider: "claude", status: "ok", five_hour_pct: fh, weekly_pct: weekly, five_hour_resets_at: fhAt, weekly_resets_at: wAt, observed_at: old });
  eq(effective(r(91, future), now), { pct: 91, state: "known", needs_probe: false }, "91 % weekly, resets later");
  eq(effective(r(91, past), now).state, "unknown", "the window already reset");
  eq(effective(r(91, null), now).state, "unknown", "no resets_at: cannot prove it");
  eq(effective(r(60, future), now).state, "unknown", "below 85 % a stale reading is unknown as before");
  eq(effective({ ...r(91, future), observed_at: "2026-11-14T04:58:00Z" }, now).pct, 91, "fresh readings unchanged");
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
