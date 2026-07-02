import fs from "node:fs";
import path from "node:path";

/**
 * Max mtime (epoch ms) across a project's machine state — `.pandacorp/status.yaml`
 * plus every FRD work-order file (`docs/frds/<frd>/work-orders/<wo>.md`).
 *
 * The SSE transport stamps this into each frame so a build that advances STATE
 * without emitting an EVENT (cold start, a long gate rewriting frontmatter) still
 * signals consumers to re-read (DR-066: the feed must not look dead while the
 * state file moves). Returns undefined when nothing is statable (missing project).
 *
 * @param projectPath - Absolute project root.
 */
export function stateVersion(projectPath: string): number | undefined {
  let max: number | undefined;

  const consider = (candidate: string): void => {
    try {
      const mtime = fs.statSync(candidate).mtimeMs;
      if (max === undefined || mtime > max) max = mtime;
    } catch {
      // Missing/unreadable → not a signal source; skip.
    }
  };

  consider(path.join(projectPath, ".pandacorp", "status.yaml"));

  const frdsDir = path.join(projectPath, "docs", "frds");
  let frds: string[] = [];
  try {
    frds = fs.readdirSync(frdsDir);
  } catch {
    return max;
  }
  for (const frd of frds) {
    const woDir = path.join(frdsDir, frd, "work-orders");
    let files: string[] = [];
    try {
      files = fs.readdirSync(woDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (file.endsWith(".md")) consider(path.join(woDir, file));
    }
  }
  return max;
}
