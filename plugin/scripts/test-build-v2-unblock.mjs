#!/usr/bin/env node
// test-build-v2-unblock.mjs: BL-0312 (re-admit an env-infra handed-back unit), BL-0313 is covered in test-build-v2-workers.mjs
// and test-codex-worker-direct.mjs, BL-0314 (docs units may write root DESIGN.md) is covered here too.
// Contract pinned (plugin/docs/build-engine-cli.md 3.14b `unblock`, 3.1 `start --resume --unblock`):
//   - only a `blocked` docs/tests/build/patch unit whose LATEST hand-back names it as the root with cause env-infra is
//     re-admitted; any other cause, a dependent, a non-blocked unit, a doubt consult or a missing reason is refused;
//   - the unit and the dependents that hand-back blocked return to `queued` at the SAME attempt (no budget spent), the
//     env-infra streak resets, WOs go BLOCKED -> PLANNED with one integration commit, the decisions entry is resolved,
//     report.json is kept as report-a<n>-blocked.json and the next brief says it resumes;
//   - the preserved worktree (uncommitted work included) is reused untouched by the next dispatch;
//   - journal replay (rebuild-state) agrees with the written state;
//   - `start --resume --unblock` reopens a FINISHED run; without --unblock a finished run stays refused.
// Run: node plugin/scripts/test-build-v2-unblock.mjs
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture, DEFAULT_NOW, git, testEnv } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.stack || e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };
const rejects = async (promise, code, message, match = null) => {
  try { await promise; } catch (e) {
    if (e.code !== code) throw new Error(`${message}: expected ${code}, got ${e.code}: ${e.message}`);
    if (match && !match.test(e.message)) throw new Error(`${message}: message ${JSON.stringify(e.message)} does not match ${match}`);
    return e;
  }
  throw new Error(`${message}: expected ${code}, nothing was thrown`);
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "pandacorp-build.mjs");
const F = await import("../runtime/build/failure.mjs");
const bs = await import("../runtime/build-state.mjs");
const { newState, newUnit, writeState, readState, fencedTwoPhase, rebuildState } = await import("../runtime/build/state.mjs");
const { appendEvent, readJournal } = await import("../runtime/build/journal.mjs");
const { buildPaths } = await import("../runtime/build/paths.mjs");
const { prepareUnitWorktree, writeUnitBrief, isAllowedPath, allowlistPatterns } = await import("../runtime/build/units.mjs");
const { DOCS_GLOBS } = await import("../runtime/build/planner.mjs");
const { executionsUsed } = await import("../runtime/build/failure/policy.mjs");

const scratch = await mkdtemp(path.join(os.tmpdir(), "pc-unblock-"));
let counter = 0;
const RUN = "run-u1";
const ROOT = "u-build-WO-01-001";
const DEP = "u-build-WO-01-002";
const OTHER = "u-build-WO-02-001";

const sandbox = async (preset = "basic") => {
  const dir = path.join(scratch, `t${counter++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture(preset, { dir });
  const env = fx.env({});
  return { dir, fx, env, project: fx.root, deps: { env, clock: () => new Date(DEFAULT_NOW), bootstrap: false }, p: buildPaths(fx.root, { env }) };
};
const U = (id, extra = {}) => newUnit({ id, kind: "build", wos: [id.replace("u-build-", "")], frd: "frd-01-alpha", state: "running", ...extra });
const mkState = (units) => newState({
  run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature",
  scope: { card: null, frds: ["frd-01-alpha", "frd-02-beta"], wos: [], out_of_scope: [] },
  integration: { branch: "x", worktree: "/nonexistent", base_sha: "0".repeat(40) }, units,
});
/** A run on disk with a held lease, an integration worktree and a REAL worktree for the root unit (dirty). */
const seedRun = async (sb, units) => {
  const lease = await bs.acquire(sb.project, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const branch = sb.p.integrationBranch(RUN); const worktree = sb.p.integrationWorktree;
  git(sb.project, ["worktree", "add", "-b", branch, worktree, "main"]);
  const st0 = { ...mkState(units), epoch: lease.epoch, integration: { branch, worktree, base_sha: git(sb.project, ["rev-parse", "main"]) } };
  await writeState(sb.project, st0, { env: sb.env });
  await appendEvent(sb.p.journalFile, { run_id: RUN, epoch: lease.epoch, type: "run_started", data: { detect: {}, preflight: {}, state: st0 } }, { env: sb.env, clock: () => new Date(DEFAULT_NOW) });
  const wt = await prepareUnitWorktree({ project: sb.project, runId: RUN, unit: ROOT, attempt: 1 }, sb.deps);
  await writeFile(path.join(wt.root, "src/alpha/list.ts"), "export const list = ['work done before the sandbox failed'];\n");
  await writeFile(path.join(wt.root, "src/alpha/new-file.ts"), "export const fresh = 1;\n");
  const st = { ...st0, units: st0.units.map((u) => (u.id === ROOT ? { ...u, worktree: wt.worktree, branch: wt.branch } : u)) };
  await writeState(sb.project, st, { env: sb.env });
  await mkdir(sb.p.unitDir(ROOT), { recursive: true });
  await writeFile(sb.p.reportFile(ROOT), JSON.stringify({ schema: 1, unit: ROOT, status: "blocked", summary: "work done; the test Postgres was unreachable" }));
  return { lease, wt };
};
const inPhase2 = (sb, lease, fn) => fencedTwoPhase({ project: sb.project, epoch: lease.epoch, deps: sb.deps }, undefined, undefined, (_r, _i, ctx) => fn(ctx));
const handBackIn = (sb, lease, input) => inPhase2(sb, lease, (ctx) => F.handBack(ctx, input, sb.deps));
const ENV_HB = { unitId: ROOT, cause: "env-infra", reasonCode: "worker_blocked", reason: "database-clean: Operation not permitted on the local Postgres log" };
const unblock = (sb, lease, extra = {}) => F.unblockCommand({ project: sb.project, epoch: lease.epoch, unit: ROOT, reason: "the test Postgres is now reached over TCP", ...extra }, sb.deps);
const woStatus = async (sb, id) => {
  const dir = path.join(sb.p.integrationWorktree, "docs/frds", id.startsWith("WO-01") ? "frd-01-alpha" : "frd-02-beta", "work-orders");
  const { readdir } = await import("node:fs/promises");
  const name = (await readdir(dir)).find((n) => n.toLowerCase().startsWith(id.toLowerCase()));
  const text = await readFile(path.join(dir, name), "utf8");
  return { status: text.match(/^implementation_status:\s*(\S+)/m)?.[1], blockedReason: /^blocked_reason:/m.test(text) };
};
const units3 = () => [U(ROOT), U(DEP, { state: "queued", depends_on: [ROOT] }), U(OTHER, { state: "queued", frd: "frd-02-beta" })];

// ------------------------------------------------------------------------------------------------- happy path
await test("unblock re-admits the env-infra root and its dependent at the SAME attempt; the independent unit is untouched", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    const back = await handBackIn(sb, lease, ENV_HB);
    eq(back.blocked.map((b) => b.unit).sort(), [ROOT, DEP].sort(), "the hand-back blocked root + dependent");
    eq((await woStatus(sb, "WO-01-001")).status, "BLOCKED", "root WO BLOCKED after the hand-back");
    eq((await readState(sb.project, { env: sb.env })).handbacks_in_a_row, 1, "env-infra streak counted");

    const res = await unblock(sb, lease);
    eq(res.ok, true, "ok"); eq(res.cmd, "unblock", "cmd");
    eq(res.units.sort(), [ROOT, DEP].sort(), "root and dependent come back");
    eq(res.attempt, 1, "same attempt");
    const st = await readState(sb.project, { env: sb.env });
    eq(st.units.map((u) => [u.id, u.state, u.attempt]), [[ROOT, "queued", 1], [DEP, "queued", 1], [OTHER, "queued", 1]], "states after unblock");
    eq(st.handbacks_in_a_row, 0, "the env-infra streak resets");
    eq(executionsUsed(st, ["WO-01-001"]), 1, "no execution of the per-WO budget was spent");
    for (const wo of ["WO-01-001", "WO-01-002"]) { const s = await woStatus(sb, wo); eq(s.status, "PLANNED", `${wo} back to PLANNED`); ok(!s.blockedReason, `${wo} blocked_reason removed`); }
    const msg = git(sb.p.integrationWorktree, ["log", "-1", "--format=%B"]);
    ok(/^chore\(build\): unblock u-build-WO-01-001/m.test(msg) && /^Unit: u-build-WO-01-001$/m.test(msg) && /^WO: WO-01-001$/m.test(msg), `one integration commit with trailers: ${msg}`);
    eq(git(sb.p.integrationWorktree, ["status", "--porcelain"]), "", "integration worktree clean after the commit");
    ok(res.commit && res.commit === git(sb.p.integrationWorktree, ["rev-parse", "HEAD"]), "returned commit is HEAD");
    ok(/Unidad reanudada: u-build-WO-01-001/.test(res.notice_es) && /mismo intento 1/.test(res.notice_es), `Spanish notice: ${res.notice_es}`);
  } finally { await sb.fx.cleanup(); }
});

await test("the preserved dirty worktree is reused untouched and the previous report is kept aside and named in the brief", async () => {
  const sb = await sandbox();
  try {
    const { lease, wt } = await seedRun(sb, units3());
    await handBackIn(sb, lease, ENV_HB);
    const res = await unblock(sb, lease);
    eq(res.worktree, wt.worktree, "worktree reported");
    ok(res.worktree_changes >= 2, `uncommitted changes counted (${res.worktree_changes})`);
    ok(!existsSync(sb.p.reportFile(ROOT)), "report.json no longer at report_path");
    const kept = path.join(sb.p.unitDir(ROOT), "report-a1-blocked.json");
    eq(res.previous_report, kept, "previous report path"); ok(/unreachable/.test(await readFile(kept, "utf8")), "previous report content kept");
    // The next dispatch of the same attempt reuses the registered worktree, uncommitted work included.
    const again = await prepareUnitWorktree({ project: sb.project, runId: RUN, unit: ROOT, attempt: 1 }, sb.deps);
    eq(again.created, false, "worktree reused, not re-created"); eq(again.worktree, wt.worktree, "same path");
    ok(/work done before the sandbox failed/.test(await readFile(path.join(again.root, "src/alpha/list.ts"), "utf8")), "modified file kept");
    ok(existsSync(path.join(again.root, "src/alpha/new-file.ts")), "untracked file kept");
    const st = await readState(sb.project, { env: sb.env });
    const unit = st.units.find((u) => u.id === ROOT);
    const brief = await writeUnitBrief({ project: sb.project, state: st, unit, cell: { runtime: "codex", model: "sol", effort: "high" }, agentType: "pandacorp:implementer", token: "t".repeat(64), schemaPath: "" }, { ...sb.deps, pluginRoot: path.resolve(HERE, "..") });
    ok(/Resumed attempt 1/.test(brief.text) && /TCP/.test(brief.text), "brief says the attempt resumes and why");
    ok(brief.text.includes(kept), "brief names the previous report");
    const later = await writeUnitBrief({ project: sb.project, state: st, unit: { ...unit, attempt: 2 }, cell: { runtime: "codex", model: "sol", effort: "high" }, agentType: "pandacorp:implementer", token: "t".repeat(64), schemaPath: "", worktree: wt.worktree }, { ...sb.deps, pluginRoot: path.resolve(HERE, "..") });
    ok(!/Resumed attempt/.test(later.text), "a later attempt never sees the resume note");
  } finally { await sb.fx.cleanup(); }
});

await test("journal replay agrees: rebuild-state yields the same unit states and streak", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    await handBackIn(sb, lease, ENV_HB);
    await unblock(sb, lease);
    const { events } = await readJournal(sb.p.journalFile, { env: sb.env });
    const ev = events.find((e) => e.type === "unblocked");
    ok(ev && ev.data.unit === ROOT && ev.data.cause === "env-infra" && ev.data.attempt === 1, `unblocked event: ${JSON.stringify(ev?.data)}`);
    const { state } = await rebuildState({ project: sb.project, deps: { env: sb.env } });
    const cached = await readState(sb.project, { env: sb.env });
    eq(state.units.map((u) => [u.id, u.state, u.attempt]), cached.units.map((u) => [u.id, u.state, u.attempt]), "replayed units = cached units");
    eq(state.handbacks_in_a_row, 0, "replayed streak reset");
  } finally { await sb.fx.cleanup(); }
});

await test("the decisions inbox entry of the hand-back is marked resolved (tracked inbox committed on integration)", async () => {
  const sb = await sandbox("tracked-decisions");
  try {
    const { lease } = await seedRun(sb, units3());
    await handBackIn(sb, lease, ENV_HB);
    const inbox = path.join(sb.p.integrationWorktree, ".pandacorp/inbox/decisions.md");
    ok(/con la unidad u-build-WO-01-001, que el motor[\s\S]*?Estado:\*\* PENDIENTE/.test(await readFile(inbox, "utf8")), "pending entry written by the hand-back");
    await unblock(sb, lease);
    const text = await readFile(inbox, "utf8");
    ok(/Estado:\*\* RESUELTO: entorno arreglado, unidad reanudada/.test(text) && !/Estado:\*\* PENDIENTE/.test(text), `entry resolved: ${text.slice(0, 600)}`);
    eq(git(sb.p.integrationWorktree, ["status", "--porcelain"]), "", "tracked inbox committed");
  } finally { await sb.fx.cleanup(); }
});

// ------------------------------------------------------------------------------------------------- adversarial
await test("refusals: wrong epoch, dependent, non-env cause, not blocked, missing reason, doubt consult, second unblock", async () => {
  const sb = await sandbox();
  try {
    const consult = newUnit({ id: "u-consult-d1", kind: "doubt-consult", wos: [], frd: null, state: "blocked", doubt_id: "d-1" });
    const { lease } = await seedRun(sb, [...units3(), U("u-build-WO-02-002", { state: "running", frd: "frd-02-beta" }), consult]);
    await rejects(F.unblockCommand({ project: sb.project, epoch: lease.epoch, unit: ROOT, reason: "x" }, sb.deps), "INVALID_INPUT", "a queued/running unit", /not blocked/);
    await handBackIn(sb, lease, ENV_HB);
    await handBackIn(sb, lease, { unitId: "u-build-WO-02-002", cause: "code", reasonCode: "budget_exhausted", reason: "three failures" });
    const before = JSON.stringify(await readState(sb.project, { env: sb.env }));
    await rejects(F.unblockCommand({ project: sb.project, epoch: lease.epoch + 7, unit: ROOT, reason: "x" }, sb.deps), "FENCE", "wrong epoch");
    const dep = await rejects(unblock(sb, lease, { unit: DEP }), "INVALID_INPUT", "a dependent", /dependent of u-build-WO-01-001/);
    eq(dep.root, ROOT, "the refusal names the root");
    await rejects(unblock(sb, lease, { unit: "u-build-WO-02-002" }), "INVALID_INPUT", "a code hand-back", /not env-infra/);
    await rejects(unblock(sb, lease, { reason: "  " }), "USAGE", "a blank reason");
    await rejects(unblock(sb, lease, { unit: "u-consult-d1" }), "INVALID_INPUT", "a doubt consult", /doubt-consult unit/);
    await rejects(unblock(sb, lease, { unit: "u-nope" }), "INVALID_STATE", "an unknown unit");
    eq(JSON.stringify(await readState(sb.project, { env: sb.env })), before, "no refusal changed the state");
    eq((await woStatus(sb, "WO-01-001")).status, "BLOCKED", "no refusal touched a WO");
    await unblock(sb, lease);
    await rejects(unblock(sb, lease), "INVALID_INPUT", "a second unblock", /not blocked/);
    eq((await readState(sb.project, { env: sb.env })).units.find((u) => u.id === "u-build-WO-02-002").state, "blocked", "the code hand-back stays blocked");
  } finally { await sb.fx.cleanup(); }
});

await test("a dependent re-blocked by a LATER hand-back of its own stays blocked when the first root is unblocked", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    await handBackIn(sb, lease, ENV_HB);
    // Craft the later hand-back event the way replay would see it (the dependent's own budget-exhausted hand-back).
    await inPhase2(sb, lease, async (ctx) => { await ctx.appendEvent({ type: "handback", data: { unit: DEP, cause: "code", reason_code: "budget_exhausted", reason: "own failure", attempt: 1, path: null, blocked: [DEP] } }); });
    const res = await unblock(sb, lease);
    eq(res.units, [ROOT], "only the root comes back");
    eq((await readState(sb.project, { env: sb.env })).units.find((u) => u.id === DEP).state, "blocked", "dependent stays blocked");
  } finally { await sb.fx.cleanup(); }
});

await test("hand-back text names the real recovery command for env-infra and keeps the generic options otherwise", async () => {
  const { handbackMarkdown, handbackDecisionEntry } = await import("../runtime/build/failure/handbackText.mjs");
  const info = (cause) => ({ unit: ROOT, wos: ["WO-01-001"], cause, reasonCode: "worker_blocked", reason: "x", attempt: 1, date: "2026-11-13", path: "/p/h.md", failure: null, diagnosis: null, attempts: [], preserved: [], blockedUnits: [ROOT], skippedWos: [] });
  const env = handbackMarkdown(info("env-infra"));
  ok(env.includes(`unblock --epoch <E> --unit ${ROOT}`) && env.includes(`start --resume --coordinator <C> --unblock ${ROOT}`), `env-infra names both forms: ${env}`);
  ok(handbackDecisionEntry(info("env-infra")).includes(`--unit ${ROOT}`), "the decisions entry names the command too");
  ok(!handbackMarkdown(info("code")).includes("unblock"), "a code hand-back never offers unblock");
});

// ------------------------------------------------------------------------------------------------- BL-0318
const BOOT_REASON = ".claude/launch.json: changed in the worktree but missing from report.files; e2e/server-env.json: changed in the worktree but missing from report.files; .claude/launch.json: outside the build write allowlist; e2e/server-env.json: outside the build write allowlist";
const codeHandback = async (sb, lease, reason) => {
  await writeFile(path.join(sb.p.unitDir(ROOT), "attempt-1.json"), JSON.stringify({ attempt: 1, outcome: "rejected", reason, failing: [], tail: "", diagnosis: null }));
  return handBackIn(sb, lease, { unitId: ROOT, cause: "code", reasonCode: "no_diagnosis", reason });
};
await test("BL-0318 rejectionOnlyBootstrap (pure)", async () => {
  ok(F.rejectionOnlyBootstrap(BOOT_REASON), "the funko rejection is bootstrap-only");
  ok(F.rejectionOnlyBootstrap("web/e2e/server-env.json: outside the build write allowlist"), "nested product prefix");
  ok(F.rejectionOnlyBootstrap(".env.local: changed in the worktree but missing from report.files"), ".env.local");
  ok(!F.rejectionOnlyBootstrap(`${BOOT_REASON}; src/alpha/list.ts: outside the build write allowlist`), "one real code path makes it a worker failure");
  ok(!F.rejectionOnlyBootstrap("G1 red: 2 failing tests"), "a gate failure is not bootstrap-only");
  ok(!F.rejectionOnlyBootstrap(""), "empty is not bootstrap-only");
  ok(!F.rejectionOnlyBootstrap("e2e/server-env.json.bak: outside the build write allowlist"), "a look-alike path is not bootstrap-only");
});
await test("BL-0318 unblock lifts a CODE hand-back whose rejection named only bootstrap files, at the same attempt", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    await codeHandback(sb, lease, BOOT_REASON);
    const res = await unblock(sb, lease, { reason: "bootstrap files restored; report now excludes them (BL-0318)" });
    eq(res.units.sort(), [ROOT, DEP].sort(), "root and dependent come back"); eq(res.attempt, 1, "same attempt");
    eq((await readState(sb.project, { env: sb.env })).units.find((u) => u.id === ROOT).state, "queued", "queued again");
    const { events } = await readJournal(sb.p.journalFile, { env: sb.env });
    const ev = events.find((e) => e.type === "unblocked");
    ok(ev?.data?.cause === "code" && ev?.data?.bootstrap_only === true, `journal marks the bootstrap-only lift: ${JSON.stringify(ev?.data)}`);
  } finally { await sb.fx.cleanup(); }
});
await test("BL-0318 adversarial: a CODE hand-back with any non-bootstrap reason stays the owner's decision", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    await codeHandback(sb, lease, `${BOOT_REASON}; src/alpha/list.ts: outside the build write allowlist`);
    await rejects(unblock(sb, lease), "INVALID_INPUT", "mixed rejection", /not env-infra/);
  } finally { await sb.fx.cleanup(); }
});
await test("BL-0318 adversarial: a budget-exhausted CODE hand-back with a bootstrap-looking journal reason but a real attempt reason is refused", async () => {
  const sb = await sandbox();
  try {
    const { lease } = await seedRun(sb, units3());
    await writeFile(path.join(sb.p.unitDir(ROOT), "attempt-1.json"), JSON.stringify({ attempt: 1, outcome: "rejected", reason: "G1 red: src/alpha/_tests/list.test.ts failed", failing: ["list"], tail: "", diagnosis: null }));
    await handBackIn(sb, lease, { unitId: ROOT, cause: "code", reasonCode: "budget_exhausted", reason: ".claude/launch.json: outside the build write allowlist" });
    await rejects(unblock(sb, lease), "INVALID_INPUT", "attempt record wins over the journal text", /not env-infra/);
  } finally { await sb.fx.cleanup(); }
});

// ------------------------------------------------------------------------------------------------- CLI end to end
const cli = (sb, args, env = sb.env) => {
  const r = spawnSync(process.execPath, [CLI, ...args, "--project", sb.project], { env, encoding: "utf8", timeout: 60000 });
  const lines = (r.stdout || "").split("\n").filter((l) => l.trim());
  let json = null; try { json = JSON.parse(lines.at(-1)); } catch { json = null; }
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
};
const need = (r, what, code = 0) => { if (r.code !== code) throw new Error(`${what}: exit ${r.code}; ${r.stdout?.slice(0, 400)} ${r.stderr?.slice(0, 400)}`); return r.json; };

await test("CLI: `unblock` on an active run and `start --resume --unblock` on a FINISHED run; plain resume of a finished run stays refused", async () => {
  const dir = path.join(scratch, `cli${counter++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture("basic", { dir });
  const env = testEnv(dir, {}); await mkdir(env.HOME, { recursive: true }); await writeFile(env.PANDACORP_FAKE_WORKER_PLAN, "{}\n");
  const sb = { dir, fx, env, project: fx.root, deps: { env, clock: () => new Date(DEFAULT_NOW), bootstrap: false }, p: buildPaths(fx.root, { env }) };
  try {
    const det = need(cli(sb, ["start", "--detect"]), "detect");
    const scopeFile = path.join(dir, "scope.json"); await writeFile(scopeFile, JSON.stringify(det.scope));
    need(cli(sb, ["start", "--preflight", "--row", String(det.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet"]), "preflight");
    const start = need(cli(sb, ["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet"]), "start --run");
    const st0 = await readState(sb.project, { env });
    const unitId = st0.units.find((u) => u.kind === "build" && u.depends_on.length === 0)?.id;
    ok(unitId, `a root build unit exists: ${st0.units.map((u) => u.id).join(", ")}`);
    const lease = { epoch: start.epoch };
    await handBackIn(sb, lease, { ...ENV_HB, unitId });
    eq(need(cli(sb, ["unblock", "--epoch", String(start.epoch), "--unit", unitId]), "missing reason", 2)?.ok, false, "--reason required (exit 2)");
    const wrongCause = cli(sb, ["unblock", "--epoch", String(start.epoch), "--unit", st0.units.find((u) => u.id !== unitId && u.kind === "build").id, "--reason", "x"]);
    eq(wrongCause.code, 6, "a unit that is not an env-infra root exits 6");
    const out = need(cli(sb, ["unblock", "--epoch", String(start.epoch), "--unit", unitId, "--reason", "fixed the sandbox"]), "unblock");
    eq(out.cmd, "unblock", "cmd"); eq(out.unit, unitId, "unit");
    eq((await readState(sb.project, { env })).units.find((u) => u.id === unitId).state, "queued", "queued again");

    // Hand it back again, then end the run as `finished` the way `finish` leaves it (lease released).
    await handBackIn(sb, lease, { ...ENV_HB, unitId });
    need(cli(sb, ["stop", "--epoch", String(start.epoch)]), "stop");
    const stopped = await readState(sb.project, { env });
    await writeState(sb.project, { ...stopped, status: "finished", status_reason: null }, { env });
    eq(cli(sb, ["start", "--resume", "--coordinator", "claude"]).code, 5, "a finished run is not resumable without --unblock");
    eq(cli(sb, ["start", "--resume", "--coordinator", "claude", "--reason", "x"]).code, 2, "--reason alone is a usage error");
    const badDep = cli(sb, ["start", "--resume", "--coordinator", "claude", "--unblock", "u-nope", "--reason", "x"]);
    eq(badDep.code, 5, "an unknown unit is refused before the lease is taken");
    ok(!existsSync(sb.p.leaseFile), "the refusal took no lease");
    const r = need(cli(sb, ["start", "--resume", "--coordinator", "claude", "--session-model", "sonnet", "--unblock", unitId, "--reason", "fixed the sandbox again"]), "resume --unblock");
    ok(r.epoch > start.epoch, "epoch advanced"); eq(r.unblocked?.unit, unitId, "unblocked payload");
    const st = await readState(sb.project, { env });
    eq(st.status, "active", "the run is active again"); eq(st.units.find((u) => u.id === unitId).state, "queued", "unit queued");
    const next = need(cli(sb, ["next", "--epoch", String(r.epoch)]), "next after reopen");
    ok(next.action !== "done", `next no longer says done (${next.action})`);
    need(cli(sb, ["stop", "--epoch", String(r.epoch)]), "stop at the end");
  } finally {
    try { const j = JSON.parse(await readFile(sb.p.driveStandbyFile, "utf8")); if (j.pid) process.kill(j.pid, "SIGKILL"); } catch { /* none */ }
    await fx.cleanup();
  }
});

// ------------------------------------------------------------------------------------------------- BL-0314
await test("BL-0314: docs units may write root DESIGN.md (exactly), nothing else new", async () => {
  ok(isAllowedPath("docs", [], "DESIGN.md"), "root DESIGN.md allowed for docs");
  for (const rel of ["src/DESIGN.md", "DESIGN.md.bak", "design/DESIGN.md", "DESIGN.mdx", "XDESIGN.md", "design.md"]) ok(!isAllowedPath("docs", [], rel), `${rel} refused for docs`);
  ok(isAllowedPath("docs", [], "docs/design/explore.md") && isAllowedPath("docs", [], "README.md") && isAllowedPath("docs", [], ".env.example"), "previous docs surface kept");
  ok(!isAllowedPath("build", ["src/alpha/list.ts"], "DESIGN.md"), "a build unit still writes only its artifacts");
  ok(!isAllowedPath("tests", [], "DESIGN.md"), "a tests unit cannot write DESIGN.md");
  ok(allowlistPatterns("docs").includes("DESIGN.md"), "the brief prints DESIGN.md in the docs allowlist");
  ok(DOCS_GLOBS.includes("DESIGN.md"), "the planner's docs artifacts include DESIGN.md (overlap with a WO that writes it)");
});

await rm(scratch, { recursive: true, force: true });
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
