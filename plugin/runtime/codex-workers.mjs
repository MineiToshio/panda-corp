// codex-workers.mjs — the ONE place that stops the Codex workers of a project (DR-142).
// A Codex worker runs detached (it must outlive its relay's Bash call), so nothing kills it when the run ends. Every
// end of a run passes through the lease (quiesce, or a reclaim of a dead run's lease): build-state.mjs calls this
// there, and `codex-worker.mjs stop` reuses it by hand. A worker whose `exit` file exists has already finished.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ID_RE = /^[A-Za-z0-9._-]{1,120}$/;

/** Kills (SIGTERM, whole process group) every still-running worker under <project>/.pandacorp/run/codex-workers.
 *  @param {string} project  the project root
 *  @param {string[]} [ids]  only these worker ids (default: all)
 *  @returns {string[]} the ids that were signalled */
export function stopCodexWorkers(project, ids) {
  const root = path.join(project, ".pandacorp/run/codex-workers");
  if (!existsSync(root)) return [];
  const killed = [];
  for (const id of ids || readdirSync(root)) {
    if (!ID_RE.test(id)) continue;
    const dir = path.join(root, id);
    if (existsSync(path.join(dir, "exit"))) continue;
    let state;
    try { state = JSON.parse(readFileSync(path.join(dir, "state.json"), "utf8")); } catch { continue; }   // never started: nothing to stop
    if (!Number.isInteger(state.pid)) continue;
    try { process.kill(-state.pid, "SIGTERM"); killed.push(id); } catch { /* the group is already gone */ }
  }
  return killed;
}
