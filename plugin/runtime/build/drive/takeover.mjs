// Same-run authority transfer: preserve live/suspended executions and their worktrees.
import nodeFs from "node:fs";
import { readJson } from "../fsx.mjs";
import { readQuota } from "../quota.mjs";
import { fencedTwoPhase } from "../state.mjs";
import { err, isFenceError } from "./constants.mjs";
import { buildStateOf, driveLog, nowMs, pathsOf, say, stateDeps, withDefaults } from "./context.mjs";
import { setOwnStandbyState } from "./standby.mjs";


/** Transfer coordinator authority for explicit handover or silent-lease recovery.
 * Current executions (including native agents and suspended sessions) retain their cell, token,
 * attempt and worktree. Only next's real candidates decide capacity; takeover never resets work.
 * @returns {Promise<{outcome: "loop"|"retry", epoch: number|null, codex: object|null, requeued: string[]}>}
 */
export async function takeOver({ project, runId, trigger, detail = null }, deps) {
  const d = withDefaults(deps);
  if (trigger === "b") return { outcome: "retry", epoch: null, codex: null, requeued: [] };
  const bs = await buildStateOf(d);
  const paths = pathsOf(project, d);
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
  const claude = quota.effective.claude;

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

  // From here drive holds the lease: a failure must carry the epoch so the failure path can release it.
  const intent = await withEpoch(epoch, () => fencedTwoPhase({ project, epoch, actor: "drive", deps: stateDeps(d, bs) }, undefined, undefined, async (_result, _intent, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "state.json disappeared during takeover");
    // Transfer only coordinator authority. Live and suspended executions retain cell, token,
    // session and worktree, including dirty edits; a quota receipt is never a reset/requeue.
    const requeued = [];
    const next = { ...state, coordinator: "drive" };
    await ctx.appendEvent({
      type: "drive_takeover",
      data: { trigger, detail, from_epoch: lease.epoch, to_epoch: epoch, codex: codex.eff, claude, requeued: requeued.map((r) => r.unit) },
    });
    await ctx.writeState(next);
    return { requeued };
  }));

  const requeued = intent.requeued.map((r) => r.unit);
  driveLog(project, `takeover: trigger ${trigger}${detail ? ` (${detail})` : ""}, epoch ${lease.epoch} -> ${epoch}, codex ${codex.eff.state === "known" ? `${codex.eff.pct} %` : "unknown"}${requeued.length ? `, requeued ${requeued.join(",")}` : ""}`, d);

  await say("takeover", { project }, d);
  return { outcome: "loop", epoch, codex: codex.eff, requeued };
}

const withEpoch = async (epoch, fn) => {
  try { return await fn(); } catch (error) {
    if (error && typeof error === "object" && error.epoch === undefined) error.epoch = epoch;
    throw error;
  }
};
