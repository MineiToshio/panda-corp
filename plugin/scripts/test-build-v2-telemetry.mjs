#!/usr/bin/env node
// test-build-v2-telemetry.mjs: official test of plugin/runtime/build/telemetry.mjs (PLAN 5.2 row C08, 3.14).
// Contract pinned: events carry only names registered in plugin/runtime/event-vocabulary.json with
// project = basename(project root); the events file comes from PANDACORP_EVENTS_FILE (claude) or
// PANDACORP_CODEX_EVENTS_FILE (codex); a telemetry write failure never throws to the caller;
// track.jsonl lines have exactly the Mission Control shapes and are written ONLY in the integration
// worktree (never the main checkout); the module never writes status.yaml.
//
// ASSUMED INTERFACE (the docs name the module, not its exports; names below come from the C08
// implementer's report and PLAN 3.14 wording; the orchestrator reconciles test and module):
//   emitEvent(project, {runtime: "claude"|"codex", runId, name, data}, deps?)
//       -> Promise<{ok:true, payload} | {ok:false, error}>, never throws. `name` is a display name or
//          alias of the vocabulary (e.g. "BuildLaunch", "wo_commit"). A name absent from the vocabulary
//          is refused (ok:false) and nothing is written. The ndjson line has the event-transport.mjs
//          payload shape {at, runtime, run_id, event_id, event, semantic_name, project, subject, data}.
//   eventData.agentDone({role, model, unit, result: "green"|"red", wo?, frd?}) and
//   eventData.gateVerdict({frd, verdict}) (verdict normalised to upper-case PASS|FAIL); invalid -> throw.
//   trackLine(input, {env, clock}) PURE -> object (or its JSON string) in a MC shape; input =
//       {kind: wo_start|wo_end|review_start|review_end|frd_end, frd, wo?, state?, verdict?}; invalid -> throw.
//   trackLineForTransition({frd, wo, to}): IN_PROGRESS->wo_start, IN_REVIEW->wo_end in_review,
//       VERIFIED->wo_end verified, BLOCKED->wo_end failed, anything else -> null.
//   appendTrack(project, line, deps?) -> Promise<{ok:true, file} | {ok:false, error}>, never throws;
//       writes <project>/.pandacorp/run/build/integration/.pandacorp/track.jsonl (one JSON line each).
//   deps = {env, clock?}; the events file path is resolved from deps.env, never from process.env.
//   Names of the 8 new vocabulary entries are their display names: ReviewRecorded, QuotaReading,
//   EngineFailure, AutonomousDecision, BuildHandoff, WaitingGate, UnitParked, AdmitDecision.
//   Those 8 must be in event-vocabulary.json (added by integrator task AX1); until then the case
//   "AX1 vocabulary" is RED by design.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture, DEFAULT_NOW, git } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };
const throws = async (fn, message) => { try { await fn(); } catch { return; } throw new Error(message); };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VOCAB = JSON.parse(await readFile(path.join(HERE, "../runtime/event-vocabulary.json"), "utf8"));
const NEW_EIGHT = ["ReviewRecorded", "QuotaReading", "EngineFailure", "AutonomousDecision", "BuildHandoff", "WaitingGate", "UnitParked", "AdmitDecision"];
const EXISTING = ["BuildLaunch", "AgentWorking", "AgentDone", "wo_commit", "GateVerdict", "BuildComplete", "BuildStopped", "worker_started", "worker_stopped"];

let T; let loadError = null;
try { T = await import("../runtime/build/telemetry.mjs"); } catch (e) { loadError = e; }
const mod = () => { if (loadError) throw new Error(`telemetry.mjs not loadable: ${loadError.message}`); return T; };
const fn = (name) => { const f = mod()[name]; if (typeof f !== "function") throw new Error(`telemetry.mjs does not export function ${name}`); return f; };

const scratch = await mkdtemp(path.join(os.tmpdir(), "pc-telemetry-"));
let counter = 0;
const sandbox = async (preset = "basic") => {
  const dir = path.join(scratch, `t${counter++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture(preset, { dir });
  const env = fx.env();
  return { dir, fx, env, deps: { env, clock: () => new Date(DEFAULT_NOW) }, project: fx.root, integration: path.join(fx.root, ".pandacorp/run/build/integration") };
};
const ndjson = async (file) => (existsSync(file) ? (await readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const registered = (payload) => {
  const entry = VOCAB.events[payload.semantic_name];
  ok(entry, `semantic_name ${payload.semantic_name} (event ${payload.event}) is not in event-vocabulary.json`);
  ok(!String(payload.semantic_name).startsWith("legacy."), `event ${payload.event} fell into legacy.*`);
  eq(entry.display, payload.event, "event display name matches the vocabulary entry");
};
const isRegisteredName = (name) => Object.values(VOCAB.events).some((e) => e.display === name || e.aliases.includes(name)) || Object.hasOwn(VOCAB.events, name);
const asObject = (v) => (typeof v === "string" ? JSON.parse(v) : v);
const trackFile = (sb) => path.join(sb.integration, ".pandacorp/track.jsonl");
const run = (sb, extra = {}) => ({ runtime: "claude", runId: "run-t1", name: "BuildLaunch", data: {}, ...extra });

// ---------------------------------------------------------------- module surface
await test("module loads and exports emitEvent, trackLine, trackLineForTransition, appendTrack", async () => {
  mod(); for (const n of ["emitEvent", "trackLine", "trackLineForTransition", "appendTrack"]) fn(n);
});

// ---------------------------------------------------------------- events
await test("build.scaled is registered and emits from/to/reason without becoming legacy", async () => {
  const sb = await sandbox();
  const r = await fn("emitEvent")(sb.project, run(sb, { name: "build.scaled", data: { from: 5, to: 3, reason: "swapouts" } }), sb.deps);
  ok(r.ok, JSON.stringify(r));
  const body = await readFile(sb.env.PANDACORP_EVENTS_FILE, "utf8");
  ok(body.includes("build.scaled") && body.includes("swapouts"), "scaled event and reason persisted");
  ok(!body.includes("legacy."), "registered semantic event");
});

await test("emitEvent writes one ndjson line to PANDACORP_EVENTS_FILE with project = basename and a registered name", async () => {
  const sb = await sandbox();
  const res = await fn("emitEvent")(sb.project, run(sb, { name: "BuildLaunch", data: { mode: "v2" } }), sb.deps);
  ok(res && res.ok === true, `emitEvent not ok: ${JSON.stringify(res)}`);
  const lines = await ndjson(sb.env.PANDACORP_EVENTS_FILE); eq(lines.length, 1, "one line written");
  const [p] = lines;
  eq(p.project, path.basename(sb.project), "project is the basename of the project root");
  eq(p.event, "BuildLaunch", "event display name"); eq(p.run_id, "run-t1", "run id");
  eq(p.runtime, "claude", "runtime"); ok(Number.isFinite(Date.parse(p.at)), "at is an ISO timestamp");
  registered(p);
  eq(await ndjson(sb.env.PANDACORP_CODEX_EVENTS_FILE), [], "claude event must not reach the codex file");
  ok(!existsSync(path.join(sb.env.HOME, ".claude/dashboard-events.ndjson")), "real-home events file untouched");
  await sb.fx.cleanup();
});
await test("the events file comes from PANDACORP_EVENTS_FILE (any path, parent dirs created)", async () => {
  const sb = await sandbox(); const custom = path.join(sb.dir, "deep/nested/custom.ndjson");
  const res = await fn("emitEvent")(sb.project, run(sb), { ...sb.deps, env: { ...sb.env, PANDACORP_EVENTS_FILE: custom } });
  ok(res.ok === true, `not ok: ${JSON.stringify(res)}`);
  eq((await ndjson(custom)).length, 1, "line in the custom file"); eq(await ndjson(sb.env.PANDACORP_EVENTS_FILE), [], "default test file stays empty");
  await sb.fx.cleanup();
});
await test("runtime codex goes to PANDACORP_CODEX_EVENTS_FILE only", async () => {
  const sb = await sandbox();
  const res = await fn("emitEvent")(sb.project, run(sb, { runtime: "codex", name: "AgentWorking", data: { role: "implementer", unit: "u-build-WO-01-001" } }), sb.deps);
  ok(res.ok === true, `not ok: ${JSON.stringify(res)}`);
  const lines = await ndjson(sb.env.PANDACORP_CODEX_EVENTS_FILE); eq(lines.length, 1, "one codex line"); eq(lines[0].runtime, "codex", "runtime codex");
  eq(await ndjson(sb.env.PANDACORP_EVENTS_FILE), [], "claude file untouched");
  await sb.fx.cleanup();
});
await test("every existing event name is emitted under its registered vocabulary entry", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent");
  for (const name of EXISTING) { const res = await emit(sb.project, run(sb, { name, data: { frd: "frd-01-alpha", wo: "WO-01-001" } }), sb.deps); ok(res.ok === true, `${name} refused: ${JSON.stringify(res)}`); }
  const lines = await ndjson(sb.env.PANDACORP_EVENTS_FILE); eq(lines.length, EXISTING.length, "one line per event");
  lines.forEach(registered); eq(lines.map((l) => l.event), ["BuildLaunch", "AgentWorking", "AgentDone", "wo_commit", "GateVerdict", "BuildComplete", "BuildStopped", "AgentWorking", "AgentDone"], "display names (worker_* alias onto AgentWorking/AgentDone)");
  await sb.fx.cleanup();
});
await test("the 8 new vocabulary names are emitted registered, never as legacy.*", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent");
  for (const name of NEW_EIGHT) { const res = await emit(sb.project, run(sb, { name, data: { unit: "u-x" } }), sb.deps); ok(res.ok === true, `${name} refused: ${JSON.stringify(res)}`); }
  const lines = await ndjson(sb.env.PANDACORP_EVENTS_FILE); eq(lines.length, 8, "eight lines"); lines.forEach(registered);
  await sb.fx.cleanup();
});
await test("AX1 vocabulary: event-vocabulary.json contains the 8 new names (pending integrator task AX1)", async () => {
  for (const name of NEW_EIGHT) ok(isRegisteredName(name), `${name} missing from plugin/runtime/event-vocabulary.json`);
  for (const name of [...EXISTING, "BuildLaunch"]) ok(isRegisteredName(name), `${name} missing from the vocabulary`);
});
await test("an unregistered name (and build_usable) is refused, nothing is written, no throw", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent");
  for (const name of ["TotallyMadeUp", "build_usable", "BuildUsable"]) {
    ok(!isRegisteredName(name), `precondition: ${name} must not be in the vocabulary`);
    const res = await emit(sb.project, run(sb, { name }), sb.deps);
    ok(res && res.ok === false, `${name} must be refused, got ${JSON.stringify(res)}`);
  }
  eq(await ndjson(sb.env.PANDACORP_EVENTS_FILE), [], "no line for refused names");
  await sb.fx.cleanup();
});
await test("AgentDone carries role/model/unit/result (green|red) and GateVerdict carries frd + upper-case verdict", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent"); const T2 = mod();
  const done = T2.eventData?.agentDone ? T2.eventData.agentDone({ role: "implementer", model: "sonnet", unit: "u-build-WO-01-001", result: "green", wo: "WO-01-001", frd: "frd-01-alpha" }) : { role: "implementer", model: "sonnet", unit: "u-build-WO-01-001", result: "green" };
  const gate = T2.eventData?.gateVerdict ? T2.eventData.gateVerdict({ frd: "frd-01-alpha", verdict: "pass" }) : { frd: "frd-01-alpha", verdict: "PASS" };
  await emit(sb.project, run(sb, { name: "AgentDone", data: done }), sb.deps); await emit(sb.project, run(sb, { name: "GateVerdict", data: gate }), sb.deps);
  const [a, g] = await ndjson(sb.env.PANDACORP_EVENTS_FILE);
  for (const k of ["role", "model", "unit"]) ok(typeof a.data[k] === "string" && a.data[k], `AgentDone.data.${k} missing`);
  ok(["green", "red"].includes(a.data.result), "AgentDone.data.result must be green|red"); eq(g.data.frd, "frd-01-alpha", "GateVerdict frd"); eq(g.data.verdict, "PASS", "GateVerdict verdict upper-case");
  await sb.fx.cleanup();
});
await test("eventData builders reject invalid input (result not green|red, verdict not pass|fail)", async () => {
  const T2 = mod(); ok(T2.eventData && typeof T2.eventData.agentDone === "function" && typeof T2.eventData.gateVerdict === "function", "eventData.agentDone/gateVerdict not exported");
  await throws(() => T2.eventData.agentDone({ role: "implementer", model: "sonnet", unit: "u", result: "maybe" }), "agentDone accepted result=maybe");
  await throws(() => T2.eventData.gateVerdict({ frd: "frd-01-alpha", verdict: "perhaps" }), "gateVerdict accepted verdict=perhaps");
  eq(T2.eventData.gateVerdict({ frd: "frd-01-alpha", verdict: "fail" }).verdict, "FAIL", "fail -> FAIL");
});
await test("a telemetry write failure never throws to the caller (events file under a regular file, or a directory)", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent"); const blocker = path.join(sb.dir, "blocker"); await writeFile(blocker, "x");
  for (const bad of [path.join(blocker, "sub/events.ndjson"), sb.dir]) {
    let res; try { res = await emit(sb.project, run(sb), { ...sb.deps, env: { ...sb.env, PANDACORP_EVENTS_FILE: bad } }); } catch (e) { throw new Error(`emitEvent threw on unwritable ${bad}: ${e.message}`); }
    ok(res && typeof res === "object", "emitEvent must return a result object");
  }
  await sb.fx.cleanup();
});
await test("emitEvent never throws on garbage input (null spec, missing runId, circular data, throwing clock)", async () => {
  const sb = await sandbox(); const emit = fn("emitEvent"); const circ = {}; circ.self = circ;
  const calls = [() => emit(sb.project, null, sb.deps), () => emit(sb.project, { runtime: "claude", name: "BuildLaunch" }, sb.deps), () => emit(sb.project, run(sb, { data: circ }), sb.deps),
    () => emit(sb.project, run(sb), { ...sb.deps, clock: () => { throw new Error("boom"); } }), () => emit("", run(sb), sb.deps), () => emit(sb.project, run(sb, { runtime: "martian" }), sb.deps)];
  for (const c of calls) { try { const r = await c(); ok(r && typeof r === "object", "must return an object"); } catch (e) { throw new Error(`emitEvent threw: ${e.message}`); } }
  await sb.fx.cleanup();
});

// ---------------------------------------------------------------- track lines
const KEYS = { wo_start: ["at", "frd", "kind", "wo"], wo_end: ["at", "frd", "kind", "state", "wo"], review_start: ["at", "frd", "kind"], review_end: ["at", "frd", "kind", "verdict"], frd_end: ["at", "frd", "kind"] };
const INPUTS = { wo_start: { kind: "wo_start", frd: "frd-01-alpha", wo: "WO-01-001" }, wo_end: { kind: "wo_end", frd: "frd-01-alpha", wo: "WO-01-001", state: "in_review" }, review_start: { kind: "review_start", frd: "frd-01-alpha" }, review_end: { kind: "review_end", frd: "frd-01-alpha", verdict: "pass" }, frd_end: { kind: "frd_end", frd: "frd-01-alpha" } };
const tdeps = { env: { PANDACORP_NOW: DEFAULT_NOW }, clock: () => new Date(DEFAULT_NOW) };

await test("trackLine builds exactly the five Mission Control shapes with an ISO `at` (pure, deterministic)", async () => {
  const tl = fn("trackLine");
  for (const [kind, input] of Object.entries(INPUTS)) {
    const a = asObject(tl(input, tdeps)); eq(Object.keys(a).sort(), KEYS[kind], `${kind} keys`); eq(a.kind, kind, "kind"); eq(a.frd, "frd-01-alpha", "frd");
    ok(Number.isFinite(Date.parse(a.at)), `${kind}: at must parse`); eq(a.at, DEFAULT_NOW, `${kind}: at comes from the injected clock/PANDACORP_NOW`);
    eq(asObject(tl(input, tdeps)), a, `${kind}: same input and clock give the same line`);
  }
});
await test("trackLine enumerates only the contract values: wo_end state in_review|verified|failed, review_end verdict pass|reject", async () => {
  const tl = fn("trackLine");
  for (const state of ["in_review", "verified", "failed"]) eq(asObject(tl({ ...INPUTS.wo_end, state }, tdeps)).state, state, `wo_end ${state}`);
  for (const verdict of ["pass", "reject"]) eq(asObject(tl({ ...INPUTS.review_end, verdict }, tdeps)).verdict, verdict, `review_end ${verdict}`);
});
await test("trackLine rejects invalid input (unknown kind, missing frd/wo, bad state, bad verdict)", async () => {
  const tl = fn("trackLine");
  const bad = [{ kind: "wo_pause", frd: "frd-01-alpha" }, { kind: "wo_start", frd: "frd-01-alpha" }, { kind: "wo_start", wo: "WO-01-001" }, { ...INPUTS.wo_end, state: "done" }, { ...INPUTS.wo_end, state: undefined },
    { ...INPUTS.review_end, verdict: "approved" }, { ...INPUTS.review_end, verdict: undefined }, {}, null];
  for (const b of bad) await throws(() => tl(b, tdeps), `trackLine accepted ${JSON.stringify(b)}`);
});
await test("trackLineForTransition maps WO states to track lines and ignores the rest", async () => {
  const tt = fn("trackLineForTransition"); const base = { frd: "frd-01-alpha", wo: "WO-01-001" };
  const get = (to) => { const r = tt({ ...base, to }, tdeps); return r === null || r === undefined ? null : asObject(r); };
  eq(get("IN_PROGRESS")?.kind, "wo_start", "IN_PROGRESS -> wo_start");
  const review = get("IN_REVIEW"); eq([review?.kind, review?.state], ["wo_end", "in_review"], "IN_REVIEW");
  const verified = get("VERIFIED"); eq([verified?.kind, verified?.state], ["wo_end", "verified"], "VERIFIED");
  const blocked = get("BLOCKED"); eq([blocked?.kind, blocked?.state], ["wo_end", "failed"], "BLOCKED -> failed");
  eq(get("PLANNED"), null, "PLANNED yields no line"); eq(get("NOPE"), null, "unknown state yields no line");
});

// ---------------------------------------------------------------- appendTrack
await test("appendTrack appends to the INTEGRATION worktree track.jsonl, one valid line per call, order kept", async () => {
  const sb = await sandbox(); const tl = fn("trackLine"); const append = fn("appendTrack"); await mkdir(path.join(sb.integration, ".pandacorp"), { recursive: true });
  const seq = ["wo_start", "wo_end", "review_start", "review_end", "frd_end"];
  for (const k of seq) { const r = await append(sb.project, asObject(tl(INPUTS[k], tdeps)), sb.deps); ok(r && r.ok === true, `appendTrack ${k} not ok: ${JSON.stringify(r)}`); }
  const lines = (await readFile(trackFile(sb), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  eq(lines.map((l) => l.kind), seq, "kinds in append order"); lines.forEach((l) => eq(Object.keys(l).sort(), KEYS[l.kind], `${l.kind} keys on disk`));
  ok((await readFile(trackFile(sb), "utf8")).endsWith("\n"), "file ends with a newline");
  await sb.fx.cleanup();
});
await test("appendTrack never writes the main checkout: no track.jsonl there, git tree clean, status.yaml byte-identical", async () => {
  const sb = await sandbox(); const tl = fn("trackLine"); const statusFile = path.join(sb.project, ".pandacorp/status.yaml"); const before = await readFile(statusFile, "utf8");
  await mkdir(path.join(sb.integration, ".pandacorp"), { recursive: true });
  await fn("appendTrack")(sb.project, asObject(tl(INPUTS.wo_start, tdeps)), sb.deps);
  await fn("emitEvent")(sb.project, run(sb), sb.deps);
  ok(!existsSync(path.join(sb.project, ".pandacorp/track.jsonl")), "main checkout .pandacorp/track.jsonl must not exist");
  eq(git(sb.project, ["status", "--porcelain"]), "", "main checkout tree must stay clean");
  eq(await readFile(statusFile, "utf8"), before, "status.yaml untouched (no status projection)");
  await sb.fx.cleanup();
});
await test("appendTrack with no integration worktree still never writes into the main checkout, and does not throw", async () => {
  const sb = await sandbox(); const tl = fn("trackLine"); let res;
  try { res = await fn("appendTrack")(sb.project, asObject(tl(INPUTS.wo_start, tdeps)), sb.deps); } catch (e) { throw new Error(`appendTrack threw: ${e.message}`); }
  ok(res && typeof res === "object", "must return a result object"); ok(!existsSync(path.join(sb.project, ".pandacorp/track.jsonl")), "main checkout track.jsonl must not exist");
  eq(git(sb.project, ["status", "--porcelain"]), "", "main checkout tree must stay clean");
  await sb.fx.cleanup();
});
await test("appendTrack write failure never throws (track path blocked by a regular file)", async () => {
  const sb = await sandbox(); const tl = fn("trackLine"); await mkdir(path.join(sb.integration, ".pandacorp"), { recursive: true }); await mkdir(trackFile(sb), { recursive: true });
  let res; try { res = await fn("appendTrack")(sb.project, asObject(tl(INPUTS.wo_start, tdeps)), sb.deps); } catch (e) { throw new Error(`appendTrack threw: ${e.message}`); }
  ok(res && res.ok === false, `blocked write must report ok:false, got ${JSON.stringify(res)}`);
  await sb.fx.cleanup();
});
await test("concurrent appendTrack calls lose no line and never interleave", async () => {
  const sb = await sandbox(); const tl = fn("trackLine"); const append = fn("appendTrack"); await mkdir(path.join(sb.integration, ".pandacorp"), { recursive: true });
  const N = 25; await Promise.all(Array.from({ length: N }, (_, i) => append(sb.project, asObject(tl({ kind: "wo_start", frd: "frd-01-alpha", wo: `WO-01-${String(i + 1).padStart(3, "0")}` }, tdeps)), sb.deps)));
  const lines = (await readFile(trackFile(sb), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)); eq(lines.length, N, "all lines present and parseable"); eq(new Set(lines.map((l) => l.wo)).size, N, "all distinct");
  await sb.fx.cleanup();
});
await test("appendTrack refuses a line that is not a Mission Control shape (no corrupt line reaches track.jsonl)", async () => {
  const sb = await sandbox(); await mkdir(path.join(sb.integration, ".pandacorp"), { recursive: true }); let res;
  try { res = await fn("appendTrack")(sb.project, { kind: "wo_pause", frd: "frd-01-alpha", at: DEFAULT_NOW }, sb.deps); } catch { res = { ok: false }; }
  ok(res && res.ok === false, "unknown kind must not be appended");
  const text = existsSync(trackFile(sb)) ? await readFile(trackFile(sb), "utf8") : ""; ok(!text.includes("wo_pause"), "unknown kind reached track.jsonl");
  await sb.fx.cleanup();
});

await rm(scratch, { recursive: true, force: true });
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
