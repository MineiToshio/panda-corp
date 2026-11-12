#!/usr/bin/env node
// Planner test for plugin/runtime/build/planner.mjs (PLAN C01 / T-C01, BUILD-9, D30, A13, CLI doc 3.6).
//
// Contracts pinned (written from PLAN 3.16 A13, RESOLUTIONS D30, build-engine.md BUILD-9, CLI doc 3.6; the
// implementation file was NOT read): ready = status PLANNED|IN_PROGRESS + every dependency integrated + not
// parked + not pending an irreversible answer; greedy by barrier first, then longest downstream path, up to
// the ceiling, never two units whose `artifacts` overlap (literal-prefix rule); barrier paths constant;
// build unit = chain of <=3 WOs of ONE FRD on a linear stretch, cut when the routing cell changes;
// ids u-build-<first wo> / chain c-<first wo>; tests-first unit u-tests-<first wo>; out-of-scope never planned;
// no progress possible -> deadlock; lint-plan rules of BUILD-9.
//
// The module is PURE (no fs, no git, no clock): no fixtures are needed, nothing is written anywhere.
//
// ASSUMED INTERFACE (the docs give no signatures for planner.mjs; the orchestrator reconciles test and module):
//   Convention `fn(input, deps?)`, synchronous, pure, never mutating `input` (it is deep-frozen here).
//   * `plan(input, deps)`       -> {units[], rounds[][], issues[], deadlock:boolean}   (CLI `plan`: full simulation)
//   * `planRound(input, deps)`  -> {round:[unitId...], units[], deadlock:boolean}      (ONE dispatchable round)
//   * `lintPlan(input, deps)`   -> {issues:[{rule, wo, severity:"error"|"warn", detail}]}   (`input.strict` promotes warn -> error)
//   * `artifactsOverlap(a, b)`  -> boolean, a and b are single artifact globs (literal-prefix rule, conservative)
//   * `isBarrierPath(glob)`     -> boolean (prisma/**, **/migrations/**, package.json, lockfiles)
//   input = {
//     scope: {card, frds[], wos[], out_of_scope[]},          // only scope.wos are ever planned
//     workOrders: [{id, frd, dependsOn[], artifacts[]|undefined, status, acs[], zone:"none|floor|r1", reopen_count}],
//                                                            // every WO known to the project (also out of scope ones)
//     integrated: [wo ids integrated on lane/<run_id>],      // dependsOn is satisfied only by these
//     parked: [wo ids], pendingIrreversible: [wo ids],       // excluded from ready
//     frdAcs: {<frd id>: [AC ids present in the FRD at integration.base_sha]},   // tests-first + unowned-AC lint
//     card: null | {type: "feature"|"bug"},                  // type bug -> tests-first for every build unit
//     ceiling: number (default 2),                           // max units per round
//     live: [{id, artifacts[]}],                             // planRound only: units already running (overlap source)
//     strict: boolean                                        // lintPlan only
//   }
//   deps.cellOf(wo) -> {runtime, model, effort}: the routing cell of one WO (default = routing.builderCell). The
//     planner cuts a chain where the cell of consecutive WOs differs; this test injects it to control the cuts.
//   unit = {id, kind:"build"|"tests", wos[], frd, chain:"c-<first wo>"|null, depends_on[] (unit ids), cell, why}
//   issue.rule text is matched loosely (cycle / overlap / artifacts / dangling / ac) because the docs name no ids.
//
// Run: node plugin/scripts/test-build-v2-planner.mjs   (offline, pure, < 2 s)
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(HERE, "..", "runtime", "build", "planner.mjs");

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
const eq = (a, b, message) => {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(`${message}: expected ${y}, got ${x}`);
};

let mod = null;
let loadError = null;
try {
  mod = await import(pathToFileURL(MODULE_PATH).href);
} catch (e) {
  loadError = e;
}
const api = (name) => {
  if (loadError) throw new Error(`planner.mjs cannot be loaded (${loadError.code || loadError.name}: ${String(loadError.message).split("\n")[0]})`);
  if (typeof mod[name] !== "function") throw new Error(`planner.mjs does not export function "${name}" (exports: ${Object.keys(mod).join(", ") || "none"})`);
  return mod[name];
};

const deepFreeze = (v) => {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
};

// ---- builders -------------------------------------------------------------------------------------------
const CELL = { runtime: "claude", model: "sonnet", effort: "medium" };
const wo = (id, o = {}) => ({
  id,
  frd: o.frd || "frd-01",
  dependsOn: o.dependsOn || [],
  artifacts: "artifacts" in o ? o.artifacts : [`src/${id}/**`],
  status: o.status || "PLANNED",
  acs: o.acs || [],
  zone: o.zone || "none",
  reopen_count: o.reopen_count || 0,
});
const mk = (wos, o = {}) => {
  const live = o.live || [];
  const liveWos = live.map((l, i) => ({ id: `wo-live-${i}`, frd: "frd-99", dependsOn: [], artifacts: l.artifacts, status: "IN_PROGRESS", acs: [], zone: "none", reopen_count: 0 }));
  const units = [
    ...(o.parked || []).map((w, i) => ({ id: `u-parked-${i}`, kind: "build", state: "parked", wos: [w], depends_on: [] })),
    ...live.map((l, i) => ({ id: l.id, kind: "build", state: "running", wos: [`wo-live-${i}`], depends_on: [] })),
  ];
  return deepFreeze({
    scope: { card: null, frds: [...new Set(wos.map((w) => w.frd))], wos: o.scopeWos || wos.map((w) => w.id), out_of_scope: o.out_of_scope || [] },
    wos: [...wos, ...liveWos],
    units,
    questions: (o.pendingIrreversible || []).map((w, i) => ({ id: `q-${i}`, affects: { wos: [w] }, reversible: false })),
    frd_acs: o.frdAcs || {},
    card_type: o.card ? o.card.type : null,
    ceiling: o.ceiling ?? 2,
    strict: !!o.strict,
  });
};
const sameCell = () => ({ cellOf: () => CELL });
// plan() units are state-shaped: the cell lives in result.cells; deadlock is null | {...}.
const shape = (r) => ({
  ...r,
  deadlock: !!r.deadlock,
  units: r.units.filter((u) => u.state !== "parked" && u.state !== "running").map((u) => ({ ...u, cell: r.cells[u.id] })),
});
const doPlan = (input, deps = sameCell()) => shape(api("plan")(input, deps));
const doRound = (input, deps = sameCell()) => doPlan(input, deps);
const doLint = (input, deps = sameCell()) => ({ issues: api("lintPlan")(input, deps).issues ?? api("lintPlan")(input, deps) });
const unitOf = (plan, id) => plan.units.find((u) => u.id === id);
const buildUnits = (plan) => plan.units.filter((u) => u.kind === "build");
const roundIndex = (plan, unitId) => plan.rounds.findIndex((r) => r.includes(unitId));
const issueText = (i) => `${i.rule} ${i.detail}`.toLowerCase();

// ---- overlap and barrier primitives ---------------------------------------------------------------------
await test("literal-prefix overlap: nested globs, wildcard-first globs, exact paths", () => {
  const ov = api("globsOverlap");
  ok(ov("src/a/**", "src/a/b/*.ts"), "src/a/** vs src/a/b/*.ts must overlap (prefix src/a/ is a prefix of src/a/b/)");
  ok(ov("src/a/b/*.ts", "src/a/**"), "overlap must be symmetric");
  ok(ov("src/x.ts", "src/x.ts"), "identical exact paths overlap");
  ok(ov("src/*.ts", "src/b/x.ts"), "src/*.ts has prefix src/, which is a prefix of src/b/x.ts: conservative overlap");
  ok(ov("**/migrations/**", "src/z/q.ts"), "a glob starting with a wildcard has the empty prefix: overlaps everything (conservative)");
  ok(ov("src/a", "src/ab/**"), "pure prefix-of-string comparison is conservative: src/a is a prefix of src/ab/");
  ok(!ov("src/a/**", "src/b/**"), "disjoint directories do not overlap");
  ok(!ov("src/x.ts", "src/xy.ts"), "neither literal is a prefix of the other");
  ok(!ov("docs/**", "src/**"), "docs/** and src/** do not overlap");
});

await test("barrier paths are constants: prisma, migrations, package.json, lockfiles", () => {
  const b = api("isBarrierPath");
  for (const g of ["prisma/**", "prisma/schema.prisma", "src/db/migrations/001_init.sql", "**/migrations/**", "package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
    ok(b(g) === true, `${g} must be a barrier path`);
  }
  for (const g of ["src/app/page.tsx", "docs/frds/x.md", "src/lib/migration-notes.ts", "packages/a/readme.md"]) ok(b(g) === false, `${g} must not be a barrier path`);
});

// ---- ready set -------------------------------------------------------------------------------------------
await test("ready = deps integrated: a dependent unit is not in the first round; a reported-only dependency does not count", () => {
  const input = mk([wo("wo-01-001"), wo("wo-01-002", { dependsOn: ["wo-01-001"] }), wo("wo-02-001", { frd: "frd-02" })], { ceiling: 3 });
  const r = doRound(input);
  ok(r.round.includes("u-build-wo-02-001"), "the independent unit is ready");
  ok(r.round.includes("u-build-wo-01-001") || r.round.some((id) => unitOf({ units: r.units }, id)?.wos.includes("wo-01-001")), "the root of the chain is ready");
  ok(!r.round.some((id) => unitOf({ units: r.units }, id)?.wos.includes("wo-01-002") && !unitOf({ units: r.units }, id)?.wos.includes("wo-01-001")), "wo-01-002 alone must not be dispatched before wo-01-001 is integrated");
  const done = doRound(mk([wo("wo-01-001", { status: "IN_REVIEW" }), wo("wo-01-002", { dependsOn: ["wo-01-001"] })], { integrated: ["wo-01-001"] }));
  eq(done.round, ["u-build-wo-01-002"], "with its dependency integrated, wo-01-002 is ready alone (wo-01-001 is not re-planned)");
});

await test("status filter: only PLANNED and IN_PROGRESS WOs are planned (IN_REVIEW, VERIFIED, BLOCKED never)", () => {
  const wos = [
    wo("wo-01-001", { status: "PLANNED", artifacts: ["src/a/**"], frd: "frd-01" }),
    wo("wo-02-001", { status: "IN_PROGRESS", artifacts: ["src/b/**"], frd: "frd-02" }),
    wo("wo-03-001", { status: "IN_REVIEW", artifacts: ["src/c/**"], frd: "frd-03" }),
    wo("wo-04-001", { status: "VERIFIED", artifacts: ["src/d/**"], frd: "frd-04" }),
    wo("wo-05-001", { status: "BLOCKED", artifacts: ["src/e/**"], frd: "frd-05" }),
  ];
  const p = doPlan(mk(wos, { ceiling: 8 }));
  const planned = new Set(p.units.flatMap((u) => u.wos));
  ok(planned.has("wo-01-001") && planned.has("wo-02-001"), "PLANNED and IN_PROGRESS are planned");
  for (const id of ["wo-03-001", "wo-04-001", "wo-05-001"]) ok(!planned.has(id), `${id} must not be planned`);
});

await test("parked and pending-irreversible WOs are not ready (and their dependents wait)", () => {
  const wos = [wo("wo-01-001", { frd: "frd-01" }), wo("wo-02-001", { frd: "frd-02" }), wo("wo-03-001", { frd: "frd-03" }), wo("wo-03-002", { frd: "frd-03", dependsOn: ["wo-03-001"] })];
  const r = doRound(mk(wos, { parked: ["wo-01-001"], pendingIrreversible: ["wo-03-001"], ceiling: 8 }));
  eq(r.round, ["u-build-wo-02-001"], "only the unparked, answered, independent WO is dispatchable");
  eq(r.deadlock, false, "a round with progress is not a deadlock");
});

// ---- funko-like graph ------------------------------------------------------------------------------------
await test("funko-like: FRD graph is cyclic (a->b->a) but the WO graph is acyclic: plans fine, one unit per FRD hop, no cycle issue", () => {
  const wos = [
    wo("wo-01-001", { frd: "frd-01" }),
    wo("wo-02-001", { frd: "frd-02", dependsOn: ["wo-01-001"] }),
    wo("wo-01-002", { frd: "frd-01", dependsOn: ["wo-02-001"] }),
    wo("wo-02-002", { frd: "frd-02", dependsOn: ["wo-01-002"] }),
  ];
  const input = mk(wos);
  const p = doPlan(input);
  eq(p.deadlock, false, "acyclic WO graph never deadlocks");
  eq(p.units.map((u) => u.wos), [["wo-01-001"], ["wo-02-001"], ["wo-01-002"], ["wo-02-002"]], "a chain never crosses an FRD boundary: four single-WO units in dependency order");
  eq(p.rounds.flat(), ["u-build-wo-01-001", "u-build-wo-02-001", "u-build-wo-01-002", "u-build-wo-02-002"], "the four hops run strictly one after the other");
  eq(p.rounds.length, 4, "one unit per round (each depends on the previous)");
  const issues = doLint(input).issues;
  ok(!issues.some((i) => i.severity === "error"), `lint must not report errors on the acyclic WO graph: ${JSON.stringify(issues)}`);
  ok(!issues.some((i) => /cycl/.test(issueText(i))), "no cycle issue");
});

await test("a real WO dependency cycle: deadlock, no unit dispatchable, lint-plan reports a cycle error", () => {
  const input = mk([wo("wo-01-001", { dependsOn: ["wo-01-003"] }), wo("wo-01-002", { dependsOn: ["wo-01-001"] }), wo("wo-01-003", { dependsOn: ["wo-01-002"] })]);
  const r = doRound(input);
  eq(r.deadlock, true, "queued units with no possible progress are a deadlock");
  eq(r.round, [], "nothing dispatchable");
  eq(doPlan(input).deadlock, true, "plan reports deadlock too");
  const issues = doLint(input).issues;
  ok(issues.some((i) => i.severity === "error" && /cycl/.test(issueText(i))), `lint-plan must flag the dependency cycle as an error: ${JSON.stringify(issues)}`);
});

await test("deadlock: a dependency that is neither integrated nor in scope nor plannable (dangling) leaves queued units with no progress", () => {
  const input = mk([wo("wo-01-001", { dependsOn: ["wo-09-999"] })]);
  const r = doRound(input);
  eq(r.deadlock, true, "dangling dependency: no progress possible");
  const issues = doLint(input).issues;
  ok(issues.some((i) => i.severity === "error" && /dangl|missing|unknown|depend/.test(issueText(i)) && i.wo === "wo-01-001"), `lint-plan must flag the dangling dependsOn on wo-01-001: ${JSON.stringify(issues)}`);
});

await test("not a deadlock: nothing queued at all (everything integrated or out of scope) yields an empty round, deadlock false", () => {
  const r = doRound(mk([wo("wo-01-001", { status: "IN_REVIEW" })], { integrated: ["wo-01-001"] }));
  eq(r.round, [], "no round");
  eq(r.deadlock, false, "empty queue is completion, not deadlock");
});

// ---- greedy order: barrier first, then longest downstream path ------------------------------------------
await test("barrier WO goes first in the round even when another ready unit has a longer downstream path", () => {
  const wos = [
    wo("wo-01-001", { frd: "frd-01", artifacts: ["src/long/**"] }),
    wo("wo-01-002", { frd: "frd-01", artifacts: ["src/long2/**"], dependsOn: ["wo-01-001"] }),
    wo("wo-01-003", { frd: "frd-01", artifacts: ["src/long3/**"], dependsOn: ["wo-01-002"] }),
    wo("wo-02-001", { frd: "frd-02", artifacts: ["prisma/**"] }),
  ];
  const r = doRound(mk(wos, { ceiling: 1 }));
  eq(r.round, ["u-build-wo-02-001"], "with ceiling 1 the barrier unit is picked before the longer chain");
  const p = doPlan(mk(wos, { ceiling: 2 }));
  eq(p.rounds[0][0], "u-build-wo-02-001", "the barrier is first in the first round of the full plan");
  ok(p.rounds[0].length <= 2, "round honours the ceiling");
});

await test("wide DAG: longest downstream path first; independent disjoint units fill the ceiling; every WO planned exactly once", () => {
  const wos = [
    // frd-01: root -> m1 -> {leafA, leafB}  (downstream path length 3), the chain stops at the branch
    wo("wo-01-001", { frd: "frd-01", artifacts: ["src/p1/**"] }),
    wo("wo-01-002", { frd: "frd-01", artifacts: ["src/p2/**"], dependsOn: ["wo-01-001"] }),
    wo("wo-01-003", { frd: "frd-01", artifacts: ["src/p3/**"], dependsOn: ["wo-01-002"] }),
    wo("wo-01-004", { frd: "frd-01", artifacts: ["src/p4/**"], dependsOn: ["wo-01-002"] }),
    // short roots in other FRDs
    wo("wo-02-001", { frd: "frd-02", artifacts: ["src/q1/**"] }),
    wo("wo-02-002", { frd: "frd-02", artifacts: ["src/q2/**"], dependsOn: ["wo-02-001"], zone: "none" }),
    wo("wo-03-001", { frd: "frd-03", artifacts: ["src/r1/**"] }),
    wo("wo-04-001", { frd: "frd-04", artifacts: ["src/s1/**"] }),
    wo("wo-05-001", { frd: "frd-05", artifacts: ["src/t1/**"] }),
  ];
  const first = doRound(mk(wos, { ceiling: 1 }));
  eq(first.round.length, 1, "ceiling 1 picks exactly one unit");
  const u = first.units.find((x) => x.id === first.round[0]);
  ok(u.wos[0] === "wo-01-001", `the unit with the longest downstream path (frd-01 root) is picked first, got ${u.wos}`);
  const wide = doRound(mk(wos, { ceiling: 8 }));
  ok(wide.round.length >= 4, `wide DAG: all independent disjoint roots are dispatched together, got ${wide.round.length}`);
  const p = doPlan(mk(wos, { ceiling: 3 }));
  ok(p.rounds.every((r) => r.length <= 3), "no round exceeds the ceiling");
  const flat = p.units.flatMap((x) => x.wos);
  eq([...flat].sort(), wos.map((w) => w.id).sort(), "every WO is planned exactly once");
  eq(new Set(flat).size, flat.length, "no WO appears in two units");
  for (const unit of p.units) for (const dep of unit.depends_on) ok(roundIndex(p, dep) < roundIndex(p, unit.id), `${unit.id} must come after its dependency ${dep}`);
});

// ---- artifacts overlap in rounds -------------------------------------------------------------------------
await test("units whose artifacts overlap are never in the same round (conservative literal-prefix rule)", () => {
  const wos = [
    wo("wo-01-001", { frd: "frd-01", artifacts: ["src/shared/**"] }),
    wo("wo-02-001", { frd: "frd-02", artifacts: ["src/shared/deep/*.ts"] }),
    wo("wo-03-001", { frd: "frd-03", artifacts: ["src/other/**"] }),
  ];
  const r = doRound(mk(wos, { ceiling: 8 }));
  const ids = r.round;
  ok(ids.includes("u-build-wo-03-001"), "the disjoint unit runs");
  ok(!(ids.includes("u-build-wo-01-001") && ids.includes("u-build-wo-02-001")), "overlapping units must not be dispatched together");
  eq(ids.length, 2, "exactly one of the two overlapping units plus the disjoint one");
  const p = doPlan(mk(wos, { ceiling: 8 }));
  ok(roundIndex(p, "u-build-wo-01-001") !== roundIndex(p, "u-build-wo-02-001"), "in the full plan they land in different rounds");
});

await test("a live (already running) unit whose artifacts overlap excludes the candidate; a disjoint live unit does not", () => {
  const wos = [wo("wo-01-001", { frd: "frd-01", artifacts: ["src/a/**"] }), wo("wo-02-001", { frd: "frd-02", artifacts: ["src/b/**"] })];
  const r = doRound(mk(wos, { ceiling: 8, live: [{ id: "u-build-wo-09-001", artifacts: ["src/a/inner/x.ts"] }] }));
  eq(r.round, ["u-build-wo-02-001"], "wo-01-001 overlaps the live unit, wo-02-001 does not");
});

await test("overlap between dependent WOs is fine; overlap between independent WOs is a lint error; missing artifacts is flagged", () => {
  const dep = mk([wo("wo-01-001", { artifacts: ["src/x/**"] }), wo("wo-01-002", { artifacts: ["src/x/y.ts"], dependsOn: ["wo-01-001"] })]);
  ok(!doLint(dep).issues.some((i) => /overlap/.test(issueText(i))), "a dependency path orders them: no overlap issue");
  const indep = mk([wo("wo-01-001", { frd: "frd-01", artifacts: ["src/x/**"] }), wo("wo-02-001", { frd: "frd-02", artifacts: ["src/x/y.ts"] })]);
  ok(doLint(indep).issues.some((i) => i.severity === "error" && /overlap/.test(issueText(i))), "independent WOs overlapping artifacts: error");
  const missing = mk([wo("wo-01-001", { artifacts: undefined })]);
  const iss = doLint(missing).issues.filter((i) => i.wo === "wo-01-001" && /artifact/.test(issueText(i)));
  ok(iss.length >= 1, "a WO without artifacts is reported");
  ok(["error", "warn"].includes(iss[0].severity), "severity is error or warn");
});

await test("lint-plan strict promotes every warning to an error", () => {
  const input = mk([wo("wo-01-001", { artifacts: undefined })], { strict: true });
  const issues = doLint(input).issues;
  ok(issues.length >= 1, "an issue exists");
  ok(issues.every((i) => i.severity === "error"), `strict: all issues are errors: ${JSON.stringify(issues)}`);
});

await test("lint-plan: unowned AC lines (FRD acceptance criteria no WO cites) are reported", () => {
  const input = mk([wo("wo-01-001", { acs: ["AC-01-001.1"] })], { frdAcs: { "frd-01": ["AC-01-001.1", "AC-01-002.1"] } });
  const issues = doLint(input).issues;
  ok(issues.some((i) => /\bac\b|ac-|acceptance|unowned/.test(issueText(i)) && issueText(i).includes("ac-01-002.1")), `AC-01-002.1 is unowned and must be reported: ${JSON.stringify(issues)}`);
  ok(!issues.some((i) => issueText(i).includes("ac-01-001.1") && /unowned/.test(issueText(i))), "the cited AC is not reported");
});

// ---- chains ----------------------------------------------------------------------------------------------
await test("chain: a linear stretch of one FRD is one build unit of at most 3 WOs (u-build-<first>, c-<first>), the next chain depends on the previous", () => {
  const wos = [1, 2, 3, 4, 5].map((n) => wo(`wo-01-00${n}`, { dependsOn: n > 1 ? [`wo-01-00${n - 1}`] : [] }));
  const p = doPlan(mk(wos));
  const bu = buildUnits(p);
  eq(bu.map((u) => u.wos), [["wo-01-001", "wo-01-002", "wo-01-003"], ["wo-01-004", "wo-01-005"]], "5 linear WOs: chains of 3 and 2");
  eq(bu.map((u) => u.id), ["u-build-wo-01-001", "u-build-wo-01-004"], "ids carry the first WO and no attempt suffix");
  eq(bu.map((u) => u.chain), ["c-wo-01-001", "c-wo-01-004"], "chain ids c-<first wo>");
  eq(bu[1].depends_on, ["u-build-wo-01-001"], "the second chain depends on the first (unit ids)");
  eq(bu[0].depends_on, [], "the first chain has no dependency");
  ok(bu.every((u) => u.frd === "frd-01"), "frd recorded");
  ok(bu.every((u) => u.cell && u.cell.model === "sonnet"), "every unit carries its routing cell");
});

await test("chain cut: a routing cell change inside a linear stretch starts a new chain (one model/effort per chain)", () => {
  const wos = [1, 2, 3, 4].map((n) => wo(`wo-01-00${n}`, { dependsOn: n > 1 ? [`wo-01-00${n - 1}`] : [] }));
  const cells = { "wo-01-003": { runtime: "claude", model: "opus", effort: "high" }, "wo-01-004": { runtime: "claude", model: "opus", effort: "high" } };
  const p = doPlan(mk(wos), { cellOf: (u) => cells[u.wos[0]] || CELL });
  eq(buildUnits(p).map((u) => u.wos), [["wo-01-001", "wo-01-002"], ["wo-01-003", "wo-01-004"]], "cut where the cell changes (sonnet,sonnet | opus,opus)");
  eq(unitOf(p, "u-build-wo-01-003").cell, cells["wo-01-003"], "the second chain carries the opus cell");
  eq(unitOf(p, "u-build-wo-01-001").cell, CELL, "the first chain carries the sonnet cell");
});

await test("chain cut: effort-only change also cuts; identical cells do not", () => {
  const wos = [1, 2, 3].map((n) => wo(`wo-01-00${n}`, { dependsOn: n > 1 ? [`wo-01-00${n - 1}`] : [] }));
  const cut = doPlan(mk(wos), { cellOf: (u) => (u.wos[0] === "wo-01-002" ? { ...CELL, effort: "high" } : CELL) });
  eq(buildUnits(cut).map((u) => u.wos), [["wo-01-001"], ["wo-01-002"], ["wo-01-003"]], "a different effort on the middle WO isolates it");
  const keep = doPlan(mk(wos));
  eq(buildUnits(keep).map((u) => u.wos), [["wo-01-001", "wo-01-002", "wo-01-003"]], "same cell: one chain");
});

await test("chain cut: branching (two dependents), joining (two dependencies) and an FRD change never continue a chain", () => {
  const branch = doPlan(
    mk([
      wo("wo-01-001", { artifacts: ["src/a/**"] }),
      wo("wo-01-002", { artifacts: ["src/b/**"], dependsOn: ["wo-01-001"] }),
      wo("wo-01-003", { artifacts: ["src/c/**"], dependsOn: ["wo-01-001"] }),
    ]),
  );
  eq(buildUnits(branch).map((u) => u.wos), [["wo-01-001"], ["wo-01-002"], ["wo-01-003"]], "a branch point is not a linear stretch");
  const join = doPlan(
    mk([
      wo("wo-01-001", { artifacts: ["src/a/**"] }),
      wo("wo-01-002", { artifacts: ["src/b/**"] }),
      wo("wo-01-003", { artifacts: ["src/c/**"], dependsOn: ["wo-01-001", "wo-01-002"] }),
    ]),
  );
  ok(!buildUnits(join).some((u) => u.wos.length > 1), "a join is not a linear stretch: no multi-WO unit");
  const cross = doPlan(mk([wo("wo-01-001", { frd: "frd-01" }), wo("wo-02-001", { frd: "frd-02", dependsOn: ["wo-01-001"] })]));
  ok(buildUnits(cross).every((u) => u.wos.length === 1), "chains never span two FRDs");
});

await test("a chain does not swallow a WO that is already integrated or parked", () => {
  const wos = [wo("wo-01-001", { status: "IN_REVIEW" }), wo("wo-01-002", { dependsOn: ["wo-01-001"] }), wo("wo-01-003", { dependsOn: ["wo-01-002"] })];
  const p = doPlan(mk(wos, { integrated: ["wo-01-001"] }));
  eq(buildUnits(p).map((u) => u.wos), [["wo-01-002", "wo-01-003"]], "the integrated root is not re-planned; the rest chains");
});

// ---- scope -----------------------------------------------------------------------------------------------
await test("out-of-scope WOs are never planned: not in units, rounds, depends_on or the ready round", () => {
  const wos = [
    wo("wo-01-001", { frd: "frd-01", artifacts: ["src/a/**"] }),
    wo("wo-02-001", { frd: "frd-02", artifacts: ["src/b/**"] }),
    wo("wo-03-001", { frd: "frd-03", artifacts: ["src/c/**"] }),
  ];
  const input = mk(wos, { scopeWos: ["wo-01-001"], out_of_scope: ["wo-02-001"], ceiling: 8 });
  const p = doPlan(input);
  const planned = p.units.flatMap((u) => u.wos);
  eq(planned, ["wo-01-001"], "only the in-scope WO is planned (wo-02-001 explicitly out, wo-03-001 simply not in scope.wos)");
  const text = JSON.stringify(p);
  ok(!text.includes("wo-02-001") && !text.includes("wo-03-001"), "out-of-scope ids appear nowhere in the plan output");
  const r = doRound(input);
  eq(r.round, ["u-build-wo-01-001"], "nor in the dispatchable round");
  eq(r.deadlock, false, "out-of-scope WOs do not make a deadlock");
});

await test("an out-of-scope WO listed in out_of_scope is excluded even if it is inside scope.wos", () => {
  const wos = [wo("wo-01-001", { artifacts: ["src/a/**"] }), wo("wo-01-002", { frd: "frd-02", artifacts: ["src/b/**"] })];
  const p = doPlan(mk(wos, { out_of_scope: ["wo-01-002"] }));
  eq(p.units.flatMap((u) => u.wos), ["wo-01-001"], "Fuera wins over a stray scope entry");
});

// ---- tests-first (A13) -----------------------------------------------------------------------------------
await test("tests-first: floor/r1 zone + a cited AC absent from the FRD at base -> u-tests-<first wo> before the build unit; the build depends on it", () => {
  for (const zone of ["floor", "r1"]) {
    const wos = [wo("wo-01-001", { zone, acs: ["AC-01-001.1", "AC-01-009.1"] })];
    const p = doPlan(mk(wos, { frdAcs: { "frd-01": ["AC-01-001.1"] } }));
    const t = unitOf(p, "u-tests-wo-01-001");
    ok(t, `zone ${zone}: a tests unit u-tests-wo-01-001 is emitted`);
    eq(t.kind, "tests", "kind tests");
    eq(t.wos, ["wo-01-001"], "tests unit covers the build unit's WOs");
    const b = unitOf(p, "u-build-wo-01-001");
    ok(b.depends_on.includes("u-tests-wo-01-001"), "the build unit depends_on the tests unit");
    ok(roundIndex(p, "u-tests-wo-01-001") < roundIndex(p, "u-build-wo-01-001"), "tests unit is scheduled in an earlier round");
  }
});

await test("tests-first is NOT emitted: zone none, or every cited AC already present at base, or no AC cited", () => {
  const none = doPlan(mk([wo("wo-01-001", { zone: "none", acs: ["AC-01-009.1"] })], { frdAcs: { "frd-01": ["AC-01-001.1"] } }));
  ok(!unitOf(none, "u-tests-wo-01-001"), "zone none: no tests unit even with a new AC");
  const present = doPlan(mk([wo("wo-01-001", { zone: "r1", acs: ["AC-01-001.1"] })], { frdAcs: { "frd-01": ["AC-01-001.1"] } }));
  ok(!unitOf(present, "u-tests-wo-01-001"), "AC already in the FRD at base: no tests unit");
  const noac = doPlan(mk([wo("wo-01-001", { zone: "floor", acs: [] })], { frdAcs: { "frd-01": ["AC-01-001.1"] } }));
  ok(!unitOf(noac, "u-tests-wo-01-001"), "no AC cited: no tests unit");
});

await test("tests-first: a type:bug card gets a tests unit before every build unit, whatever the zone", () => {
  const p = doPlan(mk([wo("wo-01-001", { zone: "none" }), wo("wo-01-002", { zone: "none", dependsOn: ["wo-01-001"] })], { card: { type: "bug" } }));
  const t = unitOf(p, "u-tests-wo-01-001");
  ok(t, "bug card: tests unit for the build unit");
  ok(unitOf(p, "u-build-wo-01-001").depends_on.includes("u-tests-wo-01-001"), "build depends on tests");
  ok(roundIndex(p, "u-tests-wo-01-001") < roundIndex(p, "u-build-wo-01-001"), "tests first");
});

await test("tests-first: the chain's first WO names the tests unit; any WO of the chain triggering is enough", () => {
  const wos = [wo("wo-01-001", { zone: "none" }), wo("wo-01-002", { zone: "r1", acs: ["AC-01-009.1"], dependsOn: ["wo-01-001"] })];
  const p = doPlan(mk(wos, { frdAcs: { "frd-01": ["AC-01-001.1"] } }));
  const b = buildUnits(p);
  eq(b.map((u) => u.wos), [["wo-01-001", "wo-01-002"]], "same cell: a single chain");
  ok(unitOf(p, "u-tests-wo-01-001"), "tests unit is named after the chain's first WO");
});

// ---- purity ----------------------------------------------------------------------------------------------
await test("purity: deterministic output, input untouched (frozen), identical result on a second call", () => {
  const wos = [wo("wo-01-001", { frd: "frd-01" }), wo("wo-01-002", { frd: "frd-01", dependsOn: ["wo-01-001"] }), wo("wo-02-001", { frd: "frd-02" })];
  const input = mk(wos);
  const before = JSON.stringify(input);
  const a = doPlan(input);
  const b = doPlan(input);
  eq(a, b, "two calls give the same plan");
  eq(JSON.stringify(input), before, "input not mutated");
  const shuffled = mk([...wos].reverse());
  eq(doPlan(shuffled).rounds.flat().sort(), a.rounds.flat().sort(), "input order does not change which units exist");
});

await test("planner.mjs imports nothing from build-mech-* (D30: self-contained)", async () => {
  if (loadError) throw new Error(`planner.mjs cannot be loaded (${loadError.code || loadError.name})`);
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(MODULE_PATH, "utf8");
  ok(!/(\bfrom\s+|\bimport\s*\()\s*["'][^"']*build-mech/.test(src), "planner.mjs must not import build-mech-* (v1-only code)");
});

// ---- Judge-3 addition (RULINGS-D1 PL-M1): a card scope is "that card", never every pending WO of its FRDs ----
await test("card scope: scope.card set with frds listed and wos empty plans only the WOs whose source_change names the card", async () => {
  const withSource = (w, source) => ({ ...w, source_change: source });
  const wos = [withSource(wo("wo-a", { frd: "frd-01" }), ["add-filter"]), withSource(wo("wo-b", { frd: "frd-01" }), [])];
  const base = mk(wos);
  const input = deepFreeze({ ...base, wos, scope: { card: "add-filter", frds: ["frd-01"], wos: [], out_of_scope: [] } });
  const p = doPlan(input);
  eq([...new Set(p.units.flatMap((u) => u.wos))].sort(), ["wo-a"], "only the card's WO is planned, wo-b of the same FRD is not pulled in");
  const control = deepFreeze({ ...base, wos, scope: { card: null, frds: ["frd-01"], wos: [], out_of_scope: [] } });
  eq([...new Set(doPlan(control).units.flatMap((u) => u.wos))].sort(), ["wo-a", "wo-b"], "control: without a card the FRD-wide rule still applies");
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
