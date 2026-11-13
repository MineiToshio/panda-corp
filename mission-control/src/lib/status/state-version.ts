import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Stable numeric fingerprint of file metadata across a project's machine state — `.pandacorp/status.yaml`
 * plus v2 state/admission/lease, both decision sources and every FRD work-order file (`docs/frds/<frd>/work-orders/<wo>.md`).
 *
 * The SSE transport stamps this into each frame so a build that changes STATE
 * without emitting an EVENT (cold start, a long gate rewriting frontmatter) still
 * signals consumers to re-read (DR-066: the feed must not look dead while the
 * state file moves). Returns undefined when nothing is statable (missing project).
 *
 * @param projectPath - Absolute project root.
 */
export function stateVersion(projectPath: string): number | undefined {
  let max: number | undefined;
  const fingerprint = createHash("sha256");

  const consider = (candidate: string): void => {
    try {
      const stat = fs.statSync(candidate);
      const mtime = stat.mtimeMs;
      fingerprint.update(JSON.stringify([candidate, stat.mtimeMs, stat.ctimeMs, stat.size]));
      if (max === undefined || mtime > max) max = mtime;
    } catch {
      // Missing/unreadable → not a signal source; skip.
    }
  };

  consider(path.join(projectPath, ".pandacorp", "status.yaml"));

  for (const file of [
    ".pandacorp/run/build/state.json",
    ".pandacorp/run/build/admission.json",
    ".pandacorp/run/build.lease/lease.json",
    ".pandacorp/inbox/decisions.md",
    ".pandacorp/inbox/decisions.pending.md",
  ])
    consider(path.join(projectPath, file));

  const version = (): number | undefined =>
    max === undefined ? undefined : Number.parseInt(fingerprint.digest("hex").slice(0, 12), 16);
  const frdsDir = path.join(projectPath, "docs", "frds");
  let frds: string[] = [];
  try {
    frds = fs.readdirSync(frdsDir);
  } catch {
    return version();
  }
  for (const frd of frds.sort()) {
    const woDir = path.join(frdsDir, frd, "work-orders");
    let files: string[] = [];
    try {
      files = fs.readdirSync(woDir);
    } catch {
      continue;
    }
    for (const file of files.sort()) {
      if (file.endsWith(".md")) consider(path.join(woDir, file));
    }
  }
  return version();
}
