#!/usr/bin/env node
// Routing table test for plugin/runtime/build/routing.mjs (PLAN B04 / T-B04, BUILD-10, D11, D12, D13, A12).
//
// Two layers, on purpose:
//   1. HAND TABLES written from the standard (factory/standards/build-engine.md BUILD-10) and the owner's
//      rule, NOT derived from plugin/runtime/model-tiers.json. If the data file or the code drifts from the
//      owner's rule, these fail. Builder rows, the 16 review-matrix rows x availability, the owner's named
//      cases, the no-repeat rule, the quota switch and the doubt-consult cells are pinned here.
//   2. EXHAUSTIVE INVARIANTS over every input (all builder kinds/sizes/zones/reopen/attempt/bounded/label/quota;
//      all review authors x effort x origin x kind x zone x availability): exactly one cell per input, never
//      Fable, never a disabled/unknown model, never effort above xhigh, the primary reviewer is never from the
//      author's company, same-model review only by N7 on quota, unreachable never same-model, no company switch
//      on repeat, builder quota switch = the other company's column of the same row. The invariant checker has
//      negative controls (it must flag deliberately wrong results).
//
// ASSUMED INTERFACE (the docs give names and argument names, not every value shape; the orchestrator reconciles):
//   * Module: plugin/runtime/build/routing.mjs, named exports `builderCell`, `reviewCell`, `consultCell`
//     (PLAN 3.8, CLI doc 8.3), all synchronous, pure, never mutating their arguments (inputs are deep-frozen here).
//   * builderCell(unit, {label, zone, reopen_count, attempt, previousCell, quota, shape})
//       unit          = {id, kind: docs|tests|build|patch|audit, size: touch|feature|giant, bounded: boolean}
//                       (bounded is the already-computed "patch <=30 lines, off-floor, with a test" fact).
//       label         = "claude" | "codex";  zone = "none" | "floor" | "r1";  reopen_count, attempt: integers;
//       previousCell  = {runtime, model, effort} of the previous execution of the same unit, or null;
//       quota         = {claude: "ok"|"quota", codex: "ok"|"quota"}  ("quota" = at or above 90 % / usage_limit);
//       shape         = not passed by this test (drive-specific builder behaviour is not pinned: no doc value).
//       returns {runtime, model, effort[, agent]}; only the three fields are compared.
//     Not pinned (no contract value): both companies out of quota (paused-quota), and the `audit` row while
//     Claude is out of quota (deferred, BUILD-10): those inputs are skipped. An unknown kind must throw or
//     return something that is not a cell.
//   * reviewCell({authors, kind, zone, availability}) -> {primary, used, degraded, deferred, parked}
//       authors[]     = [{runtime, model, effort, origin?, via?}] ; a session-written unit is
//                       {runtime, model, effort: null, origin: "session", via: "session"} (A12; both markers are
//                       sent so either convention works); null effort is treated as "high" by the routing.
//       kind          = "frd" | "touch";  availability = {claude: ok|quota|unreachable, codex: ok|quota|unreachable|at_capacity}
//       primary       = the matrix cell regardless of availability; used = the cell that actually reviews;
//       parked        = null | "no_reviewer" and then `used` is null/undefined; deferred = null when not degraded,
//                       else {needed: <runtime of primary>, reviewer: <primary>}.
//       Both companies non-ok at once is not enumerated (no contract value). Mixed-author diffs: only the
//       strictest-row case that BUILD-10 states is asserted.
//   * consultCell({origin, consultNo}) -> {runtime, model, effort}; origin claude|codex|drive|codex_app, consultNo 1|2.
//     For drive and codex_app consult 2 is "park" (BUILD-12: consult astra high, then park): throw, null or a non-cell.
//
// Run: node plugin/scripts/test-build-v2-routing.mjs   (offline, no fixtures, no fs writes, < 2 s)
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message || e}`);
    failed++;
  }
};
const ok = (value, message) => {
  if (!value) throw new Error(message);
};
const eq = (actual, expected, message) => {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
};
const deepFreeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
const failList = (title, list) => {
  if (list.length) throw new Error(`${title}: ${list.length} violation(s), first ${Math.min(list.length, 8)}:\n    - ${list.slice(0, 8).join("\n    - ")}`);
};

// ---------------------------------------------------------------------------------------------------- loading
const DATA = JSON.parse(readFileSync(new URL("../runtime/model-tiers.json", import.meta.url), "utf8"));
let R = null;
let loadError = null;
try {
  R = await import(new URL("../runtime/build/routing.mjs", import.meta.url).href);
} catch (e) {
  loadError = e;
}
const fn = (name) => {
  if (!R) throw new Error(`plugin/runtime/build/routing.mjs could not be loaded: ${loadError?.code || ""} ${loadError?.message || loadError}`);
  if (typeof R[name] !== "function") throw new Error(`routing.mjs does not export a function named ${name}`);
  return R[name];
};

// ---------------------------------------------------------------------------------------------------- vocab
const RANK = ["minimal", "low", "medium", "high", "xhigh"];
const CLAUDE_MODELS = ["haiku", "sonnet", "opus", "fable"];
const CODEX_MODELS = ["luna", "terra", "sol", "astra"];
const companyOf = (model) => (CLAUDE_MODELS.includes(model) ? "claude" : "codex");
const ZONES = ["none", "floor", "r1"];
const KINDS = ["frd", "touch"];
const nextCapped = (effort) => RANK[Math.min(RANK.indexOf(effort === "max" ? "xhigh" : (effort ?? "high")) + 1, RANK.indexOf("xhigh"))];
const bumped = (effort) => RANK[Math.min(RANK.indexOf(effort) + 1, RANK.indexOf("xhigh"))];
const triplet = (c) => (c && typeof c === "object" ? `${c.runtime}/${c.model}/${c.effort}` : String(c));
const cellOf = (s) => {
  const [runtime, model, effort] = s.split("/");
  return { runtime, model, effort };
};

// ---------------------------------------------------------------------------------------------------- call wrappers
const QUOTA = {
  ok: { claude: "ok", codex: "ok" },
  claude_out: { claude: "quota", codex: "ok" },
  codex_out: { claude: "ok", codex: "quota" },
};
const callBuilder = (unit, o = {}) =>
  fn("builderCell")(
    deepFreeze({ id: "u-test", size: "touch", bounded: false, ...unit }),
    deepFreeze({
      label: o.label,
      zone: o.zone ?? "none",
      reopen_count: o.reopen_count ?? 0,
      attempt: o.attempt ?? 1,
      previousCell: o.previousCell ?? null,
      quota: o.quota ?? QUOTA.ok,
    }),
  );
const mkAuthor = (runtime, model, effort, session = false) =>
  session ? { runtime, model, effort: null, origin: "session", via: "session" } : { runtime, model, effort, origin: "unit" };
const callReview = (authors, kind, zone, availability) =>
  fn("reviewCell")(deepFreeze({ authors: Array.isArray(authors) ? authors : [authors], kind, zone, availability: { ...availability } }));
const callConsult = (origin, consultNo) => fn("consultCell")(deepFreeze({ origin, consultNo }));

// ============================================================================================ 0. data-file sanity
await test("model-tiers.json v2 keeps the guard rails the invariants rely on", () => {
  eq(DATA.version, 2, "model-tiers version");
  ok(DATA.disabled.includes("terra") && DATA.disabled.includes("fable"), "terra and fable must be disabled");
  ok(DATA.never_emit.models.includes("fable"), "fable must be in never_emit.models");
  ok(DATA.never_emit.efforts.includes("max"), "max must be in never_emit.efforts");
  eq(JSON.stringify(DATA.effort_rank), JSON.stringify(RANK), "effort_rank");
  ok(typeof R?.builderCell === "function" && typeof R?.reviewCell === "function" && typeof R?.consultCell === "function",
    `routing.mjs must export builderCell, reviewCell, consultCell (${R ? Object.keys(R).join(", ") : `load error: ${loadError?.message}`})`);
});

// ============================================================================================ 1. builder: hand table
// [name, unit, opts, expected claude-label cell, expected codex-label cell]  (BUILD-10 "Builder routing", first match wins)
const SONNET_M = "claude/sonnet/medium";
const SONNET_H = "claude/sonnet/high";
const OPUS_H = "claude/opus/high";
const OPUS_X = "claude/opus/xhigh";
const SOL_L = "codex/sol/low";
const SOL_M = "codex/sol/medium";
const SOL_H = "codex/sol/high";
const ASTRA_H = "codex/astra/high";
const BUILDER_CASES = [
  ["docs touch", { kind: "docs", size: "touch" }, {}, SONNET_M, SOL_L],
  ["docs feature (plan)", { kind: "docs", size: "feature" }, {}, OPUS_H, SOL_H],
  ["docs giant (plan)", { kind: "docs", size: "giant" }, {}, OPUS_H, SOL_H],
  ["docs touch ignores the zone", { kind: "docs", size: "touch" }, { zone: "r1" }, SONNET_M, SOL_L],
  ["docs touch at attempt 3 is not an escalation", { kind: "docs", size: "touch" }, { attempt: 3 }, SONNET_M, SOL_L],
  ["tests, zone none (bug card)", { kind: "tests" }, { zone: "none" }, SONNET_H, SOL_M],
  ["tests, zone floor", { kind: "tests" }, { zone: "floor" }, SONNET_H, SOL_M],
  ["tests, zone r1", { kind: "tests" }, { zone: "r1" }, SONNET_H, SOL_M],
  ["build default", { kind: "build" }, { zone: "none" }, SONNET_M, SOL_L],
  ["build default, feature-sized unit", { kind: "build", size: "feature" }, { zone: "none" }, SONNET_M, SOL_L],
  ["build attempt 2 is still the default row", { kind: "build" }, { zone: "none", attempt: 2 }, SONNET_M, SOL_L],
  ["build in zone floor", { kind: "build" }, { zone: "floor" }, SONNET_H, SOL_M],
  ["build in zone r1", { kind: "build" }, { zone: "r1" }, SONNET_H, SOL_M],
  ["build reopen_count 1", { kind: "build" }, { reopen_count: 1 }, OPUS_H, SOL_H],
  ["build reopen_count 2", { kind: "build" }, { reopen_count: 2 }, OPUS_H, SOL_H],
  ["build reopen beats the zone row", { kind: "build" }, { reopen_count: 1, zone: "r1" }, OPUS_H, SOL_H],
  ["build attempt 3 (escalation)", { kind: "build" }, { attempt: 3 }, OPUS_X, ASTRA_H],
  ["build attempt 3 beats reopen and zone", { kind: "build" }, { attempt: 3, reopen_count: 2, zone: "r1" }, OPUS_X, ASTRA_H],
  ["patch bounded", { kind: "patch", bounded: true }, {}, SONNET_H, SOL_M],
  ["patch unbounded", { kind: "patch", bounded: false }, {}, OPUS_H, SOL_H],
  ["patch ignores reopen_count (build only)", { kind: "patch", bounded: true }, { reopen_count: 2 }, SONNET_H, SOL_M],
  ["patch bounded attempt 3 (escalation)", { kind: "patch", bounded: true }, { attempt: 3 }, OPUS_X, ASTRA_H],
  ["patch unbounded attempt 3 (escalation)", { kind: "patch", bounded: false }, { attempt: 3 }, OPUS_X, ASTRA_H],
  ["audit is Claude opus high under both labels", { kind: "audit" }, {}, OPUS_H, OPUS_H],
];
for (const [name, unit, opts, claudeCell, codexCell] of BUILDER_CASES) {
  await test(`builder row: ${name}`, () => {
    eq(triplet(callBuilder(unit, { ...opts, label: "claude" })), claudeCell, "label claude");
    eq(triplet(callBuilder(unit, { ...opts, label: "codex" })), codexCell, "label codex");
  });
}

// ============================================================================================ 2. builder: quota switch
await test("quota switch: label claude, Claude out of quota -> the Codex column of the same row", () => {
  const cases = [
    [{ kind: "build" }, {}, SOL_L],
    [{ kind: "build" }, { zone: "floor" }, SOL_M],
    [{ kind: "docs", size: "feature" }, {}, SOL_H],
    [{ kind: "tests" }, {}, SOL_M],
    [{ kind: "patch", bounded: false }, {}, SOL_H],
    [{ kind: "build" }, { attempt: 3 }, ASTRA_H],
    [{ kind: "build" }, { reopen_count: 1 }, SOL_H],
  ];
  for (const [unit, opts, expected] of cases) {
    eq(triplet(callBuilder(unit, { ...opts, label: "claude", quota: QUOTA.claude_out })), expected, `${unit.kind} ${JSON.stringify(opts)}`);
  }
});
await test("quota switch: label codex, Codex out of quota -> the Claude column of the same row", () => {
  const cases = [
    [{ kind: "build" }, {}, SONNET_M],
    [{ kind: "build" }, { zone: "r1" }, SONNET_H],
    [{ kind: "docs", size: "touch" }, {}, SONNET_M],
    [{ kind: "tests" }, {}, SONNET_H],
    [{ kind: "patch", bounded: false }, {}, OPUS_H],
    [{ kind: "build" }, { attempt: 3 }, OPUS_X],
    [{ kind: "audit" }, {}, OPUS_H],
  ];
  for (const [unit, opts, expected] of cases) {
    eq(triplet(callBuilder(unit, { ...opts, label: "codex", quota: QUOTA.codex_out })), expected, `${unit.kind} ${JSON.stringify(opts)}`);
  }
});
await test("quota of the company that is NOT the label's changes nothing", () => {
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", quota: QUOTA.codex_out })), SONNET_M, "claude label, Codex out");
  eq(triplet(callBuilder({ kind: "build" }, { label: "codex", quota: QUOTA.claude_out })), SOL_L, "codex label, Claude out");
});

// ============================================================================================ 3. builder: no repeat
await test("no repeat: the same (model, effort) again raises effort one step, same model, same company", () => {
  const cases = [
    ["claude", { kind: "build" }, {}, SONNET_M, SONNET_H],
    ["claude", { kind: "build" }, { zone: "floor" }, SONNET_H, "claude/sonnet/xhigh"],
    ["claude", { kind: "docs", size: "feature" }, {}, OPUS_H, OPUS_X],
    ["codex", { kind: "build" }, {}, SOL_L, SOL_M],
    ["codex", { kind: "build" }, { zone: "floor" }, SOL_M, SOL_H],
    ["codex", { kind: "docs", size: "feature" }, {}, SOL_H, "codex/sol/xhigh"],
  ];
  for (const [label, unit, opts, previous, expected] of cases) {
    const cell = callBuilder(unit, { ...opts, label, attempt: 2, previousCell: cellOf(previous) });
    eq(triplet(cell), expected, `${label} ${unit.kind} ${JSON.stringify(opts)} after ${previous}`);
  }
});
await test("no repeat: capped at xhigh (never max), and never a company switch", () => {
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", attempt: 3, previousCell: cellOf(OPUS_X) })), OPUS_X, "claude escalation repeated");
  eq(triplet(callBuilder({ kind: "build" }, { label: "codex", attempt: 3, previousCell: cellOf(ASTRA_H) })), "codex/astra/xhigh", "codex escalation repeated");
  eq(triplet(callBuilder({ kind: "docs", size: "feature" }, { label: "claude", attempt: 2, previousCell: cellOf(OPUS_X) })), OPUS_H, "a previous that differs from the row is not a repeat");
});
await test("no repeat: only an EXACT repeat bumps (different effort, model or company is not a repeat)", () => {
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", attempt: 2, previousCell: cellOf(SONNET_H) })), SONNET_M, "previous sonnet high vs row sonnet medium");
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", attempt: 2, previousCell: cellOf(OPUS_H) })), SONNET_M, "previous opus");
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", attempt: 2, previousCell: cellOf(SOL_L), quota: QUOTA.ok })), SONNET_M, "previous was the other company");
});
await test("no repeat + quota switch: a switch to the other company is not a repeat of the old company's cell", () => {
  eq(triplet(callBuilder({ kind: "build" }, { label: "claude", attempt: 2, previousCell: cellOf(SONNET_M), quota: QUOTA.claude_out })), SOL_L, "claude out after a sonnet medium run");
  eq(triplet(callBuilder({ kind: "build" }, { label: "codex", attempt: 2, previousCell: cellOf(SOL_L), quota: QUOTA.codex_out })), SONNET_M, "codex out after a sol low run");
});
await test("no repeat: a Claude-labelled unit's whole retry chain never leaves Claude (escalation included)", () => {
  for (const unit of [{ kind: "build" }, { kind: "patch", bounded: true }, { kind: "patch", bounded: false }, { kind: "docs", size: "touch" }, { kind: "tests" }]) {
    let previous = null;
    for (const attempt of [1, 2, 3, 3]) {
      const cell = callBuilder(unit, { label: "claude", attempt, previousCell: previous });
      eq(cell.runtime, "claude", `${unit.kind} attempt ${attempt} switched company`);
      previous = cell;
    }
  }
});
await test("no repeat: a Codex-labelled unit's whole retry chain stays in Codex (audit excepted)", () => {
  for (const unit of [{ kind: "build" }, { kind: "patch", bounded: true }, { kind: "docs", size: "feature" }, { kind: "tests" }]) {
    let previous = null;
    for (const attempt of [1, 2, 3, 3]) {
      const cell = callBuilder(unit, { label: "codex", attempt, previousCell: previous });
      eq(cell.runtime, "codex", `${unit.kind} attempt ${attempt} switched company`);
      previous = cell;
    }
  }
});

// ============================================================================================ 4. builder: unknown kind fails loud
await test("an unknown unit kind never yields a cell (throws or returns a non-cell)", () => {
  let result;
  try {
    result = callBuilder({ kind: "wat" }, { label: "claude" });
  } catch {
    return;
  }
  ok(!(result && typeof result === "object" && result.model), `unknown kind produced a cell: ${JSON.stringify(result)}`);
});

// ============================================================================================ 5. builder: exhaustive
const BUILDER_KINDS = ["docs", "tests", "build", "patch", "audit"];
const BUILDER_MODELS = ["sonnet", "opus", "sol", "astra"]; // A12: routed cells are only these four
function* builderInputs() {
  for (const kind of BUILDER_KINDS) for (const size of ["touch", "feature", "giant"]) for (const zone of ZONES)
    for (const reopen_count of [0, 1, 2]) for (const attempt of [1, 2, 3]) for (const bounded of [true, false])
      for (const label of ["claude", "codex"]) for (const quotaName of ["ok", "claude_out", "codex_out"])
        yield { unit: { kind, size, bounded }, o: { label, zone, reopen_count, attempt, quota: QUOTA[quotaName] }, quotaName, tag: JSON.stringify({ kind, size, bounded, label, zone, reopen_count, attempt, quotaName }) };
}
const skipAudit = (x) => x.unit.kind === "audit" && x.quotaName === "claude_out"; // deferred under Claude out: no contract cell
const wellFormed = (cell, allowedModels) => {
  const v = [];
  if (!cell || typeof cell !== "object" || Array.isArray(cell)) return ["not a single cell object"];
  if (!allowedModels.includes(cell.model)) v.push(`model ${cell.model} not in ${allowedModels}`);
  if (cell.model === "fable" || DATA.disabled.includes(cell.model)) v.push(`forbidden model ${cell.model}`);
  if (!["claude", "codex"].includes(cell.runtime) || companyOf(cell.model) !== cell.runtime) v.push(`runtime ${cell.runtime} does not match model ${cell.model}`);
  if (!RANK.includes(cell.effort)) v.push(`effort ${cell.effort} not in ${RANK} (max/ultra/null are never emitted by routed cells)`);
  return v;
};
await test("builder exhaustive: every input gives exactly one well-formed cell (no fable, no disabled/unknown model, no max)", () => {
  const bad = [];
  let n = 0;
  for (const x of builderInputs()) {
    if (skipAudit(x)) continue;
    n++;
    let cell;
    try { cell = callBuilder(x.unit, x.o); } catch (e) { bad.push(`${x.tag}: threw ${e.message}`); continue; }
    for (const m of wellFormed(cell, BUILDER_MODELS)) bad.push(`${x.tag}: ${m}`);
  }
  ok(n > 4000, `enumerated only ${n} builder inputs`);
  failList("builder cells", bad);
});
await test("builder exhaustive: with quota ok the label's company builds (only audit is always Claude)", () => {
  const bad = [];
  for (const x of builderInputs()) {
    if (x.quotaName !== "ok") continue;
    const cell = callBuilder(x.unit, x.o);
    const expectedCompany = x.unit.kind === "audit" ? "claude" : x.o.label;
    if (cell.runtime !== expectedCompany) bad.push(`${x.tag}: runtime ${cell.runtime}, expected ${expectedCompany}`);
  }
  failList("label company", bad);
});
await test("builder exhaustive: quota switch = the other company's column of the same row", () => {
  const bad = [];
  for (const x of builderInputs()) {
    if (x.quotaName === "ok" || skipAudit(x)) continue;
    const labelOut = (x.o.label === "claude") === (x.quotaName === "claude_out");
    if (!labelOut) { // the other company is out: nothing changes
      if (triplet(callBuilder(x.unit, x.o)) !== triplet(callBuilder(x.unit, { ...x.o, quota: QUOTA.ok }))) bad.push(`${x.tag}: the unrelated company's quota changed the cell`);
      continue;
    }
    const other = x.o.label === "claude" ? "codex" : "claude";
    const switched = callBuilder(x.unit, x.o);
    const column = callBuilder(x.unit, { ...x.o, label: other, quota: QUOTA.ok });
    if (triplet(switched) !== triplet(column)) bad.push(`${x.tag}: switched ${triplet(switched)} != ${other} column ${triplet(column)}`);
  }
  failList("quota switch", bad);
});
await test("builder exhaustive: an exact repeat raises effort one step (cap xhigh), same model, same company, never max", () => {
  const bad = [];
  for (const x of builderInputs()) {
    if (x.o.attempt < 2 || skipAudit(x)) continue;
    const base = callBuilder(x.unit, x.o);
    const again = callBuilder(x.unit, { ...x.o, previousCell: base });
    if (again.runtime !== base.runtime || again.model !== base.model) bad.push(`${x.tag}: repeat switched ${triplet(base)} -> ${triplet(again)}`);
    if (again.effort !== bumped(base.effort)) bad.push(`${x.tag}: repeat of ${triplet(base)} gave effort ${again.effort}, expected ${bumped(base.effort)}`);
    if (again.effort === "max") bad.push(`${x.tag}: max emitted`);
    const stale = { ...base, effort: base.effort === "minimal" ? "low" : "minimal" };
    if (triplet(callBuilder(x.unit, { ...x.o, previousCell: stale })) !== triplet(base)) bad.push(`${x.tag}: a non-identical previousCell changed the cell`);
  }
  failList("no-repeat", bad);
});
await test("builder exhaustive: routing is deterministic and does not mutate its inputs", () => {
  const bad = [];
  for (const x of builderInputs()) {
    if (skipAudit(x)) continue;
    if (triplet(callBuilder(x.unit, x.o)) !== triplet(callBuilder(x.unit, x.o))) bad.push(x.tag);
  }
  failList("determinism", bad);
});

// ============================================================================================ 6. review: hand table
// expectation string: "runtime/model/effort" optionally "|degraded", or "PARK". Primary is the `ok` cell.
const claude = (model, effort) => mkAuthor("claude", model, effort);
const codex = (model, effort) => mkAuthor("codex", model, effort);
const session = (runtime, model) => mkAuthor(runtime, model, null, true);
const label = (a) => `${a.runtime} ${a.model}${a.effort ? ` ${a.effort}` : " session"}`;

const ROWS = [];
const row = (n, authors, kinds, zones, exp) => ROWS.push({ n, authors, kinds, zones, exp });
const SONNETS = ["minimal", "medium", "high", "xhigh"].map((e) => claude("sonnet", e)).concat([claude("haiku", "medium")]);
row(1, SONNETS, ["frd"], ["none"], { ok: "codex/sol/high", quota: "claude/opus/high|quota_90", unreachable: "claude/opus/high|unreachable", at_capacity: "codex/astra/high|at_capacity" });
row(2, SONNETS, ["touch"], ["none"], { ok: "codex/sol/medium", quota: "claude/opus/high|quota_90", unreachable: "claude/opus/high|unreachable", at_capacity: "codex/astra/high|at_capacity" });
row(3, SONNETS, ["frd", "touch"], ["floor"], { ok: "codex/sol/high", quota: "claude/opus/xhigh|quota_90", unreachable: "claude/opus/xhigh|unreachable", at_capacity: "codex/astra/high|at_capacity" });
row(4, SONNETS, ["frd", "touch"], ["r1"], { ok: "codex/astra/high", quota: "claude/opus/xhigh|quota_90", unreachable: "claude/opus/xhigh|unreachable", at_capacity: "codex/astra/high" });
row(5, [claude("opus", "high"), claude("opus", "medium")], ["frd", "touch"], ["none", "floor"], { ok: "codex/sol/high", quota: `claude/opus/${"XEFF"}|same_model`, unreachable: "PARK", at_capacity: "codex/astra/high|at_capacity" });
row(6, [claude("opus", "high")], ["frd", "touch"], ["r1"], { ok: "codex/astra/high", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high" });
row(7, [claude("opus", "xhigh")], ["frd", "touch"], ["none", "floor"], { ok: "codex/sol/high", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high|at_capacity" });
row(7, [claude("opus", "xhigh")], ["frd", "touch"], ["r1"], { ok: "codex/astra/high", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high" });
row(8, [session("claude", "sonnet"), session("claude", "haiku")], ["touch"], ["none"], { ok: "codex/sol/medium", quota: "claude/opus/high|quota_90", unreachable: "claude/opus/high|unreachable", at_capacity: "codex/astra/high|at_capacity" });
row(8, [session("claude", "opus")], ["touch"], ["none"], { ok: "codex/sol/medium", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high|at_capacity" });
row(8, [session("claude", "fable")], ["touch"], ["none"], { ok: "codex/astra/high", quota: "PARK", unreachable: "PARK", at_capacity: "codex/astra/high" });
row(8, [session("claude", "sonnet"), session("claude", "haiku")], ["touch"], ["floor"], { ok: "codex/sol/high", quota: "claude/opus/xhigh|quota_90", unreachable: "claude/opus/xhigh|unreachable", at_capacity: "codex/astra/high|at_capacity" });
row(8, [session("claude", "sonnet")], ["touch"], ["r1"], { ok: "codex/astra/high", quota: "claude/opus/xhigh|quota_90", unreachable: "claude/opus/xhigh|unreachable", at_capacity: "codex/astra/high" });
row(8, [session("claude", "opus")], ["touch"], ["floor"], { ok: "codex/sol/high", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high|at_capacity" });
row(8, [session("claude", "opus")], ["touch"], ["r1"], { ok: "codex/astra/high", quota: "claude/opus/xhigh|same_model", unreachable: "PARK", at_capacity: "codex/astra/high" });
const CODEX_FALLBACK = { quota: "codex/astra/high|quota_90", unreachable: "codex/astra/high|unreachable" };
row(9, [codex("sol", "high"), codex("luna", "low")], ["frd"], ["none"], { ok: "claude/opus/high", ...CODEX_FALLBACK, at_capacity: "claude/opus/high" });
row(10, [codex("sol", "medium"), codex("luna", "low")], ["touch"], ["none"], { ok: "claude/opus/medium", ...CODEX_FALLBACK, at_capacity: "claude/opus/medium" });
row(11, [codex("sol", "high"), codex("luna", "low")], ["frd", "touch"], ["floor", "r1"], { ok: "claude/opus/xhigh", ...CODEX_FALLBACK, at_capacity: "claude/opus/xhigh" });
row(12, [codex("astra", "high")], ["frd", "touch"], ["none"], { ok: "claude/opus/high", quota: "codex/astra/xhigh|same_model", unreachable: "codex/astra/xhigh|same_model", at_capacity: "claude/opus/high" });
row(13, [codex("astra", "high")], ["frd", "touch"], ["floor", "r1"], { ok: "claude/opus/xhigh", quota: "PARK", unreachable: "PARK", at_capacity: "claude/opus/xhigh" });
row(14, [codex("terra", "high")], ["frd"], ["none"], { ok: "claude/opus/high", quota: "codex/sol/high|quota_90", unreachable: "codex/sol/high|unreachable", at_capacity: "claude/opus/high" });
row(14, [codex("terra", "high")], ["touch"], ["none"], { ok: "claude/opus/medium", quota: "codex/sol/high|quota_90", unreachable: "codex/sol/high|unreachable", at_capacity: "claude/opus/medium" });
row(14, [codex("terra", "high")], ["frd", "touch"], ["floor", "r1"], { ok: "claude/opus/xhigh", quota: "codex/sol/high|quota_90", unreachable: "codex/sol/high|unreachable", at_capacity: "claude/opus/xhigh" });
row(15, [session("codex", "luna"), session("codex", "sol")], ["touch"], ["none"], { ok: "claude/opus/medium", ...CODEX_FALLBACK, at_capacity: "claude/opus/medium" });
row(15, [session("codex", "terra")], ["touch"], ["none"], { ok: "claude/opus/medium", quota: "codex/sol/high|quota_90", unreachable: "codex/sol/high|unreachable", at_capacity: "claude/opus/medium" });
row(15, [session("codex", "astra")], ["touch"], ["none"], { ok: "claude/opus/medium", quota: "codex/astra/xhigh|same_model", unreachable: "codex/astra/xhigh|same_model", at_capacity: "claude/opus/medium" });
row(15, [session("codex", "sol")], ["touch"], ["floor", "r1"], { ok: "claude/opus/xhigh", ...CODEX_FALLBACK, at_capacity: "claude/opus/xhigh" });
row(16, [claude("fable", "high"), session("claude", "fable")], ["frd", "touch"], ["none", "floor", "r1"], { ok: "codex/astra/high", quota: "PARK", unreachable: "PARK", at_capacity: "codex/astra/high" });

const availFor = (author, which) => {
  const other = author.runtime === "claude" ? "codex" : "claude";
  const a = { claude: "ok", codex: "ok" };
  if (which === "ok") return a;
  if (which === "at_capacity") return { ...a, codex: "at_capacity" };
  a[other] = which;
  return a;
};
const checkExpectation = (r, exp, expPrimary) => {
  eq(triplet(r.primary), expPrimary, "primary");
  if (exp === "PARK") {
    eq(r.parked, "no_reviewer", "parked");
    ok(!r.used, `parked review still has a reviewer: ${triplet(r.used)}`);
    return;
  }
  const [cellStr, degraded = null] = exp.split("|");
  eq(triplet(r.used), cellStr, "used reviewer");
  eq(r.degraded ?? null, degraded, "degraded");
  ok((r.parked ?? null) === null, `unexpected parked=${r.parked}`);
  if (degraded) {
    ok(r.deferred && r.deferred.needed === r.primary.runtime && triplet(r.deferred.reviewer) === triplet(r.primary),
      `degraded review must queue a deferred re-review for ${triplet(r.primary)}, got ${JSON.stringify(r.deferred)}`);
  } else {
    ok(r.deferred === null || r.deferred === undefined, `non-degraded review has deferred ${JSON.stringify(r.deferred)}`);
  }
};
for (const spec of ROWS) {
  for (const author of spec.authors) {
    for (const kind of spec.kinds) for (const zone of spec.zones) {
      await test(`review row ${spec.n}: ${label(author)} ${kind}/${zone}`, () => {
        for (const which of ["ok", "quota", "unreachable", "at_capacity"]) {
          let exp = spec.exp[which];
          if (exp.includes("XEFF")) exp = exp.replace("XEFF", nextCapped(author.effort));
          const r = callReview(author, kind, zone, availFor(author, which));
          try {
            checkExpectation(r, exp, spec.exp.ok.split("|")[0]);
          } catch (e) {
            throw new Error(`[${which}] ${e.message}`);
          }
        }
      });
    }
  }
}
await test("review hand table covers all 16 matrix rows", () => {
  const seen = new Set(ROWS.map((r) => r.n));
  for (let n = 1; n <= 16; n++) ok(seen.has(n), `row ${n} is not pinned by the hand table`);
});

// ============================================================================================ 7. review: owner's rule, in words
const OWNER_RULES = [
  ["Sonnet-built whole-FRD review -> Sol high", claude("sonnet", "medium"), "frd", "none", "ok", "codex/sol/high"],
  ["small change built by Sonnet -> Sol medium", claude("sonnet", "medium"), "touch", "none", "ok", "codex/sol/medium"],
  ["risk core (r1) built by Claude -> Astra high", claude("sonnet", "high"), "frd", "r1", "ok", "codex/astra/high"],
  ["risk core (r1) built by Claude Opus -> Astra high", claude("opus", "high"), "frd", "r1", "ok", "codex/astra/high"],
  ["rest of the floor built by Claude -> Sol high", claude("sonnet", "high"), "frd", "floor", "ok", "codex/sol/high"],
  ["rest of the floor built by Claude Opus -> Sol high", claude("opus", "high"), "touch", "floor", "ok", "codex/sol/high"],
  ["Codex-built whole FRD -> Opus high", codex("sol", "high"), "frd", "none", "ok", "claude/opus/high"],
  ["Codex-built small change -> Opus medium", codex("sol", "medium"), "touch", "none", "ok", "claude/opus/medium"],
  ["Codex-built risk core (r1) -> Opus xhigh", codex("sol", "high"), "frd", "r1", "ok", "claude/opus/xhigh"],
  ["Codex-built rest of the floor -> Opus xhigh", codex("sol", "high"), "frd", "floor", "ok", "claude/opus/xhigh"],
  ["no Codex quota and Sonnet wrote -> Opus", claude("sonnet", "medium"), "frd", "none", "quota", "claude/opus/high|quota_90"],
  ["no Codex quota and Opus (high) wrote -> Opus at the next effort, degraded same_model", claude("opus", "high"), "frd", "none", "quota", "claude/opus/xhigh|same_model"],
  ["no Codex quota and Opus xhigh wrote -> Opus xhigh again (cap), degraded same_model", claude("opus", "xhigh"), "frd", "floor", "quota", "claude/opus/xhigh|same_model"],
  ["Codex unreachable and Opus wrote -> park, never the same model", claude("opus", "high"), "frd", "none", "unreachable", "PARK"],
  ["Codex unreachable and Opus wrote in the risk core -> park", claude("opus", "high"), "touch", "r1", "unreachable", "PARK"],
  ["Codex unreachable and Sonnet wrote -> Opus, degraded unreachable", claude("sonnet", "high"), "frd", "none", "unreachable", "claude/opus/high|unreachable"],
  ["no Claude (quota) -> Astra reviews Codex-built work", codex("sol", "high"), "frd", "none", "quota", "codex/astra/high|quota_90"],
  ["no Claude (unreachable) -> Astra reviews Codex-built work", codex("sol", "high"), "frd", "none", "unreachable", "codex/astra/high|unreachable"],
  ["no Claude and Astra built in the risk zone -> park (Astra never reviews Astra there)", codex("astra", "high"), "frd", "r1", "quota", "PARK"],
  ["no Claude and Astra built in the floor -> park", codex("astra", "high"), "touch", "floor", "unreachable", "PARK"],
  ["no Claude and Astra built outside the risk zone -> Astra xhigh in a fresh context (N7 analog)", codex("astra", "high"), "frd", "none", "quota", "codex/astra/xhigh|same_model"],
  ["Fable session -> Astra high, never Fable", session("claude", "fable"), "touch", "none", "ok", "codex/astra/high"],
  ["Fable session and Codex out -> park (never Opus, never a lower Claude)", session("claude", "fable"), "touch", "none", "quota", "PARK"],
  ["Haiku session behaves as the Sonnet touch row", session("claude", "haiku"), "touch", "none", "ok", "codex/sol/medium"],
  ["Opus session, small change -> Sol medium; on quota its review is Opus xhigh (null effort = high)", session("claude", "opus"), "touch", "none", "quota", "claude/opus/xhigh|same_model"],
];
for (const [name, author, kind, zone, which, exp] of OWNER_RULES) {
  await test(`owner rule: ${name}`, () => {
    const r = callReview(author, kind, zone, availFor(author, which));
    const okPrimary = which === "ok" ? exp : triplet(callReview(author, kind, zone, availFor(author, "ok")).primary);
    checkExpectation(r, exp, okPrimary.split("|")[0]);
  });
}
await test("review: a zone other than none takes precedence over the touch/FRD kind", () => {
  eq(triplet(callReview(claude("sonnet", "medium"), "touch", "floor", availFor(claude("sonnet"), "ok")).primary), "codex/sol/high", "sonnet touch floor");
  eq(triplet(callReview(claude("sonnet", "medium"), "touch", "r1", availFor(claude("sonnet"), "ok")).primary), "codex/astra/high", "sonnet touch r1");
});
await test("review: a unit-written Opus touch is row 5 (Sol high), only a SESSION-written Opus touch is row 8 (Sol medium)", () => {
  eq(triplet(callReview(claude("opus", "high"), "touch", "none", availFor(claude("opus"), "ok")).primary), "codex/sol/high", "opus unit touch");
  eq(triplet(callReview(session("claude", "opus"), "touch", "none", availFor(claude("opus"), "ok")).primary), "codex/sol/medium", "opus session touch");
});
await test("review: mixed Claude authors take the strictest row (Sonnet + Opus on quota -> Opus xhigh, same_model)", () => {
  const authors = [claude("sonnet", "medium"), claude("opus", "high")];
  const ok_ = callReview(authors, "frd", "none", { claude: "ok", codex: "ok" });
  eq(triplet(ok_.used), "codex/sol/high", "all ok");
  const q = callReview(authors, "frd", "none", { claude: "ok", codex: "quota" });
  ok(q.used && q.used.runtime === "claude" && q.used.model === "opus" && RANK.indexOf(q.used.effort) >= RANK.indexOf("xhigh"), `mixed authors on quota gave ${triplet(q.used)}, expected the strictest (opus xhigh)`);
  const r1 = callReview(authors, "frd", "r1", { claude: "ok", codex: "ok" });
  eq(triplet(r1.used), "codex/astra/high", "mixed authors in r1");
});

// ============================================================================================ 8. review: exhaustive
const unitAuthors = [];
for (const model of [...CLAUDE_MODELS, ...CODEX_MODELS]) {
  const efforts = model === "opus" ? [...RANK, "max"] : RANK;
  for (const effort of efforts) unitAuthors.push(mkAuthor(companyOf(model), model, effort));
}
const sessionAuthors = [...CLAUDE_MODELS, ...CODEX_MODELS].map((m) => mkAuthor(companyOf(m), m, null, true));
const ALL_AUTHORS = [...unitAuthors, ...sessionAuthors];
const AVAIL = [
  { claude: "ok", codex: "ok" },
  { claude: "ok", codex: "quota" },
  { claude: "ok", codex: "unreachable" },
  { claude: "ok", codex: "at_capacity" },
  { claude: "quota", codex: "ok" },
  { claude: "unreachable", codex: "ok" },
];
function* reviewInputs() {
  for (const author of ALL_AUTHORS) for (const kind of KINDS) for (const zone of ZONES) for (const avail of AVAIL)
    yield { author, kind, zone, avail, tag: `${label(author)}${author.origin === "session" ? "" : " (unit)"} ${kind}/${zone} claude:${avail.claude} codex:${avail.codex}` };
}
const PRIMARY_MODELS = ["opus", "sol", "astra"];
/** Invariants every review result must satisfy; returns a list of violation strings. */
function checkReview(r, c, basePrimary) {
  const v = [];
  const a = c.author;
  const other = a.runtime === "claude" ? "codex" : "claude";
  const otherAv = a.runtime === "claude" ? c.avail.codex : c.avail.claude;
  if (!r || typeof r !== "object" || Array.isArray(r)) return ["result is not a single object"];
  const isCell = (x) => x && typeof x === "object" && !Array.isArray(x) && typeof x.runtime === "string" && typeof x.model === "string" && typeof x.effort === "string";
  const parked = r.parked === "no_reviewer";
  if (!(r.parked === null || r.parked === undefined || parked)) v.push(`parked must be null or "no_reviewer", got ${r.parked}`);
  if (!isCell(r.primary)) v.push("primary is not exactly one cell");
  if (parked ? r.used : !isCell(r.used)) v.push(parked ? "parked but a reviewer was used" : "no single reviewer cell and not parked");
  for (const cell of [r.primary, parked ? null : r.used].filter(isCell)) {
    if (cell.model === "fable" || DATA.disabled.includes(cell.model) || DATA.never_emit.models.includes(cell.model)) v.push(`forbidden reviewer model ${cell.model}`);
    if (!PRIMARY_MODELS.includes(cell.model)) v.push(`reviewer model ${cell.model} is not opus/sol/astra`);
    if (!["claude", "codex"].includes(cell.runtime) || companyOf(cell.model) !== cell.runtime) v.push(`reviewer runtime ${cell.runtime} does not match model ${cell.model}`);
    if (!RANK.includes(cell.effort) || cell.effort === "max") v.push(`reviewer effort ${cell.effort} is not one of ${RANK}`);
  }
  if (isCell(r.primary)) {
    if (r.primary.runtime === a.runtime) v.push(`primary reviewer ${triplet(r.primary)} is from the author's own company`);
    if (basePrimary && triplet(r.primary) !== basePrimary) v.push(`primary changed with availability: ${triplet(r.primary)} vs ${basePrimary}`);
    if (a.runtime === "claude" && !["sol", "astra"].includes(r.primary.model)) v.push("a Claude author's primary must be Sol or Astra");
    if (a.runtime === "codex" && r.primary.model !== "opus") v.push("a Codex author's primary must be Opus");
    if (a.runtime === "claude" && a.model !== "fable" && r.primary.model === "astra" && c.zone !== "r1") v.push("Astra is primary for a Claude author only in the r1 zone");
    if (a.model === "fable" && triplet(r.primary) !== "codex/astra/high") v.push(`Fable author must get codex/astra/high, got ${triplet(r.primary)}`);
  }
  if (!["quota_90", "unreachable", "at_capacity", "same_model", null, undefined].includes(r.degraded)) v.push(`degraded value ${r.degraded}`);
  if (r.parked !== undefined && r.parked !== null && !["quota", "unreachable"].includes(otherAv)) v.push(`parked although the ${other} company is ${otherAv}`);
  if (!parked && isCell(r.used) && isCell(r.primary)) {
    if (r.used.runtime === "claude" && c.avail.claude !== "ok") v.push(`reviewer is Claude although Claude is ${c.avail.claude}`);
    if (r.used.runtime === "codex" && !["ok", "at_capacity"].includes(c.avail.codex)) v.push(`reviewer is Codex although Codex is ${c.avail.codex}`);
    if (c.avail.codex === "at_capacity" && r.used.model === "sol") v.push("Sol used although it answered at capacity");
    if (otherAv === "ok" && (triplet(r.used) !== triplet(r.primary) || r.degraded || r.deferred)) v.push(`healthy ${other} company but the review is degraded/changed: ${triplet(r.used)} degraded=${r.degraded}`);
    if (c.avail.codex === "at_capacity" && a.runtime === "claude") {
      const want = r.primary.model === "sol" ? "codex/astra/high" : triplet(r.primary);
      if (triplet(r.used) !== want) v.push(`at_capacity gave ${triplet(r.used)}, expected ${want}`);
      if ((r.primary.model === "sol") !== (r.degraded === "at_capacity")) v.push(`at_capacity degraded flag wrong: ${r.degraded}`);
    }
    if (["quota", "unreachable"].includes(otherAv) && triplet(r.used) === triplet(r.primary)) v.push("other company is out but the primary was used");
    if (r.degraded) {
      if (!(r.deferred && r.deferred.needed === r.primary.runtime && triplet(r.deferred.reviewer) === triplet(r.primary))) v.push(`degraded review without a deferred re-review of ${triplet(r.primary)}: ${JSON.stringify(r.deferred)}`);
    } else if (r.deferred) v.push("deferred set on a non-degraded review");
    const sameModel = r.used.runtime === a.runtime && r.used.model === a.model;
    if (sameModel && r.degraded !== "same_model") v.push("same model as the author without degraded:same_model");
    if (r.degraded === "same_model") {
      if (!sameModel) v.push("degraded same_model but the reviewer is another model");
      if (r.used.effort !== nextCapped(a.effort)) v.push(`N7 effort ${r.used.effort}, expected ${nextCapped(a.effort)} (author ${a.effort ?? "session=high"})`);
      const allowed = a.runtime === "claude" ? c.avail.codex === "quota" : a.model === "astra" && ["quota", "unreachable"].includes(c.avail.claude);
      if (!allowed) v.push(`N7 applied with ${other} ${otherAv} for a ${a.model} author`);
    }
    if (a.runtime === "claude" && a.model !== "fable" && r.used.model === "astra" && c.zone !== "r1" && r.degraded !== "at_capacity") v.push("Astra reviewed a non-r1 Claude diff outside the at_capacity case");
  }
  if (a.runtime === "claude" && ["opus", "fable"].includes(a.model) && c.avail.codex === "unreachable" && !parked) v.push("Opus/Fable author with Codex unreachable must park, never same-model");
  if (a.model === "fable" && ["quota", "unreachable"].includes(c.avail.codex) && !parked) v.push("Fable author with Codex out must park");
  if (a.runtime === "claude" && ["sonnet", "haiku"].includes(a.model) && ["quota", "unreachable"].includes(c.avail.codex)) {
    const want = c.avail.codex === "quota" ? "quota_90" : "unreachable";
    if (parked || !r.used || r.used.model !== "opus" || r.degraded !== want) v.push(`Sonnet/Haiku author with Codex ${c.avail.codex} must get Opus degraded ${want}, got ${triplet(r.used)} ${r.degraded}`);
  }
  if (a.runtime === "codex" && a.model !== "astra" && ["quota", "unreachable"].includes(c.avail.claude) && (parked || !r.used || r.used.runtime !== "codex" || r.used.model !== (a.model === "terra" ? "sol" : "astra"))) {
    v.push(`${a.model} author with Claude out must be reviewed by Codex ${a.model === "terra" ? "sol" : "astra"}, got ${parked ? "park" : triplet(r.used)}`);
  }
  if (a.model === "astra" && ["quota", "unreachable"].includes(c.avail.claude)) {
    const withinRisk = c.zone !== "none";
    if (withinRisk && !parked) v.push("Astra author in floor/r1 with Claude out must park");
    if (!withinRisk && (parked || r.used.model !== "astra" || r.used.effort !== nextCapped(a.effort))) v.push(`Astra author in zone none with Claude out must get astra N7, got ${parked ? "park" : triplet(r.used)}`);
  }
  return v;
}
await test("review exhaustive: every input (authors x effort x origin x kind x zone x availability) satisfies the invariants", () => {
  const base = new Map();
  for (const x of reviewInputs()) {
    if (x.avail.claude === "ok" && x.avail.codex === "ok") base.set(`${JSON.stringify(x.author)}|${x.kind}|${x.zone}`, triplet(callReview(x.author, x.kind, x.zone, x.avail).primary));
  }
  const bad = [];
  let n = 0;
  for (const x of reviewInputs()) {
    n++;
    let r;
    try { r = callReview(x.author, x.kind, x.zone, x.avail); } catch (e) { bad.push(`${x.tag}: threw ${e.message}`); continue; }
    for (const m of checkReview(r, x, base.get(`${JSON.stringify(x.author)}|${x.kind}|${x.zone}`))) bad.push(`${x.tag}: ${m}`);
  }
  ok(n >= 1500, `enumerated only ${n} review inputs`);
  failList("review invariants", bad);
});
await test("review exhaustive: deterministic, and the healthy-side availability never changes the result", () => {
  const bad = [];
  for (const author of ALL_AUTHORS) for (const kind of KINDS) for (const zone of ZONES) {
    const a = callReview(author, kind, zone, { claude: "ok", codex: "ok" });
    if (JSON.stringify(a) !== JSON.stringify(callReview(author, kind, zone, { claude: "ok", codex: "ok" }))) bad.push(`${label(author)} ${kind}/${zone}: not deterministic`);
    const irrelevant = author.runtime === "claude" ? [{ claude: "quota", codex: "ok" }, { claude: "unreachable", codex: "ok" }] : [{ claude: "ok", codex: "quota" }, { claude: "ok", codex: "unreachable" }, { claude: "ok", codex: "at_capacity" }];
    for (const av of irrelevant) {
      if (JSON.stringify(callReview(author, kind, zone, av)) !== JSON.stringify(a)) bad.push(`${label(author)} ${kind}/${zone}: the author's own company state ${JSON.stringify(av)} changed the review`);
    }
  }
  failList("irrelevant availability", bad);
});
await test("review exhaustive: row 8 haiku session = sonnet session (row 2); fable session never produces Opus/Sonnet/Haiku/Fable", () => {
  const bad = [];
  for (const zone of ZONES) for (const av of AVAIL) {
    const h = callReview(session("claude", "haiku"), "touch", zone, av);
    const s = callReview(session("claude", "sonnet"), "touch", zone, av);
    if (JSON.stringify(h) !== JSON.stringify(s)) bad.push(`haiku session != sonnet session at ${zone} ${JSON.stringify(av)}`);
    for (const kind of KINDS) {
      const f = callReview(session("claude", "fable"), kind, zone, av);
      if (f.used && ["opus", "sonnet", "haiku", "fable"].includes(f.used.model)) bad.push(`fable session ${kind}/${zone} ${JSON.stringify(av)} used ${triplet(f.used)}`);
    }
  }
  failList("row 8", bad);
});
await test("review invariant checker has teeth: deliberately wrong results are flagged (negative controls)", () => {
  const goodCtx = { author: claude("opus", "high"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "unreachable" } };
  const cases = [
    ["Opus same-model review on unreachable Codex", goodCtx, { primary: cellOf("codex/sol/high"), used: cellOf("claude/opus/xhigh"), degraded: "same_model", deferred: { needed: "codex", reviewer: cellOf("codex/sol/high") }, parked: null }],
    ["fable reviewer", { ...goodCtx, avail: { claude: "ok", codex: "ok" } }, { primary: cellOf("claude/fable/high"), used: cellOf("claude/fable/high"), degraded: null, deferred: null, parked: null }],
    ["effort max", { ...goodCtx, avail: { claude: "ok", codex: "ok" } }, { primary: cellOf("codex/sol/max"), used: cellOf("codex/sol/max"), degraded: null, deferred: null, parked: null }],
    ["primary from the author's own company", { ...goodCtx, avail: { claude: "ok", codex: "ok" } }, { primary: cellOf("claude/opus/high"), used: cellOf("claude/opus/high"), degraded: null, deferred: null, parked: null }],
    ["parked with a reviewer", goodCtx, { primary: cellOf("codex/sol/high"), used: cellOf("codex/sol/high"), degraded: null, deferred: null, parked: "no_reviewer" }],
    ["Sol used at capacity", { author: claude("sonnet", "high"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "at_capacity" } }, { primary: cellOf("codex/sol/high"), used: cellOf("codex/sol/high"), degraded: null, deferred: null, parked: null }],
    ["N7 at a lower effort", { author: claude("opus", "xhigh"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "quota" } }, { primary: cellOf("codex/sol/high"), used: cellOf("claude/opus/high"), degraded: "same_model", deferred: { needed: "codex", reviewer: cellOf("codex/sol/high") }, parked: null }],
    ["Claude reviewer while Claude is out", { author: codex("sol", "high"), kind: "frd", zone: "none", avail: { claude: "quota", codex: "ok" } }, { primary: cellOf("claude/opus/high"), used: cellOf("claude/opus/high"), degraded: null, deferred: null, parked: null }],
    ["degraded without a deferred re-review", { author: claude("sonnet", "high"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "quota" } }, { primary: cellOf("codex/sol/high"), used: cellOf("claude/opus/high"), degraded: "quota_90", deferred: null, parked: null }],
    ["Astra for a Claude author outside r1", { author: claude("sonnet", "high"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "ok" } }, { primary: cellOf("codex/astra/high"), used: cellOf("codex/astra/high"), degraded: null, deferred: null, parked: null }],
  ];
  for (const [name, ctx, bogus] of cases) ok(checkReview(bogus, ctx, null).length > 0, `negative control not detected: ${name}`);
  ok(checkReview({ primary: cellOf("codex/sol/high"), used: cellOf("codex/sol/high"), degraded: null, deferred: null, parked: null }, { author: claude("sonnet", "high"), kind: "frd", zone: "none", avail: { claude: "ok", codex: "ok" } }, null).length === 0, "the checker rejects a correct result");
});

// ============================================================================================ 9. doubt consult
await test("consultCell consult 1: Claude origin -> Sol high, Codex origin -> Opus high, drive and Codex app -> Astra high", () => {
  eq(triplet(callConsult("claude", 1)), "codex/sol/high", "origin claude");
  eq(triplet(callConsult("codex", 1)), "claude/opus/high", "origin codex");
  eq(triplet(callConsult("drive", 1)), "codex/astra/high", "origin drive");
  eq(triplet(callConsult("codex_app", 1)), "codex/astra/high", "origin codex_app");
});
await test("consultCell consult 2 (tie break): claude/codex origin -> a different well-formed cell; drive and Codex app have no consult 2 (consult astra high, then park)", () => {
  for (const origin of ["claude", "codex"]) {
    const first = callConsult(origin, 1);
    const second = callConsult(origin, 2);
    failList(`consult ${origin}`, wellFormed(second, ["opus", "sol", "astra"]));
    ok(triplet(first) !== triplet(second), `${origin}: the tie break repeats the first consult cell ${triplet(first)}`);
  }
  for (const origin of ["drive", "codex_app"]) {
    let second;
    try { second = callConsult(origin, 2); } catch { continue; }
    ok(!(second && typeof second === "object" && second.model), `${origin}: Claude is out and Astra was already consulted, so consult 2 must be no cell (park), got ${JSON.stringify(second)}`);
  }
});
await test("consultCell: an unknown origin never yields a cell", () => {
  let result;
  try { result = callConsult("martian", 1); } catch { return; }
  ok(!(result && typeof result === "object" && result.model), `unknown origin produced ${JSON.stringify(result)}`);
});

console.log(`RESULT ${failed === 0 ? "OK" : "FAILED"} passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
