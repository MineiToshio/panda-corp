/**
 * WO-16-001 — `lib/orphans` scan: projects path + bounded folder listing.
 *
 * Implements `IF-16-scan` (blueprint §3 / FRD-16):
 *   - resolveProjectsPath: derive the projects folder from the profile or factory parent.
 *   - listProjectFolders: bounded immediate-children scan (git repos only, exclusions applied).
 *
 * Traceability:
 *   REQ-16-005 (read-only invariant) → listProjectFolders uses fs.existsSync only (no git subprocess, no write).
 *   REQ-16-006 (bounded scan) → only fs.readdirSync at depth 1 of the projects folder.
 *
 * Regression anchors (from orphans.test.ts header):
 *   B1' (2026-06-16): numeric projects_path from YAML must not be used — string-only guard.
 *   I2  (2026-06-16): empty projects folder → [] without throwing.
 *   I3  (2026-06-16): file entries (not dirs) at top level must be skipped.
 *   WO-13-001 (2026-06-16): whitespace-only path treated as absent.
 */

import fs from "node:fs";
import path from "node:path";
import { readPortfolio } from "../portfolio/portfolio";
import { readProfile } from "../profile/profile";

// ---------------------------------------------------------------------------
// Exclusion constants (blueprint §5)
// ---------------------------------------------------------------------------

/**
 * Directory name of the Mission Control app — always excluded from the orphan
 * scan even when it is an immediate child of the projects folder.
 * This is the canonical constant; UI/test code must use this value (or the
 * MISSION_CONTROL_DIR export from this module) rather than an inline string.
 */
const MISSION_CONTROL_DIR_NAME = "mission-control";

// ---------------------------------------------------------------------------
// resolveProjectsPath
// ---------------------------------------------------------------------------

/**
 * Resolve the owner's projects folder from the factory root.
 *
 * Algorithm (FRD-16 / architecture §4.2):
 *   1. Read `factory/profile.md` from `factoryRoot`.
 *   2. If `profile.projectsPath` is a non-empty, non-whitespace string → return it verbatim.
 *   3. Otherwise → return `path.dirname(factoryRoot)` (the parent directory).
 *
 * Never throws (fail-soft): any fs/parse error falls back to step 3.
 *
 * @param factoryRoot - Absolute path to the factory repo root (the folder that
 *   contains `mission-control/`). The profile is read from
 *   `<factoryRoot>/factory/profile.md`.
 * @returns Absolute path string. Never empty. Never throws.
 */
export function resolveProjectsPath(factoryRoot: string): string {
  const parentDir = path.dirname(factoryRoot);

  try {
    const profilePath = path.join(factoryRoot, "factory", "profile.md");
    const result = readProfile(profilePath);

    if (result.present) {
      const projectsPath = result.profile.projectsPath;

      // Guard: must be a non-empty, non-whitespace string (regression B1': numeric values
      // in YAML parse as numbers, which do not pass the `typeof === "string"` check that
      // readProfile already applies — projectsPath is already typed as string | undefined).
      // Guard: whitespace-only is treated as absent (regression WO-13-001).
      if (typeof projectsPath === "string" && projectsPath.trim() !== "") {
        return projectsPath;
      }
    }
  } catch {
    // Any unexpected error → fall back to parent dir.
  }

  return parentDir;
}

// ---------------------------------------------------------------------------
// listProjectFolders
// ---------------------------------------------------------------------------

/**
 * List immediate git-repo children of `projectsPath`, with exclusions applied.
 *
 * A child is included when ALL of the following hold:
 *   1. It is a directory (not a regular file — regression I3).
 *   2. It contains a `.git` entry (directory or file; git worktrees use a `.git` file).
 *   3. Its absolute path is NOT the factory root (`factoryRoot`).
 *   4. Its name is NOT `"mission-control"` (the built-in dashboard, blueprint §5).
 *
 * The scan is bounded to depth 1 — only `fs.readdirSync` on `projectsPath` is called
 * (REQ-16-006). No recursive walk; no `git` subprocess; no writes (REQ-16-005).
 *
 * @param projectsPath - Absolute path to the projects folder to scan.
 *   Empty or whitespace-only → returns [] without throwing (regression WO-13-001 / AC-16-001.6).
 * @param factoryRoot  - Optional absolute path to the factory repo root. When provided,
 *   any child whose absolute path equals `factoryRoot` is excluded (AC-16-001.5).
 *   When omitted, only the `mission-control/` name exclusion applies.
 * @returns Array of absolute paths to immediate git-repo children. Never throws.
 */
export function listProjectFolders(projectsPath: string, factoryRoot?: string): string[] {
  // Guard: empty / whitespace-only path (regression WO-13-001, AC-16-001.6).
  if (typeof projectsPath !== "string" || projectsPath.trim() === "") {
    return [];
  }

  // Guard: projectsPath must be a directory that exists (AC-16-001.6, regression I3).
  try {
    const stat = fs.statSync(projectsPath);
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    // Path does not exist or is unreadable → empty result (AC-16-001.6).
    return [];
  }

  // Normalize the factory root path for comparison (if provided).
  const resolvedFactory = factoryRoot ? path.resolve(factoryRoot) : null;

  let entries: string[];
  try {
    entries = fs.readdirSync(projectsPath);
  } catch {
    // Unreadable directory → empty result without throwing.
    return [];
  }

  const result: string[] = [];

  for (const name of entries) {
    const childPath = path.join(projectsPath, name);
    if (isIncludedProjectFolder(name, childPath, resolvedFactory)) {
      result.push(childPath);
    }
  }

  return result;
}

/**
 * Decide whether a top-level entry qualifies as an included project folder:
 * not the factory root, not `mission-control/`, an existing directory, and a git repo.
 *
 * @param name           Entry basename (for the name-based exclusions).
 * @param childPath      Absolute path to the entry.
 * @param resolvedFactory Resolved factory root to exclude, or null when not provided.
 */
function isIncludedProjectFolder(
  name: string,
  childPath: string,
  resolvedFactory: string | null,
): boolean {
  // Exclusion 1: skip the factory root (AC-16-001.5).
  if (resolvedFactory !== null && path.resolve(childPath) === resolvedFactory) {
    return false;
  }

  // Exclusion 2: skip the mission-control directory by name (blueprint §5, AC-16-001.5).
  if (name === MISSION_CONTROL_DIR_NAME) {
    return false;
  }

  // Guard: child must be a directory, not a regular file (regression I3: AC-16-001.4).
  let childStat: fs.Stats;
  try {
    childStat = fs.statSync(childPath);
  } catch {
    // Unreadable entry → skip silently.
    return false;
  }

  if (!childStat.isDirectory()) {
    return false;
  }

  // Git-repo check: `.git` must exist as a file or directory inside the child
  // (REQ-16-006 existence check — no git subprocess, no write, blueprint §5 note).
  const gitMarker = path.join(childPath, ".git");
  try {
    fs.accessSync(gitMarker);
    // If accessSync does not throw, the .git entry exists (file or dir).
  } catch {
    // No .git → not a git repo; skip.
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// WO-16-002 — classifyCandidate + getOrphans
// ---------------------------------------------------------------------------

/**
 * The kind of nudge to show for a candidate:
 *   "orphan"   → no marker, not in portfolio → suggest /pandacorp:adopt
 *   "unlisted" → has marker, not in portfolio → suggest /pandacorp:sync-portfolio
 */
type OrphanKind = "orphan" | "unlisted";

/**
 * A folder that needs a factory nudge (either adopt or sync-portfolio).
 *
 * Traceability: AC-16-002.5 (shape contract).
 */
export type Candidate = {
  /** Folder name (basename of `path`). */
  name: string;
  /** Absolute path to the folder. */
  path: string;
  /** Kind of nudge required. */
  kind: OrphanKind;
  /** Whether `.pandacorp/status.yaml` exists inside the folder. */
  hasMarker: boolean;
  /** Whether the folder's path appears in the factory portfolio. */
  inPortfolio: boolean;
};

/**
 * Pandacorp marker: presence of `.pandacorp/status.yaml` inside a folder means
 * it is already a factory project.
 *
 * Traceability: FRD-16 "Pandacorp marker" definition.
 */
const PANDACORP_MARKER_SUBPATH = path.join(".pandacorp", "status.yaml");

/**
 * Normalize a filesystem path for comparison: resolve `.`/`..` segments and
 * strip any trailing separator so that `/a/b/` and `/a/b` compare equal.
 *
 * Traceability: AC-16-002.6 (path normalization).
 */
function normalizePath(p: string): string {
  // path.resolve handles `.`/`..`; then strip trailing sep.
  return path.resolve(p).replace(/[/\\]+$/, "");
}

/**
 * Classify a single candidate folder against the known registered paths.
 *
 * Truth table (blueprint §3, FRD-16):
 *
 * | hasMarker | inPortfolio | result               |
 * |-----------|-------------|----------------------|
 * | false     | false       | `kind: "orphan"`     |
 * | true      | false       | `kind: "unlisted"`   |
 * | true      | true        | `null` (no nudge)    |
 * | false     | true        | `null` (already known; do not nag — AC-16-002.4) |
 *
 * @param candidatePath    Absolute path to the candidate folder.
 * @param registeredPaths  Paths from the portfolio (may contain trailing slashes or
 *                         redundant segments; normalized before comparison — AC-16-002.6).
 * @returns `Candidate` when a nudge is needed, or `null` when the project is
 *          already fully known to the factory. Never throws (AC-16-002.7).
 */
export function classifyCandidate(
  candidatePath: string,
  registeredPaths: string[],
): Candidate | null {
  const normalizedCandidate = normalizePath(candidatePath);

  // Build a normalized set of registered paths; skip blank entries (broken rows).
  const normalizedRegistered = new Set<string>();
  for (const p of registeredPaths) {
    if (typeof p === "string" && p.trim() !== "") {
      normalizedRegistered.add(normalizePath(p));
    }
  }

  const inPortfolio = normalizedRegistered.has(normalizedCandidate);

  // Check for the Pandacorp marker (.pandacorp/status.yaml).
  const markerPath = path.join(candidatePath, PANDACORP_MARKER_SUBPATH);
  let hasMarker = false;
  try {
    fs.accessSync(markerPath);
    hasMarker = true;
  } catch {
    hasMarker = false;
  }

  // Apply the truth table.
  if (inPortfolio) {
    // Both "listed with marker" and "listed without marker" → no nudge (AC-16-002.3, AC-16-002.4).
    return null;
  }

  // Not in portfolio: kind depends on whether the marker is present.
  const kind: OrphanKind = hasMarker ? "unlisted" : "orphan";

  return {
    name: path.basename(candidatePath),
    path: candidatePath,
    kind,
    hasMarker,
    inPortfolio,
  };
}

/**
 * Compose `resolveProjectsPath` + `listProjectFolders` + `classifyCandidate`
 * to return all folders in the projects directory that need a factory nudge.
 *
 * Reads the registered portfolio paths from `<factoryRoot>/factory/portfolio.md`
 * via `lib/portfolio.ts` (FRD-01, already shipped).
 *
 * Defensive (AC-16-002.7): if the portfolio is absent or broken, classifies
 * candidates against an empty/partial registered set. Never throws.
 *
 * @param factoryRoot  Absolute path to the factory repo root (contains `factory/`
 *                     and `mission-control/`). Defaults to `resolveProjectsPath`'s
 *                     own fallback when omitted.
 * @returns Array of `Candidate`s that need adopt or sync-portfolio nudges.
 */
export function getOrphans(factoryRoot: string): Candidate[] {
  try {
    // 1. Resolve the projects folder.
    const projectsPath = resolveProjectsPath(factoryRoot);

    // 2. Read registered paths from the portfolio (fail-soft: returns [] on any error).
    const portfolioPath = path.join(factoryRoot, "factory", "portfolio.md");
    const portfolioEntries = readPortfolio(portfolioPath);
    const registeredPaths = portfolioEntries.map((e) => e.path);

    // 3. List bounded candidate folders (git repos, exclusions applied).
    const candidateFolders = listProjectFolders(projectsPath, factoryRoot);

    // 4. Classify each candidate; keep only those that need a nudge.
    const result: Candidate[] = [];
    for (const folderPath of candidateFolders) {
      const candidate = classifyCandidate(folderPath, registeredPaths);
      if (candidate !== null) {
        result.push(candidate);
      }
    }

    return result;
  } catch {
    // Any unexpected top-level error → empty list (never throws — AC-16-002.7).
    return [];
  }
}
