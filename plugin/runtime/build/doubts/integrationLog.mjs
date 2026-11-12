// Writes of the doubt ladder into the integration worktree and the owner's inbox: log entries, the inbox file and commits.
import * as fsp from "node:fs/promises";
import { atomicWriteText, defaultExec, writeTarget } from "../fsx.mjs";
import { err, oneLine } from "./common.mjs";

export async function prependEntry(abs, entry, header, deps) {
  const fs = deps.fs ?? fsp;
  let current = "";
  try { current = await fs.readFile(abs, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const first = current.search(/^## /m);
  const next = !current.trim() ? `${header}\n\n${entry}` : first < 0 ? `${current.replace(/\s*$/, "\n\n")}${entry}` : `${current.slice(0, first)}${entry}\n${current.slice(first)}`;
  await atomicWriteText(abs, next, { fs, mode: 0o644 });
}

/**
 * Append (on top) an entry of `.pandacorp/inbox/decisions.md`: in the main checkout when the file is untracked, in the
 * integration worktree when it is tracked (D1; the caller commits it).
 * @returns {Promise<{rel: string, tracked: boolean}>}
 */
export async function writeInbox(project, integrationRoot, entry, deps) {
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  await prependEntry(abs, entry, "# Decisiones pendientes", deps);
  return { rel, tracked };
}

/**
 * Stage paths in the integration worktree. A force-tracked file under a gitignored directory (decisions.md under
 * .pandacorp/inbox) is refused by a plain `git add`: use `git add -u`, then `git add -f` (code-conventions trap).
 */
async function gitAddTracked(exec, root, files) {
  const plain = await exec("git", ["add", "-u", "--", ...files], { cwd: root });
  const untracked = await exec("git", ["ls-files", "--others", "--", ...files], { cwd: root });
  if (plain.code === 0 && untracked.code === 0 && !untracked.stdout.trim()) return plain;
  return exec("git", ["add", "-f", "--", ...files], { cwd: root });
}

export async function commitIntegration(root, files, message, deps) {
  const exec = deps.exec ?? defaultExec;
  if (!files.length) return null;
  const add = await gitAddTracked(exec, root, files);
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${oneLine(add.stderr, 200)}`);
  const commit = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", message, "--", ...files], { cwd: root });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${oneLine(commit.stderr || commit.stdout, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  return head.stdout.trim();
}
