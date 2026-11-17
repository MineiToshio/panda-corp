// Small incident regressions: isolated git fixtures, real engine transitions, no provider/model calls.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createFixture, git, testEnv, FAKE_WORKER_BIN } from "./fixtures/build-v2/make-fixture.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import * as st from "../runtime/build/state.mjs";
import * as adm from "../runtime/build/admission.mjs";
import * as jr from "../runtime/build/journal.mjs";
import * as bs from "../runtime/build-state.mjs";
import { ingestReport, resumeApprovedGates } from "../runtime/build/report.mjs";
import { planAnswer } from "../runtime/build/answers/plan.mjs";
import { planTestRepair, settleTestRepairs, doubtBasis } from "../runtime/build/recovery.mjs";
import { atomicWriteJson, sha256Hex } from "../runtime/build/fsx.mjs";
import { chooseTerminal, runningSummary } from "../runtime/build/next/terminal.mjs";
import { blockedClosure, depsMet, batchState } from "../runtime/build/next/scope.mjs";
import { isRepeatDoubt } from "../runtime/build/doubts/repeat.mjs";
import { vetoReasons } from "../runtime/build/doubts/veto.mjs";
import { launchWorker, pollWorker, reportEnvelope, buildWorkerArgv } from "../runtime/build/workers.mjs";
import { prepareSwcCache } from "../runtime/build/units/worktrees.mjs";
import { plan } from "../runtime/build/planner.mjs";
import { observeTechnicalFailure, recordTechnicalFailure, recoverTechnicalStall, advanceRescues, rescueResult } from "../runtime/build/rescue.mjs";
import { integrateCommitted, transitionWorkOrders } from "../runtime/build/integrate.mjs";
import { finishRun } from "../runtime/build/lifecycle.mjs";
import { withEngineRecovery } from "../runtime/build/failure.mjs";
import { runningWorktreePaths } from "./worktree-sweep.mjs";
import { enterCapacityWaiting, wakeCapacity } from "../runtime/capacity/scheduler.mjs";
import { integrateStep } from "../runtime/build/next/integration.mjs";

const FRD = "frd-01-alpha", RUN = "finish-regression", FILE = "src/alpha/list.ts", ORACLE = "src/alpha/_tests/params.test.mjs";
const write = async (root, rel, data) => { const file = path.join(root, rel); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data); };
const verify = `#!/bin/bash
for arg in "$@"; do case "$arg" in --tests=*) node --test "\${arg#--tests=}"; exit $?;; esac; done
exit 0
`;

test("rescue detection: same class and file twice; different causes do not qualify", () => {
  const state = st.newState({ units: [st.newUnit({ id: "u-build", kind: "build" })] });
  const a = { code: "TypeError", files: [FILE], detail: "parser failed" };
  const first = observeTechnicalFailure(state, "u-build", a);
  assert.equal(first.action, "retry");
  const other = observeTechnicalFailure(first.state, "u-build", { ...a, code: "EIO" });
  assert.equal(other.action, "retry");
  assert.equal(observeTechnicalFailure(other.state, "u-build", { ...a, files: ["src/other.ts"] }).action, "retry");
  const repeated = observeTechnicalFailure(other.state, "u-build", { ...a, detail: "different wording" });
  assert.equal(repeated.action, "rescue");
  assert.equal(st.findUnit(repeated.state, "u-build").state, "rescue");
  assert.equal(repeated.state.status, "active");
});

test("rescue: all four actual human gates stay gated; technical parking recovers", () => {
  for (const gate of ["production", "money", "delete", "external"]) {
    const state = st.newState({ units: [st.newUnit({ id: "u-gate", kind: "build", state: "waiting_gate", waiting_gate: gate })] });
    assert.equal(chooseTerminal(state, {}).status, "waiting_gate");
    const failed = observeTechnicalFailure(state, "u-gate", { code: "EIO" });
    assert.equal(failed.action, "gate");
    assert.deepEqual(failed.state, state);
  }
  const state = st.newState({ units: [st.newUnit({ id: "u-tech", kind: "build", parked: "owner_question" })] });
  assert.equal(chooseTerminal(state, {}).action, "recover");
});

const startRescue = async c => {
  const unit = await c.dispatch({ id: "u-rescue", kind: "build" });
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), unit.id, { worker: { runtime: "codex", model: "sol", effort: "medium", via: "session", pid: null, worker_id: null } }));
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, unit.id, { code: "no_progress", files: [FILE], detail: "artifact fence prevented completion" }, c.deps);
  const out = await advanceRescues(c.ref, c.deps);
  assert.equal(out.action, "rescue"); assert.equal(out.rescue.via, "session");
  const body = await fs.readFile(out.rescue.brief_path, "utf8");
  assert.match(body, /WO-01-001/); assert.match(body, /Protected hashes/); assert.match(body, /artifact fence/);
  return { unit, out };
};
const rescueReport = async (c, out, status = "done", author = { runtime: "codex", model: "sol", effort: "medium" }) => {
  await atomicWriteJson(out.rescue.report_path, { status, summary: "supervised fixture", authored_by: author, gate: null });
  return rescueResult({ ...c.ref, unit: out.rescue.unit, token: out.rescue.token, file: out.rescue.report_path }, c.deps);
};

for (const dead of [true, false]) test(`rescue retires the previous writer; reuses its checkout only with positive termination (${dead})`, () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-live-writer", kind: "build" });
  const worker = { runtime: "codex", model: "sol", effort: "medium", via: "cli", pid: 123456, worker_id: "old-writer" };
  const job = { id: "old-writer", kind: "worker", unit: unit.id, frd: FRD, pid: worker.pid, cwd: unit.worktree, h_slot: false, started_at: new Date().toISOString(), state: "running", exit: null, worker_id: "old-writer" };
  await c.ctx.writeState({ ...st.patchUnit(await c.ctx.readState(), unit.id, { worker }), jobs: [job] });
  await c.ctx.appendEvent({ type: "job_started", data: job });
  const calls = [];
  c.deps.workers = { stopWorkers: async (_project, ids) => { calls.push(ids); return ids; }, peekWorker: () => ({ state: dead ? "dead" : "running", pid: worker.pid }) };
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, unit.id, { code: "EIO", detail: "scheduler read failed" }, c.deps);
  const retired = await c.ctx.readState();
  assert.equal(runningSummary(retired).any, false, "an unreadable old job cannot keep the scheduler waiting forever");
  assert.equal(st.foldJournal((await jr.readJournal(c.paths.journalFile)).events).jobs[0].state, "done", "job retirement survives replay");
  const out = await advanceRescues(c.ref, c.deps);
  assert.deepEqual(calls, [["old-writer"]]);
  assert.equal(out.rescue.worktree === unit.worktree, dead);
  if (!dead) {
    const current = st.findUnit(await c.ctx.readState(), unit.id);
    assert.equal(current.rescue.displaced_worker.worktree, unit.worktree);
    assert.ok(runningWorktreePaths(await c.ctx.readState(), { isAlive: () => true }).includes(unit.worktree));
    assert.match(await fs.readFile(out.rescue.brief_path, "utf8"), /read-only inspection/);
    await write(out.rescue.worktree, FILE, "export const recovered = true;\n");
    assert.equal((await rescueReport(c, out)).outcome, "review");
  }
}));

test("rescue isolates a native agent whose termination cannot be proven by the CLI", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-native-writer", kind: "build" });
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), unit.id, { worker: { runtime: "codex", model: "sol", effort: "medium", via: "agent", pid: null, worker_id: null } }));
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, unit.id, { code: "EIO" }, c.deps);
  const out = await advanceRescues(c.ref, c.deps);
  assert.notEqual(out.rescue.worktree, unit.worktree);
  assert.ok(runningWorktreePaths(await c.ctx.readState()).includes(unit.worktree));
}));

test("rescue success: independent fresh review, full verify, trailer, re-ingestion and next independent unit", () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  await write(unit.worktree, FILE, "export const rescued = true;\n");
  assert.equal((await rescueReport(c, out)).outcome, "review");
  let state = await c.ctx.readState(), current = st.findUnit(state, unit.id);
  assert.equal(current.state, "rescue"); // never integrated before independent review
  assert.match(git(unit.worktree, ["log", "-1", "--format=%B"]), /Rescue: u-rescue/);
  let reviewer;
  c.deps.workers = { launchWorker: async args => { reviewer = { runtime: args.cell.runtime, model: args.cell.model, effort: args.cell.effort }; return { ok: true, workerId: "independent-rescue-review" }; }, pollWorker: async () => ({ state: "done", outcome: "report", report: { status: "done", summary: "independent checks passed", authored_by: reviewer, gate: null } }) };
  const review = await advanceRescues(c.ref, c.deps);
  assert.equal(review.rescue.via, "cli");
  assert.notEqual(reviewer.effort, "medium");
  await advanceRescues(c.ref, c.deps);
  state = await c.ctx.readState(); current = st.findUnit(state, unit.id);
  assert.equal(current.state, "committed"); assert.equal(current.rescue.phase, "completed");
  const integration = await integrateCommitted({ state, keepWorktrees: true }, { ...c.deps, project: c.project });
  assert.ok(integration.integrated.some(x => x.unit === unit.id));
  const dependent = st.newUnit({ id: "u-next", kind: "build", depends_on: [unit.id] });
  assert.equal(depsMet({ ...integration.state, units: [...integration.state.units, dependent] }, dependent), true);
  assert.equal((await jr.readJournal(c.paths.journalFile)).events.some(e => e.type === "rescue_completed"), true);
}));

test("failed rescue: abandoned dependency, independent work continues, finish is completed_with_gaps", () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  let state = await c.ctx.readState();
  const independent = st.newUnit({ id: "u-independent", kind: "build", state: "queued" });
  const dependent = st.newUnit({ id: "u-dependent", kind: "build", depends_on: [unit.id], state: "running" });
  adm.issueToken(dependent.id, "B", { file: c.paths.admissionFile });
  const obsolete = { id: "dependent-worker", kind: "worker", unit: dependent.id, frd: FRD, pid: null, cwd: unit.worktree, h_slot: false, started_at: new Date().toISOString(), state: "running", exit: null, worker_id: "dependent-worker" };
  await c.ctx.writeState({ ...state, units: [...state.units, independent, dependent], jobs: [obsolete] });
  await c.ctx.appendEvent({ type: "unit_queued", data: dependent });
  await c.ctx.appendEvent({ type: "job_started", data: obsolete });
  assert.equal((await rescueReport(c, out, "failed")).outcome, "abandoned");
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).state, "abandoned");
  assert.equal(st.findUnit(state, dependent.id).state, "abandoned");
  assert.equal(st.findUnit(state, independent.id).state, "queued");
  assert.equal(state.status, "active");
  assert.equal(runningSummary(state).any, false, "abandoned dependency has no scheduler job left to poll");
  assert.ok(!Object.values(JSON.parse(await fs.readFile(c.paths.admissionFile, "utf8")).tokens).some(t => t.unit === dependent.id), "abandoned dependencies release admission for independent work");
  assert.equal(st.foldJournal((await jr.readJournal(c.paths.journalFile)).events).jobs[0].state, "done");
  await c.ctx.writeState(st.patchUnit(state, independent.id, { state: "landed" }));
  assert.equal(chooseTerminal(await c.ctx.readState(), {}).action, "done");
  const finished = await finishRun(c.ref, c.deps);
  assert.equal(finished.summary.status, "completed_with_gaps");
  assert.equal(finished.summary.gaps.length, 2);
  assert.match(await fs.readFile(finished.report_path, "utf8"), /u-dependent/);
}));

for (const attack of ["delete", "weaken", "gate"]) test(`rescue protects oracles against ${attack}`, () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  if (attack === "delete") await fs.unlink(path.join(unit.worktree, ORACLE));
  if (attack === "weaken") await write(unit.worktree, ORACLE, "// skip all assertions\n");
  if (attack === "gate") await write(unit.worktree, ".pandacorp/verify.sh", "exit 0\n");
  const result = await rescueReport(c, out);
  assert.equal(result.outcome, "abandoned"); assert.match(result.reason, /protected oracle/);
  assert.equal(st.findUnit(await c.ctx.readState(), unit.id).state, "abandoned");
}));

test("technical recovery never selects out-of-scope work", () => fixture(async c => {
  const outside = st.newUnit({ id: "u-outside", kind: "build", wos: ["WO-99-999"], state: "reported" });
  const inside = st.newUnit({ id: "u-inside", kind: "build", wos: ["WO-01-001"], state: "reported" });
  await c.ctx.writeState({ ...await c.ctx.readState(), units: [outside, inside] });
  await recoverTechnicalStall(c.ref, "no_progress", c.deps);
  await recoverTechnicalStall(c.ref, "no_progress", c.deps);
  const state = await c.ctx.readState();
  assert.equal(st.findUnit(state, outside.id).state, "reported");
  assert.equal(st.findUnit(state, inside.id).state, "rescue");
}));

test("rescue oracle repair: independent replacement refreshes causal base and resumes direct work", () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  await write(unit.worktree, FILE, "export const partial = true;\n");
  await atomicWriteJson(out.rescue.report_path, { status: "repair", summary: "installed framework rejects empty route", authored_by: { runtime: "codex", model: "sol", effort: "medium" }, gate: null,
    oracle_repair: { files: [ORACLE], contract: "AC-01-001.1: installed framework needs a sentinel", reason: "Replace incompatible empty route expectation; retain positive and malformed-input checks" } });
  assert.equal((await rescueResult({ ...c.ref, unit: unit.id, token: out.rescue.token, file: out.rescue.report_path }, c.deps)).outcome, "oracle_repair");
  let state = await c.ctx.readState();
  const repair = state.units.find(u => u.test_repair);
  assert.notEqual(repair.id, unit.id);
  const independent = await c.dispatch(repair);
  await write(independent.worktree, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], ['sentinel']); assert.notDeepEqual(['sentinel'], []);\n");
  const committed = await c.report(independent, [ORACLE]);
  assert.equal(committed.outcome, "committed");
  git(c.paths.integrationWorktree, ["merge", "--ff-only", committed.commit]);
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), repair.id, { state: "integrated" }));
  await c.ctx.appendEvent({ type: "integrated", data: { unit: repair.id, sha: committed.commit } });
  await settleTestRepairs(c.ctx, c.deps);
  state = await c.ctx.readState();
  const resumed = st.findUnit(state, unit.id);
  assert.equal(resumed.state, "rescue"); assert.equal(resumed.rescue.base, git(unit.worktree, ["rev-parse", "HEAD"]));
  assert.equal(await fs.readFile(path.join(unit.worktree, FILE), "utf8"), "export const partial = true;\n");
  const next = await advanceRescues(c.ref, c.deps);
  assert.equal((await rescueReport(c, next)).outcome, "review");
}));

test("rescue worker crash returns a scheduler action and preserves independent work", () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  await write(unit.worktree, FILE, "export const rescued = true;\n");
  assert.equal((await rescueReport(c, out)).outcome, "review");
  const independent = st.newUnit({ id: "u-independent", kind: "build", state: "queued" });
  await c.ctx.writeState({ ...await c.ctx.readState(), units: [...(await c.ctx.readState()).units, independent] });
  c.deps.workers = { launchWorker: async () => ({ ok: true, workerId: "crashed-rescue" }), pollWorker: async () => ({ state: "done", outcome: "failed", detail: "supervisor worker crashed" }) };
  await advanceRescues(c.ref, c.deps);
  const failed = await advanceRescues(c.ref, c.deps);
  assert.equal(failed.action, "rescue"); assert.equal(failed.outcome, "abandoned");
  const state = await c.ctx.readState();
  assert.equal(st.findUnit(state, independent.id).state, "queued");
  assert.equal(st.findUnit(state, independent.id).technical_failures, undefined);
  assert.equal(st.findUnit(state, unit.id).state, "abandoned");
}));

test("engine exceptions use the same repeated-cause rescue without releasing the lease", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-exception", kind: "build" });
  const failure = () => { throw Object.assign(new Error(`parser failed in ${FILE}`), { code: "EIO", unit: unit.id }); };
  const result = await withEngineRecovery({ ...c.ref, cmd: "next", step: failure }, { ...c.deps, rebuild: async () => {} });
  assert.equal(result.body.action, "rescue");
  const state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).state, "rescue");
  assert.equal(st.findUnit(state, unit.id).attempt, 1);
  assert.equal(state.status, "active"); assert.equal((await bs.currentLease(c.project)).epoch, c.ref.epoch);
  const folded = st.foldJournal((await jr.readJournal(c.paths.journalFile)).events);
  assert.equal(st.findUnit(folded, unit.id).state, "rescue");
}));

test("a corrupt state cache is replayed before recovery and never quiesces the owned lease", () => fixture(async c => {
  await c.dispatch({ id: "u-cache-replay", kind: "build" });
  await fs.writeFile(c.paths.stateFile, "{");
  const recovered = await withEngineRecovery({ ...c.ref, cmd: "next", step: () => c.ctx.readState() }, c.deps);
  assert.equal(recovered.status, "active");
  const lease = await bs.currentLease(c.project);
  assert.ok(lease && !lease.quiesced_at);
  const state = await c.ctx.readState();
  assert.equal(state.status, "active");
  assert.ok(st.findUnit(state, "u-cache-replay").technical_failures.length);
}));

test("rescue checkout cleanup requires positive termination evidence", () => {
  const unit = st.newUnit({ id: "u-cleanup", kind: "build", state: "abandoned", worktree: "/fixture/rescue", rescue: { worker: { workerId: "live", pid: 99 } } });
  assert.deepEqual(runningWorktreePaths({ units: [unit], jobs: [] }, { isAlive: () => true }), [unit.worktree]);
  assert.deepEqual(runningWorktreePaths({ units: [unit], jobs: [] }, { isAlive: () => false }), []);
});

test("rescue capacity wait persists resumeAt and participates in fenced automatic wake", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-capacity-rescue", kind: "build" });
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, unit.id, { code: "EIO", detail: "same fault" }, c.deps);
  const reset = Date.now() - 120000, resumeAt = new Date(reset).toISOString();
  const task = { id: unit.id, type: "implement", risk: "normal", complexity: "normal" };
  c.deps.routing = { builderCell: () => ({ paused: "quota", resumeAt, task }) };
  assert.equal(await advanceRescues(c.ref, c.deps), null);
  let state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).rescue.capacity_wait, resumeAt);
  await enterCapacityWaiting(c.ctx, state, resumeAt, c.deps);
  const now = Date.now();
  const readCapacity = () => Object.fromEntries(["claude", "codex"].map(tool => [tool, { schema: 1, tool, state: "known", observedAt: new Date(now).toISOString(), windows:
    (tool === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id => ({ id, scope: "all", applicability: "required", percentUsed: 0, resetsAt: new Date(now + 3600000).toISOString() })) }]));
  const wake = await wakeCapacity({ ...c.ref, owner: "lead" }, { ...c.deps, readCapacity });
  assert.equal(wake.claimed, true);
  state = await c.ctx.readState();
  assert.equal(state.status, "active"); assert.equal(st.findUnit(state, unit.id).state, "rescue");
  assert.equal((await bs.currentLease(c.project)).epoch, c.ref.epoch);
}));

test("a rescued FRD reviewer uses an isolated candidate and closes reviewed work only after independent integration", () => fixture(async c => {
  const work = st.newUnit({ id: "u-reviewed-build", kind: "build", frd: FRD, wos: ["WO-01-001"], state: "reviewing", worker: { runtime: "codex", model: "sol", effort: "high", via: "cli", pid: null, worker_id: "former-builder" } });
  const reviewer = st.newUnit({ id: "u-review-rescue", kind: "review", frd: FRD, wos: work.wos, depends_on: [work.id], state: "reported", worktree: c.paths.integrationWorktree, branch: c.paths.integrationBranch(RUN) });
  await c.ctx.writeState({ ...await c.ctx.readState(), units: [work, reviewer] });
  const integration = (await c.ctx.readState()).integration;
  await transitionWorkOrders({ integration, runId: RUN, wos: work.wos, to: "IN_PROGRESS", unitId: work.id }, c.deps);
  await transitionWorkOrders({ integration, runId: RUN, wos: work.wos, to: "IN_REVIEW", unitId: work.id }, c.deps);
  await c.ctx.appendEvent({ type: "unit_queued", data: work }); await c.ctx.appendEvent({ type: "unit_queued", data: reviewer });
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, reviewer.id, { code: "review_transport", detail: "reviewer could not file its result" }, c.deps);
  const out = await advanceRescues(c.ref, c.deps);
  assert.notEqual(out.rescue.worktree, c.paths.integrationWorktree);
  const integrationHead = git(c.paths.integrationWorktree, ["rev-parse", "HEAD"]);
  assert.equal((await rescueReport(c, out)).outcome, "review");
  let cell;
  c.deps.workers = { launchWorker: async args => { cell = { runtime: args.cell.runtime, model: args.cell.model, effort: args.cell.effort }; return { ok: true, workerId: "strong-review" }; }, pollWorker: async () => ({ state: "done", outcome: "report", report: { status: "done", summary: "review transport recovered and entire FRD verified", authored_by: cell, gate: null } }) };
  await advanceRescues(c.ref, c.deps);
  assert.notDeepEqual(cell, { runtime: "codex", model: "sol", effort: "high" }, "rescue reviewer also exceeds the actual source builder");
  await advanceRescues(c.ref, c.deps);
  let state = await c.ctx.readState();
  assert.equal(st.findUnit(state, work.id).state, "reviewing");
  assert.equal(git(c.paths.integrationWorktree, ["rev-parse", "HEAD"]), integrationHead);
  await integrateStep({ ref: { ...c.ref, deps: c.deps }, d: c.deps, paths: c.paths }, state, []);
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, work.id).state, "verified");
  assert.equal(st.findUnit(state, reviewer.id).state, "verified");
  assert.match(await fs.readFile(path.join(c.paths.integrationWorktree, `docs/frds/${FRD}/work-orders/wo-01-001.md`), "utf8"), /implementation_status: VERIFIED/);
}));

test("a rescued audit retains the original verified builder's stronger review floor", () => fixture(async c => {
  const source = { runtime: "codex", model: "astra", effort: "high", via: "cli", pid: null, worker_id: "source" };
  const work = st.newUnit({ id: "u-audited", kind: "build", frd: FRD, wos: ["WO-01-001"], state: "verified", worker: source });
  const audit = st.newUnit({ id: "u-audit-rescue", kind: "audit", state: "reported", worktree: c.paths.integrationWorktree, branch: c.paths.integrationBranch(RUN) });
  await c.ctx.writeState({ ...await c.ctx.readState(), units: [work, audit] });
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, audit.id, { code: "audit_transport" }, c.deps);
  const out = await advanceRescues(c.ref, c.deps);
  assert.equal((await rescueReport(c, out)).outcome, "review");
  const router = await import("../runtime/build/routing.mjs"); let demand;
  c.deps.routing = { builderCell: (unit, ctx) => { demand = unit; return router.builderCell(unit, ctx); } };
  c.deps.workers = { launchWorker: async () => ({ ok: true, workerId: "independent-audit-review" }) };
  await advanceRescues(c.ref, c.deps);
  assert.ok(demand.implementerCells.some(a => a.model === "astra" && a.effort === "high"));
}));

test("two unreadable rescue worker results abandon with an actionable scheduler response", () => fixture(async c => {
  const { unit, out } = await startRescue(c);
  assert.equal((await rescueReport(c, out)).outcome, "review");
  c.deps.workers = { launchWorker: async () => ({ ok: true, workerId: "unreadable-rescue" }), pollWorker: async () => ({ state: "error", kind: "transport", detail: "result read denied" }) };
  await advanceRescues(c.ref, c.deps);
  assert.equal((await advanceRescues(c.ref, c.deps)).action, "rescue");
  assert.equal(st.findUnit(await c.ctx.readState(), unit.id).state, "rescue");
  assert.equal((await advanceRescues(c.ref, c.deps)).outcome, "abandoned");
  assert.equal((await c.ctx.readState()).status, "active");
}));
async function fixture(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "finish-"));
  const fx = await createFixture("basic", { dir });
  const env = { ...testEnv(dir) }; delete env.PANDACORP_NOW;
  const saved = new Map(Object.keys(env).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    const project = fx.root, paths = buildPaths(project);
    await write(project, ".pandacorp/verify.sh", verify);
    await write(project, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], []);\n");
    git(project, ["add", "-A"]); git(project, ["commit", "-qm", "fixture oracle"]);
    const base = git(project, ["rev-parse", "HEAD"]), branch = paths.integrationBranch(RUN);
    git(project, ["worktree", "add", "-qb", branch, paths.integrationWorktree, "main"]);
    const lease = await bs.acquire(project, { runtime: "codex", runId: RUN, projectStatus: false, ttlSeconds: 1800 });
    await atomicWriteJson(paths.tokenFile, { token: lease.token, epoch: lease.epoch });
    const state = st.newState({ run_id: RUN, epoch: lease.epoch, coordinator: "codex-session", label: "codex", size: "feature",
      scope: { card: null, wos: ["WO-01-001"], frds: [FRD], out_of_scope: [] }, integration: { branch, worktree: paths.integrationWorktree, base_sha: base } });
    await st.writeState(project, state);
    await jr.appendEvent(paths.journalFile, { run_id: RUN, epoch: lease.epoch, actor: "cli", type: "run_started", data: { state } });
    const ref = { project, epoch: lease.epoch }, deps = { env, emit: async () => {}, notify: async () => {}, computeRisk: async () => ({ zone: "none", signals: { classify: [] }, failclosed: false }) };
    const ctx = { ...ref, paths, runId: RUN, readState: () => st.readState(project), writeState: s => st.writeState(project, s), appendEvent: e => jr.appendEvent(paths.journalFile, { ...e, run_id: RUN, epoch: lease.epoch, actor: "cli" }) };
    const dispatch = async fields => {
      const s = await ctx.readState(), token = adm.issueToken(fields.id, "B", { file: paths.admissionFile });
      const worktree = paths.unitWorktree(fields.id), branch = paths.unitBranch(RUN, fields.id);
      git(project, ["worktree", "add", "-qb", branch, worktree, s.integration.branch]);
      const unit = st.newUnit({ ...fields, frd: FRD, wos: ["WO-01-001"], state: "running", worktree, branch, token_hash: token.token_hash });
      await ctx.writeState({ ...s, units: [...s.units.filter(u => u.id !== unit.id), unit] });
      await ctx.appendEvent({ type: "unit_queued", data: unit });
      return { ...unit, token: token.token };
    };
    const report = async (unit, files) => {
      const file = paths.reportFile(unit.id);
      await atomicWriteJson(file, { schema: 1, unit: unit.id, token: unit.token, status: "done", summary: "regression change", authored_by: { runtime: "codex", model: "sol", effort: "high" }, files, verification: [], pending: [], diagnosis: null, doubt: null, gate: null });
      return ingestReport({ ...ref, unit: unit.id, token: unit.token, file }, deps);
    };
    await fn({ project, paths, ctx, ref, deps, dispatch, report, env });
  } finally {
    for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await fx.cleanup(); await fs.rm(dir, { recursive: true, force: true });
  }
}

test("F9: fix-test creates a separate verified oracle version before the same builder resumes", () => fixture(async c => {
  const old = sha256Hex(await fs.readFile(path.join(c.project, ORACLE)));
  let state = await c.ctx.readState();
  state.units.push(st.newUnit({ id: "u-tests", kind: "tests", state: "integrated", test_hashes: { [ORACLE]: old }, frd: FRD }));
  await c.ctx.writeState(state);
  const builder = await c.dispatch({ id: "u-build", kind: "build" });
  await write(builder.worktree, FILE, "export const preserved = 42;\n");
  state = await c.ctx.readState();
  state.units = state.units.map(u => u.id === builder.id ? { ...u, state: "parked", parked: "owner_question", pending_answer: "d-0001", doubt_id: "d-0001" } : u);
  const doubt = { id: "d-0001", unit: builder.id, step: "parked", question: `AC-01-001.1: ${ORACLE} expects [], installed framework rejects empty params`, why: "Use sentinel per the installed framework contract", options: [{ id: "fix-test", text: "correct oracle" }, { id: "keep-test", text: "keep" }], preferred: "fix-test" };
  const chosen = planAnswer({ state, question: doubt.id, value: "fix-test", doubt });
  await c.ctx.writeState(chosen.state);
  for (const e of chosen.events) await c.ctx.appendEvent(e);
  const repair = chosen.state.units.find(u => u.test_repair);
  assert.equal(repair.kind, "tests"); assert.notEqual(repair.id, builder.id);
  assert.equal(depsMet(chosen.state, st.findUnit(chosen.state, builder.id)), false);
  assert.throws(() => planTestRepair(chosen.state, doubt), /already has/);
  const round = plan({ wos: [{ id: "WO-01-001", frd: FRD, status: "IN_PROGRESS", deps: [], artifacts: [FILE], zone: "none", complexity: "normal" }], units: chosen.state.units, scope: chosen.state.scope, size: "feature" });
  assert.ok(round.round.includes(repair.id), JSON.stringify(round));
  assert.equal(round.round.includes(builder.id), false);
  const independent = await c.dispatch(repair);
  assert.notEqual(independent.worktree, builder.worktree);
  await write(independent.worktree, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], ['sentinel']); assert.notDeepEqual(['sentinel'], []);\n");
  const res = await c.report(independent, [ORACLE]);
  assert.equal(res.outcome, "committed", JSON.stringify(res));
  git(c.paths.integrationWorktree, ["merge", "--ff-only", res.commit]);
  state = await c.ctx.readState();
  await c.ctx.writeState(st.patchUnit(state, repair.id, { state: "integrated" }));
  await c.ctx.appendEvent({ type: "integrated", data: { unit: repair.id, sha: res.commit } });
  await settleTestRepairs(c.ctx, c.deps);
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, builder.id).attempt, 1);
  assert.equal(depsMet(state, st.findUnit(state, builder.id)), true);
  assert.equal(await fs.readFile(path.join(builder.worktree, FILE), "utf8"), "export const preserved = 42;\n");
  assert.equal(sha256Hex(await fs.readFile(path.join(builder.worktree, ORACLE))), st.findUnit(state, repair.id).test_hashes[ORACLE]);
  assert.equal(st.findUnit(state, repair.id).test_repair.old_hashes[ORACLE], old);
  assert.equal(st.findUnit(state, "u-tests").test_hashes[ORACLE], undefined);
  // The builder still cannot rewrite its new oracle.
  const tok = adm.issueToken(builder.id, "B", { file: c.paths.admissionFile });
  await c.ctx.writeState(st.patchUnit(state, builder.id, { state: "running", token_hash: tok.token_hash }));
  await write(builder.worktree, ORACLE, "throw new Error('builder cheating');\n");
  const refused = await c.report({ ...builder, token: tok.token }, [FILE, ORACLE]);
  assert.equal(refused.outcome, "rejected"); assert.match(refused.reasons.join(" "), /hashed test/);
}));

test("F4: an approved engine gate re-ingests the same SHA/report without a worker or attempt", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-gate", kind: "build" });
  await write(unit.worktree, FILE, "export const gate = true;\n");
  c.deps.computeRisk = async () => ({ failclosed: false, signals: { classify: [{ signal: "S8", detail: "actual deletion" }] } });
  const res = await c.report(unit, [FILE]); assert.equal(res.outcome, "waiting_gate", JSON.stringify(res));
  let state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).gate_report.commit, res.commit);
  const chosen = planAnswer({ state, question: `g-${unit.id}`, value: true });
  assert.equal(st.findUnit(chosen.state, unit.id).state, "reported");
  await c.ctx.writeState(chosen.state);
  await resumeApprovedGates(c.ref, c.deps);
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).state, "committed"); assert.equal(st.findUnit(state, unit.id).attempt, 1);
  assert.equal(git(unit.worktree, ["rev-parse", "HEAD"]), res.commit);
  assert.deepEqual(await resumeApprovedGates(c.ref, c.deps), []);
  assert.equal((await jr.readJournal(c.paths.journalFile)).events.filter(e => e.type === "report_received").at(-1).data.commit, res.commit);
}));

test("closure: integrated preparation waiting on its builder's gate never becomes no_progress", () => {
  const tests = st.newUnit({ id: "u-tests", kind: "tests", state: "integrated" });
  const docs = st.newUnit({ id: "u-docs", kind: "docs", state: "integrated" });
  const build = st.newUnit({ id: "u-build", kind: "build", state: "waiting_gate", waiting_gate: "delete", depends_on: [tests.id, docs.id] });
  const state = { scope: { card: "CR-1" }, units: [tests, docs, build], handbacks_in_a_row: 0 };
  assert.equal(blockedClosure(state).all.has(tests.id), true);
  assert.deepEqual(chooseTerminal(state, {}), { action: "waiting-owner", status: "waiting_gate", reason: "gate" });
  assert.deepEqual(chooseTerminal({ ...state, units: [tests, docs] }, {}), { action: "wait", reason: "closure" });
});

test("repeat: paraphrases share concrete contract/file identity until a causal oracle repair", () => {
  const a = { question: `The contract in ${ORACLE} expects []`, why: "AC-01-001.1", preferred: "fix-test", options: [{ id: "fix-test" }, { id: "keep-test" }], step: "decided", basis: JSON.stringify([[ORACLE, "old"]]) };
  const b = { ...a, question: `Cannot enumerate an empty route: correct ${ORACLE}`, preferred: "keep-test" };
  assert.equal(isRepeatDoubt(a, b, a.basis), true);
  const hashState = { units: [{ test_hashes: { [ORACLE]: "old", "src/other.test.mjs": "a" } }] };
  const basis = doubtBasis(hashState, {}, a); hashState.units[0].test_hashes["src/other.test.mjs"] = "b";
  assert.equal(doubtBasis(hashState, {}, a), basis);
  assert.equal(isRepeatDoubt(a, b, JSON.stringify([[ORACLE, "new"]])), false);
  const noPath = { ...b, question: "AC-01-001.1 still rejects the sentinel", why: "same contract" };
  assert.equal(isRepeatDoubt(a, noPath, doubtBasis(hashState, {}, noPath)), true);
  const c = { ...b, question: "A different contract", why: "AC-02-001.1" };
  assert.equal(isRepeatDoubt(a, c), false);
  assert.throws(() => planAnswer({ state: { units: [], answers: {} }, question: "d-0002", value: "keep-test", doubt: { ...b, id: "d-0002", step: "parked", repeated: true } }), /causal repair/);
});

test("F3: only proven own atomic temporary cleanup avoids S8; actual deletion remains gated", () => fixture(async c => {
  const script = path.resolve("plugin/scripts/classify-change.mjs"), text = path.join(c.project, "cleanup.ts");
  const source = 'import { randomUUID } from \"node:crypto\";\nimport { writeFile, rename, unlink } from \"node:fs/promises\";\nconst temporary = `${target}.${randomUUID()}.tmp`;\nawait writeFile(temporary, data);\nawait rename(temporary, target);\nawait unlink(temporary);\n';
  const classify = async code => { await fs.writeFile(text, code); return JSON.parse(execFileSync(process.execPath, [script, "--repo", c.project, "--files", "src/save.ts", "--text", text], { encoding: "utf8" }).trim().split("\n").at(-1)); };
  assert.equal((await classify(source)).floor_hits.some(h => h.signal === "S8"), false);
  const fsynced = source.replace("writeFile, rename, unlink", "open, rename, unlink").replace("await writeFile(temporary, data);", 'const handle = await open(temporary, "wx", 0o600); await handle.writeFile(data); await handle.sync(); await handle.close();');
  assert.equal((await classify(fsynced)).floor_hits.some(h => h.signal === "S8"), false);
  assert.equal((await classify(fsynced.replace('"wx"', '"w"'))).floor_hits.some(h => h.signal === "S8"), true);
  for (const unsafe of [source + "await unlink(target);\n", source + "function remove(temporary) { unlink(temporary); }\n", "await unlink(temporary);\n", source.replace("randomUUID()", "userInput"), source.replace("node:crypto", "./fake-crypto"), source.replace("await unlink(temporary)", "other.unlink(temporary)"), source.replace("await unlink(temporary)", "temporary = target; await unlink(temporary)")]) {
    assert.equal((await classify(unsafe)).floor_hits.some(h => h.signal === "S8"), true);
  }
  const shadowed = source.replace("const temporary", "async function remove(randomUUID, writeFile, rename) { const temporary") + "}";
  assert.equal((await classify(shadowed)).floor_hits.some(h => h.signal === "S8"), true);
  const destructured = source.replace("const temporary", "async function remove(input) { const { randomUUID, writeFile, rename } = input; const temporary") + "}";
  assert.equal((await classify(destructured)).floor_hits.some(h => h.signal === "S8"), true);
  const doubt = { question: "Which empty sentinel satisfies AC-01-001.1?", why: "a reversible contract correction", options: [{ text: "Use sentinel" }, { text: "Keep empty" }] };
  assert.equal(vetoReasons({ unit: { zone: "floor" }, doubt, risk: { zone: "floor", irreversible: true, failclosed: false }, text: { ok: true, hits: [] } }).length, 0);
  assert.equal(vetoReasons({ unit: { zone: "floor" }, doubt, text: { ok: true, hits: [{ signal: "S8", level: "critical" }] } }).some(r => r.reason === "irreversible"), true);
}));

test("F6: launcher envelope ignores copied model token; corrupt transport retries the same job", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-envelope", kind: "docs" });
  const brief = c.paths.briefFile(unit.id); await write(c.project, path.relative(c.project, brief), "Return fixture JSON only.");
  const planFile = path.join(c.project, "fake-plan.json");
  const report = { schema: 1, unit: unit.id, token: "WRONG-MODEL-COPY", status: "done", summary: "fixture", files: [], verification: [], pending: [], diagnosis: null, doubt: null, gate: null };
  // Fake worker's sealed payload comes from an explicit plan; no real provider is reachable.
  await atomicWriteJson(planFile, { [unit.id]: report });
  const deps = { ...c.deps, env: { ...c.env, PANDACORP_FAKE_WORKER: FAKE_WORKER_BIN, PANDACORP_FAKE_WORKER_PLAN: planFile } };
  const launched = await launchWorker({ project: c.project, runId: RUN, epoch: c.ref.epoch, unit: unit.id, token: unit.token,
    cell: { runtime: "codex", model: "sol", effort: "high" }, dir: unit.worktree, briefFile: brief }, deps);
  assert.equal(launched.ok, true, JSON.stringify(launched));
  let state = await c.ctx.readState();
  state = st.patchUnit(state, unit.id, { worker: { runtime: "codex", model: "sol", effort: "high", via: "cli", pid: null, worker_id: launched.workerId } });
  state.jobs.push({ ...launched.job, state: "running" }); await c.ctx.writeState(state);
  const input = { project: c.project, workerId: launched.workerId, unit: unit.id, epoch: c.ref.epoch, schemaFile: c.paths.schemaFile("report") };
  assert.equal(reportEnvelope(input).token, unit.token);
  assert.equal(reportEnvelope({ ...input, epoch: c.ref.epoch + 1 }).ok, false);
  const envelope = path.join(c.paths.build, "worker-envelopes", `${launched.workerId}.json`), original = await fs.readFile(envelope);
  await fs.writeFile(envelope, "{}");
  const denied = { ...deps, fs: { ...(await import("node:fs")), writeFileSync: () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); } } };
  const transport = await pollWorker(input, denied); assert.equal(transport.kind, "transport");
  assert.equal((await pollWorker(input, deps)).report.token, unit.token); // launcher receipt repairs the envelope
  await fs.writeFile(envelope, '{"token":{}}');
  const receipt = envelope.replace(/\.json$/, '.launch.json'); await fs.writeFile(receipt, '{"token":42}');
  const bad = await pollWorker(input, deps); assert.equal(bad.state, "error"); assert.equal(bad.kind, "transport");
  await fs.writeFile(envelope, original);
  const good = await pollWorker(input, deps);
  assert.equal(good.outcome, "report", JSON.stringify(good)); assert.equal(good.report.token, unit.token);
  assert.equal((await c.ctx.readState()).units.find(u => u.id === unit.id).attempt, 1);
}));

test("SWC: physical sandbox cache is probed, and unwritable/escaped cache uses a writable fallback", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-cache", kind: "build" });
  const alias = path.join(c.project, "checkout-alias"); await fs.symlink(unit.worktree, alias);
  const cached = await prepareSwcCache(alias, { env: { NEXT_SWC_PATH: "/cache/outside-sandbox" } });
  assert.equal(cached.root, await fs.realpath(unit.worktree)); assert.ok(cached.cache.startsWith(cached.root + path.sep));
  assert.equal((await fs.readdir(cached.cache)).length, 0);
  const injected = { ...fs, writeFile: async (file, ...args) => { if (file.includes('/swc/')) throw Object.assign(new Error('sandbox denied'), { code: 'EACCES' }); return fs.writeFile(file, ...args); } };
  const fallback = await prepareSwcCache(alias, { fs: injected, env: {} }); assert.ok(fallback.cache.endsWith("swc-worker"));
  const argv = buildWorkerArgv({ project: c.project, workerId: "w-cache", unit: unit.id, cell: { runtime: "codex", model: "sol", effort: "high" }, promptFile: c.paths.schemaFile("report"), dir: alias });
  assert.equal(argv.args[argv.args.indexOf("--dir") + 1], await fs.realpath(unit.worktree));
}));

// Independent review R1 probes P1-P7, asserting the safe outcomes.
import { harvest } from "../runtime/build/next/harvest.mjs";
import { assessBatch } from "../runtime/build/land/batch.mjs";

test("R1 P1: a reused atomic temp path never exempts deletion of foreign data", () => fixture(async c => {
  const source = 'import { randomUUID } from "node:crypto";\nimport { writeFile, rename, unlink } from "node:fs/promises";\nconst temporary = `${target}.${randomUUID()}.tmp`;\nawait writeFile(temporary, data);\nawait rename(temporary, target);\nawait rename(victim, temporary);\nawait unlink(temporary);\n';
  const file = path.join(c.project, "cleanup.ts");
  for (const code of [source, source.replace("rename(victim, temporary)", "rename(victim, `${temporary}`)"), source.replace("await rename(victim, temporary)", "await copyFile(victim, temporary)"), source.replace("await rename(victim, temporary)", "await reuse(temporary)")]) {
    await fs.writeFile(file, code);
    const result = JSON.parse(execFileSync(process.execPath, [path.resolve("plugin/scripts/classify-change.mjs"), "--repo", c.project, "--files", "src/save.ts", "--text", file], { encoding: "utf8" }).trim().split("\n").at(-1));
    assert.ok(result.floor_hits.some(h => h.signal === "S8"));
  }
}));

test("R1 P2: exhausted global rescue closes with gaps and never reuses the abandoned unit", () => fixture(async c => {
  const actions = [];
  for (let i = 0; i < 8; i++) {
    const out = await withEngineRecovery({ ...c.ref, cmd: "next", step: () => { throw Object.assign(new Error("persistent scheduler fault"), { code: "EIO", ...(i > 1 ? { unit: "u-rescue-run" } : {}) }); } }, { ...c.deps, rebuild: async () => {} });
    actions.push(out.body?.action);
  }
  const state = await c.ctx.readState();
  assert.equal(state.status, "completed_with_gaps");
  assert.equal(state.units.length, 1);
  assert.equal(state.units[0].state, "abandoned");
  assert.equal(actions.at(-1), "done");
  assert.equal(await bs.currentLease(c.project), null);
  assert.equal(st.foldJournal((await jr.readJournal(c.paths.journalFile)).events).status, "completed_with_gaps");
}));

test("R1 P3: granted authorization clears protection and later technical failures rescue", () => fixture(async c => {
  const unit = st.newUnit({ id: "u-approved", kind: "build", state: "parked", parked: "owner_question", pending_answer: "q-spend", protected_action: "money" });
  const unanswered = { ...await c.ctx.readState(), units: [unit] };
  const refused = planAnswer({ state: unanswered, question: "q-spend", value: false, questions: new Map([["q-spend", { id: "q-spend", reversible: false, gate: "money" }]]) });
  assert.equal(refused.state.units[0].protected_action, "money", "a refusal cannot grant authorization");
  await c.ctx.appendEvent({ type: "unit_queued", data: unit });
  const answered = planAnswer({ state: unanswered, question: "q-spend", value: true, questions: new Map([["q-spend", { id: "q-spend", reversible: false, gate: "money" }]]) });
  assert.equal(answered.state.units[0].protected_action ?? null, null);
  for (const event of answered.events) await c.ctx.appendEvent(event);
  assert.equal(st.findUnit(st.foldJournal((await jr.readJournal(c.paths.journalFile)).events), unit.id).protected_action, null);
  await c.ctx.writeState(st.patchUnit(answered.state, unit.id, { state: "reported", attempt: 3 }));
  for (let i = 0; i < 2; i++) await recoverTechnicalStall(c.ref, "no_progress", c.deps);
  assert.equal((await c.ctx.readState()).units[0].state, "rescue");
}));

test("R1 P4: legacy live job without envelopes accepts its fenced report; repeated read failures rescue", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-legacy", kind: "build" });
  const worker = { runtime: "codex", model: "sol", effort: "medium", via: "cli", pid: null, worker_id: "legacy" };
  const job = { id: "legacy", kind: "worker", unit: unit.id, frd: FRD, pid: null, cwd: unit.worktree, h_slot: false, started_at: new Date().toISOString(), state: "running", exit: null, worker_id: "legacy" };
  await c.ctx.writeState({ ...st.patchUnit(await c.ctx.readState(), unit.id, { worker }), jobs: [job] });
  const input = { project: c.project, workerId: "legacy", unit: unit.id, epoch: c.ref.epoch, required: true };
  assert.equal(reportEnvelope(input).ok, true);
  assert.equal(reportEnvelope({ ...input, epoch: c.ref.epoch + 1 }).ok, false);
  assert.equal(reportEnvelope({ ...input, legacyToken: "wrong" }).ok, false);
  await write(unit.worktree, FILE, "export const legacy = true;\n");
  assert.equal((await c.report(unit, [FILE])).outcome, "committed");
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), unit.id, { state: "running" }));
  const d = { ...c.deps, log: () => {}, workers: { pollWorker: async () => ({ state: "error", kind: "transport", detail: "unreadable envelope" }) } };
  const token = adm.issueToken(unit.id, "B", { file: c.paths.admissionFile });
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), unit.id, { token_hash: token.token_hash }));
  await harvest({ ref: { ...c.ref, deps: d }, paths: c.paths, d }, await c.ctx.readState(), []);
  assert.equal(reportEnvelope({ ...input, legacyToken: token.token }).ok, true, "a transient read failure preserves the original worker credential");
  for (let i = 0; i < 5; i++) await harvest({ ref: { ...c.ref, deps: d }, paths: c.paths, d }, await c.ctx.readState(), []);
  const state = await c.ctx.readState();
  assert.equal(state.units[0].state, "rescue");
  assert.equal(state.units[0].technical_failures.length, 2);
  assert.equal(runningSummary(state).any, false);
}));

test("R1 P5: global oracle repair closes through the landing gate without an FRD", () => {
  const patch = st.newUnit({ id: "u-patch-global", kind: "patch", frd: null, state: "rescue", test_hashes: { [ORACLE]: "a".repeat(64) }, rescue: { phase: "work" } });
  const planned = planTestRepair(st.newState({ units: [patch] }), { id: "r-global", unit: patch.id, question: ORACLE, why: "contract repair", options: [{ text: "replace oracle" }] });
  const state = { ...planned.state, units: planned.state.units.map(u => ({ ...u, state: u.id === patch.id ? "abandoned" : "integrated", ...(u.id === patch.id ? { rescue: { ...u.rescue, exclusion: { pending: false, commits: [] } } } : {}) })) };
  assert.equal(batchState(state).complete, true);
  assert.equal(assessBatch(state).complete, true);
  assert.deepEqual(assessBatch(state).landable.map(u => u.id), ["u-test-repair-r-global"]);
});

test("R1 P7: abandoning integrated rejected code excludes its diff while independent work can land", () => fixture(async c => {
  const original = await c.dispatch({ id: "u-rejected-build", kind: "build" });
  const before = await fs.readFile(path.join(c.paths.integrationWorktree, FILE), "utf8");
  await write(original.worktree, FILE, "export const unacceptableBehavior = true;\n");
  assert.equal((await c.report(original, [FILE])).outcome, "committed");
  await integrateStep({ ref: { ...c.ref, deps: c.deps }, d: c.deps, paths: c.paths }, await c.ctx.readState(), []);
  for (let i = 0; i < 2; i++) await recordTechnicalFailure(c.ctx, original.id, { code: "review_blocked", detail: "independent review rejected behavior" }, c.deps);
  const out = await advanceRescues(c.ref, c.deps);
  assert.equal((await rescueReport(c, out, "failed")).outcome, "abandoned");
  const independent = st.newUnit({ id: "u-independent-docs", kind: "docs", state: "integrated" });
  const state = { ...await c.ctx.readState(), units: [...(await c.ctx.readState()).units, independent] };
  assert.equal(await fs.readFile(path.join(c.paths.integrationWorktree, FILE), "utf8"), before);
  assert.equal(batchState(state).complete, true);
  assert.equal(assessBatch(state).complete, true);
  assert.deepEqual(assessBatch(state).landable.map(u => u.id), [independent.id]);
  assert.equal(state.units[0].state, "abandoned");
  assert.match(state.units[0].rescue.failure, /supervised fixture/);
}));

test("R1 P6: Mission Control renders rescue and abandonment with their Spanish reason", async () => {
  const { buildWorkOrderDisplay } = await import("../../mission-control/src/lib/build-run/display.ts");
  for (const [state, expected, label] of [["rescue", "in_progress", "Rescate en curso"], ["abandoned", "fail", "Abandonada"]]) {
    const wo = { id: "WO-01-001", state: "todo" };
    const run = { state: { status: "active", units: [{ id: "u-ui", kind: "build", wos: [wo.id], state, attempt: 1, rescue: { phase: "failed", failure: "fallo de transporte" } }] }, matchesLease: true, live: true };
    const shown = buildWorkOrderDisplay([wo], run).items[0];
    assert.equal(shown.state, expected);
    assert.equal(shown.buildUnit.reason, `${label}: fallo de transporte`);
    assert.ok(!shown.buildUnit.reason.includes("—"));
  }
});

test("R1 B2: legacy abandonment excludes product code without reverting independent aggregate metadata", () => fixture(async c => {
  const root = c.paths.integrationWorktree;
  const one = await c.dispatch({ id: "u-meta-one", kind: "build" });
  const before = await fs.readFile(path.join(root, FILE), "utf8");
  await write(one.worktree, FILE, "export const rejected = true;\n");
  await c.report(one, [FILE]);
  await integrateStep({ ref: { ...c.ref, deps: c.deps }, d: c.deps, paths: c.paths }, await c.ctx.readState(), []);
  const raw = await c.dispatch({ id: "u-meta-two", kind: "build" });
  const two = { ...raw, frd: "frd-02-beta", wos: ["WO-02-001"] };
  await c.ctx.writeState(st.patchUnit(await c.ctx.readState(), two.id, { frd: two.frd, wos: two.wos }));
  await write(two.worktree, "src/beta/view.ts", "export const independent = true;\n");
  await c.report(two, ["src/beta/view.ts"]);
  await integrateStep({ ref: { ...c.ref, deps: c.deps }, d: c.deps, paths: c.paths }, await c.ctx.readState(), []);
  let state = st.patchUnit(await c.ctx.readState(), one.id, { state: "abandoned", rescue: { phase: "failed", failure: "legacy rejected unit" } });
  state = { ...st.patchUnit(state, two.id, { state: "verified" }), scope: { ...state.scope, frds: [FRD, two.frd], wos: ["WO-01-001", ...two.wos] } };
  assert.equal(batchState(state).complete, false, "unproven legacy exclusion is not landable");
  assert.equal(assessBatch(state).complete, false);
  await c.ctx.writeState(state);
  assert.equal(await advanceRescues(c.ref, c.deps), null);
  state = await c.ctx.readState();
  assert.equal(state.units[0].rescue.exclusion.pending, false);
  assert.equal(await fs.readFile(path.join(root, FILE), "utf8"), before);
  assert.match(await fs.readFile(path.join(root, "src/beta/view.ts"), "utf8"), /independent/);
  assert.match(await fs.readFile(path.join(root, `docs/frds/${FRD}/work-orders/wo-01-001.md`), "utf8"), /implementation_status: BLOCKED/);
  assert.match(await fs.readFile(path.join(root, "docs/frds/frd-02-beta/work-orders/wo-02-001.md"), "utf8"), /implementation_status: IN_REVIEW/);
  assert.equal(batchState(state).complete, true);
  assert.equal(assessBatch(state).complete, true);
}));

test("R1 I4: standalone global oracle repair lands through full G3 and finishes with its consumer gap", () => fixture(async c => {
  const { land, harvestLand } = await import("../runtime/build/land.mjs");
  const root = c.paths.integrationWorktree;
  const old = sha256Hex(await fs.readFile(path.join(root, ORACLE)));
  await write(root, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], ['sentinel']);\n");
  // This fixture's merge queue really verifies and fast-forwards its own main checkout.
  await write(root, ".pandacorp/merge-queue.sh", `#!/bin/bash\nset -e\nbash .pandacorp/verify.sh\nmkdir -p .pandacorp/run\nprintf verified > .pandacorp/run/g3-ran\ngit -C "$1" merge --ff-only "$2"\n`);
  git(root, ["add", "-A"]); git(root, ["commit", "-qm", "test: global oracle replacement\n\nUnit: u-global-repair"]);
  const target = st.newUnit({ id: "u-global-consumer", kind: "patch", state: "abandoned", test_hashes: { [ORACLE]: old }, rescue: { phase: "failed", failure: "consumer could not finish", exclusion: { pending: false, commits: [] } } });
  const repair = st.newUnit({ id: "u-global-repair", kind: "tests", state: "integrated", test_hashes: { [ORACLE]: sha256Hex(await fs.readFile(path.join(root, ORACLE))) }, test_repair: { target: target.id, doubt: "r-global", reason: "framework contract", old_hashes: { [ORACLE]: old } } });
  await c.ctx.writeState({ ...await c.ctx.readState(), units: [target, repair] });
  for (const unit of [target, repair]) await c.ctx.appendEvent({ type: "unit_queued", data: unit });
  const deps = { ...c.deps, jobs: {
    spawnJob: async spec => { execFileSync(spec.cmd[0], [...spec.cmd.slice(1), c.project, c.paths.integrationBranch(RUN)], { cwd: spec.cwd, env: { ...process.env, ...c.env }, stdio: "pipe" }); return { id: spec.jobId }; },
    pollJob: async () => ({ state: "done", exit: 0 }),
  } };
  assert.equal(batchState(await c.ctx.readState()).complete, true);
  assert.equal((await land(c.ref, deps)).output.result, "running");
  assert.equal(await fs.readFile(path.join(root, ".pandacorp/run/g3-ran"), "utf8"), "verified");
  await harvestLand(c.ref, deps);
  const state = await c.ctx.readState();
  assert.equal(st.findUnit(state, repair.id).state, "landed");
  assert.equal(st.findUnit(state, target.id).state, "abandoned");
  await finishRun(c.ref, c.deps);
  assert.equal((await c.ctx.readState()).status, "completed_with_gaps");
  assert.equal(await bs.currentLease(c.project), null);
  assert.match(await fs.readFile(path.join(c.project, ORACLE), "utf8"), /deepEqual\(\['sentinel'\], \['sentinel'\]\)/);
}));
