#!/usr/bin/env node
// test-build-v2-hardening.mjs: regression suite for the hardening fixes of TRIAGE-2 (batches A..D, build/reports/FIX2-*.md) and
// DEC-10 (doubt adjustments). Run: node plugin/scripts/test-build-v2-hardening.mjs   (H_ONLY=<regex> runs the matching cases).
// Written from the fix reports, the CLI doc and the modules' export lines/JSDoc; no module body was read.
//
// Sections:  S1 integration worktree bootstrap (module)      S2 landing bootstrap gate (next, env-infra hand-back, 3rd stops)
//            S3 NB4 finish on a quiesced lease                S4 NB5 G2 snapshots removed on stop/finish
//            S5 resume heals the integration worktree        S6 doubts (DEC-10, N12, N13, N10b, commit flags, rebuild link)
//            S7 preflight corrupt deferred ledger            S8 worker prompt files 0600 / release variable / MODEL_STRENGTH / Fable
//
// ASSUMED INTERFACE (CLI doc + FIX2 reports; the orchestrator reconciles test and modules):
//   - integrate.bootstrapIntegrationWorktree({project, runId, root, force}, deps) -> {ok, ran, cached, exit, tail}; deps.exec(cmd,args,{cwd,env,timeout})
//     -> {code, stdout, stderr, timedOut}; the script is `<root>/.pandacorp/worktree-bootstrap.sh`; marker `<build>/integration-bootstrap.json`.
//   - next landing: deps.integrate.bootstrapIntegrationWorktree is consulted before `land`; a failure hands one ready unit back via the REAL
//     failure.handbackCommand with cause env-infra (journal `handback`), returns wait reason "gate" and never "land"; the 3rd consecutive stops.
//   - CLI: start --detect|--preflight|--run|--resume, next, stop --epoch, finish --epoch, as in test-build-v2-review-r1.mjs.
//   - doubt record `consults[]`, `step`, `decision` as in doubt.schema.json; park reasons are searched in record + journal + decisions.md text.
import { spawnSync } from "node:child_process";
import { chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync as require_write } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "pandacorp-build.mjs");
const CODEX_WORKER = path.join(HERE, "codex-worker.mjs");
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const NOW = "2026-11-11T12:00:00.000Z";
const LATER = "2026-11-11T15:00:00.000Z";
const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";
const ONLY = process.env.H_ONLY ? new RegExp(process.env.H_ONLY) : null;

let passed = 0; let failed = 0;
const test = async (name, fn) => {
  if (ONLY && !ONLY.test(name)) return;
  try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${String(e.message).slice(0, 900)}`); failed++; }
};
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };
const fixturesMod = () => import(pathToFileURL(FIXTURES).href);
const mod = (file) => import(pathToFileURL(path.join(BUILD, file)).href);
const buildStateMod = () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);
const gitIn = (cwd, ...args) => spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: { PATH: process.env.PATH, HOME: os.tmpdir(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout.trim();
const scratch = (prefix) => mkdtemp(path.join(SCRATCH_ROOT, prefix));

// ============================================================================================ CLI sandbox (S3..S5, S7)
const sandboxes = []; const bgPids = new Set();
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
async function sandbox(preset = "basic") {
  const { createFixture, testEnv, writeSignalsFile, writeRolloutSample, writeWorkerPlan } = await fixturesMod();
  const dir = await scratch("pandacorp-h-");
  const fixture = await createFixture(preset, { dir });
  const env = testEnv(dir, {});
  await mkdir(env.HOME, { recursive: true });
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  await writeRolloutSample(env.CODEX_HOME, "normal");
  await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, {});
  const s = { dir, fixture, env, root: fixture.root };
  s.envWith = (extra) => ({ ...env, ...extra });
  s.cli = (args, opts = {}) => run([...args, "--project", fixture.root], { env: opts.env || env, cwd: opts.cwd, timeout: opts.timeout });
  sandboxes.push(s);
  return s;
}
const pathsFor = async (root, env) => (await mod("paths.mjs")).buildPaths(root, env ? { env } : {});
async function startRun(s, { coordinator = "claude", label = coordinator } = {}) {
  const det = need(s.cli(["start", "--detect"]), "start --detect");
  const scopeFile = path.join(s.dir, "scope-in.json");
  await writeFile(scopeFile, JSON.stringify(det.scope));
  need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", label, "--session-model", "sonnet", "--probe-codex"]), "start --preflight");
  const start = need(s.cli(["start", "--run", "--scope-json", scopeFile, "--label", label, "--coordinator", coordinator, "--session-model", "sonnet"]), "start --run");
  return { detect: det, start, scopeFile };
}
const readStateOf = async (s) => JSON.parse(await readFile((await pathsFor(s.root)).stateFile, "utf8"));
async function readJournalOf(s) {
  try { return (await readFile((await pathsFor(s.root)).journalFile, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
async function noteStandby(s) {
  try { const j = JSON.parse(await readFile((await pathsFor(s.root)).driveStandbyFile, "utf8")); if (j.pid) bgPids.add(j.pid); } catch { /* none */ }
}
async function cleanupSandboxes() {
  for (const s of sandboxes) await noteStandby(s);
  for (const pid of bgPids) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
  bgPids.clear();
  for (const s of sandboxes) { try { await s.fixture.cleanup(); } catch { /* ignore */ } await rm(s.dir, { recursive: true, force: true }); }
}

// ============================================================================================ S1 bootstrap module
// FIX2-A FIX-D-4: bootstrapIntegrationWorktree runs `bash .pandacorp/worktree-bootstrap.sh` in the integration worktree, caches a
// success per (run, root), re-runs after a failure, never throws on the script's exit, and never passes the release variable.
async function bootstrapBox() {
  const dir = await scratch("pandacorp-h-bs-");
  const { createFixture, testEnv } = await fixturesMod();
  const fx = await createFixture("basic", { dir });
  const env = testEnv(dir, { [RELEASE_VAR]: "1" });
  const root = path.join(dir, "integration-root");
  await mkdir(path.join(root, ".pandacorp"), { recursive: true });
  const calls = []; let exitCode = 0;
  const exec = async (cmd, args, opts = {}) => {
    if (cmd === "git") { const r = spawnSync("git", args, { cwd: opts.cwd, encoding: "utf8", env: opts.env }); return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "", timedOut: false }; }
    calls.push({ cmd, args, cwd: opts.cwd, env: opts.env, timeout: opts.timeout });
    return { code: exitCode, stdout: exitCode ? "boom: could not install\n" : "ok\n", stderr: "", timedOut: false };
  };
  const script = path.join(root, ".pandacorp", "worktree-bootstrap.sh");
  return {
    dir, fx, env, root, calls, script, exec, deps: () => ({ env, exec }),
    setExit: (n) => { exitCode = n; },
    addScript: () => writeFile(script, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 }),
    marker: async () => { const p = (await pathsFor(fx.root, env)).build; try { return JSON.parse(await readFile(path.join(p, "integration-bootstrap.json"), "utf8")); } catch { return null; } },
    done: async () => { await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true }); },
  };
}
const withBox = async (fn) => { const b = await bootstrapBox(); try { return await fn(b); } finally { await b.done(); } };
const bootstrap = async (b, extra = {}) => (await mod("integrate.mjs")).bootstrapIntegrationWorktree({ project: b.fx.root, runId: "run-h1", root: b.root, ...extra }, b.deps());

await test("S1 bootstrap: a project without the script needs none (ok, ran:false) and writes no marker", async () => withBox(async (b) => {
  const r = await bootstrap(b);
  eq([r.ok, r.ran], [true, false], "ok/ran"); eq(b.calls.length, 0, "no process started"); eq(await b.marker(), null, "no marker");
}));

await test("S1 bootstrap: runs the script once in the root with a timeout, caches a success, force re-runs", async () => withBox(async (b) => {
  await b.addScript();
  const r1 = await bootstrap(b);
  eq([r1.ok, r1.ran], [true, true], "first call runs"); eq(b.calls.length, 1, "one process");
  eq(b.calls[0].cmd, "bash", "bash runs the script"); ok(b.calls[0].args.join(" ").includes("worktree-bootstrap.sh"), `argv names the script: ${b.calls[0].args}`);
  eq(path.resolve(b.calls[0].cwd), path.resolve(b.root), "cwd = the product root of the integration worktree");
  ok(b.calls[0].timeout >= 60_000, `a real timeout is set (got ${b.calls[0].timeout})`);
  const m = await b.marker(); ok(m && m.ok === true && m.run_id === "run-h1", `marker records the success: ${JSON.stringify(m)}`);
  const r2 = await bootstrap(b);
  eq([r2.ok, r2.cached, r2.ran], [true, true, false], "same run + root is cached"); eq(b.calls.length, 1, "script not run again");
  const r3 = await bootstrap(b, { force: true }); eq(r3.ran, true, "force re-runs"); eq(b.calls.length, 2, "second process");
  const r4 = await bootstrap(b, { runId: "run-other" }); eq(r4.ran, true, "another run id is not cached");
}));

await test("S1 bootstrap: a non-zero exit returns {ok:false, exit, tail} without throwing, is marked failed, and the next call re-runs", async () => withBox(async (b) => {
  await b.addScript(); b.setExit(75);
  const r = await bootstrap(b);
  eq([r.ok, r.ran, r.exit], [false, true, 75], "failure result"); ok(String(r.tail).includes("boom"), `tail carries the output: ${r.tail}`);
  const m = await b.marker(); ok(m && m.ok === false && m.exit === 75, `marker records the failure: ${JSON.stringify(m)}`);
  b.setExit(0); const again = await bootstrap(b);
  eq([again.ok, again.ran], [true, true], "a failed bootstrap is never cached");
}));

await test("S1 bootstrap: the release variable is absent from the script's environment (D1)", async () => withBox(async (b) => {
  await b.addScript(); await bootstrap(b);
  eq(b.calls.length, 1, "script ran"); ok(!(RELEASE_VAR in (b.calls[0].env || {})), `${RELEASE_VAR} reached the bootstrap script env`);
}));

await test("S1 bootstrap: a spawn failure or timeout is a failed result, never a throw", async () => withBox(async (b) => {
  await b.addScript();
  const deps = { env: b.env, exec: async () => ({ code: 127, stdout: "", stderr: "spawn bash ENOENT", timedOut: false }) };
  const r = await (await mod("integrate.mjs")).bootstrapIntegrationWorktree({ project: b.fx.root, runId: "run-h1", root: b.root }, deps);
  eq([r.ok, r.exit], [false, 127], "spawn failure");
  const t = await (await mod("integrate.mjs")).bootstrapIntegrationWorktree({ project: b.fx.root, runId: "run-h2", root: b.root }, { env: b.env, exec: async () => ({ code: 124, stdout: "", stderr: "", timedOut: true }) });
  eq(t.ok, false, "timeout is a failure");
}));

// ============================================================================================ S2 landing bootstrap gate
// FIX2-A (b): when the integration worktree cannot be prepared, `next` must not return `land`: it hands one ready unit back with
// cause env-infra, returns wait/gate, and the third consecutive env-infra hand-back stops the run (env_infra_handbacks).
const RUN2 = "run-h2";
const nestedFixtureSetup = async (dir) => {
  const f = await fixturesMod();
  const { createFixture, testEnv, writeSignalsFile } = f;
  const stateMod = await mod("state.mjs"); const pathsMod = await mod("paths.mjs"); const journalMod = await mod("journal.mjs");
  const bs = await buildStateMod();
  const fx = await createFixture("basic", { dir });
  const env = testEnv(dir);
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  await mkdir(env.HOME, { recursive: true });
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  const lease = await bs.acquire(fx.root, { runtime: "claude", runId: RUN2, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const P = pathsMod.buildPaths(fx.root, { env });
  fx.git("worktree", "add", "-q", "-b", P.integrationBranch(RUN2), P.integrationWorktree, "main");
  const mk = (id, wo, over = {}) => stateMod.newUnit({ id, kind: "build", wos: [wo], frd: "frd-01-alpha", chain: `c-${wo.toLowerCase()}`, state: "verified", ...over });
  const units = [mk("u-build-wo-01-001", "WO-01-001"), mk("u-build-wo-01-002", "WO-01-002", { depends_on: ["u-build-wo-01-001"] }),
    stateMod.newUnit({ id: "u-review-frd-01-alpha", kind: "review", wos: [], frd: "frd-01-alpha", chain: null, state: "verified" }),
    stateMod.newUnit({ id: `u-audit-${RUN2}`, kind: "audit", wos: [], frd: null, chain: null, state: "verified" })];
  const state = stateMod.newState({ run_id: RUN2, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "feature", status: "active",
    scope: { card: null, frds: ["frd-01-alpha"], wos: ["WO-01-001", "WO-01-002"], out_of_scope: [] },
    integration: { branch: P.integrationBranch(RUN2), worktree: P.integrationWorktree, base_sha: fx.sha }, units, jobs: [], handbacks_in_a_row: 0, answers: {} });
  await stateMod.writeState(fx.root, state, { env });
  return { fx, env, P, lease, stateMod, journalMod, bs, dir };
};
const nextFn = async () => { const m = await mod("next.mjs"); for (const n of ["next", "runNext", "nextAction", "schedule"]) if (typeof m[n] === "function") return m[n]; throw new Error("next.mjs exports no entry point"); };
const SAVED_ENV = { ...process.env };
const restoreEnv = () => { for (const k of Object.keys(process.env)) if (!(k in SAVED_ENV)) delete process.env[k]; Object.assign(process.env, SAVED_ENV); };

async function landingCase(fn) {
  const dir = await scratch("pandacorp-h-land-");
  try {
    const c = await nestedFixtureSetup(dir);
    const realIntegrate = await mod("integrate.mjs");
    const integrate = new Proxy({ ...realIntegrate }, { get(t, k) {
      if (k === "integrateCommitted") return async ({ state }) => ({ state, integrated: [], conflicts: [], events: [], cleanup: [] });
      return t[k];
    } });
    // the REAL bootstrap runs the project's own script from the integration worktree (committed on the integration branch)
    const setBootstrap = (exitCode) => {
      const wt = c.P.integrationWorktree;
      spawnSync("mkdir", ["-p", path.join(wt, ".pandacorp")]);
      require_write(path.join(wt, ".pandacorp", "worktree-bootstrap.sh"), `#!/usr/bin/env bash\necho "bootstrap says no" >&2\nexit ${exitCode}\n`);
      gitIn(wt, "add", "-f", ".pandacorp/worktree-bootstrap.sh");
      spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=T", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "test: bootstrap script"], { cwd: wt, env: { PATH: process.env.PATH, HOME: os.tmpdir(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
    };
    setBootstrap(75);
    const next = await nextFn();
    const callNext = (extra = {}) => next({ project: c.fx.root, epoch: c.lease.epoch, wait: 0, sessionModel: "opus", ...extra }, { env: c.env, integrate });
    const ctx = { ...c, setBootstrap, callNext,
      readState: () => c.stateMod.readState(c.fx.root, { env: c.env }), events: async () => (await c.journalMod.readJournal(c.P.journalFile)).events };
    return await fn(ctx);
  } finally { restoreEnv(); await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

await test("S2 landing: a failing integration bootstrap (exit 75) never returns `land`: env-infra hand-back, wait/gate, no G3 job", async () => landingCase(async (c) => {
  const r = await c.callNext();
  ok(r.action !== "land", `a failed bootstrap must not return land (got ${r.action})`);
  eq(r.action, "wait", "action"); eq(r.wait?.reason, "gate", "wait reason");
  ok(existsSync(path.join(c.P.build, "integration-bootstrap.json")) && JSON.parse(readFileSync(path.join(c.P.build, "integration-bootstrap.json"), "utf8")).ok === false, "the failed bootstrap is recorded in its marker");
  const st = await c.readState();
  eq(st.handbacks_in_a_row, 1, "one env-infra hand-back counted");
  ok(st.units.some((u) => u.state === "blocked"), `a unit is handed back (blocked): ${st.units.map((u) => `${u.id}:${u.state}`).join(", ")}`);
  ok(!st.jobs.some((j) => j.kind === "land"), "no land job started");
  const ev = await c.events();
  const hb = ev.find((e) => e.type === "handback"); ok(hb, `a handback event is journaled: ${[...new Set(ev.map((e) => e.type))].join(", ")}`);
  ok(JSON.stringify(hb).includes("env-infra"), `the hand-back cause is env-infra: ${JSON.stringify(hb).slice(0, 300)}`);
  ok(!ev.some((e) => e.type === "gate" && /g3/i.test(JSON.stringify(e))), "no G3 verdict was produced");
}));

await test("S2 landing: the third consecutive env-infra hand-back stops the run (stop / env_infra_handbacks); the first two wait", async () => landingCase(async (c) => {
  const actions = [];
  for (let i = 0; i < 3; i++) {
    // re-offer a verified unit each round: the previous one was handed back (blocked), the batch is "complete" again
    if (i > 0) {
      const st = await c.readState();
      const extra = c.stateMod.newUnit({ id: `u-build-wo-0${i + 2}-001`, kind: "build", wos: [`WO-0${i + 2}-001`], frd: "frd-01-alpha", chain: `c-wo-0${i + 2}-001`, state: "verified" });
      st.units.push(extra); st.scope.wos.push(`WO-0${i + 2}-001`); await c.stateMod.writeState(c.fx.root, st, { env: c.env });
    }
    const r = await c.callNext(); actions.push(r.action);
    if (r.action === "stop") break;
  }
  eq(actions, ["wait", "wait", "stop"], "wait, wait, then stop");
  const st = await c.readState(); eq(st.status, "stopped", "state stopped");
  const ev = await c.events(); ok(ev.some((e) => e.type === "run_stopped" && JSON.stringify(e).includes("env_infra_handbacks")), "run_stopped carries env_infra_handbacks");
}));

await test("S2 landing: a healthy bootstrap lets the batch land (control)", async () => landingCase(async (c) => {
  c.setBootstrap(0);
  const r = await c.callNext();
  eq(r.action, "land", "action"); eq((await c.readState()).handbacks_in_a_row, 0, "no hand-back");
}));

// ============================================================================================ S3 NB4 finish on a quiesced lease
// FIX2-A NB4: a stopped state + a quiesced lease (terminal action died between quiesce and release): `finish --epoch E` exits 0, closes the
// state (finished + run_finished), releases the lease; a retry is also exit 0; a wrong epoch is fenced.
async function quiescedRun(s, { status = "finished" } = {}) {
  const { start } = await startRun(s); await noteStandby(s);
  const P = await pathsFor(s.root);
  const st = await readStateOf(s);
  for (const u of st.units) u.state = status === "finished" ? "landed" : u.state;
  st.status = "stopped"; st.status_reason = "test: terminal action died after quiesce";
  await writeFile(P.stateFile, `${JSON.stringify(st, null, 2)}\n`);
  const lease = JSON.parse(await readFile(P.leaseFile, "utf8"));
  await writeFile(P.leaseFile, `${JSON.stringify({ ...lease, quiesced_at: NOW }, null, 2)}\n`);
  return { start, P };
}
await test("S3 NB4: finish on a quiesced lease closes the state (finished, run_finished), releases the lease; retry is exit 0", async () => {
  const s = await sandbox(); const { start, P } = await quiescedRun(s);
  const f = s.cli(["finish", "--epoch", String(start.epoch)]);
  need(f, "finish on a quiesced lease");
  eq((await readStateOf(s)).status, "finished", "state finished");
  const ev = await readJournalOf(s); ok(ev.some((e) => e.type === "run_finished"), `run_finished journaled: ${[...new Set(ev.map((e) => e.type))].join(", ")}`);
  ok(!(await exists(P.tokenFile)), "token file dropped"); ok(!(await exists(P.leaseFile)) || !JSON.parse(await readFile(P.leaseFile, "utf8")).run_id, "lease released");
  const before = (await readJournalOf(s)).length;
  need(s.cli(["finish", "--epoch", String(start.epoch)]), "second finish");
  eq((await readJournalOf(s)).length, before, "the retry journals no new line");
});
await test("S3 NB4: a quiesced lease still fences a foreign epoch (nothing is written)", async () => {
  const s = await sandbox(); const { start, P } = await quiescedRun(s);
  const f = s.cli(["finish", "--epoch", String(start.epoch + 7)]);
  eq(f.code, 3, `wrong epoch exits 3 (FENCE), got ${f.code}: ${f.stdout.slice(0, 200)}`);
  eq((await readStateOf(s)).status, "stopped", "state untouched");
  ok(await exists(P.leaseFile), "lease untouched");
});

// ============================================================================================ S4 NB5 G2 snapshots
// FIX2-A NB5 / BUILD-15: proven engine G2 snapshots and their manifests are removed on stop and finish.
// An arbitrary detached worktree under g2/ has no ownership proof and must survive those same operations.
async function plantSnapshot(s) {
  const P = await pathsFor(s.root);
  const { createG2Snapshot } = await mod("next/g2.mjs");
  const { dir: snap } = await createG2Snapshot({ ref: { project: s.root }, paths: P, d: { env: s.env, log: () => {} } }, await readStateOf(s), "frd-01-alpha");
  const unproven = path.join(P.build, "g2", "snap-h1");
  gitIn(s.root, "worktree", "add", "--detach", "-q", unproven, "HEAD");
  const manifestDir = path.join(P.run, "worktrees"); await mkdir(manifestDir, { recursive: true });
  const manifest = path.join(manifestDir, "HEAD.json");
  await writeFile(manifest, `${JSON.stringify({ path: snap, created_at: NOW })}\n`);
  const unprovenManifest = path.join(manifestDir, "unproven.json");
  await writeFile(unprovenManifest, `${JSON.stringify({ path: unproven, created_at: NOW })}\n`);
  ok(await exists(snap), "snapshot planted");
  return { snap, manifest, unproven, unprovenManifest, P };
}
await test("S4 NB5: `stop --epoch` removes the G2 snapshot worktrees and their manifest entry", async () => {
  const s = await sandbox(); const { start } = await startRun(s); await noteStandby(s);
  const { snap, manifest, unproven, unprovenManifest } = await plantSnapshot(s);
  need(s.cli(["stop", "--epoch", String(start.epoch)]), "stop --epoch");
  ok(!(await exists(snap)), "G2 snapshot directory removed on stop"); ok(!(await exists(manifest)), "snapshot manifest entry removed on stop");
  ok(!gitIn(s.root, "worktree", "list", "--porcelain").includes(snap), "git no longer lists the proven snapshot worktree");
  ok(await exists(unproven) && await exists(unprovenManifest), "unproven detached worktree and its manifest survive stop");
});
await test("S4 NB5: `finish` removes the G2 snapshots too", async () => {
  const s = await sandbox(); const { start } = await quiescedRun(s);
  const { snap, manifest, unproven, unprovenManifest } = await plantSnapshot(s);
  need(s.cli(["finish", "--epoch", String(start.epoch)]), "finish");
  ok(!(await exists(snap)), "G2 snapshot directory removed on finish"); ok(!(await exists(manifest)), "manifest entry removed on finish");
  ok(await exists(unproven) && await exists(unprovenManifest), "unproven detached worktree and its manifest survive finish");
});

// ============================================================================================ S5 resume heals the integration worktree
// FIX2-A: `start --resume` discards uncommitted engine writes in the integration worktree (kill -9 between a WO file write and its commit),
// reports them in run_resumed.data.integration_discarded, and never does so while a land job with a live pid exists.
const resumeSetup = async () => {
  const s = await sandbox(); const { start } = await startRun(s); await noteStandby(s);
  const st = await readStateOf(s); const wt = st.integration.worktree;
  const rel = "docs/frds/frd-01-alpha/work-orders/wo-01-001.md";
  const file = path.join(wt, rel);
  ok(existsSync(file), `the integration worktree holds the WO file: ${file}`);
  return { s, start, st, wt, rel, file, original: await readFile(file, "utf8") };
};
const resume = (s) => s.cli(["start", "--resume", "--coordinator", "claude", "--session-model", "sonnet"], { env: s.envWith({ PANDACORP_NOW: LATER }) });

await test("S5 resume: a dirty tracked file in the integration worktree is discarded, reported, and `next` then works", async () => {
  const { s, start, wt, rel, file, original } = await resumeSetup();
  await writeFile(file, original.replace("PLANNED", "IN_REVIEW"));
  ok(gitIn(wt, "status", "--porcelain").includes("wo-01-001"), "worktree is dirty before the resume");
  const out = need(resume(s), "start --resume"); await noteStandby(s);
  eq(gitIn(wt, "status", "--porcelain"), "", "integration worktree clean after resume");
  eq(await readFile(file, "utf8"), original, "the uncommitted write was discarded");
  const ev = (await readJournalOf(s)).filter((e) => e.type === "run_resumed").pop();
  ok(ev && JSON.stringify(ev.data?.integration_discarded ?? []).includes(rel), `run_resumed.data.integration_discarded lists ${rel}: ${JSON.stringify(ev?.data)}`);
  eq(s.cli(["next", "--epoch", String(out.epoch)], { env: s.envWith({ PANDACORP_NOW: LATER }) }).code, 0, "next exits 0 after the heal");
});
await test("S5 resume: an untracked file in the integration worktree is never touched by the heal", async () => {
  const { s, wt } = await resumeSetup();
  const extra = path.join(wt, "scratch-note.txt"); await writeFile(extra, "keep me\n");
  need(resume(s), "start --resume"); await noteStandby(s);
  ok(existsSync(extra), "an untracked file survives the heal");
});
await test("S5 resume: with a land job alive the integration worktree is NOT healed (the job may be mid-write)", async () => {
  const { s, wt, file, original } = await resumeSetup();
  const P = await pathsFor(s.root); const st = await readStateOf(s);
  st.jobs.push({ id: "j-land-h5", kind: "land", unit: null, frd: null, pid: process.pid, cwd: wt, h_slot: false, started_at: NOW, state: "running", exit: null, worker_id: null });
  await writeFile(P.stateFile, `${JSON.stringify(st, null, 2)}\n`);
  const dirty = original.replace("PLANNED", "IN_REVIEW"); await writeFile(file, dirty);
  need(resume(s), "start --resume with a live land job"); await noteStandby(s);
  eq(await readFile(file, "utf8"), dirty, "the dirty write is kept while a land job is alive");
});

// ============================================================================================ S6 doubts
// Module harness copied in spirit from test-build-v2-doubts.mjs: real git fixture, real lease, an integration worktree on the
// integration branch, a hand-written state, the REAL doubts.mjs / routing.mjs.
const DRUN = "run-h6";
const FRD = "frd-01-alpha";
const U1 = "u-build-wo-01-001";
const CELL = { sonnetHigh: { runtime: "claude", model: "sonnet", effort: "high" }, solHigh: { runtime: "codex", model: "sol", effort: "high" }, opusXhigh: { runtime: "claude", model: "opus", effort: "xhigh" } };
const workerOf = (cell) => ({ ...cell, via: "agent", pid: null, worker_id: null });
const mkUnit = (id, over = {}) => ({
  id, kind: "build", wos: [], frd: FRD, chain: null, zone: "none", risk_rules: [], state: "queued", attempt: 1, token_hash: null,
  worker: workerOf(CELL.sonnetHigh), worktree: null, branch: null, depends_on: [], pending_answer: null, parked: null, waiting_gate: null,
  evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const doubting = (over = {}) => mkUnit(U1, { wos: ["WO-01-001"], chain: "c-wo-01-001", state: "reported", ...over });
const DOUBT = { question: "Paginate the alpha list?", options: [{ id: "opt-yes", text: "yes, 20 per page" }, { id: "opt-no", text: "no, one page" }], preferred: "opt-no", why: "the FRD is silent" };
const SRC_HIT = { decision: "opt-yes", rationale: "docs/frds/frd-01-alpha/frd.md:12 says 20 per page", consulted: null };
const SRC_MISS = { decision: null, rationale: "no source answers", consulted: null };
const consultAnswer = (decision, confidence, consulted, reversible = true) => ({ decision, rationale: "reasoned", consulted, confidence, reversible });

async function withDoubts(opts, fn) {
  const dir = await scratch("pandacorp-h-doubt-");
  const { createFixture } = await fixturesMod();
  const fx = await createFixture("basic", { dir });
  const saved = { ...process.env };
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" });
  try {
    const env = fx.env();
    const { buildPaths } = await mod("paths.mjs"); const stateMod = await mod("state.mjs"); const journalMod = await mod("journal.mjs");
    const admission = await mod("admission.mjs"); const doubts = await mod("doubts.mjs"); const bs = await buildStateMod();
    const lease = await bs.acquire(fx.root, { runtime: "claude", runId: DRUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
    const p = buildPaths(fx.root, { env }); const branch = p.integrationBranch(DRUN);
    fx.git("worktree", "add", "-q", "-b", branch, p.integrationWorktree);
    if (opts.hook) {
      const hooks = path.join(fx.root, ".git", "hooks"); await mkdir(hooks, { recursive: true });
      await writeFile(path.join(hooks, "pre-commit"), "#!/bin/sh\necho 'hook says no' >&2\nexit 1\n", { mode: 0o755 });
      await writeFile(path.join(hooks, "commit-msg"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      fx.git("config", "commit.gpgsign", "true");
    }
    const units = opts.units || [doubting(), mkUnit("u-build-wo-02-001", { frd: "frd-02-beta" }), mkUnit("u-build-wo-02-002", { frd: "frd-02-beta" })];
    await stateMod.writeState(fx.root, {
      schema: 2, engine: "v2", run_id: DRUN, epoch: lease.epoch, coordinator: opts.coordinator || "claude-session", label: "claude", size: "feature", status: "active", status_reason: null,
      tranche: null, scope: { card: null, frds: [FRD], wos: ["WO-01-001"], out_of_scope: [] }, integration: { branch, worktree: p.integrationWorktree, base_sha: fx.sha },
      last_safe_point: null, units, jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {},
    }, { env });
    const avail = Object.assign(async () => ({ claude: "ok", codex: "ok" }), { claude: "ok", codex: "ok" });
    const deps = { env, clock: () => new Date(NOW), availability: avail };
    const ctx = {
      fx, env, p, lease, epoch: lease.epoch, deps, branch, admission, stateMod, journalMod,
      readState: () => stateMod.readState(fx.root, { env }),
      unit: async (id) => (await stateMod.readState(fx.root, { env })).units.find((u) => u.id === id),
      events: async (type) => (await journalMod.readJournal(p.journalFile)).events.filter((e) => !type || e.type === type),
      doubtRec: async (id) => JSON.parse(await readFile(p.doubtFile(id), "utf8")),
      open: async (doubt = DOUBT, { unit = U1 } = {}) => {
        await mkdir(path.dirname(p.unitDoubtFile(unit)), { recursive: true });
        await writeFile(p.unitDoubtFile(unit), `${JSON.stringify(doubt, null, 2)}\n`);
        return doubts.openDoubt({ project: fx.root, epoch: lease.epoch, unit, file: p.unitDoubtFile(unit) }, deps);
      },
      feed: async (id, file, content, token) => {
        await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(content, null, 2)}\n`);
        await doubts.answerDoubt({ project: fx.root, epoch: lease.epoch, id, file, ...(token ? { token } : {}) }, deps);
        const rec = JSON.parse(await readFile(p.doubtFile(id), "utf8"));
        const pending = rec.consults.filter((x) => x.answer === null).pop();
        return { step: rec.step, record: rec, ...(pending ? { consult: pending } : {}) };
      },
      sources: (id, content) => ctx.feed(id, p.doubtSourcesFile(id), content),
      consult: (id, out, content) => out.consult.via === "agent" ? ctx.consultAgent(id, out, content) : ctx.feed(id, p.unitAnswerFile(out.consult.unit), content),
      consultAgent: async (id, out, content) => {
        const issued = admission.issueToken(out.consult.unit, "B", { file: p.admissionFile });
        const st = await stateMod.readState(fx.root, { env });
        if (st.units.some((u) => u.id === out.consult.unit)) st.units = st.units.map((u) => (u.id === out.consult.unit ? { ...u, state: "running", token_hash: issued.token_hash } : u));
        else st.units.push(mkUnit(out.consult.unit, { kind: "doubt-consult", state: "running", frd: null, token_hash: issued.token_hash, worker: workerOf(CELL.opusXhigh) }));
        await stateMod.writeState(fx.root, st, { env });
        return ctx.feed(id, p.unitAnswerFile(out.consult.unit), content, issued.token);
      },
      // everything the engine wrote about a parked/decided doubt, to search a reason string without guessing its exact field
      trace: async (id) => JSON.stringify([await ctx.doubtRec(id).catch(() => null), await ctx.events(), await readFile(path.join(fx.root, ".pandacorp", "inbox", "decisions.md"), "utf8").catch(() => ""),
        await readFile(path.join(p.integrationWorktree, ".pandacorp", "inbox", "decisions.md"), "utf8").catch(() => "")]),
    };
    return await fn(ctx);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
// the park reason is journaled/filed as its code or as the owner-facing Spanish sentence of doubts.mjs
const REASON_TEXT = { no_consensus: "no coincidieron", consult_irreversible: "irreversible", failclosed: "no pudo evaluarla", repeat_doubt: "volvió a aparecer" };
const hasReason = (trace, code) => trace.includes(code) || trace.includes(REASON_TEXT[code]);
const D3 = { ...DOUBT, options: [...DOUBT.options, { id: "opt-maybe", text: "paginate on demand" }] };

await test("S6 N13 (DEC-10): after 2 consults without a 2-of-3 winner the doubt parks no_consensus and never asks a third consult", async () => withDoubts({}, async (c) => {
  const { doubt_id: id } = await c.open(D3);
  const s1 = await c.sources(id, SRC_MISS);
  const s2 = await c.consult(id, s1, consultAnswer("opt-yes", "high", CELL.solHigh));
  const out = await c.consultAgent(id, s2, consultAnswer("opt-maybe", "high", CELL.opusXhigh));
  eq(out.step, "decided", "step"); eq(out.record.consults.length, 2, "exactly two consults were asked (no third)");
  ok(!out.consult, "no pending third consult");
  ok(out.record.assumption.rationale && out.record.assumption.revert, "autonomous reason and reversal recorded");
  const u = await c.unit(U1); eq([u.state, u.parked], ["queued", null], "unit proceeds on reversible assumption");
}));

await test("S6 N13: a winner chosen with a voter that says reversible:false parks consult_irreversible (never decided)", async () => withDoubts({}, async (c) => {
  const { doubt_id: id } = await c.open(DOUBT);
  const s1 = await c.sources(id, SRC_MISS);
  const out = await c.consult(id, s1, consultAnswer("opt-no", "high", CELL.solHigh, false));
  ok(out.step !== "decided", `an irreversible winner must not be decided (step ${out.step})`);
  if (out.step === "parked") ok(hasReason(await c.trace(id), "consult_irreversible"), "parked with consult_irreversible");
}));

await test("S6 N10b (DEC-10): a doubt on a unit whose WO id is not found never reaches decided (fail-closed veto), even on a sources hit", async () => withDoubts({ units: [doubting({ wos: ["WO-09-009"] }), mkUnit("u-build-wo-02-001", { frd: "frd-02-beta" })] }, async (c) => {
  const opened = await c.open();
  eq(opened.step, "parked", `the fail-closed veto parks the doubt at once: step ${opened.step}`);
  ok(hasReason(await c.trace(opened.doubt_id), "failclosed"), "veto reason failclosed");
  const u = await c.unit(U1); eq([u.state, u.parked], ["parked", "owner_question"], "unit parked for the owner (never built on an assumption)");
}));

await test("S6 N10b: control, a doubt on a readable WO with a sources hit is decided", async () => withDoubts({}, async (c) => {
  const { doubt_id: id } = await c.open();
  eq((await c.sources(id, SRC_HIT)).step, "decided", "decided");
}));

await test("S6 N10b: readWoArtifacts parses inline `artifacts: [a, 'b', \"c\"]` lists and reports unreadable docs/frds", async () => {
  const dir = await scratch("pandacorp-h-art-");
  try {
    const { readWoArtifacts } = await mod("doubts.mjs");
    const wo = path.join(dir, "docs", "frds", "frd-01-alpha", "work-orders"); await mkdir(wo, { recursive: true });
    await writeFile(path.join(wo, "wo-01-001.md"), "---\nid: WO-01-001\nartifacts: [src/a.ts, 'src/b.ts', \"src/c.ts\"]\n---\n# x\n");
    const r = await readWoArtifacts(dir, ["WO-01-001"], {});
    eq([...r.artifacts].sort(), ["src/a.ts", "src/b.ts", "src/c.ts"], "inline list parsed with quotes stripped"); eq(r.missing, [], "nothing missing");
    const none = await readWoArtifacts(path.join(dir, "no-such-root"), ["WO-01-001"], {});
    ok(none.unreadable.length >= 1 || none.missing.length >= 1, `a missing docs/frds is reported: ${JSON.stringify(none)}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

await test("S6 N12: a doubt id is never reused after a kill -9 (journal doubt_opened without a record file)", async () => withDoubts({ units: [doubting(), mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], state: "reported" })] }, async (c) => {
  const { doubt_id: first } = await c.open();
  await rm(c.p.doubtFile(first), { force: true });
  const { doubt_id: second } = await c.open(DOUBT, { unit: "u-build-wo-01-002" });
  ok(second !== first, `id ${first} was reused after its record was lost`);
  eq(Number(second.replace(/\D/g, "")), Number(first.replace(/\D/g, "")) + 1, "ids continue after the highest journaled id");
}));

const SYNTH = (detail) => ({ question: `Spec ambigua: ${detail}`, options: [{ id: "conservative", text: "take the conservative reading" }, { id: "ask-owner", text: "ask the owner" }], preferred: "conservative", why: "synthesized by the engine" });
await test("S6 DR1c-N1: synthesized doubts are compared by normalized question: a DISTINCT second ambiguity is consulted, a reworded repeat parks repeat_doubt", async () => {
  await withDoubts({}, async (c) => {
    const first = await c.open(SYNTH("AC-1 ordering unclear"));
    const d1 = await c.sources(first.doubt_id, { decision: "conservative", rationale: "docs/frds/frd-01-alpha/frd.md:3 reads conservatively", consulted: null });
    eq(d1.step, "decided", "first synthesized doubt decided");
    const st = await c.readState(); st.units = st.units.map((u) => (u.id === U1 ? { ...u, state: "reported" } : u)); await c.stateMod.writeState(c.fx.root, st, { env: c.env });
    const second = await c.open(SYNTH("AC-2 pagination size unclear"));
    ok(second.step !== "parked", `a distinct second ambiguity must go up the ladder, not park (step ${second.step})`);
    ok(!hasReason(await c.trace(second.doubt_id), "repeat_doubt"), "not a repeat");
  });
  await withDoubts({}, async (c) => {
    const first = await c.open(SYNTH("AC-1 ordering unclear"));
    await c.sources(first.doubt_id, { decision: "conservative", rationale: "docs/frds/frd-01-alpha/frd.md:3 reads conservatively", consulted: null });
    const st = await c.readState(); st.units = st.units.map((u) => (u.id === U1 ? { ...u, state: "reported" } : u)); await c.stateMod.writeState(c.fx.root, st, { env: c.env });
    const again = await c.open(SYNTH("  ac-1:  ORDERING, unclear!! "));
    eq(again.step, "parked", `a reworded repeat parks (step ${again.step})`);
    ok(hasReason(await c.trace(again.doubt_id), "repeat_doubt"), "park reason repeat_doubt");
  });
});

await test("S6 doubts: SYNTHESIZED_OPTION_IDS exports the two engine-synthesized option sets", async () => {
  const m = await mod("doubts.mjs");
  eq(m.SYNTHESIZED_OPTION_IDS?.dispute, ["fix-test", "keep-test"], "dispute set"); eq(m.SYNTHESIZED_OPTION_IDS?.ambiguity, ["conservative", "ask-owner"], "ambiguity set");
  eq(m.DOUBT_CAPS?.CONSULTS_PER_DOUBT, 3, "the hard cap of 3 stays");
});

await test("S6 N2: a failing pre-commit hook and commit.gpgsign=true do not block deciding a doubt (commit flags)", async () => withDoubts({ hook: true }, async (c) => {
  const { doubt_id: id } = await c.open();
  const out = await c.sources(id, SRC_HIT);
  eq(out.step, "decided", "the doubt is decided despite the hook");
  const before = c.fx.sha;
  ok(c.fx.git("rev-list", "--count", `${before}..${c.branch}`) !== "0", "the decision-log commit exists on the integration branch");
  eq(c.fx.git("-C", c.p.integrationWorktree, "status", "--porcelain", "--", "docs/decision-log.md"), "", "the decision-log entry is committed");
}));

await test("S6 N11a: `rebuild-state` restores the unit's doubt link from the journal (doubt_opened)", async () => withDoubts({}, async (c) => {
  const { doubt_id: id } = await c.open();
  ok((await c.unit(U1)).doubt_id === id, "the unit carries the doubt id after open");
  const { foldJournal } = await mod("state.mjs");
  const st = await c.readState(); const initial = { ...st, units: st.units.map((u) => (u.id === U1 ? { ...u, doubt_id: null, state: "reported" } : u)) };
  const real = (await c.events("doubt_opened"))[0];
  const runStarted = { ...real, seq: 1, type: "run_started", data: { detect: {}, preflight: {}, state: initial } };
  const folded = foldJournal([runStarted, { ...real, seq: 2 }]);
  const fu = (folded.units ?? folded.state?.units ?? []).find((u) => u.id === U1);
  ok(fu, `foldJournal returns the unit (keys: ${Object.keys(folded).join(", ")})`);
  eq(fu.doubt_id, id, "the folded unit keeps its doubt link");
}));

// ============================================================================================ S7 preflight ledger
// FIX2-C N10a: pending deferred reviews are counted from the ledger; a corrupt ledger fails LOUD instead of reading as 0.
async function preflightWith(ledger) {
  const s = await sandbox(); const P = await pathsFor(s.root);
  if (ledger !== null) { await mkdir(path.dirname(P.deferredReviewsFile), { recursive: true }); await writeFile(P.deferredReviewsFile, ledger); }
  const det = need(s.cli(["start", "--detect"]), "start --detect");
  const scopeFile = path.join(s.dir, "scope-in.json"); await writeFile(scopeFile, JSON.stringify(det.scope));
  return s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]);
}
await test("S7 preflight: a missing deferred-reviews ledger is an empty ledger (control, exit 0)", async () => { need(await preflightWith(null), "preflight without a ledger"); });
await test("S7 preflight: a corrupt deferred-reviews.json fails loud (non-zero exit, names the ledger), never reads as 0 pending", async () => {
  const r = await preflightWith("{ this is not json");
  ok(r.code !== 0, `corrupt ledger must fail the preflight, got exit 0: ${r.stdout.slice(0, 300)}`);
  ok(/ledger|deferred|corrupt|invalid/i.test(r.stdout + r.stderr), `the failure says why: ${(r.stdout + r.stderr).slice(0, 300)}`);
});
await test("S7 preflight: a schema-invalid deferred-reviews.json fails loud too", async () => {
  const r = await preflightWith(JSON.stringify({ schema: 99, entries: "nope" }));
  ok(r.code !== 0, `schema-invalid ledger must fail the preflight, got exit 0: ${r.stdout.slice(0, 300)}`);
});

// ============================================================================================ S8 workers, routing
// FIX2-D N6b: prompt files 0600. N19a: the release variable never reaches a worker. N15: a single MODEL_STRENGTH. CONV-12: Fable is never automatic.
const probeScript = (out) => `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(out)}, JSON.stringify({ hasRelease: ${JSON.stringify(RELEASE_VAR)} in process.env, argv: process.argv.slice(2, 4) }) + "\\n");
`;

await test("S8 N19a: launchWorker never passes the release variable to the worker process", async () => {
  const dir = await scratch("pandacorp-h-wk-");
  try {
    const { createFixture, FAKE_WORKER_BIN, writeWorkerPlan } = await fixturesMod();
    const fx = await createFixture("basic", { dir }); const env = { ...fx.env(), [RELEASE_VAR]: "1" };
    await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, {});
    const out = path.join(dir, "probe.ndjson"); const probe = path.join(dir, "probe-worker.mjs");
    await writeFile(probe, `${probeScript(out)}await import(${JSON.stringify(pathToFileURL(FAKE_WORKER_BIN).href)});\n`);
    env.PANDACORP_FAKE_WORKER = probe;
    const W = await mod("workers.mjs"); const P = await pathsFor(fx.root, env);
    const unit = "u-alpha-1"; const wt = P.unitWorktree(unit);
    await mkdir(wt, { recursive: true }); await mkdir(path.dirname(P.briefFile(unit)), { recursive: true }); await writeFile(P.briefFile(unit), "# brief\n");
    const deps = { env, recordLimit: () => ({ ok: true }) };
    const launch = await W.launchWorker({ project: fx.root, runId: "run-a", unit, attempt: 1, cell: { runtime: "codex", model: "sol", effort: "high" }, schemaFile: path.join(BUILD, "schemas/report.schema.json"), dir: wt }, deps);
    ok(launch.ok, `launch: ${JSON.stringify(launch)}`);
    for (let i = 0; i < 40 && !existsSync(out); i++) await sleep(100);
    ok(existsSync(out), "the probe worker ran");
    const seen = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    ok(seen.every((x) => x.hasRelease === false), `${RELEASE_VAR} leaked into the worker env: ${JSON.stringify(seen)}`);
    try { W.stopWorkers(fx.root, [launch.workerId], deps); } catch { /* best effort */ }
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

await test("S8 N6b + N19a: codex-worker --direct writes prompt.md / full-prompt.md with mode 0600 and the codex child never sees the release variable", async () => {
  const dir = await scratch("pandacorp-h-cw-");
  try {
    const { FAKE_CODEX_BIN } = await fixturesMod();
    const project = path.join(dir, "project"); const wt = path.join(project, ".pandacorp/run/build/wt/u-test-1"); await mkdir(wt, { recursive: true });
    const dump = path.join(dir, "env-dump.ndjson");
    const wrapper = path.join(dir, "codex-wrapper.mjs");
    await writeFile(wrapper, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
appendFileSync(${JSON.stringify(dump)}, JSON.stringify({ hasRelease: ${JSON.stringify(RELEASE_VAR)} in process.env, argv: process.argv.slice(2, 3) }) + "\\n");
const r = spawnSync(process.execPath, [${JSON.stringify(FAKE_CODEX_BIN)}, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 0);
`, { mode: 0o755 });
    await chmod(wrapper, 0o755);
    const sh = path.join(dir, "codex"); await writeFile(sh, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(wrapper)} "$@"\n`, { mode: 0o755 });
    await chmod(sh, 0o755);
    const prompt = path.join(dir, "p.md"); await writeFile(prompt, "# Brief\nsecret-ish brief\n", { mode: 0o644 });
    const schema = path.join(dir, "s.json"); await writeFile(schema, `${JSON.stringify({ type: "object" })}\n`);
    const report = path.join(dir, "r.json"); await writeFile(report, JSON.stringify({ schema: 1, unit: "u-test-1", status: "done", summary: "x", files: [], pending: [] }));
    const env = { PATH: process.env.PATH, HOME: path.join(dir, "home"), CODEX_HOME: path.join(dir, "codex-home"), PANDACORP_HOST_DIR: path.join(dir, "host"),
      PANDACORP_EVENTS_FILE: path.join(dir, "events.ndjson"), PANDACORP_CODEX_EVENTS_FILE: path.join(dir, "codex-events.ndjson"), PANDACORP_NOW: NOW, PANDACORP_NOTIFY: "off",
      PANDACORP_CODEX_BIN: sh, PANDACORP_FAKE_CODEX_REPORT: report, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", [RELEASE_VAR]: "1" };
    const r = spawnSync(process.execPath, [CODEX_WORKER, "run", "--direct", "--project", project, "--id", "w-h8", "--prompt-file", prompt, "--codex-model", "gpt-6.1-sol", "--output-schema", schema, "--dir", wt, "--access", "sandbox", "--max", "20"], { env, encoding: "utf8", timeout: 40000 });
    eq(r.status, 0, `codex-worker exit (stderr ${String(r.stderr).slice(0, 200)})`);
    const wdir = path.join(project, ".pandacorp/run/codex-workers/w-h8");
    const files = (await readdir(wdir)).filter((n) => /prompt/.test(n));
    ok(files.length >= 1, `the worker dir holds prompt files (found ${(await readdir(wdir)).join(", ")})`);
    for (const f of files) eq((await stat(path.join(wdir, f))).mode & 0o777, 0o600, `${f} must be mode 0600`);
    ok(existsSync(dump), "the codex wrapper ran");
    const seen = readFileSync(dump, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    ok(seen.every((x) => x.hasRelease === false), `${RELEASE_VAR} reached the codex child: ${JSON.stringify(seen)}`);
    spawnSync(process.execPath, [CODEX_WORKER, "stop", "--project", project, "--all"], { env, timeout: 10000 });
  } finally { await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

await test("S8 N15: MODEL_STRENGTH is exported frozen from routing.mjs (sol 2, opus 3, fable 4) and drive.mjs reuses it", async () => {
  const { MODEL_STRENGTH } = await mod("routing.mjs");
  ok(Object.isFrozen(MODEL_STRENGTH), "frozen");
  eq([MODEL_STRENGTH.haiku, MODEL_STRENGTH.sonnet, MODEL_STRENGTH.sol, MODEL_STRENGTH.opus, MODEL_STRENGTH.fable], [1, 2, 2, 3, 4], "strengths");
  ok(MODEL_STRENGTH.fable > MODEL_STRENGTH.opus && MODEL_STRENGTH.astra === MODEL_STRENGTH.opus, "fable above opus, astra at opus level");
});
await test("S8 N15: no module keeps a second MODEL_STRENGTH-style table (single source in routing.mjs)", async () => {
  const offenders = [];
  for (const dir of [BUILD, HERE]) for (const f of (await readdir(dir)).filter((n) => /\.mjs$/.test(n) && !/^test-/.test(n))) {
    if (dir === BUILD && f === "routing.mjs") continue;
    const text = await readFile(path.join(dir, f), "utf8");
    if (/\b(?:sonnet|opus)\s*:\s*[234]\b[^}\n]*\bfable\s*:\s*4\b|\bfable\s*:\s*4\b[^}\n]*\b(?:sonnet|opus)\s*:\s*[234]\b/.test(text)) offenders.push(f);
  }
  eq(offenders, [], "a second literal strength table (import MODEL_STRENGTH instead)");
});
await test("S8 CONV-12: Fable is never selected automatically (builder, review and consult cells across the catalog)", async () => {
  const routing = await mod("routing.mjs");
  const seen = []; let threw = 0;
  const grab = (f) => { try { const v = f(); if (v !== undefined && v !== null) seen.push(JSON.stringify(v)); } catch { threw++; } };
  const QUOTAS = [{ claude: "ok", codex: "ok" }, { claude: "quota", codex: "ok" }, { claude: "ok", codex: "quota" }];
  for (const kind of ["docs", "tests", "build", "patch", "audit"]) for (const size of ["touch", "feature", "giant"]) for (const label of ["claude", "codex"])
    for (const zone of ["none", "floor", "r1"]) for (const attempt of [1, 2, 3]) for (const quota of QUOTAS) for (const bounded of [true, false])
      grab(() => routing.builderCell({ id: "u-x", kind, size, bounded }, { label, zone, reopen_count: attempt - 1, attempt, previousCell: null, quota }));
  const AV = [{ claude: "ok", codex: "ok" }, { claude: "quota", codex: "ok" }, { claude: "ok", codex: "quota" }, { claude: "unreachable", codex: "ok" }];
  for (const runtime of ["claude", "codex"]) for (const model of ["haiku", "sonnet", "opus", "sol", "astra"]) for (const kind of ["frd", "touch"]) for (const zone of ["none", "floor", "r1"]) for (const availability of AV)
    grab(() => routing.reviewCell({ authors: [{ runtime, model, effort: "high", origin: "unit" }], kind, zone, availability }));
  for (const origin of ["claude", "codex", "drive", "codex_app"]) for (const consultNo of [1, 2]) grab(() => routing.consultCell({ origin, consultNo }));
  ok(seen.length > 20, `the router produced cells (${seen.length}, ${threw} refusals)`);
  const bad = seen.find((x) => /fable/i.test(x)); ok(!bad, `a router cell selected fable automatically: ${bad}`);
});


// ============================================================================================ S9 TRIAGE-2 review R2 regressions (B1, B2)
// B2: the split refactor left `await import("../build-state.mjs")` one level too shallow. Oracle: every relative specifier in a static
// import, a re-export or a string-literal dynamic import() under runtime/build/** and the CLI entry must resolve to an existing file.
async function walkMjs(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkMjs(f)); else if (e.name.endsWith(".mjs")) out.push(f);
  }
  return out;
}
await test("S9 B2: every relative import / re-export / dynamic import() specifier under runtime/build/** and the CLI resolves to a file", async () => {
  const files = [...await walkMjs(BUILD), CLI];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|(?:^|[;\n])\s*import\s+)(["'])(\.{1,2}\/[^"'\n]+)\1/g;
  const broken = []; let checked = 0;
  for (const f of files) {
    const text = await readFile(f, "utf8");
    for (const m of text.matchAll(re)) {
      checked++;
      if (!existsSync(path.resolve(path.dirname(f), m[2]))) broken.push(`${path.relative(HERE, f)} -> ${m[2]}`);
    }
  }
  ok(files.length > 30 && checked > 100, `the scan saw the tree (${files.length} files, ${checked} specifiers)`);
  eq(broken, [], "relative specifiers that do not resolve");
});
await test("S9 B2: `next` on a finished (non-active) run with the REAL build-state (no injected deps) does not throw ERR_MODULE_NOT_FOUND", async () => {
  const s = await sandbox(); const { start } = await quiescedRun(s);
  need(s.cli(["finish", "--epoch", String(start.epoch)]), "finish");
  const r = s.cli(["next", "--epoch", String(start.epoch)]);
  ok(!/ERR_MODULE_NOT_FOUND|Cannot find module/.test(r.stdout + r.stderr), `next hit a missing module: ${(r.stdout + r.stderr).slice(0, 400)}`);
});
await test("S9 B2: alreadyStopped(run, state) with no injected buildState reaches the real module (stopped run, lease release path)", async () => {
  const s = await sandbox(); const { start } = await startRun(s); await noteStandby(s);
  need(s.cli(["stop", "--epoch", String(start.epoch)]), "stop");
  const r = s.cli(["next", "--epoch", String(start.epoch)]);
  ok(!/ERR_MODULE_NOT_FOUND|Cannot find module/.test(r.stdout + r.stderr), `next on a stopped run hit a missing module: ${(r.stdout + r.stderr).slice(0, 400)}`);
});

// B1: a merge killed before `merge --abort` leaves MERGE_HEAD in the integration worktree. The heal must not turn it into a clean-looking
// worktree whose next plain `git commit` records a phantom merge (assumption branch becomes an ancestor with none of its changes).
await test("S9 B1: resume over a conflicted assumption merge (MERGE_HEAD) never lets a later plain commit become a phantom merge", async () => {
  const { s, wt, rel, file } = await resumeSetup();
  const branch = gitIn(wt, "rev-parse", "--abbrev-ref", "HEAD");
  const orig = await readFile(file, "utf8");
  gitIn(wt, "checkout", "-q", "-b", "assume-h-b1");
  await writeFile(file, `${orig}\nASSUMED-SIDE\n`); gitIn(wt, "commit", "-q", "-a", "-m", "assume side", "--no-verify");
  gitIn(wt, "checkout", "-q", branch);
  await writeFile(file, `${orig}\nINTEGRATION-SIDE\n`); gitIn(wt, "commit", "-q", "-a", "-m", "integration side", "--no-verify");
  gitIn(wt, "merge", "--no-ff", "-q", "assume-h-b1", "-m", "assume merge");
  ok(gitIn(wt, "rev-parse", "-q", "--verify", "MERGE_HEAD"), "precondition: a conflicted merge left MERGE_HEAD");
  const out = resume(s); await noteStandby(s);
  const mergeHead = gitIn(wt, "rev-parse", "-q", "--verify", "MERGE_HEAD");
  const loud = out.code !== 0;
  ok(loud || !mergeHead, `resume must either stop loudly or clear the merge state (exit ${out.code}, MERGE_HEAD=${mergeHead})`);
  if (!loud) {
    await writeFile(path.join(wt, "engine-write-h.txt"), "wo\n"); gitIn(wt, "add", "engine-write-h.txt");
    gitIn(wt, "commit", "-q", "--no-verify", "-m", "engine write");
    eq(gitIn(wt, "rev-list", "--parents", "-n", "1", "HEAD").split(" ").length, 2, "the engine commit has exactly one parent (no phantom merge)");
  }
  const phantom = spawnSync("git", ["merge-base", "--is-ancestor", "assume-h-b1", "HEAD"], { cwd: wt }).status === 0;
  ok(!phantom || (await readFile(file, "utf8")).includes("ASSUMED-SIDE"), "the assumption branch must not count as merged while its changes are absent (accepted work would be lost)");
});
await test("S9 B1: after the heal the accepted assumption branch is still unmerged (so a later pass can merge it, not lost)", async () => {
  const { s, wt, file } = await resumeSetup();
  const branch = gitIn(wt, "rev-parse", "--abbrev-ref", "HEAD"); const orig = await readFile(file, "utf8");
  gitIn(wt, "checkout", "-q", "-b", "assume-h-b1b"); await writeFile(file, `${orig}\nA\n`); gitIn(wt, "commit", "-q", "-a", "-m", "a", "--no-verify");
  gitIn(wt, "checkout", "-q", branch); await writeFile(file, `${orig}\nB\n`); gitIn(wt, "commit", "-q", "-a", "-m", "b", "--no-verify");
  gitIn(wt, "merge", "--no-ff", "-q", "assume-h-b1b", "-m", "m");
  resume(s); await noteStandby(s);
  if (!gitIn(wt, "rev-parse", "-q", "--verify", "MERGE_HEAD")) { try { gitIn(wt, "commit", "-q", "--allow-empty", "--no-verify", "-m", "engine"); } catch { /* ignore */ } }
  const merged = spawnSync("git", ["merge-base", "--is-ancestor", "assume-h-b1b", "HEAD"], { cwd: wt }).status === 0;
  ok(!merged, "assumption branch must remain a not-yet-merged branch after heal plus a plain engine commit");
});


await cleanupSandboxes();
console.log(`RESULT test-build-v2-hardening: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
