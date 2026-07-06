/**
 * lib/achievements/report/phaseTransitions.ts — IF-10-phase-transitions, WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only. Fail-loud (DR-078).
 *
 * Per-project `phase` transition log from the git history of each `.pandacorp/status.yaml`.
 * Each entry is `{ project, date, from, to, isReopen }` where `isReopen` is true when `to`
 * precedes `from` in the pipeline order. Git access via `execSync` (build-track.ts pattern),
 * scoped to the status.yaml pathspec and `-n`-capped.
 *
 * Traceability: AC-10-014.2 / .7.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { resolveFactoryRoot } from "../../config/config";
import { readPortfolio } from "../../portfolio/portfolio";
import type { Phase, PhaseTransition, ReportResult } from "./types";

/** Cap on the git-log scan per status.yaml (perf caveat, blueprint §3). */
const GIT_LOG_CAP = 400;

/** Pipeline phase order — earlier = lower rank; a backward move (to < from) is a reopen. */
const PHASE_RANK: Readonly<Record<Phase, number>> = {
  product: 0,
  design: 1,
  architecture: 2,
  implementation: 3,
  release: 4,
};

/** A chronological phase observation (oldest first) for one project.
 *  Module-private: only `PhaseHistory` composes it (consumers pass a `PhaseHistory`). */
type PhaseObservation = {
  /** ISO date (YYYY-MM-DD) of the commit. */
  readonly date: string;
  /** The `phase:` value at that commit (validated against the pipeline vocabulary). */
  readonly phase: string;
};

/** A per-project chronological phase history. `null` → git unavailable. */
export type PhaseHistory = Readonly<Record<string, readonly PhaseObservation[]>> | null;

/** True when `value` is one of the five pipeline phases. */
function isPhase(value: string): value is Phase {
  return (
    value === "product" ||
    value === "design" ||
    value === "architecture" ||
    value === "implementation" ||
    value === "release"
  );
}

/** Derive the transitions for one project, or null on an unrecognised phase (fail loud). */
function transitionsForProject(
  project: string,
  observations: readonly PhaseObservation[],
): PhaseTransition[] | null {
  const out: PhaseTransition[] = [];
  let prev: Phase | null = null;
  for (const obs of observations) {
    if (!isPhase(obs.phase)) return null; // unparseable — never silently dropped
    const cur = obs.phase;
    if (prev !== null && cur !== prev) {
      out.push({
        project,
        date: obs.date,
        from: prev,
        to: cur,
        isReopen: PHASE_RANK[cur] < PHASE_RANK[prev],
      });
    }
    prev = cur;
  }
  return out;
}

/**
 * Pure derivation of every project's phase transitions (IF-10-phase-transitions core).
 *
 * - `history === null` → `{ ok: false, reason: "git-unavailable" }`.
 * - any unrecognised phase value → `{ ok: false, reason: "unparseable" }` (fail loud).
 * - otherwise the transitions (an empty history is a legitimate `{ ok: true, value: [] }`).
 */
export function derivePhaseTransitions(history: PhaseHistory): ReportResult<PhaseTransition[]> {
  if (history === null) return { ok: false, reason: "git-unavailable" };

  const all: PhaseTransition[] = [];
  for (const project of Object.keys(history).sort()) {
    const projectTransitions = transitionsForProject(project, history[project] ?? []);
    if (projectTransitions === null) return { ok: false, reason: "unparseable" };
    all.push(...projectTransitions);
  }
  return { ok: true, value: all };
}

// ---------------------------------------------------------------------------
// Impure shell — gather the phase history from each status.yaml's git log
// ---------------------------------------------------------------------------

/** Extract the `phase:` value from a status.yaml blob (first match), or null. */
function extractPhase(blob: string): string | null {
  const m = /^\s*phase:\s*["']?([a-zA-Z]+)["']?\s*$/m.exec(blob);
  return m?.[1] ?? null;
}

/**
 * Read the chronological phase observations for one project from the git history of its
 * `.pandacorp/status.yaml`, in a SINGLE `git log -p` pass (oldest→newest, `-n`-capped, scoped
 * pathspec). Each commit is prefixed by a NUL-marked ISO-date line (`--format=%x00%cI`); the
 * `+phase:` lines in the unified diff are exactly the phase CHANGE points (a commit that did not
 * touch the phase line contributes none). Since the downstream `transitionsForProject` only
 * consumes change points, these observations are equivalent to reading the phase at every commit —
 * at the cost of ONE subprocess instead of one `git show` per commit (the /achievements render was
 * spawning up to `GIT_LOG_CAP` processes per project; DR-092 perf, LESSON on subprocess fan-out).
 * Empty / git-unavailable → []. An unrecognised phase value is still surfaced (fail loud downstream).
 */
function observationsForStatusFile(repoRoot: string, relPath: string): PhaseObservation[] {
  let log = "";
  try {
    log = execSync(`git log -n ${GIT_LOG_CAP} --reverse --format=%x00%cI -p -- "${relPath}"`, {
      cwd: repoRoot,
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }

  const observations: PhaseObservation[] = [];
  let currentDate = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("\0")) {
      currentDate = line.slice(1, 11); // YYYY-MM-DD from the NUL-marked ISO commit date
      continue;
    }
    if (!line.startsWith("+")) continue; // only ADDED diff lines are phase change points
    const phase = extractPhase(line.slice(1)); // strip the leading '+' before matching
    if (phase !== null && currentDate !== "") observations.push({ date: currentDate, phase });
  }
  return observations;
}

/** True when git is usable in `repoRoot`. */
function gitAvailable(repoRoot: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/** Status.yaml path relative to a project repo root. */
function statusRelPath(): string {
  return path.join(".pandacorp", "status.yaml");
}

/**
 * Read the phase-transition log across the portfolio (git-backed, fail-loud).
 *
 * Each portfolio project's `.pandacorp/status.yaml` git history is read for its `phase:`
 * line over time. Projects whose repo or git is unavailable contribute nothing; if NO
 * project's git is reachable the result is an explicit absent (`git-unavailable`).
 *
 * @returns A `ReportResult<PhaseTransition[]>`.
 */
function readPhaseTransitions(): ReportResult<PhaseTransition[]> {
  const entries = readPortfolio();
  const factoryRoot = resolveFactoryRoot();
  const history: Record<string, PhaseObservation[]> = {};
  let anyGit = false;

  for (const entry of entries) {
    const rawPath = entry.path;
    if (!rawPath || rawPath.trim() === "" || rawPath === "—" || rawPath === "-") continue;
    const repoRoot = path.isAbsolute(rawPath) ? rawPath : path.join(factoryRoot, rawPath);
    if (!fs.existsSync(path.join(repoRoot, statusRelPath()))) continue;
    if (!gitAvailable(repoRoot)) continue;
    anyGit = true;
    history[entry.name] = observationsForStatusFile(repoRoot, statusRelPath());
  }

  if (!anyGit) return { ok: false, reason: "git-unavailable" };
  return derivePhaseTransitions(history);
}

/**
 * Per-request-cached `readPhaseTransitions` (React `cache`, DR-092) so a tab render does not
 * re-run git per status.yaml across rows.
 */
export const phaseTransitions: () => ReportResult<PhaseTransition[]> = cache(readPhaseTransitions);
