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

/** A chronological phase observation (oldest first) for one project. */
export type PhaseObservation = {
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
 * The path of `repoRoot/relPath` RELATIVE TO THE GIT REPO ROOT.
 *
 * `git show <sha>:<path>` resolves `<path>` against the repo root, not cwd. When a project
 * shares a parent repo's `.git` (Mission Control lives INSIDE the factory repo — its status.yaml
 * is `mission-control/.pandacorp/status.yaml` in git), the cwd-relative `relPath` would not
 * resolve. `git rev-parse --show-prefix` gives the cwd's offset from the repo root; we prepend it.
 * Empty string when git is unavailable.
 */
function gitRootRelPath(repoRoot: string, relPath: string): string {
  let prefix = "";
  try {
    prefix = execSync("git rev-parse --show-prefix", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return relPath;
  }
  return prefix === "" ? relPath : `${prefix}${relPath}`;
}

/**
 * Read the chronological phase observations for one project from the git history of its
 * `.pandacorp/status.yaml`: walk the commits (oldest→newest, `-n`-capped, scoped pathspec),
 * read the `phase:` line at each, and keep one observation per commit. Empty / git-unavailable → [].
 */
function observationsForStatusFile(repoRoot: string, relPath: string): PhaseObservation[] {
  const rootRelPath = gitRootRelPath(repoRoot, relPath);
  let shas = "";
  try {
    shas = execSync(`git log -n ${GIT_LOG_CAP} --reverse --format=%H%x09%cI -- "${relPath}"`, {
      cwd: repoRoot,
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }

  const observations: PhaseObservation[] = [];
  for (const line of shas.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const sha = line.slice(0, tab);
    const iso = line.slice(tab + 1);
    const date = iso.slice(0, 10);
    let blob = "";
    try {
      blob = execSync(`git show "${sha}:${rootRelPath}"`, {
        cwd: repoRoot,
        encoding: "utf-8",
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
    }
    const phase = extractPhase(blob);
    if (phase !== null) observations.push({ date, phase });
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
