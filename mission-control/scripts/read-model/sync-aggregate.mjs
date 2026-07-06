/**
 * scripts/read-model/sync-aggregate.mjs — the aggregate-index join CLI (FRD-23, WO-23-004, REQ-23-003).
 *
 * Invoked by the `/pandacorp:sync-portfolio` skill (Part 2 of its portfolio walk): it reads every
 * project's materialized portada (`.pandacorp/stats.json`) and JOINS them into one aggregate index
 * (`<factory-root>/.pandacorp/stats-aggregate.json`) that Mission Control reads in O(1) — the
 * Informe's cost stops scaling with the number of projects (AC-23-003.1).
 *
 * Run from the Mission Control repo root:
 *   node --loader ./scripts/read-model/ts-loader.mjs scripts/read-model/sync-aggregate.mjs
 *
 * Read-only over each project (it only reads their portadas); the single write is the atomic
 * aggregate file. A missing/corrupt portada is reported and SKIPPED (fail-loud, DR-078) — never a
 * silent empty; MC's per-project seal validation + live-git fallback covers a skipped project.
 */

import path from "node:path";
import {
  STATS_AGGREGATE_FILENAME,
  syncStatsAggregate,
} from "../../src/lib/achievements/read-model/aggregate.ts";
import { resolveFactoryRoot, resolveProjectPath } from "../../src/lib/config/config.ts";
import { readPortfolio } from "../../src/lib/portfolio/portfolio.ts";

function main() {
  const entries = readPortfolio();
  const projects = entries.map((entry) => ({
    projectKey: entry.path,
    projectPath: resolveProjectPath(entry.path),
  }));

  const aggregatePath = path.join(resolveFactoryRoot(), ".pandacorp", STATS_AGGREGATE_FILENAME);

  const summary = syncStatsAggregate(projects, aggregatePath);

  process.stdout.write(
    `sync-aggregate: joined ${summary.joined}/${projects.length} portadas → ${aggregatePath}\n`,
  );
  for (const skip of summary.skipped) {
    process.stdout.write(`  skipped ${skip.projectKey} (${skip.reason})\n`);
  }
}

main();
