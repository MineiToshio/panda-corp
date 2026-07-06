/**
 * lib/achievements/read-model/backfill.ts — the one-shot portada backfill (FRD-23, WO-23-004, REQ-23-004).
 *
 * A one-shot command that walks git ONCE per existing project and generates its initial portada +
 * seal, equivalent to what the live reader would produce (AC-23-004.1). It exists so that projects
 * built before the read-model shipped get a materialized `.pandacorp/stats.json` without waiting for
 * their next commit to trigger the universal write point (`regenerateForCommit`).
 *
 * Platform golden rule (architecture §1): factory tooling — invoked by the CLI in `scripts/`, NOT
 * the MC render path. It delegates every derivation to the single writer (`writeStatsPortada`,
 * WO-23-002, DR-115) — it NEVER re-implements a number.
 *
 * Fail-loud, but resilient across projects (DR-078 + resilience): a project whose portada could not
 * be derived from git (a `PortadaDeriveError` — git unavailable / a non-`ok` source) is SKIPPED with
 * its reason and reported, never fatal to the whole backfill (the reader's live-git fallback covers
 * a skipped project). A genuinely UNEXPECTED error (permissions, disk) is re-thrown, never swallowed.
 */

import { PortadaDeriveError, writeStatsPortada } from "./statsWriter";

/** A project the backfill could not materialize, with the derive reason (never silently dropped). */
type BackfillSkip = {
  readonly projectPath: string;
  /** The `PortadaDeriveError` message (git unavailable / a non-`ok` source). */
  readonly reason: string;
};

/** The outcome of a backfill run — which portadas were written vs. explicitly skipped. */
export type BackfillSummary = {
  /** Absolute paths of the portadas written (one per successfully-derived project). */
  readonly written: readonly string[];
  /** Projects skipped (with reason) because their portada could not be derived (fail-loud). */
  readonly skipped: readonly BackfillSkip[];
};

/** Injectable dependencies (the writer is defaulted; overridable so the walk is unit-testable). */
export type BackfillDeps = {
  /** Writes one project's portada, returning its path or throwing `PortadaDeriveError`. */
  readonly writePortada: (projectPath: string) => string;
};

/**
 * Backfill the materialized portada for every given project, once each (AC-23-004.1).
 *
 * Walks the projects in order, calling the single writer once per project. A `PortadaDeriveError`
 * (git unavailable / a non-`ok` source) is caught and reported as a skip — the backfill continues,
 * so one un-derivable project never aborts the whole run. Any OTHER error is genuinely unexpected
 * and re-thrown (never swallowed — error-handling rule). An empty project list is a valid no-op.
 *
 * @param projectPaths - Absolute paths of the projects to backfill.
 * @param deps         - Injectable writer (defaults to the single `writeStatsPortada`).
 * @returns A summary of the portadas written and the projects explicitly skipped.
 */
export function runBackfill(
  projectPaths: readonly string[],
  deps: BackfillDeps = { writePortada: (projectPath) => writeStatsPortada(projectPath) },
): BackfillSummary {
  const written: string[] = [];
  const skipped: BackfillSkip[] = [];

  for (const projectPath of projectPaths) {
    try {
      written.push(deps.writePortada(projectPath));
    } catch (error) {
      if (error instanceof PortadaDeriveError) {
        skipped.push({ projectPath, reason: error.message });
        continue;
      }
      // Genuinely unexpected (permissions, disk) — surface it, never swallow it.
      throw error;
    }
  }

  return { written, skipped };
}
