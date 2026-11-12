#!/usr/bin/env node
// test-build-v2-review-r1.mjs: regression suite for the six BLOCKING findings (B1..B6) of build/review-R1.md (the
// independent final review of wave D of the engine v2). One or more cases per finding, each reproducing the reviewer's
// failure scenario and asserting the CORRECT behaviour. Run: node plugin/scripts/test-build-v2-review-r1.mjs
// (R1_ONLY=<regex> runs only the cases whose name matches; names start with "B1".."B6", "control" cases prove the harness).
//
// Written from the contracts (plugin/docs/build-engine-cli.md, review-R1.md, PLAN 3.16 A13, decisions DEC-6/DEC-7) and the
// public exports / JSDoc of the modules; no module body was read. Cases run on real git fixtures (make-fixture.mjs, a
// Mission-Control-shaped nested fixture built like test-build-v2-next.mjs) and the testEnv hooks only: nothing touches the
// real home, host slot dir, events file or a real Codex.
//
//   B1  stale-lease reclaim on `start --resume` (CLI subprocess): the unreadable / wrong-epoch token file case.
//   B2  a Codex worker doubt (`via:"cli"`) and a `blocked`+`spec-ambiguous` report must open a doubt, never strand the unit.
//   B3  nested project (the project lives under a repo prefix): hand-back, review reopen/blocked, probe hashes.
//   B4  a second review `reopen` of the same WO leaves a DISPATCHABLE patch unit (queued, attempt 3), never `patching`.
//   B5  G2 jobs / integration merges never share one worktree; each G2 runs at a pinned sha in its own worktree.
//   B6  a second doubt on a unit built on an assumption keeps the assumption: a rejected assumption still discards it.
//
// ASSUMED INTERFACE (the docs fix the CLI shape, not every export; the orchestrator reconciles test and modules):
//   - CLI: `start --detect|--preflight|--run|--resume`, `next --epoch E --wait S`, `report --epoch --unit --token --file`,
//     `doubt`/`answer`/`handback` as in CLI doc 3.x. `lease-token.json` is JSON and 0600 after a v2 acquire/transfer/reclaim.
//   - review.mjs reviewRecord({project, epoch, unit, token, file}, deps), failure.mjs handbackCommand({project, epoch, unit,
//     reason}, deps), next.mjs `next` (one of next/runNext/nextAction/schedule), park.mjs parkUnits/assumeUnits/releaseParked/
//     assumptionUnits, answers.mjs planAnswer. The review harness (deps.reviewCell/routing/availability) mirrors
//     test-build-v2-review.mjs.
//   - B5: a G2 job that runs in "its own worktree" has job.cwd different from state.integration.worktree and a git HEAD equal
//     to the integration tip at the time the job was started. The pinned sha is read from that worktree's HEAD (the state
//     schema has no job.sha field; a `sha` on the job or the job_started/gate journal event is accepted in addition).
//   - B6 is pinned at the pure state level (planAnswer over state transformed by the real park.mjs functions), so it holds
//     whichever field the fix uses to remember the assumption (the assertions never name it, only assumptionUnits()).
import { spawn, spawnSync } from "node:child_process";
import { chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "pandacorp-build.mjs");
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const NOW = "2026-11-11T12:00:00.000Z";
const LATER = "2026-11-11T15:00:00.000Z";
const ONLY = process.env.R1_ONLY ? new RegExp(process.env.R1_ONLY) : null;

let passed = 0; let failed = 0;
const test = async (name, fn) => {
  if (ONLY && !ONLY.test(name)) return;
  try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${String(e.message).slice(0, 900)}`); failed++; }
};
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };

const fixturesMod = () => import(pathToFileURL(FIXTURES).href);
const mod = async (file) => import(pathToFileURL(path.join(BUILD, file)).href);
const buildStateMod = () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);
const firstFn = (m, names, what) => {
  for (const n of names) if (typeof m[n] === "function") return m[n];
  throw new Error(`${what}: none of ${names.join("|")} is exported (exports: ${Object.keys(m).join(", ")})`);
};

const gitIn = (root, ...args) => spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH, HOME: os.tmpdir(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout.trim();

// ============================================================================================ CLI sandbox (B1, B2)
const sandboxes = [];
const bgPids = new Set();

/** Runs the CLI once; returns {code, stdout, stderr, json (last stdout line), lines}. */
function run(args, { env, cwd, timeout = 90000 } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: cwd || os.tmpdir(), env, encoding: "utf8", timeout });
  const lines = (r.stdout || "").split("\n").filter((l) => l.trim());
  let json = null; try { json = JSON.parse(lines[lines.length - 1]); } catch { json = null; }
  return { code: r.status, signal: r.signal, stdout: r.stdout || "", stderr: r.stderr || "", json, lines };
}
const need = (r, what, code = 0) => {
  if (r.code !== code) throw new Error(`${what}: expected exit ${code}, got ${r.code}${r.signal ? ` (signal ${r.signal})` : ""}; stdout=${r.stdout.slice(0, 500)} stderr=${r.stderr.slice(0, 500)}`);
  return r.json;
};

async function sandbox(preset = "basic", { codex = false } = {}) {
  const { createFixture, testEnv, writeSignalsFile, writeRolloutSample, writeWorkerPlan } = await fixturesMod();
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pandacorp-r1-"));
  const fixture = await createFixture(preset, { dir });
  const env = testEnv(dir, {});
  await mkdir(env.HOME, { recursive: true });
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  await writeRolloutSample(env.CODEX_HOME, "normal");
  await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, {});
  const s = { dir, fixture, env, root: fixture.root, codex };
  s.envWith = (extra) => ({ ...env, ...extra });
  s.cli = (args, opts = {}) => run([...args, "--project", fixture.root], { env: opts.env || env, cwd: opts.cwd, timeout: opts.timeout });
  sandboxes.push(s);
  return s;
}
const pathsFor = async (root) => (await mod("paths.mjs")).buildPaths(root);

/** detect -> scope file -> preflight -> start --run (the same sequence the CLI suite uses). */
async function startRun(s, { coordinator = "claude", label = coordinator } = {}) {
  const det = need(s.cli(["start", "--detect"]), "start --detect");
  const scopeFile = path.join(s.dir, "scope-in.json");
  await writeFile(scopeFile, JSON.stringify(det.scope));
  need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", label, "--session-model", "sonnet", "--probe-codex"]), "start --preflight");
  const start = need(s.cli(["start", "--run", "--scope-json", scopeFile, "--label", label, "--coordinator", coordinator, "--session-model", "sonnet"]), "start --run");
  return { detect: det, start };
}
async function readStateOf(s) { const P = await pathsFor(s.root); return JSON.parse(await readFile(P.stateFile, "utf8")); }
async function readJournalOf(s) {
  const P = await pathsFor(s.root);
  try { return (await readFile(P.journalFile, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
async function noteStandby(s) {
  const P = await pathsFor(s.root);
  try { const j = JSON.parse(await readFile(P.driveStandbyFile, "utf8")); if (j.pid) bgPids.add(j.pid); } catch { /* none */ }
}
async function cleanupSandboxes() {
  for (const s of sandboxes) await noteStandby(s);
  for (const pid of bgPids) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
  bgPids.clear();
  for (const s of sandboxes) { try { await s.fixture.cleanup(); } catch { /* ignore */ } await rm(s.dir, { recursive: true, force: true }); }
}

// ============================================================================================ B1
// review-R1 B1: `start --resume` over a stale (reclaimable) lease whose token file is missing or of another epoch
// (kill -9 inside `transfer`) goes through build-state `reclaim`, which projected `running:true` & co into the TRACKED
// .pandacorp/status.yaml of the main checkout and wrote no token file, so the next fenced command failed (exit 3) and the
// project was wedged for another 60 min.
for (const variant of ["token file missing", "token file of another epoch"]) {
  await test(`B1 resume over a reclaimable lease with a ${variant}: no tracked write in main, token file 0600 at the new epoch, run not wedged`, async () => {
    const s = await sandbox(); const { start } = await startRun(s); const P = await pathsFor(s.root);
    await noteStandby(s);
    if (variant === "token file missing") await rm(P.tokenFile, { force: true });
    else {
      const t = JSON.parse(await readFile(P.tokenFile, "utf8"));
      ok(typeof t.epoch === "number", `lease-token.json has no numeric epoch to tamper with: ${JSON.stringify(Object.keys(t))}`);
      await writeFile(P.tokenFile, `${JSON.stringify({ ...t, epoch: t.epoch - 1 })}\n`, { mode: 0o600 });
    }
    const statusBefore = await readFile(P.statusYaml, "utf8");
    const porcelainBefore = gitIn(s.root, "status", "--porcelain");
    const lateEnv = s.envWith({ PANDACORP_NOW: LATER }); // 3 h after the last renewal: past 2 x ttl (isReclaimable)
    const r = s.cli(["start", "--resume", "--coordinator", "claude", "--session-model", "sonnet"], { env: lateEnv });
    await noteStandby(s);
    eq(await readFile(P.statusYaml, "utf8"), statusBefore, "D1: the tracked .pandacorp/status.yaml of the main checkout must be byte-identical (reclaim must not project status)");
    eq(gitIn(s.root, "status", "--porcelain"), porcelainBefore, "D1: git status of the main checkout must not change");
    const out = need(r, "start --resume over a reclaimable lease with a broken token file");
    eq(out.run_id, start.run_id, "same run");
    ok(out.epoch > start.epoch, `epoch must advance (was ${start.epoch}, got ${out.epoch})`);
    const st = await stat(P.tokenFile);
    eq(st.mode & 0o777, 0o600, "the new lease-token.json must be mode 0600");
    const tok = JSON.parse(await readFile(P.tokenFile, "utf8"));
    if ("epoch" in tok) eq(tok.epoch, out.epoch, "the token file carries the NEW epoch");
    const nxt = s.cli(["next", "--epoch", String(out.epoch)], { env: lateEnv });
    eq(nxt.code, 0, `the resumed run must not be wedged: next --epoch ${out.epoch} exited ${nxt.code}: ${nxt.stdout.slice(0, 300)}`);
  });
}

// ============================================================================================ B2
// review-R1 B2: a doubt raised by a worker under `via:"cli"` (every Codex unit) left the unit `reported` with no doubt
// record: nothing opened the doubt (next discarded ingestReport's `outcome:"doubt"`), the dependents never ran and the run
// ended in deadlock/stop. Same for a `blocked` report whose diagnosis is spec-ambiguous (failure.mjs).
async function drainUntil(s, epochRef, predicate, { maxRounds = 40 } = {}) {
  for (let i = 0; i < maxRounds; i++) {
    const r = s.cli(["next", "--epoch", String(epochRef.epoch), "--wait", "1"]);
    if (r.code === 3) return null; // fenced: the run already ended (terminal action released the lease)
    if (r.code !== 0) throw new Error(`next exited ${r.code}: ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 300)}`);
    const events = await readJournalOf(s);
    const hit = await predicate(events, r.json);
    if (hit) return { r: r.json, events };
    await sleep(250);
  }
  return null;
}
const doubtRecords = async (s) => {
  const P = await pathsFor(s.root);
  try { return (await readdir(path.dirname(P.doubtFile("d-0001")))).filter((n) => /^d-\d+\.json$/.test(n)); } catch { return []; }
};

await test("B2 a Codex worker (via:cli) returning status:doubt opens the doubt: doubt_opened journaled, a doubt record exists, the unit is not stranded `reported`", async () => {
  const s = await sandbox("basic", { codex: true });
  const { writeWorkerPlan } = await fixturesMod();
  const UNIT = "u-build-wo-01-001";
  await writeWorkerPlan(s.env.PANDACORP_FAKE_WORKER_PLAN, { [UNIT]: "doubt" });
  const { start } = await startRun(s, { coordinator: "claude", label: "codex" });
  await noteStandby(s);
  const epochRef = { epoch: start.epoch };
  const found = await drainUntil(s, epochRef, (events) => events.some((e) => e.type === "doubt_opened"));
  const events = await readJournalOf(s); const st = await readStateOf(s);
  const u = st.units.find((x) => x.id === UNIT);
  ok(u, `unit ${UNIT} is not in the state: ${st.units.map((x) => x.id).join(", ")}`);
  ok(found, `the worker's doubt report was never turned into a doubt: no doubt_opened in the journal; unit ${UNIT} is ${u.state} (doubt_id ${u.doubt_id}); journal types: ${[...new Set(events.map((e) => e.type))].join(", ")}`);
  ok((await doubtRecords(s)).length >= 1, "a doubt record build/doubts/<id>.json must exist");
  ok(u.doubt_id, `unit ${UNIT} must carry doubt_id after the doubt is opened`);
  // the ladder must be drivable: the session files the sources step ("no source answers"), then `next` serves the consult unit
  const P = await pathsFor(s.root);
  const doubtId = JSON.parse(await readFile(path.join(path.dirname(P.doubtFile("d-0001")), (await doubtRecords(s))[0]), "utf8")).id;
  await mkdir(path.dirname(P.doubtSourcesFile(doubtId)), { recursive: true });
  await writeFile(P.doubtSourcesFile(doubtId), `${JSON.stringify({ decision: null, rationale: "no source answers", consulted: null })}\n`);
  const ans = s.cli(["doubt", "answer", "--epoch", String(epochRef.epoch), "--id", doubtId, "--file", P.doubtSourcesFile(doubtId)]);
  need(ans, "doubt answer (sources step)");
  const served = await drainUntil(s, epochRef, async () => (await readStateOf(s)).units.some((x) => x.kind === "doubt-consult" && x.doubt_id === doubtId), { maxRounds: 12 });
  const st2 = await readStateOf(s);
  ok(served, `after the sources step the ladder must serve a doubt-consult unit for ${doubtId}; units: ${st2.units.map((x) => `${x.id}:${x.state}`).join(", ")}`);
});

await test("B2 a `blocked` report with diagnosis spec-ambiguous opens a doubt (or hands back): the unit is never left `reported` without a doubt record", async () => {
  const s = await sandbox("basic");
  const { start } = await startRun(s, { coordinator: "claude" });
  await noteStandby(s);
  const nxt = need(s.cli(["next", "--epoch", String(start.epoch)]), "next");
  const served = (nxt.units || []).find((u) => u.kind === "build");
  ok(served, `next must serve a build unit; got action ${nxt.action} units ${JSON.stringify((nxt.units || []).map((u) => `${u.unit}:${u.kind}`))}`);
  const rep = { schema: 1, unit: served.unit, token: served.token, status: "blocked", summary: "the work order is ambiguous", files: [], verification: [], pending: [], doubt: null, diagnosis: { cause: "spec-ambiguous", detail: "AC-01-001.1 does not say which ordering applies" }, gate: null, authored_by: { runtime: "claude", model: "sonnet", effort: "medium" } };
  await mkdir(path.dirname(served.report_path), { recursive: true });
  await writeFile(served.report_path, `${JSON.stringify(rep, null, 2)}\n`);
  const r = s.cli(["report", "--epoch", String(start.epoch), "--unit", served.unit, "--token", served.token, "--file", served.report_path]);
  ok(r.code === 0 || r.code === 6, `report exited ${r.code}: ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 300)}`);
  const st = await readStateOf(s); const u = st.units.find((x) => x.id === served.unit);
  const events = await readJournalOf(s);
  const opened = events.some((e) => e.type === "doubt_opened");
  const handedBack = u.state === "blocked" || events.some((e) => e.type === "handback");
  ok(opened || handedBack, `a spec-ambiguous blocked report must open a doubt (doubt_opened) or hand the unit back; unit is ${u.state}, journal types: ${[...new Set(events.map((e) => e.type))].join(", ")}`);
  if (u.state === "reported") ok(u.doubt_id && (await doubtRecords(s)).length >= 1, `unit ${served.unit} is stuck in reported with no doubt record`);
});

// ============================================================================================ module harness (B3, B4, B6)
// A real fixture repo (flat or Mission-Control-nested), a real lease, an integration worktree on the integration branch with
// WO-01-001 IN_REVIEW, a review worktree, and a hand-written state (the same approach as test-build-v2-review.mjs).
const RUN = "run-r1";
const FRD = "frd-01-alpha";
const PREFIX = "mission-control";
const BUILD_UNIT = "u-build-wo-01-001";
const PATCH_UNIT = "u-patch-wo-01-001";
const REVIEW_UNIT = "u-review-frd-01-alpha";
const WO_REL = `docs/frds/${FRD}/work-orders/wo-01-001.md`;
const CELL = {
  sonnetHigh: { runtime: "claude", model: "sonnet", effort: "high" },
  solHigh: { runtime: "codex", model: "sol", effort: "high" },
};
const workerOf = (cell) => ({ ...cell, via: "agent", pid: null, worker_id: null });
const baseUnit = (over = {}) => ({
  id: BUILD_UNIT, kind: "build", wos: ["WO-01-001"], frd: FRD, chain: "c-wo-01-001", zone: "none", risk_rules: [],
  state: "integrated", attempt: 1, token_hash: null, worker: workerOf(CELL.sonnetHigh), worktree: null, branch: null, depends_on: [],
  pending_answer: null, parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const baseState = (over = {}) => ({
  schema: 2, engine: "v2", run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature",
  status: "active", status_reason: null, tranche: null,
  scope: { card: null, frds: [FRD], wos: ["WO-01-001"], out_of_scope: [] },
  integration: { branch: "x", worktree: "/nonexistent", base_sha: "a".repeat(40) },
  last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {}, ...over,
});
const reviewReport = (over = {}) => ({
  schema: 1, unit: REVIEW_UNIT, token: "TOKEN", reviewer: CELL.solHigh, verdict: "pass", findings: [], probes: [],
  traceability: [{ contract: "AC-01-001.1", contract_class: "acceptance-criterion", status: "pass", tests: ["src/alpha/_tests/list.test.ts"] }],
  doubt: null, ...over,
});
const finding = (id, over = {}) => ({ id, severity: "high", lens: "correctness", file: "src/alpha/list.ts", line: 3, summary: `finding ${id} summary`, probe: null, ...over });

/** Mission-Control-shaped fixture: the project lives in <outer repo>/mission-control; the git root is the parent. */
async function nestedFixture(dir) {
  const f = await fixturesMod();
  const seed = await f.createFixture("basic", { dir: path.join(dir, "seed-parent") });
  const outer = path.join(dir, "outer");
  await mkdir(path.join(outer, PREFIX), { recursive: true });
  await cp(seed.root, path.join(outer, PREFIX), { recursive: true, filter: (src) => path.basename(src) !== ".git" });
  f.git(outer, ["init", "-q", "-b", "main"]); f.git(outer, ["add", "-A"]); f.git(outer, ["commit", "-q", "-m", "fixture: nested initial"]);
  await seed.cleanup();
  return { root: path.join(outer, PREFIX), outer, prefix: PREFIX, sha: f.git(outer, ["rev-parse", "HEAD"]), git: (...a) => f.git(outer, a), cleanup: async () => { await rm(outer, { recursive: true, force: true }); } };
}

/**
 * opts: {nested, units(ctx) -> unit[] (default: build integrated + review running), woStatus, setup(ctx), verifySleep}
 * ctx: fx, env, p, lease, productRoot (integration worktree product root), gitRoot (integration worktree git root), reviewWt,
 *      reviewProductRoot, token, epoch, git, readState, events, unit(id), woText(), makeDeps(route), record(over, route), writeProbe
 */
async function withRun(opts, fn) {
  const f = await fixturesMod();
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pandacorp-r1m-"));
  const fx = opts.nested ? await nestedFixture(dir) : await f.createFixture("basic", { dir });
  const env = f.testEnv(dir, {});
  await mkdir(env.HOME, { recursive: true });
  await f.writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  const saved = { ...process.env };
  Object.assign(process.env, env, { GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" });
  try {
    const paths = await mod("paths.mjs"); const stateMod = await mod("state.mjs"); const journalMod = await mod("journal.mjs");
    const admission = await mod("admission.mjs"); const bs = await buildStateMod();
    const lease = await bs.acquire(fx.root, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
    const p = paths.buildPaths(fx.root, { env });
    const gitRoot = p.integrationWorktree;
    const addWt = (...args) => (opts.nested ? fx.git("worktree", "add", "-q", ...args) : fx.git("worktree", "add", "-q", ...args));
    addWt("-b", p.integrationBranch(RUN), gitRoot, "main");
    const productRoot = opts.nested ? path.join(gitRoot, PREFIX) : gitRoot;
    const wo = path.join(productRoot, WO_REL);
    await writeFile(wo, (await readFile(wo, "utf8")).replace("implementation_status: PLANNED", `implementation_status: ${opts.woStatus || "IN_REVIEW"}`));
    f.git(gitRoot, ["add", "-A"]); f.git(gitRoot, ["commit", "-q", "-m", "chore: wo state"]);
    const reviewWt = p.unitWorktree(REVIEW_UNIT);
    addWt("--detach", reviewWt, p.integrationBranch(RUN));
    const issued = admission.issueToken(REVIEW_UNIT, "B", { file: p.admissionFile });
    const ctx = {
      fx, env, p, lease, productRoot, gitRoot, reviewWt, reviewProductRoot: opts.nested ? path.join(reviewWt, PREFIX) : reviewWt,
      token: issued.token, epoch: lease.epoch, git: f.git, wo, stateMod, journalMod, paths, admission, bs, issued,
      readState: () => stateMod.readState(fx.root, { env }),
      events: async () => (await journalMod.readJournal(p.journalFile)).events,
      unit: async (id) => (await stateMod.readState(fx.root, { env })).units.find((u) => u.id === id),
      woText: () => readFile(wo, "utf8"),
      writeStateWith: (state) => stateMod.writeState(fx.root, state, { env }),
    };
    const reviewUnit = baseUnit({ id: REVIEW_UNIT, kind: "review", wos: [], chain: null, state: "running", attempt: 1, token_hash: issued.token_hash, worker: workerOf(CELL.solHigh), worktree: reviewWt });
    const units = opts.units ? opts.units(ctx, { baseUnit, reviewUnit }) : [baseUnit(), reviewUnit];
    await ctx.writeStateWith(baseState({ epoch: lease.epoch, units, integration: { branch: p.integrationBranch(RUN), worktree: productRoot, base_sha: fx.sha }, ...(opts.state || {}) }));
    ctx.makeDeps = (route, extra = {}) => {
      const reviewCell = () => route;
      const avail = Object.assign(async () => ({ claude: "ok", codex: "ok" }), { claude: "ok", codex: "ok" });
      return { env, clock: () => new Date(NOW), reviewCell, routing: { reviewCell }, availability: avail, ...extra };
    };
    ctx.writeReview = async (over = {}) => { const r = reviewReport({ token: issued.token, ...over }); await mkdir(path.dirname(p.reviewFile(REVIEW_UNIT)), { recursive: true }); await writeFile(p.reviewFile(REVIEW_UNIT), `${JSON.stringify(r, null, 2)}\n`); return r; };
    ctx.record = async (over = {}, route = { primary: CELL.solHigh, used: CELL.solHigh, degraded: null, deferred: null, parked: null }) => {
      const reviewRecord = firstFn(await mod("review.mjs"), ["reviewRecord", "recordReview"], "review.mjs");
      await ctx.writeReview(over);
      return reviewRecord({ project: fx.root, epoch: lease.epoch, unit: REVIEW_UNIT, token: issued.token, file: p.reviewFile(REVIEW_UNIT) }, ctx.makeDeps(route));
    };
    ctx.writeProbe = async (rel, text = "test('probe', () => { throw new Error('red'); });\n") => { const file = path.join(ctx.reviewProductRoot, rel); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); return text; };
    if (opts.setup) await opts.setup(ctx);
    return await fn(ctx);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true });
  }
}
const gitStatus = (c, root) => c.git(root, ["status", "--porcelain"]);

// ============================================================================================ B3
// review-R1 B3: with .pandacorp under a repo prefix (Mission Control = <repo>/mission-control), `git status --porcelain` and
// `git diff --name-only` give top-relative paths, but `git add -f -- <path>` ran from the product root, so the pathspec matched
// nothing (exit 128, FAILCLOSED) AFTER the WO frontmatter was already BLOCKED / PLANNED: the integration worktree was left dirty
// and `land` later refused. And review-record's probeRoot was the git root, while the hashes are product-relative.
// "control" cases run the same scenario in a flat project: they prove the harness and must pass on any version.
for (const nested of [false, true]) {
  const tag = nested ? "B3 nested project" : "control flat project";
  await test(`${tag}: hand-back of a running unit commits the WO BLOCKED on the integration branch and leaves the worktree clean`, async () => withRun({ nested, units: (c, { baseUnit: bu }) => [bu({ state: "running", attempt: 1, worker: workerOf(CELL.sonnetHigh) })] }, async (c) => {
    const failure = await mod("failure.mjs");
    const headBefore = c.git(c.gitRoot, ["rev-parse", "HEAD"]);
    const out = await failure.handbackCommand({ project: c.fx.root, epoch: c.epoch, unit: BUILD_UNIT, reason: "owner stops this unit" }, { env: c.env });
    ok(out && out.ok === true, `handback must succeed, got ${JSON.stringify(out)}`);
    ok(await exists(c.p.handbackFile(BUILD_UNIT)), "the handback file must exist");
    ok(/implementation_status:\s*BLOCKED/.test(await c.woText()), "the WO frontmatter must be BLOCKED");
    eq(gitStatus(c, c.gitRoot), "", "the integration worktree must be clean: the WO transition is committed on the integration branch");
    ok(c.git(c.gitRoot, ["rev-parse", "HEAD"]) !== headBefore, "a commit must carry the WO BLOCKED transition on the integration branch");
    eq((await c.unit(BUILD_UNIT)).state, "blocked", "the unit is blocked");
  }));

  await test(`${tag}: review verdict reopen commits the WO transitions and leaves the worktree clean`, async () => withRun({ nested }, async (c) => {
    const out = await c.record({ verdict: "reopen", findings: [finding("F1", { summary: "list ignores the status filter" })] });
    eq(out.verdict, "reopen", "verdict");
    ok((await c.unit(PATCH_UNIT)), `a patch unit ${PATCH_UNIT} must be queued`);
    ok(/implementation_status:\s*IN_PROGRESS/.test(await c.woText()), "WO must end IN_PROGRESS after the reopen path");
    eq(gitStatus(c, c.gitRoot), "", "the integration worktree must be clean after the reopen (WO transitions committed)");
  }));

  await test(`${tag}: review verdict blocked hands the units back, commits the WO BLOCKED and leaves the worktree clean`, async () => withRun({ nested }, async (c) => {
    const out = await c.record({ verdict: "blocked", findings: [finding("F1", { severity: "critical", summary: "touches Fuera: rewrites billing", lens: "scope" })] });
    eq(out.verdict, "blocked", "verdict");
    ok(await exists(c.p.handbackFile(BUILD_UNIT)), "the handback file of the reviewed unit must exist");
    ok(/implementation_status:\s*BLOCKED/.test(await c.woText()), "the WO must be BLOCKED");
    eq(gitStatus(c, c.gitRoot), "", "the integration worktree must be clean after the blocked verdict");
  }));

  await test(`${tag}: a failed_first probe written under the PRODUCT root is hashed, committed on the integration branch and stored in probe_hashes`, async () => withRun({ nested }, async (c) => {
    const rel = "src/alpha/_tests/probe-filter.test.ts";
    const text = await c.writeProbe(rel);
    const out = await c.record({ verdict: "reopen", findings: [finding("F1", { probe: rel })], probes: [{ path: rel, failed_first: true }] });
    eq(out.probes_committed, [rel], "probes_committed");
    const u = await c.unit(REVIEW_UNIT);
    eq(u.probe_hashes?.[rel], sha256(text), "probe_hashes holds the sha256 of the probe file, product-relative");
    const committed = c.git(c.gitRoot, ["show", `${c.p.integrationBranch(RUN)}:${nested ? `${PREFIX}/` : ""}${rel}`]);
    eq(committed, text.trim(), "the probe file is committed on the integration branch at the product-relative path");
    eq(gitStatus(c, c.gitRoot), "", "the integration worktree is clean after the probe commit");
  }));
}

// ============================================================================================ B4
// review-R1 B4: the second reopen of a WO builds a patch unit with the SAME id (u-patch-<wo>) as the first one; the new unit
// replaced the old in place, and `for (const u of fixed) setState(u, "patching")` then found the NEW patch by id and moved it
// queued -> patching (never dispatched: A13 violation, the run ends in deadlock instead of the attempt-3 fix).
await test("B4 a second reopen of the same WO yields ONE dispatchable patch unit: queued, attempt 3, the WO once, never `patching`", async () => withRun({
  units: (c, { baseUnit: bu, reviewUnit }) => [
    bu({ state: "reviewing", attempt: 1 }),
    bu({ id: PATCH_UNIT, kind: "patch", chain: null, state: "reviewing", attempt: 2, depends_on: [BUILD_UNIT] }),
    { ...reviewUnit, depends_on: [BUILD_UNIT, PATCH_UNIT] },
  ],
  setup: async (c) => {
    // A reviewing patch must have a real integrated commit: PATCH2 pins re-review to that execution's diff.
    const file = "src/alpha/list.ts";
    await writeFile(path.join(c.productRoot, file), `${await readFile(path.join(c.productRoot, file), "utf8")}\nexport const archivedItemsExcluded = true;\n`);
    c.git(c.gitRoot, ["add", file]);
    c.git(c.gitRoot, ["commit", "-q", "-m", "fix: first filter patch", "-m", `Unit: ${PATCH_UNIT}`]);
    c.git(c.reviewWt, ["reset", "--hard", c.p.integrationBranch(RUN)]);
  },
}, async (c) => {
  const out = await c.record({ verdict: "reopen", findings: [finding("F1", { summary: "the filter still ignores archived items" })] });
  eq(out.verdict, "reopen", "verdict");
  const st = await c.readState();
  const patches = st.units.filter((u) => u.id === PATCH_UNIT);
  eq(patches.length, 1, `exactly one unit named ${PATCH_UNIT}`);
  const patch = patches[0];
  eq(patch.kind, "patch", "kind");
  eq(patch.attempt, 3, "the second reopen builds the attempt-3 patch");
  eq(patch.state, "queued", "A13: a freshly built patch unit is `queued` (dispatchable), never `patching`");
  eq(patch.wos, ["WO-01-001"], "the WO appears once in the patch unit (no duplicate from build + old patch)");
  const bad = (await c.events()).filter((e) => e.type === "unit_state" && e.data?.unit === PATCH_UNIT && e.data?.to === "patching");
  eq(bad.length, 0, "no journaled transition of the new patch unit to `patching`");
}));

// ============================================================================================ B5
// review-R1 B5: one `g2` job per FRD, every one with cwd = the single integration worktree (only same-FRD jobs were
// deduplicated), and integration merges were skipped only while a `land` job ran. Two FRDs integrated together therefore ran two
// `verify.sh --since` in one directory (shared gate-report.json, build output, ports), and an integration merge could rewrite the
// tree a G2 was judging: a spurious red burns the 3-execution budget, a spurious green judges a half-merged tree.
const SLOW_VERIFY = "#!/usr/bin/env bash\n# fixture gate stub: slow enough to overlap with the next call\nsleep 6\nexit 0\n";
const g2Units = (c, { baseUnit: bu }) => [
  bu({ id: "u-build-wo-01-001", wos: ["WO-01-001"], frd: "frd-01-alpha", chain: "c-wo-01-001", state: "integrated" }),
  bu({ id: "u-build-wo-01-002", wos: ["WO-01-002"], frd: "frd-01-alpha", chain: "c-wo-01-002", state: "integrated", depends_on: ["u-build-wo-01-001"] }),
  bu({ id: "u-build-wo-02-001", wos: ["WO-02-001"], frd: "frd-02-beta", chain: "c-wo-02-001", state: "integrated" }),
  bu({ id: "u-build-wo-02-002", wos: ["WO-02-002"], frd: "frd-02-beta", chain: "c-wo-02-002", state: "integrated", depends_on: ["u-build-wo-02-001"] }),
];
const g2Scope = { scope: { card: null, frds: ["frd-01-alpha", "frd-02-beta"], wos: ["WO-01-001", "WO-01-002", "WO-02-001", "WO-02-002"], out_of_scope: [] } };
/** Commits a slow verify.sh on the integration branch so a G2 job stays running across two `next` calls, and gives the RAM
 *  admission plenty of memory so two heavy G2 jobs are admitted together (the owner's 10-core Mac has H_max = 2). */
async function slowVerify(c) {
  const { signalsSample } = await fixturesMod();
  const sig = signalsSample("clean"); const pages = (mb) => Math.round((mb * 1048576) / 16384);
  const vm = sig.vm_stat.replace(/Pages free: \d+\./, `Pages free: ${pages(40000)}.`).replace(/Pages inactive: \d+\./, `Pages inactive: ${pages(20000)}.`);
  await writeFile(c.env.PANDACORP_SIGNALS_FILE, `${JSON.stringify({ sysctl_pressure: sig.sysctl_pressure, vm_stat: vm, swapusage: sig.swapusage })}\n`);
  const f = path.join(c.productRoot, ".pandacorp", "verify.sh");
  await writeFile(f, SLOW_VERIFY); await chmod(f, 0o755);
  c.git(c.gitRoot, ["add", "-A"]); c.git(c.gitRoot, ["commit", "-q", "-m", "chore: slow gate stub"]);
}
const nextOnce = (c) => run(["next", "--epoch", String(c.epoch), "--project", c.fx.root], { env: c.env });
const g2Jobs = async (c) => (await c.readState()).jobs.filter((j) => j.kind === "g2");
const realpath = async (f) => (await import("node:fs/promises")).realpath(f);
async function killJobs(c) { for (const j of (await c.readState().catch(() => ({ jobs: [] }))).jobs) if (j.pid && j.pid !== process.pid) { try { process.kill(j.pid, "SIGKILL"); } catch { /* gone */ } } }

await test("B5 two FRDs integrated together: no two concurrent G2 jobs share a worktree", async () => withRun({ units: g2Units, state: g2Scope, setup: slowVerify }, async (c) => {
  try {
    for (let i = 0; i < 3; i++) { need(nextOnce(c), `next #${i + 1}`); if ((await g2Jobs(c)).length >= 2) break; }
    const jobs = (await g2Jobs(c)).filter((j) => j.state === "running");
    ok(jobs.length >= 1, `next must spawn a G2 job for an FRD whose units are all integrated; jobs: ${JSON.stringify((await c.readState()).jobs.map((j) => `${j.kind}:${j.frd}:${j.state}`))}`);
    const cwds = jobs.map((j) => path.resolve(j.cwd));
    eq(new Set(cwds).size, cwds.length, `concurrent G2 jobs must never share a cwd, got ${JSON.stringify(cwds)}`);
  } finally { await killJobs(c); }
}));

await test("B5 each G2 job runs in its OWN worktree (not the integration worktree) pinned at the integration tip it was started on", async () => withRun({ units: g2Units, state: g2Scope, setup: slowVerify }, async (c) => {
  try {
    const tip = c.git(c.gitRoot, ["rev-parse", "HEAD"]);
    for (let i = 0; i < 3; i++) { need(nextOnce(c), `next #${i + 1}`); if ((await g2Jobs(c)).length >= 2) break; }
    const jobs = await g2Jobs(c);
    ok(jobs.length >= 1, "next must spawn at least one G2 job");
    const integ = await realpath(c.gitRoot);
    for (const j of jobs) {
      const cwd = await realpath(j.cwd);
      ok(cwd !== integ, `the G2 job of ${j.frd} runs IN the integration worktree (${cwd}): it must run in a detached snapshot worktree of its own`);
      eq(await realpath(c.git(cwd, ["rev-parse", "--show-toplevel"])), cwd, `the cwd of the G2 job of ${j.frd} must be a git worktree root`);
      eq(c.git(cwd, ["rev-parse", "HEAD"]), tip, `the G2 worktree of ${j.frd} must be pinned at the integration tip it was started on`);
      eq(c.git(cwd, ["status", "--porcelain"]).split("\n").filter((l) => l && !l.includes(".pandacorp/run/")).join("\n"), "", "the G2 worktree starts clean");
    }
    const cwds = jobs.map((j) => path.resolve(j.cwd));
    eq(new Set(cwds).size, cwds.length, "one worktree per G2 job");
  } finally { await killJobs(c); }
}));

await test("B5 an integration merge arriving while a G2 runs never changes the tree that G2 is judging (pinned sha, clean worktree)", async () => withRun({
  units: (c, h) => g2Units(c, h).map((u) => (u.id === "u-build-wo-02-001" ? { ...u, state: "running", worker: { ...u.worker, pid: process.pid } } : u.id === "u-build-wo-02-002" ? { ...u, state: "queued" } : u)),
  state: g2Scope, setup: slowVerify,
}, async (c) => {
  try {
    const tip = c.git(c.gitRoot, ["rev-parse", "HEAD"]);
    need(nextOnce(c), "next #1 (FRD 01 fully integrated, FRD 02 still building)");
    const first = (await g2Jobs(c)).filter((j) => j.state === "running");
    ok(first.length >= 1 && first.every((j) => j.frd === "frd-01-alpha"), `a G2 job for frd-01-alpha must be running; jobs: ${JSON.stringify((await c.readState()).jobs.map((j) => `${j.kind}:${j.frd}:${j.state}`))}`);
    // the FRD-02 unit finishes: a committed chain on its own branch, waiting to be integrated into the integration branch
    const U = "u-build-wo-02-001";
    const wt = c.p.unitWorktree(U); const branch = c.p.unitBranch(RUN, U, 1);
    c.fx.git("worktree", "add", "-q", "-b", branch, wt, c.p.integrationBranch(RUN));
    await writeFile(path.join(wt, "src/beta/view.ts"), "// src/beta/view.ts (fixture stub)\nexport const value = 2;\n");
    c.git(wt, ["add", "-A"]); c.git(wt, ["commit", "-q", "-m", `feat: ${U}\n\nUnit: ${U}\nWO: WO-02-001`]);
    const st = await c.readState();
    Object.assign(st.units.find((u) => u.id === U), { state: "committed", branch, worktree: wt, token_hash: null });
    await c.writeStateWith(st);
    need(nextOnce(c), "next #2 (the committed chain of FRD 02 arrives while the G2 of FRD 01 runs)");
    for (const j of (await g2Jobs(c)).filter((x) => x.state === "running" && x.frd === "frd-01-alpha")) {
      const cwd = j.cwd;
      eq(c.git(cwd, ["rev-parse", "HEAD"]), tip, "the tree the running G2 judges must stay at the sha it was pinned to (an integration merge must not move it)");
      eq(c.git(cwd, ["status", "--porcelain"]).split("\n").filter((l) => l && !l.includes(".pandacorp/run/")).join("\n"), "", "the tree the running G2 judges must stay clean (no half-merged state)");
    }
  } finally { await killJobs(c); }
}));

// ============================================================================================ B6
// review-R1 B6 (DEC-7, N5): a unit built on an assumption (parked:"built_on_assumption", pending_answer = d-1) that raises a SECOND
// doubt d-2 was parked by `parkUnits`, which overwrote parked/pending_answer: the unit stopped being marked as assumed. Rejecting
// d-1 then discarded only the units whose pending_answer is d-1, so U was skipped, was re-dispatched at the same attempt on its
// existing branch (forked from assume-d-1) and, no longer `assumed`, integrated into the integration branch: code the owner
// rejected reached integration (and main in an unlaunched project). Pinned at the pure state level through the real park.mjs and
// answers.mjs functions; the assertions never name the field that remembers the assumption.
const D1 = "d-0001"; const D2 = "d-0002";
const ASSUME_BRANCH = `lane/${RUN}/assume-${D1}`;
const UNIT_BRANCH = `lane/${RUN}/${BUILD_UNIT}`;
const doubtRecord = () => ({
  schema: 1, id: D1, unit: BUILD_UNIT, opened_at: NOW, question: "Which storage?", options: [{ id: "a", text: "files" }, { id: "b", text: "sqlite" }],
  preferred: "a", why: "FRD silent", step: "parked", consults: [], decision: null, assumption: { option: "a", branch: ASSUME_BRANCH },
});
/** U (root block of the run) raised d-1 and was built on the assumption; then it raised d-2 and parked on it. */
async function assumedUnitWithSecondDoubt() {
  const park = await mod("park.mjs");
  const U = baseUnit({ id: BUILD_UNIT, state: "reported", attempt: 1, doubt_id: D1 });
  const dep = baseUnit({ id: "u-build-wo-01-002", wos: ["WO-01-002"], chain: "c-wo-01-002", state: "queued", depends_on: [BUILD_UNIT] });
  const s0 = baseState({ units: [U, dep], scope: { card: null, frds: [FRD], wos: ["WO-01-001", "WO-01-002"], out_of_scope: [] } });
  const assumed = park.assumeUnits(s0, BUILD_UNIT, { question: D1 }).state;
  const unitAssumed = assumed.units.find((u) => u.id === BUILD_UNIT);
  eq(unitAssumed.state, "queued", "assumeUnits requeues the doubting unit");
  // U is dispatched on the assumption branch, builds, and raises a second doubt
  const afterRun = { ...assumed, units: assumed.units.map((u) => (u.id === BUILD_UNIT ? { ...u, state: "reported", branch: UNIT_BRANCH, doubt_id: D2, token_hash: null } : u)) };
  let parked = afterRun; let refused = false;
  try { parked = park.parkUnits(afterRun, BUILD_UNIT, { reason: "owner_question", question: D2 }).state; } catch (e) { if (e.code !== "INVALID_STATE") throw e; refused = true; }
  return { park, afterRun, parked, refused };
}
const discarded = (plan, id) => {
  const eff = plan.units.find((x) => x.unit === id);
  const u = plan.state.units.find((x) => x.id === id);
  return { eff, u };
};
const assertRejectedAssumptionDiscardsUnit = (plan, what) => {
  const { eff, u } = discarded(plan, BUILD_UNIT);
  ok(eff && ["assumption_discarded", "rework_queued", "handed_back"].includes(eff.effect), `${what}: rejecting d-1 must act on the unit built on its assumption (it holds rejected code); effects: ${JSON.stringify(plan.units)}`);
  const requeuedFresh = u.state === "queued" && u.attempt === 2 && u.branch !== UNIT_BRANCH && u.parked !== "built_on_assumption";
  ok(requeuedFresh || u.state === "blocked", `${what}: the unit must be re-queued at attempt+1 on a fresh branch (never reuse ${UNIT_BRANCH}) or be handed back; got state ${u.state}, attempt ${u.attempt}, branch ${u.branch}`);
};

await test("control B6: a unit built on the assumption is discarded and re-queued at attempt 2 on a fresh branch when the owner rejects d-1 (no second doubt)", async () => {
  const park = await mod("park.mjs"); const { planAnswer } = await mod("answers.mjs");
  const U = baseUnit({ id: BUILD_UNIT, state: "reported", attempt: 1, doubt_id: D1 });
  const assumed = park.assumeUnits(baseState({ units: [U] }), BUILD_UNIT, { question: D1 }).state;
  const ran = { ...assumed, units: assumed.units.map((u) => ({ ...u, state: "reported", branch: UNIT_BRANCH, token_hash: null })) };
  assertRejectedAssumptionDiscardsUnit(planAnswer({ state: ran, question: D1, value: "b", doubt: doubtRecord() }), "control");
});

await test("B6 second doubt on an assumed unit: the unit keeps its assumption marker (assumptionUnits still lists it) while parked on d-2", async () => {
  const { park, parked } = await assumedUnitWithSecondDoubt();
  ok(park.assumptionUnits(parked, D1).some((u) => u.id === BUILD_UNIT), `after parking on d-2 the unit must still be recognised as built on the assumption of ${D1}: parkUnits must not erase the marker (or must refuse the second park); assumptionUnits(d-1) = ${JSON.stringify(park.assumptionUnits(parked, D1).map((u) => u.id))}`);
});

await test("B6 owner rejects d-1 while the unit is parked on d-2: the unit is discarded and re-queued on a fresh branch, the rejected code never integrates", async () => {
  const { planAnswer } = await mod("answers.mjs"); const { parked } = await assumedUnitWithSecondDoubt();
  assertRejectedAssumptionDiscardsUnit(planAnswer({ state: parked, question: D1, value: "b", doubt: doubtRecord() }), "rejection while parked on d-2");
});

await test("B6 d-2 answered first (unit released and re-dispatchable), then the owner rejects d-1: the unit is still discarded, never integrated as non-assumed", async () => {
  const { planAnswer } = await mod("answers.mjs"); const { park, parked } = await assumedUnitWithSecondDoubt();
  const released = park.releaseParked(parked, D2).state;
  assertRejectedAssumptionDiscardsUnit(planAnswer({ state: released, question: D1, value: "b", doubt: doubtRecord() }), "rejection after d-2 was answered");
});

// ============================================================================================ NB1
// review-R1b NB1: the synthesized spec-ambiguous doubt offered a non-actionable option `ask-owner`; deciding it re-queued the
// unit at the SAME attempt ("stop and ask the owner"), the worker blocked again and the cycle looped (no attempt consumed, no
// owner question) until the quota paused. Correct: deciding "ask the owner" parks the unit as an owner question, and a unit that
// raises the same doubt again never loops at the same attempt (it parks, is handed back, or consumes an attempt).
/** One spec-ambiguous cycle through the CLI: serve the build unit, report blocked+spec-ambiguous, answer the doubt's sources step. */
async function ambiguousCycle(s, epoch, { pick }) {
  let served = null;
  for (let i = 0; i < 4 && !served; i++) {
    const r = s.cli(["next", "--epoch", String(epoch)]);
    if (r.code !== 0) throw new Error(`next exited ${r.code}: ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 300)}`);
    served = (r.json.units || []).find((u) => u.kind === "build") || null;
  }
  if (!served) return { served: null };
  const rep = { schema: 1, unit: served.unit, token: served.token, status: "blocked", summary: "the work order is ambiguous", files: [], verification: [], pending: [], doubt: null, diagnosis: { cause: "spec-ambiguous", detail: "AC-01-001.1 does not say which ordering applies" }, gate: null, authored_by: { runtime: "claude", model: "sonnet", effort: "medium" } };
  await mkdir(path.dirname(served.report_path), { recursive: true });
  await writeFile(served.report_path, `${JSON.stringify(rep, null, 2)}\n`);
  const r = s.cli(["report", "--epoch", String(epoch), "--unit", served.unit, "--token", served.token, "--file", served.report_path]);
  if (r.code !== 0 && r.code !== 6) throw new Error(`report exited ${r.code}: ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 300)}`);
  const st = await readStateOf(s); const u = st.units.find((x) => x.id === served.unit);
  const P = await pathsFor(s.root);
  if (!u.doubt_id) return { served, unit: u, doubt: null };
  const doubt = JSON.parse(await readFile(P.doubtFile(u.doubt_id), "utf8"));
  const optionIds = (doubt.options || doubt.doubt?.options || []).map((o) => o.id);
  const choice = pick(optionIds);
  let answered = null;
  if (doubt.step === "sources" && choice) {
    await mkdir(path.dirname(P.doubtSourcesFile(doubt.id)), { recursive: true });
    await writeFile(P.doubtSourcesFile(doubt.id), `${JSON.stringify({ decision: choice, rationale: "decided by the test, see docs/product/prd.md:1", consulted: null })}\n`);
    answered = s.cli(["doubt", "answer", "--epoch", String(epoch), "--id", doubt.id, "--file", P.doubtSourcesFile(doubt.id)]);
  }
  return { served, unit: (await readStateOf(s)).units.find((x) => x.id === served.unit), doubt, optionIds, choice, answered };
}

await test("NB1 a doubt whose decision is `ask-owner` parks the unit as an owner question: no re-queue at the same attempt", async () => {
  const s = await sandbox("basic"); const { start } = await startRun(s, { coordinator: "claude" }); await noteStandby(s);
  const c = await ambiguousCycle(s, start.epoch, { pick: (ids) => ids.find((id) => /ask.?owner/i.test(id)) || null });
  ok(c.served, "next must serve a build unit");
  ok(c.unit.doubt_id, `the spec-ambiguous block must open a doubt (unit is ${c.unit.state})`);
  if (!c.choice) return; // the engine no longer offers a non-actionable `ask-owner` option (the preferred fix): nothing to decide
  need(c.answered, "doubt answer (sources step: ask-owner)");
  const u = c.unit;
  ok(!(u.state === "queued" && u.attempt === c.served.attempt && !u.parked), `deciding ask-owner re-queued ${u.id} at the same attempt ${u.attempt} instead of parking it (state ${u.state})`);
  ok(u.state === "parked" || u.parked === "owner_question" || u.state === "blocked", `unit must be parked as an owner question; got state ${u.state} parked ${u.parked}`);
  if (u.parked) eq(u.parked, "owner_question", "park reason");
  if (u.state === "parked") eq(u.pending_answer, c.doubt.id, "pending_answer is the doubt id the owner answers");
});

await test("NB1 a unit that blocks spec-ambiguous again after a decided doubt never loops at the same attempt (parks, hands back or consumes an attempt)", async () => {
  const s = await sandbox("basic"); const { start } = await startRun(s, { coordinator: "claude" }); await noteStandby(s);
  // always decide the first listed option (an actionable reading), or `ask-owner` when that is all that is offered
  const pick = (ids) => ids[0] || null;
  let unitId = null; const trail = [];
  for (let i = 0; i < 4; i++) {
    const c = await ambiguousCycle(s, start.epoch, { pick });
    if (!c.served) { trail.push(`cycle ${i + 1}: nothing served`); break; }
    if (unitId && c.served.unit !== unitId) { trail.push(`cycle ${i + 1}: other unit ${c.served.unit}`); continue; }
    unitId = c.served.unit;
    const u = c.unit;
    if (c.answered) need(c.answered, `cycle ${i + 1}: doubt answer`);
    trail.push(`cycle ${i + 1}: ${u.id} attempt ${c.served.attempt} -> ${u.state}${u.parked ? `:${u.parked}` : ""}${u.doubt_id ? ` ${u.doubt_id}` : ""}`);
    if (u.state === "parked" || u.parked || u.state === "blocked" || u.attempt > c.served.attempt) { trail.push("bounded"); break; }
  }
  const st = await readStateOf(s); const u = st.units.find((x) => x.id === unitId);
  ok(unitId && u, `no build unit was cycled: ${trail.join(" | ")}`);
  const decided = (await readJournalOf(s)).filter((e) => e.type === "autonomous_decision" && (e.data?.unit === unitId || !e.data?.unit)).length;
  const loops = decided >= 2 && u.state === "queued" && !u.parked && u.attempt === 1;
  ok(!loops, `unbounded loop: ${decided} autonomous decisions on ${unitId} and it is still queued at attempt ${u.attempt} (trail: ${trail.join(" | ")})`);
});

// ============================================================================================ NB2
// review-R1b NB2: when creating the G2 pinned snapshot worktree fails and nothing else is running (the last FRD), `next` answered
// stop/no_progress in the same pass while the note said "se reintenta": the run quiesced and the retry never happened. The failure
// is injected by making the snapshot root (<build>/g2) a regular file, so creating a worktree under it fails on every attempt.
await test("NB2 a failing G2 snapshot never stops the run silently: `next` waits and retries (and works once the obstacle is gone), or hands back as env-infra", async () => withRun({ units: (c, h) => g2Units(c, h).slice(0, 2), state: { scope: { card: null, frds: ["frd-01-alpha"], wos: ["WO-01-001", "WO-01-002"], out_of_scope: [] } }, setup: slowVerify }, async (c) => {
  try {
    const g2Root = path.join(path.dirname(c.p.integrationWorktree), "g2");
    await rm(g2Root, { recursive: true, force: true });
    await writeFile(g2Root, "not a directory: makes every G2 snapshot creation fail\n");
    const seen = []; let handedBack = false; let waits = 0;
    for (let i = 0; i < 5 && !handedBack; i++) {
      const r = nextOnce(c);
      const text = `${r.stdout} ${r.stderr}`;
      seen.push(`#${i + 1} exit ${r.code} action ${r.json?.action} reason ${r.json?.reason}`);
      ok(r.code !== 3, `the run was fenced/ended silently after a G2 snapshot failure: ${seen.join(" ; ")}`);
      const evs = await c.events();
      handedBack = evs.some((e) => e.type === "handback");
      if (handedBack) {
        ok(/env.?infra|entorno/i.test(`${text} ${JSON.stringify(evs.filter((e) => e.type === "handback"))}`), `a G2 snapshot hand-back must be reported as an environment (env-infra) failure: ${text.slice(0, 400)}`);
        ok(waits >= 1, `the engine must retry (wait) at least once before handing the FRD back: ${seen.join(" ; ")}`);
        break; // the hand-back pass may legitimately answer done: nothing left to run
      }
      ok(r.json?.action !== "stop", `next stopped (${r.json?.reason}) after a G2 snapshot failure with neither a retry nor a hand-back: ${seen.join(" ; ")}`);
      eq(r.json?.action, "wait", `a failed G2 snapshot must be retried later (action wait) until the hand-back, got ${seen.join(" ; ")}`);
      waits++;
    }
    if (!handedBack) {
      await rm(g2Root, { force: true });
      let jobs = [];
      for (let i = 0; i < 3 && jobs.length < 1; i++) { nextOnce(c); jobs = await g2Jobs(c); }
      ok(jobs.length >= 1, `after repeated snapshot failures the engine neither handed back nor retried; jobs ${JSON.stringify((await c.readState()).jobs)}; ${seen.join(" ; ")}`);
    }
  } finally { await killJobs(c); }
}));

// ============================================================================================ END (keep last)
await cleanupSandboxes();
console.log(`RESULT: ${passed} passed, ${failed} failed (test-build-v2-review-r1)`);
process.exit(failed ? 1 : 0);
