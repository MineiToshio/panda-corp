import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { runGit } from "@/lib/git/git";

export type LastCommit =
  | { readonly at: string }
  | { readonly at: null; readonly reason: "no-repository" | "unreadable" };

function hasRepository(projectPath: string): boolean {
  let current = path.resolve(projectPath);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/** One git read per project per request; fixture mode never probes the host's repository. */
export const getLastCommit = cache((projectPath: string): LastCommit => {
  if (process.env.MC_GIT_FIXTURE === undefined && !hasRepository(projectPath))
    return { at: null, reason: "no-repository" };
  try {
    const at = runGit(["log", "-1", "--format=%cI"], projectPath);
    return Number.isFinite(Date.parse(at)) ? { at } : { at: null, reason: "unreadable" };
  } catch {
    return { at: null, reason: "unreadable" };
  }
});
