/**
 * lib/achievements/report/scalars.ts — IF-10-scalars (`reportScalars`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only. Honesty (DR-078): tests-passing has no
 * cheap real source today, so it ships as an explicit `null` → the UI renders "no cableado",
 * NEVER a fabricated number. Every other scalar maps to a verifiable real source:
 *   - FRDs       → docs/frds/ folder count (reuse lib/docs `readProjectDocs`)
 *   - Commits    → `git rev-list --count HEAD` (git at read time)
 *   - Decisions  → `factory/decisions/registry.yaml` entries (reuse lib/registry `readDecisionRules`)
 *   - Projects   → portfolio entries (reuse lib/portfolio `readPortfolio`)
 *
 * Traceability: AC-10-014.3.
 */

import { execSync } from "node:child_process";
import { cache } from "react";
import { readProjectDocs } from "../../docs/docs";
import { readPortfolio } from "../../portfolio/portfolio";
import { readDecisionRules } from "../../registry/registry";
import type { ReportScalars } from "./types";

/** The raw source counts injected into the pure derivation (separated so it is testable). */
export type ScalarSources = {
  readonly frds: number;
  readonly commits: number;
  readonly decisions: number;
  readonly projects: number;
  /** Real tests-passing count, or null when no source is wired (renders "no cableado"). */
  readonly testsPassing: number | null;
};

/**
 * Pure derivation of the report scalars — a passthrough of the wired source counts.
 * Kept pure so the honesty contract (real 0 vs `null` tests-passing) is unit-tested without I/O.
 */
export function deriveScalars(sources: ScalarSources): ReportScalars {
  return {
    frds: sources.frds,
    commits: sources.commits,
    decisions: sources.decisions,
    projects: sources.projects,
    testsPassing: sources.testsPassing,
  };
}

/** `git rev-list --count HEAD` for a repo, or 0 when git is unavailable (fail-soft). */
function gitCommitCount(repoRoot: string): number {
  try {
    const out = execSync("git rev-list --count HEAD", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const n = Number.parseInt(out.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Read the report scalars from their real sources (wired), with tests-passing left as an
 * explicit `null` ("no cableado") until an emitter exists (docs/achievements.md §8 pending).
 *
 * @param projectPath - Absolute path to the project whose FRDs + git commits are counted.
 * @returns A `ReportScalars` — every count from a verifiable source; testsPassing is null.
 */
function readReportScalars(projectPath: string): ReportScalars {
  const frds = readProjectDocs(projectPath).frds.length;
  const commits = gitCommitCount(projectPath);
  const decisions = readDecisionRules().length;
  const projects = readPortfolio().length;
  return deriveScalars({ frds, commits, decisions, projects, testsPassing: null });
}

/**
 * Per-request-cached `readReportScalars` (React `cache`, DR-092) so the pulse band does not
 * re-run `git rev-list --count` per render. Keyed on `projectPath`.
 */
export const reportScalars: (projectPath: string) => ReportScalars = cache(readReportScalars);
