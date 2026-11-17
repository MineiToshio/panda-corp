// Remove rejected contributions before landing. Source branches remain intact for diagnosis.
import path from "node:path";
import { git } from "../units.mjs";
import { transitionWorkOrders } from "./transitions.mjs";
import { patchUnit } from "../state.mjs";
import { releaseToken } from "../admission.mjs";
import { failureIdentity } from "../failure-identity.mjs";

async function saveUnit(ctx, state, unit, type = "rescue_stage") {
  await ctx.appendEvent({ type, data: { unit: unit.id, unit_snapshot: unit } });
  const next = patchUnit(state, unit.id, unit);
  await ctx.writeState(next);
  return next;
}

// A conflicting later writer and its transitive consumers must be excluded together.
async function abandonClosure(ctx, state, ids, reason) {
  const lost = new Set(ids);
  for (let grew = true; grew;) {
    grew = false;
    for (const u of state.units) if (!lost.has(u.id) && u.state !== "landed" && (u.depends_on ?? []).some(id => lost.has(id))) { lost.add(u.id); grew = true; }
  }
  for (const unit of state.units.filter(u => lost.has(u.id) && !["landed", "abandoned"].includes(u.state))) {
    const jobs = (state.jobs ?? []).filter(j => j.unit === unit.id && j.state === "running" && j.kind === "worker");
    const next = { ...unit, state: "abandoned", token_hash: null, parked: null, pending_answer: null,
      rescue: { ...unit.rescue, phase: "failed", failure: reason, exclusion: { pending: true },
        previous_jobs: [...(unit.rescue?.previous_jobs ?? []), ...jobs] } };
    releaseToken(unit.id, { file: ctx.paths.admissionFile });
    state = await saveUnit(ctx, state, next, "unit_abandoned");
    for (const job of jobs) await ctx.appendEvent({ type: "job_finished", data: { id: job.id, state: "done", exit: null } });
    state = { ...state, jobs: (state.jobs ?? []).map(j => jobs.some(old => old.id === j.id) ? { ...j, state: "done", exit: null } : j) };
    await ctx.writeState(state);
  }
  return state;
}

/** Called under the run fence. Each retry excludes at least one new writer; otherwise close without landing. */
export async function excludeAbandoned(ctx, deps = {}) {
  let state = await ctx.readState();
  const root = path.resolve(ctx.project, state.integration.worktree);
  const budget = state.units.length + 1;
  for (let attempt = 0; attempt < budget; attempt++) {
    let retry = false;
    const pending = state.units.filter(u => u.state === "abandoned" && u.rescue?.exclusion?.pending !== false);
    if (!pending.length) return state;
    for (const original of [...pending].reverse()) {
      let unit = state.units.find(u => u.id === original.id), conflicting = [], entries = [], failedCommit;
      try {
        if ((await git(deps, root, ["status", "--porcelain"])).stdout.trim()) throw new Error("integration checkout is dirty");
        if ((await git(deps, root, ["branch", "--show-current"])).stdout.trim() !== state.integration.branch) throw new Error("integration branch is not checked out");
        const log = (await git(deps, root, ["log", "--format=%H%x1f%B%x1e", `${state.integration.base_sha}..HEAD`])).stdout;
        entries = log.split("\x1e").map(row => { const [sha, body = ""] = row.trim().split("\x1f"); return { sha, body }; });
        const reverted = new Set(entries.flatMap(e => [...e.body.matchAll(/^Abandoned-Commit: ([a-f0-9]{40})$/gm)].map(m => m[1])));
        const commits = entries.filter(e => e.body.split("\n").includes(`Unit: ${unit.id}`));
        for (const commit of commits) {
          if (reverted.has(commit.sha)) continue;
          failedCommit = commit;
          try {
            await git(deps, root, ["revert", "--no-commit", commit.sha]);
            await git(deps, root, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "--no-verify", "-m", `fix(build): exclude abandoned ${unit.id}\n\nAbandoned-Unit: ${unit.id}\nAbandoned-Commit: ${commit.sha}`]);
          } catch (error) {
            conflicting = (await git(deps, root, ["diff", "--name-only", "--diff-filter=U"]).catch(() => ({ stdout: "" }))).stdout.split("\n").filter(Boolean);
            await git(deps, root, ["revert", "--abort"]).catch(() => {});
            throw error;
          }
        }
        // Reconcile per-unit metadata; never revert shared aggregate commits.
        if (unit.wos?.length) await transitionWorkOrders({ integration: state.integration, runId: state.run_id, wos: unit.wos, to: "BLOCKED", reason: unit.rescue?.failure ?? "unit abandoned", unitId: unit.id }, deps);
        state = await saveUnit(ctx, state, { ...unit, rescue: { ...unit.rescue, exclusion: { pending: false, commits: commits.map(c => c.sha) } } });
      } catch (error) {
        const failure = { code: "exclusion_failed", files: conflicting, detail: String(error.message).slice(0, 500) };
        unit = { ...unit, technical_failures: [...(unit.technical_failures ?? []), { ...failure, key: failureIdentity(unit, failure) }],
          rescue: { ...unit.rescue, exclusion: { pending: true, blocked: failure.detail, attempts: (unit.rescue?.exclusion?.attempts ?? 0) + 1 } } };
        state = await saveUnit(ctx, state, unit, "technical_failure");
        const blockers = new Set();
        // Only later product writers touching the actual conflict paths can block the inverse.
        for (const entry of entries.slice(0, entries.indexOf(failedCommit))) {
          const id = /^Unit: (.+)$/m.exec(entry.body)?.[1];
          const writer = state.units.find(u => u.id === id);
          if (!writer || ["landed", "abandoned"].includes(writer.state)) continue;
          const files = (await git(deps, root, ["diff-tree", "--no-commit-id", "--name-only", "-r", entry.sha]).catch(() => ({ stdout: "" }))).stdout.split("\n");
          if (files.some(f => conflicting.includes(f))) blockers.add(id);
        }
        if (blockers.size && attempt + 1 < budget) {
          state = await abandonClosure(ctx, state, blockers, `exclusion conflict with abandoned ${unit.id}`);
          retry = true;
          break;
        }
        // An I/O fault, unknown writer or failed inverse cannot hold closure open forever.
        // Quarantine ALL remaining contributions; unresolved tree is never a landable batch.
        const reason = `unresolved exclusion of ${unit.id}: ${failure.detail}`;
        state = await abandonClosure(ctx, state, state.units.filter(u => u.state !== "landed").map(u => u.id), reason);
        for (const u of state.units.filter(u => u.state === "abandoned")) {
          state = await saveUnit(ctx, state, { ...u, rescue: { ...u.rescue,
            failure: `${u.rescue?.failure ?? "unit abandoned"}; ${reason}`,
            exclusion: { ...u.rescue?.exclusion, pending: false, unresolved: true, blocked: reason } } });
        }
        return state;
      }
    }
    if (!retry) return state;
  }
  return state;
}
