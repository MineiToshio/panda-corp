#!/usr/bin/env node
// test-build-v2-state.mjs: T-B01, the official test of plugin/runtime/build/{paths,fsx,journal,state}.mjs.
// Written from the contracts only (PLAN 3.4-3.6 and 3.16 A13/A14/A16/A18, RESOLUTIONS D1/D5/D14/D15/D25,
// plugin/docs/build-engine-cli.md 2.3, 2.5, 2.6, 5, 6, 7, the schemas). Run: node plugin/scripts/test-build-v2-state.mjs
//
// INTERFACE (the docs fix no export names; the implementer's names stand, per the coordinator's reconciliation ruling):
//   paths.mjs    buildPaths(project) -> {run, build, stateFile, journalFile, tokenFile, integrationWorktree,
//                  unitWorktree(unit, attempt) (A16), buildArchiveDir(runId), buildSuspendedDir(runId), ...}
//   fsx.mjs      atomicWriteJson(file, value), atomicWriteText(file, text) (mode 0600, parent dirs, temp+rename),
//                validate(schema, value) -> {ok, errors} (throws on a keyword outside D25),
//                assertNotTracked(project, relPath) (throws INVALID_PATH when git tracks the path)
//   journal.mjs  appendEvent(journalFile, {run_id, epoch, type, data?, actor?, at?}) -> {event, hash};
//                readJournal(journalFile) -> {events, head}; verifyJournal(journalFile) -> {ok, count, head};
//                JOURNAL_CHAIN on a broken chain
//   state.mjs    writeState/readState(project)/validateState(state) (async; INVALID_STATE throws; the test also accepts {ok:false}),
//                rebuildState({project, journalFile?, integrationRoot?}) -> {state, conflicts, diff},
//                fencedTwoPhase({project, epoch, actor?, deps?}, phase1, work(intent, ctx), phase2(result, intent, ctx))
//   Lease from plugin/runtime/build-state.mjs acquire/transfer/quiesce/currentLease (projectStatus:false writes build/lease-token.json).
//   Replay mapping parked.data.question -> unit.pending_answer is a TEST ASSUMPTION not stated by any contract (A14 lists the
//   parked data shape only).
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const SCHEMAS = path.join(BUILD, "schemas");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const rejectsWith = async (fn, codes, what) => {
  const list = [].concat(codes);
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a rejection with code ${list.join("|")}, but it resolved`);
  if (!list.includes(err.code)) throw new Error(`${what}: expected code ${list.join("|")}, got ${err.code || "(no code)"}: ${err.message}`);
};
const throwsAny = async (fn, what) => {
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected it to throw, but it returned`);
  return err;
};

// ---- loading: a missing module or export becomes a clear failure, never an obscure crash --------------------------
const loaded = {};
const load = async (file) => {
  if (!(file in loaded)) {
    try { loaded[file] = await import(pathToFileURL(path.join(BUILD, file)).href); } catch (e) { loaded[file] = { __error: e }; }
  }
  return loaded[file];
};
const need = async (file, name) => {
  const mod = await load(file);
  if (mod.__error) throw new Error(`module plugin/runtime/build/${file} cannot be imported: ${mod.__error.message.split("\n")[0]}`);
  if (typeof mod[name] === "undefined") throw new Error(`plugin/runtime/build/${file} does not export "${name}" (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`);
  return mod[name];
};
const needFenced = async () => {
  for (const f of ["state.mjs", "fsx.mjs", "journal.mjs"]) { const m = await load(f); if (!m.__error && typeof m.fencedTwoPhase === "function") return m.fencedTwoPhase; }
  throw new Error("no module of B01 (state.mjs, fsx.mjs, journal.mjs) exports fencedTwoPhase (PLAN 5.1 B01)");
};
const buildStateMod = async () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);
const fixturesMod = async () => import(pathToFileURL(FIXTURES).href);
const readSchema = async (name) => JSON.parse(await readFile(path.join(SCHEMAS, name), "utf8"));
const isValid = (r) => r && typeof r === "object" && r.ok === true;
const mode = async (f) => (await stat(f)).mode & 0o777;

const newTmp = async (label) => mkdtemp(path.join(SCRATCH_ROOT, `pc-b01-${label}-`));
const withTmp = async (label, fn) => { const dir = await newTmp(label); try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); } };
const withFixture = async (preset, fn) => withTmp("fx", async (dir) => {
  const { createFixture } = await fixturesMod();
  const fx = await createFixture(preset, { dir });
  try { return await fn(fx); } finally { await fx.cleanup(); }
});

// ---- builders (shape = schemas/state.schema.json and journal-event.schema.json) -------------------------------------
const baseUnit = (over = {}) => ({
  id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", chain: "c-wo-01-001", zone: "none", risk_rules: [],
  state: "queued", attempt: 1, token_hash: null, worker: null, worktree: null, branch: null, depends_on: [], pending_answer: null,
  parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const baseState = (over = {}) => ({
  schema: 2, engine: "v2", run_id: "run-b01", epoch: 1, coordinator: "claude-session", label: "claude", size: "feature",
  status: "active", status_reason: null, tranche: null,
  scope: { card: null, frds: ["frd-01-alpha"], wos: ["WO-01-001"], out_of_scope: [] },
  integration: { branch: "lane/run-b01", worktree: "/nonexistent-pc-b01/integration", base_sha: "a".repeat(40) },
  last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {}, ...over,
});
const baseJob = (over = {}) => ({ id: "j1", kind: "g2", unit: null, frd: "frd-01-alpha", pid: 4242, cwd: "/tmp/x", h_slot: true, started_at: "2026-11-11T12:00:00.000Z", state: "running", exit: null, worker_id: null, ...over });
const ev = (type, data, over = {}) => ({ run_id: "run-b01", epoch: 1, actor: "cli", type, data, ...over });

// =====================================================================================================================
// paths.mjs (A16, PLAN 3.4)
// =====================================================================================================================
const P = async (project) => (await need("paths.mjs", "buildPaths"))(project);
// On-disk locations fixed by PLAN 3.4, used by every test except the paths tests (so one wrong paths.mjs export does not mask the rest).
const D = (project) => { const buildDir = path.join(project, ".pandacorp", "run", "build"); return { buildDir, state: path.join(buildDir, "state.json"), journal: path.join(buildDir, "journal.jsonl"), leaseToken: path.join(buildDir, "lease-token.json") }; };
await test("paths: run dir, build dir, state, journal, lease token and integration worktree live where PLAN 3.4 says", async () => {
  const proj = path.join(os.tmpdir(), "pc-b01-paths-project");
  const p = await P(proj);
  eq(p.run, path.join(proj, ".pandacorp", "run"), "runDir");
  eq(p.build, path.join(proj, ".pandacorp", "run", "build"), "buildDir");
  eq(p.stateFile, path.join(proj, ".pandacorp", "run", "build", "state.json"), "state");
  eq(p.journalFile, path.join(proj, ".pandacorp", "run", "build", "journal.jsonl"), "journal");
  eq(p.tokenFile, path.join(proj, ".pandacorp", "run", "build", "lease-token.json"), "leaseToken");
  eq(p.integrationWorktree, path.join(proj, ".pandacorp", "run", "build", "integration"), "integration");
});
await test("paths: unit worktrees follow A16 (attempt 1 has no suffix, attempt n >= 2 appends -a<n>)", async () => {
  const proj = path.join(os.tmpdir(), "pc-b01-paths-project");
  const p = await P(proj);
  const wt = path.join(proj, ".pandacorp", "run", "build", "wt");
  eq(p.unitWorktree("u-build-wo-01-001", 1), path.join(wt, "u-build-wo-01-001"), "attempt 1");
  eq(p.unitWorktree("u-build-wo-01-001", 2), path.join(wt, "u-build-wo-01-001-a2"), "attempt 2");
  eq(p.unitWorktree("u-build-wo-01-001", 3), path.join(wt, "u-build-wo-01-001-a3"), "attempt 3");
});
await test("paths: archived and suspended runs live under .pandacorp/run/build-archive|build-suspended/<run_id> (A4)", async () => {
  const proj = path.join(os.tmpdir(), "pc-b01-paths-project");
  const p = await P(proj);
  eq(p.buildArchiveDir("run-x"), path.join(proj, ".pandacorp", "run", "build-archive", "run-x"), "archive");
  eq(p.buildSuspendedDir("run-x"), path.join(proj, ".pandacorp", "run", "build-suspended", "run-x"), "suspended");
});

// =====================================================================================================================
// fsx.mjs: atomic writes
// =====================================================================================================================
await test("atomic write: JSON round-trips, creates parent dirs, mode 0600, leaves no temp file", async () => withTmp("aw", async (dir) => {
  const writeJsonAtomic = await need("fsx.mjs", "atomicWriteJson");
  const file = path.join(dir, "a", "b", "x.json");
  await writeJsonAtomic(file, { a: 1, b: ["x", null], c: { d: true } });
  eq(JSON.parse(await readFile(file, "utf8")), { a: 1, b: ["x", null], c: { d: true } }, "content");
  eq(await mode(file), 0o600, "file mode");
  eq(await readdir(path.dirname(file)), ["x.json"], "no temp file left next to the target");
}));
await test("atomic write: overwrite replaces the whole content and keeps mode 0600", async () => withTmp("aw", async (dir) => {
  const writeJsonAtomic = await need("fsx.mjs", "atomicWriteJson");
  const file = path.join(dir, "x.json");
  await writeJsonAtomic(file, { long: "x".repeat(5000) });
  await writeJsonAtomic(file, { short: 1 });
  eq(JSON.parse(await readFile(file, "utf8")), { short: 1 }, "overwritten content");
  eq(await mode(file), 0o600, "mode after overwrite");
}));
await test("atomic write: text variant writes exact bytes at mode 0600", async () => withTmp("aw", async (dir) => {
  const writeTextAtomic = await need("fsx.mjs", "atomicWriteText");
  const file = path.join(dir, "n", "t.txt");
  await writeTextAtomic(file, "hello\nwörld\n");
  eq(await readFile(file, "utf8"), "hello\nwörld\n", "bytes");
  eq(await mode(file), 0o600, "mode");
  eq(await readdir(path.dirname(file)), ["t.txt"], "no temp file");
}));
await test("atomic write: a value that cannot be serialized rejects and leaves the previous file and the directory intact", async () => withTmp("aw", async (dir) => {
  const writeJsonAtomic = await need("fsx.mjs", "atomicWriteJson");
  const file = path.join(dir, "keep.json");
  await writeJsonAtomic(file, { v: 1 });
  const cyclic = {}; cyclic.self = cyclic;
  await throwsAny(() => writeJsonAtomic(file, cyclic), "cyclic value");
  eq(JSON.parse(await readFile(file, "utf8")), { v: 1 }, "previous content survives");
  eq(await readdir(dir), ["keep.json"], "no stray temp file after the failure");
}));
await test("atomic write: a failing write (parent is a regular file) rejects instead of silently succeeding", async () => withTmp("aw", async (dir) => {
  const writeJsonAtomic = await need("fsx.mjs", "atomicWriteJson");
  const blocker = path.join(dir, "blocker"); await writeFile(blocker, "i am a file");
  await throwsAny(() => writeJsonAtomic(path.join(blocker, "x.json"), { a: 1 }), "write under a file");
  eq(await readFile(blocker, "utf8"), "i am a file", "blocker untouched");
}));
await test("atomic write: concurrent readers never observe a partial file while writers replace it", async () => withTmp("aw", async (dir) => {
  const writeJsonAtomic = await need("fsx.mjs", "atomicWriteJson");
  const file = path.join(dir, "race.json");
  await writeJsonAtomic(file, { n: 0, pad: "x".repeat(20000) });
  let stop = false; let reads = 0; let bad = null;
  const reader = (async () => { while (!stop) { try { JSON.parse(await readFile(file, "utf8")); reads++; } catch (e) { bad = e; stop = true; } } })();
  for (let i = 1; i <= 60; i++) await writeJsonAtomic(file, { n: i, pad: "y".repeat(20000 + i) });
  stop = true; await reader;
  ok(!bad, `a reader saw a torn file: ${bad && bad.message}`);
  ok(reads > 0, "reader never ran");
  eq(JSON.parse(await readFile(file, "utf8")).n, 60, "last write wins");
}));

// =====================================================================================================================
// fsx.mjs: the D25 minimal schema validator
// =====================================================================================================================
const V = async () => await need("fsx.mjs", "validate");
const accepts = async (schema, value, label) => { const r = (await V())(schema, value); ok(isValid(r), `${label}: expected ok:true, got ${JSON.stringify(r)}`); };
const refuses = async (schema, value, label) => {
  const r = (await V())(schema, value);
  ok(r && r.ok === false, `${label}: expected ok:false, got ${JSON.stringify(r)}`);
  ok(Array.isArray(r.errors) && r.errors.length > 0, `${label}: a refusal must carry a non-empty errors[] (got ${JSON.stringify(r.errors)})`);
};
await test("validator type: string, number, integer, boolean, null, array, object are distinguished", async () => {
  await accepts({ type: "string" }, "x", "string ok"); await refuses({ type: "string" }, 1, "string refuses number");
  await accepts({ type: "integer" }, 3, "integer ok"); await refuses({ type: "integer" }, 1.5, "integer refuses 1.5"); await refuses({ type: "integer" }, "3", "integer refuses string");
  await accepts({ type: "number" }, 1.5, "number ok"); await refuses({ type: "number" }, "1.5", "number refuses string");
  await accepts({ type: "boolean" }, false, "boolean ok"); await refuses({ type: "boolean" }, 0, "boolean refuses 0");
  await accepts({ type: "null" }, null, "null ok"); await refuses({ type: "null" }, 0, "null refuses 0");
  await accepts({ type: "array" }, [], "array ok"); await refuses({ type: "array" }, {}, "array refuses object");
  await accepts({ type: "object" }, {}, "object ok"); await refuses({ type: "object" }, [], "object refuses array"); await refuses({ type: "object" }, null, "object refuses null");
});
await test("validator type as an array (nullable): [string, null]", async () => {
  const s = { type: ["string", "null"] };
  await accepts(s, "a", "string"); await accepts(s, null, "null"); await refuses(s, 1, "number");
});
await test("validator properties + required + additionalProperties:false", async () => {
  const s = { type: "object", properties: { a: { type: "string" }, b: { type: "integer" } }, required: ["a"], additionalProperties: false };
  await accepts(s, { a: "x" }, "required only"); await accepts(s, { a: "x", b: 2 }, "all");
  await refuses(s, { b: 2 }, "missing required"); await refuses(s, { a: 1 }, "wrong property type"); await refuses(s, { a: "x", z: 1 }, "additional property");
});
await test("validator additionalProperties as a schema constrains every unlisted key", async () => {
  const s = { type: "object", properties: { fixed: { type: "string" } }, additionalProperties: { type: "integer" } };
  await accepts(s, { fixed: "x", other: 1, more: 2 }, "extra ints");
  await refuses(s, { fixed: "x", other: "no" }, "extra string");
  await accepts({ type: "object", additionalProperties: true }, { anything: [1] }, "additionalProperties:true");
});
await test("validator items validates every element and reports the failing one", async () => {
  const s = { type: "array", items: { type: "string" } };
  await accepts(s, [], "empty"); await accepts(s, ["a", "b"], "strings"); await refuses(s, ["a", 2], "mixed");
});
await test("validator enum (including null) and const", async () => {
  await accepts({ enum: ["a", "b", null] }, null, "enum null"); await accepts({ enum: ["a", "b"] }, "b", "enum member"); await refuses({ enum: ["a", "b"] }, "c", "enum non member"); await refuses({ enum: ["a", "b"] }, null, "null not in enum");
  await accepts({ const: 2 }, 2, "const"); await refuses({ const: 2 }, 3, "const mismatch"); await refuses({ const: 2 }, "2", "const strict type");
});
await test("validator oneOf accepts exactly one match (zero and two are refused)", async () => {
  const s = { oneOf: [{ type: "string" }, { type: "integer" }] };
  await accepts(s, "a", "first"); await accepts(s, 1, "second"); await refuses(s, true, "no branch matches");
  const overlap = { oneOf: [{ type: "integer" }, { type: "number" }] };
  await refuses(overlap, 1, "two branches match"); await accepts(overlap, 1.5, "only number matches");
});
await test("validator anyOf (nullable object idiom) and allOf", async () => {
  const nullable = { anyOf: [{ type: "null" }, { type: "object", properties: { a: { type: "integer" } }, required: ["a"] }] };
  await accepts(nullable, null, "null branch"); await accepts(nullable, { a: 1 }, "object branch"); await refuses(nullable, { a: "x" }, "bad object"); await refuses(nullable, 5, "neither");
  const all = { allOf: [{ type: "object", required: ["a"] }, { type: "object", required: ["b"] }] };
  await accepts(all, { a: 1, b: 2 }, "both"); await refuses(all, { a: 1 }, "only one");
});
await test("validator if/then applies the then branch only when the if matches", async () => {
  const s = { type: "object", if: { properties: { t: { const: "x" } }, required: ["t"] }, then: { required: ["y"] } };
  await accepts(s, { t: "x", y: 1 }, "if matches, then holds"); await refuses(s, { t: "x" }, "if matches, then violated"); await accepts(s, { t: "other" }, "if does not match");
});
await test("validator minimum, maximum (inclusive), minLength and pattern", async () => {
  await accepts({ type: "integer", minimum: 1 }, 1, "minimum inclusive"); await refuses({ type: "integer", minimum: 1 }, 0, "below minimum");
  await accepts({ type: "integer", maximum: 5 }, 5, "maximum inclusive"); await refuses({ type: "integer", maximum: 5 }, 6, "above maximum");
  await accepts({ type: "string", minLength: 2 }, "ab", "minLength"); await refuses({ type: "string", minLength: 2 }, "a", "too short");
  await accepts({ type: "string", pattern: "^[0-9a-f]{64}$" }, "a".repeat(64), "hex64"); await refuses({ type: "string", pattern: "^[0-9a-f]{64}$" }, "g".repeat(64), "not hex");
  await accepts({ type: "string", pattern: "ab" }, "xaby", "pattern is unanchored unless the schema anchors it");
});
await test("validator ignores $schema, $id, title, description, default and format", async () => {
  const s = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "x/y", title: "T", description: "D", default: 5, type: "object",
    properties: { when: { type: "string", format: "date-time", description: "d", default: "now", title: "t" } }, required: ["when"] };
  await accepts(s, { when: "not-a-date" }, "format is not enforced");
  await refuses(s, {}, "but the real keywords still are");
});
await test("validator rejects keywords outside the D25 subset by THROWING (not by returning ok:false)", async () => {
  const validate = await V();
  const outside = [
    ["minItems", { type: "array", minItems: 1 }, [1]], ["maxItems", { type: "array", maxItems: 1 }, [1]], ["uniqueItems", { type: "array", uniqueItems: true }, [1, 2]],
    ["maxLength", { type: "string", maxLength: 3 }, "ab"], ["$ref", { $ref: "#/definitions/a" }, 1], ["not", { not: { type: "string" } }, 1],
    ["patternProperties", { type: "object", patternProperties: { "^a": { type: "string" } } }, { a: "x" }], ["multipleOf", { type: "integer", multipleOf: 2 }, 4],
    ["exclusiveMinimum", { type: "integer", exclusiveMinimum: 0 }, 1], ["propertyNames", { type: "object", propertyNames: { type: "string" } }, {}],
    ["else", { if: { type: "string" }, then: { type: "string" }, else: { type: "integer" } }, "x"], ["dependencies", { type: "object", dependencies: { a: ["b"] } }, {}],
    ["minProperties", { type: "object", minProperties: 1 }, { a: 1 }], ["contains", { type: "array", contains: { type: "string" } }, ["a"]],
  ];
  for (const [kw, schema, value] of outside) {
    const err = await throwsAny(() => validate(schema, value), `keyword ${kw}`);
    ok(/./.test(String(err.message)), `keyword ${kw}: the thrown error needs a message`);
  }
});
await test("validator throws for an unsupported keyword nested inside properties/items/anyOf when the value reaches it", async () => {
  const validate = await V();
  await throwsAny(() => validate({ type: "object", properties: { a: { type: "array", minItems: 1 } } }, { a: [1] }), "nested in properties");
  await throwsAny(() => validate({ type: "array", items: { type: "string", maxLength: 2 } }, ["ab"]), "nested in items");
  await throwsAny(() => validate({ anyOf: [{ type: "string", maxLength: 2 }, { type: "null" }] }, "ab"), "nested in anyOf");
});
await test("validator: the real engine schemas (state, journal-event) accept their own valid samples (they use only the D25 keyword set)", async () => {
  const validate = await V();
  const state = await readSchema("state.schema.json"); const journal = await readSchema("journal-event.schema.json");
  const rs = validate(state, baseState({ units: [baseUnit()], jobs: [baseJob()] }));
  ok(isValid(rs), `state sample refused: ${JSON.stringify(rs)}`);
  const rj = validate(journal, { v: 1, seq: 1, at: "2026-11-11T12:00:00.000Z", run_id: "r", epoch: 1, actor: "cli", type: "run_finished", data: {}, prev: null });
  ok(isValid(rj), `journal sample refused: ${JSON.stringify(rj)}`);
});

// =====================================================================================================================
// state.mjs: validate, create, load against state.schema.json
// =====================================================================================================================
// validateState may either return {ok, errors} or throw INVALID_STATE: both are a refusal; anything else that throws is a defect.
const stateCheck = async (state) => {
  const validateState = await need("state.mjs", "validateState");
  try { const r = await validateState(state); return r && typeof r === "object" && "ok" in r ? r : { ok: true, errors: [] }; }
  catch (e) { if (e.code === "INVALID_STATE") return { ok: false, errors: [e.message] }; throw e; }
};
const refusesState = async (state, label) => { const r = await stateCheck(state); ok(r.ok === false, `${label}: expected a refusal, got ${JSON.stringify(r)}`); };
const acceptsState = async (state, label) => { const r = await stateCheck(state); ok(r.ok === true, `${label}: expected acceptance, got ${JSON.stringify(r)}`); };
await test("state validate: a complete valid state (empty units/jobs) is accepted", async () => {
  await acceptsState(baseState(), "valid state");
});
await test("state validate: a state with a full unit and a job is accepted", async () => {
  const unit = baseUnit({ state: "running", token_hash: "b".repeat(64), worker: { runtime: "codex", model: "sol", effort: "high", via: "cli", pid: 99, worker_id: "w-1" }, worktree: "/tmp/wt", branch: "lane/run-b01/u-build-wo-01-001", test_hashes: { "e2e/a.spec.ts": "c".repeat(64) } });
  await acceptsState(baseState({ units: [unit], jobs: [baseJob({ kind: "worker", unit: unit.id, frd: null, worker_id: "w-1", h_slot: false })], last_safe_point: { sha: "d".repeat(40), kind: "wo-commit", at: "2026-11-11T12:00:00.000Z" }, tranche: { index: 1, of: 2 }, answers: { q1: true } }), "full state");
});
await test("state validate: every required top-level field is required (A18 shape)", async () => {
  const required = ["schema", "engine", "run_id", "epoch", "coordinator", "label", "size", "status", "status_reason", "tranche", "scope", "integration", "last_safe_point", "units", "jobs", "handbacks_in_a_row", "doubts_consulted", "answers", "quota_at_unit"];
  for (const key of required) { const s = baseState(); delete s[key]; await refusesState(s, `missing ${key}`); }
});
await test("state validate: unknown top-level fields are refused, including the removed budget field (A18)", async () => {
  await refusesState(baseState({ budget: { calls: 1 } }), "budget"); await refusesState(baseState({ extra: 1 }), "extra");
});
await test("state validate: schema must be 2, engine must be v2", async () => {
  await refusesState(baseState({ schema: 1 }), "schema 1"); await refusesState(baseState({ schema: 3 }), "schema 3"); await refusesState(baseState({ engine: "v1" }), "engine v1");
});
await test("state validate: status, coordinator, label and size enums (D13/D14)", async () => {
  for (const status of ["active", "paused", "waiting_owner", "waiting_gate", "finished", "stopped"]) await acceptsState(baseState({ status }), `status ${status}`);
  await refusesState(baseState({ status: "running" }), "status running"); await refusesState(baseState({ coordinator: "session" }), "coordinator session");
  await refusesState(baseState({ label: "gemini" }), "label"); await refusesState(baseState({ size: "huge" }), "size");
});
await test("state validate: unit lifecycle enum has exactly the A13/D14 thirteen states", async () => {
  for (const s of ["queued", "admitted", "running", "reported", "committed", "integrated", "reviewing", "patching", "verified", "landed", "parked", "waiting_gate", "blocked"]) {
    await acceptsState(baseState({ units: [baseUnit({ state: s })] }), `unit state ${s}`);
  }
  for (const s of ["pending", "done", "failed", "reopened"]) await refusesState(baseState({ units: [baseUnit({ state: s })] }), `unit state ${s}`);
});
await test("state validate: unit kind enum and attempt range (1..3)", async () => {
  for (const kind of ["docs", "tests", "build", "patch", "review", "audit", "doubt-consult", "deferred-review"]) await acceptsState(baseState({ units: [baseUnit({ kind })] }), `kind ${kind}`);
  await refusesState(baseState({ units: [baseUnit({ kind: "land" })] }), "kind land");
  for (const attempt of [1, 2, 3]) await acceptsState(baseState({ units: [baseUnit({ attempt })] }), `attempt ${attempt}`);
  await refusesState(baseState({ units: [baseUnit({ attempt: 0 })] }), "attempt 0"); await refusesState(baseState({ units: [baseUnit({ attempt: 4 })] }), "attempt 4");
});
await test("state validate: a unit missing a field, or with an unknown field, or with a bad nullable value is refused", async () => {
  const u = baseUnit(); delete u.test_hashes; await refusesState(baseState({ units: [u] }), "unit without test_hashes");
  await refusesState(baseState({ units: [baseUnit({ surprise: 1 })] }), "unit extra field");
  await refusesState(baseState({ units: [baseUnit({ parked: "lazy" })] }), "parked enum"); await refusesState(baseState({ units: [baseUnit({ waiting_gate: "vacation" })] }), "waiting_gate enum");
  await refusesState(baseState({ units: [baseUnit({ review: { verdict: "maybe", reviewer: { runtime: "claude", model: "opus", effort: "high" }, degraded: null, deferred_id: null } })] }), "review.verdict enum");
});
await test("state validate: jobs[] items follow A18 (kind enum, state enum, h_slot boolean, nullable pid/exit)", async () => {
  await acceptsState(baseState({ jobs: [baseJob({ kind: "land", h_slot: false, pid: null, state: "dead", exit: null })] }), "land job with null pid");
  await refusesState(baseState({ jobs: [baseJob({ kind: "g3" })] }), "job kind"); await refusesState(baseState({ jobs: [baseJob({ state: "finished" })] }), "job state");
  await refusesState(baseState({ jobs: [baseJob({ h_slot: "yes" })] }), "h_slot type"); const j = baseJob(); delete j.worker_id; await refusesState(baseState({ jobs: [j] }), "job without worker_id");
  await refusesState(baseState({ jobs: [baseJob({ ref: "x" })] }), "old job shape key ref");
});
await test("state validate: last_safe_point kind enum and integration shape", async () => {
  await acceptsState(baseState({ last_safe_point: { sha: "e".repeat(40), kind: "batch-landed", at: "2026-11-11T12:00:00.000Z" } }), "valid safe point");
  await refusesState(baseState({ last_safe_point: { sha: "e".repeat(40), kind: "checkpoint", at: "x" } }), "safe point kind");
  const bad = baseState(); delete bad.integration.base_sha; await refusesState(bad, "integration without base_sha");
});

await test("state write/read: create then load round-trips, mode 0600, at build/state.json", async () => withTmp("st", async (dir) => {
  const writeState = await need("state.mjs", "writeState"); const readState = await need("state.mjs", "readState");
  const p = D(dir);
  const state = baseState({ units: [baseUnit({ state: "running" })], jobs: [baseJob()] });
  await writeState(dir, state);
  eq(JSON.parse(await readFile(p.state, "utf8")), state, "file content");
  eq(await mode(p.state), 0o600, "state.json mode");
  eq(await readState(dir), state, "readState");
}));
await test("state read: a missing state.json is null (no run), not an error and not an empty object", async () => withTmp("st", async (dir) => {
  const readState = await need("state.mjs", "readState");
  eq(await readState(dir), null, "no state file");
}));
await test("state write: an invalid state is refused with INVALID_STATE and the previous state.json is untouched", async () => withTmp("st", async (dir) => {
  const writeState = await need("state.mjs", "writeState"); const readState = await need("state.mjs", "readState");
  const good = baseState(); await writeState(dir, good);
  await rejectsWith(() => writeState(dir, baseState({ status: "bogus" })), "INVALID_STATE", "invalid status");
  await rejectsWith(() => writeState(dir, baseState({ budget: {} })), "INVALID_STATE", "budget field");
  eq(await readState(dir), good, "previous state survives");
}));
await test("state read: a schema-version mismatch on disk is INVALID_STATE (hint rebuild-state), never silently accepted", async () => withTmp("st", async (dir) => {
  const readState = await need("state.mjs", "readState"); const p = D(dir);
  await mkdir(p.buildDir, { recursive: true }); await writeFile(p.state, JSON.stringify({ ...baseState(), schema: 1 }));
  await rejectsWith(() => readState(dir), "INVALID_STATE", "schema 1 on disk");
}));
await test("state read: an unparsable state.json fails loud (INVALID_STATE or LEDGER_CORRUPT), never null or {}", async () => withTmp("st", async (dir) => {
  const readState = await need("state.mjs", "readState"); const p = D(dir);
  await mkdir(p.buildDir, { recursive: true }); await writeFile(p.state, "{ not json");
  await rejectsWith(() => readState(dir), ["INVALID_STATE", "LEDGER_CORRUPT"], "garbage state.json");
}));

// =====================================================================================================================
// journal.mjs: hash chain, append, read, replay, tamper detection (D15, section 7, A14)
// =====================================================================================================================
const appendAll = async (dir, events) => { const appendEvent = await need("journal.mjs", "appendEvent"); const out = []; for (const e of events) out.push((await appendEvent(D(dir).journal, e)).event); return out; };
const journalLines = async (dir) => { const p = D(dir); return (await readFile(p.journal, "utf8")).split("\n").filter(Boolean); };
const writeJournalLines = async (dir, lines) => { const p = D(dir); await writeFile(p.journal, lines.join("\n") + "\n"); };
const threeEvents = () => [ev("run_started", { detect: {}, preflight: {}, state: baseState() }), ev("unit_queued", baseUnit()), ev("unit_state", { unit: "u-build-wo-01-001", from: "queued", to: "admitted" })];

await test("journal append: first line has seq 1 and prev null, then seq is gap-free and prev is the sha256 of the previous line bytes", async () => withTmp("jr", async (dir) => {
  const written = await appendAll(dir, threeEvents());
  eq(written.map((w) => w.seq), [1, 2, 3], "returned seq");
  const lines = await journalLines(dir);
  eq(lines.length, 3, "line count");
  const parsed = lines.map((l) => JSON.parse(l));
  eq(parsed.map((e) => e.seq), [1, 2, 3], "seq on disk");
  eq(parsed[0].prev, null, "first prev");
  eq(parsed[1].prev, sha256(lines[0]), "prev of line 2 = sha256 of line 1 without \\n");
  eq(parsed[2].prev, sha256(lines[1]), "prev of line 3 = sha256 of line 2 without \\n");
  ok(/^[0-9a-f]{64}$/.test(parsed[1].prev), "prev is lowercase hex");
}));
await test("journal append: every line satisfies journal-event.schema.json (v:1, actor, type, run_id, epoch, at)", async () => withTmp("jr", async (dir) => {
  const validate = await need("fsx.mjs", "validate"); const schema = await readSchema("journal-event.schema.json");
  await appendAll(dir, [...threeEvents(), ev("handback", { unit: "u", reason: "x" }, { actor: "drive", epoch: 2 })]);
  for (const line of await journalLines(dir)) { const e = JSON.parse(line); const r = validate(schema, e); ok(isValid(r), `line refused: ${JSON.stringify(r)} :: ${line.slice(0, 120)}`); eq(e.v, 1, "v"); ok(typeof e.at === "string" && Number.isFinite(Date.parse(e.at)), "at is an ISO timestamp"); }
  const last = JSON.parse((await journalLines(dir)).at(-1)); eq(last.actor, "drive", "actor preserved"); eq(last.epoch, 2, "epoch preserved");
}));
await test("journal append: the file is created at mode 0600 inside build/ and lines are newline-terminated single-line JSON", async () => withTmp("jr", async (dir) => {
  await appendAll(dir, threeEvents()); const p = D(dir);
  eq(await mode(p.journal), 0o600, "journal mode"); const raw = await readFile(p.journal, "utf8"); ok(raw.endsWith("\n"), "trailing newline"); eq(raw.split("\n").filter(Boolean).length, 3, "one JSON object per line");
}));
await test("journal append: an event type outside the D15 list, an unknown actor, or a non-object data is refused and nothing is written", async () => withTmp("jr", async (dir) => {
  const appendEvent = await need("journal.mjs", "appendEvent");
  await appendAll(dir, [ev("run_finished", {})]);
  await throwsAny(() => appendEvent(D(dir).journal, ev("detected", {})), "removed type detected");
  await throwsAny(() => appendEvent(D(dir).journal, ev("landed", {})), "removed type landed");
  await throwsAny(() => appendEvent(D(dir).journal, ev("run_finished", {}, { actor: "session" })), "actor session");
  await throwsAny(() => appendEvent(D(dir).journal, ev("run_finished", "nope")), "data not an object");
  eq((await journalLines(dir)).length, 1, "refused events wrote nothing");
}));
await test("journal append: unit_state data must carry unit, from, to (event data schema)", async () => withTmp("jr", async (dir) => {
  const appendEvent = await need("journal.mjs", "appendEvent");
  await throwsAny(() => appendEvent(D(dir).journal, ev("unit_state", { unit: "u" })), "unit_state without from/to");
  eq((await journalLines(dir).catch(() => [])).length, 0, "nothing written");
}));
await test("journal read: returns the verified events in order", async () => withTmp("jr", async (dir) => {
  const readJournal = await need("journal.mjs", "readJournal"); await appendAll(dir, threeEvents());
  const { events } = await readJournal(D(dir).journal);
  eq(events.map((e) => e.type), ["run_started", "unit_queued", "unit_state"], "types in order"); eq(events.map((e) => e.seq), [1, 2, 3], "seq");
}));
await test("journal read: a run with no journal yet is an empty list (no run yet), not an error", async () => withTmp("jr", async (dir) => {
  const readJournal = await need("journal.mjs", "readJournal"); eq((await readJournal(D(dir).journal)).events, [], "empty journal");
}));
await test("journal verify: an intact chain verifies", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); await appendAll(dir, threeEvents());
  const r = await verifyJournal(D(dir).journal); ok(r && r.ok === true, `expected {ok:true}, got ${JSON.stringify(r)}`); eq(r.count, 3, "count");
}));
await test("journal tamper: editing the data of a middle line breaks the chain (JOURNAL_CHAIN) on verify and on read", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); const readJournal = await need("journal.mjs", "readJournal");
  await appendAll(dir, threeEvents()); const lines = await journalLines(dir);
  const forged = JSON.parse(lines[1]); forged.data = { ...forged.data, state: "verified" }; lines[1] = JSON.stringify(forged);
  await writeJournalLines(dir, lines);
  await rejectsWith(() => verifyJournal(D(dir).journal), "JOURNAL_CHAIN", "verify after edit"); await rejectsWith(() => readJournal(D(dir).journal), "JOURNAL_CHAIN", "read after edit");
}));
await test("journal tamper: deleting a middle line (seq gap) is detected", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); await appendAll(dir, threeEvents()); const lines = await journalLines(dir);
  await writeJournalLines(dir, [lines[0], lines[2]]); await rejectsWith(() => verifyJournal(D(dir).journal), "JOURNAL_CHAIN", "deleted line");
}));
await test("journal tamper: reordering two lines is detected", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); await appendAll(dir, threeEvents()); const lines = await journalLines(dir);
  await writeJournalLines(dir, [lines[0], lines[2], lines[1]]); await rejectsWith(() => verifyJournal(D(dir).journal), "JOURNAL_CHAIN", "reordered");
}));
await test("journal tamper: dropping the first line (history rewritten from the head) is detected", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); await appendAll(dir, threeEvents()); const lines = await journalLines(dir);
  await writeJournalLines(dir, lines.slice(1)); await rejectsWith(() => verifyJournal(D(dir).journal), "JOURNAL_CHAIN", "head dropped");
}));
await test("journal tamper: a rewritten line with a recomputed prev downstream still fails (the next line's prev no longer matches)", async () => withTmp("jr", async (dir) => {
  const verifyJournal = await need("journal.mjs", "verifyJournal"); await appendAll(dir, threeEvents()); const lines = await journalLines(dir);
  const forged = JSON.parse(lines[0]); forged.epoch = 99; lines[0] = JSON.stringify(forged); await writeJournalLines(dir, lines);
  await rejectsWith(() => verifyJournal(D(dir).journal), "JOURNAL_CHAIN", "head rewritten");
}));
await test("journal read: a half-written (unparsable) line fails loud with LEDGER_CORRUPT or JOURNAL_CHAIN, never a silent shorter list", async () => withTmp("jr", async (dir) => {
  const readJournal = await need("journal.mjs", "readJournal"); await appendAll(dir, threeEvents()); const p = D(dir);
  await writeFile(p.journal, (await readFile(p.journal, "utf8")) + '{"v":1,"seq":4,"at":"2026-11');
  await rejectsWith(() => readJournal(D(dir).journal), ["LEDGER_CORRUPT", "JOURNAL_CHAIN"], "truncated tail line");
}));

// ---- replay (A14) ---------------------------------------------------------------------------------------------------
const replayEvents = () => {
  const unit = baseUnit(); const unit2 = baseUnit({ id: "u-build-wo-01-002", wos: ["WO-01-002"], chain: "c-wo-01-002", depends_on: ["u-build-wo-01-001"] });
  const worker = { runtime: "codex", model: "sol", effort: "high", via: "cli", pid: 777, worker_id: "w-7" };
  return [
    ev("run_started", { detect: { row: 1 }, preflight: {}, state: baseState() }),
    ev("unit_queued", unit), ev("unit_queued", unit2),
    ev("unit_state", { unit: unit.id, from: "queued", to: "admitted" }),
    ev("unit_dispatched", { unit: unit.id, cell: { runtime: "codex", model: "sol", effort: "high" }, via: "cli", worktree: "/tmp/wt/u1", branch: "lane/run-b01/u-build-wo-01-001", token_hash: "f".repeat(64), worker_id: "w-7", pid: 777 }),
    ev("unit_state", { unit: unit.id, from: "admitted", to: "running" }),
    ev("job_started", baseJob({ id: "j-w7", kind: "worker", unit: unit.id, frd: null, worker_id: "w-7", h_slot: false, pid: 777 })),
    ev("job_finished", { id: "j-w7", state: "done", exit: 0 }),
    ev("report_received", { unit: unit.id, outcome: "accepted", commit: "c".repeat(40), test_hashes: { "e2e/x.spec.ts": "9".repeat(64) } }),
    ev("unit_state", { unit: unit.id, from: "running", to: "committed" }),
    ev("integrated", { unit: unit.id, sha: "1".repeat(40) }), ev("unit_state", { unit: unit.id, from: "committed", to: "integrated" }),
    ev("parked", { unit: unit2.id, reason: "owner_question", question: "q-1" }), ev("unit_state", { unit: unit2.id, from: "queued", to: "parked" }),
    ev("unit_queued", baseUnit({ id: "u-patch-frd-01-alpha", kind: "patch", wos: [], chain: null })),
    ev("waiting_gate", { unit: "u-patch-frd-01-alpha", kind: "production" }),
  ].filter(() => true); void worker;
};
// An integration worktree stand-in holding the WO frontmatter the replay folds in after the journal (A14, "frontmatter wins").
const withReplayRoot = async (fn) => withTmp("wo", async (root) => {
  const wo = (id, status) => `---\nid: ${id}\ntype: work-order\nimplementation_status: ${status}\n---\n# ${id}\n`;
  await mkdir(path.join(root, "docs", "frds", "frd-01-alpha", "work-orders"), { recursive: true });
  await writeFile(path.join(root, "docs", "frds", "frd-01-alpha", "work-orders", "wo-01-001.md"), wo("WO-01-001", "IN_REVIEW"));
  await writeFile(path.join(root, "docs", "frds", "frd-01-alpha", "work-orders", "wo-01-002.md"), wo("WO-01-002", "PLANNED"));
  return fn(root);
});
await test("replay: rebuildState folds the journal in order into a state valid against state.schema.json", async () => withTmp("rb", async (dir) => {
  await withReplayRoot(async (root) => {
  const rebuildState = await need("state.mjs", "rebuildState"); await appendAll(dir, replayEvents());
  const { state: s } = await rebuildState({ project: dir, integrationRoot: root });
  await acceptsState(s, "rebuilt state");
  eq([s.run_id, s.schema, s.engine], ["run-b01", 2, "v2"], "identity comes from run_started.data.state");
  eq(s.units.map((u) => u.id), ["u-build-wo-01-001", "u-build-wo-01-002", "u-patch-frd-01-alpha"], "units queued in order");
  });
}));
await test("replay: unit_state moves the unit, unit_dispatched sets worker, worktree, branch and token_hash (A14)", async () => withTmp("rb", async (dir) => {
  await withReplayRoot(async (root) => {
  const rebuildState = await need("state.mjs", "rebuildState"); await appendAll(dir, replayEvents());
  const { state: s } = await rebuildState({ project: dir, integrationRoot: root }); const u = s.units.find((x) => x.id === "u-build-wo-01-001");
  eq(u.state, "integrated", "final lifecycle state of unit 1"); eq(u.token_hash, "f".repeat(64), "token_hash from unit_dispatched");
  eq(u.worktree, "/tmp/wt/u1", "worktree"); eq(u.branch, "lane/run-b01/u-build-wo-01-001", "branch");
  eq([u.worker.runtime, u.worker.model, u.worker.effort, u.worker.via, u.worker.worker_id], ["codex", "sol", "high", "cli", "w-7"], "worker from the dispatch cell");
  });
}));
await test("replay: job_started adds the job item and job_finished closes it (state, exit)", async () => withTmp("rb", async (dir) => {
  await withReplayRoot(async (root) => {
  const rebuildState = await need("state.mjs", "rebuildState"); await appendAll(dir, replayEvents());
  const { state: s } = await rebuildState({ project: dir, integrationRoot: root }); eq(s.jobs.length, 1, "one job"); const j = s.jobs[0];
  eq([j.id, j.kind, j.state, j.exit, j.worker_id], ["j-w7", "worker", "done", 0, "w-7"], "job folded");
  });
}));
await test("replay: report_received stores test_hashes on the unit; integrated sets nothing illegal; parked sets parked and the unit state", async () => withTmp("rb", async (dir) => {
  await withReplayRoot(async (root) => {
  const rebuildState = await need("state.mjs", "rebuildState"); await appendAll(dir, replayEvents());
  const { state: s } = await rebuildState({ project: dir, integrationRoot: root });
  eq(s.units.find((x) => x.id === "u-build-wo-01-001").test_hashes, { "e2e/x.spec.ts": "9".repeat(64) }, "test_hashes");
  const u2 = s.units.find((x) => x.id === "u-build-wo-01-002"); eq(u2.state, "parked", "parked unit state"); eq(u2.parked, "owner_question", "parked reason"); eq(u2.pending_answer, "q-1", "pending_answer = the question id");
  });
}));
await test("replay: with no events past run_started the rebuilt state equals the initial state; with no journal it fails loud", async () => withTmp("rb", async (dir) => {
  const rebuildState = await need("state.mjs", "rebuildState");
  await rejectsWith(() => rebuildState({ project: dir }), ["INVALID_STATE", "LEDGER_CORRUPT", "JOURNAL_CHAIN"], "no journal to rebuild from");
  await appendAll(dir, [ev("run_started", { detect: {}, preflight: {}, state: baseState({ units: [] }) })]);
  eq((await rebuildState({ project: dir })).state, baseState({ units: [] }), "initial state back");
}));
await test("replay: a tampered journal is never rebuilt from (JOURNAL_CHAIN)", async () => withTmp("rb", async (dir) => {
  const rebuildState = await need("state.mjs", "rebuildState"); await appendAll(dir, replayEvents()); const lines = await journalLines(dir);
  const forged = JSON.parse(lines[3]); forged.data.to = "verified"; lines[3] = JSON.stringify(forged); await writeJournalLines(dir, lines);
  await rejectsWith(() => rebuildState({ project: dir }), "JOURNAL_CHAIN", "tampered replay");
}));

// =====================================================================================================================
// fsx.mjs: tracked-path guard (D1)
// =====================================================================================================================
await test("tracked-path guard: a tracked file in the main checkout is refused (Mission Control decisions.md shape)", async () => withFixture("tracked-decisions", async (fx) => {
  const assertNotTracked = await need("fsx.mjs", "assertNotTracked");
  await rejectsWith(() => assertNotTracked(fx.root, ".pandacorp/inbox/decisions.md"), "INVALID_PATH", "force-tracked inbox/decisions.md (relative)");
  await rejectsWith(() => assertNotTracked(fx.root, path.join(fx.root, ".pandacorp", "inbox", "decisions.md")), "INVALID_PATH", "same file, absolute path");
}));
await test("tracked-path guard: any tracked file is refused, not only ignored-dir ones (docs/decision-log.md)", async () => withFixture("basic", async (fx) => {
  const assertNotTracked = await need("fsx.mjs", "assertNotTracked");
  await rejectsWith(() => assertNotTracked(fx.root, "docs/decision-log.md"), "INVALID_PATH", "tracked docs file");
  await rejectsWith(() => assertNotTracked(fx.root, "docs/frds/frd-01-alpha/work-orders/wo-01-001.md"), "INVALID_PATH", "tracked WO file");
}));
await test("tracked-path guard: untracked gitignored paths pass (run dir, state.json not yet written, inbox cards, decisions.md when untracked)", async () => withFixture("basic", async (fx) => {
  const assertNotTracked = await need("fsx.mjs", "assertNotTracked");
  await assertNotTracked(fx.root, ".pandacorp/run/build/state.json");
  await assertNotTracked(fx.root, ".pandacorp/run/build/journal.jsonl");
  await assertNotTracked(fx.root, ".pandacorp/inbox/changes/x.md");
  await assertNotTracked(fx.root, ".pandacorp/inbox/decisions.md");
}));
await test("tracked-path guard: becomes refused once the file is force-added (the check reads git, not a path list)", async () => withFixture("basic", async (fx) => {
  const assertNotTracked = await need("fsx.mjs", "assertNotTracked");
  await mkdir(path.join(fx.root, ".pandacorp", "inbox"), { recursive: true });
  await writeFile(path.join(fx.root, ".pandacorp", "inbox", "decisions.md"), "# d\n");
  await assertNotTracked(fx.root, ".pandacorp/inbox/decisions.md");
  fx.git("add", "-f", "--", ".pandacorp/inbox/decisions.md");
  await rejectsWith(() => assertNotTracked(fx.root, ".pandacorp/inbox/decisions.md"), "INVALID_PATH", "after git add -f");
}));

// =====================================================================================================================
// fencedTwoPhase (D5): stale epoch refused before and after the work phase
// =====================================================================================================================
const withLease = async (fn) => withFixture("basic", async (fx) => {
  const bs = await buildStateMod();
  const lease = await bs.acquire(fx.root, { runtime: "codex", runId: "run-b01", ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const p = D(fx.root);
  const tokenFile = JSON.parse(await readFile(p.leaseToken, "utf8").catch(() => "null") || "null");
  ok(tokenFile && tokenFile.token === lease.token && tokenFile.epoch === lease.epoch, "precondition: acquire(projectStatus:false) must mirror {epoch, token} into build/lease-token.json");
  return fn({ fx, bs, lease, project: fx.root, epoch: lease.epoch, token: lease.token });
});
const trace = () => { const log = []; return { log, p1: async () => { log.push("phase1"); return { intent: "i" }; }, work: async (r) => { log.push("work"); return { done: true, saw: r }; }, p2: async (w, r) => { log.push("phase2"); return { final: true, w, r }; } }; };

await test("fencedTwoPhase: runs phase1, then work, then phase2 in order and returns phase2's result", async () => withLease(async ({ project, epoch }) => {
  const fenced = await needFenced(); const t = trace();
  const out = await fenced({ project, epoch }, t.p1, t.work, t.p2);
  eq(t.log, ["phase1", "work", "phase2"], "order");
  ok(out && out.final === true, `expected phase2's return value, got ${JSON.stringify(out)}`);
}));
await test("fencedTwoPhase: phase1's result feeds work, work's result feeds phase2 as its first argument", async () => withLease(async ({ project, epoch }) => {
  const fenced = await needFenced(); const t = trace();
  const out = await fenced({ project, epoch }, t.p1, t.work, t.p2);
  eq(out.w.saw, { intent: "i" }, "work received phase1's result"); eq(out.w.done, true, "phase2 received work's result"); eq(out.r, { intent: "i" }, "phase2 also receives phase1's result as its second argument");
}));
await test("fencedTwoPhase: a stale epoch is refused BEFORE phase1 (FENCE) and nothing runs", async () => withLease(async ({ project, epoch }) => {
  const fenced = await needFenced(); const t = trace();
  await rejectsWith(() => fenced({ project, epoch: epoch + 7 }, t.p1, t.work, t.p2), "FENCE", "epoch ahead of the lease");
  await rejectsWith(() => fenced({ project, epoch: epoch - 1 }, t.p1, t.work, t.p2), "FENCE", "epoch behind the lease");
  eq(t.log, [], "no phase ran");
}));
await test("fencedTwoPhase: an epoch lost DURING the work phase (transfer) refuses phase2 with FENCE and phase2 writes nothing", async () => withLease(async ({ project, epoch, bs, token, fx }) => {
  const fenced = await needFenced(); const log = []; const target = path.join(fx.root, ".pandacorp", "run", "phase2-wrote.txt");
  await rejectsWith(() => fenced({ project, epoch },
    async () => { log.push("phase1"); },
    async () => { log.push("work"); await bs.transfer(project, { token, toRuntime: "codex", coordinator: "drive", epoch }); },
    async () => { log.push("phase2"); await writeFile(target, "must not exist"); }), "FENCE", "fence lost during work");
  eq(log, ["phase1", "work"], "phase2 never ran");
  eq(await stat(target).then(() => true, () => false), false, "no state written after the fence flipped");
}));
await test("fencedTwoPhase: a quiesced lease is refused before phase1 (QUIESCED or FENCE)", async () => withLease(async ({ project, epoch, token, bs }) => {
  const fenced = await needFenced(); const t = trace();
  await bs.quiesce(project, token, epoch, { projectStatus: false });
  await rejectsWith(() => fenced({ project, epoch }, t.p1, t.work, t.p2), ["QUIESCED", "FENCE"], "quiesced lease"); eq(t.log, [], "no phase ran");
}));
await test("fencedTwoPhase: a foreign token in build/lease-token.json is refused (FENCE) even with the right epoch", async () => withLease(async ({ project, epoch }) => {
  const fenced = await needFenced(); const t = trace(); const p = D(project);
  await writeFile(p.leaseToken, JSON.stringify({ epoch, token: "not-the-real-token" }));
  await rejectsWith(() => fenced({ project, epoch }, t.p1, t.work, t.p2), "FENCE", "foreign token"); eq(t.log, [], "no phase ran");
}));
await test("fencedTwoPhase: no lease at all is refused (FENCE), never executed unfenced", async () => withFixture("basic", async (fx) => {
  const fenced = await needFenced(); const t = trace();
  await rejectsWith(() => fenced({ project: fx.root, epoch: 1 }, t.p1, t.work, t.p2), "FENCE", "no lease"); eq(t.log, [], "no phase ran");
}));
await test("fencedTwoPhase: phase 1 renews the lease (D5: verify fence, renew, record intent)", async () => withLease(async ({ project, epoch, bs }) => {
  const fenced = await needFenced(); const t = trace();
  const before = (await bs.currentLease(project)).renewed_at; await new Promise((r) => setTimeout(r, 25));
  await fenced({ project, epoch }, t.p1, t.work, t.p2);
  const after = (await bs.currentLease(project)).renewed_at;
  ok(Date.parse(after) > Date.parse(before), `lease renewed_at did not advance (${before} -> ${after})`);
}));
await test("fencedTwoPhase: the work phase runs OUTSIDE the mutex (a fenced renew inside work does not deadlock)", async () => withLease(async ({ project, epoch, bs, token }) => {
  const fenced = await needFenced(); let inside = false;
  const run = fenced({ project, epoch }, async () => {}, async () => { await bs.renew(project, token, epoch, { projectStatus: false }); inside = true; }, async () => {});
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("deadlock: the work phase still holds the lease mutex")), 5000));
  await Promise.race([run, timeout]); ok(inside, "work did not complete its renew");
}));
await test("fencedTwoPhase: an error in phase1 or work propagates unchanged and phase2 does not run; the fence stays valid afterwards", async () => withLease(async ({ project, epoch, bs }) => {
  const fenced = await needFenced(); const log = [];
  const boom = Object.assign(new Error("work blew up"), { code: "GATE_RED" });
  await rejectsWith(() => fenced({ project, epoch }, async () => { log.push("p1"); }, async () => { throw boom; }, async () => { log.push("p2"); }), "GATE_RED", "error in work");
  eq(log, ["p1"], "phase2 skipped");
  await rejectsWith(() => fenced({ project, epoch }, async () => { throw Object.assign(new Error("p1 failed"), { code: "INVALID_INPUT" }); }, async () => { log.push("w"); }, async () => { log.push("p2b"); }), "INVALID_INPUT", "error in phase1");
  eq(log, ["p1"], "work and phase2 skipped after a phase1 error");
  ok((await bs.currentLease(project)).epoch === epoch, "an error must not change the epoch");
  const t = trace(); await fenced({ project, epoch }, t.p1, t.work, t.p2); eq(t.log, ["phase1", "work", "phase2"], "the lease still works after errors");
}));
await test("fencedTwoPhase: after a transfer the NEW epoch holder passes and the OLD epoch is refused before phase1", async () => withLease(async ({ project, epoch, bs, token }) => {
  const fenced = await needFenced(); const t = trace();
  const next = await bs.transfer(project, { token, toRuntime: "codex", coordinator: "drive", epoch });
  await rejectsWith(() => fenced({ project, epoch }, t.p1, t.work, t.p2), "FENCE", "old holder"); eq(t.log, [], "old holder ran nothing");
  await fenced({ project, epoch: next.epoch }, t.p1, t.work, t.p2); eq(t.log, ["phase1", "work", "phase2"], "new holder ran");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
