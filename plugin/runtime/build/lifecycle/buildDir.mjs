// Moves of run metadata (A4): archive, suspend, restore. Disposable worktrees never move.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { defaultExec, readJson } from "../fsx.mjs";
import { gitIn, listWorktrees } from "../integrate/git.mjs";
import { buildPaths } from "../paths.mjs";
import { cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { cleanEngineWorktrees } from "../../../scripts/worktree-sweep.mjs";
import { bsOf, clockMs, err, git } from "./common.mjs";

const exists = (target) => fsp.lstat(target).then(() => true, () => false);

async function mergeMove(src, dst) {
  if (!(await exists(dst))) { await fsp.mkdir(path.dirname(dst), { recursive: true }); await fsp.rename(src, dst); return; }
  const [a, b] = await Promise.all([fsp.lstat(src), fsp.lstat(dst)]);
  if (!a.isDirectory() || !b.isDirectory()) throw err("INVALID_STATE", `cannot move ${src}: ${dst} already exists`);
  for (const name of await fsp.readdir(src)) await mergeMove(path.join(src, name), path.join(dst, name));
  await fsp.rmdir(src);
}

/** Reclaim eligible worktrees, refuse any protected remainder, then move run metadata. */
async function moveBuildDir({ project, from, to, keep = [], drop = [] }, d) {
  if (await exists(to)) throw err("INVALID_STATE", `${to} already exists (run id collision)`);
  await cleanupRunWorktrees({ project }, d);
  await gcWorktrees({ project }, d);
  const remaining = (await listWorktrees(gitIn(d.exec ?? defaultExec, project))).filter(w => w.path === from || w.path.startsWith(`${from}${path.sep}`));
  if (remaining.length) throw err("INVALID_STATE", "No se puede archivar el build: quedan worktrees protegidos.", { worktrees: remaining.map(w => w.path) });
  await fsp.mkdir(to, { recursive: true });
  for (const name of await fsp.readdir(from).catch(() => [])) {
    if (keep.includes(name)) continue;
    if (drop.includes(name)) { await fsp.rm(path.join(from, name), { force: true }); continue; }
    await mergeMove(path.join(from, name), path.join(to, name));
  }
}

export async function restoreSuspended({ project, runId }, d) {
  const p = buildPaths(project, d);
  const from = p.buildSuspendedDir(runId);
  if (!(await exists(from))) throw err("INVALID_STATE", `no suspended run ${runId}`);
  const remaining = (await listWorktrees(gitIn(d.exec ?? defaultExec, project))).filter(w => w.path.startsWith(`${from}${path.sep}`));
  if (remaining.length) throw err("INVALID_STATE", "El build suspendido conserva worktrees; no se moverán automáticamente.");
  for (const name of await fsp.readdir(from)) await mergeMove(path.join(from, name), path.join(p.build, name));
  await fsp.rmdir(from);
}

export async function nextRunId(project, p, d) {
  const day = new Date(clockMs(d)).toISOString().slice(0, 10);
  const used = [];
  const take = (name) => { const m = new RegExp(`^br-${day}-(\\d+)$`).exec(String(name ?? "")); if (m) used.push(Number(m[1])); };
  for (const dir of [p.buildArchiveRoot, p.buildSuspendedRoot]) for (const name of await fsp.readdir(dir).catch(() => [])) take(name);
  take((await readJson(p.stateFile).catch(() => null))?.run_id);
  const refs = await git(d, project, ["for-each-ref", "--format=%(refname:short)", "refs/heads/lane/"]);
  for (const ref of refs.stdout.split("\n")) take(ref.split("/")[1]);
  return `br-${day}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}

/** Terminal run in build/ goes to the archive, a non-terminal non-active one to build-suspended/; an active one is refused. */
export async function clearBuildDir(project, p, d) {
  const state = await readJson(p.stateFile).catch(() => { throw err("INVALID_STATE", "build/state.json is unreadable: stop or rebuild the run first", { hint: "rebuild-state" }); });
  if (!state) return null;
  if (state.status === "active") throw err("INVALID_STATE", "a run is active: resume or stop the run first");
  const dest = state.status === "finished" ? p.buildArchiveDir(state.run_id) : p.buildSuspendedDir(state.run_id);
  await moveBuildDir({ project, from: p.build, to: dest, keep: ["preflight.json"], drop: ["lease-token.json"] }, d);
  return { run_id: state.run_id, moved_to: dest };
}

/** Explicit, idempotent reclamation. The sweep owns the removal predicate; branch refs are never deleted. */
export async function gcWorktrees({ project }, deps = {}) {
  if (await bsOf(deps).currentLease(project)) throw err("CONTENDED", "Hay un lease del build vigente; gc espera a que termine.");
  const state = await readJson(buildPaths(project, deps).stateFile).catch(() => null);
  const runningPaths = [...(state?.units ?? []).filter(u => ["running", "admitted"].includes(u.state)).map(u => u.worktree).filter(Boolean), ...(state?.jobs ?? []).filter(j => j.state === "running").map(j => j.cwd).filter(Boolean)];
  const listed = await listWorktrees(gitIn(deps.exec ?? defaultExec, project));
  const excluded = listed.filter(w => runningPaths.some(p => path.resolve(p) === path.resolve(w.path) || path.resolve(p).startsWith(`${path.resolve(w.path)}${path.sep}`))).map(w => w.path);
  const active = state && state.status !== "active" ? await cleanupRunWorktrees({ project, state }, deps) : { removed: [], kept: [] };
  const swept = await cleanEngineWorktrees(project, project, { excluded });
  return { ...swept, removed: [...active.removed.map(path => ({ path })), ...swept.removed], kept: [...active.kept, ...swept.kept] };
}
