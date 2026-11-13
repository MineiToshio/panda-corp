// Re-review only the latest integrated patch execution, excluding earlier FRD work and older attempts.
import * as fsp from "node:fs/promises";
import { defaultExec } from "../fsx.mjs";
import { reviewedUnits } from "./degradation.mjs";
import { git } from "./git.mjs";
import { err } from "./common.mjs";

export async function reviewRange({ state, review, tip = null, briefFile = null }, deps = {}) {
  if (briefFile) {
    const brief = await (deps.fs ?? fsp).readFile(briefFile, "utf8").catch((e) => { if (e.code === "ENOENT") return ""; throw e; });
    const pinned = /^Diff range: ([a-f0-9]{40}(?:[a-f0-9]{24})?\.\.[a-f0-9]{40}(?:[a-f0-9]{24})?)$/m.exec(brief)?.[1];
    if (pinned) return pinned;
  }
  const exec = deps.exec ?? defaultExec;
  const root = state.integration.worktree;
  const end = tip ?? await git(exec, root, ["rev-parse", "HEAD"]);
  const full = `${state.integration.base_sha}..${end}`;
  const pending = reviewedUnits(state, review).filter((u) => u.kind === "patch" && ["integrated", "reviewing"].includes(u.state));
  if (!pending.length) return full;
  const commits = new Set();
  for (const patch of pending) {
    const escaped = patch.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sha = await git(exec, root, ["log", "-1", "--format=%H", "--extended-regexp", `--grep=^Unit: ${escaped}$`, full]);
    if (!sha) throw err("INVALID_STATE", `patch ${patch.id} has no integrated commit for its review range`);
    commits.add(sha);
  }
  const ordered = (await git(exec, root, ["rev-list", "--reverse", full])).split("\n").filter((sha) => commits.has(sha));
  const base = await git(exec, root, ["rev-parse", `${ordered[0]}^`]);
  return `${base}..${ordered.at(-1)}`;
}
