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
import { readProfile } from "./profile";

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

    // Exclusion 1: skip the factory root (AC-16-001.5).
    if (resolvedFactory !== null && path.resolve(childPath) === resolvedFactory) {
      continue;
    }

    // Exclusion 2: skip the mission-control directory by name (blueprint §5, AC-16-001.5).
    if (name === MISSION_CONTROL_DIR_NAME) {
      continue;
    }

    // Guard: child must be a directory, not a regular file (regression I3: AC-16-001.4).
    let childStat: fs.Stats;
    try {
      childStat = fs.statSync(childPath);
    } catch {
      // Unreadable entry → skip silently.
      continue;
    }

    if (!childStat.isDirectory()) {
      continue;
    }

    // Git-repo check: `.git` must exist as a file or directory inside the child
    // (REQ-16-006 existence check — no git subprocess, no write, blueprint §5 note).
    const gitMarker = path.join(childPath, ".git");
    try {
      fs.accessSync(gitMarker);
      // If accessSync does not throw, the .git entry exists (file or dir).
    } catch {
      // No .git → not a git repo; skip.
      continue;
    }

    result.push(childPath);
  }

  return result;
}
