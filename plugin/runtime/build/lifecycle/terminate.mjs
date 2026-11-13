// `stop` and `finish`: end a run, write the Spanish report, release the lease.
import path from "node:path";
import { assertNotTracked, atomicWriteText } from "../fsx.mjs";
import { applyTerminal, removeAllG2Snapshots } from "../next.mjs";
import { finishPerformance } from "../perf.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, isTerminalUnit, readLeaseToken, readState, writeState } from "../state.mjs";
import { readSummary, renderReportEs } from "../summary.mjs";
import { cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { withRunCleanup } from "./cleanup.mjs";
import { gcWorktrees } from "./buildDir.mjs";
import { bsOf, clockMs, depsOf, emit, err, journal, readStateLoose } from "./common.mjs";

/**
 * `stop [--epoch N]` or `stop --dead --owner-confirmed`. Fenced with an epoch; `--dead` force-releases a reclaimable lease.
 * @returns {Promise<{released: boolean, run_id?: string|null}>}
 */
export async function stopRun({ project, epoch = null, dead = false, ownerConfirmed = false, reason = "owner_request" }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const bs = bsOf(d);
  if (epoch !== null && epoch !== undefined) {
    const state = await applyTerminal({ project, epoch: Number(epoch), actor: "cli", deps: d }, { action: "stop", status: "stopped", reason }, d);
    await withRunCleanup({ project, state }, () => gcWorktrees({ project }, d), d);
    return { released: true, run_id: state.run_id };
  }
  if (dead && !ownerConfirmed) throw err("INVALID_INPUT", "`stop --dead` needs --owner-confirmed");
  const lease = await bs.currentLease(project);
  const state = await readStateLoose(project, d);
  if (!dead && lease) throw err("FENCE", "a lease is held: pass --epoch (or --dead --owner-confirmed for a dead owner)");
  let released = false;
  if (lease) {
    try { await bs.forceRelease(project, { ownerConfirmed: true, now: clockMs(d) }); released = true; } catch (error) {
      if (error?.code === "CONTENDED") throw err("INVALID_INPUT", "the lease is live: its owner may still be running");
      throw error;
    }
  }
  const cleanup = async (current) => {
    if (current && ["active", "paused", "waiting_owner", "waiting_gate"].includes(current.status)) {
      await journal(p, current.run_id, current.epoch, "run_stopped", { reason: dead ? "dead_owner" : reason }, d);
      current = { ...current, status: "stopped", status_reason: dead ? "dead_owner" : reason };
      await writeState(project, current, d);
      await emit(project, current, "build.stopped", { reason: current.status_reason }, d);
    }
    if (current) await finishPerformance({ project, state: { ...current, status: "stopped" }, outcome: "stopped" }, d);
    if (current) await removeAllG2Snapshots({ project, state: current }, d);
    await gcWorktrees({ project }, d);
  };
  if (state) await withRunCleanup({ project, state }, cleanup, d);
  else await gcWorktrees({ project }, d);
  return { released, run_id: state?.run_id ?? null };
}

async function closeRun(ctx, state, waiting, d) {
  const to = waiting ? { status: "waiting_gate", status_reason: "waiting_gate" } : { status: "finished", status_reason: null };
  await ctx.appendEvent(waiting ? { type: "paused", data: { reason: "waiting_gate", status: "waiting_gate" } } : { type: "run_finished", data: {} });
  return ctx.writeState({ ...state, ...to });
}

/**
 * `finish --epoch N`: close a run whose units are all terminal (or whose status is not active). Only `waiting_gate` units left:
 * the run ends as waiting (`waiting_gate: true`, the dispatcher exits 7). Writes the Spanish report; never projects status.yaml.
 * @returns {Promise<{report_path: string, summary: object, waiting_gate: boolean}>}
 */
export async function finishRun({ project, epoch = null, actor = "cli" }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const bs = bsOf(d);
  const lease = await bs.currentLease(project);
  const state0 = await readState(project, d);
  if (!state0) throw err("INVALID_STATE", "no run to finish");
  let waiting = false;
  const decide = (s) => {
    if (s.status === "finished") return "already";
    const open = s.units.filter((u) => !isTerminalUnit(u));
    waiting = open.length > 0 && open.every((u) => u.state === "waiting_gate");
    if (s.status === "active" && open.length > 0 && !waiting) throw err("INVALID_STATE", "the run is active with units not finished: go back to the loop");
    return waiting ? "waiting" : "finish";
  };
  if (lease) {
    const token = await readLeaseToken(project, epoch, d);
    // A quiesced lease (a terminal action, or a previous finish that died before finalizeRelease) refuses fencedTwoPhase,
    // so release it before closing under the exclusive terminal reservation (NB4). A retry after a crash
    // finds the state already finished and only releases.
    if (lease.quiesced_at) {
      if (Number(epoch) !== lease.epoch) throw err("FENCE", "finish: --epoch does not match the quiesced lease");
      if (lease.run_id && state0.run_id !== lease.run_id) throw err("FENCE", "state does not belong to the lease run");
      decide(state0);
      // Finalize first; any terminal writes below are reserved against a new holder.
    } else {
      await fencedTwoPhase({ project, epoch: Number(epoch), actor, deps: d }, undefined, undefined, async (_r, _i, ctx) => {
        const s = await ctx.readState();
        if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
        const m = decide(s);
        if (m !== "already") await closeRun(ctx, s, waiting, d);
        return m;
      });
      await bs.quiesce(project, token, Number(epoch), { projectStatus: false });
    }
    await bs.finalizeRelease(project, token, Number(epoch));
  } else if (Number(epoch) !== state0.epoch) {
    throw err("FENCE", "finish: --epoch does not match the run's last epoch");
  }
  return withRunCleanup({ project, state: state0 }, async (current) => {
    const mode = decide(current);
    if (mode !== "already" && !(mode === "waiting" && current.status === "waiting_gate")) {
      const ctx = { appendEvent: (ev) => journal(p, current.run_id, current.epoch, ev.type, ev.data, d, actor), writeState: (s) => writeState(project, s, d) };
      current = await closeRun(ctx, current, waiting, d);
    }
    // The run is closed: no G2 snapshot of it is ever harvested again (NB5). A waiting run keeps a still-running G2 job's own.
    await removeAllG2Snapshots({ project, state: current, all: !waiting }, d);
    await cleanupRunWorktrees({ project, state: current, mode: waiting ? "waiting_gate" : "close" }, d);
    await finishPerformance({ project, state: await readState(project, d) }, d);
    const summary = await readSummary(project, d);
    const rel = path.join(".pandacorp", "comms", `informe-build-${state0.run_id}.md`);
    await assertNotTracked(project, rel, { exec: d.exec });
    const reportPath = path.join(project, rel);
    await atomicWriteText(reportPath, renderReportEs(summary));
    const warning = waiting ? null : await emit(project, state0, "build.complete", { run_id: state0.run_id, status: "finished" }, d);
    return { report_path: reportPath, summary, waiting_gate: waiting, ...(warning ? { warnings: [warning] } : {}) };
  }, d);
}
