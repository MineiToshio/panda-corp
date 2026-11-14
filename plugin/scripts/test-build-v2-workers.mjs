#!/usr/bin/env node
// test-build-v2-workers.mjs — contract test of plugin/runtime/build/workers.mjs (PLAN §5.2 row C11, D6, A16, A17, A18).
//
// ASSUMED INTERFACE (derived from the contracts and the module's export names/JSDoc; reconcile with the module):
//  - workerIdFor({runId, unit, attempt}) -> a safe id that contains the run id and the unit id, and is different for
//    different run ids (so a later run never re-reads an older run's sealed result).
//  - buildWorkerArgv({project, workerId, unit, cell, promptFile, schemaFile, dir}, deps) -> {bin, args, fake}; `args`
//    carries `run --direct`, `--codex-model <slug>`, `--effort <e>`, `--dir <unit worktree>`, `--prompt-file <brief>`,
//    `--output-schema <schema>`. Engine-composed values never contain "claude"; host path values are exempt.
//  - parseSealedLine(line, deps) -> {ok:true,payload} | {ok:false, kind:"garbled"|"checksum"}.
//  - launchWorker({project, runId, unit, attempt, cell, schemaFile, dir}, deps) -> {ok, workerId, dir, pid, job, reused,
//    settled} | {ok:false, kind}. Idempotent per worker id. `dir` of the result = the worker directory.
//  - peekWorker({project, workerId}, deps) -> {state: none|running|exited|dead, pid, exit, sealed}.
//  - pollWorker({project, workerId, unit, schemaFile, reportFile, epoch}, deps) -> {state: running|done|error, outcome,...}
//    with outcomes report | limit {limit: usage_limit|rate_limit, retryAfterS} | bad_report | failed | worker_error.
//    `deps.recordLimit({provider:"codex", resetsAt}, ctx)` is the injected quota recorder (only usage_limit calls it).
//  - stopWorkers(project, ids, deps) -> ids signalled (documented single stopping point; leaves no orphan).
//  - Worker files live in <project>/.pandacorp/run/codex-workers/<workerId>/ (paths.codexWorkerDir).
//  - deps.env carries the testEnv hooks (PANDACORP_FAKE_WORKER, PANDACORP_FAKE_WORKER_PLAN).
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture, writeWorkerPlan } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.stack || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

const here = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(here, "../runtime/build");
let W; let P;
try {
  W = await import(path.join(buildDir, "workers.mjs"));
  P = await import(path.join(buildDir, "paths.mjs"));
} catch (e) {
  console.error(`FAIL  module load: plugin/runtime/build/workers.mjs could not be imported: ${e.message}`);
  console.log("RESULT: 0 passed, 1 failed");
  process.exit(1);
}
for (const name of ["workerIdFor", "buildWorkerArgv", "parseSealedLine", "launchWorker", "peekWorker", "pollWorker", "stopWorkers"]) {
  if (typeof W[name] !== "function") { console.error(`FAIL  missing export workers.${name}`); console.log("RESULT: 0 passed, 1 failed"); process.exit(1); }
}

const CELL = { runtime: "codex", model: "sol", effort: "high" };
const SLUG = "gpt-6.1-sol";
const SCHEMA = path.join(buildDir, "schemas/report.schema.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** One sandbox: fixture project, env hooks, a unit worktree dir, a brief file, a recording quota recorder. */
async function sandbox(plan = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pc-workers-"));
  const fx = await createFixture("basic", { dir });
  const env = fx.env();
  await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, plan);
  const paths = P.buildPaths(fx.root);
  const unit = "u-alpha-1";
  const wt = paths.unitWorktree(unit);
  await mkdir(wt, { recursive: true });
  await mkdir(path.dirname(paths.briefFile(unit)), { recursive: true });
  await writeFile(paths.briefFile(unit), `# brief for ${unit}\n\ntoken: faketoken0000000\nImplement the unit.\n`);
  const recorded = [];
  const deps = { env, recordLimit: (...args) => { recorded.push(args); return { ok: true }; } };
  const input = (extra = {}) => ({ project: fx.root, runId: "run-a", unit, attempt: 1, cell: CELL, schemaFile: SCHEMA, dir: wt, ...extra });
  const cleanup = async (...ids) => { try { W.stopWorkers(fx.root, ids, deps); } catch { /* best effort */ } await sleep(50); await rm(dir, { recursive: true, force: true }); };
  return { dir, fx, env, paths, unit, wt, deps, recorded, input, cleanup };
}
/** Launches then polls until the worker is no longer running (bounded). */
async function launchAndPoll(s, extra = {}) {
  const launch = await W.launchWorker(s.input(extra), s.deps);
  ok(launch.ok === true, `launch failed: ${JSON.stringify(launch)}`);
  let poll;
  for (let i = 0; i < 40; i++) {
    poll = await W.pollWorker({ project: s.fx.root, workerId: launch.workerId, unit: s.unit, schemaFile: SCHEMA, reportFile: s.paths.reportFile(s.unit), epoch: 1 }, s.deps);
    if (poll.state !== "running") break;
    await sleep(100);
  }
  return { launch, poll };
}

await test("worker id: safe, carries run and unit, and differs per run id and attempt", async () => {
  const a = W.workerIdFor({ runId: "run-a", unit: "u-alpha-1", attempt: 1 });
  const b = W.workerIdFor({ runId: "run-b", unit: "u-alpha-1", attempt: 1 });
  const c = W.workerIdFor({ runId: "run-a", unit: "u-alpha-1", attempt: 2 });
  ok(/^[A-Za-z0-9._-]+$/.test(a) && a.length <= 120, `unsafe worker id ${a}`);
  ok(a.includes("run-a") && a.includes("u-alpha-1"), `id does not carry run and unit: ${a}`);
  ok(a !== b, "two run ids produced the same worker id");
  ok(a !== c, "two attempts produced the same worker id");
  eq(W.workerIdFor({ runId: "run-a", unit: "u-alpha-1", attempt: 1 }), a, "worker id not deterministic");
});

await test("argv: codex slug, effort, unit worktree as --dir, brief as prompt file, output schema, no 'claude' in engine values", async () => {
  const s = await sandbox();
  try {
    const workerId = W.workerIdFor({ runId: "run-a", unit: s.unit });
    const { args } = W.buildWorkerArgv({ project: s.fx.root, workerId, unit: s.unit, cell: CELL, promptFile: s.paths.briefFile(s.unit), schemaFile: SCHEMA, dir: s.wt }, s.deps);
    const val = (flag) => { const i = args.indexOf(flag); ok(i >= 0, `argv lacks ${flag}: ${args.join(" ")}`); return args[i + 1]; };
    ok(args.includes("run") && args.includes("--direct"), "argv must be `run --direct`");
    eq(val("--codex-model"), SLUG, "model slug");
    eq(val("--effort"), "high", "effort");
    eq(val("--dir"), s.wt, "--dir must be the unit worktree");
    eq(val("--prompt-file"), s.paths.briefFile(s.unit), "prompt file must be the unit brief");
    eq(val("--output-schema"), SCHEMA, "output schema");
    eq(val("--id"), workerId, "worker id flag");
    eq(val("--writable-dir"), s.paths.unitDir(s.unit), "--writable-dir must be the unit's own build/units/<unit>/ (report_path, BL-0313)");
    eq(args.filter((a) => a === "--writable-dir").length, 1, "exactly one extra writable root");
    eq(path.dirname(s.paths.reportFile(s.unit)), val("--writable-dir"), "report_path lives in the writable root");
    const hostValues = new Set([s.fx.root, s.wt, s.paths.briefFile(s.unit), SCHEMA, path.resolve(s.fx.root)]);
    const engineValues = args.filter((a) => !hostValues.has(a) && !a.startsWith("/"));
    ok(engineValues.length > 0, "no engine-composed argv values found");
    for (const a of engineValues) ok(!/claude/i.test(a), `engine argv value contains the forbidden word: ${a}`);
  } finally { await s.cleanup(); }
});

await test("argv: unsupported runtimes or missing effort are refused; allocated Claude is admitted", async () => {
  const s = await sandbox();
  try {
    const base = { project: s.fx.root, workerId: "w-x", unit: s.unit, promptFile: s.paths.briefFile(s.unit), schemaFile: SCHEMA, dir: s.wt };
    let threw = 0;
    for (const cell of [{ runtime: "invalid", model: "opus", effort: "high" }, { runtime: "codex", model: "sol" }]) {
      try { W.buildWorkerArgv({ ...base, cell }, s.deps); } catch { threw++; }
    }
    eq(threw, 2, "both invalid cells must throw");
    const admitted = W.buildWorkerArgv({ ...base, cell: { runtime: "claude", model: "sonnet", effort: "medium" } }, s.deps);
    const index = admitted.args.indexOf("--capacity-task");
    eq(JSON.parse(admitted.args[index + 1]).pin, { tool: "claude", model: "sonnet", effort: "medium" }, "Claude pin preserved in structured argv");
  } finally { await s.cleanup(); }
});

await test("sealed line: valid line parses; corrupted line is refused (checksum); garbage is refused", async () => {
  const s = await sandbox({ "*": "ok" });
  try {
    const { launch } = await launchAndPoll(s);
    const line = readFileSync(path.join(launch.dir, "result.line"), "utf8").trim();
    const good = W.parseSealedLine(line, s.deps);
    ok(good.ok === true && good.payload && good.payload.ok === true, `valid line refused: ${JSON.stringify(good)}`);
    const env = JSON.parse(line);
    const tampered = JSON.stringify({ r: env.r.replace("fake worker", "fake wurker"), sum: env.sum });
    const bad = W.parseSealedLine(tampered, s.deps);
    ok(bad.ok === false && bad.kind === "checksum", `corrupted line must fail the checksum: ${JSON.stringify(bad)}`);
    const garbled = W.parseSealedLine("not json at all", s.deps);
    ok(garbled.ok === false && garbled.kind === "garbled", `garbage must be garbled: ${JSON.stringify(garbled)}`);
    ok(W.parseSealedLine(JSON.stringify({ r: 1 }), s.deps).ok === false, "envelope without sum must be refused");
  } finally { await s.cleanup(); }
});

await test("ok worker: files under the documented directory, report parsed, returned and written", async () => {
  const s = await sandbox({ "*": { mode: "ok", summary: "did it" } });
  try {
    const { launch, poll } = await launchAndPoll(s);
    eq(launch.dir, path.join(s.fx.root, ".pandacorp/run/codex-workers", launch.workerId), "worker directory");
    ok(existsSync(path.join(launch.dir, "state.json")), "state.json missing in the worker dir");
    ok(existsSync(path.join(launch.dir, "result.line")), "result.line missing in the worker dir");
    ok(launch.job && launch.job.kind === "worker" && launch.job.unit === s.unit, `job item (A18) wrong: ${JSON.stringify(launch.job)}`);
    ok(poll.state === "done" && poll.outcome === "report", `want done/report, got ${JSON.stringify(poll)}`);
    ok(poll.report && poll.report.unit === s.unit && poll.report.summary === "did it", `report not returned: ${JSON.stringify(poll.report)}`);
    const written = JSON.parse(await readFile(s.paths.reportFile(s.unit), "utf8"));
    eq(written.summary, "did it", "report file content");
    eq(s.recorded.length, 0, "an ok worker must not touch the quota");
  } finally { await s.cleanup(); }
});

await test("red and doubt reports are returned as reports (status carried), not as errors", async () => {
  const s = await sandbox({ "*": "red" });
  try {
    const { poll } = await launchAndPoll(s);
    ok(poll.outcome === "report" && poll.report.status === "failed", `red must be a report with status failed: ${JSON.stringify(poll)}`);
  } finally { await s.cleanup(); }
  const d = await sandbox({ "*": "doubt" });
  try {
    const { poll } = await launchAndPoll(d);
    ok(poll.outcome === "report" && poll.report.status === "doubt" && poll.report.doubt, `doubt must be a report with status doubt: ${JSON.stringify(poll)}`);
  } finally { await d.cleanup(); }
});

await test("usage_limit is handed to the injected quota recorder for provider codex", async () => {
  const s = await sandbox({ "*": "limit" });
  try {
    const { poll } = await launchAndPoll(s);
    ok(poll.outcome === "limit" && poll.limit === "usage_limit", `want limit/usage_limit, got ${JSON.stringify(poll)}`);
    eq(s.recorded.length, 1, "recordLimit must be called exactly once");
    eq(s.recorded[0][0].provider, "codex", "provider handed to the recorder");
  } finally { await s.cleanup(); }
});

await test("rate_limit is classified with a retry hint and NOT recorded in the quota", async () => {
  const s = await sandbox({ "*": "rate_limit" });
  try {
    const { poll } = await launchAndPoll(s);
    ok(poll.outcome === "limit" && poll.limit === "rate_limit", `want limit/rate_limit, got ${JSON.stringify(poll)}`);
    ok(Number(poll.retryAfterS) > 0, `rate_limit needs a retry hint: ${JSON.stringify(poll)}`);
    eq(s.recorded.length, 0, "rate_limit must not be recorded as a quota limit");
  } finally { await s.cleanup(); }
});

await test("a report that fails the schema is bad_report (consumes an attempt), not a limit", async () => {
  const s = await sandbox({ "*": { mode: "ok", status: "not-a-valid-status" } });
  try {
    const { poll } = await launchAndPoll(s);
    ok(poll.outcome === "bad_report", `want bad_report, got ${JSON.stringify(poll)}`);
    eq(s.recorded.length, 0, "bad_report must not touch the quota");
  } finally { await s.cleanup(); }
});

await test("a report for another unit is bad_report (unit mismatch)", async () => {
  const s = await sandbox({ "*": { mode: "ok", unit: "u-other-9" } });
  try {
    const { poll } = await launchAndPoll(s);
    ok(poll.outcome === "bad_report", `a report for another unit must be bad_report, got ${JSON.stringify(poll)}`);
  } finally { await s.cleanup(); }
});

await test("polling a worker whose line is corrupted on disk does not return a report", async () => {
  const s = await sandbox({ "*": "ok" });
  try {
    const launch = await W.launchWorker(s.input(), s.deps);
    ok(launch.ok, "launch failed");
    const f = path.join(launch.dir, "result.line");
    for (let i = 0; i < 30 && !existsSync(f); i++) await sleep(50);
    const env = JSON.parse(readFileSync(f, "utf8"));
    await writeFile(f, `${JSON.stringify({ r: env.r.replace("fake worker", "fake wurker"), sum: env.sum })}\n`);
    const poll = await W.pollWorker({ project: s.fx.root, workerId: launch.workerId, unit: s.unit, schemaFile: SCHEMA, reportFile: s.paths.reportFile(s.unit), epoch: 1 }, s.deps);
    ok(poll.outcome !== "report", `a corrupted sealed line must never yield a report: ${JSON.stringify(poll)}`);
    ok(!existsSync(s.paths.reportFile(s.unit)), "no report file may be written from a corrupted line");
  } finally { await s.cleanup(); }
});

await test("hung worker: reported running (not success), then stopped through stopWorkers with no orphan", async () => {
  const s = await sandbox({ "*": "hang" });
  let pid = null;
  try {
    const launch = await W.launchWorker(s.input(), s.deps);
    ok(launch.ok === true, `launch of a hanging worker must still succeed: ${JSON.stringify(launch)}`);
    pid = launch.pid ?? JSON.parse(readFileSync(path.join(launch.dir, "state.json"), "utf8")).pid;
    ok(Number.isInteger(pid) && alive(pid), "hung worker pid must be alive");
    const poll = await W.pollWorker({ project: s.fx.root, workerId: launch.workerId, unit: s.unit, schemaFile: SCHEMA, epoch: 1 }, s.deps);
    ok(poll.state === "running", `a hung worker must be running, got ${JSON.stringify(poll)}`);
    ok(poll.outcome !== "report" && poll.state !== "done", "a hung worker must never be reported as success");
    const peek = W.peekWorker({ project: s.fx.root, workerId: launch.workerId }, s.deps);
    eq(peek.state, "running", "peek of a hung worker");
    const stopped = W.stopWorkers(s.fx.root, [launch.workerId], s.deps);
    ok(Array.isArray(stopped) && stopped.includes(launch.workerId), `stopWorkers must report the id: ${JSON.stringify(stopped)}`);
    for (let i = 0; i < 40 && alive(pid); i++) await sleep(100);
    ok(!alive(pid), "hung worker is still alive after stopWorkers (orphan)");
    const after = W.peekWorker({ project: s.fx.root, workerId: launch.workerId }, s.deps);
    ok(after.state !== "running", `peek after stop must not say running: ${JSON.stringify(after)}`);
  } finally {
    if (pid && alive(pid)) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
    await s.cleanup();
  }
});

await test("rerun with the same worker id harvests the stored result (no second run)", async () => {
  const s = await sandbox({ "*": { mode: "ok", summary: "first" } });
  try {
    const first = await launchAndPoll(s);
    eq(first.poll.report.summary, "first", "first result");
    await writeWorkerPlan(s.env.PANDACORP_FAKE_WORKER_PLAN, { "*": { mode: "ok", summary: "second" } });
    const again = await W.launchWorker(s.input(), s.deps);
    ok(again.ok === true && again.workerId === first.launch.workerId, "same inputs must give the same worker id");
    ok(again.reused === true, `a sealed worker must be adopted, not relaunched: ${JSON.stringify({ reused: again.reused })}`);
    const poll = await W.pollWorker({ project: s.fx.root, workerId: again.workerId, unit: s.unit, schemaFile: SCHEMA, epoch: 1 }, s.deps);
    eq(poll.report.summary, "first", "rerun must harvest the stored result, not run again");
  } finally { await s.cleanup(); }
});

await test("a different run id never re-reads an older run's sealed result", async () => {
  const s = await sandbox({ "*": { mode: "ok", summary: "old run" } });
  try {
    const first = await launchAndPoll(s, { runId: "run-a" });
    eq(first.poll.report.summary, "old run", "old run result");
    await writeWorkerPlan(s.env.PANDACORP_FAKE_WORKER_PLAN, { "*": { mode: "ok", summary: "new run" } });
    const second = await launchAndPoll(s, { runId: "run-b" });
    ok(second.launch.workerId !== first.launch.workerId, "run ids must map to distinct worker ids");
    ok(second.launch.reused !== true, "a new run must start its own worker");
    eq(second.poll.report.summary, "new run", "new run must see its own result, never the older one");
    eq(W.peekWorker({ project: s.fx.root, workerId: first.launch.workerId }, s.deps).sealed, true, "older result must remain untouched");
  } finally { await s.cleanup(); }
});

await test("launch refuses loudly when the brief or the unit worktree is missing", async () => {
  const s = await sandbox({ "*": "ok" });
  try {
    const noWt = await W.launchWorker(s.input({ dir: path.join(s.dir, "does-not-exist") }), s.deps);
    ok(noWt.ok === false && /worktree/.test(noWt.kind), `missing worktree must be refused: ${JSON.stringify(noWt)}`);
    const noBrief = await W.launchWorker(s.input({ unit: "u-nobrief-1", dir: s.wt }), s.deps);
    ok(noBrief.ok === false && /brief/.test(noBrief.kind), `missing brief must be refused: ${JSON.stringify(noBrief)}`);
    const noSchema = await W.launchWorker(s.input({ schemaFile: path.join(s.dir, "nope.schema.json") }), s.deps);
    ok(noSchema.ok === false && /schema/.test(noSchema.kind), `missing schema must be refused: ${JSON.stringify(noSchema)}`);
  } finally { await s.cleanup(); }
});

await test("peek of an unknown worker is none and spawns nothing", async () => {
  const s = await sandbox();
  try {
    const p = W.peekWorker({ project: s.fx.root, workerId: "w-never-ran" }, s.deps);
    eq(p.state, "none", "unknown worker");
    ok(p.sealed === false, "unknown worker cannot be sealed");
    ok(!existsSync(path.join(s.fx.root, ".pandacorp/run/codex-workers/w-never-ran")), "peek must not create the worker dir");
  } finally { await s.cleanup(); }
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
