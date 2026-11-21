#!/usr/bin/env node
// DR-162 replaces the old author/attempt matrix. Expectations below are owner contract cells, not catalog snapshots.
import assert from "node:assert/strict";
import { workOrderComplexity, maxComplexity } from "../runtime/complexity.mjs";
import { readPlanWorkOrders, plan } from "../runtime/build/planner.mjs";
import { capacityTaskForUnit } from "../runtime/build/routing.mjs";
import { decide } from "../runtime/capacity.mjs";
import { builderCell, reviewCell, consultCell, loadTiers, validateTiers, createRouter, sessionEligible, modelSlug, MODEL_STRENGTH } from "../runtime/build/routing.mjs";
const RANK = ["minimal", "low", "medium", "high", "xhigh"];
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } };
const pick = c => c && [c.runtime, c.model, c.effort];
const authors = [{ runtime: "codex", model: "sol", effort: "low" }];
const now = "2026-11-14T16:07:00Z";
// Realistic resets per window (pace balancing, DR-162 amendment): the 5-hour window is halfway, the weekly one
// 3 days out. Equal usage then leaves both tools within the 15-point preference band.
const RESETS = { five_hour: "2026-11-14T18:37:00Z", weekly: "2026-11-17T16:07:00Z" };
const reading = (tool, pct) => ({ schema: 1, tool, state: "known", observedAt: now, windows:
  (tool === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id => ({ id, scope: "all", applicability: "required", percentUsed: pct, resetsAt: RESETS[id] })) });
const quota = (c, x) => ({ now, readings: { claude: reading("claude", c), codex: reading("codex", x) } });
const build = (kind = "build", zone = "none", ctx = {}, unit = {}) => builderCell({ kind, zone, size: "feature", ...unit }, { label: "claude", ...ctx });
test("catalog guards reject invalid metadata and never enable Fable/Terra", () => {
  const tiers = loadTiers(); assert.equal(tiers.version, 2); assert.throws(() => createRouter({}));
  for (const model of ["fable", "terra", "bad"]) assert.throws(() => createRouter(tiers).assertCell({ runtime: "codex", model, effort: "low" }, "test"));
});
test("Claude 94 percent: design continues on Codex Sol high", () => assert.deepEqual(pick(build("docs", "none", { quota: quota(94, 30) })), ["codex", "sol", "high"]));
test("Codex exhausted: implementation continues on Claude Sonnet medium", () => assert.deepEqual(pick(build("build", "none", { quota: quota(30, 100) })), ["claude", "sonnet", "high"]));
test("both exhausted: wait has the nearest reset, including review", () => {
  const q = quota(100, 100); q.readings.codex.windows[0].resetsAt = "2026-11-15T16:07:00Z";
  const b = build("build", "none", { quota: q }); assert.equal(b.paused, "quota"); assert.equal(b.resumeAt, "2026-11-15T16:07:00.000Z");
  const r = reviewCell({ authors, kind: "frd", zone: "none", availability: q }); assert.equal(r.used, null); assert.equal(r.resumeAt, b.resumeAt);
});
test("via session cannot bypass an exhausted provider or change the selected model", () => {
  const ctx = { coordinator: "claude-session", sessionModel: "opus", quota: quota(100, 10) };
  const b = build("build", "none", ctx, { size: "touch" }); assert.equal(b.via, "cli"); assert.equal(b.runtime, "codex");
  const c = build("build", "none", { coordinator: "codex-session", sessionModel: "sol" }, { size: "touch" });
  assert.equal(c.via, "session"); assert.deepEqual(pick(c), ["codex", "sol", "medium"]);
});
test("reviews use independent context even with the same author model", () => {
  for (const model of ["luna", "sol", "astra"]) {
    const r = reviewCell({ authors: [{ runtime: "codex", model, effort: "high" }], kind: "frd", zone: "none" });
    assert.deepEqual(pick(r.used), expectedReview([{ runtime: "codex", model, effort: "high" }], "none", "codex")); assert.equal(r.independent_context, true); assert.equal(r.deferred, null);
  }
});
test("attempts/reopens/previous cells never force escalation or a tool change", () => {
  for (const attempt of [1, 2, 3]) for (const reopen_count of [0, 4]) {
    const b = build("patch", "none", { attempt, reopen_count, previousCell: { runtime: "codex", model: "sol", effort: "low" } });
    assert.deepEqual(pick(b), ["codex", "sol", "medium"]); assert.equal(b.bumped, false);
  }
});
test("risk from risk.mjs governs transversal floors, audits can use either tool", () => {
  assert.deepEqual(pick(build("build", "floor")), ["codex", "sol", "medium"]);
  assert.deepEqual(pick(build("build", "r1")), ["codex", "astra", "high"]);
  assert.deepEqual(pick(build("audit", "r1", { quota: quota(100, 20) })), ["codex", "astra", "xhigh"]);
  assert.deepEqual(pick(build("audit", "r1", { quota: quota(20, 100) })), ["claude", "opus", "xhigh"]);
});
test("role mapping: planner/architect/design, builder/implementer, reviewer and mechanical", () => {
  for (const role of ["planner", "architect", "design"]) assert.deepEqual(pick(build("build", "none", {}, { role })), ["claude", "opus", "high"]);
  for (const role of ["builder", "implementer"]) assert.deepEqual(pick(build("build", "none", {}, { role })), ["codex", "sol", "medium"]);
  assert.deepEqual(pick(build("mechanical")), ["codex", "luna", "low"]);
});
test("all runtime shapes allow capacity fallback through their qualified transport", () => {
  for (const shape of ["R-A", "R-B", "R-C", "drive"]) {
    const c = build("build", "none", { shape, quota: quota(20, 100), coordinator: shape === "drive" ? "drive" : "codex-session" });
    assert.deepEqual(pick(c), ["claude", "sonnet", "high"]); assert.equal(c.via, "cli");
  }
});
test("unknown kind/zone/label/shape/attempt and mismatched author are refused", () => {
  for (const ctx of [{ label: "bad" }, { zone: "bad" }, { shape: "bad" }, { attempt: 0 }, { attempt: 4 }]) assert.throws(() => build("build", "none", ctx));
  assert.throws(() => build("bad")); assert.ok(reviewCell({ authors: [], kind: "frd", zone: "none" }).used);
  assert.throws(() => reviewCell({ authors: [{ runtime: "claude", model: "sol" }], kind: "frd", zone: "none" }));
  assert.throws(() => consultCell({ origin: "bad", consultNo: 1 }));
});
test("exhaustive cells are deterministic, catalog-qualified, immutable and never attempt-escalated", () => {
  const tiers = loadTiers();
  for (const kind of ["docs", "tests", "build", "patch", "audit"]) for (const zone of ["none", "floor", "r1"]) for (const label of ["claude", "codex"]) for (const attempt of [1, 2, 3]) for (const size of ["touch", "feature", "giant"]) for (const bounded of [false, true]) for (const reopen_count of [0, 2]) for (const quotaCase of [quota(20,20), quota(100,20), quota(20,100)]) {
    const unit = Object.freeze({ kind, zone, size, attempt, bounded }); const ctx = Object.freeze({ label, now, quota: quotaCase, reopen_count });
    const a = builderCell(unit, ctx), b = builderCell(unit, ctx); assert.deepEqual(a, b);
    assert.ok(tiers.catalog[a.runtime][a.model]); assert.ok(!["fable", "terra"].includes(a.model)); assert.notEqual(a.effort, "max");
    if (zone !== "r1" && kind !== "audit") assert.notEqual(a.model, "astra");
    if (kind === "audit") { assert.ok(["astra", "opus"].includes(a.model)); assert.equal(a.effort, "xhigh"); }
    const r = reviewCell({ authors: [{ runtime: a.runtime, model: a.model, effort: a.effort }], kind: "frd", zone });
    if (a.effort === "xhigh") assert.equal(r.used, null); else assert.ok(r.used); assert.equal(r.deferred, null); assert.notDeepEqual(pick(r.used), pick(a));
  }
});
test("consultation uses design capacity without an author/origin Astra escalation", () => {
  for (const origin of ["claude", "codex", "drive", "codex_app"]) for (const consultNo of [1, 2]) assert.deepEqual(pick(consultCell({ origin, consultNo })), ["claude", "opus", "high"]);
  assert.equal(consultCell({ origin: "claude", consultNo: 3 }), null);
});

// Restored from 68487c7a: independent hand tables, exhaustive vocab/shape/risk checks,
// frozen inputs and negative controls. Expected cells come from DR-162, not model-tiers rows.
const DATA = loadTiers(), router = createRouter(DATA);

const freeze = o => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
const expected = (type, zone, runtime) => {
  const cells = {
    codex: { normal: { design: ["sol", "high"], implement: ["sol", "medium"], review: ["sol", "high"], mechanical: ["luna", "low"] },
      delicate: ["sol", "medium"], critical: ["astra", "high"] },
    claude: { normal: { design: ["opus", "high"], implement: ["sonnet", "high"], review: ["opus", "low"], mechanical: ["haiku", "low"] },
      delicate: ["sonnet", "medium"], critical: ["opus", "high"] },
  };
  const pair = zone === "r1" ? type === "review" ? [runtime === "codex" ? "astra" : "opus", "xhigh"] : cells[runtime].critical : type === "design" ? cells[runtime].normal.design : zone === "floor" && type === "mechanical" ? cells[runtime].delicate : cells[runtime].normal[type];
  return [runtime, ...pair];
};
function expectedReview(authors, zone, runtime) {
  const ranks = { codex: ["luna/low", "sol/low", "sol/medium", "sol/high", "astra/high", "astra/xhigh"],
    claude: ["haiku/low", "sonnet/medium", "sonnet/high", "opus/low", "opus/medium", "opus/high", "opus/xhigh"] };
  const table = {
    "luna/low": ["sol/medium", "opus/low"], "haiku/low": ["sol/medium", "opus/low"],
    "sol/low": ["sol/medium", "opus/low"], "sol/medium": ["sol/high", "opus/low"], "sol/high": ["astra/high", "opus/high"],
    "sonnet/medium": ["sol/medium", "opus/low"], "sonnet/high": ["sol/high", "opus/low"],
    "opus/low": ["sol/high", "opus/medium"], "opus/medium": ["astra/high", "opus/high"],
    "astra/high": ["astra/xhigh", "opus/xhigh"], "opus/high": ["astra/xhigh", "opus/xhigh"],
    "astra/xhigh": [null, null], "opus/xhigh": [null, null],
  };
  let index = zone === "r1" ? ranks[runtime].indexOf(runtime === "codex" ? "astra/high" : "opus/high") : runtime === "codex" ? 2 : 3;
  for (const a of authors) {
    const tool = a.runtime, model = a.model === "terra" ? "sol" : a.model === "fable" ? "opus" : a.model;
    const opts = ranks[tool].filter(k => k.startsWith(`${model}/`));
    const wanted = a.model === "fable" ? "xhigh" : a.effort ?? opts.at(-1).split("/")[1];
    const key = opts.find(k => RANK.indexOf(k.split("/")[1]) >= RANK.indexOf(wanted)) ?? opts.at(-1);
    const next = table[key][runtime === "codex" ? 0 : 1];
    if (!next) return null;
    index = Math.max(index, ranks[runtime].indexOf(next));
  }
  return [runtime, ...ranks[runtime][index].split("/")];
}
const wellFormed = c => {
  assert.ok(c && typeof c === "object" && !Array.isArray(c), "single cell object");
  const enabled = { codex: ["luna", "sol", "astra"], claude: ["haiku", "sonnet", "opus"] };
  assert.ok(enabled[c.runtime]?.includes(c.model), "enabled model belongs to runtime");
  assert.ok(DATA.catalog[c.runtime][c.model], "catalog capability");
  assert.ok(!DATA.disabled.includes(c.model) && !DATA.never_emit.models.includes(c.model), "forbidden model");
  assert.ok(RANK.includes(c.effort) && !DATA.never_emit.efforts.includes(c.effort), "valid bounded effort");
};
const checkBuilder = (c, exp) => {
  wellFormed(c); assert.deepEqual(pick(c), exp, "role/risk qualified cell");
  assert.ok(["agent", "cli", "session"].includes(c.via), "qualified transport");
  assert.equal(c.row, "capacity"); assert.equal(c.bumped, false);
  assert.equal(c.capacity.action, "run"); assert.deepEqual(pick(c), [c.capacity.tool, c.capacity.model, c.capacity.effort]);
};
const checkReview = (r, exp) => {
  assert.ok(r && typeof r === "object" && !Array.isArray(r), "single review result");
  assert.equal(r.row, "capacity"); assert.equal(r.independent_context, true);
  assert.equal(r.degraded, null); assert.equal(r.deferred, null);
  if (exp === null) {
    assert.equal(r.parked, "no_reviewer"); assert.equal(r.used, null); assert.equal(r.primary, null);
    assert.equal(r.capacity.action, "wait"); assert.ok(Number.isFinite(Date.parse(r.resumeAt)));
  } else {
    assert.equal(r.parked, null); wellFormed(r.primary); wellFormed(r.used);
    assert.deepEqual(pick(r.used), exp); assert.deepEqual(pick(r.primary), exp);
    assert.equal(r.capacity.action, "run"); assert.deepEqual(exp, [r.capacity.tool, r.capacity.model, r.capacity.effort]);
  }
};
test("restored catalog: complete guard rails, layers, efforts and exports", () => {
  assert.equal(DATA.version, 2); assert.deepEqual(DATA.effort_rank, RANK);
  assert.ok(DATA.disabled.includes("terra") && DATA.disabled.includes("fable"));
  assert.ok(DATA.never_emit.models.includes("fable")); assert.ok(DATA.never_emit.efforts.includes("max"));
  for (const fn of [builderCell, reviewCell, consultCell, sessionEligible, loadTiers, validateTiers, createRouter, modelSlug]) assert.equal(typeof fn, "function");
  for (const [runtime, models] of Object.entries(DATA.catalog)) for (const [model, slug] of Object.entries(models)) {
    assert.equal(router.companyOf(model), runtime); assert.ok(DATA.layers[runtime].includes(model)); assert.equal(typeof slug, "string");
  }
  assert.equal(router.companyOf("fable"), "claude"); assert.throws(() => router.companyOf("unknown"));
  assert.deepEqual(MODEL_STRENGTH, { haiku: 1, luna: 1, sonnet: 2, sol: 2, terra: 2, opus: 3, astra: 3, fable: 4 });
});
for (const [name, mutate] of [
  ["version", t => t.version = 1], ["effort rank", t => t.effort_rank = []],
  ...["disabled", "builder", "review_matrix"].map(k => [k, t => t[k] = null]),
  ...["catalog", "layers", "never_emit", "review_modifiers", "doubt_consult"].map(k => [k, t => t[k] = null]),
  ["builder row", t => t.builder = [{ id: "broken" }]], ["review row", t => t.review_matrix = [{ row: 1 }]],
]) test(`restored invalid catalog: ${name}`, () => { const t = structuredClone(DATA); mutate(t); assert.throws(() => createRouter(t)); });
for (const runtime of ["claude", "codex"]) for (const [model, slug] of Object.entries(DATA.catalog[runtime])) {
  test(`restored runtime capability: ${runtime}/${model}`, () => {
    for (const effort of RANK) {
      const c = { runtime, model, effort };
      if (DATA.disabled.includes(model)) assert.throws(() => router.assertCell(c, "test"));
      else assert.deepEqual(router.assertCell(c, "test"), c);
    }
    if (!DATA.disabled.includes(model)) assert.equal(modelSlug({ runtime, model }), runtime === "codex" ? slug : null);
    const other = runtime === "claude" ? "codex" : "claude";
    assert.throws(() => router.assertCell({ runtime: other, model, effort: "low" }, "test"));
  });
}
test("restored invalid cells: unknown runtime/model, disabled Fable and invalid efforts", () => {
  for (const c of [null, {}, [], { runtime: "bad", model: "sol", effort: "low" }, { runtime: "claude", model: "fable", effort: "high" },
    { runtime: "codex", model: "wat", effort: "low" }, ...[null, "max", "ultra", "bad"].map(effort => ({ runtime: "codex", model: "sol", effort }))]) assert.throws(() => router.assertCell(c, "test"));
  assert.throws(() => router.modelSlug({ runtime: "codex", model: "wat" }));
  for (const [a, b] of [[null, "xhigh"], ["max", "xhigh"], ["minimal", "low"], ["low", "medium"], ["medium", "high"], ["high", "xhigh"], ["xhigh", "xhigh"]]) assert.equal(router.nextEffort(a), b);
  assert.throws(() => router.nextEffort("ultra"));
});
// Preserve all 24 old builder scenarios, replacing label/attempt escalation expectations with role/risk.
const builderRows = [
  ["docs touch", { kind: "docs", size: "touch" }, {}],
  ["docs feature", { kind: "docs", size: "feature" }, {}],
  ["docs giant", { kind: "docs", size: "giant" }, {}],
  ["docs risk", { kind: "docs", size: "touch" }, { zone: "r1" }],
  ["docs attempt 3", { kind: "docs", size: "touch" }, { attempt: 3 }],
  ...["none", "floor", "r1"].map(zone => [`tests ${zone}`, { kind: "tests" }, { zone }]),
  ["build default", { kind: "build" }, {}], ["build feature", { kind: "build", size: "feature" }, {}],
  ["build attempt 2", { kind: "build" }, { attempt: 2 }],
  ...["floor", "r1"].map(zone => [`build ${zone}`, { kind: "build" }, { zone }]),
  ...[1, 2].map(reopen_count => [`build reopen ${reopen_count}`, { kind: "build" }, { reopen_count }]),
  ["build reopen risk", { kind: "build" }, { reopen_count: 1, zone: "r1" }],
  ["build attempt 3", { kind: "build" }, { attempt: 3 }],
  ["build attempt 3 reopen risk", { kind: "build" }, { attempt: 3, reopen_count: 2, zone: "r1" }],
  ["patch bounded", { kind: "patch", bounded: true }, {}], ["patch unbounded", { kind: "patch", bounded: false }, {}],
  ["patch reopened", { kind: "patch", bounded: true }, { reopen_count: 2 }],
  ["patch bounded attempt 3", { kind: "patch", bounded: true }, { attempt: 3 }],
  ["patch unbounded attempt 3", { kind: "patch", bounded: false }, { attempt: 3 }],
  ["audit", { kind: "audit" }, {}],
];
for (const [name, unit, opts] of builderRows) test(`restored builder row: ${name}`, () => {
  const type = unit.kind === "docs" ? "design" : unit.kind === "audit" ? "review" : "implement", zone = opts.zone ?? "none";
  for (const label of ["claude", "codex"]) for (const [c, x] of [[20, 20], [100, 20], [20, 100]]) {
    const runtime = x === 100 ? "claude" : c === 100 ? "codex" : type === "design" ? "claude" : "codex";
    const ctx = freeze({ label, now, ...opts, quota: quota(c, x) }), u = freeze({ id: "row", size: "touch", ...unit });
    checkBuilder(builderCell(u, ctx), expected(type, unit.kind === "audit" ? "r1" : zone, runtime));
  }
});
// Old author vocabulary (including historical disabled authors), all effort/origin/kind/zone combinations.
// The author remains evidence only; it never selects a stronger reviewer or forces another company.
const allAuthors = [];
for (const [runtime, models] of Object.entries({ claude: ["haiku", "sonnet", "opus", "fable"], codex: ["luna", "terra", "sol", "astra"] })) {
  for (const model of models) {
    for (const effort of RANK) allAuthors.push({ runtime, model, effort, origin: "unit" });
    allAuthors.push({ runtime, model, effort: null, origin: "session", via: "session" });
  }
}
const avails = [
  { claude: "ok", codex: "ok" }, { claude: "quota", codex: "ok" }, { claude: "unreachable", codex: "ok" },
  { claude: "ok", codex: "quota" }, { claude: "ok", codex: "unreachable" }, { claude: "ok", codex: "at_capacity" },
  { claude: "quota", codex: "quota" },
];
for (const author of allAuthors) for (const kind of ["frd", "touch"]) for (const zone of ["none", "floor", "r1"]) {
  test(`restored review: ${author.runtime}/${author.model}/${author.effort ?? "session"} ${kind}/${zone}`, () => {
    for (const availability of avails) {
      const input = freeze({ authors: [author], kind, zone, availability, now });
      const copy = structuredClone(input), r = reviewCell(input);
      const exp = availability.claude === "quota" && availability.codex === "quota" ? null :
        expectedReview([author], zone, ["quota", "unreachable"].includes(availability.codex) ? "claude" : "codex");
      checkReview(r, exp); assert.deepEqual(r, reviewCell(input)); assert.deepEqual(input, copy);
    }
  });
}
test("restored review: mixed authors and their order cannot alter the risk-qualified reviewer", () => {
  for (const zone of ["none", "floor", "r1"]) for (const availability of avails) {
    const input = { authors: allAuthors, kind: "frd", zone, availability, now };
    assert.deepEqual(reviewCell(input), reviewCell({ ...input, authors: [...allAuthors].reverse() }));
  }
});
test("restored exhaustiveness: deep-frozen builder inputs; valid risk floor and transport", () => {
  let n = 0;
  for (const kind of ["docs", "tests", "build", "patch", "audit"]) for (const size of ["touch", "feature", "giant"]) for (const zone of ["none", "floor", "r1"]) for (const label of ["claude", "codex"]) for (const attempt of [1, 2, 3]) for (const reopen_count of [0, 1, 2]) for (const bounded of [false, true]) for (const [c, x] of [[20, 20], [100, 20], [20, 100]]) {
    const unit = freeze({ kind, size, bounded }), ctx = freeze({ label, zone, attempt, reopen_count, quota: quota(c, x), now });
    const snapshot = structuredClone({ unit, ctx }), a = builderCell(unit, ctx);
    const type = kind === "docs" ? "design" : kind === "audit" ? "review" : "implement";
    checkBuilder(a, expected(type, kind === "audit" ? "r1" : zone, x === 100 ? "claude" : c === 100 ? "codex" : type === "design" ? "claude" : "codex"));
    assert.deepEqual(a, builderCell(unit, ctx)); assert.deepEqual({ unit, ctx }, snapshot); n++;
  }
  assert.equal(n, 4860);
});
test("restored negative controls: catalog, runtime, effort, risk, transport and context checkers have teeth", () => {
  const b = build("build", "r1"), exp = ["codex", "astra", "high"];
  checkBuilder(b, exp);
  for (const change of [{ model: "fable" }, { model: "terra" }, { model: "unknown" }, { runtime: "claude" }, { effort: "max" }, { effort: null }, { model: "sol" }, { effort: "low" }, { via: "bad" }, { row: "old" }, { bumped: true }]) assert.throws(() => checkBuilder({ ...b, ...change }, exp));
  const input = { authors, kind: "frd", zone: "none" }, r = reviewCell(input), rexp = ["codex", "sol", "medium"];
  checkReview(r, rexp);
  for (const change of [{ independent_context: false }, { degraded: "same_model" }, { deferred: {} }, { parked: "no_reviewer" }, { primary: null }, { used: null }, { used: { ...r.used, model: "fable" } }, { used: { ...r.used, effort: "max" } }, { used: { ...r.used, model: "astra" } }]) assert.throws(() => checkReview({ ...r, ...change }, rexp));
  const waiting = reviewCell({ ...input, availability: quota(100, 100) }); checkReview(waiting, null);
  assert.throws(() => checkReview({ ...waiting, used: r.used }, null));
});
test("restored retry chains: previous effort/model/company never overrides role or safety floor", () => {
  for (const kind of ["docs", "tests", "build", "patch", "audit"]) for (const zone of ["none", "floor", "r1"]) for (const label of ["claude", "codex"]) {
    for (const previousCell of [null, { runtime: "claude", model: "opus", effort: "xhigh" }, { runtime: "claude", model: "sonnet", effort: "medium" }, { runtime: "codex", model: "sol", effort: "low" }, { runtime: "codex", model: "astra", effort: "high" }]) {
      for (const attempt of [1, 2, 3]) {
        const b = build(kind, zone, { label, previousCell, attempt, reopen_count: 2 });
        const type = kind === "docs" ? "design" : kind === "audit" ? "review" : "implement";
        checkBuilder(b, expected(type, kind === "audit" ? "r1" : zone, type === "design" ? "claude" : "codex"));
      }
    }
  }
});
test("restored input guards: review kinds/shapes/efforts/availability, consultation counters", () => {
  for (const change of [{ kind: "bad" }, { zone: "bad" }, { shape: "bad" }, { authors: null }, { authors: [{ model: "unknown" }] },
    { authors: [{ runtime: "codex", model: "sol", effort: "max" }] }, { availability: { claude: "bad" } }]) assert.throws(() => reviewCell({ authors, kind: "frd", zone: "none", ...change }));
  for (const consultNo of [0, -1, 1.5]) assert.throws(() => consultCell({ origin: "claude", consultNo }));
});
test("restored session capability: touch-only, first attempt, off floor and enabled same-runtime model", () => {
  const unit = { kind: "build", size: "touch", zone: "none" }, ctx = { coordinator: "codex-session", label: "codex", sessionModel: "sol" };
  assert.equal(sessionEligible(unit, ctx), true);
  for (const change of [{ kind: "patch" }, { size: "feature" }, { zone: "floor" }, { zone: "r1" }, { attempt: 2 }]) assert.equal(sessionEligible({ ...unit, ...change }, ctx), false);
  for (const change of [{ coordinator: "drive" }, { label: "claude" }, { sessionModel: "terra" }, { sessionModel: "opus" }, { sessionModel: "unknown" }]) assert.equal(sessionEligible(unit, { ...ctx, ...change }), false);
  assert.equal(sessionEligible(unit, { coordinator: "claude-session", label: "claude", sessionModel: "opus" }), true);
  assert.equal(sessionEligible(unit, { coordinator: "claude-session", label: "claude", sessionModel: "fable" }), false);
  const mismatch = builderCell(unit, { ...ctx, sessionModel: "astra" }); assert.equal(mismatch.via, "cli");
});
for (const origin of ["claude", "codex", "drive", "codex_app"]) for (const zone of ["none", "floor", "r1"]) test(`restored consult ${origin}/${zone}: capability, risk, deterministic and immutable`, () => {
  for (const consultNo of [1, 2]) for (const [c, x] of [[20, 20], [100, 20], [20, 100]]) {
    const input = freeze({ origin, consultNo, zone, availability: quota(c, x), now }), copy = structuredClone(input);
    const r = consultCell(input); wellFormed(r);
    assert.deepEqual(pick(r), expected("design", zone, c === 100 ? "codex" : "claude"));
    assert.deepEqual(r, consultCell(input)); assert.deepEqual(input, copy);
  }
  const waiting = consultCell({ origin, zone, consultNo: 2, availability: quota(100, 100), now });
  assert.equal(waiting.paused, "quota"); assert.equal(waiting.capacity.action, "wait");
  assert.ok(Number.isFinite(Date.parse(waiting.resumeAt)));
});

test("option B legacy complexity heuristic, explicit value wins, no data normal", () => {
  assert.equal(workOrderComplexity({}), "normal");
  for (const metadata of [{ difficulty: "high" }, { artifacts: Array.from({ length: 6 }, (_, i) => `src/a/${i}.ts`) },
    { acs: [1,2,3,4,5] }, { deps: [1,2,3] }, { artifacts: ["src/app/a.ts", "src/lib/b.ts", "src/components/c.ts"] },
    { source_requirements: ["REQ-01-001", "REQ-02-001"] }]) assert.equal(workOrderComplexity(metadata), "complex");
  assert.equal(workOrderComplexity({ difficulty: "low", artifacts: ["src/ui/hello.ts"], acs: ["AC-01-001.1"] }), "trivial");
  assert.equal(workOrderComplexity({ difficulty: "low", artifacts: ["src/**"] }), "normal");
  assert.equal(workOrderComplexity({ complexity: "trivial", difficulty: "high", acs: [1,2,3,4,5] }), "trivial");
  assert.equal(maxComplexity(["trivial", "complex"]), "complex");
  assert.throws(() => workOrderComplexity({ complexity: "huge" }));
});
const readWo = async frontmatter => readPlanWorkOrders("/virtual", { fs: {
  readdir: async p => p.endsWith("work-orders") ? ["wo-01-001-test.md"] : ["frd-01-test"],
  readFile: async p => p.endsWith("frd.md") ? "AC-01-001.1" : `---\nid: WO-01-001\nimplementation_status: PLANNED\n${frontmatter}\n---\nAC-01-001.1`,
} });
const explicit = await readWo("complexity: trivial\ndifficulty: high\nartifacts: [src/ui/hello.ts]");
const inferred = await readWo("difficulty: high\nartifacts: [src/ui/hello.ts]");
const legacy = await readWo("");
const invalid = await readWo("complexity: huge");
test("option B disk reader accepts complexity, legacy fallback and rejects invalid enum", () => {
  assert.equal(explicit.wos[0].complexity, "trivial"); assert.equal(inferred.wos[0].complexity, "complex");
  assert.equal(legacy.wos[0].complexity, "normal"); assert.match(invalid.errors[0].reason, /complexity/);
  const result = plan({ wos: explicit.wos, scope: { frds: ["frd-01-test"] }, label: "codex" });
  assert.equal(result.units.find(u => u.kind === "build").complexity, "trivial");
});
test("option B actual author review and legacy null-effort wake match dispatch", () => {
  for (const author of [{ runtime: "codex", model: "sol", effort: "medium" }, { runtime: "codex", model: "sol", effort: null },
    { runtime: "codex", model: "terra", effort: "low" }]) {
    const unit = { id: "review", kind: "review", frd: "frd", wos: ["wo"], zone: "none" };
    const state = { units: [unit, { id: "build", kind: "build", state: "reviewing", frd: "frd", wos: ["wo"], complexity: "normal", worker: author }] };
    const task = capacityTaskForUnit(unit, state);
    const selected = decide({ task, readings: quota(95, 39).readings, now });
    const review = reviewCell({ authors: [author], kind: "frd", zone: "none", quota: quota(95, 39), now });
    assert.deepEqual(selected.pin, review.capacity.pin);
    assert.notDeepEqual([selected.tool, selected.model, selected.effort], [author.runtime, author.model, author.effort]);
  }
});
console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
