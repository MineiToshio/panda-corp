// Default deferral of a security audit that reached drive (split from drive.mjs).
import { enqueueDeferred } from "../deferred.mjs";
import { MODEL_STRENGTH } from "../routing.mjs";
import { fencedTwoPhase, isTerminalUnit } from "../state.mjs";
import { err } from "./constants.mjs";
import { buildStateOf, nowMs, pathsOf, stateDeps, withDefaults } from "./context.mjs";

const STRENGTH = MODEL_STRENGTH;
const SCHEMA_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);

/**
 * Default deferral of a security audit that reached drive (BUILD-14: never run under drive): append a pending
 * `deferred-reviews.json` entry for Claude (opus high, `degraded: quota_90`), mark the audit unit `verified` as a
 * review-type terminal (its real verdict comes from the deferred re-review) and journal it, all under drive's epoch.
 * @param {{project: string, epoch: number, unit: object}} input `unit` = the dispatch cell `next` returned
 * @param {object} [deps]
 * @returns {Promise<{entry: object}>}
 */
export async function deferAuditUnit({ project, epoch, unit }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  return fencedTwoPhase({ project, epoch, actor: "drive", deps: stateDeps(d, bs) }, undefined, undefined, async (_r, _i, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no state.json");
    const record = state.units.find((u) => u.id === unit.unit) ?? null;
    const authors = state.units.map((u) => u.worker).filter((w) => w && ["claude", "codex"].includes(w.runtime) && STRENGTH[w.model]);
    const strongest = authors.reduce((best, a) => (!best || STRENGTH[a.model] > STRENGTH[best.model] ? a : best), null);
    // Without a recorded builder the author is drive's own column (Codex); the ledger requires one.
    const author = strongest
      ? { runtime: strongest.runtime, model: strongest.model, effort: SCHEMA_EFFORTS.has(strongest.effort) ? strongest.effort : "high" }
      : { runtime: "codex", model: "sol", effort: "high" };
    const base = state.integration?.base_sha ?? "HEAD";
    const { entry } = await enqueueDeferred(project, {
      unit: unit.unit, kind: "audit", frd: record?.frd ?? unit.frd ?? null, sha_range: `${base}..${pathsOf(project, d).integrationBranch(state.run_id)}`,
      author, reviewer_used: null, degraded: "quota_90", needed: "claude",
    }, { env: d.env, homedir: d.homedir, clock: () => new Date(nowMs(d)) });
    await ctx.appendEvent({ type: "deferred_review_queued", data: { id: entry.id, unit: unit.unit, frd: entry.frd, needed: "claude", degraded: "quota_90", reviewer_used: null } });
    if (record && !isTerminalUnit(record)) {
      await ctx.appendEvent({ type: "unit_state", data: { unit: record.id, from: record.state, to: "verified", reason: "audit_deferred_to_claude" } });
      await ctx.writeState({ ...state, units: state.units.map((u) => (u.id === record.id ? { ...u, state: "verified", token_hash: null, worker: null } : u)) });
    }
    return { entry };
  });
}
