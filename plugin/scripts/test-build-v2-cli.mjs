#!/usr/bin/env node
// test-build-v2-cli.mjs: T-D01, the official test of plugin/scripts/pandacorp-build.mjs (dispatcher) and
// plugin/runtime/build/lifecycle.mjs. Written from the contracts only (PLAN 3.1-3.3, 3.16 A4/A9/A11/A23, 5.3 row D01,
// plugin/docs/build-engine-cli.md sections 2, 3, 9, 12, session-2 rulings R1-R4). Run: node plugin/scripts/test-build-v2-cli.mjs
//
// Black box: every case drives `node plugin/scripts/pandacorp-build.mjs ...` as a subprocess against throwaway fixtures
// (make-fixture.mjs) with the testEnv hooks only (fake Codex, fixed clock, throwaway HOME/host/events), never the real home.
//
// ASSUMED INTERFACE (the docs do not fix these; the orchestrator reconciles test and dispatcher afterwards):
//   - `--help` (also `-h`) exits 0 and prints text (or a JSON line) that CONTAINS every documented top-level command word
//     (start, card, plan, lint-plan, risk, next, report, review-record, land, doubt, answer, handback, quota, admit, handoff,
//     drive, finish, stop, status, summary, rebuild-state) and none of the removed words (heartbeat, escalate, calibrate,
//     yield-request, --budget, --takeover, --engine, --chain).
//   - A removed or unknown command, and an unknown flag, exit 2 (USAGE) with one JSON line {ok:false, cmd, code:"USAGE"}.
//     `code` is only checked when present. No command at all also exits 2.
//   - `start --run` while a run is active (live lease) exits 4 or 5 (the doc gives 4 for a live foreign lease and 5 for "resume or
//     stop the run first"; both are accepted).
//   - `start --run` with an empty scope ({wos:[]}) exits 5 ("scope is not buildable").
//   - Missing/garbled --epoch on a fenced command exits 2 (USAGE); a wrong epoch exits 3.
//   - `next` after a terminal action or `stop` released the lease exits 3 (no lease = fence).
//   - After `quota record` (claude 95/95) and a Codex rollout at 98 %, the first `next` returns action "paused-quota"; the run
//     becomes status "paused" with the lease released. Claude >= 95 % alone: "handoff" when the drive standby is alive
//     (build/drive/standby.json pid alive, state standby), else "paused-quota" (A11).
//   - `start --run` on an unlaunched project returns prepush "not_needed"; on the `launched` fixture "installed", with the
//     untracked hook (marker `# pandacorp-pre-push v2`) at `git rev-parse --git-path hooks`/pre-push.
//   - Event BuildLaunch lands in PANDACORP_EVENTS_FILE for a Claude-coordinated run.
//   - Branch/path names come from plugin/runtime/build/paths.mjs (buildPaths), never hand-built (R1).
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "pandacorp-build.mjs");
const BUILD = path.join(HERE, "..", "runtime", "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const NOW = "2026-11-11T12:00:00.000Z";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const oneOf = (v, list, message) => { if (!list.includes(v)) throw new Error(`${message}: expected one of ${JSON.stringify(list)}, got ${JSON.stringify(v)}`); };
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };

const fx = () => import(pathToFileURL(FIXTURES).href);
const pathsMod = () => import(pathToFileURL(path.join(BUILD, "paths.mjs")).href);
const fsxMod = () => import(pathToFileURL(path.join(BUILD, "fsx.mjs")).href);

/** Runs the CLI once; returns {code, stdout, stderr, json (last stdout line parsed or null), lines}. */
function run(args, { env, cwd, timeout = 60000 } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: cwd || os.tmpdir(), env, encoding: "utf8", timeout });
  const lines = (r.stdout || "").split("\n").filter((l) => l.trim());
  let json = null; try { json = JSON.parse(lines[lines.length - 1]); } catch { json = null; }
  return { code: r.status, signal: r.signal, stdout: r.stdout || "", stderr: r.stderr || "", json, lines };
}
const need = (r, what, code = 0) => {
  if (r.code !== code) throw new Error(`${what}: expected exit ${code}, got ${r.code}${r.signal ? ` (signal ${r.signal})` : ""}; stdout=${r.stdout.slice(0, 400)} stderr=${r.stderr.slice(0, 400)}`);
  return r.json;
};
const singleJsonLine = (r, what) => { eq(r.lines.length, 1, `${what}: stdout must be exactly one JSON line`); ok(r.json && typeof r.json === "object", `${what}: stdout line is not JSON`); };

const sandboxes = [];
const bgPids = new Set();
async function sandbox(preset = "basic") {
  const { createFixture, testEnv } = await fx();
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pandacorp-d01-"));
  const fixture = await createFixture(preset, { dir });
  const env = testEnv(dir, {});
  await mkdir(env.HOME, { recursive: true });
  await writeFile(env.PANDACORP_FAKE_WORKER_PLAN, "{}\n");
  const s = { dir, fixture, env, root: fixture.root, project: ["--project", fixture.root] };
  s.envWith = (extra) => ({ ...env, ...extra });
  s.cli = (args, opts = {}) => run([...args, ...s.project], { env: opts.env || env, cwd: opts.cwd, timeout: opts.timeout });
  s.cliNoProject = (args, opts = {}) => run(args, { env: opts.env || env, cwd: opts.cwd || s.root });
  sandboxes.push(s);
  return s;
}
const gitIn = (root, ...args) => spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH, HOME: os.tmpdir(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout.trim();
const mainState = (root) => ({ head: gitIn(root, "rev-parse", "main"), porcelain: gitIn(root, "status", "--porcelain"), tracked: gitIn(root, "ls-files") });
const hookFile = (root) => path.join(path.resolve(root, gitIn(root, "rev-parse", "--git-path", "hooks")), "pre-push");

/** detect -> scope file -> preflight -> start --run. Returns {detect, scopeFile, pre, start (json)}. */
async function startRun(s, { coordinator = "claude", args = [], env = s.env, runExtra = [] } = {}) {
  const det = need(s.cli(["start", "--detect", ...args], { env }), "start --detect");
  const scopeFile = path.join(s.dir, "scope-in.json");
  await writeFile(scopeFile, JSON.stringify(det.scope));
  const pre = need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", coordinator, "--session-model", "sonnet", "--probe-codex"], { env }), "start --preflight");
  const r = s.cli(["start", "--run", "--scope-json", scopeFile, "--label", coordinator, "--coordinator", coordinator, "--session-model", "sonnet", ...runExtra], { env });
  const start = need(r, "start --run");
  if (start.drive?.armed) await sleep(0);
  return { detect: det, scopeFile, pre, start, raw: r };
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function readState(s) { const { buildPaths } = await pathsMod(); return JSON.parse(await readFile(buildPaths(s.root).stateFile, "utf8")); }
async function waitStandby(s, ms = 6000) {
  const { buildPaths } = await pathsMod(); const f = buildPaths(s.root).driveStandbyFile; const end = Date.now() + ms;
  while (Date.now() < end) { try { const j = JSON.parse(await readFile(f, "utf8")); if (j.pid) { bgPids.add(j.pid); return j; } } catch { /* not yet */ } await sleep(100); }
  return null;
}
function killBackground() { for (const pid of bgPids) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } } bgPids.clear(); }
async function cleanup() {
  for (const s of sandboxes) {
    try { const { buildPaths } = await pathsMod(); const j = JSON.parse(await readFile(buildPaths(s.root).driveStandbyFile, "utf8")); if (j.pid) bgPids.add(j.pid); } catch { /* none */ }
  }
  killBackground();
  for (const s of sandboxes) { try { await s.fixture.cleanup(); } catch { /* ignore */ } await rm(s.dir, { recursive: true, force: true }); }
}

const COMMANDS = ["start", "card", "plan", "lint-plan", "risk", "next", "report", "review-record", "land", "doubt", "answer", "handback", "quota", "admit", "handoff", "drive", "finish", "stop", "status", "summary", "rebuild-state"];
const REMOVED_COMMANDS = ["heartbeat", "escalate", "calibrate", "yield-request"];
const REMOVED_WORDS = ["heartbeat", "escalate", "calibrate", "yield-request", "--budget", "--takeover", "--engine", "--chain"];

// ============================================================================================ surface
await test("dispatcher file exists and is a Node ESM entry point", async () => {
  ok(existsSync(CLI), "plugin/scripts/pandacorp-build.mjs does not exist yet (D01 not landed)");
});

await test("--help exits 0 and lists exactly the documented commands, none of the removed ones", async () => {
  const s = await sandbox();
  for (const flag of ["--help", "-h"]) {
    const r = run([flag], { env: s.env });
    eq(r.code, 0, `${flag} exit`);
    const text = `${r.stdout}\n${r.stderr}`;
    for (const c of COMMANDS) ok(new RegExp(`(^|[^\\w-])${c.replace("-", "\\-")}([^\\w-]|$)`, "m").test(text), `${flag} must mention the command "${c}"`);
    for (const w of REMOVED_WORDS) ok(!text.includes(w), `${flag} must not mention the removed word "${w}"`);
  }
});

await test("no command exits 2; removed commands and unknown commands exit 2 with an ok:false JSON line", async () => {
  const s = await sandbox();
  eq(run([], { env: s.env }).code, 2, "no command");
  for (const c of [...REMOVED_COMMANDS, "frobnicate"]) {
    const r = s.cli([c]);
    eq(r.code, 2, `command "${c}" must exit 2 (USAGE)`);
    singleJsonLine(r, `command ${c}`);
    eq(r.json.ok, false, `command ${c} ok`);
    if (r.json.code !== undefined) eq(r.json.code, "USAGE", `command ${c} error code`);
  }
});

await test("removed flags are unknown flags: exit 2 (--budget, --takeover, --engine, land --chain)", async () => {
  const s = await sandbox();
  for (const args of [["start", "--run", "--budget", "5"], ["start", "--resume", "--coordinator", "claude", "--takeover"], ["start", "--detect", "--engine", "v2"], ["land", "--epoch", "1", "--chain"], ["status", "--bogus"]]) {
    const r = s.cli(args);
    eq(r.code, 2, `${args.join(" ")} must exit 2`);
    eq(r.json?.ok, false, `${args.join(" ")} must print ok:false`);
  }
});

await test("exit 10 NOT_A_PROJECT outside a Pandacorp project, one JSON line with the error code", async () => {
  const s = await sandbox();
  const empty = await mkdtemp(path.join(s.dir, "empty-"));
  const r = run(["status", "--project", empty], { env: s.env, cwd: empty });
  eq(r.code, 10, "status in a non-project");
  singleJsonLine(r, "not a project");
  eq(r.json.ok, false, "ok"); eq(r.json.cmd, "status", "cmd");
  if (r.json.code !== undefined) eq(r.json.code, "NOT_A_PROJECT", "code");
  eq(run(["status"], { env: s.env, cwd: empty }).code, 10, "no --project and no ancestor project");
});

await test("--project default: the nearest ancestor containing .pandacorp/status.yaml is used", async () => {
  const s = await sandbox();
  const sub = path.join(s.root, "src");
  const r = run(["status"], { env: s.env, cwd: sub });
  ok(r.code !== 10, "must find the project from a subdirectory (got exit 10)");
});

await test("usage errors: quota record without percentages, fenced command without --epoch", async () => {
  const s = await sandbox();
  eq(s.cli(["quota", "record", "--provider", "claude", "--status", "ok"]).code, 2, "quota record --status ok without percentages");
  for (const args of [["next"], ["finish"], ["land"], ["handoff", "--reason", "manual"], ["rebuild-state"]]) eq(s.cli(args).code, 2, `${args[0]} without --epoch`);
});

await test("exit code table: every exit used by the dispatcher is one of the documented codes", async () => {
  const s = await sandbox();
  const allowed = new Set([0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const args of [["status"], ["summary"], ["quota", "read"], ["admit"], ["plan"], ["lint-plan"], ["risk", "--files", "src/a.ts"], ["next", "--epoch", "1"], ["stop", "--epoch", "1"], ["finish", "--epoch", "1"]]) {
    const r = s.cli(args);
    ok(allowed.has(r.code), `${args.join(" ")} exited ${r.code}, not a documented code`);
    ok(r.json && typeof r.json.ok === "boolean", `${args.join(" ")} must print a JSON envelope with ok`);
  }
});

// ============================================================================================ read-only commands
await test("start --detect: row 6 on the basic fixture, envelope + scope shape, one JSON line, writes nothing", async () => {
  const s = await sandbox(); const before = mainState(s.root);
  const r = s.cli(["start", "--detect"]);
  const j = need(r, "start --detect"); singleJsonLine(r, "detect");
  eq(j.ok, true, "ok"); eq(j.cmd, "start", "cmd"); eq(j.mode, "detect", "mode");
  eq(j.row, 6, "row (pending WOs, no card, no run)");
  eq([...j.scope.wos].sort(), ["wo-01-001", "wo-01-002", "wo-02-001", "wo-02-002"], "scope.wos");
  oneOf(j.size_provisional, ["touch", "feature", "giant"], "size_provisional");
  oneOf(j.label, ["claude", "codex"], "label");
  oneOf(j.label_source, ["explicit", "orchestrate", "default"], "label_source");
  eq(j.signals.lease, "free", "signals.lease"); ok(Array.isArray(j.warnings), "warnings array");
  eq(mainState(s.root), before, "detect must not change main");
  ok(!(await exists(path.join(s.root, ".pandacorp", "run", "build", "state.json"))), "detect must not create a run");
});

await test("legacy mode words (pro, balanced, powerful, deep) are accepted, ignored and warned", async () => {
  const s = await sandbox();
  for (const w of ["pro", "balanced", "powerful", "deep"]) {
    const j = need(s.cli(["start", "--detect", "--args", w]), `detect --args ${w}`);
    ok((j.warnings || []).includes("legacy mode word ignored"), `warnings must include "legacy mode word ignored" for "${w}": ${JSON.stringify(j.warnings)}`);
    eq(j.row, 6, `row unchanged by "${w}"`);
  }
  const plain = need(s.cli(["start", "--detect"]), "detect plain");
  ok(!(plain.warnings || []).includes("legacy mode word ignored"), "no warning without a legacy word");
});

await test("card check: a good card exits 0 with fields, a broken card exits 6 with ok:false and errors", async () => {
  const s = await sandbox("card");
  const good = path.join(s.root, ".pandacorp", "inbox", "changes", "add-filter.md");
  const r = s.cli(["card", "check", good]);
  ok([0, 6].includes(r.code), `card check exit ${r.code}`);
  ok(Array.isArray(r.json.errors) && Array.isArray(r.json.warnings) && typeof r.json.fields === "object", "errors[]/warnings[]/fields{} present");
  eq(r.json.cmd, "card", "cmd"); eq(r.json.sub, "check", "sub");
  eq(r.json.ok, r.code === 0, "ok mirrors the exit code");
  const bad = path.join(s.dir, "bad-card.md");
  await writeFile(bad, "---\ntype: nonsense\nstatus: maybe\n---\nno title\n");
  const rb = s.cli(["card", "check", bad]);
  eq(rb.code, 6, "broken card exits 6"); eq(rb.json.ok, false, "ok:false"); ok(rb.json.errors.length > 0, "errors listed");
});

await test("risk: auth path is a product-floor/r1 zone, plain path none; shape per 3.7; plan/lint-plan shapes", async () => {
  const s = await sandbox();
  const a = need(s.cli(["risk", "--files", "src/lib/auth/session.ts"]), "risk auth");
  oneOf(a.zone, ["floor", "r1"], "auth zone");
  const b = need(s.cli(["risk", "--files", "src/alpha/list.ts"]), "risk plain");
  eq(b.zone, "none", "plain zone");
  for (const k of ["zone", "rules", "signals", "irreversible", "audit", "failclosed", "unclassified"]) ok(k in b, `risk output has ${k}`);
  const scopeFile = path.join(s.dir, "scope.json");
  const det = need(s.cli(["start", "--detect"]), "detect"); await writeFile(scopeFile, JSON.stringify(det.scope));
  const p = need(s.cli(["plan", "--scope-json", scopeFile]), "plan");
  ok(Array.isArray(p.units) && p.units.length > 0 && Array.isArray(p.rounds) && Array.isArray(p.issues), "plan units/rounds/issues");
  for (const u of p.units) for (const k of ["id", "kind", "wos", "frd", "chain", "depends_on"]) ok(k in u, `plan unit has ${k}`);
  const lint = s.cli(["lint-plan", "--scope-json", scopeFile]);
  ok([0, 6].includes(lint.code), `lint-plan exit ${lint.code}`);
});

await test("quota record/read and admit: shapes, env-driven (fixture rollout, signals file), unavailable status", async () => {
  const s = await sandbox(); const f = await fx();
  await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "clean");
  await f.writeRolloutSample(s.env.CODEX_HOME, "normal");
  const rec = need(s.cli(["quota", "record", "--provider", "claude", "--five-hour", "36", "--weekly", "12"]), "quota record");
  eq(rec.cmd, "quota", "cmd"); eq(rec.sub, "record", "sub"); eq(rec.reading.five_hour_pct, 36, "five_hour_pct"); eq(rec.reading.weekly_pct, 12, "weekly_pct"); eq(rec.reading.status, "ok", "status");
  const un = need(s.cli(["quota", "record", "--provider", "claude", "--status", "unavailable"]), "quota record unavailable");
  eq(un.reading.five_hour_pct, null, "unavailable stores null"); eq(un.reading.status, "unavailable", "status");
  const rd = need(s.cli(["quota", "read"]), "quota read");
  for (const k of ["claude", "codex", "policy"]) ok(k in rd, `quota read has ${k}`);
  const ad = need(s.cli(["admit"]), "admit");
  eq(ad.cmd, "admit", "cmd"); oneOf(ad.decision, ["grant", "wait"], "decision"); eq(ad.class, "B", "default class");
  ok(typeof ad.signals === "object" && "L" in ad.signals, "signals.L present");
  const adH = need(s.cli(["admit", "--class", "H"]), "admit H"); eq(adH.class, "H", "class H");
  await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "garbled");
  const bad = s.cli(["admit"]); eq(bad.code, 9, "unreadable RAM signals exit 9"); eq(bad.json.safe_mode, true, "safe_mode");
});

await test("PATCH2: admit shows the persisted adaptive ceiling without modifying admission", async () => {
  const s = await sandbox(); const f = await fx();
  await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "clean");
  const { initializeAdmission } = await import("../runtime/build/admission.mjs");
  const { buildPaths } = await pathsMod();
  const file = buildPaths(s.root, { env: s.env }).admissionFile;
  initializeAdmission({ step: 2, allow8: false }, { file, now: () => Date.parse(NOW) });
  const before = await readFile(file, "utf8");
  eq(need(s.cli(["admit"]), "admit persisted step").techo, 2, "persisted step");
  eq(await readFile(file, "utf8"), before, "admit is read only");
});

// ============================================================================================ preflight (R2) and start --run
await test("preflight is read-only (R2): writes only preflight.json (0600), never installs the pre-push guard, main untouched", async () => {
  const s = await sandbox("launched"); const before = mainState(s.root);
  const hook = hookFile(s.root);
  const det = need(s.cli(["start", "--detect"]), "detect");
  const scopeFile = path.join(s.dir, "scope.json"); await writeFile(scopeFile, JSON.stringify(det.scope));
  const pre = need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]), "preflight");
  for (const k of ["elapsed_ms", "checks", "need_from_owner", "announce", "drive_armable"]) ok(k in pre, `preflight has ${k}`);
  ok(Array.isArray(pre.checks) && pre.checks.length > 0, "checks[] non-empty");
  eq(pre.drive_armable, true, "missing hook is installable: drive armable (R2)"); eq(pre.drive_block_reason ?? null, null, "no block reason");
  eq(pre.checks.find((c) => c.id === "phase.prepush_missing")?.status, "pass", "prepush_missing is a pass when installable"); eq(pre.prepush?.will_install, true, "prepush.will_install");
  ok(pre.checks.some((c) => c.id === "phase.launched"), "phase.launched check present in a launched project");
  const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  const pf = await stat(P.preflightFile); eq(pf.mode & 0o777, 0o600, "preflight.json mode");
  ok(!existsSync(hook), "preflight must NOT install the pre-push hook (R2)");
  ok(!existsSync(P.leaseFile) && !existsSync(P.stateFile) && !existsSync(P.tokenFile), "preflight must not take a lease or write state");
  eq(mainState(s.root), before, "main checkout unchanged by preflight");
});

await test("start --run without a fresh preflight is exit 5 (re-run preflight); empty scope is exit 5", async () => {
  const s = await sandbox();
  const scopeFile = path.join(s.dir, "scope.json");
  const det = need(s.cli(["start", "--detect"]), "detect"); await writeFile(scopeFile, JSON.stringify(det.scope));
  const r = s.cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude"]);
  eq(r.code, 5, "no preflight"); eq(r.json.ok, false, "ok:false"); ok(/preflight/i.test(r.json.message || ""), `message must say to re-run preflight: ${r.json.message}`);
  const empty = path.join(s.dir, "empty-scope.json"); await writeFile(empty, JSON.stringify({ card: null, frds: [], wos: [] }));
  need(s.cli(["start", "--preflight", "--row", "6", "--scope-json", empty, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]), "preflight on the empty scope");
  eq(s.cli(["start", "--run", "--scope-json", empty, "--label", "claude", "--coordinator", "claude"]).code, 5, "empty scope is not buildable");
  ok(!(await exists((await pathsMod()).buildPaths(s.root).leaseFile)), "a refused start must not leave a lease");
});

await test("start --run (unlaunched): shape, lease token 0600 and never printed, integration branch via paths.mjs, main untouched, drive standby", async () => {
  const s = await sandbox(); const before = mainState(s.root);
  const { start, raw } = await startRun(s);
  singleJsonLine(raw, "start --run");
  eq(start.cmd, "start", "cmd"); eq(start.mode, "run", "mode"); eq(start.ok, true, "ok");
  ok(/^br-\d{4}-\d{2}-\d{2}-\d{2}$/.test(start.run_id), `run_id format br-YYYY-MM-DD-NN: ${start.run_id}`);
  ok(Number.isInteger(start.epoch) && start.epoch >= 1, "epoch integer");
  const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  eq(start.integration.branch, P.integrationBranch(start.run_id), "integration.branch comes from paths.integrationBranch (R1)");
  eq(path.resolve(start.integration.worktree), P.integrationWorktree, "integration.worktree");
  ok(await exists(start.integration.worktree), "integration worktree exists");
  ok(gitIn(s.root, "rev-parse", "--verify", `refs/heads/${start.integration.branch}`).length === 40, "integration branch exists in git");
  eq(start.prepush, "not_needed", "prepush in an unlaunched project");
  ok(start.drive && typeof start.drive.armed === "boolean", "drive.armed boolean");
  if (!start.drive.armed) ok(typeof start.drive.reason === "string" && start.drive.reason, "drive not armed carries a reason");
  const tok = JSON.parse(await readFile(P.tokenFile, "utf8"));
  eq(tok.epoch, start.epoch, "token file epoch"); ok(typeof tok.token === "string" && tok.token.length >= 16, "token present");
  eq((await stat(P.tokenFile)).mode & 0o777, 0o600, "lease-token.json mode");
  ok(!raw.stdout.includes(tok.token) && !raw.stderr.includes(tok.token), "the lease token is never printed");
  const events = await readFile(s.env.PANDACORP_EVENTS_FILE, "utf8").catch(() => "");
  ok(events.includes("BuildLaunch"), "BuildLaunch emitted to PANDACORP_EVENTS_FILE");
  ok(!events.includes(tok.token), "no secret in events");
  eq(mainState(s.root), before, "start --run must not write any tracked file nor move main");
  const st = await readState(s);
  eq(st.engine, "v2", "state.engine"); eq(st.schema, 2, "state.schema"); eq(st.status, "active", "state.status"); eq(st.run_id, start.run_id, "state.run_id");
  eq(st.coordinator, "claude-session", "state.coordinator for --coordinator claude");
  eq(st.integration.branch, start.integration.branch, "state.integration.branch");
  const { validate, loadSchema } = await fsxMod();
  const v = validate(await loadSchema("state"), st); ok(v.ok, `state.json matches state.schema: ${JSON.stringify(v.errors.slice(0, 3))}`);
  ok(st.units.length > 0, "units queued from the plan");
  const queued = [...new Set(st.units.filter((u) => u.kind === "build").flatMap((u) => u.wos))].sort();
  const four = ["wo-01-001", "wo-01-002", "wo-02-001", "wo-02-002"];
  ok(queued.every((w) => four.includes(w)) && queued.includes("wo-01-001") && queued.includes("wo-02-001"), `build units cover a subset of the four scope WOs incl. wo-01-001 and wo-02-001: ${JSON.stringify(queued)} (wo-02-002 comes in the second planning round)`);
  eq([...new Set([...queued, ...need(s.cli(["plan"]), "plan").units.flatMap((u) => u.wos)])].sort(), four, "queued units plus `plan` (units still to queue in later rounds) cover all four WOs");
});

await test("start --run applies --answers for a real first-minute question into state.answers; unknown scope keys tolerated", async () => {
  const s = await sandbox();
  const det = need(s.cli(["start", "--detect"]), "detect");
  const scopeFile = path.join(s.dir, "scope-x.json"); await writeFile(scopeFile, JSON.stringify({ ...det.scope, extra_key: 1 }));
  const pre = need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]), "preflight");
  const q = pre.checks.find((c) => c.question)?.question; ok(q, "the basic fixture yields at least one ask (q-scope.giant)");
  need(s.cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet", "--answers", JSON.stringify({ [q.id]: q.default_action })]), "start --run with answers");
  eq((await readState(s)).answers?.[q.id], q.default_action, "state.answers stores the owner's answer");
});

await test("start --run rejects an --answers id that is not a first-minute ask: exit 6, nothing left behind", async () => {
  const s = await sandbox(); const before = mainState(s.root);
  const det = need(s.cli(["start", "--detect"]), "detect"); const scopeFile = path.join(s.dir, "scope-y.json"); await writeFile(scopeFile, JSON.stringify(det.scope));
  need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]), "preflight");
  const r = s.cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet", "--answers", '{"q-demo.question":"default"}']);
  eq(r.code, 6, "unknown answer id"); eq(r.json.ok, false, "ok:false");
  const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  ok(!existsSync(P.leaseFile) && !existsSync(P.stateFile), "no lease and no state.json left");
  eq(mainState(s.root), before, "main untouched");
});

await test("status JSON shape (3.21) and summary validate against the documented definition and summary.schema", async () => {
  const s = await sandbox(); const { start } = await startRun(s);
  const r = s.cli(["status"]); const j = need(r, "status"); singleJsonLine(r, "status");
  eq(j.run_id, start.run_id, "run_id"); eq(j.epoch, start.epoch, "epoch");
  eq(j.coordinator, "claude-session", "coordinator"); eq(j.status, "active", "status");
  oneOf(j.label, ["claude", "codex"], "label"); oneOf(j.size, ["touch", "feature", "giant"], "size");
  ok(j.units_by_state && typeof j.units_by_state === "object", "units_by_state object");
  eq(j.lease.ttl_seconds, 1800, "lease.ttl_seconds"); eq(j.lease.live, true, "lease.live"); ok(typeof j.lease.renewed_at === "string", "lease.renewed_at");
  ok(j.quota && "claude" in j.quota && "codex" in j.quota, "quota.claude/codex");
  ok(j.drive && typeof j.drive.armed === "boolean", "drive.armed"); if ("state" in j.drive) oneOf(j.drive.state, ["standby", "active", "stopped"], "drive.state");
  ok(Number.isInteger(j.deferred_pending), "deferred_pending integer"); ok(Array.isArray(j.open_questions), "open_questions array");
  const sm = need(s.cli(["summary"]), "summary");
  const { validate, loadSchema } = await fsxMod();
  const { ok: _ok, cmd: _cmd, ...body } = sm;
  const v = validate(await loadSchema("summary"), body); ok(v.ok, `summary matches summary.schema: ${JSON.stringify(v.errors.slice(0, 3))}`);
  eq(sm.run_id, start.run_id, "summary.run_id"); eq(sm.status, "active", "summary.status");
});

await test("a second start --run on an active run is refused (exit 4 or 5), the first run is untouched", async () => {
  const s = await sandbox(); const { start, scopeFile } = await startRun(s);
  const r = s.cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude"]);
  oneOf(r.code, [4, 5], "second start --run exit"); eq(r.json.ok, false, "ok:false");
  eq((await readState(s)).run_id, start.run_id, "the live run is unchanged");
});

await test("next on a fresh run: exit 0, action in the documented enum, tokens only on dispatch and never stored raw", async () => {
  const s = await sandbox(); const f = await fx(); const { start } = await startRun(s);
  await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "clean");
  const r = s.cli(["next", "--epoch", String(start.epoch)]); const j = need(r, "next"); singleJsonLine(r, "next");
  eq(j.cmd, "next", "cmd"); eq(j.epoch, start.epoch, "epoch");
  oneOf(j.action, ["dispatch", "waiting", "wait", "handoff", "land", "done", "paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"], "action");
  if (j.action === "dispatch") {
    ok(Array.isArray(j.units) && j.units.length > 0, "dispatch carries units");
    const stateRaw = await readFile((await pathsMod()).buildPaths(s.root).stateFile, "utf8");
    for (const u of j.units) {
      oneOf(u.kind, ["docs", "tests", "build", "patch", "review", "audit", "doubt-consult", "deferred-review"], "unit kind");
      oneOf(u.via, ["agent", "cli", "session"], "via"); ok(typeof u.token === "string" && u.token, "unit token returned once");
      ok(!stateRaw.includes(u.token), "state.json must hold only the token hash, never the raw token");
      ok(["brief_path", "report_path", "worktree", "dispatch_line"].every((k) => k in u), "unit has brief_path/report_path/worktree/dispatch_line");
    }
  } else ok(!j.units?.length, "units only for dispatch");
});

await test("fence: a wrong epoch exits 3 on next, stop, finish, handoff, rebuild-state; the run is untouched", async () => {
  const s = await sandbox(); const { start } = await startRun(s); const bad = String(start.epoch + 7);
  for (const args of [["next", "--epoch", bad], ["stop", "--epoch", bad], ["finish", "--epoch", bad], ["handoff", "--epoch", bad, "--reason", "manual"], ["rebuild-state", "--epoch", bad]]) {
    const r = s.cli(args); eq(r.code, 3, `${args[0]} with a stale epoch must exit 3`); eq(r.json?.ok, false, `${args[0]} ok:false`);
  }
  eq((await readState(s)).status, "active", "state still active");
});

await test("handoff writes only build/handoff.json (valid, no secret) and finish on an active run with open units is exit 5", async () => {
  const s = await sandbox(); const { start } = await startRun(s); const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  const h = need(s.cli(["handoff", "--epoch", String(start.epoch), "--reason", "manual"]), "handoff");
  eq(path.resolve(h.handoff_path), P.handoffFile, "handoff_path");
  const doc = JSON.parse(await readFile(P.handoffFile, "utf8"));
  eq(doc.run_id, start.run_id, "handoff.run_id"); eq(doc.reason, "manual", "handoff.reason"); eq(doc.from_epoch, start.epoch, "from_epoch");
  const { validate, loadSchema } = await fsxMod(); const v = validate(await loadSchema("handoff"), doc); ok(v.ok, `handoff matches schema: ${JSON.stringify(v.errors.slice(0, 3))}`);
  const tok = JSON.parse(await readFile(P.tokenFile, "utf8")); ok(!JSON.stringify(doc).includes(tok.token), "handoff carries no secret");
  eq(s.cli(["finish", "--epoch", String(start.epoch)]).code, 5, "finish on an active run with non-terminal units");
});

// ============================================================================================ lifecycle: stop / resume / transfer
await test("stop --epoch: releases the lease, status stopped, journal run_stopped; next afterwards is exit 3; stop --dead needs --owner-confirmed", async () => {
  const s = await sandbox(); const { start } = await startRun(s); const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  eq(s.cli(["stop", "--dead"]).code, 6, "--dead without --owner-confirmed");
  eq(s.cli(["stop", "--dead", "--owner-confirmed"]).code, 6, "--dead with a live lease");
  const st = need(s.cli(["stop", "--epoch", String(start.epoch)]), "stop"); eq(st.released, true, "released");
  eq((await readState(s)).status, "stopped", "state.status stopped");
  ok(!existsSync(P.leaseFile), "lease released");
  eq(s.cli(["next", "--epoch", String(start.epoch)]).code, 3, "next after stop is fenced");
  const journal = await readFile(P.journalFile, "utf8"); ok(journal.includes("run_stopped"), "journal has run_stopped");
  const events = await readFile(s.env.PANDACORP_EVENTS_FILE, "utf8").catch(() => ""); ok(events.includes("BuildStopped"), "BuildStopped emitted");
});

await test("start --resume after stop: same run_id, epoch advanced, status active again; resume with nothing to resume is exit 5", async () => {
  const s = await sandbox();
  eq(s.cli(["start", "--resume", "--coordinator", "claude"]).code, 5, "nothing to resume");
  const { start } = await startRun(s);
  need(s.cli(["stop", "--epoch", String(start.epoch)]), "stop");
  const r = need(s.cli(["start", "--resume", "--coordinator", "claude", "--session-model", "sonnet"]), "resume");
  eq(r.mode, "resume", "mode"); eq(r.run_id, start.run_id, "same run_id"); ok(r.epoch > start.epoch, "epoch advanced");
  ok(Array.isArray(r.reattached) && Array.isArray(r.requeued), "reattached[] / requeued[]"); ok(r.drive && "armed" in r.drive, "drive.armed");
  eq((await readState(s)).status, "active", "active again");
  eq(s.cli(["start", "--resume"]).code, 2, "--coordinator is required");
});

await test("lease transfer: a fresh-lease resume transfers (epoch+1); the previous holder gets exit 3 on its next fenced command, the winner exit 0", async () => {
  const s = await sandbox(); const { start } = await startRun(s);
  const r = need(s.cli(["start", "--resume", "--coordinator", "claude"]), "resume over a fresh lease");
  eq(r.run_id, start.run_id, "same run"); eq(r.epoch, start.epoch + 1, "epoch+1");
  const loser = s.cli(["next", "--epoch", String(start.epoch)]); eq(loser.code, 3, "loser exits 3"); eq(loser.json.ok, false, "loser ok:false");
  eq(s.cli(["handoff", "--epoch", String(start.epoch), "--reason", "manual"]).code, 3, "loser cannot hand off either");
  eq(s.cli(["next", "--epoch", String(r.epoch)]).code, 0, "winner proceeds");
  eq(s.cli(["start", "--resume", "--coordinator", "claude", "--run", "br-1999-01-01-01"]).code === 0, false, "an unknown --run is not resumed");
});

await test("lease transfer across runtimes: stale session lease of the other runtime needs --owner-confirmed (exit 6 without, 0 with)", async () => {
  const s = await sandbox(); const { start } = await startRun(s, { coordinator: "claude" });
  const later = s.envWith({ PANDACORP_NOW: "2026-11-11T15:00:00.000Z" });
  const denied = s.cli(["start", "--resume", "--coordinator", "codex"], { env: later });
  eq(denied.code, 6, "stale lease, other runtime, no --owner-confirmed"); eq(denied.json.ok, false, "ok:false");
  eq((await readState(s)).epoch, start.epoch, "nothing changed by the refusal");
  const granted = need(s.cli(["start", "--resume", "--coordinator", "codex", "--owner-confirmed"], { env: later }), "owner-confirmed resume");
  ok(granted.epoch > start.epoch, "epoch advanced"); eq((await readState(s)).coordinator, "codex-session", "state.coordinator for codex");
  eq(s.cli(["next", "--epoch", String(start.epoch)], { env: later }).code, 3, "previous holder fenced");
  const sameRuntime = await sandbox(); const a = await startRun(sameRuntime, { coordinator: "claude" });
  const ok2 = sameRuntime.cli(["start", "--resume", "--coordinator", "claude"], { env: sameRuntime.envWith({ PANDACORP_NOW: "2026-11-11T15:00:00.000Z" }) });
  eq(ok2.code, 0, "a stale lease of the SAME runtime transfers without confirmation"); ok(ok2.json.epoch > a.start.epoch, "epoch advanced");
});

await test("stop --dead --owner-confirmed releases only a reclaimable (expired) lease", async () => {
  const s = await sandbox(); await startRun(s); const { buildPaths } = await pathsMod(); const P = buildPaths(s.root);
  const later = s.envWith({ PANDACORP_NOW: "2026-11-11T15:00:00.000Z" });
  const r = need(s.cli(["stop", "--dead", "--owner-confirmed"], { env: later }), "stop --dead on an expired lease"); eq(r.released, true, "released");
  ok(!existsSync(P.leaseFile), "lease gone");
});

// ============================================================================================ A11 quota policy through next
await test("A11: Claude 95 % and Codex 98 % (both at the stop threshold): next applies paused-quota, run paused, lease released, later calls fenced", async () => {
  const s = await sandbox(); const f = await fx();
  await f.writeRolloutSample(s.env.CODEX_HOME, "pct98"); await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "clean");
  const { start } = await startRun(s);
  need(s.cli(["quota", "record", "--provider", "claude", "--five-hour", "100", "--weekly", "100", "--five-hour-resets-at", "2026-11-12T12:00:00Z", "--weekly-resets-at", "2026-11-14T12:00:00Z"]), "quota record 95");
  const j = need(s.cli(["next", "--epoch", String(start.epoch)]), "next");
  eq(j.action, "waiting", "both companies at the stop threshold");
  const st = await readState(s); eq(st.status, "waiting", "state.status paused");
  ok(existsSync((await pathsMod()).buildPaths(s.root).leaseFile), "capacity wait retains the lease");
  eq(s.cli(["next", "--epoch", String(start.epoch)]).code, 0, "next can renew while waiting");
  const sm = need(s.cli(["status"]), "status while waiting"); eq(sm.status, "waiting", "status waiting"); eq(sm.lease.live, true, "lease retained");
  const back = need(s.cli(["start", "--resume", "--coordinator", "claude"]), "early resume"); eq(back.claimed, false, "no reset confirmation: no resume"); eq(back.epoch, start.epoch, "epoch retained");
});

await test("A11: Claude >= 95 % alone, no live drive standby: paused-quota (never handoff); with a live standby: handoff and the run stays active", async () => {
  const f = await fx();
  // no drive: Codex login fails, so drive is never armed
  const a = await sandbox(); await f.writeRolloutSample(a.env.CODEX_HOME, "normal"); await f.writeSignalsFile(a.env.PANDACORP_SIGNALS_FILE, "clean");
  const envNoLogin = a.envWith({ PANDACORP_FAKE_CODEX_LOGIN: "out" });
  const ra = await startRun(a, { env: envNoLogin });
  eq(ra.start.drive.armed, false, "drive not armed without a Codex login");
  need(a.cli(["quota", "record", "--provider", "claude", "--five-hour", "96", "--weekly", "20"], { env: envNoLogin }), "quota record 96");
  eq(need(a.cli(["next", "--epoch", String(ra.start.epoch)], { env: envNoLogin }), "next without drive").action, "dispatch", "no standby required for allocation");
  // with drive
  const b = await sandbox(); await f.writeRolloutSample(b.env.CODEX_HOME, "normal"); await f.writeSignalsFile(b.env.PANDACORP_SIGNALS_FILE, "clean");
  const rb = await startRun(b);
  if (!rb.start.drive.armed) throw new Error(`drive must arm with a fake Codex login OK in an unlaunched project; reason=${rb.start.drive.reason}`);
  const standby = await waitStandby(b); ok(standby, "drive standby.json written with a pid");
  eq(standby.state, "standby", "standby state"); eq(standby.run_id, rb.start.run_id, "standby run_id");
  need(b.cli(["quota", "record", "--provider", "claude", "--five-hour", "96", "--weekly", "20"]), "quota record 96");
  const j = need(b.cli(["next", "--epoch", String(rb.start.epoch)]), "next with drive");
  eq(j.action, "dispatch", "pressure dispatches to the other tool"); eq((await readState(b)).status, "active", "a handoff keeps the run active");
});

// ============================================================================================ launched project: pre-push guard
await test("start --run in a launched project installs the UNTRACKED pre-push guard (marker), arms drive, never touches main", async () => {
  const s = await sandbox("launched"); const before = mainState(s.root);
  const hook = hookFile(s.root); ok(!existsSync(hook), "precondition: no hook yet");
  const { start } = await startRun(s);
  eq(start.prepush, "installed", "prepush installed");
  ok(existsSync(hook), "hook file exists at git rev-parse --git-path hooks");
  const text = await readFile(hook, "utf8"); ok(text.includes("# pandacorp-pre-push v2"), "hook carries the marker");
  ok(((await stat(hook)).mode & 0o111) !== 0, "hook is executable");
  eq(gitIn(s.root, "ls-files", ".pandacorp/hooks/pre-push"), "", "no tracked copy of the hook");
  eq(mainState(s.root), before, "main unchanged (hook lives in .git)");
  ok(start.drive.armed === true || typeof start.drive.reason === "string", "drive armed or a reason given");
  const check = spawnSync(process.execPath, [path.join(HERE, "install-pre-push.mjs"), "--project", s.root, "--check"], { encoding: "utf8", env: s.env });
  eq(check.status, 0, "install-pre-push --check agrees the hook is current");
});

await test("launched project: a refused hook install (tracked core.hooksPath) exits non-zero, the run does not start, main untouched", async () => {
  const { createFixture, testEnv } = await fx();
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pandacorp-d01-")); const fixture = await createFixture({ preset: "launched", trackedHooksPath: true }, { dir });
  const env = testEnv(dir, {}); await mkdir(env.HOME, { recursive: true });
  const s = { dir, fixture, env, root: fixture.root, project: ["--project", fixture.root], envWith: (e) => ({ ...env, ...e }), cli: (a, o = {}) => run([...a, "--project", fixture.root], { env: o.env || env }) };
  sandboxes.push(s); const before = mainState(s.root);
  const det = need(s.cli(["start", "--detect"]), "detect"); const scopeFile = path.join(dir, "scope.json"); await writeFile(scopeFile, JSON.stringify(det.scope));
  const pre = need(s.cli(["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]), "preflight");
  ok(pre.checks.some((c) => c.id === "phase.prepush_missing" && c.status !== "pass"), "preflight asks about the missing/uninstallable hook");
  const r = s.cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet"]);
  ok(r.code !== 0, "start --run must not succeed when the guard cannot be installed in a launched project");
  const { buildPaths } = await pathsMod(); ok(!existsSync(buildPaths(s.root).leaseFile), "no lease left behind");
  eq(mainState(s.root), before, "main unchanged");
});

// ============================================================================================ no tracked write on main, ever
await test("no command writes a tracked file on main: full command sweep on the tracked-decisions fixture leaves main identical", async () => {
  const s = await sandbox("tracked-decisions"); const f = await fx(); const before = mainState(s.root);
  await f.writeSignalsFile(s.env.PANDACORP_SIGNALS_FILE, "clean"); await f.writeRolloutSample(s.env.CODEX_HOME, "normal");
  const { start } = await startRun(s); const e = String(start.epoch);
  for (const args of [["status"], ["summary"], ["plan"], ["lint-plan"], ["risk", "--files", "src/lib/auth/session.ts"], ["admit"], ["quota", "read"],
    ["quota", "record", "--provider", "claude", "--five-hour", "10", "--weekly", "10"], ["next", "--epoch", e], ["handoff", "--epoch", e, "--reason", "manual"], ["rebuild-state", "--epoch", e], ["next", "--epoch", e]]) s.cli(args);
  eq(mainState(s.root), before, "main's HEAD, tracked file list and working tree are identical after every command");
  eq(gitIn(s.root, "diff", "--stat"), "", "no tracked file modified");
  need(s.cli(["stop", "--epoch", e]), "stop");
  eq(mainState(s.root), before, "main unchanged after stop");
  need(s.cli(["start", "--resume", "--coordinator", "claude"]), "resume");
  eq(mainState(s.root), before, "main unchanged after resume");
});

await test("rebuild-state regenerates state.json from journal + WO frontmatter and reports diff_vs_cache", async () => {
  const s = await sandbox(); const { start } = await startRun(s);
  const r = need(s.cli(["rebuild-state", "--epoch", String(start.epoch)]), "rebuild-state");
  eq(r.cmd, "rebuild-state", "cmd"); ok(Number.isInteger(r.units) && r.units > 0, "units count");
  ok(r.diff_vs_cache && ["changed", "added", "removed"].every((k) => Array.isArray(r.diff_vs_cache[k])), "diff_vs_cache lists");
});

await test("DENG gc CLI refuses a live lease, is idempotent after stop and preserves branch refs", async () => {
  const s = await sandbox(); const { start } = await startRun(s);
  need(s.cli(["gc"]), "gc with held lease", 4);
  const refs = gitIn(s.root, "for-each-ref", "--format=%(refname)", "refs/heads/");
  need(s.cli(["stop", "--epoch", String(start.epoch)]), "stop before gc");
  need(s.cli(["gc"]), "gc after stop"); need(s.cli(["gc"]), "idempotent gc");
  eq(gitIn(s.root, "for-each-ref", "--format=%(refname)", "refs/heads/"), refs, "all branch refs preserved");
  ok(!gitIn(s.root, "worktree", "list", "--porcelain").includes("/.pandacorp/run/"), "no run worktree after stop/gc");
});

await cleanup();
console.log(`RESULT: ${passed} passed, ${failed} failed (test-build-v2-cli)`);
process.exit(failed ? 1 : 0);
