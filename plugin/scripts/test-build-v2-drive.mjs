#!/usr/bin/env node
// test-build-v2-drive.mjs - T-C07: contract test of plugin/runtime/build/drive.mjs and plugin/runtime/build/notify.mjs
// (engine v2, BUILD-14, D10, PLAN 3.13 and 3.16 A9/A10/A11/A21, CLI doc sections 2.3 and 9, drive.md).
// Written from the contracts only; neither module was read. Run: node plugin/scripts/test-build-v2-drive.mjs
// Offline: fixture clocks (injected `clock` + `sleep`, no real waiting), injected spawn/exec/isAlive, the fake codex
// (PANDACORP_CODEX_BIN) and the fake worker (PANDACORP_FAKE_WORKER). Real Wave B modules (build-state transfer, state,
// journal, quota, install-pre-push.mjs) run for real against throwaway git fixtures.
//
// ASSUMED INTERFACE (the docs give behavior but no export names for drive/notify; the orchestrator reconciles):
//  Convention `fn(input, deps?)`, deps last. All functions are async (each call is awaited). `project` = absolute root of the
//  main checkout; `runId` = the run id. Several alias names per function are tried (first match wins): see API below.
//  - drive.mjs
//      armDrive({project, runId}, deps) -> {armed:boolean, pid?:number, reason?:string|null}. Single arming entry (also the
//        gate): armed only when `codex login status` is OK (via env.PANDACORP_CODEX_BIN) AND, in a launched project (status.yaml
//        phase release / deploy_target external), `install-pre-push.mjs --check` exits 0. Codex quota is NOT consulted. When armed
//        it spawns, through `deps.spawn(cmd, args, opts)`, `process.execPath` with args containing the contiguous run
//        `drive --standby --run <runId>` (args[0] = a path ending `pandacorp-build.mjs`), opts.detached === true,
//        opts.stdio[0] === "ignore" and stdio[1], stdio[2] = the log (build/drive/drive.log must exist), then calls `.unref()`
//        on the returned child; result.pid = child.pid. Not armed: no spawn, `reason` = a non-empty string, never throws.
//      pollTriggers({project, runId, transcript?}, deps) -> {trigger:"a"|"b"|"c"|null, ...}. READ-ONLY (no lease, state, journal,
//        handoff change). (a) build/handoff.json; (b) classifyLimitText hit in units/*/report.json, codex-workers/<id>/last.md or the
//        optional transcript file; (c) lease not renewed for >= thresholds.drive_silent_s (1800) AND pending work (a non-terminal
//        unit) AND last Claude reading >= 85 or unknown. Time = deps.clock() (an injected `() => Date`; env.PANDACORP_NOW wins
//        when set, as everywhere in the engine).
//      takeover({project, runId, trigger}, deps) -> any (the test observes the disk, not the return value): re-reads Codex quota
//        (readCodexQuota from env.CODEX_HOME); >= 90 -> build-state `transfer` then stop at `paused-quota` (state.status "paused",
//        status_reason mentions quota, journal `paused` by actor drive carrying both resets_at, lease released); else `transfer`
//        {toRuntime:"codex", coordinator:"drive"} (epoch+1, same run_id), state.json coordinator "drive" + new epoch, journal
//        `drive_takeover` (actor drive), consumed handoff.json renamed to handoff.consumed-<n>.json, notification. Never quiesces,
//        never stops workers, never writes a tracked file in the main checkout. Missing/unreadable token file: no takeover (it may
//        reject with code FENCE or resolve) and nothing changes.
//      runStandby({project, runId}, deps) -> any. Polls every thresholds.drive_poll_s (30) seconds through `deps.sleep(ms)`;
//        writes build/drive/standby.json {pid, armed_at, run_id, state:"standby"}; under deps.platform "darwin" spawns
//        `caffeinate -i -w <own pid>` through deps.spawn; exits (state "stopped") as soon as state.status != "active", without a
//        takeover; on a trigger it calls takeover and, when it continues, runLoop.
//      runLoop({project, runId, epoch}, deps) -> any. `epoch` = the epoch drive holds. Each iteration: renew the lease (build-state
//        `renew`, projectStatus:false, token read from build/lease-token.json), then `deps.next(input)` with input carrying
//        project, `epoch` and the coordinator `drive`; actions: wait -> deps.sleep; dispatch -> units with via "cli" are already
//        running (drive does nothing), a unit with runtime "claude" is NEVER dispatched, a claude `audit` unit is queued in
//        deferred-reviews.json (needed "claude", status "pending") and not run; land -> `deps.land(input)` unless a land job of
//        state.jobs is alive (`deps.isAlive(pid)`); done -> `deps.finish(input)` once; paused-quota|paused-infra|waiting-owner|
//        deadlock|stop -> exit, no finish. A FENCE error (stale epoch at the renew) -> exit quietly: nothing written, no lease change.
//        A human gate (state.status "waiting_gate" when next returns waiting-owner) -> notify(). Never sets PANDACORP_OWNER_RELEASE_OK.
//      deps: {env, clock, sleep, spawn, exec, isAlive, platform, next, land, finish}; `exec(cmd,args,opts)` is the osascript runner.
//  - notify.mjs: notify({title, message}, deps) -> any; runs `osascript -e <script>` through deps.exec(cmd, args, opts) (cmd's basename
//      is osascript) exactly once; no-op (no exec) when env.PANDACORP_NOTIFY === "off" or deps.platform !== "darwin" (default
//      process.platform); never throws (exec throwing, rejecting or exit code != 0 is swallowed); user text cannot break out of the
//      AppleScript string (at most 4 unescaped double quotes in the script, or the text travels as a separate argv element).
//      Aliases tried: notify | sendNotification | notifyOwner | default export.
//  - Quality bar of the contracts: no argv/cmd built by drive or notify contains "claude" (case-insensitive, sandbox paths scrubbed);
//    drive never dispatches a Claude cell; takeover = same-run `transfer` (epoch+1, same run_id), running workers survive it.
import { execFileSync } from "node:child_process";
import { spawn as nodeSpawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAKE_WORKER_BIN, DEFAULT_NOW, createFixture, testEnv, writeRolloutSample, ROLLOUT_EXPECT, writeWorkerPlan } from "./fixtures/build-v2/make-fixture.mjs";
import { acquire, assertFence, renew, transfer } from "../runtime/build-state.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { newState, newUnit, readLeaseToken, readState, writeState } from "../runtime/build/state.mjs";
import { appendEvent, readJournal } from "../runtime/build/journal.mjs";
import { recordClaude } from "../runtime/build/quota.mjs";
import { loadSchema, validate } from "../runtime/build/fsx.mjs";

const PLUGIN_ROOT = fileURLToPath(new URL("..", import.meta.url));
const INSTALLER = path.join(PLUGIN_ROOT, "scripts", "install-pre-push.mjs");
const D = await import("../runtime/build/drive.mjs").catch((error) => ({ __error: error }));
const N = await import("../runtime/build/notify.mjs").catch((error) => ({ __error: error }));

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (actual, expected, label) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const rejectsWith = async (fn, codes, label) => {
  let error = null; try { await fn(); } catch (e) { error = e; }
  if (!error) throw new Error(`${label}: expected a rejection (${codes.join("|")}) but it resolved`);
  if (!codes.includes(error.code)) throw new Error(`${label}: expected ${codes.join("|")}, got ${error.code ?? "no code"}: ${error.message}`);
};

// ------------------------------------------------------------------------------------------------ module surface
const pick = (mod, file, names) => {
  if (mod.__error) throw new Error(`${file} is not importable: ${mod.__error.message} (row C07 not implemented yet?)`);
  for (const n of names) if (typeof mod[n] === "function") return mod[n];
  if (names.includes("default") && typeof mod.default === "function") return mod.default;
  throw new Error(`${file} exports none of ${names.join("|")} (exports: ${Object.keys(mod).join(",") || "none"})`);
};
const API = {
  armDrive: () => pick(D, "drive.mjs", ["armDrive", "arm"]),
  pollTriggers: () => pick(D, "drive.mjs", ["pollTriggers", "checkTriggers", "evaluateTriggers", "detectTrigger"]),
  takeover: () => pick(D, "drive.mjs", ["takeover", "takeOver", "performTakeover"]),
  runStandby: () => pick(D, "drive.mjs", ["runStandby", "standby"]),
  runLoop: () => pick(D, "drive.mjs", ["runLoop", "runActive", "activeLoop", "loop"]),
  notify: () => pick(N, "notify.mjs", ["notify", "sendNotification", "notifyOwner", "default"]),
};

// ------------------------------------------------------------------------------------------------ sandbox helpers
const RUN_ID = "br-2026-11-11-01";
const T0 = Date.parse(DEFAULT_NOW);
const isoAt = (ms) => new Date(ms).toISOString();
const roots = []; const killers = [];
const mk = async (prefix = "pc-drive-") => { const d = await mkdtemp(path.join(os.tmpdir(), prefix)); roots.push(d); return d; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const waitFor = async (cond, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { if (await cond()) return; await new Promise((r) => setTimeout(r, 25)); } throw new Error(`timeout waiting for ${what}`); };
const readJ = async (file) => JSON.parse(await readFile(file, "utf8"));

/** A run in a throwaway fixture project: real lease (epoch 1, coordinator session, runtime claude), state.json and a one-line journal. */
async function makeRun(o = {}) {
  const dir = await mk();
  const fx = await createFixture(o.fixture ?? "basic", { dir });
  const env = fx.env(o.env ?? {});
  const P = buildPaths(fx.root, { env });
  const lease = await acquire(fx.root, { runtime: "claude", runId: RUN_ID, ttlSeconds: 1800, coordinator: "session", projectStatus: false });
  const units = o.units ?? [newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "queued" })];
  const state = newState({
    run_id: RUN_ID, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "feature", status: o.status ?? "active",
    scope: { card: null, frds: ["frd-01-alpha"], wos: ["WO-01-001"], out_of_scope: [] },
    integration: { branch: `lane/${RUN_ID}`, worktree: P.integrationWorktree, base_sha: fx.sha }, units, jobs: o.jobs ?? [],
  });
  await writeState(fx.root, state, { env });
  await appendEvent(P.journalFile, { run_id: RUN_ID, epoch: lease.epoch, type: "run_started", data: { detect: {}, preflight: {}, state } }, { env });
  const run = { dir, fx, root: fx.root, env, P, epoch: lease.epoch, token: lease.token, runId: RUN_ID };
  await setLeaseAge(run, o.leaseAgeS ?? 5);
  return run;
}
const rawLease = (run) => readJ(run.P.leaseFile);
async function setLeaseAge(run, seconds, atMs = T0) { const l = await rawLease(run); l.renewed_at = isoAt(atMs - seconds * 1000); await writeFile(run.P.leaseFile, `${JSON.stringify(l)}\n`); }
const stateOf = (run) => readState(run.root, { env: run.env });
async function patchState(run, fn) { const s = await stateOf(run); const next = fn(structuredClone(s)) ?? s; await writeState(run.root, next, { env: run.env }); return next; }
const eventsOf = async (run) => (await readJournal(run.P.journalFile, {})).events;
const writeHandoff = (run, reason = "quota95") => writeFile(run.P.handoffFile, `${JSON.stringify({ run_id: run.runId, from_epoch: run.epoch, reason, requested_at: DEFAULT_NOW })}\n`);
const claudeReading = (run, pct, extra = {}) => recordClaude({ five_hour_pct: pct, weekly_pct: 5, five_hour_resets_at: isoAt(T0 + 3600e3), weekly_resets_at: isoAt(T0 + 3 * 86400e3), ...extra }, { now: DEFAULT_NOW, file: run.P.quotaFile, deps: { env: run.env } });
/** A Codex rollout whose primary window is `pct` (300 min, resets in 2 h) and secondary 10 %: readCodexQuota gives used_percent = pct. */
async function writeCodexPct(run, pct) {
  const stamp = new Date(T0 - 600e3); const ts = stamp.toISOString();
  const dir = path.join(run.env.CODEX_HOME, "sessions", String(stamp.getUTCFullYear()), String(stamp.getUTCMonth() + 1).padStart(2, "0"), String(stamp.getUTCDate()).padStart(2, "0"));
  await mkdir(dir, { recursive: true });
  const win = (used, minutes, resetsMs) => ({ used_percent: used, window_minutes: minutes, resets_at: Math.floor(resetsMs / 1000) });
  const lines = [
    JSON.stringify({ timestamp: ts, type: "session_meta", payload: { id: "fixture-session", cwd: "/fixture" } }),
    JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 } }, rate_limits: { primary: win(pct, 300, T0 + 2 * 3600e3), secondary: win(10, 10080, T0 + 5 * 86400e3), credits: null, plan_type: "plus" } } }),
  ];
  const file = path.join(dir, `rollout-${ts.replace(/[:.]/g, "-")}-fixturepct${pct}.jsonl`);
  await writeFile(file, `${lines.join("\n")}\n`); await utimes(file, stamp, stamp);
  return { codexResetsAt: isoAt(T0 + 2 * 3600e3) };
}
/** Hands the lease to a drive-style coordinator through the real `transfer`, so loop tests do not depend on takeover(). */
async function driveHolds(run) {
  const t = await transfer(run.root, { token: run.token, toRuntime: "codex", coordinator: "drive" });
  await patchState(run, (s) => { s.coordinator = "drive"; s.epoch = t.epoch; return s; });
  return { ...run, epoch: t.epoch, token: t.token };
}

/** Injected dependencies: fixture clock, recording sleep/spawn/exec, scripted next. `o.next` = array of results (then `stop`) or a function. */
function mkDeps(run, o = {}) {
  const clk = { ms: o.startMs ?? T0 };
  const calls = { spawn: [], exec: [], sleeps: [], next: [], finish: [], land: [], unref: 0 };
  const env = { ...run.env };
  if (o.notify) delete env.PANDACORP_NOTIFY;
  if (o.noNow) delete env.PANDACORP_NOW;
  const proc = (kind) => (cmd, args = [], opts = {}, cb) => {
    calls[kind].push({ cmd, args: Array.isArray(args) ? args.map(String) : [], opts: opts && typeof opts === "object" ? opts : {} });
    const child = { code: 0, status: 0, exitCode: 0, stdout: "", stderr: "", pid: 424242, unref: () => { if (kind === "spawn") calls.unref += 1; }, on() { return this; }, once() { return this; }, kill() {} };
    const done = [args, opts, cb].find((x) => typeof x === "function");
    if (done) setImmediate(() => done(null, "", ""));
    return child;
  };
  const deps = {
    env, clock: () => new Date(clk.ms), platform: o.platform ?? "darwin", isAlive: o.isAlive ?? (() => false),
    sleep: async (ms) => { calls.sleeps.push(ms); clk.ms += ms; if (o.onSleep) await o.onSleep(calls.sleeps.length, clk); if (calls.sleeps.length > 300) throw new Error("runaway loop: more than 300 sleeps (drive ignored the injected clock or never exits)"); },
    spawn: proc("spawn"),
    next: async (input) => { calls.next.push(input); const r = Array.isArray(o.next) ? o.next.shift() : o.next?.(input); return r ?? act("stop", input?.epoch); },
    finish: async (input) => { calls.finish.push(input); return { ok: true }; },
    land: async (input) => { calls.land.push(input); return { ok: true }; },
  };
  if (o.exec !== false) deps.exec = proc("exec");
  return { deps, calls, clk, env };
}
const act = (action, epoch = 2, extra = {}) => ({ ok: true, cmd: "next", epoch, action, units: [], ...extra });
const waitAct = (epoch = 2) => act("wait", epoch, { wait: { reason: "workers_running", retry_after_s: 30 } });
const unitCell = (over) => ({ unit: "u-build-wo-01-001", kind: "build", attempt: 1, token: "tok-0123456789ab", runtime: "codex", model: "sol", model_slug: "gpt-6.1-sol", effort: "high", budget_calls: null, worktree: "/nonexistent/wt", brief_path: "/nonexistent/brief.md", report_path: "/nonexistent/report.json", schema_path: "/nonexistent/schema.json", agent_type: "pandacorp:implementer", via: "cli", dispatch_line: "-> Codex gpt-6.1-sol", ...over });

const argvs = (calls) => [...calls.spawn, ...calls.exec].map((c) => [c.cmd, ...c.args].map(String));
const realOf = (p) => { try { return realpathSync(p); } catch { return p; } };
function scrub(text, run) {
  let t = String(text);
  const known = [run?.dir, run?.root, PLUGIN_ROOT, os.tmpdir(), process.execPath, process.cwd()].filter(Boolean);
  for (const p of [...known, ...known.map(realOf)].sort((a, b) => b.length - a.length)) t = t.split(p).join("<p>");
  return t;
}
const noClaude = (calls, run, what) => { for (const argv of argvs(calls)) for (const a of argv) if (/claude/i.test(scrub(a, run))) throw new Error(`${what}: an argv contains "claude": ${JSON.stringify(argv)}`); };
const noReleaseFlag = (calls, deps, what) => {
  for (const c of [...calls.spawn, ...calls.exec]) if (c.opts.env && "PANDACORP_OWNER_RELEASE_OK" in c.opts.env) throw new Error(`${what}: PANDACORP_OWNER_RELEASE_OK passed to a child process`);
  ok(!("PANDACORP_OWNER_RELEASE_OK" in deps.env) && !("PANDACORP_OWNER_RELEASE_OK" in process.env), `${what}: PANDACORP_OWNER_RELEASE_OK was set`);
};
const base = (cmd) => path.basename(String(cmd));
const trig = (r) => (typeof r === "string" ? r.toLowerCase() : r?.trigger == null ? null : String(r.trigger).toLowerCase());
const hasSeq = (arr, seq) => arr.some((_, i) => seq.every((s, j) => arr[i + j] === s));
const spawnFakeWorker = async (run, unit, id) => {
  await writeWorkerPlan(run.env.PANDACORP_FAKE_WORKER_PLAN, { [unit]: { hang: true } });
  const child = nodeSpawn(process.execPath, [FAKE_WORKER_BIN, "run", "--project", run.root, "--id", id, "--unit", unit, "--dir", run.root], { detached: true, stdio: "ignore", env: { ...run.env } });
  child.unref();
  const stateFile = path.join(run.root, ".pandacorp/run/codex-workers", id, "state.json");
  await waitFor(() => existsSync(stateFile), 5000, "the fake worker state.json");
  const pid = (await readJ(stateFile)).pid;
  killers.push(() => { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } });
  return { pid, exitFile: path.join(run.root, ".pandacorp/run/codex-workers", id, "exit") };
};
const workerJob = (pid, root) => ({ id: "w-1", kind: "worker", unit: "u-build-wo-01-001", frd: null, pid, cwd: root, h_slot: false, started_at: DEFAULT_NOW, state: "running", exit: null, worker_id: "w-1" });

// ======================================================================================================== module surface
await test("drive.mjs and notify.mjs export the C07 surface", async () => {
  for (const name of Object.keys(API)) API[name]();
});

// ======================================================================================================== notify.mjs
const unescapedQuotes = (script) => (String(script).replace(/\\./g, "").match(/"/g) ?? []).length;
const osascriptCalls = (calls) => calls.exec.filter((c) => base(c.cmd) === "osascript");
await test("notify: PANDACORP_NOTIFY=off sends nothing", async () => {
  const run = await makeRun(); const { deps, calls } = mkDeps(run, { platform: "darwin" }); deps.env.PANDACORP_NOTIFY = "off";
  await API.notify()({ title: "Pandacorp", message: "Listo el build" }, deps);
  eq(calls.exec.length + calls.spawn.length, 0, "no process started when notifications are off");
});
await test("notify: a non-macOS platform sends nothing", async () => {
  const run = await makeRun(); const { deps, calls } = mkDeps(run, { platform: "linux", notify: true });
  await API.notify()({ title: "Pandacorp", message: "Listo el build" }, deps);
  eq(calls.exec.length + calls.spawn.length, 0, "no process started off macOS");
});
await test("notify: on macOS it runs osascript -e once, with the title and message, and no 'claude' in any argv", async () => {
  const run = await makeRun(); const { deps, calls } = mkDeps(run, { platform: "darwin", notify: true });
  await API.notify()({ title: "Pandacorp", message: "Listo el build" }, deps);
  const o = osascriptCalls(calls); eq(o.length, 1, "osascript calls");
  const i = o[0].args.indexOf("-e"); ok(i >= 0 && o[0].args[i + 1], `no -e script in ${JSON.stringify(o[0].args)}`);
  const all = o[0].args.join("\n"); ok(all.includes("Listo el build") && all.includes("Pandacorp"), `title and message missing from ${all}`);
  noClaude(calls, run, "notify");
});
await test("notify: user text cannot break out of the AppleScript string", async () => {
  const run = await makeRun(); const { deps, calls } = mkDeps(run, { platform: "darwin", notify: true });
  await API.notify()({ title: "Pandacorp", message: 'Listo" & (do shell script "echo pwned") & "\\ fin\nsegunda linea' }, deps);
  const o = osascriptCalls(calls); eq(o.length, 1, "osascript calls");
  const script = o[0].args[o[0].args.indexOf("-e") + 1];
  ok(unescapedQuotes(script) <= 4 && unescapedQuotes(script) % 2 === 0, `message breaks out of the script (${unescapedQuotes(script)} unescaped quotes): ${script}`);
  ok(o[0].args.join("\n").includes("Listo"), "the message text is not carried at all");
});
await test("notify: a failing osascript (throws, rejects, exit 1) never throws", async () => {
  for (const mode of ["throw", "reject", "code1"]) {
    const run = await makeRun(); const { deps } = mkDeps(run, { platform: "darwin", notify: true });
    deps.exec = mode === "throw" ? () => { throw new Error("osascript gone"); } : mode === "reject" ? async () => { throw new Error("osascript gone"); } : async () => ({ code: 1, status: 1, exitCode: 1, stdout: "", stderr: "boom" });
    try { await API.notify()({ title: "Pandacorp", message: "Listo" }, deps); } catch (e) { throw new Error(`notify threw on ${mode}: ${e.message}`); }
  }
});

// ======================================================================================================== arming (D10)
const SPAWN_RUN = (calls) => calls.spawn.find((c) => hasSeq(c.args, ["drive", "--standby", "--run", RUN_ID]));
await test("arm: unlaunched project, login ok -> armed, detached unref'd node process `drive --standby --run R`, log in build/drive/drive.log", async () => {
  const run = await makeRun(); const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === true, `armed expected: ${JSON.stringify(r)}`);
  const s = SPAWN_RUN(calls); ok(s, `no spawn of drive --standby --run ${RUN_ID}: ${JSON.stringify(calls.spawn)}`);
  eq(s.cmd, process.execPath, "the child is node"); ok(/pandacorp-build\.mjs$/.test(s.args[0]), `args[0] must be pandacorp-build.mjs, got ${s.args[0]}`);
  ok(s.opts.detached === true, "spawn option detached:true (no setsid on macOS)"); eq(s.opts.stdio?.[0], "ignore", "stdio[0]");
  ok(s.opts.stdio?.[1] !== undefined && s.opts.stdio?.[2] !== undefined && s.opts.stdio[1] !== "ignore" && s.opts.stdio[1] !== "pipe", `stdout/stderr must go to the drive log: ${JSON.stringify(s.opts.stdio)}`);
  eq(calls.unref, 1, ".unref() calls"); eq(r.pid, 424242, "result.pid is the child's pid");
  ok(existsSync(run.P.driveLogFile), "build/drive/drive.log was not created");
  noClaude(calls, run, "armDrive"); noReleaseFlag(calls, deps, "armDrive");
});
await test("arm: armed even with Codex at 98 % (quota is not an arming condition)", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "pct98", { now: DEFAULT_NOW });
  const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === true && SPAWN_RUN(calls), `must arm at Codex 98 %: ${JSON.stringify(r)}`);
});
await test("arm: `codex login status` failing -> not armed, a reason, nothing spawned, no throw", async () => {
  const run = await makeRun({ env: { PANDACORP_FAKE_CODEX_LOGIN: "out" } }); const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === false, `must not arm with an expired Codex login: ${JSON.stringify(r)}`);
  ok(typeof r.reason === "string" && r.reason.length > 0, "a not-armed result carries a reason"); eq(calls.spawn.length, 0, "spawn calls");
});
await test("arm: launched project WITHOUT a verified pre-push hook -> not armed", async () => {
  const run = await makeRun({ fixture: "launched" }); const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === false, `launched + no hook must not arm: ${JSON.stringify(r)}`);
  ok(typeof r.reason === "string" && r.reason.length > 0, "reason"); eq(calls.spawn.length, 0, "spawn calls");
});
await test("arm: launched project whose core.hooksPath is tracked (installer refuses, exit 3) -> not armed", async () => {
  const run = await makeRun({ fixture: { preset: "launched", trackedHooksPath: true } }); const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === false && calls.spawn.length === 0, `tracked hooksPath must not arm: ${JSON.stringify(r)}`);
});
await test("arm: launched project with the hook installed by install-pre-push.mjs -> armed", async () => {
  const run = await makeRun({ fixture: "launched" });
  execFileSync(process.execPath, [INSTALLER, "--project", run.root], { stdio: "ignore" });
  const { deps, calls } = mkDeps(run, { exec: false });
  const r = await API.armDrive()({ project: run.root, runId: run.runId }, deps);
  ok(r?.armed === true && SPAWN_RUN(calls), `verified hook must arm: ${JSON.stringify(r)}`);
});

// ======================================================================================================== triggers a / b / c (D10, A21)
const poll = async (run, o = {}, input = {}) => { const m = mkDeps(run, o); const r = await API.pollTriggers()({ project: run.root, runId: run.runId, ...input }, m.deps); return { ...m, r, trigger: trig(r) }; };
await test("trigger: nothing fires on an active run with a fresh lease", async () => {
  const run = await makeRun(); const { trigger, r } = await poll(run); eq(trigger, null, `trigger (${JSON.stringify(r)})`);
});
await test("trigger a: build/handoff.json fires, and polling is read-only", async () => {
  const run = await makeRun(); await writeHandoff(run); const leaseBefore = await rawLease(run); const eventsBefore = (await eventsOf(run)).length;
  const { trigger, r } = await poll(run); eq(trigger, "a", `trigger (${JSON.stringify(r)})`);
  ok(existsSync(run.P.handoffFile), "polling must not consume handoff.json (the takeover does)");
  eq(await rawLease(run), leaseBefore, "lease untouched by polling"); eq((await eventsOf(run)).length, eventsBefore, "journal untouched by polling");
});
await test("trigger b: a usage-limit text in the report.json of an in-flight Claude unit fires; benign output does not", async () => {
  const claudeWorker = { runtime: "claude", model: "sonnet", effort: "medium", via: "agent", pid: null, worker_id: null };
  const run = await makeRun({ units: [{ ...newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "running" }), worker: claudeWorker }] });
  await mkdir(run.P.unitDir("u-build-wo-01-001"), { recursive: true });
  await writeFile(run.P.reportFile("u-build-wo-01-001"), `${JSON.stringify({ status: "done", summary: "all green, tests passed, 429 lines changed? no" })}\n`);
  eq((await poll(run)).trigger, null, "benign report");
  await writeFile(run.P.reportFile("u-build-wo-01-001"), `${JSON.stringify({ status: "blocked", summary: "Claude AI usage limit reached|1731326400" })}\n`);
  eq((await poll(run)).trigger, "b", "usage-limit report");
});
await test("trigger b (DEC-3): Codex's own limit text in codex-workers/<id>/last.md does NOT fire", async () => {
  const run = await makeRun(); const dir = run.P.codexWorkerDir("w-1"); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "last.md"), "ERROR: You've hit your usage limit. Try again at 3:00 PM.\n");
  eq((await poll(run)).trigger, null, "Codex limit text must not trigger the Claude takeover");
});
await test("trigger b (DEC-3): Claude's envelope in last.md fires only for a worker of the current run", async () => {
  const job = { id: "j-worker-1", kind: "worker", unit: "u-build-wo-01-001", frd: "frd-01-alpha", pid: null, cwd: "/tmp/x", h_slot: false, started_at: DEFAULT_NOW, state: "running", exit: null, worker_id: "w-1" };
  const run = await makeRun({ jobs: [job] });
  const stale = run.P.codexWorkerDir("w-stale"); await mkdir(stale, { recursive: true });
  await writeFile(path.join(stale, "last.md"), "Claude AI usage limit reached|1731326400\n");
  eq((await poll(run)).trigger, null, "worker id not in the run's state");
  const dir = run.P.codexWorkerDir("w-1"); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "last.md"), "Claude AI usage limit reached|1731326400\n");
  eq((await poll(run)).trigger, "b", "worker of this run with Claude's envelope");
});
await test("trigger b: the optional coordinator transcript is scanned", async () => {
  const run = await makeRun(); const transcript = path.join(run.dir, "transcript.txt");
  await writeFile(transcript, "assistant: working...\nClaude usage limit reached|1731326400\n");
  eq((await poll(run, {}, { transcript })).trigger, "b", "transcript with a limit text");
});
await test("trigger c: lease silent >= 1800 s + pending work + Claude reading >= 85 % fires; 1799 s does not", async () => {
  const run = await makeRun(); await claudeReading(run, 90);
  await setLeaseAge(run, 1801); eq((await poll(run)).trigger, "c", "silent 1801 s");
  await setLeaseAge(run, 1799); eq((await poll(run)).trigger, null, "silent 1799 s");
});
await test("trigger c: an unknown Claude reading (none recorded, or status unavailable) counts as >= 85 %", async () => {
  const run = await makeRun(); await setLeaseAge(run, 2000); eq((await poll(run)).trigger, "c", "no reading");
  await recordClaude({ status: "unavailable" }, { now: DEFAULT_NOW, file: run.P.quotaFile, deps: { env: run.env } });
  eq((await poll(run)).trigger, "c", "reading unavailable");
});
await test("trigger c: expired-lease recovery is independent of Claude percentages", async () => {
  const run = await makeRun(); await setLeaseAge(run, 2000);
  await claudeReading(run, 84); eq((await poll(run)).trigger, "c", "silent recovery ignores quota");
  await claudeReading(run, 85); eq((await poll(run)).trigger, "c", "Claude 85 %");
});
await test("trigger c: no pending work (every unit terminal) does not fire", async () => {
  const run = await makeRun({ units: [newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "landed" })] });
  await setLeaseAge(run, 5000); await claudeReading(run, 99); eq((await poll(run)).trigger, null, "all units landed");
});
await test("trigger c: a fresh lease never fires, whatever the Claude reading", async () => {
  const run = await makeRun(); await claudeReading(run, 99); await setLeaseAge(run, 10); eq((await poll(run)).trigger, null, "lease 10 s old, Claude 99 %");
});

// ======================================================================================================== takeover (A10, D10)
const takeover = async (run, trigger, o = {}) => { const m = mkDeps(run, o); const result = await API.takeover()({ project: run.root, runId: run.runId, trigger }, m.deps); return { ...m, result }; };
await test("takeover (Codex 36 %): same-run `transfer`, epoch+1, lease/state/journal/token file all say drive, handoff consumed, main checkout untouched", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "normal", { now: DEFAULT_NOW }); await writeHandoff(run);
  const statusBefore = await readFile(path.join(run.root, ".pandacorp/status.yaml"), "utf8");
  const { deps, calls } = await takeover(run, "a", { notify: true });
  const lease = await rawLease(run);
  eq([lease.run_id, lease.epoch, lease.coordinator, lease.runtime], [RUN_ID, 2, "drive", "codex"], "lease run_id/epoch/coordinator/runtime");
  ok(!("quiesced_at" in lease) && lease.ttl_seconds === 1800, `lease must not be quiesced and keeps ttl 1800: ${JSON.stringify(lease)}`);
  ok(Math.abs(Date.now() - Date.parse(lease.renewed_at)) < 60_000, `lease must be freshly renewed: ${lease.renewed_at}`);
  eq(Number((await readFile(run.P.leaseEpochFile, "utf8")).trim()), 2, "lease-epoch file");
  const tf = await readJ(run.P.tokenFile); eq(tf.epoch, 2, "lease-token.json epoch"); ok(tf.token && tf.token !== run.token, "a new token was minted");
  const st = await stateOf(run); eq([st.coordinator, st.epoch, st.status, st.run_id], ["drive", 2, "active", RUN_ID], "state.json coordinator/epoch/status/run_id");
  const events = await eventsOf(run); const take = events.find((e) => e.type === "drive_takeover");
  ok(take, `journal has no drive_takeover (types: ${events.map((e) => e.type)})`); eq([take.actor, take.epoch, take.run_id], ["drive", 2, RUN_ID], "drive_takeover actor/epoch/run_id");
  ok(!existsSync(run.P.handoffFile), "handoff.json must be consumed (renamed)");
  const consumed = (await readdir(run.P.build)).filter((f) => /^handoff\.consumed-\d+\.json$/.test(f)); eq(consumed.length, 1, "handoff.consumed-<n>.json files");
  eq(await readFile(path.join(run.root, ".pandacorp/status.yaml"), "utf8"), statusBefore, "status.yaml must never be projected by takeover");
  eq(run.fx.git("status", "--porcelain"), "", "takeover wrote a tracked or untracked non-ignored file in the main checkout");
  ok(osascriptCalls(calls).length >= 1, "a takeover notification (osascript) was expected");
  noClaude(calls, run, "takeover"); noReleaseFlag(calls, deps, "takeover");
});
await test("takeover: the previous holder is fenced (old token/epoch rejected, new epoch readable)", async () => {
  const run = await makeRun(); await writeHandoff(run); await takeover(run, "a");
  await rejectsWith(() => assertFence(run.root, run.token, run.epoch), ["FENCE"], "old token at the old epoch");
  await rejectsWith(() => renew(run.root, run.token, run.epoch, { projectStatus: false }), ["FENCE"], "old session renew");
  await rejectsWith(() => readLeaseToken(run.root, run.epoch, { env: run.env }), ["FENCE"], "old epoch token read");
  ok(typeof (await readLeaseToken(run.root, 2, { env: run.env })) === "string", "new epoch token readable");
});
await test("takeover on a STALE lease (trigger c) also transfers, same run_id, epoch+1", async () => {
  const run = await makeRun(); await setLeaseAge(run, 3000); await claudeReading(run, 97);
  await takeover(run, "c"); const lease = await rawLease(run);
  eq([lease.run_id, lease.epoch, lease.coordinator], [RUN_ID, 2, "drive"], "lease after a stale takeover");
});
await test("takeover keeps running Codex workers alive and does not quiesce or touch jobs", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "normal", { now: DEFAULT_NOW });
  const w = await spawnFakeWorker(run, "u-build-wo-01-001", "w-1");
  await patchState(run, (s) => { s.jobs = [workerJob(w.pid, run.root)]; return s; });
  await writeHandoff(run); await takeover(run, "a");
  await new Promise((r) => setTimeout(r, 150));
  ok(alive(w.pid), "the running fake worker was killed by the takeover"); ok(!existsSync(w.exitFile), "the worker's exit file appeared (it was stopped)");
  const st = await stateOf(run); eq(st.jobs.map((j) => [j.id, j.state, j.pid]), [["w-1", "running", w.pid]], "the worker job record is intact");
});
await test("takeover with Codex at exactly 90 %: transfer then paused-quota (state paused, lease released, both resets_at, drive actor), nothing run", async () => {
  const run = await makeRun(); const { codexResetsAt } = await writeCodexPct(run, 100); await claudeReading(run, 100); await writeHandoff(run);
  const { calls } = await takeover(run, "a", { notify: true });
  const st = await stateOf(run); eq(st.status, "paused", "state.status"); ok(/quota/i.test(st.status_reason ?? ""), `status_reason must mention quota: ${st.status_reason}`);
  ok(!existsSync(run.P.leaseDir), "the lease must be released at paused-quota");
  const events = await eventsOf(run); const paused = events.find((e) => e.type === "paused"); ok(paused, `journal has no paused event (types: ${events.map((e) => e.type)})`);
  eq([paused.actor, paused.epoch], ["drive", 2], "paused event actor/epoch (transfer first, so epoch+1)");
  const blob = JSON.stringify([paused.data, st.status_reason]);
  ok(blob.includes(codexResetsAt.slice(0, 19)), `Codex resets_at ${codexResetsAt} missing from ${blob}`);
  ok(blob.includes(isoAt(T0 + 3600e3).slice(0, 19)), `Claude resets_at ${isoAt(T0 + 3600e3)} missing from ${blob}`);
  eq(osascriptCalls(calls).length >= 0, true, "notification optional here"); noClaude(calls, run, "paused-quota takeover");
});
await test("takeover with only Codex exhausted continues on the other tool", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "pct98", { now: DEFAULT_NOW }); await writeHandoff(run);
  await takeover(run, "a"); eq((await stateOf(run)).status, "active", "one tool never pauses");
  ok(existsSync(run.P.leaseDir), "lease retained");
});

await test("takeover with Codex at 89 % or unknown (no rollout): the run continues under drive (active)", async () => {
  const a = await makeRun(); await writeCodexPct(a, 89); await writeHandoff(a); await takeover(a, "a");
  eq([(await stateOf(a)).status, (await rawLease(a)).coordinator], ["active", "drive"], "Codex 89 %");
  const b = await makeRun(); await writeHandoff(b); await takeover(b, "a");
  eq([(await stateOf(b)).status, (await rawLease(b)).coordinator], ["active", "drive"], "Codex unknown");
});
await test("takeover without a readable lease-token file does not take the run and changes nothing", async () => {
  const run = await makeRun(); await writeHandoff(run); await rm(run.P.tokenFile, { force: true }); const before = await rawLease(run); const eventsBefore = (await eventsOf(run)).length;
  try { await takeover(run, "a"); } catch (e) { ok(e.code === "FENCE", `only a FENCE rejection is acceptable, got ${e.code}: ${e.message}`); }
  eq(await rawLease(run), before, "lease untouched"); eq((await eventsOf(run)).length, eventsBefore, "journal untouched"); eq((await stateOf(run)).status, "active", "state still active");
});
await test("takeover notification is silent under PANDACORP_NOTIFY=off", async () => {
  const run = await makeRun(); await writeHandoff(run); const { calls } = await takeover(run, "a"); eq(osascriptCalls(calls).length, 0, "osascript calls with notifications off");
});

// ======================================================================================================== standby loop (D10)
const standby = async (run, o = {}) => { const m = mkDeps(run, o); const r = await API.runStandby()({ project: run.root, runId: run.runId }, m.deps); return { ...m, r }; };
await test("standby exits at once on a non-active run (paused/waiting_owner/waiting_gate/finished/stopped), even with a handoff pending, without a takeover", async () => {
  for (const status of ["paused", "waiting_owner", "waiting_gate", "finished", "stopped"]) {
    const run = await makeRun({ status }); await writeHandoff(run); const leaseBefore = await rawLease(run);
    const { calls } = await standby(run);
    ok(calls.sleeps.length <= 1, `${status}: standby kept polling (${calls.sleeps.length} sleeps)`);
    eq(await rawLease(run), leaseBefore, `${status}: lease must not change`); ok(existsSync(run.P.handoffFile), `${status}: handoff must not be consumed`);
    if (existsSync(run.P.driveStandbyFile)) eq((await readJ(run.P.driveStandbyFile)).state, "stopped", `${status}: standby.json state`);
  }
});
await test("standby polls every 30 s, writes standby.json {pid, run_id, state:standby}, starts caffeinate -i -w <own pid>, and leaves the run alone until the status changes", async () => {
  const run = await makeRun(); const seen = [];
  const { calls } = await standby(run, { onSleep: async (n) => {
    if (n === 1) seen.push(await readJ(run.P.driveStandbyFile));
    if (n === 3) await patchState(run, (s) => { s.status = "paused"; s.status_reason = "test"; return s; });
  } });
  eq(calls.sleeps, [30000, 30000, 30000], "poll interval (thresholds.drive_poll_s = 30)");
  eq([seen[0]?.state, seen[0]?.run_id, Number.isInteger(seen[0]?.pid)], ["standby", RUN_ID, true], "standby.json while waiting");
  const caf = calls.spawn.find((c) => base(c.cmd) === "caffeinate"); ok(caf, `caffeinate not started: ${JSON.stringify(calls.spawn)}`);
  ok(hasSeq(caf.args, ["-i", "-w", String(process.pid)]), `caffeinate args must be -i -w <own pid>: ${JSON.stringify(caf.args)}`);
  const lease = await rawLease(run); eq([lease.epoch, lease.coordinator], [1, "session"], "no takeover without a trigger");
  noClaude(calls, run, "runStandby");
});
await test("standby fixture clock: trigger c fires only after the lease has been silent for 1800 s of injected time (no real waiting)", async () => {
  const run = await makeRun({ leaseAgeS: 1700 }); const { calls } = await standby(run, { noNow: true, next: [act("done", 2)] });
  ok(calls.sleeps.length >= 3 && calls.sleeps.length <= 5, `expected ~4 polls of 30 s before 1800 s of silence, got ${calls.sleeps.length} (drive ignores the injected clock?)`);
  ok(calls.sleeps.every((ms) => ms === 30000), `every poll sleeps 30000 ms: ${JSON.stringify(calls.sleeps)}`);
  eq([(await rawLease(run)).epoch, (await rawLease(run)).coordinator], [2, "drive"], "takeover after trigger c");
});
await test("standby end to end: trigger a at Codex 36 % -> takeover, loop calls next as drive at the new epoch, `done` -> finish once, standby.json stopped", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "normal", { now: DEFAULT_NOW }); await writeHandoff(run);
  const { calls } = await standby(run, { next: [act("done", 2)] });
  eq((await rawLease(run)).coordinator, "drive", "lease coordinator"); eq(calls.next.length, 1, "next calls");
  ok(JSON.stringify(calls.next[0]).includes('"drive"') && calls.next[0].epoch === 2, `next must be called as coordinator drive at epoch 2: ${JSON.stringify(calls.next[0])}`);
  eq(calls.finish.length, 1, "finish calls");
  if (existsSync(run.P.driveStandbyFile)) eq((await readJ(run.P.driveStandbyFile)).state, "stopped", "standby.json after the loop ended");
  noClaude(calls, run, "standby end to end"); noReleaseFlag(calls, mkDeps(run).deps, "standby end to end");
});
await test("standby with only Codex exhausted enters the normal allocator loop", async () => {
  const run = await makeRun(); await writeRolloutSample(run.env.CODEX_HOME, "pct98", { now: DEFAULT_NOW }); await writeHandoff(run);
  const { calls } = await standby(run, { next: [act("done", 2)] });
  eq(calls.next.length, 1, "allocator loop continues"); eq(calls.finish.length, 1, "finish from done");
});

// ======================================================================================================== active loop (D10)
const loop = async (run, o = {}, epoch = run.epoch) => { const m = mkDeps(run, o); const r = await API.runLoop()({ project: run.root, runId: run.runId, epoch }, m.deps); return { ...m, r }; };
await test("loop: renews the lease every iteration, sleeps on `wait`, then `done` -> finish once", async () => {
  const run = await driveHolds(await makeRun()); const stale = isoAt(Date.now() - 20 * 60_000); const l = await rawLease(run); l.renewed_at = stale; await writeFile(run.P.leaseFile, `${JSON.stringify(l)}\n`);
  const { calls } = await loop(run, { next: [waitAct(), act("done")] });
  eq(calls.next.length, 2, "next calls"); ok(calls.sleeps.length >= 1, "no sleep on a `wait` action"); eq(calls.finish.length, 1, "finish calls");
  ok(Date.parse((await rawLease(run)).renewed_at) > Date.parse(stale) + 60_000, "the loop never renewed the lease (drive renews it in its own loop)");
  for (const input of calls.next) ok(JSON.stringify(input).includes('"drive"') && input.epoch === run.epoch, `next input must name coordinator drive and the epoch: ${JSON.stringify(input)}`);
  eq((await rawLease(run)).epoch, run.epoch, "the loop must not change the epoch");
});
await test("loop: every terminal action ends the loop without finish or land", async () => {
  for (const action of ["paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"]) {
    const run = await driveHolds(await makeRun()); const { calls } = await loop(run, { next: [act(action)] });
    eq([calls.next.length, calls.finish.length, calls.land.length], [1, 0, 0], `${action}: next/finish/land calls`);
  }
});
await test("loop: units already launched by `next` (via cli) cause no spawn by drive", async () => {
  const run = await driveHolds(await makeRun()); const { calls } = await loop(run, { next: [act("dispatch", 2, { units: [unitCell()] }), act("stop")] });
  eq(calls.spawn.length, 0, "spawn calls"); noClaude(calls, run, "dispatch via cli");
});
await test("loop: a Claude cell is NEVER dispatched (no spawn/exec with its unit or model, unit not left running)", async () => {
  const claudeUnit = newUnit({ id: "u-build-wo-01-002", kind: "build", wos: ["WO-01-002"], frd: "frd-01-alpha", state: "admitted" });
  const run = await driveHolds(await makeRun({ units: [newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "queued" }), claudeUnit] }));
  const cell = unitCell({ unit: "u-build-wo-01-002", runtime: "claude", model: "sonnet", model_slug: null, effort: "medium", via: "agent" });
  const { calls } = await loop(run, { next: [act("dispatch", 2, { units: [cell] }), act("stop")] });
  for (const argv of argvs(calls)) ok(!argv.some((a) => a.includes("u-build-wo-01-002") || a.includes(cell.token)), `the Claude unit was passed to a process: ${JSON.stringify(argv)}`);
  noClaude(calls, run, "claude cell"); noReleaseFlag(calls, mkDeps(run).deps, "claude cell");
  const st = await stateOf(run); ok(st.units.find((u) => u.id === "u-build-wo-01-002").state !== "running", "the Claude unit must not be left running by drive");
});
await test("loop: a Claude opus `audit` unit is not run under drive; it is queued in deferred-reviews.json for Claude (needed claude, pending)", async () => {
  const audit = newUnit({ id: "u-audit-frd-01-alpha", kind: "audit", frd: "frd-01-alpha", state: "admitted" });
  const run = await driveHolds(await makeRun({ units: [newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "landed" }), audit] }));
  const cell = unitCell({ unit: "u-audit-frd-01-alpha", kind: "audit", runtime: "claude", model: "opus", model_slug: null, effort: "high", via: "agent", agent_type: "pandacorp:security-auditor" });
  const { calls } = await loop(run, { next: [act("dispatch", 2, { units: [cell] }), act("stop")] });
  for (const argv of argvs(calls)) ok(!argv.some((a) => a.includes("u-audit-frd-01-alpha")), `the audit unit was passed to a process: ${JSON.stringify(argv)}`);
  noClaude(calls, run, "audit under drive");
  const queue = await readJ(run.P.deferredReviewsFile); const schema = await loadSchema("deferred-reviews");
  ok(validate(schema, queue).ok, `deferred-reviews.json is invalid: ${JSON.stringify(validate(schema, queue).errors)}`);
  const entry = queue.find((e) => e.unit === "u-audit-frd-01-alpha"); ok(entry, `no deferred entry for the audit unit: ${JSON.stringify(queue)}`);
  eq([entry.kind, entry.needed, entry.status], ["audit", "claude", "pending"], "deferred audit entry kind/needed/status");
});
await test("loop: never spawns a landing while a land job is alive; lands once when none is", async () => {
  const landJob = { id: "land-1", kind: "land", unit: null, frd: null, pid: 777001, cwd: "/nonexistent", h_slot: false, started_at: DEFAULT_NOW, state: "running", exit: null, worker_id: null };
  const withJob = await driveHolds(await makeRun({ jobs: [landJob] }));
  const a = await loop(withJob, { isAlive: (pid) => pid === 777001, next: [act("land"), act("stop")] });
  eq(a.calls.land.length, 0, "land calls while the land job is alive");
  const free = await driveHolds(await makeRun()); const b = await loop(free, { next: [act("land"), act("stop")] });
  eq(b.calls.land.length, 1, "land calls with no land job");
});
await test("loop: a human gate (waiting_gate) notifies through osascript and never sets PANDACORP_OWNER_RELEASE_OK", async () => {
  const run = await driveHolds(await makeRun());
  const { calls, deps } = await loop(run, { notify: true, next: (input) => { calls0.push(input); return null; } }).catch(() => ({}));
  void deps; void calls;
  const run2 = await driveHolds(await makeRun()); const m = mkDeps(run2, { notify: true });
  m.deps.next = async (input) => { m.calls.next.push(input); await patchState(run2, (s) => { s.status = "waiting_gate"; s.status_reason = "gate"; return s; }); return act("waiting-owner", run2.epoch); };
  await API.runLoop()({ project: run2.root, runId: run2.runId, epoch: run2.epoch }, m.deps);
  ok(osascriptCalls(m.calls).length >= 1, "no osascript notification for a human gate"); noClaude(m.calls, run2, "gate notification"); noReleaseFlag(m.calls, m.deps, "gate notification");
});
const calls0 = [];
await test("loop after the owner's `start --resume` (kill -9 drive + resume): drive is fenced, exits quietly, writes nothing; the worker survives and is adoptable", async () => {
  const run0 = await makeRun(); await writeRolloutSample(run0.env.CODEX_HOME, "normal", { now: DEFAULT_NOW });
  const w = await spawnFakeWorker(run0, "u-build-wo-01-001", "w-1");
  await patchState(run0, (s) => { s.jobs = [workerJob(w.pid, run0.root)]; return s; });
  await writeHandoff(run0); await takeover(run0, "a");                    // drive holds epoch 2; then "kill -9 drive": nothing more runs
  const tf = await readJ(run0.P.tokenFile);
  const back = await transfer(run0.root, { token: tf.token, toRuntime: "claude", coordinator: "session" });   // the owner's `start --resume`
  eq(back.epoch, 3, "resume transfer epoch");
  const leaseBefore = await rawLease(run0); const eventsBefore = (await eventsOf(run0)).length; const stateBefore = await readFile(run0.P.stateFile, "utf8");
  const m = mkDeps(run0, { next: (input) => (m.calls.next.length === 1 ? waitAct(2) : act("stop", 2)) });
  await API.runLoop()({ project: run0.root, runId: run0.runId, epoch: 2 }, m.deps);       // the stale drive loop wakes up at epoch 2
  ok(m.calls.next.length <= 1, `a fenced drive must stop at its first renew, next was called ${m.calls.next.length} times`);
  eq(await rawLease(run0), leaseBefore, "the fenced drive must not touch the lease"); eq((await eventsOf(run0)).length, eventsBefore, "the fenced drive must not append to the journal");
  eq(await readFile(run0.P.stateFile, "utf8"), stateBefore, "the fenced drive must not write state.json"); eq(m.calls.finish.length + m.calls.land.length, 0, "no finish/land by a fenced drive");
  const now = await rawLease(run0); eq([now.epoch, now.coordinator, now.runtime, now.run_id], [3, "session", "claude", RUN_ID], "the resumed session owns the run");
  ok(alive(w.pid) && !existsSync(w.exitFile), "the Codex worker must survive drive's takeover and the resume transfer (adopted by the new holder)");
});

// ------------------------------------------------------------------------------------------------ done
for (const k of killers) k();
for (const d of roots) await rm(d, { recursive: true, force: true }).catch(() => {});
console.log(`RESULT: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
