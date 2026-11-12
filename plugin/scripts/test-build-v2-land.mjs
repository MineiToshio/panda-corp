#!/usr/bin/env node
// test-build-v2-land.mjs: T-C05, the official test of plugin/runtime/build/land.mjs (integration branch -> main, the production gate).
// Written from the contracts only: PLAN 3.16 A1/A3/A13/A15, RESOLUTIONS D2/D24, plugin/docs/build-engine-cli.md 3.11 (+ 2.3, 2.5, 6, 7),
// factory/standards/build-engine.md BUILD-13. The implementation file was NOT read. Run: node plugin/scripts/test-build-v2-land.mjs
//
// ASSUMED INTERFACE (the docs fix no export names for land.mjs; the orchestrator reconciles test and module):
//   land.mjs        export async function land({project, epoch}, deps) -> output object
//                   output = {result: "landed"|"waiting_gate"|"handback"|"nothing_to_land"|"running", reason, mq_exit, sha, notes_es?, exit?}
//                   (the CLI doc 3.11 output without the {ok, cmd} envelope; `exit` is OPTIONAL: when present it must be the doc's
//                   `land` exit column: 0 / 6 handback / 7 waiting_gate). The dispatcher maps result -> exit; errors are thrown with a
//                   `code` (FENCE/QUIESCED with error.phase 1|2 as fencedTwoPhase stamps it).
//                   The harvest of a finished land job happens when `land` is called again (doc 3.11 phase 1 / step 5); there is no
//                   separate harvest export under test. A second consecutive mq exit 20 is an "engine failure" (exit 8): accepted as
//                   a rejection with code ENGINE_FAILURE/ROLLBACK_FAILED/no code, or a returned {exit: 8 | code: "ENGINE_FAILURE" | result: "engine_failure"}.
//   deps (last argument, injected): {env, exec, spawnJob, pollJob, jobs: {spawnJob, pollJob}}
//        env     the caller's environment (PANDACORP_* hooks + git identity). Default would be process.env.
//        exec    async (cmd, args, {cwd, env, input}) -> {code, stdout, stderr}  (same shape as fsx.defaultExec); runs real git here.
//        spawnJob(spec) with spec = {kind: "land", cmd: string[] | string, cwd, hSlot: boolean, env?: object, id?: string}; returns {id, pid, state: "running"}.
//                  The fake runs `cmd` in `cwd` with env = spec.env (merged over PATH) when given, else deps.env. The job is HELD until the test releases it,
//                  so the first `land` call can only answer "running".
//        pollJob(id) -> {state: "running"|"done"|"dead", exit: number|null}; the fake also writes build/jobs/<id>/{cmd.json,out.log,exit}.
//   Integration worktree = buildPaths(project).integrationWorktree on branch lane/<run_id>; the merge-queue is the project's
//   `.pandacorp/merge-queue.sh` (a STUB written by this test, exit code selectable) run with cwd = the integration worktree.
//   The landed `sha` (output, batch_landed.data.sha, card shipped_sha) = the tip of `main` after the merge-queue succeeded.
//   unit-level effects: after a landing build units are `landed`; on exit 21 build units are `waiting_gate` with waiting_gate:"production"
//   and journal `waiting_gate {unit, kind:"production"}`; on exit 11 a `patch` unit u-patch-<frd> (A13) is queued with attempt = max attempt of the
//   run's build units + 1 and a `patch` journal event.
//   INFERRED (not literal in the docs, flagged so the orchestrator can overrule): (1) a landing leaves the card open when a unit of the batch is
//   parked or the run is a giant tranche < of (the card is not complete); (2) a retried landing (mq exit 12/14/20 then again) reuses the existing
//   metadata commit while `main` did not move (no second `Change:` commit); (3) a mismatch of test_hashes/probe_hashes (relative path -> sha256 of
//   the file) is refused (throw with code EVIDENCE/INVALID_INPUT/GATE_RED/INVALID_STATE, or a handback result) before any job is spawned;
//   (4) mq exit 20 counters reset on any other mq outcome; (5) a dead land job and an unknown mq exit code are never reported as landed.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, "..", "runtime", "build");
const RUNTIME = path.join(HERE, "..", "runtime");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const NOW = "2026-11-11T12:00:00.000Z";
const SHA40 = /^[0-9a-f]{40}$/;

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// Isolate this process: git identity for the module's own commits, and every hook on throwaway paths (nothing touches the real home).
const SANDBOX = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c05-sandbox-"));
Object.assign(process.env, {
  GIT_AUTHOR_NAME: "Engine", GIT_AUTHOR_EMAIL: "engine@example.invalid", GIT_COMMITTER_NAME: "Engine", GIT_COMMITTER_EMAIL: "engine@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", HOME: path.join(SANDBOX, "home"), CODEX_HOME: path.join(SANDBOX, "codex-home"),
  PANDACORP_HOST_DIR: path.join(SANDBOX, "host"), PANDACORP_EVENTS_FILE: path.join(SANDBOX, "events.ndjson"), PANDACORP_CODEX_EVENTS_FILE: path.join(SANDBOX, "codex-events.ndjson"),
  PANDACORP_ORCHESTRATE_DIR: path.join(SANDBOX, "orchestrate"), PANDACORP_NOTIFY: "off", PANDACORP_NOW: NOW,
});
delete process.env.PANDACORP_OWNER_RELEASE_OK;

// ---- loading: a missing module or export becomes a clear failure, never an obscure crash ----------------------------
const loaded = {};
const need = async (file, name) => {
  if (!(file in loaded)) { try { loaded[file] = await import(pathToFileURL(path.join(BUILD, file)).href); } catch (e) { loaded[file] = { __error: e }; } }
  const mod = loaded[file];
  if (mod.__error) throw new Error(`module plugin/runtime/build/${file} cannot be imported: ${String(mod.__error.message).split("\n")[0]}`);
  if (typeof mod[name] === "undefined") throw new Error(`plugin/runtime/build/${file} does not export "${name}" (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`);
  return mod[name];
};
const buildState = () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);
const fixtures = () => import(pathToFileURL(FIXTURES).href);

// ---- git helpers ---------------------------------------------------------------------------------------------------
const git = (cwd, args, input) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }).trim();
const gitTry = (cwd, args) => { try { return { ok: true, out: git(cwd, args) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; } };
const trailerLines = (cwd, rev) => git(cwd, ["interpret-trailers", "--parse"], git(cwd, ["log", "-1", "--format=%B", rev])).split("\n").filter(Boolean);

// ---- the stub merge-queue (the real template is never used) --------------------------------------------------------
// Control file: first line = "<exit>[:opt,opt]" (consumed when more lines follow, else it repeats). Options: ff (ff-merge the worktree tip
// into main, as a landing), rebased (main moves during the queue; the queue rebases the branch in place then ff-merges, like the real one, so every SHA changes), reconcile
// (move the card to changes/done/ without shipped_sha, as the DR-147 reconciler does), reconcilesha (same, with a shipped_sha already set).
const stubScript = ({ ctl, log, main }) => `#!/bin/bash
CTL='${ctl}'; LOG='${log}'; MAIN='${main}'
line="$(head -n 1 "$CTL")"; rest="$(tail -n +2 "$CTL")"
[ -n "$rest" ] && printf '%s\\n' "$rest" > "$CTL"
code="\${line%%:*}"; opts=""; [ "$line" != "$code" ] && opts="\${line#*:}"
head_sha="$(git rev-parse HEAD)"
dirty="$(git status --porcelain | wc -l | tr -d ' ')"
printf '{"cwd":"%s","branch":"%s","head":"%s","dirty":%s,"owner_ok":"%s","line":"%s"}\\n' "$(pwd -P)" "$(git rev-parse --abbrev-ref HEAD)" "$head_sha" "$dirty" "\${PANDACORP_OWNER_RELEASE_OK-UNSET}" "$line" >> "$LOG"
case ",$opts," in *,ff,*) git -C "$MAIN" merge --ff-only "$head_sha" >/dev/null 2>&1 || exit 99;; esac
case ",$opts," in *,rebased,*)
  git -C "$MAIN" commit --allow-empty -q -m "parallel session lands first" || exit 99
  git rebase main >/dev/null 2>&1 || exit 99
  git -C "$MAIN" merge --ff-only "$(git rev-parse HEAD)" >/dev/null 2>&1 || exit 99;; esac
CARD="$MAIN/.pandacorp/inbox/changes/add-filter.md"; DONE="$MAIN/.pandacorp/inbox/changes/done"
case ",$opts," in *,reconcile,*) if [ -f "$CARD" ]; then mkdir -p "$DONE"; sed 's/^status: .*/status: done/' "$CARD" > "$DONE/add-filter.md"; rm -f "$CARD"; fi;; esac
case ",$opts," in *,reconcilesha,*) if [ -f "$CARD" ]; then mkdir -p "$DONE"; sed 's/^status: .*/status: done\\\nshipped_sha: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/' "$CARD" > "$DONE/add-filter.md"; rm -f "$CARD"; fi;; esac
exit "$code"
`;

// ---- fake job layer (the injected spawner; the job is held until released) -----------------------------------------
function makeJobLayer(w) {
  const table = new Map(); const spawns = []; let n = 0;
  const childEnv = (spec) => (spec.env ? { PATH: w.env.PATH, ...spec.env } : w.env);
  // jobs.mjs real signatures (R6): spawnJob(input, deps) and pollJob(project, job, deps); env travels in deps, h_slot derives from kind.
  const spawnJob = async (input = {}, deps = {}) => {
    const id = input.jobId ?? `job-land-${++n}`;
    const spec = { ...input, id, env: deps.env, hSlot: input.kind === "g2" };
    spawns.push({ ...spec, childEnv: childEnv(spec) });
    table.set(id, { spec, state: "running", exit: null, pid: 910000 + n });
    return { id, kind: input.kind, unit: null, frd: null, pid: 910000 + n, cwd: input.cwd, h_slot: input.kind === "g2", started_at: NOW, state: "running", exit: null, worker_id: null };
  };
  const pollJob = async (_project, job) => { const j = table.get(job.id); if (!j) return { state: "dead", exit: null }; return { state: j.state, exit: j.exit }; };
  const runPending = async () => {
    for (const [id, j] of table) {
      if (j.state !== "running") continue;
      const cmd = [].concat(j.spec.cmd ?? []);
      const r = typeof j.spec.cmd === "string" ? spawnSync("/bin/sh", ["-c", j.spec.cmd], { cwd: j.spec.cwd, env: childEnv(j.spec), encoding: "utf8" })
        : spawnSync(cmd[0], cmd.slice(1), { cwd: j.spec.cwd, env: childEnv(j.spec), encoding: "utf8" });
      j.state = "done"; j.exit = r.status ?? 128;
      await mkdir(w.p.jobDir(id), { recursive: true });
      await writeFile(w.p.jobOutFile(id), `${w.gateLog ?? ""}${r.stdout || ""}${r.stderr || ""}`); await writeFile(w.p.jobExitFile(id), `${j.exit}\n`);
    }
  };
  const kill = (id) => { const j = table.get(id); if (j) { j.state = "dead"; j.exit = null; } };
  return { spawnJob, pollJob, runPending, kill, spawns, table };
}
function makeExec(w) {
  const calls = []; const hooks = [];
  const exec = async (cmd, args = [], opts = {}) => {
    const rec = { cmd, args: [...args], cwd: opts.cwd, env: opts.env }; calls.push(rec);
    for (const h of hooks) await h(rec);
    const r = spawnSync(cmd, args, { cwd: opts.cwd, env: { ...w.env, ...(opts.env || {}) }, encoding: "utf8", input: opts.input, maxBuffer: 64 << 20 });
    return { code: r.status ?? 127, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };
  return { exec, calls, hooks };
}

// ---- the world: launched fixture + lease + integration worktree + state + journal ---------------------------------------
const baseUnit = (over = {}) => ({
  id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001", "WO-01-002"], frd: "frd-01-alpha", chain: "c-wo-01-001", zone: "none", risk_rules: [],
  state: "verified", attempt: 1, token_hash: null, worker: null, worktree: null, branch: null, depends_on: [], pending_answer: null,
  parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const woPath = (frd, wo) => `docs/frds/${frd}/work-orders/${wo.toLowerCase()}.md`;
const setWoStatus = async (root, frd, wo, status) => {
  const f = path.join(root, woPath(frd, wo)); const text = await readFile(f, "utf8");
  await writeFile(f, text.replace(/^implementation_status:.*$/m, `implementation_status: ${status}`));
};
const IDENT = { GIT_AUTHOR_NAME: "Engine", GIT_AUTHOR_EMAIL: "engine@example.invalid", GIT_COMMITTER_NAME: "Engine", GIT_COMMITTER_EMAIL: "engine@example.invalid", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C" };

/**
 * Builds one landing scenario. Options: runId, scopeCard (default "add-filter", null = no card), size, tranche, phase, secondFrd ("none" | "parked"),
 * onlyParked, extraUnits (replaces the default units), attempt, hashes ("ok" | "tampered" | null), env (extra caller env), mq (initial control line).
 */
async function makeWorld(label, o = {}) {
  const { createFixture } = await fixtures();
  const bs = await buildState();
  const buildPaths = await need("paths.mjs", "buildPaths");
  const { writeState } = await import(pathToFileURL(path.join(BUILD, "state.mjs")).href);
  const { appendEvent } = await import(pathToFileURL(path.join(BUILD, "journal.mjs")).href);
  const card = await import(pathToFileURL(path.join(BUILD, "card.mjs")).href);
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, `pc-c05-${label}-`));
  const fx = await createFixture({ preset: "launched", card: true }, { dir });
  const runId = o.runId ?? "run-c05"; const bp = (await need("paths.mjs", "buildPaths"))(fx.root); const branch = bp.integrationBranch(runId);
  const env = fx.env({ ...IDENT, ...(o.env || {}) });
  const ctl = path.join(dir, "mq-control"); const log = path.join(dir, "mq-log.jsonl");
  await writeFile(ctl, `${o.mq ?? "0:ff"}\n`); await writeFile(log, "");
  await mkdir(path.join(fx.root, ".pandacorp"), { recursive: true });
  const stub = path.join(fx.root, ".pandacorp", "merge-queue.sh");
  await writeFile(stub, stubScript({ ctl, log, main: fx.root })); await chmod(stub, 0o755);
  if (o.phase) { const sy = path.join(fx.root, ".pandacorp", "status.yaml"); await writeFile(sy, (await readFile(sy, "utf8")).replace(/^phase:.*$/m, `phase: ${o.phase}`)); }
  git(fx.root, ["add", "-A"]); git(fx.root, ["commit", "-q", "-m", "fixture: stub merge-queue"]);
  const base = git(fx.root, ["rev-parse", "HEAD"]);
  const lease = await bs.acquire(fx.root, { runtime: "claude", runId, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const p = buildPaths(fx.root); const wt = p.integrationWorktree;
  git(fx.root, ["worktree", "add", "-q", "-b", branch, wt, "main"]);
  // lane content: frd-01 chain (code + WO IN_REVIEW), one commit per WO with a WO trailer
  await writeFile(path.join(wt, "src/alpha/list.ts"), "// src/alpha/list.ts\nexport const value = 2;\n");
  await setWoStatus(wt, "frd-01-alpha", "WO-01-001", "IN_REVIEW");
  git(wt, ["add", "-A"]); git(wt, ["commit", "-q", "-m", "feat(alpha): list\n\nWO: WO-01-001"]);
  await writeFile(path.join(wt, "src/alpha/filter.ts"), "// src/alpha/filter.ts\nexport const filter = true;\n");
  await setWoStatus(wt, "frd-01-alpha", "WO-01-002", "IN_REVIEW");
  git(wt, ["add", "-A"]); git(wt, ["commit", "-q", "-m", "feat(alpha): filter\n\nWO: WO-01-002"]);
  const hashed = {}; const probes = {};
  if (o.hashes) {
    const tf = "src/alpha/_tests/filter.test.ts"; const pf = "src/alpha/_tests/probe.test.ts";
    await mkdir(path.join(wt, "src/alpha/_tests"), { recursive: true });
    await writeFile(path.join(wt, tf), "// test\n"); await writeFile(path.join(wt, pf), "// probe\n");
    hashed[tf] = sha256("// test\n"); probes[pf] = sha256("// probe\n");
    git(wt, ["add", "-A"]); git(wt, ["commit", "-q", "-m", "test(alpha): tests first\n\nUnit: u-tests-wo-01-001"]);
    if (o.hashes === "tampered") { await writeFile(path.join(wt, tf), "// test edited after hashing\n"); git(wt, ["add", "-A"]); git(wt, ["commit", "-q", "-m", "chore: edit"]); }
  }
  const frds = ["frd-01-alpha"]; const wos = ["WO-01-001", "WO-01-002"];
  let units = o.extraUnits ?? [
    baseUnit({ attempt: o.attempt ?? 1, test_hashes: hashed, probe_hashes: {}, branch: bp.unitBranch(runId, "u-build-wo-01-001") }),
    baseUnit({ id: "u-review-frd-01-alpha", kind: "review", wos: [], chain: null, probe_hashes: probes }),
  ];
  if (o.secondFrd === "parked") {
    frds.push("frd-02-beta"); wos.push("WO-02-001", "WO-02-002");
    units = [...units, baseUnit({ id: "u-build-wo-02-001", wos: ["WO-02-001", "WO-02-002"], frd: "frd-02-beta", chain: "c-wo-02-001", state: "parked", parked: "owner_question", pending_answer: "q-1" })];
  }
  if (o.onlyParked) units = [baseUnit({ state: "parked", parked: "owner_question", pending_answer: "q-1" })];
  if (o.incomplete) units = [...units, baseUnit({ id: "u-build-wo-02-001", wos: ["WO-02-001"], frd: "frd-02-beta", chain: "c-wo-02-001", state: "integrated" })];
  const state = {
    schema: 2, engine: "v2", run_id: runId, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: o.size ?? "feature", status: "active", status_reason: null,
    tranche: o.tranche ?? null, scope: { card: o.scopeCard === undefined ? "add-filter" : o.scopeCard, frds, wos, out_of_scope: [] },
    integration: { branch, worktree: wt, base_sha: base }, last_safe_point: null, units, jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {},
  };
  await writeState(fx.root, state);
  await appendEvent(p.journalFile, { run_id: runId, epoch: lease.epoch, actor: "cli", type: "run_started", data: { detect: {}, preflight: {}, state: { ...state, units: [] } } });
  if (o.scopeCard !== null) await card.markCardBuilding(fx.root, "add-filter", { runId });
  const w = { dir, fx, env, p, runId, branch, wt, base, ctl, log, gateLog: o.gateLog, epoch: lease.epoch, token: lease.token, bs, remote0: fx.remote ? git(fx.remote, ["rev-parse", "main"]) : null };
  w.jobs = makeJobLayer(w); const ex = makeExec(w); w.exec = ex.exec; w.execCalls = ex.calls; w.execHooks = ex.hooks;
  w.deps = { env, exec: ex.exec, jobs: { spawnJob: w.jobs.spawnJob, pollJob: w.jobs.pollJob } };
  w.cleanup = async () => { await rm(dir, { recursive: true, force: true }); };
  return w;
}
const withWorld = async (label, o, fn) => { const w = await makeWorld(label, o); try { return await fn(w); } finally { await w.cleanup(); } };

// ---- driving the module --------------------------------------------------------------------------------------------
const callLand = async (w, { epoch = w.epoch } = {}) => { const r = await (await need("land.mjs", "land"))({ project: w.fx.root, epoch }, w.deps); return r.output ? { ...r.output, exit: r.exit } : r; };
const attempt = async (fn) => { try { return { value: await fn() }; } catch (error) { return { error }; } };
const setMq = (w, ...lines) => writeFile(w.ctl, `${lines.join("\n")}\n`);
/** spawn (call 1, must answer running), release the held job, harvest (call 2). */
async function mqRound(w, line) {
  if (line !== undefined) await setMq(w, line);
  const first = await callLand(w);
  eq(first.result, "running", "the first land call spawns the land job and answers running");
  await w.jobs.runPending();
  const second = await callLand(w);
  return { first, second };
}
const readState = async (w) => (await need("state.mjs", "readState"))(w.fx.root);
const readEvents = async (w) => (await (await need("journal.mjs", "readJournal"))(w.p.journalFile)).events;
const stubLog = async (w) => (await readFile(w.log, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const unitOf = (state, id) => state.units.find((u) => u.id === id);
const exitKey = (out) => (out && typeof out === "object" ? (out.exit ?? out.exit_code) : undefined);
const mainTip = (w) => git(w.fx.root, ["rev-parse", "main"]);
const laneTip = (w) => git(w.fx.root, ["rev-parse", w.branch]);
const changeCount = (w, rev = w.branch) => git(w.fx.root, ["log", rev, "--format=%B"]).split("\n").filter((l) => /^Change: /.test(l)).length;
const cardState = async (w, slug = "add-filter") => {
  const pend = path.join(w.fx.root, ".pandacorp/inbox/changes", `${slug}.md`); const done = path.join(w.fx.root, ".pandacorp/inbox/changes/done", `${slug}.md`);
  return { pending: existsSync(pend), done: existsSync(done), text: existsSync(done) ? await readFile(done, "utf8") : existsSync(pend) ? await readFile(pend, "utf8") : null };
};
const shippedSha = (text) => /^shipped_sha:\s*"?([0-9a-f]{40})"?\s*$/m.exec(text ?? "")?.[1] ?? null;
const mdSha = (text, key) => new RegExp(`^${key}:\\s*"?([0-9a-f]{40})"?\\s*$`, "m").exec(text ?? "")?.[1] ?? null;

const snapshot = async (w) => ({
  main: mainTip(w), remote: w.fx.remote ? git(w.fx.remote, ["rev-parse", "main"]) : null, lane: laneTip(w),
  state: await readFile(w.p.stateFile, "utf8"), journal: await readFile(w.p.journalFile, "utf8"),
  mainStatus: await readFile(path.join(w.fx.root, ".pandacorp/status.yaml"), "utf8"), spawns: w.jobs.spawns.length,
});
/** The production-gate invariants that hold after EVERY land call: no tracked change in the main checkout, main only moved by the stub, nothing pushed. */
async function assertMainUntouched(w, before, { stubMovedMain = false } = {}) {
  eq(git(w.fx.root, ["status", "--porcelain"]), "", "the main checkout has no tracked or untracked-visible change");
  eq(git(w.fx.root, ["rev-parse", "--abbrev-ref", "HEAD"]), "main", "main checkout is still on main");
  if (!stubMovedMain) {
    eq(mainTip(w), before.main, "no new commit on main");
    eq(await readFile(path.join(w.fx.root, ".pandacorp/status.yaml"), "utf8"), before.mainStatus, "main's status.yaml is byte-identical");
  }
  if (w.fx.remote) eq(git(w.fx.remote, ["rev-parse", "main"]), before.remote, "origin/main was never pushed to by the engine");
  for (const c of w.execCalls) {
    const inMain = c.cwd && path.resolve(c.cwd) === path.resolve(w.fx.root);
    const sub = c.args.find((a) => ["commit", "merge", "checkout", "reset", "push", "add", "stash", "cherry-pick", "rebase", "switch", "restore", "apply"].includes(a));
    ok(!(c.cmd === "git" && inMain && sub), `the engine ran "git ${c.args.join(" ")}" inside the main checkout (never writes the main checkout)`);
    ok(!(c.cmd === "git" && c.args.includes("push")), `the engine ran git push (only the merge-queue pushes, and only with the owner's order)`);
  }
}
/** The release variable is the owner's: the engine never sets it (spawn spec, exec calls, and what the merge-queue process really saw). */
async function assertNoReleaseVar(w, { expected = false } = {}) {
  for (const s of w.jobs.spawns) {
    eq(Boolean(s.childEnv.PANDACORP_OWNER_RELEASE_OK), expected, "PANDACORP_OWNER_RELEASE_OK in the land job's environment");
    if (!expected) ok(!("PANDACORP_OWNER_RELEASE_OK" in (s.env || {})) && !JSON.stringify(s.cmd).includes("OWNER_RELEASE"), "the land job spec carries no release variable");
  }
  for (const c of w.execCalls) if (!expected) ok(!("PANDACORP_OWNER_RELEASE_OK" in (c.env || {})), "an exec call carries the release variable");
  for (const l of await stubLog(w)) eq(l.owner_ok, expected ? "1" : "UNSET", "the merge-queue process saw PANDACORP_OWNER_RELEASE_OK");
}
const isEngineFailure = (r) => {
  if (r.error) { const c = r.error.code; return c === undefined || c === "ENGINE_FAILURE" || c === "ROLLBACK_FAILED"; }
  const v = r.value ?? {}; return exitKey(v) === 8 || v.code === "ENGINE_FAILURE" || v.result === "engine_failure";
};

// =====================================================================================================================
await test("module: land.mjs exists and exports land()", async () => { await need("land.mjs", "land"); });

// ---------------------------------------------------------------------------------------------------------------------
// The first call: spawns the land job (A1, D6) after the metadata commit (D2)
// ---------------------------------------------------------------------------------------------------------------------
await test("first call: spawns ONE land job (no H slot) running merge-queue.sh from the clean integration worktree; answers running with null mq_exit/sha", async () => withWorld("spawn", {}, async (w) => {
  const before = await snapshot(w);
  const out = await callLand(w);
  eq(out.result, "running", "result"); eq(out.reason ?? null, null, "reason"); eq(out.mq_exit ?? null, null, "mq_exit"); eq(out.sha ?? null, null, "sha");
  eq(w.jobs.spawns.length, 1, "one job spawned");
  const s = w.jobs.spawns[0];
  eq(s.kind, "land", "job kind"); ok(!s.hSlot, "the land job takes NO host H slot in its wrapper (A1; merge-queue.sh takes it around verify.sh)");
  eq(path.resolve(s.cwd), path.resolve(w.wt), "the job runs in the integration worktree");
  ok(/merge-queue\.sh/.test([].concat(s.cmd).join(" ")), `the job runs merge-queue.sh (got ${JSON.stringify(s.cmd)})`);
  const st = await readState(w); const job = st.jobs.find((j) => j.kind === "land");
  ok(job, "state.jobs[] records the land job"); eq(job.h_slot, false, "state job h_slot"); eq(job.state, "running", "state job state"); eq(job.unit ?? null, null, "land job has no unit");
  await assertNoReleaseVar(w); await assertMainUntouched(w, before);
  eq(laneTip(w) === before.lane, false, "the metadata commit was added on the integration branch");
}));

await test("the stub merge-queue sees what the real one requires: cwd = integration worktree, branch lane/<run>, tip = metadata commit, CLEAN tree", async () => withWorld("stubview", {}, async (w) => {
  await mqRound(w, "0:ff");
  const [l] = await stubLog(w); ok(l, "merge-queue.sh was executed");
  eq(path.resolve(l.cwd), path.resolve(git(w.wt, ["rev-parse", "--show-toplevel"])), "cwd"); eq(l.branch, w.branch, "branch");
  eq(l.dirty, 0, "a dirty worktree would exit 20 (precondition): the module must leave the integration worktree clean");
  eq(l.head, laneTip(w), "the queue runs on the tip that carries the metadata commit");
}));

// ---------------------------------------------------------------------------------------------------------------------
// D2: the landing metadata commit
// ---------------------------------------------------------------------------------------------------------------------
await test("D2 metadata commit: one commit on the lane, only WO frontmatter/rollups + status.yaml; WO VERIFIED, last_green_sha = the code tip below it, safe_to_test", async () => withWorld("meta", {}, async (w) => {
  const codeTip = laneTip(w);
  await callLand(w);
  const tip = laneTip(w); eq(git(w.wt, ["rev-parse", "HEAD~1"]), codeTip, "exactly one commit was added (its parent is the former code tip)");
  const files = git(w.wt, ["diff", "--name-only", codeTip, tip]).split("\n").filter(Boolean);
  ok(files.length > 0 && files.every((f) => /^docs\/frds\/[^/]+\/(work-orders\/wo-[^/]+\.md|frd\.md|blueprint\.md)$/.test(f) || f === ".pandacorp/status.yaml"), `the metadata commit touches only WO/FRD/blueprint frontmatter and status.yaml (got ${files.join(", ")})`);
  for (const wo of ["WO-01-001", "WO-01-002"]) ok(/^implementation_status: VERIFIED$/m.test(git(w.wt, ["show", `${tip}:${woPath("frd-01-alpha", wo)}`])), `${wo} is VERIFIED on the lane`);
  ok(/^implementation_status: VERIFIED$/m.test(git(w.wt, ["show", `${tip}:docs/frds/frd-01-alpha/frd.md`])), "rollup: frd.md of a fully verified FRD is VERIFIED");
  const sy = git(w.wt, ["show", `${tip}:.pandacorp/status.yaml`]);
  eq(mdSha(sy, "last_green_sha"), codeTip, "last_green_sha = the SHA of the code tip just below the metadata commit"); ok(/^safe_to_test:\s*true\s*$/m.test(sy), "safe_to_test: true");
  ok(/^phase: release\s*$/m.test(sy), "phase stays release (it moves to implementation only from architecture)");
  ok(/^work_orders_verified:\s*2\s*$/m.test(sy), "rollup counter work_orders_verified = 2");
}));

await test("D2: phase architecture becomes implementation in the metadata commit", async () => withWorld("phase", { phase: "architecture" }, async (w) => {
  await callLand(w);
  ok(/^phase: implementation\s*$/m.test(git(w.wt, ["show", `${laneTip(w)}:.pandacorp/status.yaml`])), "phase: implementation");
}));

await test("D2 trailer: `Change: <slug>` is a real trailer on the metadata commit and on NO other commit of the lane", async () => withWorld("trailer", {}, async (w) => {
  await callLand(w);
  ok(trailerLines(w.wt, w.branch).includes("Change: add-filter"), `tip carries the Change trailer (got ${JSON.stringify(trailerLines(w.wt, w.branch))})`);
  eq(changeCount(w), 1, "exactly one commit of the lane has a Change: line");
  for (const sha of git(w.wt, ["rev-list", `${w.base}..${w.branch}~1`]).split("\n").filter(Boolean)) ok(!trailerLines(w.wt, sha).some((l) => l.startsWith("Change:")), `code commit ${sha.slice(0, 8)} has no Change: trailer`);
  ok(trailerLines(w.wt, `${w.branch}~1`).some((l) => l.startsWith("WO:")), "the engine never rewrote the code commits (their WO: trailers remain)");
}));

await test("D2 trailer: no Change: when the run has no card (scope.card null) and the card is left alone", async () => withWorld("nocard", { scopeCard: null }, async (w) => {
  await mqRound(w, "0:ff");
  eq(changeCount(w), 0, "no Change: trailer without a card");
  const c = await cardState(w); ok(c.pending && !c.done, "the unrelated card was not archived");
}));

await test("D2 trailer: a giant run lands tranche 1 of 2 WITHOUT Change:, tranche 2 of 2 WITH it", async () => {
  await withWorld("tr1", { size: "giant", tranche: { index: 1, of: 2 } }, async (w) => {
    await mqRound(w, "0:ff"); eq(changeCount(w), 0, "tranche 1/2 does not complete the card");
    const c = await cardState(w); ok(c.pending && !c.done, "the card stays open after tranche 1/2");
  });
  await withWorld("tr2", { size: "giant", tranche: { index: 2, of: 2 } }, async (w) => {
    await mqRound(w, "0:ff"); eq(changeCount(w), 1, "tranche 2/2 completes the card");
    ok((await cardState(w)).done, "the card is archived after the last tranche");
  });
});

await test("D2 (INFERRED): a parked unit left out of the batch keeps the card open: its WOs stay unverified and no Change: trailer", async () => withWorld("parkedcard", { secondFrd: "parked" }, async (w) => {
  const out = await mqRound(w, "0:ff"); eq(out.second.result, "landed", "the non-parked work lands");
  eq(changeCount(w), 0, "the card is not complete while a unit is parked");
  for (const wo of ["WO-02-001", "WO-02-002"]) ok(/^implementation_status: PLANNED$/m.test(git(w.wt, ["show", `${laneTip(w)}:${woPath("frd-02-beta", wo)}`])), `${wo} of the parked unit is untouched`);
  ok(!/^implementation_status: VERIFIED$/m.test(git(w.wt, ["show", `${laneTip(w)}:docs/frds/frd-02-beta/frd.md`])), "frd-02 rollup is not VERIFIED");
  const c = await cardState(w); ok(c.pending && !c.done, "card not archived");
}));

await test("D2 rebase first: main moved before the landing -> the lane is rebased onto it, last_green_sha is the REBASED code tip, no merge commit", async () => withWorld("rebase", {}, async (w) => {
  await writeFile(path.join(w.fx.root, "README.md"), "# changed by another session\n"); git(w.fx.root, ["commit", "-q", "-am", "docs: other session"]);
  const before = await snapshot(w); const oldCodeTip = laneTip(w);
  await callLand(w);
  const tip = laneTip(w); const codeTip = git(w.wt, ["rev-parse", "HEAD~1"]);
  ok(codeTip !== oldCodeTip, "the code commits were rebased (new SHAs)"); eq(git(w.wt, ["merge-base", "main", tip]), before.main, "the lane sits on the CURRENT main");
  eq(git(w.wt, ["rev-list", "--merges", `main..${tip}`]), "", "linear history: rebase, never a merge");
  eq(mdSha(git(w.wt, ["show", `${tip}:.pandacorp/status.yaml`]), "last_green_sha"), codeTip, "last_green_sha is the rebased code tip, not the stale one");
  await assertMainUntouched(w, before);
}));

await test("A15 rebase conflict BEFORE the job: handback rebase_conflict (exit 6), rebase aborted, lane tip restored, no job, no metadata commit, main untouched", async () => withWorld("conflict", {}, async (w) => {
  await writeFile(path.join(w.fx.root, "src/alpha/list.ts"), "// src/alpha/list.ts\nexport const value = 3;\n"); git(w.fx.root, ["commit", "-q", "-am", "feat: other session edits the same line"]);
  const before = await snapshot(w);
  const out = await callLand(w);
  eq(out.result, "handback", "result"); eq(out.reason, "rebase_conflict", "reason"); if (exitKey(out) !== undefined) eq(exitKey(out), 6, "land exit");
  eq(w.jobs.spawns.length, 0, "no land job was spawned"); eq(laneTip(w), before.lane, "the lane tip is exactly what it was (rebase aborted)");
  eq(git(w.wt, ["status", "--porcelain"]), "", "integration worktree clean"); eq(git(w.wt, ["rev-parse", "--abbrev-ref", "HEAD"]), w.branch, "still on the lane branch (not detached mid-rebase)");
  const rm = git(w.wt, ["rev-parse", "--git-path", "rebase-merge"]); ok(!existsSync(path.resolve(w.wt, rm)), "no rebase-merge directory left behind");
  eq(changeCount(w), 0, "no metadata commit"); eq((await readEvents(w)).some((e) => e.type === "batch_landed"), false, "nothing landed");
  await assertMainUntouched(w, before);
}));

await test("A15 phase 2 re-verifies the epoch: a takeover (transfer) while the rebase runs -> FENCE at phase 2, no metadata commit, no job", async () => withWorld("phase2", {}, async (w) => {
  await writeFile(path.join(w.fx.root, "README.md"), "# main moved so a rebase is needed\n"); git(w.fx.root, ["commit", "-q", "-am", "docs: main moved"]);
  const before = await snapshot(w); let fired = false;
  w.execHooks.push(async (rec) => {
    if (!fired && rec.args.includes("rebase")) { fired = true; await w.bs.transfer(w.fx.root, { token: w.token, toRuntime: "codex", coordinator: "drive" }); }
  });
  const r = await attempt(() => callLand(w));
  ok(fired, "the module did not run its rebase through deps.exec (ASSUMED INTERFACE: git goes through deps.exec), so the takeover could not be injected");
  ok(r.error && (r.error.code === "FENCE" || r.error.code === "QUIESCED"), `expected a FENCE rejection, got ${r.error ? `${r.error.code}: ${r.error.message}` : JSON.stringify(r.value)}`);
  if (r.error.phase !== undefined) eq(r.error.phase, 2, "the fence failure happens in phase 2");
  eq(w.jobs.spawns.length, 0, "the old holder spawned nothing"); eq(changeCount(w), 0, "the old holder wrote no metadata commit");
  eq(git(w.wt, ["show", `${laneTip(w)}:.pandacorp/status.yaml`]).includes("last_green_sha"), false, "no last_green_sha was written by the old holder");
  await assertMainUntouched(w, before);
}));

// ---------------------------------------------------------------------------------------------------------------------
// Fence
// ---------------------------------------------------------------------------------------------------------------------
await test("fence: a wrong epoch is FENCE and changes nothing (no spawn, no commit, state/journal bytes identical)", async () => withWorld("fence", {}, async (w) => {
  const before = await snapshot(w);
  const r = await attempt(() => callLand(w, { epoch: w.epoch + 5 }));
  ok(r.error && r.error.code === "FENCE", `expected FENCE, got ${r.error ? r.error.code : JSON.stringify(r.value)}`);
  const after = await snapshot(w); eq(after.lane, before.lane, "lane"); eq(after.state, before.state, "state.json"); eq(after.journal, before.journal, "journal"); eq(w.jobs.spawns.length, 0, "no job");
  await assertMainUntouched(w, before);
}));
await test("fence: a quiesced lease is refused (QUIESCED) and a former holder after transfer is FENCE; the new holder proceeds", async () => {
  await withWorld("quiesced", {}, async (w) => {
    await w.bs.quiesce(w.fx.root, w.token, w.epoch, { projectStatus: false });
    const r = await attempt(() => callLand(w)); ok(r.error && (r.error.code === "QUIESCED" || r.error.code === "FENCE"), `expected QUIESCED, got ${r.error ? r.error.code : JSON.stringify(r.value)}`);
    eq(w.jobs.spawns.length, 0, "no job");
  });
  await withWorld("transferred", {}, async (w) => {
    const next = await w.bs.transfer(w.fx.root, { token: w.token, toRuntime: "codex", coordinator: "drive" });
    const r = await attempt(() => callLand(w)); ok(r.error && r.error.code === "FENCE", "the old epoch is fenced after transfer"); eq(w.jobs.spawns.length, 0, "old holder spawned nothing");
    const out = await callLand(w, { epoch: next.epoch }); eq(out.result, "running", "the new holder lands");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// nothing_to_land (exit 0, nothing written or journaled)
// ---------------------------------------------------------------------------------------------------------------------
await test("nothing_to_land batch_incomplete: a unit still integrated (not reviewed) blocks the landing; nothing written, journaled or spawned", async () => withWorld("incomplete", { incomplete: true }, async (w) => {
  const before = await snapshot(w); const out = await callLand(w);
  eq(out.result, "nothing_to_land", "result"); eq(out.reason, "batch_incomplete", "reason"); eq(out.mq_exit ?? null, null, "mq_exit"); eq(out.sha ?? null, null, "sha"); if (exitKey(out) !== undefined) eq(exitKey(out), 0, "exit");
  const after = await snapshot(w); eq(after.state, before.state, "state.json untouched"); eq(after.journal, before.journal, "journal untouched"); eq(after.lane, before.lane, "no commit on the lane"); eq(w.jobs.spawns.length, 0, "no job");
  await assertMainUntouched(w, before);
}));
await test("nothing_to_land no_verified_work: only a parked unit; nothing written, journaled or spawned", async () => withWorld("noverified", { onlyParked: true }, async (w) => {
  const before = await snapshot(w); const out = await callLand(w);
  eq(out.result, "nothing_to_land", "result"); eq(out.reason, "no_verified_work", "reason"); if (exitKey(out) !== undefined) eq(exitKey(out), 0, "exit");
  const after = await snapshot(w); eq(after.state, before.state, "state.json untouched"); eq(after.journal, before.journal, "journal untouched"); eq(after.lane, before.lane, "lane untouched"); eq(w.jobs.spawns.length, 0, "no job");
  await assertMainUntouched(w, before);
}));

// ---------------------------------------------------------------------------------------------------------------------
// A land job that is alive: no second job, no second commit
// ---------------------------------------------------------------------------------------------------------------------
await test("a live land job: land answers running again, spawns nothing more and adds no commit", async () => withWorld("alive", {}, async (w) => {
  await callLand(w); const tip = laneTip(w);
  const again = await callLand(w); eq(again.result, "running", "still running"); eq(w.jobs.spawns.length, 1, "exactly one job"); eq(laneTip(w), tip, "no second metadata commit");
  eq((await readState(w)).jobs.filter((j) => j.kind === "land").length, 1, "one land job in state");
}));
await test("(INFERRED) a DEAD land job (pid gone, no exit file) is never reported as landed and never archives the card", async () => withWorld("dead", {}, async (w) => {
  await callLand(w); w.jobs.kill([...w.jobs.table.keys()][0]);
  const before = await snapshot(w);
  const r = await attempt(() => callLand(w));
  ok(r.error || r.value.result !== "landed", "a dead job must not become landed");
  const c = await cardState(w); ok(c.pending && !c.done, "card not archived"); eq((await readEvents(w)).some((e) => e.type === "batch_landed"), false, "no batch_landed");
  await assertMainUntouched(w, before);
}));

// ---------------------------------------------------------------------------------------------------------------------
// D24 / A15: the merge-queue exit map
// ---------------------------------------------------------------------------------------------------------------------
await test("mq 0 (ff): landed, sha = new main tip, units landed, batch_landed {sha}, no pin_stale, card archived with shipped_sha, status.yaml pinned on main by the merge only", async () => withWorld("exit0", {}, async (w) => {
  const before = await snapshot(w); const { second } = await mqRound(w, "0:ff");
  eq(second.result, "landed", "result"); eq(second.reason ?? null, null, "reason"); eq(second.mq_exit, 0, "mq_exit"); if (exitKey(second) !== undefined) eq(exitKey(second), 0, "land exit");
  ok(SHA40.test(second.sha), "sha is a full SHA"); eq(second.sha, mainTip(w), "sha is the tip of main after the queue"); ok(mainTip(w) !== before.main, "main moved (through the merge-queue stub only)");
  const st = await readState(w); eq(unitOf(st, "u-build-wo-01-001").state, "landed", "build unit landed"); eq(unitOf(st, "u-review-frd-01-alpha").state, "verified", "review unit stays verified (terminal)");
  const ev = await readEvents(w); const bl = ev.filter((e) => e.type === "batch_landed"); eq(bl.length, 1, "one batch_landed"); eq(bl[0].data.sha, second.sha, "batch_landed.data.sha"); ok(!ev.some((e) => e.type === "pin_stale"), "no pin_stale when last_green_sha is an ancestor of main");
  const c = await cardState(w); ok(!c.pending && c.done, "card moved to done/"); ok(/^status:\s*done\s*$/m.test(c.text), "status: done"); eq(shippedSha(c.text), second.sha, "shipped_sha = landed sha");
  const sy = await readFile(path.join(w.fx.root, ".pandacorp/status.yaml"), "utf8"); ok(mdSha(sy, "last_green_sha") && /safe_to_test:\s*true/.test(sy), "main's status.yaml carries the pin that the metadata commit brought");
  await assertNoReleaseVar(w); await assertMainUntouched(w, before, { stubMovedMain: true });
  eq(git(w.fx.root, ["log", "-1", "--format=%H", "main"]), laneTip(w), "main == the lane tip: nothing was added to main except by the queue");
}));

await test("mq 0 with main moved during the queue: landed on the REBASED tip, pin_stale journaled, shipped_sha = the new main tip", async () => withWorld("pinstale", {}, async (w) => {
  const before = await snapshot(w); const { second } = await mqRound(w, "0:rebased");
  eq(second.result, "landed", "result"); eq(second.sha, mainTip(w), "sha is the NEW main tip");
  const ev = await readEvents(w); eq(ev.filter((e) => e.type === "pin_stale").length, 1, "pin_stale journaled once (last_green_sha is not an ancestor of main)"); eq(ev.filter((e) => e.type === "batch_landed").length, 1, "batch_landed still journaled");
  const lg = mdSha(await readFile(path.join(w.fx.root, ".pandacorp/status.yaml"), "utf8"), "last_green_sha"); ok(lg && gitTry(w.fx.root, ["merge-base", "--is-ancestor", lg, "main"]).ok === false, "the stale pin really is not an ancestor");
  eq(shippedSha((await cardState(w)).text), second.sha, "shipped_sha"); await assertNoReleaseVar(w); await assertMainUntouched(w, before, { stubMovedMain: true });
}));

await test("mq 13: landed (merged, push failed) with notes_es mentioning the push, card archived, land exit 0", async () => withWorld("exit13", {}, async (w) => {
  const { second } = await mqRound(w, "13:ff");
  eq(second.result, "landed", "result"); eq(second.mq_exit, 13, "mq_exit"); eq(second.reason ?? null, null, "reason"); if (exitKey(second) !== undefined) eq(exitKey(second), 0, "land exit");
  ok(/push fall/i.test(JSON.stringify(second.notes_es ?? "")), `notes_es says the push failed (got ${JSON.stringify(second.notes_es)})`); eq(second.sha, mainTip(w), "sha");
  ok((await cardState(w)).done, "card archived"); eq(unitOf(await readState(w), "u-build-wo-01-001").state, "landed", "units landed");
  await assertNoReleaseVar(w);
}));

await test("mq 10: handback rebase_conflict (exit 6): not landed, no card archive, no patch unit, main untouched", async () => withWorld("exit10", {}, async (w) => {
  const before = await snapshot(w); const { second } = await mqRound(w, "10");
  eq(second.result, "handback", "result"); eq(second.reason, "rebase_conflict", "reason"); eq(second.mq_exit, 10, "mq_exit"); eq(second.sha ?? null, null, "sha"); if (exitKey(second) !== undefined) eq(exitKey(second), 6, "land exit");
  const st = await readState(w); ok(!st.units.some((u) => u.kind === "patch"), "a conflict is not a red gate: no patch unit"); ok(!st.units.some((u) => u.state === "landed"), "nothing landed");
  const c = await cardState(w); ok(c.pending && !c.done, "card stays pending"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed");
  ok((await readEvents(w)).some((e) => e.type === "handback"), "journal has a handback event"); await assertNoReleaseVar(w); await assertMainUntouched(w, before);
}));

await test("PATCH mq 11 unattributed: handback g3_red (exit 6), independent fallback patch at attempt 1; nothing lands, main untouched", async () => withWorld("exit11", {}, async (w) => {
  const before = await snapshot(w); const { second } = await mqRound(w, "11");
  eq(second.result, "handback", "result"); eq(second.reason, "g3_red", "reason"); eq(second.mq_exit, 11, "mq_exit"); if (exitKey(second) !== undefined) eq(exitKey(second), 6, "land exit");
  const st = await readState(w); const patches = st.units.filter((u) => u.kind === "patch"); eq(patches.length, 1, "exactly one patch unit for the run");
  const pu = patches[0]; eq(pu.id, "u-patch-g3", "fallback id"); eq(pu.state, "queued", "queued"); eq(pu.attempt, 1, "fallback owns its three-execution budget"); eq(pu.frd, null, "unattributed G3 is not assigned a FRD");
  ok(!st.units.some((u) => u.state === "landed"), "nothing landed"); ok((await readEvents(w)).some((e) => e.type === "patch"), "journal has a patch event"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed");
  const c = await cardState(w); ok(c.pending && !c.done, "card stays pending"); await assertNoReleaseVar(w); await assertMainUntouched(w, before);
}));
await test("PATCH G3: one of three WOs fails, only its unit reopens and its brief carries the gate evidence", async () => withWorld("scope-three", {
  scopeCard: null,
  gateLog: "PASS src/alpha/list.test.ts > healthy\nFAIL src/alpha/filter.test.ts > filters empty values\n  at src/alpha/filter.ts:8:2\n",
  extraUnits: [
    baseUnit({ wos: ["WO-01-001"] }),
    baseUnit({ id: "u-build-filter", wos: ["WO-01-002"], test_hashes: { "src/alpha/filter.test.ts": "a".repeat(64) } }),
    baseUnit({ id: "u-build-beta", wos: ["WO-02-001"], frd: "frd-02-beta", attempt: 3 }),
  ],
}, async (w) => {
  await setWoStatus(w.wt, "frd-02-beta", "WO-02-001", "IN_REVIEW");
  git(w.wt, ["commit", "-qam", "fixture: beta in review"]);
  // The hashed file is checked by land before spawning; add the actual bytes and matching hash.
  await writeFile(path.join(w.wt, "src/alpha/filter.test.ts"), "// immutable test\n");
  git(w.wt, ["add", "src/alpha/filter.test.ts"]); git(w.wt, ["commit", "-qm", "fixture: hashed test"]);
  const stateModule = await import("../runtime/build/state.mjs");
  const beforeState = await readState(w);
  beforeState.units.find((u) => u.id === "u-build-filter").test_hashes["src/alpha/filter.test.ts"] = sha256("// immutable test\n");
  await stateModule.writeState(w.fx.root, beforeState);
  const before = await snapshot(w);
  const { second } = await mqRound(w, "11");
  const st = await readState(w); const patch = st.units.find((u) => u.id === second.patch_unit);
  eq(patch.wos, ["WO-01-002"], "patch allowlist derives only from the failing WO"); eq(patch.attempt, 2, "healthy beta attempt 3 does not exhaust this WO");
  eq(unitOf(st, "u-build-filter").state, "patching", "only failing unit patches");
  eq(unitOf(st, "u-build-wo-01-001").state, "verified", "healthy alpha stays verified");
  eq(unitOf(st, "u-build-beta").state, "verified", "healthy beta stays verified");
  const { transitionWorkOrders } = await import("../runtime/build/integrate/transitions.mjs");
  const moved = await transitionWorkOrders({ integration: st.integration, runId: st.run_id, wos: patch.wos, to: "IN_PROGRESS", unitId: patch.id }, w.deps);
  eq(moved.steps.map((s) => [s.wo, s.to]), [["WO-01-002", "PLANNED"], ["WO-01-002", "IN_PROGRESS"]], "dispatch reopens only the implicated WO");
  for (const [frd, wo] of [["frd-01-alpha", "WO-01-001"], ["frd-02-beta", "WO-02-001"]]) ok(/^implementation_status: IN_REVIEW$/m.test(await readFile(path.join(w.wt, woPath(frd, wo)), "utf8")), `${wo} unchanged`);
  const { writeUnitBrief } = await import("../runtime/build/units/brief.mjs");
  const brief = await writeUnitBrief({ project: w.fx.root, state: st, unit: patch, worktree: w.wt, cell: { runtime: "codex", model: "sol", effort: "high" }, agentType: "pandacorp:implementer", token: "fake-unit-token", schemaPath: w.p.schemaFile("report") }, w.deps);
  ok(brief.text.includes("vitest") && brief.text.includes("filters empty values") && brief.text.includes("at src/alpha/filter.ts:8:2"), "checks, test id and tail reach the brief");
  ok(brief.text.includes("Fix only what is red; no rewrite of the WO or FRD."), "patch-only instruction");
  ok(brief.text.includes("Write allowlist (`artifacts`): `src/alpha/filter.ts`") && !brief.text.includes("`src/alpha/list.ts`"), "brief allowlist is scoped");
  await assertMainUntouched(w, before);
}));
await test("PATCH G3 fallback: exhausted build does not charge it; three patch executions then budget_exhausted", async () => withWorld("fallback-budget", { attempt: 3, scopeCard: null }, async (w) => {
  const stateModule = await import("../runtime/build/state.mjs");
  for (const n of [1, 2, 3]) {
    const { second } = await mqRound(w, "11");
    eq(second.patch_unit, "u-patch-g3", "unattributed fallback id");
    const st = await readState(w); const patch = st.units.find((u) => u.id === second.patch_unit);
    eq(patch.attempt, n, "the fallback pays only its own executions");
    eq(unitOf(st, "u-build-wo-01-001").state, "verified", "fallback reopens no build unit");
    for (const wo of ["WO-01-001", "WO-01-002"]) ok(/^implementation_status: IN_REVIEW$/m.test(await readFile(path.join(w.wt, woPath("frd-01-alpha", wo)), "utf8")), "fallback harvest reopens no WO");
    // Simulate a finished, independently reviewed patch so another G3 can judge it.
    patch.state = "verified"; await stateModule.writeState(w.fx.root, st);
  }
  const { second } = await mqRound(w, "11"); eq(second.patch_unit, null, "no fourth patch execution");
  eq(unitOf(await readState(w), "u-patch-g3").state, "blocked", "existing governed hand-back blocks the exhausted patch");
  ok((await readEvents(w)).some((e) => e.type === "handback" && e.data.reason_code === "budget_exhausted"), "budget reason survives");
}));
await test("mq 11: the patch attempt follows the highest attempt of the run's units (build attempt 2 -> patch attempt 3)", async () => withWorld("exit11b", { attempt: 2, gateLog: "src/alpha/list.ts(2,1): error TS2322: wrong type\n" }, async (w) => {
  const { second } = await mqRound(w, "11"); eq(second.reason, "g3_red", "reason");
  eq((await readState(w)).units.find((u) => u.kind === "patch").attempt, 3, "attempt 2 + 1");
}));

await test("T-C05 mq 11 with the 3-execution budget exhausted (build attempt 3): hand-back, units AND dependents blocked (R4), WO BLOCKED on the lane, no patch unit, decisions entry pending, main untouched", async () => withWorld("exit11c", { attempt: 3, gateLog: "src/alpha/list.ts(2,1): error TS2322: wrong type\n" }, async (w) => {
  const before = await snapshot(w);
  const { second } = await mqRound(w, "11");
  eq(second.result, "handback", "result"); eq(second.reason, "g3_red", "reason"); eq(second.mq_exit, 11, "mq_exit"); if (exitKey(second) !== undefined) eq(exitKey(second), 6, "land exit");
  eq(second.patch_unit ?? null, null, "patch_unit is null: no budget left for a patch");
  const st = await readState(w);
  ok(!st.units.some((u) => u.kind === "patch"), "no patch unit queued");
  eq(unitOf(st, "u-build-wo-01-001").state, "blocked", "the fixed build unit is blocked, never left verified (next would land again) nor parked (R4)");
  ok(!st.units.some((u) => u.kind === "build" && (u.state === "verified" || u.state === "landed")), "no build unit stays verified or landed");
  ok(/^implementation_status:\s*BLOCKED\s*$/m.test(await readFile(path.join(w.wt, woPath("frd-01-alpha", "WO-01-001")), "utf8")), "the WO is BLOCKED on the lane");
  const dec = await readFile(path.join(w.fx.root, ".pandacorp/inbox/decisions.md"), "utf8"); ok(/pending|pendiente/i.test(dec), "a pending entry was added to decisions.md");
  eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed");
  await assertNoReleaseVar(w); await assertMainUntouched(w, before);
}));

for (const [code, reason] of [[12, "busy_main"], [14, "port_busy"]]) {
  await test(`mq ${code}: nothing_to_land ${reason} (exit 0), NOT a handback and no patch; retried at the next safe point without a second metadata commit; then lands`, async () => withWorld(`exit${code}`, {}, async (w) => {
    const before = await snapshot(w); const { second } = await mqRound(w, `${code}`);
    eq(second.result, "nothing_to_land", "result"); eq(second.reason, reason, "reason"); eq(second.mq_exit, code, "mq_exit"); if (exitKey(second) !== undefined) eq(exitKey(second), 0, "land exit");
    const st = await readState(w); ok(!st.units.some((u) => u.kind === "patch"), "no patch unit"); ok(!(await readEvents(w)).some((e) => e.type === "handback" || e.type === "batch_landed"), "no handback and no batch_landed");
    ok((await cardState(w)).pending, "card stays pending"); await assertMainUntouched(w, before);
    const tipAfterFirst = laneTip(w);
    const { second: later } = await mqRound(w, "0:ff");   // next safe point: the engine tries again
    eq(w.jobs.spawns.length, 2, "a new land job at the next safe point"); eq(later.result, "landed", "the retry lands"); eq(changeCount(w), 1, "a retry never stacks a second Change: commit");
    eq(git(w.wt, ["rev-parse", "HEAD~1"]), git(w.wt, ["rev-parse", `${tipAfterFirst}~1`]), "only the metadata commit is rewritten, on the same code tip"); await assertNoReleaseVar(w);
  }));
}

await test("mq 20 once: nothing_to_land mq_precondition (exit 0), retried at the next safe point", async () => withWorld("exit20", {}, async (w) => {
  const before = await snapshot(w); const { second } = await mqRound(w, "20");
  eq(second.result, "nothing_to_land", "result"); eq(second.reason, "mq_precondition", "reason"); eq(second.mq_exit, 20, "mq_exit"); if (exitKey(second) !== undefined) eq(exitKey(second), 0, "land exit");
  await assertMainUntouched(w, before); const { second: later } = await mqRound(w, "0:ff"); eq(later.result, "landed", "retry lands");
}));
await test("mq 20 TWICE in a row: the second one is an ENGINE FAILURE (exit 8), not another nothing_to_land; nothing landed", async () => withWorld("exit20x2", {}, async (w) => {
  const before = await snapshot(w); await setMq(w, "20");
  const r1 = await mqRound(w); eq(r1.second.reason, "mq_precondition", "first 20");
  await callLand(w); await w.jobs.runPending();
  const r2 = await attempt(() => callLand(w));
  ok(isEngineFailure(r2), `the second consecutive 20 must be an engine failure, got ${r2.error ? `${r2.error.code}: ${r2.error.message}` : JSON.stringify(r2.value)}`);
  ok(!(await cardState(w)).done, "card not archived"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed"); await assertMainUntouched(w, before);
}));
await test("(INFERRED) 20, then 12, then 20: not consecutive, so no engine failure", async () => withWorld("exit20gap", {}, async (w) => {
  await setMq(w, "20", "12", "20");
  const a = await mqRound(w); eq(a.second.reason, "mq_precondition", "20");
  await callLand(w); await w.jobs.runPending(); const b = await callLand(w); eq(b.reason, "busy_main", "12");
  await callLand(w); await w.jobs.runPending(); const c = await attempt(() => callLand(w));
  ok(!c.error && c.value.result === "nothing_to_land" && c.value.reason === "mq_precondition", `a 20 after a 12 is an ordinary precondition retry, got ${c.error ? c.error.message : JSON.stringify(c.value)}`);
}));

await test("mq 21 (launched project): waiting_gate (exit 7), units waiting_gate/production, journal waiting_gate, NO retry, `git log main` and origin unchanged, card not archived, variable never set", async () => withWorld("exit21", {}, async (w) => {
  const before = await snapshot(w); const logBefore = git(w.fx.root, ["log", "--format=%H", "main"]);
  const { second } = await mqRound(w, "21");
  eq(second.result, "waiting_gate", "result"); eq(second.reason ?? null, null, "reason"); eq(second.mq_exit, 21, "mq_exit"); eq(second.sha ?? null, null, "sha"); if (exitKey(second) !== undefined) eq(exitKey(second), 7, "land exit");
  eq(git(w.fx.root, ["log", "--format=%H", "main"]), logBefore, "`git log main` is unchanged");
  const st = await readState(w); const bu = unitOf(st, "u-build-wo-01-001"); eq(bu.state, "waiting_gate", "build unit state"); eq(bu.waiting_gate, "production", "waiting_gate:production stored on the unit");
  const wg = (await readEvents(w)).filter((e) => e.type === "waiting_gate"); ok(wg.some((e) => e.data.unit === "u-build-wo-01-001" && e.data.kind === "production"), "journal waiting_gate {unit, kind:production}");
  const c = await cardState(w); ok(c.pending && !c.done, "card not archived"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed");
  eq(w.jobs.spawns.length, 1, "exit 21 is never retried by the engine (no second land job)"); eq((await stubLog(w)).length, 1, "the queue ran once");
  await assertNoReleaseVar(w); await assertMainUntouched(w, before);
}));

await test("owner's order: with PANDACORP_OWNER_RELEASE_OK=1 already in the CALLER's environment it reaches the merge-queue (pass-through), after a waiting_gate the units land and the card archives", async () => {
  await withWorld("owner", {}, async (w) => {
    await mqRound(w, "21"); await assertNoReleaseVar(w);
    const owner = { ...w.env, PANDACORP_OWNER_RELEASE_OK: "1" }; w.env = owner; w.deps.env = owner;
    process.env.PANDACORP_OWNER_RELEASE_OK = "1";
    try {
      await setMq(w, "0:ff"); const first = await callLand(w); eq(first.result, "running", "the owner's order spawns the landing again"); await w.jobs.runPending(); const second = await callLand(w);
      eq(second.result, "landed", "result"); eq(second.sha, mainTip(w), "sha");
      const logs = await stubLog(w); eq(logs.at(-1).owner_ok, "1", "the variable the OWNER set reached the merge-queue; the engine did not strip it");
      const bu = unitOf(await readState(w), "u-build-wo-01-001"); eq(bu.state, "landed", "waiting_gate -> landed"); eq(bu.waiting_gate ?? null, null, "the gate marker is cleared");
      ok((await cardState(w)).done, "card archived");
    } finally { delete process.env.PANDACORP_OWNER_RELEASE_OK; }
  });
});

await test("fail-closed: an exit code the map does not know (1, 2, 99, 137) is never landed, never archives the card, never moves main", async () => {
  for (const code of [1, 2, 99, 137]) {
    await withWorld(`unk${code}`, {}, async (w) => {
      const before = await snapshot(w); await setMq(w, `${code}`);
      await callLand(w); await w.jobs.runPending(); const r = await attempt(() => callLand(w));
      ok(r.error || r.value.result !== "landed", `mq exit ${code} must not be reported as landed`);
      const c = await cardState(w); ok(c.pending && !c.done, `card untouched for exit ${code}`); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 0, "no batch_landed");
      await assertNoReleaseVar(w); await assertMainUntouched(w, before);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// A3: the card archive is idempotent and never an error
// ---------------------------------------------------------------------------------------------------------------------
await test("A3 card archive: the merge-queue's reconciler already moved the card to done/ (no shipped_sha) -> not an error, shipped_sha added, one copy", async () => withWorld("archived", {}, async (w) => {
  const { second } = await mqRound(w, "0:ff,reconcile"); eq(second.result, "landed", "landed");
  const c = await cardState(w); ok(!c.pending && c.done, "only the done/ copy exists"); eq(shippedSha(c.text), second.sha, "shipped_sha added"); eq((c.text.match(/^shipped_sha:/gm) || []).length, 1, "shipped_sha written once");
  eq((await readdir(path.join(w.fx.root, ".pandacorp/inbox/changes"))).filter((f) => f === "add-filter.md").length, 0, "no stray pending copy");
}));
await test("A3 card archive: already archived WITH a shipped_sha -> left exactly as it is", async () => withWorld("archived2", {}, async (w) => {
  const { second } = await mqRound(w, "0:ff,reconcilesha"); eq(second.result, "landed", "landed");
  const c = await cardState(w); ok(c.done && !c.pending, "done/ copy only"); eq(shippedSha(c.text), "b".repeat(40), "the existing shipped_sha is kept, not overwritten"); eq((c.text.match(/^shipped_sha:/gm) || []).length, 1, "one shipped_sha");
}));
await test("A3 card archive: the card is in neither place -> landed anyway (a note, never an error)", async () => withWorld("nocardfile", {}, async (w) => {
  await rm(path.join(w.fx.root, ".pandacorp/inbox/changes/add-filter.md"));
  const { second } = await mqRound(w, "0:ff"); eq(second.result, "landed", "landed"); eq(second.sha, mainTip(w), "sha");
  const c = await cardState(w); ok(!c.pending && !c.done, "nothing was invented"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 1, "batch_landed journaled");
}));
await test("A3 idempotency: land called again after the landing changes nothing (no job, one batch_landed, card and main untouched)", async () => withWorld("twice", {}, async (w) => {
  const { second } = await mqRound(w, "0:ff"); eq(second.result, "landed", "landed"); const c0 = await cardState(w); const mainAfter = mainTip(w); const spawns = w.jobs.spawns.length;
  const again = await attempt(() => callLand(w)); ok(!again.error || again.error.code !== undefined, "a repeated call must not crash obscurely");
  eq(w.jobs.spawns.length, spawns, "no second land job"); eq(mainTip(w), mainAfter, "main untouched"); eq((await cardState(w)).text, c0.text, "card byte-identical"); eq((await readEvents(w)).filter((e) => e.type === "batch_landed").length, 1, "still one batch_landed");
  if (again.value) ok(again.value.result !== "landed" || again.value.sha === second.sha, "a repeated call never reports a different landing");
}));

// ---------------------------------------------------------------------------------------------------------------------
// The hashed set: land re-hashes test_hashes and probe_hashes (A13)
// ---------------------------------------------------------------------------------------------------------------------
await test("A13 land re-hashes the run's test/probe files: matching hashes pass", async () => withWorld("hashok", { hashes: "ok" }, async (w) => {
  const { second } = await mqRound(w, "0:ff"); eq(second.result, "landed", "matching hashes land");
}));
await test("(INFERRED) A13 land re-hashes the run's test/probe files: a file edited after hashing is refused before any job, no metadata commit, nothing lands", async () => withWorld("hashbad", { hashes: "tampered" }, async (w) => {
  const before = await snapshot(w); const r = await attempt(() => callLand(w));
  if (r.error) ok(["EVIDENCE", "INVALID_INPUT", "GATE_RED", "INVALID_STATE"].includes(r.error.code), `a hash mismatch is an input/evidence error, got ${r.error.code}: ${r.error.message}`);
  else ok(r.value.result === "handback", `a hash mismatch must be refused (throw or handback), got ${JSON.stringify(r.value)}`);
  eq(w.jobs.spawns.length, 0, "no land job"); eq(laneTip(w), before.lane, "no metadata commit"); await assertMainUntouched(w, before);
}));

// ---------------------------------------------------------------------------------------------------------------------
// The release variable and the main checkout, as global invariants
// ---------------------------------------------------------------------------------------------------------------------
await test("production gate: across 21, 11, 12, 10, 14, 20 the engine never sets PANDACORP_OWNER_RELEASE_OK, never writes the main checkout and main never moves", async () => withWorld("sequence", {}, async (w) => {
  const before = await snapshot(w); await setMq(w, "21", "11", "12", "10", "14", "20");
  for (let i = 0; i < 6; i++) {
    const r = await attempt(async () => { const first = await callLand(w); if (first.result !== "running") return first; await w.jobs.runPending(); return callLand(w); });
    ok(!r.error || r.error.code !== undefined, `step ${i}: no obscure crash (${r.error ? r.error.message : ""})`);
    await assertNoReleaseVar(w); await assertMainUntouched(w, before);
  }
  eq(mainTip(w), before.main, "main never moved while the queue kept refusing");
  ok(w.jobs.spawns.length >= 1 && (await readFile(w.log, "utf8")).length > 0, "the queue was exercised");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed (${path.basename(fileURLToPath(import.meta.url))})`);
await rm(SANDBOX, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
