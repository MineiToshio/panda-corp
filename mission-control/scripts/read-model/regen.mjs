/**
 * scripts/read-model/regen.mjs — the universal regeneration CLI (FRD-23, WO-23-004).
 *
 * The universal write point (FRD-23 §4): every change that affects the Informe ends in a COMMIT, so
 * the commit is the correct trigger. The Claude Code Stop hook and/or a git `post-commit` hook call
 * this CLI for the committed project — it regenerates that project's portada. This covers every
 * path a single skill's close could not: direct hand edits, ideas/decisions/phase moves,
 * single-FRD builds, "nobody regenerated yet".
 *
 * Run from the committed project's repo root (a `post-commit` hook's cwd IS the repo root):
 *   node --loader <mc>/scripts/read-model/ts-loader.mjs <mc>/scripts/read-model/regen.mjs [<projectPath>]
 *
 * Degrades honestly (resilience + DR-078): a portada that cannot be derived from git does NOT abort
 * the commit — it prints a degrade note and exits 0 (the reader's live-git fallback covers the gap).
 * A genuinely unexpected error propagates (non-zero exit) so it is never silently swallowed.
 */

import path from "node:path";
import { regenerateForCommit } from "../../src/lib/achievements/read-model/regen.ts";

function targetProjectPath() {
  const explicit = process.argv[2];
  return explicit ? path.resolve(explicit) : process.cwd();
}

function main() {
  const projectPath = targetProjectPath();
  const outcome = regenerateForCommit(projectPath);

  if (outcome.ok) {
    process.stdout.write(`regen: wrote ${outcome.written}\n`);
  } else {
    // Honest degrade — the commit is never aborted; MC falls back to live git for this project.
    process.stdout.write(
      `regen: skipped ${projectPath} (${outcome.reason}) — live-git fallback covers it\n`,
    );
  }
}

main();
