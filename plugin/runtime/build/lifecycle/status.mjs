// Read-only `status` snapshot and the `rebuild-state` command.
import { readStandby } from "../drive.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, readState, rebuildState } from "../state.mjs";
import { readSummary } from "../summary.mjs";
import { bsOf, clockMs, depsOf, isAliveDefault } from "./common.mjs";

/**
 * `status`: the run snapshot of build-engine-cli 3.21. Without a run every field is null/empty. `gaps` lists unreadable signals
 * (the dispatcher then exits 9).
 */
export async function statusSnapshot(project, deps = {}) {
  const d = depsOf(deps);
  const bs = bsOf(d);
  const p = buildPaths(project, d);
  const gaps = [];
  const state = await readState(project, d);
  if (!state) return { run_id: null, epoch: null, coordinator: null, status: null, status_reason: null, label: null, size: null, units_by_state: {}, lease: { renewed_at: null, ttl_seconds: null, live: false }, quota: { claude: null, codex: null }, drive: { armed: false, state: null }, deferred_pending: 0, open_questions: [], gaps };
  const lease = await bs.currentLease(project);
  const summary = await readSummary(project, d);
  let drive = { armed: false, state: null };
  try {
    const standby = await readStandby(project, { ...d, isAlive: d.isAlive });
    if (standby) drive = { armed: (d.isAlive ?? isAliveDefault)(standby.pid) && standby.state !== "stopped", state: standby.state ?? null };
  } catch { gaps.push("drive"); }
  return {
    run_id: state.run_id, epoch: lease?.epoch ?? state.epoch, coordinator: state.coordinator, status: state.status, status_reason: state.status_reason ?? null,
    label: state.label, size: state.size, units_by_state: summary.units_by_state ?? {},
    lease: lease ? { renewed_at: lease.renewed_at, ttl_seconds: lease.ttl_seconds, live: bs.isFresh(lease, clockMs(d)) } : { renewed_at: null, ttl_seconds: null, live: false },
    quota: summary.quota ?? { claude: null, codex: null }, drive, deferred_pending: summary.deferred_pending, open_questions: summary.open_questions, gaps,
  };
}

/** `rebuild-state --epoch N`: replay the journal and the integration worktree's frontmatter; write `state.json` when it differs. */
export async function rebuildStateCommand({ project, epoch }, deps = {}) {
  const d = depsOf(deps);
  return fencedTwoPhase({ project, epoch: Number(epoch), deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const rebuilt = await rebuildState({ project, deps: d });
    const { changed, added, removed, fields } = rebuilt.diff;
    if (changed.length + added.length + removed.length + fields.length > 0) await ctx.writeState(rebuilt.state);
    return { units: rebuilt.state.units.length, diff_vs_cache: { changed, added, removed }, fields, conflicts: rebuilt.conflicts };
  });
}
