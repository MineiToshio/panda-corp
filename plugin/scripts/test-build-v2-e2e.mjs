#!/usr/bin/env node
// test-build-v2-e2e.mjs — end-to-end suite of the v2 build engine with NO LLM (design Y 3.3.1, PLAN 5.3 T-D02,
// BUILD-7/13/14/15 "End to end"). It drives `plugin/scripts/pandacorp-build.mjs` ONLY as a subprocess through the surface
// of plugin/docs/build-engine-cli.md, playing the lead session itself (it serves `via:"agent"` units by writing the report
// or review file and filing it), on the 4-WO fixture (fixtures/build-v2/make-fixture.mjs: frd-01 WO-01-001 -> WO-01-002,
// frd-02 WO-02-001 -> WO-02-002 = risk path src/lib/auth/session.ts). Codex units (`via:"cli"`) run the fake worker
// fixtures/build-v2/fake-worker-e2e.mjs through PANDACORP_FAKE_WORKER. Every hook of testEnv() is set: nothing touches the
// real ~/.claude, ~/.codex, host slot dir, events file or a real Codex. The test never writes state.json, the journal,
// the lease or a work order (0 manual state edits); it only reads them.
//
// Scenarios (independent fixtures, run concurrently; target < 5 min wall):
//   S1 unlaunched full run (label claude): detect row 3 on a v2 card -> preflight -> run -> session loop to `done` ->
//      finish. `main` receives ONLY the merge-queue landing (one ff reflog entry, tip carries `Change: <slug>`), the main
//      checkout is never dirty and `main` never moves before the landing; card archived to done/ with shipped_sha.
//   A  handoff at 95 % (label codex): Claude reading 96 -> `next` returns `handoff` -> `handoff` -> the armed standby
//      takes over (trigger a, epoch+1, coordinator drive) -> the session (loser) gets exit 3 -> drive finishes and lands.
//   B  trigger (b) + kill -9 + --resume (label claude): a Codex limit text in codex-workers/ does NOT trigger (DEC-3);
//      a Claude-written limit text in a Claude unit's report.json does -> drive dispatches -> kill -9 drive ->
//      `start --resume` transfers (epoch+1), re-arms drive, and the session finishes the run to landing.
//   C  trigger (c) + return to the session (label codex): standby with a clock 31 min after the last renewal takes over;
//      the stale session gets exit 3; `start --resume` takes the run back; the drive process (loser) exits.
//   Q  both companies >= 90 % -> `next` returns paused-quota already applied: status paused, lease released, the old
//      epoch is fenced (exit 3), the standby exits, main untouched.
//   L  launched fixture (label codex): `start --run` installs the pre-push hook; a fake worker's `git push` to `main`
//      is rejected; `land` -> merge-queue exit 21 -> `waiting_gate` (exit 7); local and remote `main` have no engine commit.
//
// ASSUMED INTERFACE (from the CLI doc only; the orchestrator reconciles):
//   - `--project <root>` is accepted after the subcommand by every command, `drive` included.
//   - The card of a run is found by `--args change:<slug>`; its scope is the WOs with `source_change: [<slug>]`
//     (build-engine.md BUILD-7 "Scope guarantee"); a card that passes `card check` needs H1, ## Dentro, ## Fuera with
//     quoted owner citations (same shape as test-build-v2-detect.mjs).
//   - Briefs follow CLI doc 11.1 (`# Unit <id>: <kind>`, `- work orders:`, "Write allowlist (`artifacts`): ...", a final
//     `token: <t>` line); `next` units carry report_path, worktree, token, runtime/model/effort (section 4).
//   - The lease is read at buildPaths().leaseFile (`coordinator`, `epoch`), the standby pid at driveStandbyFile; a
//     released lease means the lease file is absent or `status.lease.live === false`.
//   - The journal line `{actor:"drive", type:"unit_dispatched"|"job_started"|"drive_takeover"}` marks drive activity.
//   - The project ships the real `.pandacorp/merge-queue.sh` template (committed by this test as project overlay).
//   - PANDACORP_DRIVE_POLL_S is passed as a PROPOSED test hook (not in the doc yet); every deadline here also holds with
//     the documented 30 s poll.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, openSync, closeSync, statSync } from "node:fs";
import { copyFile, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "pandacorp-build.mjs");
const FIXDIR = path.join(HERE, "fixtures", "build-v2");
const E2E_WORKER = path.join(FIXDIR, "fake-worker-e2e.mjs");
const MQ_TEMPLATE = path.join(HERE, "..", "templates", "shared", ".pandacorp", "merge-queue.sh");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || process.env.TMPDIR || os.tmpdir();
const SUITE_DEADLINE_MS = 290_000;
const T_START = Date.now();
const SLUG = "add-filter";
const WO_ART = { "wo-01-001": ["src/alpha/list.ts"], "wo-01-002": ["src/alpha/filter.ts"], "wo-02-001": ["src/beta/view.ts"], "wo-02-002": ["src/lib/auth/session.ts"] };
const ALL_WOS = Object.keys(WO_ART);
const IDENT = { GIT_AUTHOR_NAME: "Engine", GIT_AUTHOR_EMAIL: "engine@example.invalid", GIT_COMMITTER_NAME: "Engine", GIT_COMMITTER_EMAIL: "engine@example.invalid", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
const CLAUDE_LIMIT_TEXT = "Claude AI usage limit reached|1762891200\n";
const CODEX_LIMIT_TEXT = "ERROR: You've hit your usage limit. Try again at 3:00 PM.\n";

const { createFixture, testEnv, writeRolloutSample, writeSignalsFile, writeWorkerPlan, DEFAULT_NOW } = await import(pathToFileURL(path.join(FIXDIR, "make-fixture.mjs")).href);
const { buildPaths } = await import(pathToFileURL(path.join(HERE, "..", "runtime", "build", "paths.mjs")).href);
const at = (min) => new Date(Date.parse(DEFAULT_NOW) + min * 60e3).toISOString();

// ---- tiny harness ----------------------------------------------------------------------------------------------------
const results = [];
const check = (sc, name, cond, detail = "") => { results.push({ sc: sc.name, name, ok: !!cond, detail: cond ? "" : String(detail).slice(0, 600) }); return !!cond; };
const txt = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, stepMs = 500) { const end = Date.now() + timeoutMs; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(stepMs); } }
const git = (cwd, args) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: { ...process.env, ...IDENT, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }, stdio: ["ignore", "pipe", "pipe"] }).trim();
const gitTry = (cwd, args) => { try { return git(cwd, args); } catch { return null; } };
const readJson = async (f) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; } };
const readJournal = async (sc) => { try { return (await readFile(sc.p.journalFile, "utf8")).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }); } catch { return []; } };
const alive = (pid) => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const cmdline = (pid) => { try { return execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim(); } catch { return ""; } };
/** Kills a pid only when its command line is the engine (or its caffeinate), so a recycled pid is never hit. */
function killOwned(pid, signal = "SIGKILL") { if (!alive(pid)) return; const c = cmdline(pid); if (/pandacorp-build\.mjs|caffeinate|fake-worker/.test(c)) { try { process.kill(pid, signal); } catch { /* already gone */ } } }
const lc = (a) => (a || []).map((x) => String(x).toLowerCase());
const reflogMain = (root) => (gitTry(root, ["reflog", "show", "--format=%gs", "refs/heads/main"]) || "").split("\n").filter(Boolean);

// ---- the CLI as a subprocess ------------------------------------------------------------------------------------------
function cli(sc, args, { now, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args, "--project", sc.root], { cwd: sc.root, env: { ...sc.env, PANDACORP_NOW: now || sc.now }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", (d) => { out += d; }); child.stderr.on("data", (d) => { err += d; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const lines = out.split("\n").filter((l) => l.trim());
      let json = null; try { json = JSON.parse(lines.at(-1) || "null"); } catch { json = null; }
      const r = { code: code ?? (signal ? 128 : -1), json, lines: lines.length, err: err.slice(-1200) };
      sc.calls.push(`${args.slice(0, 2).join(" ")} -> exit ${r.code} ${out.trim().slice(0, 300)}${err ? ` | stderr: ${err.trim().slice(-300)}` : ""}`);
      if (lines.length !== 1 || !json || typeof json.ok !== "boolean") sc.shape.push(`${args[0]}: ${lines.length} stdout lines, parsed=${!!json}`);
      resolve(r);
    });
  });
}

// ---- project setup ---------------------------------------------------------------------------------------------------
const V2_CARD = `---\ntype: feature\nclass: standard\nstatus: ready\ndate: 2026-11-11\nfrd: frd-01-alpha\norigin: conversation\naffected_frds: [frd-01-alpha, frd-02-beta]\nengine: v2\n---\n\n# Filtro por estado en la lista alpha\n\n## Dentro\n- Filtrar la lista por estado "quiero un filtro por estado"\n- Mostrar la vista beta con sesion "y que la vista beta use la sesion"\n\n## Fuera\n- Orden por fecha, descartado "el orden lo dejamos para despues"\n\n## Criterios de aceptacion\n- AC-01-001.1 (docs/frds/frd-01-alpha/frd.md)\n- AC-01-002.1 (docs/frds/frd-01-alpha/frd.md)\n- AC-02-001.1 (docs/frds/frd-02-beta/frd.md)\n- AC-02-002.1 (docs/frds/frd-02-beta/frd.md)\n\n## Dudas\n- ninguna\n`;

const SANDBOX = await mkdtemp(path.join(SCRATCH_ROOT, "pc-e2e-"));
async function setup(name, { launched = false, plan = {}, rollout = "normal" } = {}) {
  const dir = await mkdtemp(path.join(SANDBOX, `${name}-`));
  const fx = await createFixture({ preset: "card", launched }, { dir });
  const root = fx.root;
  for (const wo of ALL_WOS) {
    const f = path.join(root, "docs", "frds", wo.startsWith("wo-01") ? "frd-01-alpha" : "frd-02-beta", "work-orders", `${wo}.md`);
    await writeFile(f, (await readFile(f, "utf8")).replace(/^dependsOn:(.*)$/m, `dependsOn:$1\nsource_change: [${SLUG}]`));
  }
  await copyFile(MQ_TEMPLATE, path.join(root, ".pandacorp", "merge-queue.sh")); await chmod(path.join(root, ".pandacorp", "merge-queue.sh"), 0o755);
  git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "fixture: e2e overlay (merge-queue, source_change)"]);
  if (launched) git(root, ["push", "-q", "origin", "main"]);
  await writeFile(path.join(root, ".pandacorp", "inbox", "changes", `${SLUG}.md`), V2_CARD);
  const env = testEnv(dir, { ...IDENT, PANDACORP_FAKE_WORKER: E2E_WORKER, PANDACORP_E2E_PUSH_LOG: path.join(dir, "push.log"), PANDACORP_DRIVE_POLL_S: "2" });
  delete env.PANDACORP_OWNER_RELEASE_OK;
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  await writeRolloutSample(env.CODEX_HOME, rollout);
  await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, plan);
  const sc = { name, dir, fx, root, env, now: DEFAULT_NOW, calls: [], shape: [], p: buildPaths(root), pids: new Set(), children: [], baseline: fx.git("rev-parse", "HEAD"), reflog0: reflogMain(root).length };
  sc.fixCrash = await readFile(path.join(root, ".pandacorp", "inbox", "changes", "fix-crash.md"), "utf8");
  return sc;
}

/** Samples the main checkout every 250 ms: records dirty observations and every main SHA seen (Y 3.3.1, BUILD-7). */
function startGuard(sc) {
  sc.guard = { dirtyRuns: 0, persistentDirty: [], mains: new Set([sc.baseline]), busy: false, prevDirty: false };
  sc.guardTimer = setInterval(async () => {
    if (sc.guard.busy) return; sc.guard.busy = true;
    try {
      const st = await new Promise((r) => { const c = spawn("git", ["status", "--porcelain"], { cwd: sc.root, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }); let o = ""; c.stdout.on("data", (d) => { o += d; }); c.on("close", (code) => r(code === 0 ? o.trim() : null)); });
      const m = gitTry(sc.root, ["rev-parse", "refs/heads/main"]); if (m) sc.guard.mains.add(m);
      const dirty = !!st;
      if (dirty && sc.guard.prevDirty) sc.guard.persistentDirty.push(st.slice(0, 300));
      sc.guard.prevDirty = dirty;
    } finally { sc.guard.busy = false; }
  }, 250);
}
const stopGuard = (sc) => clearInterval(sc.guardTimer);

async function startRun(sc, { label, row = 3 } = {}) {
  const d = await cli(sc, ["start", "--detect", "--args", `change:${SLUG}`, "--session-id", `e2e-${sc.name}`, "--session-runtime", "claude"]);
  check(sc, "detect: row 3 on the v2 card, scope = the 4 WOs with its source_change", d.code === 0 && d.json?.row === row && d.json?.scope?.card === SLUG && lc(d.json?.scope?.wos).sort().join() === ALL_WOS.join(), `exit ${d.code} ${txt(d.json)}`);
  if (!d.json?.scope) throw new Error(`detect gave no scope: exit ${d.code} ${txt(d.json)} ${d.err}`);
  await mkdir(path.dirname(sc.p.scopeFile), { recursive: true });
  await writeFile(sc.p.scopeFile, `${JSON.stringify(d.json.scope)}\n`);
  const pf = await cli(sc, ["start", "--preflight", "--row", String(d.json.row), "--scope-json", sc.p.scopeFile, "--label", label, "--session-model", "opus", "--probe-codex"]);
  check(sc, "preflight: ok, preflight.json written, need_from_owner listed", [0, 9].includes(pf.code) && pf.json?.ok !== false && existsSync(sc.p.preflightFile) && Array.isArray(pf.json?.need_from_owner), `exit ${pf.code} ${txt(pf.json)}`);
  const r = await cli(sc, ["start", "--run", "--scope-json", sc.p.scopeFile, "--label", label, "--coordinator", "claude", "--session-model", "opus", "--answers", "{}"]);
  if (r.code !== 0 || !r.json?.run_id) throw new Error(`start --run failed: exit ${r.code} ${txt(r.json)} ${r.err}`);
  sc.runId = r.json.run_id; sc.epoch = r.json.epoch;
  if (r.json.drive?.pid) sc.pids.add(r.json.drive.pid);
  check(sc, "start --run: integration branch from paths.mjs exists, main untouched", gitTry(sc.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${sc.p.integrationBranch(sc.runId)}`]) && gitTry(sc.root, ["rev-parse", "main"]) === sc.baseline, `branch ${sc.p.integrationBranch(sc.runId)}`);
  return { d, pf, r };
}

// ---- the session: serves via:"agent"/"session" units exactly as the lead agent would ---------------------------------
async function unitArtifacts(sc, u) {
  let brief = ""; try { brief = await readFile(u.brief_path, "utf8"); } catch { /* fall back to state */ }
  const allow = brief.match(/Write allowlist[^:]*:\s*(.+)$/m)?.[1] || "";
  const paths = [...allow.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((s) => !s.includes("*") && /[./]/.test(s));
  if (paths.length) return paths;
  let wos = (brief.match(/^-\s*work orders:\s*(.+)$/m)?.[1] || "").split(/[,\s]+/).map((s) => s.replace(/[`[\]]/g, "").toLowerCase()).filter((s) => WO_ART[s]);
  if (!wos.length) { const st = await readJson(sc.p.stateFile); wos = lc(st?.units?.find((x) => x.id === u.unit)?.wos).filter((s) => WO_ART[s]); }
  return wos.flatMap((w) => WO_ART[w]);
}
async function serveUnit(sc, epoch, u) {
  if (u.via === "cli") return;
  if (sc.onServe && (await sc.onServe(u)) === "skip") return;
  const effort = ["minimal", "low", "medium", "high", "xhigh"].includes(u.effort) ? u.effort : "high";
  await mkdir(path.dirname(u.report_path), { recursive: true });
  if (["review", "deferred-review", "audit"].includes(u.kind)) {
    await writeFile(u.report_path, JSON.stringify({ schema: 1, unit: u.unit, token: u.token, reviewer: { runtime: u.runtime, model: u.model, effort }, verdict: "pass", findings: [], probes: [], traceability: [], doubt: null }));
    const r = await cli(sc, ["review-record", "--epoch", String(epoch), "--unit", u.unit, "--token", u.token, "--file", u.report_path]);
    check(sc, `review-record ${u.kind} via ${u.via} accepted`, r.code === 0 && r.json?.verdict === "pass", `exit ${r.code} ${txt(r.json)}`);
    return;
  }
  if (u.kind === "doubt-consult") { check(sc, "no doubt-consult expected on the fixture", false, txt(u)); return; }
  const files = [];
  if (u.kind === "build" || u.kind === "patch") {
    for (const rel of await unitArtifacts(sc, u)) { const f = path.join(u.worktree, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, `${await readFile(f, "utf8").catch(() => "")}export const e2e_agent_${u.unit.replace(/[^A-Za-z0-9]/g, "_")} = 1;\n`); files.push(rel); }
  }
  await writeFile(u.report_path, JSON.stringify({ schema: 1, unit: u.unit, token: u.token, status: "done", summary: `session-served ${u.kind}`, files, verification: [{ command: "fake verify", exit_code: 0, tail: "ok" }], pending: [], doubt: null, diagnosis: null, gate: null, authored_by: { runtime: u.runtime, model: u.model, effort } }));
  const r = await cli(sc, ["report", "--epoch", String(epoch), "--unit", u.unit, "--token", u.token, "--file", u.report_path]);
  check(sc, `report ${u.kind} ${u.unit} committed`, r.code === 0 && r.json?.outcome === "committed", `exit ${r.code} ${txt(r.json)}`);
}

/** The engine-v2.md loop: next -> dispatch/wait/land/done. Returns {stop, next?, land?, finish?}. */
async function sessionLoop(sc, epoch, { beforeNext, maxIter = 120, budgetMs = 150_000 } = {}) {
  const end = Date.now() + budgetMs; sc.lands = sc.lands || [];
  for (let i = 0; i < maxIter && Date.now() < end; i++) {
    if (beforeNext) { const s = await beforeNext(i); if (s) return s; }
    const n = await cli(sc, ["next", "--epoch", String(epoch), "--wait", "15"]);
    if (n.code !== 0 || !n.json) return { stop: `next_exit_${n.code}`, next: n };
    const a = n.json.action;
    if (a === "dispatch") { for (const u of n.json.units || []) await serveUnit(sc, epoch, u); continue; }
    if (a === "wait") continue;
    if (a === "land") {
      const l = await cli(sc, ["land", "--epoch", String(epoch)]); sc.lands.push(l);
      if (l.json?.result === "waiting_gate") return { stop: "waiting_gate", land: l };
      if (l.json?.result === "handback") return { stop: "handback", land: l };
      continue;
    }
    if (a === "done") { const f = await cli(sc, ["finish", "--epoch", String(epoch)]); return { stop: "done", finish: f }; }
    return { stop: a, next: n };
  }
  return { stop: "budget" };
}

/** Checks of a landed card run: one ff landing on main, metadata commit, WOs VERIFIED on main, card archived. */
async function checkLanded(sc, label) {
  const tip = gitTry(sc.root, ["rev-parse", "main"]);
  const newLog = reflogMain(sc.root).slice(0, Math.max(0, reflogMain(sc.root).length - sc.reflog0));
  check(sc, `${label}: main moved exactly once, by a fast-forward merge (the merge-queue landing)`, tip !== sc.baseline && newLog.length === 1 && /merge|fast-forward/i.test(newLog[0] || ""), `reflog new: ${txt(newLog)}`);
  const body = gitTry(sc.root, ["log", "-1", "--format=%B", "main"]) || "";
  check(sc, `${label}: landing metadata commit is main's tip with trailer Change: ${SLUG}`, new RegExp(`^Change:\\s*${SLUG}\\s*$`, "m").test(body), body.slice(0, 400));
  const others = (gitTry(sc.root, ["log", "--format=%H %B%x00", `${sc.baseline}..main~1`]) || "").split("\0").filter((s) => /Change:/m.test(s.split("\n").slice(1).join("\n")));
  check(sc, `${label}: no other landed commit carries a Change: trailer`, others.length === 0, txt(others));
  const statuses = ALL_WOS.map((w) => (gitTry(sc.root, ["show", `main:docs/frds/${w.startsWith("wo-01") ? "frd-01-alpha" : "frd-02-beta"}/work-orders/${w}.md`]) || "").match(/^implementation_status:\s*(\S+)/m)?.[1]);
  check(sc, `${label}: all 4 WOs VERIFIED on main`, statuses.every((s) => s === "VERIFIED"), txt(statuses));
  check(sc, `${label}: status.yaml on main carries last_green_sha`, /^last_green_sha:\s*['"]?[0-9a-f]{40}/m.test(gitTry(sc.root, ["show", "main:.pandacorp/status.yaml"]) || ""), "");
  const done = path.join(sc.root, ".pandacorp", "inbox", "changes", "done", `${SLUG}.md`);
  const doneText = existsSync(done) ? await readFile(done, "utf8") : "";
  check(sc, `${label}: card archived after landing (done/, status done, shipped_sha), gone from changes/`, /^status:\s*done/m.test(doneText) && /^shipped_sha:\s*['"]?[0-9a-f]{7,40}/m.test(doneText) && !existsSync(path.join(sc.root, ".pandacorp", "inbox", "changes", `${SLUG}.md`)), doneText.slice(0, 300));
  check(sc, `${label}: the out-of-scope card fix-crash is untouched`, (await readFile(path.join(sc.root, ".pandacorp", "inbox", "changes", "fix-crash.md"), "utf8").catch(() => "")) === sc.fixCrash, "");
}
function checkGuard(sc, label) {
  check(sc, `${label}: main checkout never dirty during the run`, sc.guard.persistentDirty.length === 0, txt(sc.guard.persistentDirty.slice(0, 3)));
}
const lease = (sc) => readJson(sc.p.leaseFile);
const standbyPid = async (sc) => (await readJson(sc.p.driveStandbyFile))?.pid || null;
async function driveLogTail(sc) { try { return (await readFile(sc.p.driveLogFile, "utf8")).slice(-800); } catch { return "(no drive.log)"; } }
async function cleanup(sc) {
  stopGuard(sc);
  for (const c of sc.children) if (c.exitCode === null) { try { c.kill("SIGKILL"); } catch { /* gone */ } }
  const sb = await standbyPid(sc); if (sb) sc.pids.add(sb);
  try { const cp = Number((await readFile(sc.p.driveCaffeinatePidFile, "utf8")).trim()); if (cp) sc.pids.add(cp); } catch { /* none */ }
  for (const pid of sc.pids) killOwned(pid);
}

// ---- scenarios -------------------------------------------------------------------------------------------------------
async function scenarioS1() {
  const sc = await setup("s1-unlaunched");
  try {
    startGuard(sc);
    const { r } = await startRun(sc, { label: "claude" });
    check(sc, "start --run: drive armed in standby, prepush not_needed (unlaunched)", r.json.drive?.armed === true && r.json.prepush === "not_needed", txt(r.json));
    const res = await sessionLoop(sc, sc.epoch);
    check(sc, "session loop reaches done and finish succeeds", res.stop === "done" && res.finish?.code === 0, `${res.stop} ${txt(res.next?.json || res.land?.json || res.finish?.json)}`);
    check(sc, "land results stay within running|landed (merge-queue exit 0)", (sc.lands || []).length > 0 && sc.lands.every((l) => ["running", "landed"].includes(l.json?.result)), txt((sc.lands || []).map((l) => l.json)));
    stopGuard(sc);
    check(sc, "main took exactly two values during the run (baseline, landed tip)", sc.guard.mains.size <= 2, txt([...sc.guard.mains]));
    checkGuard(sc, "S1"); await checkLanded(sc, "S1");
    const st = await cli(sc, ["status"]);
    check(sc, "status after finish: finished, lease released", st.json?.status === "finished" && (!existsSync(sc.p.leaseFile) || st.json?.lease?.live === false), txt(st.json));
    const ev = await readFile(sc.env.PANDACORP_EVENTS_FILE, "utf8").catch(() => "");
    check(sc, "events go to the test events file only (BuildLaunch present)", /BuildLaunch/.test(ev), ev.slice(0, 200));
  } finally { await cleanup(sc); }
  return sc;
}

async function scenarioA() {
  const sc = await setup("a-handoff95");
  try {
    startGuard(sc);
    await startRun(sc, { label: "codex" });
    const E = sc.epoch;
    const res = await sessionLoop(sc, E, {
      beforeNext: async () => {
        const st = await readJson(sc.p.stateFile);
        if (!(st?.units || []).some((u) => ["integrated", "reviewing", "verified"].includes(u.state))) return null;
        const q = await cli(sc, ["quota", "record", "--provider", "claude", "--five-hour", "96", "--weekly", "40", "--epoch", String(E)]);
        check(sc, "quota record Claude 96 % (fixture reading) accepted", q.code === 0 && q.json?.reading?.five_hour_pct === 96, txt(q.json));
        const n = await cli(sc, ["next", "--epoch", String(E)]);
        return { stop: "handoff_probe", next: n };
      },
    });
    check(sc, "next returns action handoff at Claude >= 95 % with the standby alive", res.next?.json?.action === "handoff", `${res.stop} ${txt(res.next?.json)}`);
    const h = await cli(sc, ["handoff", "--epoch", String(E), "--reason", "quota95"]);
    check(sc, "handoff writes handoff.json", h.code === 0 && !!h.json?.handoff_path, txt(h.json));
    const took = await waitFor(async () => { const l = await lease(sc); return l?.coordinator === "drive" && l.epoch === E + 1 ? l : null; }, 75_000);
    check(sc, "trigger (a): drive took over (epoch+1, lease coordinator drive, same run)", took && took.run_id === sc.runId, `${txt(await lease(sc))} ${await driveLogTail(sc)}`);
    check(sc, "handoff.json consumed by drive", !existsSync(sc.p.handoffFile), "");
    const loser = await cli(sc, ["next", "--epoch", String(E)]);
    check(sc, "the session (loser of the transfer) gets exit 3 on next", loser.code === 3, `exit ${loser.code} ${txt(loser.json)}`);
    const fin = await waitFor(async () => { const s = await cli(sc, ["status"]); return s.json?.status === "finished" ? s : null; }, Math.max(30_000, SUITE_DEADLINE_MS - (Date.now() - T_START) - 20_000), 3000);
    check(sc, "drive continues the run to landing and finish", !!fin, `${txt((await cli(sc, ["status"])).json)} ${await driveLogTail(sc)}`);
    stopGuard(sc); checkGuard(sc, "A");
    if (fin) await checkLanded(sc, "A");
  } finally { await cleanup(sc); }
  return sc;
}

async function scenarioB() {
  const sc = await setup("b-trigger-b");
  try {
    startGuard(sc);
    await startRun(sc, { label: "claude" });
    const E = sc.epoch;
    const n = await cli(sc, ["next", "--epoch", String(E)]);
    const agentUnits = (n.json?.units || []).filter((u) => u.via !== "cli");
    check(sc, "label claude: next dispatches Claude (agent) build units", n.json?.action === "dispatch" && agentUnits.length > 0, txt(n.json));
    const wdir = sc.p.codexWorkerDir("w-e2e-codex-limit");
    await mkdir(wdir, { recursive: true });
    await writeFile(path.join(wdir, "state.json"), JSON.stringify({ pid: 999999, cwd: sc.root })); await writeFile(path.join(wdir, "last.md"), CODEX_LIMIT_TEXT); await writeFile(path.join(wdir, "codex.log"), CODEX_LIMIT_TEXT); await writeFile(path.join(wdir, "exit"), "1\n");
    await sleep(32_000);
    const l0 = await lease(sc);
    check(sc, "DEC-3: a Codex limit text in codex-workers/ does not trigger the Claude relay", l0?.coordinator !== "drive" && l0?.epoch === E, txt(l0));
    if (!agentUnits.length) throw new Error("no agent unit to carry the Claude limit text");
    await mkdir(path.dirname(agentUnits[0].report_path), { recursive: true });
    await writeFile(agentUnits[0].report_path, CLAUDE_LIMIT_TEXT);
    const took = await waitFor(async () => { const l = await lease(sc); return l?.coordinator === "drive" && l.epoch === E + 1 ? l : null; }, 45_000);
    check(sc, "trigger (b): the Claude-written limit text makes drive take over (epoch+1)", !!took, `${txt(await lease(sc))} ${await driveLogTail(sc)}`);
    const j = await readJournal(sc);
    check(sc, "journal records drive_takeover", j.some((e) => e.type === "drive_takeover"), "");
    const busy = await waitFor(async () => (await readJournal(sc)).some((e) => e.actor === "drive" && ["unit_dispatched", "job_started"].includes(e.type)), 45_000);
    check(sc, "drive dispatches work after the takeover", !!busy, await driveLogTail(sc));
    const dpid = await standbyPid(sc);
    check(sc, "drive process alive before kill -9", alive(dpid), `pid ${dpid}`);
    killOwned(dpid, "SIGKILL");
    check(sc, "kill -9 drive: process gone", !!(await waitFor(() => !alive(dpid), 5000, 100)), `pid ${dpid}`);
    const rs = await cli(sc, ["start", "--resume", "--coordinator", "claude", "--session-model", "opus"]);
    check(sc, "--resume transfers the run back (same run, epoch+1, drive re-armed with a new pid)", rs.code === 0 && rs.json?.run_id === sc.runId && rs.json?.epoch === E + 2 && rs.json?.drive?.armed === true && rs.json?.drive?.pid !== dpid, `exit ${rs.code} ${txt(rs.json)}`);
    if (rs.json?.drive?.pid) sc.pids.add(rs.json.drive.pid);
    const old = await cli(sc, ["next", "--epoch", String(E)]);
    check(sc, "the pre-takeover epoch stays fenced (exit 3)", old.code === 3, `exit ${old.code}`);
    const res = await sessionLoop(sc, rs.json?.epoch ?? E + 2, { budgetMs: 120_000 });
    check(sc, "after --resume the session finishes the run", res.stop === "done" && res.finish?.code === 0, `${res.stop} ${txt(res.next?.json || res.land?.json || res.finish?.json)}`);
    stopGuard(sc); checkGuard(sc, "B");
    if (res.stop === "done") await checkLanded(sc, "B");
  } finally { await cleanup(sc); }
  return sc;
}

async function scenarioC() {
  const sc = await setup("c-trigger-c");
  try {
    startGuard(sc);
    const { r } = await startRun(sc, { label: "codex" });
    const E = sc.epoch;
    const p1 = r.json.drive?.pid || (await standbyPid(sc));
    // Trigger (c) compares the drive clock with the lease's renewed_at. The clock jump is taken from the lease on disk so
    // the scenario exercises (c) even when the lease is stamped with the wall clock; that stamping is pinned separately.
    const l1 = await lease(sc);
    check(sc, "PANDACORP_NOW replaces the wall clock in the lease (renewed_at == the injected instant)", l1?.renewed_at === DEFAULT_NOW, `renewed_at ${l1?.renewed_at} vs PANDACORP_NOW ${DEFAULT_NOW} (CLI doc 2.7: PANDACORP_NOW replaces the wall clock everywhere)`);
    const base = Math.max(Date.parse(DEFAULT_NOW), Date.parse(l1?.renewed_at || DEFAULT_NOW));
    const atC = (min) => new Date(base + min * 60e3).toISOString();
    killOwned(p1, "SIGKILL"); await waitFor(() => !alive(p1), 5000, 100);
    const logFd = openSync(path.join(sc.dir, "drive-c.log"), "a");
    const child = spawn(process.execPath, [CLI, "drive", "--standby", "--run", sc.runId, "--project", sc.root], { cwd: sc.root, env: { ...sc.env, PANDACORP_NOW: atC(31) }, detached: true, stdio: ["ignore", logFd, logFd] });
    closeSync(logFd); sc.children.push(child); sc.pids.add(child.pid);
    const exited = new Promise((res) => child.on("exit", (code, signal) => res({ code, signal })));
    const took = await waitFor(async () => { const l = await lease(sc); return l?.coordinator === "drive" && l.epoch === E + 1 ? l : null; }, 75_000);
    check(sc, "trigger (c): no renewal for 30 min + pending work + Claude unknown -> drive takes over", !!took, `${txt(await lease(sc))} ${await driveLogTail(sc)}`);
    const loser = await cli(sc, ["next", "--epoch", String(E)], { now: atC(31) });
    check(sc, "the silent session (loser) gets exit 3", loser.code === 3, `exit ${loser.code} ${txt(loser.json)}`);
    const rs = await cli(sc, ["start", "--resume", "--coordinator", "claude", "--session-model", "opus"], { now: atC(32) });
    check(sc, "return to the session: --resume transfers without confirmation (epoch+1)", rs.code === 0 && rs.json?.run_id === sc.runId && rs.json?.epoch === E + 2, `exit ${rs.code} ${txt(rs.json)}`);
    if (rs.json?.drive?.pid) sc.pids.add(rs.json.drive.pid);
    const ex = await Promise.race([exited, sleep(70_000).then(() => null)]);
    check(sc, "the drive process (loser of the return) exits at its next phase 2", !!ex && (ex.code === 3 || ex.code === 0), `${txt(ex)} ${await driveLogTail(sc)}`);
    const l2 = await lease(sc);
    check(sc, "lease back to the session coordinator", l2?.coordinator === "session" && l2?.epoch === E + 2, txt(l2));
    sc.now = atC(32);
    const res = await sessionLoop(sc, rs.json?.epoch ?? E + 2, { budgetMs: 100_000 });
    check(sc, "the session finishes the run it took back", res.stop === "done" && res.finish?.code === 0, `${res.stop} ${txt(res.next?.json || res.land?.json || res.finish?.json)}`);
    stopGuard(sc); checkGuard(sc, "C");
  } finally { await cleanup(sc); }
  return sc;
}

async function scenarioQ() {
  const sc = await setup("q-both-quota", { rollout: "pct98" });
  try {
    startGuard(sc);
    const { pf, r } = await startRun(sc, { label: "codex" });
    check(sc, "preflight: drive_line_es set with Codex >= stop threshold at start", typeof pf.json?.announce?.drive_line_es === "string" && pf.json.announce.drive_line_es.length > 0, txt(pf.json?.announce));
    const E = sc.epoch; const sb = r.json.drive?.pid || (await standbyPid(sc));
    const q = await cli(sc, ["quota", "record", "--provider", "claude", "--five-hour", "92", "--weekly", "30", "--epoch", String(E)]);
    check(sc, "quota record Claude 92 %", q.code === 0, txt(q.json));
    const n = await cli(sc, ["next", "--epoch", String(E)]);
    check(sc, "both companies >= 90 % -> next returns paused-quota", n.code === 0 && n.json?.action === "paused-quota", `exit ${n.code} ${txt(n.json)}`);
    const st = await cli(sc, ["status"]);
    check(sc, "paused-quota arrives applied: status paused, lease released", st.json?.status === "paused" && (!existsSync(sc.p.leaseFile) || st.json?.lease?.live === false), `${txt(st.json)} lease=${txt(await lease(sc))}`);
    const again = await cli(sc, ["next", "--epoch", String(E)]);
    check(sc, "after the release the old epoch is fenced (exit 3)", again.code === 3, `exit ${again.code} ${txt(again.json)}`);
    check(sc, "the drive standby exits on a non-active status", !!(await waitFor(() => !alive(sb), 45_000)), `pid ${sb} ${cmdline(sb)}`);
    stopGuard(sc); checkGuard(sc, "Q");
    check(sc, "main untouched", gitTry(sc.root, ["rev-parse", "main"]) === sc.baseline && reflogMain(sc.root).length === sc.reflog0, "");
  } finally { await cleanup(sc); }
  return sc;
}

async function scenarioL() {
  const sc = await setup("l-launched", { launched: true, plan: { "kind:build": { _push: "main" } } });
  try {
    startGuard(sc);
    const { r } = await startRun(sc, { label: "codex" });
    const hooks = gitTry(sc.root, ["rev-parse", "--path-format=absolute", "--git-path", "hooks"]);
    const hook = hooks ? await readFile(path.join(hooks, "pre-push"), "utf8").catch(() => "") : "";
    check(sc, "launched: start --run installs the untracked pre-push hook and arms drive", r.json.prepush === "installed" && /pandacorp-pre-push v1/.test(hook) && r.json.drive?.armed === true && !gitTry(sc.root, ["ls-files", ".pandacorp/hooks/pre-push"]), `${txt(r.json)} hook=${hook.length}`);
    const res = await sessionLoop(sc, sc.epoch);
    const journal = await readJournal(sc);
    const mq21 = journal.some((e) => (e.type === "job_finished" && e.data?.exit === 21) || (e.type === "gate" && e.data?.exit === 21));
    const viaLand = res.stop === "waiting_gate" && res.land?.code === 7 && res.land?.json?.mq_exit === 21;
    const viaNext = res.stop === "waiting-owner" && mq21;
    check(sc, "land: merge-queue exit 21 -> waiting_gate (land exit 7, or harvested by next as waiting-owner)", viaLand || viaNext, `${res.stop} exit ${res.land?.code ?? res.next?.code} ${txt(res.land?.json || res.next?.json)} mq21-in-journal=${mq21}`);
    const pushes = (await readFile(sc.env.PANDACORP_E2E_PUSH_LOG, "utf8").catch(() => "")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    check(sc, "pre-push rejects every fake worker push to main", pushes.length > 0 && pushes.every((p) => p.exit !== 0), txt(pushes));
    check(sc, "remote main unchanged (no worker push, no engine push)", git(sc.fx.remote, ["rev-parse", "main"]) === sc.baseline, "");
    check(sc, "local main has no engine commit and no reflog entry", gitTry(sc.root, ["rev-parse", "main"]) === sc.baseline && reflogMain(sc.root).length === sc.reflog0, txt(reflogMain(sc.root).slice(0, 3)));
    const st = await cli(sc, ["status"]);
    check(sc, "the run waits on the production gate: status waiting_gate, units waiting_gate, lease released", st.json?.status === "waiting_gate" && (st.json?.units_by_state?.waiting_gate || 0) > 0 && (!existsSync(sc.p.leaseFile) || st.json?.lease?.live === false || st.json?.lease === null), txt(st.json));
    const late = await cli(sc, ["next", "--epoch", String(sc.epoch)]);
    check(sc, "after the terminal waiting-owner the old epoch is fenced (exit 3)", late.code === 3, `exit ${late.code} ${txt(late.json)}`);
    check(sc, "card not archived while waiting the gate", existsSync(path.join(sc.root, ".pandacorp", "inbox", "changes", `${SLUG}.md`)) && !existsSync(path.join(sc.root, ".pandacorp", "inbox", "changes", "done", `${SLUG}.md`)), "");
    stopGuard(sc); checkGuard(sc, "L");
  } finally { await cleanup(sc); }
  return sc;
}

// ---- runner ----------------------------------------------------------------------------------------------------------
const realEvents = path.join(os.homedir(), ".claude", "dashboard-events.ndjson");
const realCodex = path.join(os.homedir(), ".codex");
const realHost = path.join(os.homedir(), ".pandacorp", "host", "h-slots");
const mtime = (f) => { try { return statSync(f).mtimeMs; } catch { return null; } };
const size = (f) => { try { return statSync(f).size; } catch { return 0; } };
// The real events file is appended by every live Claude Code session on this Mac, so it is checked by CONTENT: nothing
// appended during the suite may come from a fixture project (basename "project") or mention the sandbox.
const before = { evSize: size(realEvents), codex: mtime(realCodex), host: mtime(realHost) };
const SCEN = [["S1", scenarioS1], ["A", scenarioA], ["B", scenarioB], ["C", scenarioC], ["Q", scenarioQ], ["L", scenarioL]];
const only = process.env.PANDACORP_E2E_ONLY ? process.env.PANDACORP_E2E_ONLY.split(",") : null;
const scs = [];
if (!existsSync(CLI)) {
  for (const [id] of SCEN) results.push({ sc: id, name: "CLI present", ok: false, detail: `CLI missing: ${CLI} does not exist (Wave D01 not assembled)` });
} else {
  const deadline = sleep(SUITE_DEADLINE_MS).then(() => "deadline");
  const runs = SCEN.filter(([id]) => !only || only.includes(id)).map(([id, fn]) => fn().then((sc) => { scs.push(sc); }, (e) => { results.push({ sc: id, name: "scenario completed without throwing", ok: false, detail: String(e?.stack || e).slice(0, 800) }); }));
  const outcome = await Promise.race([Promise.all(runs).then(() => "done"), deadline]);
  if (outcome === "deadline") results.push({ sc: "suite", name: `suite finished within ${SUITE_DEADLINE_MS / 1000} s`, ok: false, detail: "deadline hit" });
}
const appended = await (async () => { try { const fh = await import("node:fs/promises").then((m) => m.open(realEvents, "r")); const n = Math.max(0, size(realEvents) - before.evSize); const buf = Buffer.alloc(n); await fh.read(buf, 0, n, before.evSize); await fh.close(); return buf.toString("utf8"); } catch { return ""; } })();
const leaked = appended.split("\n").filter((l) => l.includes(SANDBOX) || /"project"\s*:\s*"project"/.test(l));
// ~/.codex is written by the owner's live Codex app too, so it is checked for fixture artifacts only: a fake-codex rollout
// or a fixture rollout landing in a real sessions day dir means CODEX_HOME was ignored.
const codexLeaks = [];
for (const iso of [new Date(T_START).toISOString(), DEFAULT_NOW]) {
  const d = new Date(iso); const day = path.join(realCodex, "sessions", String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0"));
  for (const f of await readdir(day).catch(() => [])) if (/fake|fixture/i.test(f) && (mtime(path.join(day, f)) || 0) >= T_START - 1000) codexLeaks.push(path.join(day, f));
}
const after = { host: mtime(realHost) };
results.push({ sc: "suite", name: "no event reached the real events file, no fixture rollout in ~/.codex, real host slot dir untouched", ok: leaked.length === 0 && codexLeaks.length === 0 && after.host === before.host, detail: txt({ leaked: leaked.slice(0, 2), codexLeaks, before, after }) });
for (const sc of scs) results.push({ sc: sc.name, name: "every CLI call printed exactly one JSON line with ok", ok: sc.shape.length === 0, detail: txt(sc.shape.slice(0, 5)) });

let failed = 0;
for (const r of results) { if (!r.ok) failed++; (r.ok ? console.log : console.error)(`${r.ok ? "PASS" : "FAIL"}  [${r.sc}] ${r.name}${r.ok ? "" : `: ${r.detail}`}`); }
if (failed) for (const sc of scs) if (results.some((r) => r.sc === sc.name && !r.ok)) console.error(`\n--- ${sc.name} last CLI calls ---\n${sc.calls.slice(-12).join("\n")}`);
if (!process.env.PANDACORP_E2E_KEEP) await rm(SANDBOX, { recursive: true, force: true }); else console.error(`sandbox kept: ${SANDBOX}`);
console.log(`\nRESULT test-build-v2-e2e: ${results.length - failed}/${results.length} passed, ${failed} failed (${Math.round((Date.now() - T_START) / 1000)} s)`);
process.exit(failed ? 1 : 0);
