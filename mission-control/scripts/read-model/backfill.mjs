/**
 * scripts/read-model/backfill.mjs — the one-shot portada backfill CLI (FRD-23, WO-23-004, REQ-23-004).
 *
 * A one-shot command that walks git ONCE per existing project and generates its initial portada +
 * seal (AC-23-004.1), so projects built before the read-model shipped get a materialized
 * `.pandacorp/stats.json` without waiting for their next commit to trigger `regen`.
 *
 * Run from the Mission Control repo root:
 *   node --loader ./scripts/read-model/ts-loader.mjs scripts/read-model/backfill.mjs [<projectPath>…]
 *
 * With no args it backfills every project in the portfolio; with explicit paths it backfills just
 * those. A project whose portada cannot be derived from git is reported and SKIPPED (fail-loud,
 * DR-078) — never fatal to the whole run; the reader's live-git fallback covers a skipped project.
 */

import path from "node:path";
import { runBackfill } from "../../src/lib/achievements/read-model/backfill.ts";
import { resolveProjectPath } from "../../src/lib/config/config.ts";
import { readPortfolio } from "../../src/lib/portfolio/portfolio.ts";

function targetProjectPaths() {
  // Explicit path args are resolved against the caller's cwd (a plain filesystem path);
  // the portfolio walk resolves each row's path cell against the factory root (config semantics).
  const explicit = process.argv.slice(2);
  if (explicit.length > 0) {
    return explicit.map((p) => path.resolve(p));
  }
  return readPortfolio().map((entry) => resolveProjectPath(entry.path));
}

function main() {
  const projectPaths = targetProjectPaths();
  const summary = runBackfill(projectPaths);

  process.stdout.write(
    `backfill: wrote ${summary.written.length}/${projectPaths.length} portadas\n`,
  );
  for (const written of summary.written) {
    process.stdout.write(`  wrote ${written}\n`);
  }
  for (const skip of summary.skipped) {
    process.stdout.write(`  skipped ${skip.projectPath} (${skip.reason})\n`);
  }
}

main();
