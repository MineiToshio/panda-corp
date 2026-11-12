// The active relay loop of drive: `driveLoop`, `runLoop` and the engine-failure exit (split from drive.mjs).
import { readLeaseToken, readState } from "../state.mjs";
import { TERMINAL_ACTIONS, err, isFenceError } from "./constants.mjs";
import { assertNoForbiddenWord, buildStateOf, driveLog, limitsOf, say, withDefaults } from "./context.mjs";
import { deferAuditUnit } from "./audit.mjs";
import { setOwnStandbyState } from "./standby.mjs";

// Workers facade handed to `next`: drive launches Codex workers only, and nothing it passes carries the forbidden word.
// Every worker it launches is noted in `launched` (the current round's), so a round fenced after the launch can stop it.
function codexOnlyWorkers(workers, launched) {
  if (!workers) return workers;
  const guard = (input) => {
    const cell = input?.cell ?? {};
    if (cell.runtime !== undefined && cell.runtime !== "codex") throw err("ENGINE_FAILURE", `drive refused a ${cell.runtime} worker`);
    assertNoForbiddenWord([cell.model, cell.effort, input?.modelSlug, input?.model_slug, input?.unit, input?.workerId].filter((v) => v != null), "worker argv");
  };
  return new Proxy(workers, {
    get(target, prop) {
      const value = target[prop];
      if (prop === "launchWorker" && typeof value === "function") {
        return async (input, deps) => {
          guard(input);
          const res = await value.call(target, input, deps);
          if (res?.workerId) launched.set(res.workerId, input?.unit ?? null);
          return res;
        };
      }
      return value;
    },
  });
}

/**
 * A round fenced after it launched Codex workers (its phase 2 lost the lease to a `start --resume`) leaves workers no
 * state records: their tokens are released by the resume and their worktree is reset and reused at the same attempt, so
 * they must not keep writing into it. Stops every worker of this round that state.json does not record as a unit's
 * running worker (a recorded one is the new owner's to adopt or stop). Never throws.
 * @returns {Promise<string[]>} the worker ids stopped
 */
async function stopUnrecordedWorkers(project, launched, workers, d, engineDeps) {
  if (!launched.size || typeof workers?.stopWorkers !== "function") return [];
  try {
    const state = await readState(project, { env: d.env, homedir: d.homedir }).catch(() => null);
    const recorded = new Set((state?.units ?? []).filter((u) => u.state === "running" && u.worker?.worker_id).map((u) => u.worker.worker_id));
    const ids = [...launched.keys()].filter((id) => !recorded.has(id));
    if (ids.length) await workers.stopWorkers(project, ids, engineDeps);
    return ids;
  } catch (error) {
    driveLog(project, `yield: stopping the round's workers failed: ${error?.message ?? String(error)}`, d);
    return [];
  }
}

// A land job counts as alive while it is recorded running and its pid (when known) is alive.
const landJobAlive = (state, d) => state.jobs.some((j) => j.kind === "land" && j.state === "running" && (!Number.isInteger(j.pid) || d.isAlive(j.pid)));

// The FENCE error when the lease token no longer names `epoch` (another coordinator took the run), else null.
async function leaseLost(project, epoch, d) {
  try { await readLeaseToken(project, epoch, { env: d.env, homedir: d.homedir }); return null; } catch (error) { return isFenceError(error) ? error : null; }
}

/**
 * The active relay loop for the run at `epoch` (drive holds the lease). Ends at a terminal action (already applied by
 * `next`), `done` (then `finish`), a fence (the owner resumed: yield, exit 0) or an engine failure (exit 8).
 * @param {{project: string, epoch: number}} input
 * @param {object} deps must carry `next`, `land`, `finish`; optional `workers`, `engineDeps`, `engineFailure`, `deferAudit`
 * @returns {Promise<{outcome: string, action: string|null, exitCode: number}>}
 */
export async function driveLoop({ project, epoch }, deps) {
  const d = withDefaults(deps);
  const deferAudit = typeof d.deferAudit === "function" ? d.deferAudit : (input) => deferAuditUnit(input, d);
  for (const name of ["next", "land", "finish"]) if (typeof d[name] !== "function") throw err("USAGE", `drive loop needs deps.${name}`);
  const bs = await buildStateOf(d);
  const limits = limitsOf(d);
  const pollMs = limits.drive_poll_s * 1000;
  const launched = new Map();
  const engineDeps = { ...(d.engineDeps ?? {}), ...(d.workers ? { workers: codexOnlyWorkers(d.workers, launched) } : {}) };
  const ref = { project, epoch, actor: "drive", coordinator: "drive" };

  for (let i = 0; i < d.maxPolls; i++) {
    let out;
    launched.clear();
    try {
      // Renewing first is also how a resumed owner is noticed: the token file now names another epoch -> FENCE.
      const token = await readLeaseToken(project, epoch, { env: d.env, homedir: d.homedir });
      await bs.renew(project, token, epoch, { projectStatus: false });
      out = await d.next({ ...ref, wait: 0 }, engineDeps);
      for (const line of out?.notes_es ?? []) driveLog(project, `next: ${line}`, d);

      switch (out?.action) {
        case "dispatch": {
          for (const unit of out.units ?? []) {
            if (unit.runtime === "codex" && unit.via === "cli") { driveLog(project, `dispatch: ${unit.unit} ${unit.kind} codex ${unit.model} ${unit.effort}`, d); continue; }
            if (unit.kind === "audit") {
              await deferAudit({ ...ref, unit }, engineDeps);
              driveLog(project, `dispatch: security audit ${unit.unit} deferred to a Claude re-review (opus high)`, d);
              continue;
            }
            throw err("ENGINE_FAILURE", `next returned a ${unit.runtime}/${unit.via} unit (${unit.unit}) to drive, which runs Codex only`);
          }
          break;
        }
        case "wait":
          await d.sleep(Math.min(pollMs, Math.max(1000, (out.wait?.retry_after_s ?? limits.drive_poll_s) * 1000)));
          break;
        case "land": {
          const state = await readState(project, { env: d.env, homedir: d.homedir });
          if (state && landJobAlive(state, d)) { await d.sleep(pollMs); break; }
          let landed;
          try { landed = await d.land(ref, engineDeps); } catch (error) {
            if (error?.code !== "WAITING_GATE") throw error;
            landed = { result: "waiting_gate", reason: error.message };
          }
          driveLog(project, `land: ${landed?.result ?? "?"}${landed?.reason ? ` (${landed.reason})` : ""}`, d);
          if (landed?.result === "waiting_gate") await say("waiting-gate", { project, kind: "production" }, d);
          if (landed?.result === "running" || landed?.result === "nothing_to_land") await d.sleep(pollMs);
          break;
        }
        case "done": {
          let finished;
          try { finished = await d.finish(ref, engineDeps); } catch (error) {
            if (error?.code !== "WAITING_GATE") throw error;
            finished = { waiting_gate: true };
          }
          driveLog(project, `done: finish ${finished?.report_path ?? ""}`.trim(), d);
          await say(finished?.waiting_gate ? "waiting-gate" : "done", { project }, d);
          await setOwnStandbyState(project, "stopped", d);
          return { outcome: "done", action: "done", exitCode: 0 };
        }
        case "handoff":
          throw err("ENGINE_FAILURE", "next returned handoff to drive (a drive coordinator never hands off)");
        default:
          if (TERMINAL_ACTIONS.has(out?.action)) {
            driveLog(project, `terminal: ${out.action} (applied by next)`, d);
            let event = out.action;
            if (out.action === "waiting-owner") {
              const after = await readState(project, { env: d.env, homedir: d.homedir }).catch(() => null);
              if (after?.status === "waiting_gate") event = "waiting-gate";
            }
            await say(event, { project }, d);
            await setOwnStandbyState(project, "stopped", d);
            return { outcome: out.action, action: out.action, exitCode: 0 };
          }
          throw err("ENGINE_FAILURE", `next returned an unknown action: ${String(out?.action)}`);
      }
    } catch (error) {
      // A `start --resume` transfers the lease while drive may be inside a work phase (outside the mutex), and its
      // integration-worktree heal can then break drive's in-flight git step. Once the lease names another epoch, any
      // failure is the loser's: yield like a fence instead of reporting an engine failure for a run drive no longer holds.
      const lost = isFenceError(error) ? error : await leaseLost(project, epoch, d);
      if (lost) {
        driveLog(project, `yield: fenced at epoch ${epoch} (${lost.message}${lost === error ? "" : `; after: ${error?.code ?? "ERROR"}: ${error?.message ?? String(error)}`}); the owner's session holds the run now`, d);
        // Before the standby says `stopped` (what `start --resume` waits for), so no worker of this round outlives the yield.
        const stoppedIds = await stopUnrecordedWorkers(project, launched, d.workers, d, engineDeps);
        if (stoppedIds.length) driveLog(project, `yield: stopped ${stoppedIds.length} worker(s) launched in the fenced round: ${stoppedIds.join(", ")}`, d);
        await setOwnStandbyState(project, "stopped", d);
        return { outcome: "yielded", action: out?.action ?? null, exitCode: 0 };
      }
      return engineFailure(project, epoch, error, d, engineDeps);
    }
  }
  driveLog(project, "loop: poll budget exhausted (test bound)", d);
  return { outcome: "poll_budget", action: null, exitCode: 0 };
}

/**
 * The active loop under its contract name (`{project, runId?, epoch}`); `runId`, when given, must match state.json.
 * @param {{project: string, runId?: string, epoch: number}} input
 * @param {object} deps as `driveLoop`
 */
export async function runLoop({ project, runId, epoch }, deps) {
  if (runId) {
    const d = withDefaults(deps);
    const state = await readState(project, { env: d.env, homedir: d.homedir }).catch(() => null);
    if (state && state.run_id !== runId) {
      driveLog(project, `loop: run ${runId} is not the current run (${state.run_id}); nothing to do`, d);
      return { outcome: "run_changed", action: null, exitCode: 0 };
    }
  }
  return driveLoop({ project, epoch }, deps);
}

export async function engineFailure(project, epoch, error, d, engineDeps) {
  driveLog(project, `engine failure: ${error?.code ?? "ERROR"}: ${error?.message ?? String(error)}`, d);
  if (typeof d.engineFailure === "function") {
    try { await d.engineFailure({ project, epoch, actor: "drive", error }, engineDeps); } catch (inner) {
      driveLog(project, `engine failure handler failed: ${inner.message}`, d);
    }
  }
  await say("engine-failure", { project }, d);
  await setOwnStandbyState(project, "stopped", d);
  return { outcome: "engine_failure", action: null, exitCode: 8 };
}
