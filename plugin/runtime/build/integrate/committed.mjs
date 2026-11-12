// `integrateCommitted`: phase 2 of `next` (CLI doc 4.1), every committed chain of a run, sequentially.
import { nowIso } from "../fsx.mjs";
import { err, isAssumed } from "./common.mjs";
import { assumeIntegration, mergeAcceptedAssumptions } from "./assumptions.mjs";
import { committedUnits, integrateUnit } from "./chain.mjs";
import { removeWorktree } from "./worktrees.mjs";

/**
 * Integrate every committed chain of a run into `lane/<run_id>/integration` (phase 2 of `next`, CLI doc 4.1), sequentially.
 * First, every accepted assumption branch not merged yet is merged into the integration branch (`--no-ff`, trailer
 * `Doubt:`; listed in `merged`, events `integrated {unit: null, doubt, sha}` + `safe_point`); a merge conflict is reported
 * in `conflicts` as `{doubt, unit: <doubting unit>, reason: "rebase_conflict", files}` and the doubting unit and its
 * dependents are not integrated this round. Then each committed unit integrates: a unit still built on an assumption
 * (`parked: built_on_assumption`) into its `lane/<run_id>/assume-<doubt>` branch (worktree `paths.assumeWorktree`, code
 * only, no WO transition, no safe point; item `assumption: <doubt>`), every other unit into the integration branch. A unit
 * that conflicts stays `committed` and is reported in `conflicts` (its dependents are skipped this round); the caller hands
 * it back. Integrated units get state `integrated`; an integration-branch unit moves `last_safe_point` to
 * `{sha, kind: "integration-land"}`. Journal events are returned and, when `appendEvent` is given, appended in order:
 * `integrated {unit, sha[, assumption]}`, `unit_state {unit, from: "committed", to: "integrated"}`, `safe_point {sha, kind}`.
 * Unit worktrees of integrated units are removed (their branches are kept) unless `keepWorktrees`.
 * @param {{state: object, runId?: string, appendEvent?: (event: {type: string, data: object}) => Promise<any>, keepWorktrees?: boolean}} input
 *   `state.integration` supplies branch and worktree; the input state is not mutated
 * @param {object} [deps] see `integrateUnit`; `project` (main checkout root) is needed for doubt records, assumption
 *   worktrees, worktree removal and unit-branch naming (without it no assumption work is merged or integrated)
 * @returns {Promise<{state: object, integrated: object[], merged: object[], conflicts: object[], events: {type: string, data: object}[], cleanup: object[]}>}
 */
export async function integrateCommitted({ state, runId = state.run_id, appendEvent, keepWorktrees = false }, deps = {}) {
  const integration = state.integration;
  let next = structuredClone(state);
  const integrated = [];
  const conflicts = [];
  const events = [];
  const cleanup = [];
  const blocked = new Set();
  const emit = async (type, data) => {
    const event = { type, data };
    events.push(event);
    if (appendEvent) await appendEvent(event);
  };
  let merged = [];
  if (deps.project) {
    const res = await mergeAcceptedAssumptions({ state, runId, integration, emit }, deps);
    merged = res.merged;
    for (const c of res.conflicts) {
      conflicts.push(c);
      if (c.unit) blocked.add(c.unit);
    }
    // Everything downstream of a doubting unit whose branch did not merge waits for its hand-back (it builds on that code).
    for (let grew = blocked.size > 0; grew;) {
      grew = false;
      for (const u of state.units) if (!blocked.has(u.id) && (u.depends_on ?? []).some((d) => blocked.has(d))) { blocked.add(u.id); grew = true; }
    }
    if (merged.length) next = { ...next, last_safe_point: { sha: merged.at(-1).sha, kind: "integration-land", at: nowIso(deps) } };
  }
  const assumeTargets = new Map();
  for (const unit of committedUnits(state)) {
    if (blocked.has(unit.id) || (unit.depends_on ?? []).some((d) => blocked.has(d))) { blocked.add(unit.id); continue; }
    const doubt = isAssumed(unit) ? unit.pending_answer : null;
    if (isAssumed(unit) && !doubt) throw err("INVALID_STATE", `unit ${unit.id} is built on an assumption but names no doubt (pending_answer)`);
    if (doubt && !deps.project) { blocked.add(unit.id); continue; }
    if (doubt && !assumeTargets.has(doubt)) assumeTargets.set(doubt, await assumeIntegration({ project: deps.project, runId, doubt }, deps));
    const target = doubt ? assumeTargets.get(doubt) : integration;
    const res = await integrateUnit({ unit, integration: { branch: target.branch, worktree: target.worktree }, runId, workOrders: !doubt }, deps);
    if (res.outcome === "conflict") { conflicts.push(doubt ? { ...res, assumption: doubt } : res); blocked.add(unit.id); continue; }
    integrated.push(doubt ? { ...res, assumption: doubt } : res);
    await emit("integrated", { unit: unit.id, sha: res.sha, ...(doubt ? { assumption: doubt } : {}) });
    await emit("unit_state", { unit: unit.id, from: "committed", to: "integrated" });
    if (!doubt) await emit("safe_point", { sha: res.sha, kind: "integration-land" });
    next = {
      ...next,
      ...(doubt ? {} : { last_safe_point: { sha: res.sha, kind: "integration-land", at: nowIso(deps) } }),
      units: next.units.map((u) => (u.id === unit.id ? { ...u, state: "integrated" } : u)),
    };
    if (!keepWorktrees && unit.worktree && deps.project) {
      try { cleanup.push({ unit: unit.id, ...(await removeWorktree({ project: deps.project, worktree: unit.worktree, state: next }, deps)) }); }
      catch (e) { cleanup.push({ unit: unit.id, removed: false, worktree: unit.worktree, error: String(e?.message ?? e) }); }
    }
  }
  return { state: next, integrated, merged, conflicts, events, cleanup };
}
