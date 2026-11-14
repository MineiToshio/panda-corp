// `start --resume`: re-enter a non-terminal run (transfer or acquire), re-attach live units, requeue dead ones, re-arm drive.
import { releaseToken } from "../admission.mjs";
import { detect } from "../detect.mjs";
import { armDrive, readStandby } from "../drive.mjs";
import { readJson } from "../fsx.mjs";
import { applyUnblock, checkUnblock } from "../failure/unblock.mjs";
import { createIntegrationWorktree, healIntegrationWorktree } from "../integrate.mjs";
import { removeAllG2Snapshots } from "../next.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, readLeaseToken, rebuildState } from "../state.mjs";
import { restoreUnitWorktree } from "../units.mjs";
import { dispatchOf, peekWorker, stopWorkers, workerIdFor } from "../workers.mjs";
import { clearBuildDir, restoreSuspended } from "./buildDir.mjs";
import { COORDINATORS, LEASE_TTL_S, RESUMABLE_STATUSES, bsOf, clockMs, depsOf, ensurePrePush, err, isAliveDefault, journal, readStateLoose } from "./common.mjs";

// Bound on waiting for a fenced, still-active drive to leave its work phase; past it the resume refuses (CONTENDED).
const DRIVE_YIELD_WAIT_MS = 60_000;

/**
 * A drive that was ACTIVE on this run (it held the lease until `takeLease` fenced it) may still be inside a work phase,
 * running git in the integration and unit worktrees; it only notices the fence at its next phase 2, then marks its
 * standby `stopped` and exits. The resume's worktree resets and heal must not run under it (they break its in-flight git
 * step: `index.lock` busy, a commit with nothing staged), so wait until it stopped, bounded by DRIVE_YIELD_WAIT_MS
 * (`deps.driveYieldWaitMs` overrides it). A drive in standby, of another run, or dead is not waited for. A drive still
 * active at the bound (a long unit-worktree bootstrap) makes the resume refuse with CONTENDED BEFORE any reset: the
 * lease already names this session, so the drive yields at its next phase 2 (stopping the workers it launched in that
 * round), and the same `start --resume` is simply retried.
 * @returns {Promise<boolean>} true when an active drive was seen and has stopped
 * @throws CONTENDED when the drive is still active at the bound
 */
async function waitActiveDriveYield(project, runId, isAlive, d) {
  const active = async () => {
    const sb = await readStandby(project, d.driveDeps);
    return !!sb && sb.run_id === runId && sb.state === "active" && Number.isInteger(sb.pid) && sb.pid !== process.pid && isAlive(sb.pid);
  };
  if (!(await active())) return false;
  const bound = Number.isFinite(d.driveYieldWaitMs) && d.driveYieldWaitMs >= 0 ? d.driveYieldWaitMs : DRIVE_YIELD_WAIT_MS;
  const end = Date.now() + bound;
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(200, Math.max(1, end - Date.now()))));
    if (!(await active())) return true;
  }
  throw err("CONTENDED", "the drive of this run is still in a work phase and has not yielded yet: retry start --resume in a minute");
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
 * With `unblock` (+ `reason`), BL-0312: also re-admit that env-infra blocked unit at its same attempt (failure/unblock.mjs);
 * this is the one way back into a run that already ended `finished`, and it is checked BEFORE the lease is taken.
 * @param {{project: string, coordinator: "claude"|"codex", sessionModel?: string|null, runId?: string|null, ownerConfirmed?: boolean,
 *   unblock?: string|null, reason?: string|null}} input
 */
export async function startResume(input, deps = {}) {
  const d = depsOf(deps);
  const { project, coordinator, sessionModel = null, runId = null, ownerConfirmed = false, unblock = null, reason = null } = input;
  if (!COORDINATORS[coordinator]) throw err("USAGE", "--coordinator debe ser claude o codex");
  if (unblock && !String(reason ?? "").trim()) throw err("USAGE", "--unblock necesita --reason (qué se arregló en el entorno)");
  if (!unblock && reason) throw err("USAGE", "--reason solo acompaña a --unblock");
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
  const reopenable = unblock ? [...RESUMABLE_STATUSES, "finished"] : RESUMABLE_STATUSES;
  if (!reopenable.includes(state.status)) throw err("INVALID_STATE", `nothing to resume: the run is ${state.status}${state.status === "finished" ? " (a finished run is reopened only to unblock an env-infra unit: --unblock U --reason TEXT)" : ""}`);
  // Refuse a wrong unblock (not blocked, not env-infra, a dependent) before any lease or worktree is touched.
  if (unblock) await checkUnblock({ project, state, unitId: unblock, reason }, d);
  const prior = state.status;
  // Same guard as `start --run`: a launched project never resumes unguarded. It runs before any lease mutation so a
  // refusal leaves the run exactly as it was and the same `start --resume` can simply be retried.
  const launched = (await detect({ project, args: "", sessionRuntime: coordinator }, d)).signals.launched === true;
  await ensurePrePush(project, launched);
  const got = await takeLease({ project, p, state, coordinator, ownerConfirmed }, d);
  await waitActiveDriveYield(project, state.run_id, isAlive, d);

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
    await ctx.writeState({ ...state, units, jobs, coordinator: COORDINATORS[coordinator], status: "active", status_reason: null, resumeAt: null });
    return { reattached, requeued };
  });
  // Leftover G2 snapshots (a crash between a snapshot and its job) go before the run continues; a running G2 job keeps its own (NB5).
  await removeAllG2Snapshots({ project, epoch: got.epoch }, d);
  // Re-attaching a registered worktree is a no-op; a re-created one is bootstrapped (integrate.mjs) before any landing.
  await createIntegrationWorktree({ project, runId: state.run_id }, d);
  // BL-0312: the WO frontmatter of an unblocked unit lives in the integration worktree, so it runs after (re)creating it.
  const unblocked = unblock
    ? await fencedTwoPhase({ project, epoch: got.epoch, deps: d }, undefined, undefined, (_r, _i, ctx) => applyUnblock(ctx, { unitId: unblock, reason }, d))
    : null;
  const drive = await armDrive({ project, runId: state.run_id, launched, appendEvent: (ev) => journal(p, state.run_id, got.epoch, ev.type, ev.data, d) }, d.driveDeps);
  return { run_id: state.run_id, epoch: got.epoch, ...result, ...(unblocked ? { unblocked } : {}), drive };
}
