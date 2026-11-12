#!/usr/bin/env node
// test-build-v2-jobs.mjs: official test of plugin/runtime/build/jobs.mjs (PLAN 5.2 row C13; D5 adoption, D6, D7; A1, A18).
// Contract pinned: detached `g2` / `land` jobs (cmd.json, out.log, exit under build/jobs/<id>/); the item written
// to state.jobs[] has exactly the A18 field names; a `g2` job holds a host H slot (<host>/h-slots/slot-<i>/owner.json,
// $PANDACORP_HOST_DIR hook) while it runs and releases it on exit, a `land` job holds none (merge-queue.sh takes its
// own); a second live `land` job is refused; a detached job survives the exit of the process that started it and is
// harvested by a NEW epoch holder (the old epoch gets FENCE); a dead pid with no exit file reads `dead`; every
// hang job is stopped through the documented stop path and no process is left behind.
//
// ASSUMED INTERFACE (names/shapes from the C13 implementer report exports list; the module body was never read):
//   startJob({project, epoch, actor?, kind:"g2"|"land", cmd:[argv], cwd, unit?, frd?, jobId?, hMax?}, deps?)
//       -> Promise<job item>; fenced; spawns, upserts state.jobs, journals job_started (data = the item);
//          a second live `land` job rejects with code INVALID_STATE.
//   pollJob(project, job, deps?) -> Promise<{state:"running"|"done"|"dead", exit:int|null, pid, reason?}>
//   harvestJobs({project, epoch, actor?}, deps?) -> Promise<{finished:[job|id], running:[job|id]}>; fenced standalone
//       harvest: a stale epoch rejects with FENCE; the epoch holder records state.jobs[].state/exit and journals
//       job_finished {id, state, exit}.
//   stopJob(job, deps?) -> the documented stop path (SIGTERM to the job's process group); afterwards the job is
//       no longer `running` (done with a non-zero exit, or dead).
//   deps = {env, ...}; the wrapper inherits PANDACORP_HOST_DIR from deps.env (and from process.env).
//   Job item: {id, kind, unit, frd, pid, cwd, h_slot, started_at, state, exit, worker_id}; `exit` file holds the
//   decimal exit code; the command's stdout AND stderr go to out.log; `hMax` caps the host slots the wrapper uses.
//   Slot owner.json {pid, kind:"g2", project:<abs project>, at}; its pid must be a live process while held.
import { execFile, spawn } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createFixture, jobCommand } from "./fixtures/build-v2/make-fixture.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, "../runtime");
const BUILD = path.join(RUNTIME, "build");
const JOBS_URL = pathToFileURL(path.join(BUILD, "jobs.mjs")).href;

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const rejectsWith = async (fn, codes, what) => {
  const list = [].concat(codes);
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a rejection with code ${list.join("|")}, but it resolved`);
  if (!list.includes(err.code)) throw new Error(`${what}: expected code ${list.join("|")}, got ${err.code || "(no code)"}: ${err.message}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 12000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out after ${ms} ms waiting for ${what}`);
    await sleep(40);
  }
};
const alive = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const ids = (list) => list.map((j) => (typeof j === "string" ? j : j.id));
const readText = (f) => readFile(f, "utf8").catch(() => null);
const A18_FIELDS = ["cwd", "exit", "frd", "h_slot", "id", "kind", "pid", "started_at", "state", "unit", "worker_id"];

// ---- loading: a missing module or export becomes a clear failure, never an obscure crash ---------------------------
let J; let loadError = null;
try { J = await import(JOBS_URL); } catch (e) { loadError = e; }
const jfn = (name) => {
  if (loadError) throw new Error(`plugin/runtime/build/jobs.mjs cannot be imported: ${String(loadError.message).split("\n")[0]}`);
  if (typeof J[name] !== "function") throw new Error(`plugin/runtime/build/jobs.mjs does not export function "${name}" (ASSUMED INTERFACE; exports present: ${Object.keys(J).join(", ") || "none"})`);
  return J[name];
};
const load = (rel) => import(pathToFileURL(path.join(RUNTIME, rel)).href);

const scratch = await mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "pc-c13-"));
const tracked = new Set(); // every pid this test may have caused (wrapper, command)
const orphans = []; // pids that the safety net had to kill (a failure of the documented stop path)
const reap = () => { for (const pid of tracked) if (alive(pid)) { orphans.push(pid); try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } } };
const track = (...pids) => { for (const p of pids) if (Number.isInteger(p) && p > 0) tracked.add(p); };
const pidOfFile = async (f) => { const t = await readText(f); const n = Number.parseInt(String(t ?? "").trim(), 10); return Number.isInteger(n) ? n : null; };

let counter = 0;
const sandbox = async () => {
  const dir = path.join(scratch, `s${counter++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture("basic", { dir });
  const pidfile = path.join(dir, "job-pid.txt");
  const env = fx.env({ FIXTURE_JOB_PIDFILE: pidfile });
  // Belt and braces: even a module that reads process.env instead of deps.env can only touch this sandbox.
  for (const k of ["PANDACORP_HOST_DIR", "PANDACORP_EVENTS_FILE", "PANDACORP_CODEX_EVENTS_FILE", "FIXTURE_JOB_PIDFILE", "CODEX_HOME", "HOME"]) process.env[k] = env[k];
  const bs = await load("build-state.mjs");
  const stateMod = await load("build/state.mjs");
  const pathsMod = await load("build/paths.mjs");
  const journalMod = await load("build/journal.mjs");
  const project = fx.root;
  const lease = await bs.acquire(project, { runtime: "claude", runId: "run-c13", ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const p = pathsMod.buildPaths(project, { env });
  await stateMod.writeState(project, stateMod.newState({
    run_id: "run-c13", epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "feature",
    scope: { card: null, frds: [], wos: [], out_of_scope: [] },
    integration: { branch: "lane/run-c13", worktree: p.integrationWorktree, base_sha: fx.sha },
  }), { env });
  const hostSlots = path.join(env.PANDACORP_HOST_DIR, "h-slots");
  const sb = {
    dir, fx, env, project, bs, p, pidfile, token: lease.token, epoch: lease.epoch, deps: { env }, hostSlots,
    readState: () => stateMod.readState(project, { env }),
    events: async (type) => (await journalMod.readJournal(p.journalFile, { env })).events.filter((e) => !type || e.type === type),
    slots: async () => {
      const names = (await readdir(hostSlots).catch(() => [])).filter((n) => n.startsWith("slot-"));
      const owners = [];
      for (const n of names) { const t = await readText(path.join(hostSlots, n, "owner.json")); owners.push({ slot: n, owner: t ? JSON.parse(t) : null }); }
      return owners;
    },
    start: async (kind, cmdKind, extra = {}) => {
      const item = await jfn("startJob")({ project, epoch: sb.epoch, kind, cmd: jobCommand(cmdKind), cwd: project, hMax: 1, ...extra }, sb.deps);
      track(item?.pid);
      return item;
    },
    pidfilePid: async () => { const n = await pidOfFile(pidfile); track(n); return n; },
    jobsInState: async () => (await sb.readState()).jobs,
    cleanup: async () => { reap(); await fx.cleanup().catch(() => {}); },
  };
  return sb;
};
const withSandbox = async (fn) => { const sb = await sandbox(); try { return await fn(sb); } finally { await sb.cleanup(); } };
const fileExists = (f) => existsSync(f);

// ---- 1. module surface ---------------------------------------------------------------------------------------------
await test("module surface: startJob, pollJob, harvestJobs and stopJob are exported functions", async () => {
  for (const n of ["startJob", "pollJob", "harvestJobs", "stopJob"]) jfn(n);
});

// ---- 2. exit 0, schema fields, files, journal -----------------------------------------------------------------------
await test("g2 job (exit0): item and state.jobs[] use exactly the A18 field names; cmd.json/out.log/exit exist; job_started journaled", async () => withSandbox(async (sb) => {
  const item = await sb.start("g2", "exit0", { frd: "frd-01-alpha", jobId: "g2-alpha" });
  eq(Object.keys(item).sort(), A18_FIELDS, "returned job item fields");
  eq([item.id, item.kind, item.unit, item.frd, item.worker_id], ["g2-alpha", "g2", null, "frd-01-alpha", null], "id/kind/unit/frd/worker_id");
  ok(Number.isInteger(item.pid) && item.pid > 0, `pid must be a positive integer, got ${item.pid}`);
  eq(item.h_slot, true, "h_slot is true for g2");
  eq(item.cwd, sb.project, "cwd");
  ok(typeof item.started_at === "string" && Number.isFinite(Date.parse(item.started_at)), "started_at must be an ISO instant");
  ok(["running", "done"].includes(item.state), `state at spawn is running (or already done), got ${item.state}`);
  const stored = (await sb.jobsInState()).find((j) => j.id === "g2-alpha");
  ok(stored, "state.jobs[] has the job");
  eq(Object.keys(stored).sort(), A18_FIELDS, "state.jobs[] item fields (schema field names only)");
  const started = (await sb.events("job_started")).filter((e) => e.data?.id === "g2-alpha");
  eq(started.length, 1, "one job_started event for the job");
  eq(Object.keys(started[0].data).sort(), A18_FIELDS, "job_started data is the jobs[] item");
  eq(started[0].epoch, sb.epoch, "job_started carries the caller's epoch");
  const dir = sb.p.jobDir("g2-alpha");
  ok(fileExists(path.join(dir, "cmd.json")), "cmd.json exists in build/jobs/<id>/");
  ok(fileExists(path.join(dir, "out.log")), "out.log exists in build/jobs/<id>/");
  ok(String(await readText(path.join(dir, "cmd.json"))).includes("job-command.mjs"), "cmd.json records the command");
  await until(() => fileExists(path.join(dir, "exit")), "the exit file");
  eq(Number.parseInt(String(await readText(path.join(dir, "exit"))).trim(), 10), 0, "exit file holds the exit code 0");
  ok(String(await readText(path.join(dir, "out.log"))).includes("ok"), "out.log captured the command's stdout");
  const poll = await jfn("pollJob")(sb.project, item, sb.deps);
  eq([poll.state, poll.exit], ["done", 0], "pollJob after exit");
  const h = await jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps);
  ok(ids(h.finished).includes("g2-alpha"), `harvest lists the finished job, got ${JSON.stringify(h)}`);
  const after = (await sb.jobsInState()).find((j) => j.id === "g2-alpha");
  eq([after.state, after.exit], ["done", 0], "state.jobs[] after harvest");
  eq(Object.keys(after).sort(), A18_FIELDS, "state.jobs[] fields still the schema's after harvest");
  const fin = (await sb.events("job_finished")).filter((e) => e.data?.id === "g2-alpha");
  eq(fin.length, 1, "one job_finished event");
  eq([fin[0].data.state, fin[0].data.exit], ["done", 0], "job_finished data {id, state, exit}");
  const again = await jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps);
  ok(!ids(again.finished).includes("g2-alpha"), "an already harvested job is not reported finished twice");
  eq((await sb.events("job_finished")).filter((e) => e.data?.id === "g2-alpha").length, 1, "no duplicate job_finished");
}));

// ---- 3. exit 1 ------------------------------------------------------------------------------------------------------
await test("g2 job (exit1): exit file 1, stderr in out.log, harvested as done with exit 1 (a failing command is done, not dead)", async () => withSandbox(async (sb) => {
  const item = await sb.start("g2", "exit1", { frd: "frd-02-beta", jobId: "g2-beta" });
  const dir = sb.p.jobDir("g2-beta");
  await until(() => fileExists(path.join(dir, "exit")), "the exit file");
  eq(Number.parseInt(String(await readText(path.join(dir, "exit"))).trim(), 10), 1, "exit file holds 1");
  ok(String(await readText(path.join(dir, "out.log"))).includes("boom"), "out.log captured stderr");
  const poll = await jfn("pollJob")(sb.project, item, sb.deps);
  eq([poll.state, poll.exit], ["done", 1], "pollJob");
  await jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps);
  const after = (await sb.jobsInState()).find((j) => j.id === "g2-beta");
  eq([after.state, after.exit], ["done", 1], "state.jobs[] after harvest");
  const fin = (await sb.events("job_finished")).find((e) => e.data?.id === "g2-beta");
  ok(fin && fin.data.exit === 1 && fin.data.state === "done", `job_finished for exit 1, got ${JSON.stringify(fin?.data)}`);
}));

// ---- 4. g2 holds a host slot while running, releases on exit; stop path leaves nothing behind -------------------------
await test("g2 job holds a host H slot while it runs (owner kind g2, live pid, this project) and the documented stop path releases it and leaves no process", async () => withSandbox(async (sb) => {
  const item = await sb.start("g2", "hang", { frd: "frd-01-alpha", jobId: "g2-hang" });
  const cmdPid = await until(() => sb.pidfilePid(), "the hang command to start");
  const held = await until(async () => { const s = (await sb.slots()).filter((x) => x.owner); return s.length ? s : null; }, "the g2 job to take a host slot");
  eq(held.length, 1, "exactly one host slot held by the one running g2 job");
  eq(held[0].owner.kind, "g2", "slot owner kind");
  eq(held[0].owner.project, sb.project, "slot owner project (absolute path)");
  ok(alive(held[0].owner.pid), "slot owner pid is a live process while the job runs");
  eq((await jfn("pollJob")(sb.project, item, sb.deps)).state, "running", "pollJob while running");
  await jfn("stopJob")(item, sb.deps);
  await until(() => !alive(cmdPid), "the hang command to die after stopJob", 8000);
  await until(async () => (await sb.slots()).length === 0, "the slot to be released after the job stopped", 8000);
  await until(async () => (await jfn("pollJob")(sb.project, item, sb.deps)).state !== "running", "pollJob to stop reading running", 8000);
  ok(!alive(item.pid), `wrapper pid ${item.pid} must be gone after stopJob`);
}));

await test("g2 job releases its host slot on a normal exit", async () => withSandbox(async (sb) => {
  const item = await sb.start("g2", "exit0", { frd: "frd-01-alpha", jobId: "g2-quick" });
  await until(() => fileExists(path.join(sb.p.jobDir("g2-quick"), "exit")), "the exit file");
  await until(async () => (await sb.slots()).length === 0, "the slot to be released after exit");
  eq((await jfn("pollJob")(sb.project, item, sb.deps)).state, "done", "pollJob");
}));

// ---- 5. g2 waits when every slot is taken ---------------------------------------------------------------------------
await test("g2 job waits for a host slot while all are held (its command does not start) and runs once the slot is released", async () => withSandbox(async (sb) => {
  const adm = await load("build/admission.mjs");
  const blocker = adm.acquireHostSlot({ host: sb.env.PANDACORP_HOST_DIR, max: 1, kind: "merge-queue", project: sb.project, pid: process.pid });
  ok(blocker, "test precondition: the test takes the only slot");
  try {
    await sb.start("g2", "exit0", { frd: "frd-01-alpha", jobId: "g2-wait" });
    await sleep(900);
    ok(!fileExists(path.join(sb.p.jobDir("g2-wait"), "exit")), "the g2 command must not run while no host slot is free");
    eq((await jfn("pollJob")(sb.project, (await sb.jobsInState()).find((j) => j.id === "g2-wait"), sb.deps)).state, "running", "a waiting job reads running");
  } finally { blocker.release(); }
  await until(() => fileExists(path.join(sb.p.jobDir("g2-wait"), "exit")), "the job to run after the slot was released", 15000);
  eq(Number.parseInt(String(await readText(path.join(sb.p.jobDir("g2-wait"), "exit"))).trim(), 10), 0, "job exit");
  await until(async () => (await sb.slots()).length === 0, "the slot to be released again");
}));

// ---- 6. land holds no slot ------------------------------------------------------------------------------------------
await test("land job holds NO host slot (merge-queue.sh takes its own around verify.sh): item.h_slot false and no slot appears while it runs", async () => withSandbox(async (sb) => {
  const item = await sb.start("land", "hang", { jobId: "land-1" });
  eq(item.h_slot, false, "h_slot is false for land");
  eq([item.kind, item.frd, item.unit, item.worker_id], ["land", null, null, null], "land item has no frd/unit/worker");
  eq(Object.keys(item).sort(), A18_FIELDS, "land item fields");
  const cmdPid = await until(() => sb.pidfilePid(), "the land command to start");
  await sleep(300);
  eq((await sb.slots()).length, 0, "no host slot is held by a land job");
  eq((await jfn("pollJob")(sb.project, item, sb.deps)).state, "running", "land job reads running");
  await jfn("stopJob")(item, sb.deps);
  await until(() => !alive(cmdPid), "the land command to die after stopJob", 8000);
}));

// ---- 7. a second live land job is refused ---------------------------------------------------------------------------
await test("a second live land job is refused (INVALID_STATE, nothing spawned or recorded); a new land is accepted once the first ended", async () => withSandbox(async (sb) => {
  const first = await sb.start("land", "hang", { jobId: "land-a" });
  const cmdPid = await until(() => sb.pidfilePid(), "the first land command to start");
  await rejectsWith(() => sb.start("land", "exit0", { jobId: "land-b" }), "INVALID_STATE", "second live land job");
  eq((await sb.jobsInState()).filter((j) => j.kind === "land").map((j) => j.id), ["land-a"], "only the first land job is in state.jobs[]");
  ok(!fileExists(sb.p.jobDir("land-b")) || !fileExists(path.join(sb.p.jobDir("land-b"), "out.log")), "the refused land job spawned nothing");
  eq((await sb.events("job_started")).filter((e) => e.data?.id === "land-b").length, 0, "no job_started for the refused job");
  await jfn("stopJob")(first, sb.deps);
  await until(() => !alive(cmdPid), "the first land command to die", 8000);
  await until(async () => (await jfn("pollJob")(sb.project, first, sb.deps)).state !== "running", "the first land job to stop reading running", 8000);
  await jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps);
  const third = await sb.start("land", "exit0", { jobId: "land-c" });
  eq(third.id, "land-c", "a land job is accepted again after the first one was harvested");
  await until(() => fileExists(path.join(sb.p.jobDir("land-c"), "exit")), "the third land job to finish");
}));

// ---- 8. detached survives the parent's exit -------------------------------------------------------------------------
const PARENT_SRC = `import { pathToFileURL } from "node:url";
const [jobsUrl, argJson] = process.argv.slice(2);
const { startJob } = await import(jobsUrl);
const arg = JSON.parse(argJson);
const item = await startJob(arg.input, { env: arg.env });
process.stdout.write("ITEM " + JSON.stringify(item) + "\\n");
process.exit(0);
`;
/** Starts a job from a SHORT-LIVED parent process (it exits right after startJob); returns {item, parentExitCode}. */
const startFromParent = async (sb, kind, cmdKind, extra = {}) => {
  const script = path.join(sb.dir, "parent.mjs");
  await writeFile(script, PARENT_SRC);
  const out = path.join(sb.dir, "parent.out");
  const fd = openSync(out, "w");
  const input = { project: sb.project, epoch: sb.epoch, kind, cmd: jobCommand(cmdKind), cwd: sb.project, hMax: 1, ...extra };
  const child = spawn(process.execPath, [script, JOBS_URL, JSON.stringify({ input, env: sb.env })], { stdio: ["ignore", fd, fd], env: sb.env });
  closeSync(fd);
  const code = await new Promise((resolve, reject) => { const t = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("the parent process did not exit within 20 s (startJob must not hold the parent open)")); }, 20000); child.on("exit", (c) => { clearTimeout(t); resolve(c); }); });
  const text = await readText(out);
  const line = String(text).split("\n").find((l) => l.startsWith("ITEM "));
  if (!line) throw new Error(`the parent did not report a job item (exit ${code}); its output: ${String(text).slice(0, 400)}`);
  const item = JSON.parse(line.slice(5));
  track(item.pid);
  return { item, code };
};

await test("a detached job survives the exit of the process that started it (still running, still reads running, slot still held)", async () => withSandbox(async (sb) => {
  const { item, code } = await startFromParent(sb, "g2", "hang", { frd: "frd-01-alpha", jobId: "g2-surv" });
  eq(code, 0, "the parent exited cleanly");
  const cmdPid = await until(() => sb.pidfilePid(), "the hang command to start");
  await sleep(300);
  ok(alive(cmdPid), "the job command is alive after its starting process exited");
  ok(alive(item.pid), "the job wrapper is alive after its starting process exited");
  eq((await jfn("pollJob")(sb.project, item, sb.deps)).state, "running", "pollJob from another process");
  eq((await sb.slots()).filter((s) => s.owner).length, 1, "the g2 slot is still held");
  await jfn("stopJob")(item, sb.deps);
  await until(() => !alive(cmdPid), "the command to die after stopJob", 8000);
  await until(async () => (await sb.slots()).length === 0, "the slot to be released", 8000);
}));

// ---- 9. new epoch holder adopts -------------------------------------------------------------------------------------
await test("after a transfer the OLD epoch is fenced out of harvest and the NEW epoch holder adopts and harvests the detached job", async () => withSandbox(async (sb) => {
  const { item } = await startFromParent(sb, "g2", "hang", { frd: "frd-02-beta", jobId: "g2-adopt" });
  const cmdPid = await until(() => sb.pidfilePid(), "the hang command to start");
  const next = await sb.bs.transfer(sb.project, { token: sb.token, toRuntime: "codex", coordinator: "drive", epoch: sb.epoch });
  ok(next.epoch === sb.epoch + 1 && typeof next.token === "string", "test precondition: transfer returns the next epoch");
  const before = JSON.stringify(await sb.readState());
  await rejectsWith(() => jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps), "FENCE", "harvest by the old epoch");
  eq(JSON.stringify(await sb.readState()), before, "a fenced harvest writes nothing");
  const adopted = await jfn("harvestJobs")({ project: sb.project, epoch: next.epoch }, sb.deps);
  ok(ids(adopted.running).includes("g2-adopt"), `the new holder sees the live job as running, got ${JSON.stringify(adopted)}`);
  eq(ids(adopted.finished).length, 0, "nothing finished yet");
  eq((await jfn("pollJob")(sb.project, item, sb.deps)).state, "running", "still running under the new holder");
  await jfn("stopJob")(item, sb.deps);
  await until(() => !alive(cmdPid), "the command to die after stopJob", 8000);
  const done = await until(async () => { const h = await jfn("harvestJobs")({ project: sb.project, epoch: next.epoch }, sb.deps); return ids(h.finished).includes("g2-adopt") ? h : null; }, "the new epoch holder to harvest the stopped job", 10000);
  ok(done, "harvested");
  const stored = (await sb.jobsInState()).find((j) => j.id === "g2-adopt");
  ok(["done", "dead"].includes(stored.state), `harvested job state is done|dead, got ${stored.state}`);
  eq(stored.state === "done" ? Number.isInteger(stored.exit) : stored.exit === null, true, "exit is an integer for done, null for dead");
  const fin = (await sb.events("job_finished")).filter((e) => e.data?.id === "g2-adopt");
  eq(fin.length, 1, "exactly one job_finished");
  eq(fin[0].epoch, next.epoch, "job_finished is journaled under the NEW epoch");
  eq([fin[0].data.state, fin[0].data.exit], [stored.state, stored.exit], "job_finished data matches state.jobs[]");
  await until(async () => (await sb.slots()).length === 0, "the slot to be released", 8000);
}));

// ---- 10. dead pid without exit file ---------------------------------------------------------------------------------
await test("a job whose pid is dead and has no exit file reads `dead` with a null exit (never done, never running)", async () => withSandbox(async (sb) => {
  const ghost = await new Promise((resolve, reject) => execFile(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], (e, out) => (e ? reject(e) : resolve(Number.parseInt(out, 10)))));
  await until(() => !alive(ghost), "the throwaway process to be gone", 3000);
  await mkdir(sb.p.jobDir("g2-ghost"), { recursive: true });
  await writeFile(path.join(sb.p.jobDir("g2-ghost"), "out.log"), "");
  const item = { id: "g2-ghost", kind: "g2", unit: null, frd: "frd-01-alpha", pid: ghost, cwd: sb.project, h_slot: true, started_at: "2026-11-11T12:00:00.000Z", state: "running", exit: null, worker_id: null };
  const poll = await jfn("pollJob")(sb.project, item, sb.deps);
  eq([poll.state, poll.exit], ["dead", null], "pollJob of a dead pid with no exit file");
}));

await test("kill -9 of a running job's wrapper (no exit file): pollJob reads dead, harvest records dead + job_finished, and the next slot acquirer reclaims the dead owner's slot", async () => withSandbox(async (sb) => {
  const item = await sb.start("g2", "hang", { frd: "frd-01-alpha", jobId: "g2-kill" });
  const cmdPid = await until(() => sb.pidfilePid(), "the hang command to start");
  await until(async () => (await sb.slots()).some((s) => s.owner), "the slot to be taken");
  for (const pid of [item.pid, cmdPid]) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
  await until(() => !alive(item.pid) && !alive(cmdPid), "the killed processes to be gone", 5000);
  ok(!fileExists(path.join(sb.p.jobDir("g2-kill"), "exit")), "test precondition: a SIGKILLed wrapper leaves no exit file");
  const poll = await jfn("pollJob")(sb.project, item, sb.deps);
  eq([poll.state, poll.exit], ["dead", null], "pollJob after kill -9");
  const h = await jfn("harvestJobs")({ project: sb.project, epoch: sb.epoch }, sb.deps);
  ok(ids(h.finished).includes("g2-kill"), `harvest reports the dead job as finished, got ${JSON.stringify(h)}`);
  const stored = (await sb.jobsInState()).find((j) => j.id === "g2-kill");
  eq([stored.state, stored.exit], ["dead", null], "state.jobs[] after harvest");
  const fin = (await sb.events("job_finished")).find((e) => e.data?.id === "g2-kill");
  ok(fin && fin.data.state === "dead" && fin.data.exit === null, `job_finished {state: dead, exit: null}, got ${JSON.stringify(fin?.data)}`);
  const adm = await load("build/admission.mjs");
  const got = adm.acquireHostSlot({ host: sb.env.PANDACORP_HOST_DIR, max: 1, kind: "merge-queue", project: sb.project, pid: process.pid });
  ok(got, "the dead job's slot must be reclaimable by the next acquirer (H slot reclaim)");
  got.release();
}));

// ---- 11. nothing left behind ----------------------------------------------------------------------------------------
await test("no orphan process is left by any case (the documented stop path cleaned every hang job)", async () => {
  const stray = [...tracked].filter((pid) => alive(pid));
  reap();
  ok(stray.length === 0 && orphans.length === 0, `processes still alive after the cases (the safety net had to SIGKILL them): ${[...new Set([...stray, ...orphans])].join(", ")}`);
});

reap();
await rm(scratch, { recursive: true, force: true }).catch(() => {});
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
