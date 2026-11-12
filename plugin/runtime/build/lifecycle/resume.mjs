// `start --resume`: re-enter a non-terminal run (transfer or acquire), re-attach live units, requeue dead ones, re-arm drive.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { detect } from "../detect.mjs";
import { armDrive } from "../drive.mjs";
import { readJson } from "../fsx.mjs";
import { createIntegrationWorktree, healIntegrationWorktree } from "../integrate.mjs";
import { removeAllG2Snapshots } from "../next.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, readLeaseToken, rebuildState } from "../state.mjs";
import { restoreUnitWorktree } from "../units.mjs";
import { dispatchOf, peekWorker, stopWorkers, workerIdFor } from "../workers.mjs";
import { clearBuildDir, restoreSuspended } from "./buildDir.mjs";
import { COORDINATORS, LEASE_TTL_S, RESUMABLE_STATUSES, bsOf, clockMs, depsOf, ensurePrePush, err, isAliveDefault, journal, readStateLoose } from "./common.mjs";

/**
 * A lease mutex whose holder died inside it (a kill -9 of drive in the middle of a fenced mutation) would block every
 * command for build-state's 60-s staleness window. It is reclaimed at once when the pid in its `owner.json` is dead;
 * a live, unreadable or not yet written owner is left alone (the 60-s rule still applies to it).
 * @returns {Promise<boolean>} true when a dead holder's mutex was removed
 */
async function reclaimDeadLeaseMutex(p, isAlive) {
  let owner;
  try { owner = JSON.parse(await fsp.readFile(path.join(p.leaseMutex, "owner.json"), "utf8")).owner; } catch { return false; }
  const pid = Number.parseInt(String(owner).split("-")[0], 10);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid || isAlive(pid)) return false;
  const tomb = `${p.leaseMutex}.dead-${pid}-${process.pid}`;
  try { await fsp.rename(p.leaseMutex, tomb); } catch { return false; }
  await fsp.rm(tomb, { recursive: true, force: true });
  return true;
}

async function takeLease({ project, p, state, coordinator, ownerConfirmed }, d) {
  const bs = bsOf(d);
  const lease = await bs.currentLease(project);
  if (!lease) {
    const got = await bs.acquire(project, { runtime: coordinator, runId: state.run_id, ttlSeconds: LEASE_TTL_S, coordinator: "session", projectStatus: false });
    return { epoch: got.epoch, token: got.token };
  }
  if (lease.run_id !== state.run_id) throw err("CONTENDED", `the lease belongs to run ${lease.run_id}`);
  const fresh = bs.isFresh(lease, clockMs(d));
  if (!fresh && lease.coordinator !== "drive" && lease.runtime !== coordinator && !ownerConfirmed) {
    throw err("INVALID_INPUT", "the lease of another company's session is stale: pass --owner-confirmed after checking it is dead");
  }
  let token = null;
  try { token = await readLeaseToken(project, lease.epoch, d); } catch { token = null; }
  if (token) return bs.transfer(project, { token, toRuntime: coordinator, coordinator: "session", epoch: lease.epoch });
  if (!fresh && bs.isReclaimable(lease, clockMs(d))) {
    const got = await bs.reclaim(project, { runtime: coordinator, runId: state.run_id, ttlSeconds: LEASE_TTL_S, coordinator: "session", projectStatus: false });
    return { epoch: got.epoch, token: got.token };
  }
  throw err("CONTENDED", "the lease is held by a live run whose token this checkout cannot read");
}

/**
 * What a resume does with an `admitted|running` unit whose recorded pids are dead (CLI 3.4, A13, D21):
 *  - `adopt`: a `via:"cli"` dispatch recorded in phase 2 whose worker sealed (or exited): its outcome is this
 *    dispatch's, under this dispatch's token, so it is harvested, never redone or charged to a new attempt;
 *  - `orphan`: a Codex worker launched by a dispatch that never reached phase 2 (its id is derived from the unit's
 *    admission token) and still alive: it is stopped, because its token is released and its result could never be
 *    ingested, and it would otherwise write into the worktree of the next dispatch;
 *  - `requeue`: anything else.
 * @returns {{kind: "adopt", workerId: string, pid: number|null} | {kind: "orphan", workerId: string} | {kind: "requeue"}}
 */
function resumeVerdict(state, u, project, d) {
  const recorded = u.state === "running" && u.worker?.via === "cli" && u.worker.worker_id ? u.worker.worker_id : null;
  let workerId = recorded;
  if (!workerId && dispatchOf(u.token_hash)) {
    try { workerId = workerIdFor({ runId: state.run_id, unit: u.id, attempt: u.attempt, dispatch: dispatchOf(u.token_hash) }); } catch { workerId = null; }
  }
  if (!workerId) return { kind: "requeue" };
  const peek = peekWorker({ project, workerId }, { env: d.env, ...(d.isAlive ? { isAlive: d.isAlive } : {}) });
  if (recorded && (peek.sealed || peek.state === "exited")) return { kind: "adopt", workerId, pid: peek.pid };
  if (peek.state === "running") return recorded ? { kind: "adopt", workerId, pid: peek.pid } : { kind: "orphan", workerId };
  return { kind: "requeue" };
}

/** Every pid recorded for a unit: its worker and its running jobs. */
const unitPids = (state, u) => [u.worker?.pid, ...state.jobs.filter((j) => j.unit === u.id && j.state === "running").map((j) => j.pid)];

/** The branch a requeued unit's worktree is reset to: its assumption branch when it was built on one, else the integration branch. */
const resetBase = (p, state, u) => (u.parked === "built_on_assumption" && u.pending_answer ? p.assumeBranch(state.run_id, u.pending_answer) : undefined);

/** The `running` worker job of an adopted unit (reopened when a harvest had already closed it). */
function reopenWorkerJob(jobs, u, verdict, project, d) {
  const current = jobs.find((j) => j.kind === "worker" && (j.worker_id === verdict.workerId || j.id === verdict.workerId));
  if (current?.state === "running") return { jobs, event: null };
  const job = current
    ? { ...current, state: "running", exit: null }
    : { id: verdict.workerId, kind: "worker", unit: u.id, frd: u.frd ?? null, pid: verdict.pid ?? null, cwd: u.worktree ?? project, h_slot: false, started_at: new Date(clockMs(d)).toISOString(), state: "running", exit: null, worker_id: verdict.workerId };
  return { jobs: [...jobs.filter((j) => j !== current), job], event: { type: "job_started", data: job } };
}

/**
 * `start --resume`: re-enter a non-terminal run (transfer or acquire), re-attach live units, requeue dead ones, re-arm drive.
 * @param {{project: string, coordinator: "claude"|"codex", sessionModel?: string|null, runId?: string|null, ownerConfirmed?: boolean}} input
 */
export async function startResume(input, deps = {}) {
  const d = depsOf(deps);
  const { project, coordinator, sessionModel = null, runId = null, ownerConfirmed = false } = input;
  if (!COORDINATORS[coordinator]) throw err("USAGE", "--coordinator debe ser claude o codex");
  const p = buildPaths(project, d);
  const isAlive = d.isAlive ?? isAliveDefault;
  const current = await readJson(p.stateFile).catch(() => null);
  if (runId && current && current.status !== "finished") throw err("INVALID_STATE", "build/ holds a non-terminal run: resume it, or stop it first");
  if (runId) { await clearBuildDir(project, p, d); await restoreSuspended({ project, runId }, d); }

  let state = await readStateLoose(project, d);
  let rebuilt = false;
  if (!state) {
    try { state = (await rebuildState({ project, deps: d })).state; rebuilt = true; } catch { throw err("INVALID_STATE", "nothing to resume: no readable run in build/"); }
  }
  if (!RESUMABLE_STATUSES.includes(state.status)) throw err("INVALID_STATE", `nothing to resume: the run is ${state.status}`);
  const prior = state.status;
  // Same guard as `start --run`: a launched project never resumes unguarded. It runs before any lease mutation so a
  // refusal leaves the run exactly as it was and the same `start --resume` can simply be retried.
  const launched = (await detect({ project, args: "", sessionRuntime: coordinator }, d)).signals.launched === true;
  await ensurePrePush(project, launched);
  await reclaimDeadLeaseMutex(p, isAlive);
  const got = await takeLease({ project, p, state, coordinator, ownerConfirmed }, d);

  // Slow git work (orphan stop, worktree reset) runs here, under the lease but OUTSIDE the 1-s lease mutex of the fenced
  // step below (N2). It is idempotent: a crash before the requeue is journaled leaves the units admitted/running with
  // dead pids, and the next resume classifies and resets them again (a reset of a reset worktree is a no-op).
  const before = state;
  const resets = new Map();
  const stopped = new Set();
  for (const u of before.units) {
    if (u.state !== "admitted" && u.state !== "running") continue;
    if (unitPids(before, u).some((pid) => isAlive(pid))) continue;
    const verdict = resumeVerdict(before, u, project, d);
    if (verdict.kind === "adopt") continue;
    if (verdict.kind === "orphan") { stopWorkers(project, [verdict.workerId], d); stopped.add(verdict.workerId); }
    resets.set(u.id, await restoreUnitWorktree({ project, runId: before.run_id, unit: u, base: resetBase(p, before, u) }, d));
  }
  // An engine write that died before its commit left the integration worktree dirty: discard it (never while a land job
  // still runs merge-queue in that worktree).
  // A running land job with no recorded pid is treated as alive (same predicate as drive): a live merge-queue may not be recorded yet.
  const landAlive = before.jobs.some((j) => j.kind === "land" && j.state === "running" && (!Number.isInteger(j.pid) || isAlive(j.pid)));
  const healed = landAlive ? { healed: false, discarded: [], aborted: [] } : await healIntegrationWorktree({ project, runId: before.run_id }, d);

  const result = await fencedTwoPhase({ project, epoch: got.epoch, deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const reattached = [];
    const adopted = [];
    const requeued = [];
    const events = [];
    let jobs = state.jobs;
    const units = [];
    for (const u of state.units) {
      if (u.state !== "admitted" && u.state !== "running") { units.push(u); continue; }
      if (unitPids(state, u).some((pid) => isAlive(pid))) { reattached.push(u.id); units.push(u); continue; }
      const verdict = resumeVerdict(state, u, project, d);
      if (verdict.kind === "adopt") {
        // The worker of THIS dispatch finished but its result was never ingested (the coordinator died between the seal
        // and the report's phase 2): keep the unit running under its own token and reopen its job, so the next `next`
        // harvests it; `report` completes an interrupted ingest from the engine's own unit commit (report.mjs).
        const reopened = reopenWorkerJob(jobs, u, verdict, project, d);
        jobs = reopened.jobs;
        if (reopened.event) events.push(reopened.event);
        adopted.push(u.id); reattached.push(u.id); units.push(u);
        continue;
      }
      // A unit whose verdict changed since the pass above (its worker files moved in between) is requeued without a reset
      // (a late orphan is still stopped: a signal is cheap); the next resume or the attempt's report deals with its tree.
      if (verdict.kind === "orphan" && !stopped.has(verdict.workerId)) stopWorkers(project, [verdict.workerId], d);
      const reset = resets.get(u.id) ?? { reset: false };
      requeued.push(u.id);
      events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to: "queued", reason: "resume", ...(reset.reset ? { worktree_reset: { discarded_commits: reset.discarded_commits, dirty: reset.dirty, head: reset.head } } : {}), ...(verdict.kind === "orphan" ? { orphan_worker: verdict.workerId } : {}) } });
      units.push({ ...u, state: "queued", token_hash: null, worker: null });
    }
    // A dead coordinator may also have died between a unit's settle and its token release: no unit outside
    // admitted/running holds an admission reservation after a resume.
    for (const u of units) if (u.state !== "admitted" && u.state !== "running") { try { releaseToken(u.id, { file: p.admissionFile }); } catch { /* the token file may be gone */ } }
    await ctx.appendEvent({ type: "run_resumed", data: { from: prior, coordinator: COORDINATORS[coordinator], session_model: sessionModel, reattached, requeued, adopted, rebuilt, ...(healed.healed ? { integration_discarded: healed.discarded, ...(healed.aborted.length ? { integration_aborted: healed.aborted } : {}) } : {}) } });
    for (const ev of events) await ctx.appendEvent(ev);
    await ctx.writeState({ ...state, units, jobs, coordinator: COORDINATORS[coordinator], status: "active", status_reason: null });
    return { reattached, requeued };
  });
  // Leftover G2 snapshots (a crash between a snapshot and its job) go before the run continues; a running G2 job keeps its own (NB5).
  await removeAllG2Snapshots({ project }, d);
  // Re-attaching a registered worktree is a no-op; a re-created one is bootstrapped (integrate.mjs) before any landing.
  await createIntegrationWorktree({ project, runId: state.run_id }, d);
  const drive = await armDrive({ project, runId: state.run_id, launched, appendEvent: (ev) => journal(p, state.run_id, got.epoch, ev.type, ev.data, d) }, d.driveDeps);
  return { run_id: state.run_id, epoch: got.epoch, ...result, drive };
}
