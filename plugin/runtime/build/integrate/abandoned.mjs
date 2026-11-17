// Remove rejected unit contributions before any surviving batch can land. Source branches stay intact.
import path from "node:path";
import { git } from "../units.mjs";
import { transitionWorkOrders } from "./transitions.mjs";
import { patchUnit } from "../state.mjs";

/** Called under the run fence. Git trailers make exclusion replayable after a crash between commit and journal. */
export async function excludeAbandoned(ctx, deps = {}) {
  let state = await ctx.readState();
  const root = path.resolve(ctx.project, state.integration.worktree);
  for (const unit of [...state.units].reverse().filter(u => u.state === "abandoned" && u.rescue?.exclusion?.pending !== false)) {
    let exclusion;
    try {
      if ((await git(deps, root, ["status", "--porcelain"])).stdout.trim()) throw new Error("integration checkout is dirty");
      if ((await git(deps, root, ["branch", "--show-current"])).stdout.trim() !== state.integration.branch) throw new Error("integration branch is not checked out");
      const log = (await git(deps, root, ["log", "--format=%H%x1f%B%x1e", `${state.integration.base_sha}..HEAD`])).stdout;
      const entries = log.split("\x1e").map(row => { const [sha, body = ""] = row.trim().split("\x1f"); return { sha, body }; });
      const reverted = new Set(entries.flatMap(e => [...e.body.matchAll(/^Abandoned-Commit: ([a-f0-9]{40})$/gm)].map(m => m[1])));
      const commits = entries.filter(e => e.body.split("\n").some(line => line === `Unit: ${unit.id}`));
      for (const commit of commits) {
        if (reverted.has(commit.sha)) continue;
        try {
          await git(deps, root, ["revert", "--no-commit", commit.sha]);
          await git(deps, root, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "--no-verify", "-m", `fix(build): exclude abandoned ${unit.id}\n\nAbandoned-Unit: ${unit.id}\nAbandoned-Commit: ${commit.sha}`]);
        } catch (error) {
          // Revert conflicts never leak a partial inverse into landing. Preserve the original branch.
          await git(deps, root, ["revert", "--abort"]).catch(() => {});
          throw error;
        }
      }
      // Aggregate status/track metadata belongs to every integrated unit. Recompute the
      // abandoned WO transition instead of reverting another unit's counters or history.
      if (unit.wos?.length) await transitionWorkOrders({ integration: state.integration, runId: state.run_id, wos: unit.wos, to: "BLOCKED", reason: unit.rescue?.failure ?? "unit abandoned", unitId: unit.id }, deps);
      exclusion = { pending: false, commits: commits.map(c => c.sha) };
    } catch (error) {
      exclusion = { pending: true, blocked: String(error.message).slice(0, 500) };
    }
    const next = { ...unit, rescue: { ...unit.rescue, exclusion } };
    await ctx.appendEvent({ type: "rescue_stage", data: { unit: unit.id, unit_snapshot: next } });
    state = patchUnit(state, unit.id, next);
    await ctx.writeState(state);
  }
  return state;
}
