// Takeover of a run by the Codex relay: `takeOver` and its worktree/token cleanup (split from drive.mjs).
import nodeFs from "node:fs";
import { readJson } from "../fsx.mjs";
import { readQuota, resetsAtOf } from "../quota.mjs";
import { fencedTwoPhase } from "../state.mjs";
import { restoreUnitWorktree } from "../units.mjs";
import { IN_FLIGHT, err, isFenceError } from "./constants.mjs";
import { buildStateOf, driveLog, limitsOf, nowMs, pathsOf, say, stateDeps, withDefaults } from "./context.mjs";
import { setOwnStandbyState } from "./standby.mjs";

const anyRunning = (state) => state.units.some((u) => IN_FLIGHT.has(u.state)) || state.jobs.some((j) => j.state === "running");

/**
 * Take the run over: re-read Codex quota, `transfer` (A10), set `state.coordinator = "drive"`, requeue the units a
 * Claude agent or session was writing (their late reports are fenced out), journal `drive_takeover`, and either
 * park at `paused-quota` (neither tool fits and nothing runs: resumeAt persisted, lease released) or hand back to
 * the loop. Never quiesces a running run, never stops workers.
 * @param {{project: string, runId: string, trigger: string, detail?: string|null}} input
 * @param {object} [deps]
 * @returns {Promise<{outcome: "loop"|"paused-quota"|"retry", epoch: number|null, codex: object, requeued: string[]}>}
 */
export async function takeOver({ project, runId, trigger, detail = null }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  const paths = pathsOf(project, d);
  const limits = limitsOf(d);
  const now = nowMs(d);

  const lease = await bs.currentLease(project);
  let held = null;
  try { held = await readJson(paths.tokenFile); } catch { /* unreadable */ }
  if (!lease || lease.run_id !== runId || !held || typeof held.token !== "string" || held.epoch !== lease.epoch) {
    driveLog(project, "takeover: lease and token file disagree, retrying at the next poll", d);
    return { outcome: "retry", epoch: null, codex: null, requeued: [] };
  }

  const quota = await readQuota({ now, codexHome: paths.codexHome }, { env: d.env });
  const codex = { eff: quota.effective.codex, reading: quota.codex };
  const claude = quota.effective.claude, claudeReading = quota.claude;

  let moved;
  try {
    moved = await bs.transfer(project, { token: held.token, toRuntime: "codex", coordinator: "drive", epoch: lease.epoch });
  } catch (error) {
    if (!isFenceError(error)) throw error;
    driveLog(project, `takeover: transfer fenced (${error.message}), retrying at the next poll`, d);
    return { outcome: "retry", epoch: null, codex: codex.eff, requeued: [] };
  }
  const { epoch } = moved;
  try { nodeFs.renameSync(paths.handoffFile, paths.handoffConsumedFile(epoch)); } catch { /* no handoff file */ }
  await setOwnStandbyState(project, "active", d);

  const resets = { claude: resetsAtOf(claudeReading), codex: resetsAtOf(codex.reading) };
  // From here drive holds the lease: a failure must carry the epoch so the failure path can release it.
  const intent = await withEpoch(epoch, () => fencedTwoPhase({ project, epoch, actor: "drive", deps: stateDeps(d, bs) }, undefined, undefined, async (_result, _intent, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "state.json disappeared during takeover");
    const requeued = [];
    const units = [];
    for (const unit of state.units) {
      const byClaude = unit.worker && (unit.worker.via === "agent" || unit.worker.via === "session");
      if (!IN_FLIGHT.has(unit.state) || !byClaude) { units.push(unit); continue; }
      requeued.push({ unit: unit.id, from: unit.state, token_hash: unit.token_hash, worktree: unit.worktree ?? null, attempt: unit.attempt, parked: unit.parked ?? null, pending_answer: unit.pending_answer ?? null });
      units.push({ ...unit, state: "queued", token_hash: null, worker: null });
    }
    const next = { ...state, units, coordinator: "drive" };
    for (const r of requeued) await ctx.appendEvent({ type: "unit_state", data: { unit: r.unit, from: r.from, to: "queued", reason: "drive_takeover" } });
    await ctx.appendEvent({
      type: "drive_takeover",
      data: { trigger, detail, from_epoch: lease.epoch, to_epoch: epoch, codex: codex.eff, claude, requeued: requeued.map((r) => r.unit) },
    });
    const pause = quota.policy.paused && !anyRunning(next);
    if (pause) {
      next.status = "paused";
      next.status_reason = "paused-quota";
      next.resumeAt = quota.policy.resumeAt;
      await ctx.appendEvent({ type: "paused", data: { reason: "paused-quota", resets_at: resets, resumeAt: quota.policy.resumeAt } });
    }
    await ctx.writeState(next);
    return { pause, requeued };
  }));

  if (intent.requeued.length) await releaseRequeuedTokens(project, intent.requeued, d);
  // Same attempt, new dispatch: the Claude dispatch's output can never be accepted (its token is released, its late
  // report fenced), so neither its uncommitted edits nor the engine commit of a report fenced before phase 2 may reach
  // drive's worker on that branch (it would be rejected as "the worker committed" and charged an attempt). Done
  // before drive's first dispatch; drive is the only coordinator from here.
  for (const r of intent.requeued) await restoreRequeued(project, runId, { id: r.unit, worktree: r.worktree, attempt: r.attempt, parked: r.parked, pending_answer: r.pending_answer }, d);
  const requeued = intent.requeued.map((r) => r.unit);
  driveLog(project, `takeover: trigger ${trigger}${detail ? ` (${detail})` : ""}, epoch ${lease.epoch} -> ${epoch}, codex ${codex.eff.state === "known" ? `${codex.eff.pct} %` : "unknown"}${requeued.length ? `, requeued ${requeued.join(",")}` : ""}`, d);

  if (intent.pause) {
    await withEpoch(epoch, async () => {
      await bs.quiesce(project, moved.token, epoch, { projectStatus: false });
      await bs.finalizeRelease(project, moved.token, epoch);
    });
    driveLog(project, "takeover: Neither tool fits, run paused (paused-quota), lease released", d);
    await say("paused-quota", { project, resets: resets.codex ?? resets.claude ?? null }, d);
    return { outcome: "paused-quota", epoch, codex: codex.eff, requeued };
  }
  await say("takeover", { project }, d);
  return { outcome: "loop", epoch, codex: codex.eff, requeued };
}

/** Restore the worktree of a unit requeued by the takeover (units.restoreUnitWorktree); the outcome goes to drive.log. */
async function restoreRequeued(project, runId, unit, d) {
  const p = pathsOf(project, d);
  const base = unit.parked === "built_on_assumption" && unit.pending_answer ? p.assumeBranch(runId, unit.pending_answer) : undefined;
  try {
    const reset = await restoreUnitWorktree({ project, runId, unit, base }, { exec: d.exec, env: d.env });
    if (reset.reset) driveLog(project, `takeover: worktree of ${unit.id} restored (${reset.discarded_commits} commit(s) discarded, dirty ${reset.dirty}, head was ${reset.head})`, d);
  } catch (error) {
    driveLog(project, `takeover: worktree of ${unit.id} NOT restored: ${error.message}`, d);
  }
}

const withEpoch = async (epoch, fn) => {
  try { return await fn(); } catch (error) {
    if (error && typeof error === "object" && error.epoch === undefined) error.epoch = epoch;
    throw error;
  }
};

// A requeued unit's admission reservation is void (it gets a new token at its next dispatch).
async function releaseRequeuedTokens(project, requeued, d) {
  try {
    const admission = d.admission ?? (await import("../admission.mjs"));
    const file = pathsOf(project, d).admissionFile;
    for (const r of requeued) admission.releaseToken(r.unit, { file });
  } catch (error) {
    driveLog(project, `takeover: admission token release failed: ${error.message}`, d);
  }
}
