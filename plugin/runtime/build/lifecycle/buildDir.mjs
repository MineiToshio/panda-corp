// Moves of build/ (A4): archive, suspend, restore. Registered worktrees move with `git worktree move`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { readJson } from "../fsx.mjs";
import { moveWorktreesUnder } from "../integrate.mjs";
import { buildPaths } from "../paths.mjs";
import { clockMs, err, git } from "./common.mjs";

const exists = (target) => fsp.lstat(target).then(() => true, () => false);

async function mergeMove(src, dst) {
  if (!(await exists(dst))) { await fsp.mkdir(path.dirname(dst), { recursive: true }); await fsp.rename(src, dst); return; }
  const [a, b] = await Promise.all([fsp.lstat(src), fsp.lstat(dst)]);
  if (!a.isDirectory() || !b.isDirectory()) throw err("INVALID_STATE", `cannot move ${src}: ${dst} already exists`);
  for (const name of await fsp.readdir(src)) await mergeMove(path.join(src, name), path.join(dst, name));
  await fsp.rmdir(src);
}

/** Move everything of `from` into `to` (worktrees first, then plain entries); `keep` names stay, `drop` names are deleted. */
async function moveBuildDir({ project, from, to, keep = [], drop = [] }, d) {
  if (await exists(to)) throw err("INVALID_STATE", `${to} already exists (run id collision)`);
  await fsp.mkdir(to, { recursive: true });
  await moveWorktreesUnder({ project, from, to }, d);
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
  await moveWorktreesUnder({ project, from, to: p.build }, d);
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
