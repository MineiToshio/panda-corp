// Side effects of the `answer` command outside the run state: the doubt record, the owner's inbox entry and git reads.
import * as fsp from "node:fs/promises";
import { atomicWriteJson, atomicWriteText, defaultExec, loadSchema, validate, writeTarget } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import { buildPaths } from "../paths.mjs";
import { err, es } from "./common.mjs";

export async function writeDoubtRecord(project, record, deps) {
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `refusing to write an invalid doubt record ${record.id}: ${check.errors[0].path} ${check.errors[0].message}`);
  await atomicWriteJson(buildPaths(project, deps).doubtFile(record.id), record, { fs: deps.fs ?? fsp });
}

/**
 * Mark the doubt's entry of `.pandacorp/inbox/decisions.md` as answered (best effort: a missing entry changes nothing).
 * A tracked inbox is written in the integration worktree and committed there (D1).
 */
export async function markInboxAnswered(project, integrationRoot, { id, value, date }, deps) {
  const fs = deps.fs ?? fsp;
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  let text;
  try { text = await fs.readFile(abs, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const marker = `- **Id:** \`${id}\``;
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const end = text.slice(at).search(/\n## /);
  const block = end < 0 ? text.slice(at) : text.slice(at, at + end);
  const status = `- **Estado:** RESUELTO: respondido por el owner, opción ${es(value)} (${date}).`;
  const updated = block.replace(/^- \*\*Estado:\*\*.*$/m, status);
  if (updated === block) return null;
  await atomicWriteText(abs, `${text.slice(0, at)}${updated}${end < 0 ? "" : text.slice(at + end)}`, { fs, mode: 0o644 });
  if (!tracked) return { rel, commit: null };
  const exec = deps.exec ?? defaultExec;
  let add = await exec("git", ["add", "-u", "--", rel], { cwd: integrationRoot });
  if (add.code !== 0) add = await exec("git", ["add", "-f", "--", rel], { cwd: integrationRoot });
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${String(add.stderr).trim().slice(0, 200)}`);
  const commit = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", `chore(build): owner answered ${id}\n\nDoubt: ${id}\n`, "--", rel], { cwd: integrationRoot });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${String(commit.stderr || commit.stdout).trim().slice(0, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: integrationRoot });
  return { rel, commit: head.stdout.trim() };
}

/** The data of the last `answer_recorded` of one question in the run journal, or null. */
export async function lastAnswer(journalFile, question, deps) {
  const { events } = await readJournal(journalFile, deps);
  const hit = events.filter((e) => e.type === "answer_recorded" && e.data?.question === question).pop();
  return hit ? { value: hit.data.value, units: hit.data.units ?? [] } : null;
}

/**
 * Read-only check that an assume branch is merged into the integration branch (`git merge-base --is-ancestor`).
 * This module never merges: integrate.mjs does. An unreadable answer counts as merged (the conservative reading:
 * the earlier answer then stands as acted on).
 */
export async function isAncestor(root, branch, target, deps) {
  if (deps.isAncestor) return deps.isAncestor({ root, branch, target });
  const res = await (deps.exec ?? defaultExec)("git", ["merge-base", "--is-ancestor", `refs/heads/${branch}`, `refs/heads/${target}`], { cwd: root });
  return res.code !== 1;
}
