// Report-owned paths only: HEAD proves tracked provenance; staging alone is not worker authorization.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { git } from "./units/git.mjs";

const sensitive = /(^|\/)\.env[^/]*(\/|$)|(^|\/)(?:secrets?|credentials?)(?:[./]|$)|(^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$|\.(?:pem|key|p12|pfx)$/i;
const nulPaths = (stdout) => new Set(String(stdout).split("\0").filter(Boolean));

/** Inspect only normalized report paths, including ignored files that normal status never lists. */
export async function inspectReportFiles({ worktree, prefix, reported, artifacts, kind }, deps) {
  const tracked = new Set();
  const indexed = new Set();
  const forced = new Set();
  const additions = [];
  const reasons = [];
  if (!reported.size) return { tracked, indexed, forced, additions, reasons };
  const files = [...reported].map((rel) => `${prefix}${rel}`);
  const tree = await git(deps, worktree, ["--literal-pathspecs", "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", ...files]);
  for (const file of nulPaths(tree.stdout)) tracked.add(file);
  const index = await git(deps, worktree, ["--literal-pathspecs", "ls-files", "-z", "--", ...files]);
  for (const file of nulPaths(index.stdout)) indexed.add(file);
  const fs = deps.fs ?? fsp;
  const statOf = async (file) => {
    try { return await fs.lstat(path.join(worktree, file)); }
    catch (e) { if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e; return null; }
  };
  for (const rel of reported) {
    const file = `${prefix}${rel}`;
    if (sensitive.test(rel)) {
      reasons.push(`${rel}: sensitive path (.env*, secrets or credentials) cannot be committed by a worker report`);
      continue;
    }
    let unsafeParent = false;
    const segments = file.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      const parent = await statOf(segments.slice(0, i).join("/"));
      if (parent && !parent.isDirectory()) { unsafeParent = true; break; }
    }
    if (unsafeParent) { reasons.push(`${rel}: reported path crosses a symbolic link or non-directory`); continue; }
    if (tracked.has(file)) {
      if (!indexed.has(file) && await statOf(file)) reasons.push(`${rel}: tracked file removed from the index but still present; restore the index or delete the file before reporting`);
      continue;
    }
    // check-ignore -z requires stdin; quiet per-path checks avoid parsing quoted/newline-bearing output.
    const ignored = await git(deps, worktree, ["check-ignore", "--no-index", "-q", "--", file], { allowFail: true });
    if (ignored.code !== 0 && ignored.code !== 1) {
      throw Object.assign(new Error(`git check-ignore failed (exit ${ignored.code}) in ${worktree}`), { code: "INVALID_STATE" });
    }
    if (ignored.code === 1) continue;
    // A broad directory/glob (or the docs/tests implicit allowlist) is not permission to force ignored output.
    const explicit = (kind === "build" || kind === "patch") && artifacts.some((a) => String(a).replace(/\\/g, "/").replace(/^\.\//, "") === rel && !/[*?]/.test(a));
    if (!explicit) {
      reasons.push(`${rel}: new ignored file requires an explicit exact WO artifact; broad or implicit allowlists cannot force it`);
      continue;
    }
    const stat = await statOf(file);
    if (!stat?.isFile()) {
      reasons.push(`${rel}: an explicit ignored artifact must be an existing regular file`);
      continue;
    }
    forced.add(file);
    additions.push({ rel, status: "A" });
  }
  return { tracked, indexed, forced, additions, reasons };
}

/** Never force directories, implicit allowlists, ignored neighbors or the whole checkout. */
export async function stageReportFiles(worktree, files, inspection, deps) {
  const groups = [
    ["-u", files.filter((f) => inspection.tracked.has(f) && inspection.indexed.has(f))],
    ["-A", files.filter((f) => !inspection.tracked.has(f) && !inspection.forced.has(f))],
    ["-f", files.filter((f) => inspection.forced.has(f))],
  ];
  for (const [flag, paths] of groups) if (paths.length) await git(deps, worktree, ["--literal-pathspecs", "add", flag, "--", ...paths]);
}
