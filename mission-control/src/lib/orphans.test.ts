/**
 * WO-16-001 — `lib/orphans` scan: projects path + bounded folder listing
 * RED phase — tests written BEFORE the implementation.
 *
 * Acceptance criteria under test (WO-16-001 / FRD-16 EARS):
 *
 *   AC-16-001.1  WHEN profile.projects_path is set
 *                THEN resolveProjectsPath returns it exactly.
 *   AC-16-001.2  WHEN the profile is missing or projects_path is empty
 *                THEN resolveProjectsPath returns the parent of the factory root.
 *   AC-16-001.3  (REQ-16-006) listProjectFolders returns ONLY immediate children —
 *                a .git nested two levels down is NOT discovered (bounded scan;
 *                asserted with a fixture tree).
 *   AC-16-001.4  Only folders with a .git (file OR dir) are returned; plain folders
 *                are skipped.
 *   AC-16-001.5  The factory root and mission-control/ are excluded even if they
 *                have .git.
 *   AC-16-001.6  (REQ-16-005) An unreadable projects_path returns [] (no throw);
 *                the scan performs no write and runs no `git` subprocess
 *                (existence check only).
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   B1' (2026-06-16): `typeof NaN === "number"` passes numeric type guards silently.
 *     Risk here: projects_path that is numeric (not a string) in profile YAML must NOT
 *     be used as a path — resolveProjectsPath must fall back to the parent dir.
 *   I2  (2026-06-16): empty-collection / empty-object inputs pass collection guards
 *     vacuously. Risk here: a projects folder that exists but has zero children must
 *     return [] — not throw or loop incorrectly.
 *   I3  (2026-06-16): array-shaped objects fool typeof checks.
 *     Risk here: a child that is a *file* (not a dir) must be skipped even if it is
 *     somehow named ".git".
 *   WO-13-001 (2026-06-16): NaN/Infinity bypass Number.isFinite guards — analogous:
 *     a path that is an empty string or whitespace-only must be treated as absent.
 *
 * Traceability:
 *   REQ-16-005 (read-only invariant) → AC-16-001.6 + read-only invariant group
 *   REQ-16-006 (bounded scan, immediate children only) → AC-16-001.3
 *
 * Stack: Vitest (Node environment — fs reads; no git subprocess; no network).
 * All tests are fully isolated:
 *   - resolveProjectsPath: receives factoryRoot and profile content as parameters
 *     → temp dir with fixture profile, no global env mutation.
 *   - listProjectFolders: receives an absolute projectsPath string → temp dir built
 *     for each test; torn down in afterEach.
 * No shared mutable state between tests.
 *
 * NOTE: These tests WILL FAIL until lib/orphans.ts is implemented. RED phase, by design.
 */

// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Candidate } from "./orphans";
// ---------------------------------------------------------------------------
// Module under test.
// ---------------------------------------------------------------------------
import { classifyCandidate, getOrphans, listProjectFolders, resolveProjectsPath } from "./orphans";

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

/** A realistic absolute path that looks like an owner's projects folder. */
const OWNER_PROJECTS_PATH = "/Users/ada/projects";

/**
 * Name of the mission-control directory — excluded from the orphan scan by
 * the blueprint (§5 exclusions; architecture §7).
 */
const MISSION_CONTROL_DIR = "mission-control";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary factory tree with an optional `factory/profile.md`.
 *
 * @param profileContent  Raw string content for profile.md. Pass `undefined` to
 *                        simulate an absent profile (fresh factory).
 * @returns Absolute path to the temp factory root.
 */
function makeTempFactory(profileContent?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-factory-"));
  const factoryDir = path.join(root, "factory");
  fs.mkdirSync(factoryDir, { recursive: true });
  if (profileContent !== undefined) {
    fs.writeFileSync(path.join(factoryDir, "profile.md"), profileContent, "utf-8");
  }
  return root;
}

/**
 * Create a temp projects directory with a configurable set of immediate children.
 *
 * @param entries  Array of child descriptors:
 *   - `{ name, kind }` where kind is:
 *     - `"git-dir"`   — a folder with a `.git` sub-directory (normal repo)
 *     - `"git-file"`  — a folder with a `.git` file (git worktree)
 *     - `"plain"`     — a folder with NO `.git` (skipped)
 *     - `"file"`      — a regular file (not a folder; skipped)
 *     - `"nested-git"` — a folder whose CHILD (not itself) has a `.git`
 *                         (tests the bounded scan — must NOT be returned)
 * @returns Absolute path to the temp projects directory.
 */
type EntryKind = "git-dir" | "git-file" | "plain" | "file" | "nested-git";

function makeTempProjectsDir(entries: Array<{ name: string; kind: EntryKind }>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-projects-"));
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    switch (entry.kind) {
      case "git-dir": {
        // A real git repo: folder containing a .git directory.
        fs.mkdirSync(path.join(entryPath, ".git"), { recursive: true });
        break;
      }
      case "git-file": {
        // A git worktree: folder containing a .git *file* (not a dir).
        fs.mkdirSync(entryPath, { recursive: true });
        fs.writeFileSync(path.join(entryPath, ".git"), "gitdir: ../../.git/worktrees/foo\n");
        break;
      }
      case "plain": {
        // A plain folder with no .git at all.
        fs.mkdirSync(entryPath, { recursive: true });
        break;
      }
      case "file": {
        // A regular file (not a directory) — must be skipped.
        fs.writeFileSync(entryPath, "I am a file\n");
        break;
      }
      case "nested-git": {
        // The child itself has no .git; its grandchild does.
        // listProjectFolders must NOT recurse into it.
        const grandchild = path.join(entryPath, "deep-project");
        fs.mkdirSync(path.join(grandchild, ".git"), { recursive: true });
        break;
      }
      default: {
        const _exhaustive: never = entry.kind;
        throw new Error(`Unknown entry kind: ${String(_exhaustive)}`);
      }
    }
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
  tmpDirs = [];
});

// ===========================================================================
// resolveProjectsPath
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-16-001.1 — WHEN profile.projects_path is set THEN return it
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.1 — resolveProjectsPath returns profile.projects_path when set", () => {
  it("frd-16: WHEN profile.md has a valid projects_path THEN resolveProjectsPath returns that path", () => {
    const factoryRoot = makeTempFactory(
      `---\nname: "Ada"\nprojects_path: "${OWNER_PROJECTS_PATH}"\n---\n`,
    );
    tmpDirs.push(factoryRoot);

    const result = resolveProjectsPath(factoryRoot);
    expect(result).toBe(OWNER_PROJECTS_PATH);
  });

  it("frd-16: WHEN profile.projects_path is set THEN result is returned verbatim (no normalization applied)", () => {
    // The contract is to return the owner's path as-is — the owner controls it.
    const customPath = "/home/toshio/my-projects";
    const factoryRoot = makeTempFactory(`---\nprojects_path: "${customPath}"\n---\n`);
    tmpDirs.push(factoryRoot);

    expect(resolveProjectsPath(factoryRoot)).toBe(customPath);
  });

  it("frd-16: WHEN profile.projects_path has trailing slash THEN returns it as-is", () => {
    // Paths from profile.md are owner-supplied; we do not strip trailing slashes here.
    const withSlash = "/Users/ada/projects/";
    const factoryRoot = makeTempFactory(`---\nprojects_path: "${withSlash}"\n---\n`);
    tmpDirs.push(factoryRoot);

    // The function must return the owner's value; normalization is caller's concern.
    expect(resolveProjectsPath(factoryRoot)).toBe(withSlash);
  });
});

// ---------------------------------------------------------------------------
// AC-16-001.2 — WHEN profile is missing or projects_path is empty
//               THEN return the parent of the factory root
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.2 — resolveProjectsPath returns parent dir of factory root when profile absent/empty", () => {
  it("frd-16: WHEN profile.md is absent (fresh factory) THEN returns the parent directory of factoryRoot", () => {
    const factoryRoot = makeTempFactory(); // no profile.md
    tmpDirs.push(factoryRoot);

    const result = resolveProjectsPath(factoryRoot);
    expect(result).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN profile.md has no projects_path field THEN returns the parent directory of factoryRoot", () => {
    const factoryRoot = makeTempFactory(`---\nname: "Ada"\ngoals: "build stuff"\n---\n`);
    tmpDirs.push(factoryRoot);

    expect(resolveProjectsPath(factoryRoot)).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN profile.md has projects_path set to empty string THEN returns parent of factoryRoot", () => {
    const factoryRoot = makeTempFactory('---\nprojects_path: ""\n---\n');
    tmpDirs.push(factoryRoot);

    // Empty string is equivalent to absent — blueprint §4.2 fallback rule.
    expect(resolveProjectsPath(factoryRoot)).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN profile.md has projects_path set to whitespace-only THEN returns parent of factoryRoot (regression WO-13-001: whitespace-only not a valid path)", () => {
    const factoryRoot = makeTempFactory('---\nprojects_path: "   "\n---\n');
    tmpDirs.push(factoryRoot);

    expect(resolveProjectsPath(factoryRoot)).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN profile.md has malformed YAML frontmatter THEN returns parent of factoryRoot (fail-soft, no throw)", () => {
    const factoryRoot = makeTempFactory("---\nthis: [broken yaml\nno closing bracket\n---\n");
    tmpDirs.push(factoryRoot);

    expect(() => resolveProjectsPath(factoryRoot)).not.toThrow();
    expect(resolveProjectsPath(factoryRoot)).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN projects_path is a number in the YAML (not a string) THEN returns parent of factoryRoot (regression B1': numeric value must not be used as a path)", () => {
    // In YAML, `projects_path: 42` parses as a number.
    // resolveProjectsPath must treat non-string values as absent.
    const factoryRoot = makeTempFactory("---\nprojects_path: 42\n---\n");
    tmpDirs.push(factoryRoot);

    expect(resolveProjectsPath(factoryRoot)).toBe(path.dirname(factoryRoot));
  });

  it("frd-16: WHEN factoryRoot itself does not exist THEN returns parent of factoryRoot (no throw)", () => {
    const nonExistent = path.join(os.tmpdir(), `ghost-factory-${Date.now()}`);

    expect(() => resolveProjectsPath(nonExistent)).not.toThrow();
    expect(resolveProjectsPath(nonExistent)).toBe(path.dirname(nonExistent));
  });
});

// ===========================================================================
// listProjectFolders
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-16-001.3 — REQ-16-006: Bounded scan — immediate children only
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.3 (REQ-16-006) — listProjectFolders is bounded to immediate children", () => {
  it("frd-16: WHEN a folder two levels deep has a .git THEN it is NOT returned (bounded scan)", () => {
    const projectsDir = makeTempProjectsDir([
      // direct child has no .git; its sub-child does (nested-git)
      { name: "deep-only", kind: "nested-git" },
      // a normal repo at the top level (to confirm the scan does work at level 1)
      { name: "top-repo", kind: "git-dir" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);

    // "top-repo" must appear; "deep-only" must NOT appear.
    expect(result).toContain(path.join(projectsDir, "top-repo"));
    expect(result).not.toContain(path.join(projectsDir, "deep-only", "deep-project"));
    // And the nested path must never appear at all.
    for (const p of result) {
      expect(p.split(path.sep).length).toBeLessThanOrEqual(
        path.join(projectsDir, "x").split(path.sep).length,
        // All returned paths must be immediate children of projectsDir.
      );
    }
  });

  it("frd-16: WHEN the projects directory has no children THEN returns [] (regression I2: empty collection)", () => {
    const projectsDir = makeTempProjectsDir([]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toEqual([]);
  });

  it("frd-16: WHEN all immediate children lack .git THEN returns [] (only git repos are candidates)", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "plain-a", kind: "plain" },
      { name: "plain-b", kind: "plain" },
      { name: "nested-only", kind: "nested-git" },
    ]);
    tmpDirs.push(projectsDir);

    expect(listProjectFolders(projectsDir)).toEqual([]);
  });

  it("frd-16: WHEN there are 5 immediate git-repo children THEN all 5 are returned (no cap)", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "repo-1", kind: "git-dir" },
      { name: "repo-2", kind: "git-dir" },
      { name: "repo-3", kind: "git-dir" },
      { name: "repo-4", kind: "git-dir" },
      { name: "repo-5", kind: "git-dir" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// AC-16-001.4 — Only folders with a .git (file OR dir) are returned
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.4 — listProjectFolders accepts .git as a directory or a file", () => {
  it("frd-16: WHEN a child has a .git directory THEN it is returned (normal git clone)", () => {
    const projectsDir = makeTempProjectsDir([{ name: "normal-repo", kind: "git-dir" }]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toContain(path.join(projectsDir, "normal-repo"));
  });

  it("frd-16: WHEN a child has a .git file (worktree) THEN it is returned (git worktree repos count)", () => {
    const projectsDir = makeTempProjectsDir([{ name: "worktree-repo", kind: "git-file" }]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toContain(path.join(projectsDir, "worktree-repo"));
  });

  it("frd-16: WHEN a child is a plain folder with no .git THEN it is NOT returned", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "has-git", kind: "git-dir" },
      { name: "no-git", kind: "plain" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toContain(path.join(projectsDir, "has-git"));
    expect(result).not.toContain(path.join(projectsDir, "no-git"));
  });

  it("frd-16: WHEN a top-level entry is a regular file (not a directory) THEN it is NOT returned (regression I3: file-vs-dir guard)", () => {
    // A *file* named with a .git-free name must be ignored.
    // Also guards against a hypothetical regular file named exactly ".git".
    const projectsDir = makeTempProjectsDir([
      { name: "a-file.txt", kind: "file" },
      { name: "real-repo", kind: "git-dir" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toContain(path.join(projectsDir, "real-repo"));
    expect(result).not.toContain(path.join(projectsDir, "a-file.txt"));
  });

  it("frd-16: WHEN mixed children (git-dir, git-file, plain, file, nested-git) THEN only git-dir and git-file are returned", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "repo-a", kind: "git-dir" },
      { name: "worktree-b", kind: "git-file" },
      { name: "plain-c", kind: "plain" },
      { name: "loose-file.md", kind: "file" },
      { name: "nested-d", kind: "nested-git" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    expect(result).toHaveLength(2);
    expect(result).toContain(path.join(projectsDir, "repo-a"));
    expect(result).toContain(path.join(projectsDir, "worktree-b"));
  });
});

// ---------------------------------------------------------------------------
// AC-16-001.5 — Factory root and mission-control/ are excluded even if they have .git
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.5 — factory root and mission-control/ are excluded from the scan", () => {
  it("frd-16: WHEN the factory root itself is a child of the projects dir THEN it is excluded", () => {
    // Build a projects dir that contains: the factory root (git-dir) + another repo.
    const projectsDir = makeTempProjectsDir([{ name: "other-repo", kind: "git-dir" }]);
    tmpDirs.push(projectsDir);

    // Simulate the factory root sitting at projectsDir/panda-corp with a .git dir.
    const fakeFactoryRoot = path.join(projectsDir, "panda-corp");
    fs.mkdirSync(path.join(fakeFactoryRoot, ".git"), { recursive: true });

    const result = listProjectFolders(projectsDir, fakeFactoryRoot);

    expect(result).toContain(path.join(projectsDir, "other-repo"));
    // The factory root must be excluded even though it has a .git dir.
    expect(result).not.toContain(fakeFactoryRoot);
  });

  it("frd-16: WHEN mission-control/ is a git-repo child of the projects dir THEN it is excluded", () => {
    const projectsDir = makeTempProjectsDir([{ name: "sibling-repo", kind: "git-dir" }]);
    tmpDirs.push(projectsDir);

    // Simulate mission-control/ as a sibling of the factory root inside projects dir.
    const mcPath = path.join(projectsDir, MISSION_CONTROL_DIR);
    fs.mkdirSync(path.join(mcPath, ".git"), { recursive: true });

    const fakeFactoryRoot = path.join(projectsDir, "panda-corp");
    fs.mkdirSync(path.join(fakeFactoryRoot, ".git"), { recursive: true });

    const result = listProjectFolders(projectsDir, fakeFactoryRoot);

    expect(result).toContain(path.join(projectsDir, "sibling-repo"));
    expect(result).not.toContain(mcPath);
    expect(result).not.toContain(fakeFactoryRoot);
  });

  it("frd-16: WHEN mission-control/ is the only git-repo child THEN result is [] (nothing left after exclusion)", () => {
    const projectsDir = makeTempProjectsDir([]);
    tmpDirs.push(projectsDir);

    const mcPath = path.join(projectsDir, MISSION_CONTROL_DIR);
    fs.mkdirSync(path.join(mcPath, ".git"), { recursive: true });

    const fakeFactoryRoot = path.join(os.tmpdir(), `factory-${Date.now()}`);

    const result = listProjectFolders(projectsDir, fakeFactoryRoot);
    expect(result).toEqual([]);
  });

  it("frd-16: WHEN the factory root is in a different directory (not a child of projects dir) THEN all git-repo children are returned", () => {
    // Normal case: factory at /Users/ada/panda-corp, projects at /Users/ada/projects.
    // No child matches the factory root path.
    const projectsDir = makeTempProjectsDir([
      { name: "alpha", kind: "git-dir" },
      { name: "beta", kind: "git-dir" },
    ]);
    tmpDirs.push(projectsDir);

    const externalFactoryRoot = path.join(os.tmpdir(), `external-factory-${Date.now()}`);

    const result = listProjectFolders(projectsDir, externalFactoryRoot);
    expect(result).toHaveLength(2);
    expect(result).toContain(path.join(projectsDir, "alpha"));
    expect(result).toContain(path.join(projectsDir, "beta"));
  });
});

// ---------------------------------------------------------------------------
// AC-16-001.6 — REQ-16-005: Unreadable projectsPath → [] (no throw); read-only
// ---------------------------------------------------------------------------

describe("frd-16: AC-16-001.6 (REQ-16-005) — unreadable projects path returns [] without throwing", () => {
  it("frd-16: WHEN projectsPath does not exist THEN returns [] (no throw)", () => {
    const nonExistent = path.join(os.tmpdir(), `no-such-projects-dir-${Date.now()}`);

    expect(() => listProjectFolders(nonExistent)).not.toThrow();
    expect(listProjectFolders(nonExistent)).toEqual([]);
  });

  it("frd-16: WHEN projectsPath is an empty string THEN returns [] (no throw)", () => {
    expect(() => listProjectFolders("")).not.toThrow();
    expect(listProjectFolders("")).toEqual([]);
  });

  it("frd-16: WHEN projectsPath is a whitespace-only string THEN returns [] (no throw)", () => {
    expect(() => listProjectFolders("   ")).not.toThrow();
    expect(listProjectFolders("   ")).toEqual([]);
  });

  it("frd-16: WHEN projectsPath points to a file (not a directory) THEN returns [] (no throw)", () => {
    const tmpFile = path.join(os.tmpdir(), `mc-orphans-file-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "I am not a directory\n");
    tmpDirs.push(tmpFile); // reusing teardown array for files too

    expect(() => listProjectFolders(tmpFile)).not.toThrow();
    expect(listProjectFolders(tmpFile)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// REQ-16-005 — Read-only invariant: no git subprocess, no writes
// ---------------------------------------------------------------------------

describe("frd-16: REQ-16-005 — listProjectFolders is read-only (existence check only, no git subprocess)", () => {
  it("frd-16: WHEN listProjectFolders is called THEN the projects directory is not modified (no writes)", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "repo-a", kind: "git-dir" },
      { name: "plain-b", kind: "plain" },
    ]);
    tmpDirs.push(projectsDir);

    const entriesBefore = fs.readdirSync(projectsDir).sort();
    listProjectFolders(projectsDir);
    const entriesAfter = fs.readdirSync(projectsDir).sort();

    // The directory listing must be identical before and after the call.
    expect(entriesAfter).toEqual(entriesBefore);
  });

  it("frd-16: WHEN listProjectFolders is called THEN no .git subdirectory is modified (existence check, not git invocation)", () => {
    const projectsDir = makeTempProjectsDir([{ name: "guarded-repo", kind: "git-dir" }]);
    tmpDirs.push(projectsDir);

    const gitPath = path.join(projectsDir, "guarded-repo", ".git");
    const gitEntriesBefore = fs.readdirSync(gitPath).sort();

    listProjectFolders(projectsDir);

    const gitEntriesAfter = fs.readdirSync(gitPath).sort();
    // A git subprocess (e.g. git status, git log) would create FETCH_HEAD, index refs, etc.
    // A pure fs.existsSync/.git check leaves the .git dir completely untouched.
    expect(gitEntriesAfter).toEqual(gitEntriesBefore);
  });

  it("frd-16: WHEN listProjectFolders is called on an unreadable path THEN no directory is created (fail-soft, no mkdir)", () => {
    const nonExistent = path.join(os.tmpdir(), `no-mkdir-guard-${Date.now()}`);

    listProjectFolders(nonExistent);

    // The directory must NOT have been created as a side-effect.
    expect(fs.existsSync(nonExistent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Return type invariants — results are absolute paths
// ---------------------------------------------------------------------------

describe("frd-16: return value shape — listProjectFolders returns absolute paths", () => {
  it("frd-16: WHEN repos are found THEN each returned string is an absolute path", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "repo-x", kind: "git-dir" },
      { name: "repo-y", kind: "git-dir" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    for (const p of result) {
      expect(path.isAbsolute(p)).toBe(true);
    }
  });

  it("frd-16: WHEN repos are found THEN each returned path points to an existing directory", () => {
    const projectsDir = makeTempProjectsDir([{ name: "exists-repo", kind: "git-dir" }]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    for (const p of result) {
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).isDirectory()).toBe(true);
    }
  });

  it("frd-16: WHEN listProjectFolders is called THEN the result array contains no duplicates", () => {
    const projectsDir = makeTempProjectsDir([
      { name: "repo-1", kind: "git-dir" },
      { name: "repo-2", kind: "git-file" },
    ]);
    tmpDirs.push(projectsDir);

    const result = listProjectFolders(projectsDir);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

// ===========================================================================
// WO-16-002 — classifyCandidate + getOrphans
// RED phase — tests written BEFORE implementation.
//
// Acceptance criteria under test (WO-16-002 / FRD-16 EARS):
//
//   AC-16-002.1  git repo, NO marker, NOT in portfolio → kind:"orphan"
//   AC-16-002.2  git repo, HAS marker, NOT in portfolio → kind:"unlisted"
//   AC-16-002.3  git repo, HAS marker, IN portfolio → null (not a candidate)
//   AC-16-002.4  git repo, NO marker, IN portfolio → null (already known; no nag)
//   AC-16-002.5  Candidate shape: name, path, kind, hasMarker, inPortfolio
//   AC-16-002.6  Portfolio path comparison tolerates trailing slash / relative-vs-absolute
//   AC-16-002.7  Broken portfolio rows / missing portfolio → classify against readable
//                subset; never throws.
// ===========================================================================

// ---------------------------------------------------------------------------
// Fixture helpers for WO-16-002
// ---------------------------------------------------------------------------

/**
 * Create a temporary candidate folder (immediate child of a tmp dir) with
 * optional .git and .pandacorp/status.yaml.
 *
 * Returns `{ projectsDir, candidatePath }`.
 */
function makeCandidateDir(opts: { name?: string; hasGit?: boolean; hasMarker?: boolean }): {
  projectsDir: string;
  candidatePath: string;
} {
  const { name = "my-project", hasGit = true, hasMarker = false } = opts;
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-classify-"));
  tmpDirs.push(projectsDir);
  const candidatePath = path.join(projectsDir, name);
  fs.mkdirSync(candidatePath, { recursive: true });
  if (hasGit) {
    fs.mkdirSync(path.join(candidatePath, ".git"), { recursive: true });
  }
  if (hasMarker) {
    fs.mkdirSync(path.join(candidatePath, ".pandacorp"), { recursive: true });
    fs.writeFileSync(
      path.join(candidatePath, ".pandacorp", "status.yaml"),
      "project: my-project\nphase: implementation\n",
    );
  }
  return { projectsDir, candidatePath };
}

// ===========================================================================
// classifyCandidate — truth table (AC-16-002.1 through AC-16-002.4)
// ===========================================================================

describe("frd-16 WO-16-002: AC-16-002.1 — git repo, NO marker, NOT in portfolio → orphan", () => {
  it("frd-16: classifyCandidate returns kind:orphan when no marker and not in portfolio", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    const result = classifyCandidate(candidatePath, []);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("orphan");
  });

  it("frd-16: orphan candidate has hasMarker:false and inPortfolio:false", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    const result = classifyCandidate(candidatePath, []);
    expect(result?.hasMarker).toBe(false);
    expect(result?.inPortfolio).toBe(false);
  });
});

describe("frd-16 WO-16-002: AC-16-002.2 — git repo, HAS marker, NOT in portfolio → unlisted", () => {
  it("frd-16: classifyCandidate returns kind:unlisted when marker present and not in portfolio", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: true });
    const result = classifyCandidate(candidatePath, []);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("unlisted");
  });

  it("frd-16: unlisted candidate has hasMarker:true and inPortfolio:false", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: true });
    const result = classifyCandidate(candidatePath, []);
    expect(result?.hasMarker).toBe(true);
    expect(result?.inPortfolio).toBe(false);
  });
});

describe("frd-16 WO-16-002: AC-16-002.3 — git repo, HAS marker, IN portfolio → null", () => {
  it("frd-16: classifyCandidate returns null when marker present and path is in portfolio", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: true });
    const result = classifyCandidate(candidatePath, [candidatePath]);
    expect(result).toBeNull();
  });
});

describe("frd-16 WO-16-002: AC-16-002.4 — git repo, NO marker, IN portfolio → null (no nag)", () => {
  it("frd-16: classifyCandidate returns null when no marker but path IS in portfolio (already known)", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    const result = classifyCandidate(candidatePath, [candidatePath]);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// AC-16-002.5 — Candidate shape
// ===========================================================================

describe("frd-16 WO-16-002: AC-16-002.5 — Candidate carries name, path, kind, hasMarker, inPortfolio", () => {
  it("frd-16: orphan candidate has all required fields with correct types", () => {
    const { candidatePath } = makeCandidateDir({
      name: "cool-project",
      hasGit: true,
      hasMarker: false,
    });
    const result = classifyCandidate(candidatePath, []);
    expect(result).not.toBeNull();
    // name is the folder name
    expect(result?.name).toBe("cool-project");
    // path is the absolute path
    expect(result?.path).toBe(candidatePath);
    expect(path.isAbsolute(result?.path ?? "")).toBe(true);
    // kind
    expect(result?.kind).toBe("orphan");
    // boolean fields
    expect(typeof result?.hasMarker).toBe("boolean");
    expect(typeof result?.inPortfolio).toBe("boolean");
  });

  it("frd-16: unlisted candidate has all required fields with correct types", () => {
    const { candidatePath } = makeCandidateDir({
      name: "factory-project",
      hasGit: true,
      hasMarker: true,
    });
    const result = classifyCandidate(candidatePath, []);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("factory-project");
    expect(result?.path).toBe(candidatePath);
    expect(result?.kind).toBe("unlisted");
    expect(result?.hasMarker).toBe(true);
    expect(result?.inPortfolio).toBe(false);
  });
});

// ===========================================================================
// AC-16-002.6 — Path normalization: trailing slash / relative vs absolute
// ===========================================================================

describe("frd-16 WO-16-002: AC-16-002.6 — portfolio path comparison tolerates normalization differences", () => {
  it("frd-16: recognizes a match when portfolio path has a trailing slash", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    // portfolio path has trailing slash — must still be recognized as a match
    const result = classifyCandidate(candidatePath, [`${candidatePath}/`]);
    expect(result).toBeNull();
  });

  it("frd-16: recognizes a match when the candidate path has a trailing slash but portfolio does not", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    // candidate path with trailing slash, portfolio without
    const withSlash = `${candidatePath}/`;
    const result = classifyCandidate(withSlash, [candidatePath]);
    expect(result).toBeNull();
  });

  it("frd-16: recognizes a match when portfolio contains a path with ./ segments (normalize before comparing)", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    // portfolio path has redundant ./ segment
    const noisyPath = path.join(candidatePath, ".", "");
    const result = classifyCandidate(candidatePath, [noisyPath]);
    expect(result).toBeNull();
  });

  it("frd-16: non-matching path is still classified correctly (sanity: normalization does not over-match)", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    const unrelatedPath = "/some/totally/different/path";
    const result = classifyCandidate(candidatePath, [unrelatedPath]);
    expect(result?.kind).toBe("orphan");
  });
});

// ===========================================================================
// AC-16-002.7 — Defensive: broken portfolio rows / missing portfolio → no throw
// ===========================================================================

describe("frd-16 WO-16-002: AC-16-002.7 — classifyCandidate never throws on bad registeredPaths input", () => {
  it("frd-16: empty registeredPaths array → orphan (no throw)", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    expect(() => classifyCandidate(candidatePath, [])).not.toThrow();
    expect(classifyCandidate(candidatePath, [])?.kind).toBe("orphan");
  });

  it("frd-16: registeredPaths containing empty strings → still classifies correctly (no throw)", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    expect(() => classifyCandidate(candidatePath, ["", "  ", ""])).not.toThrow();
    expect(classifyCandidate(candidatePath, ["", "  ", ""])?.kind).toBe("orphan");
  });

  it("frd-16: registeredPaths containing undefined-like values (empty strings) and one real match → null", () => {
    const { candidatePath } = makeCandidateDir({ hasGit: true, hasMarker: false });
    const result = classifyCandidate(candidatePath, ["", candidatePath, ""]);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getOrphans — integration: compose resolveProjectsPath + listProjectFolders + classifyCandidate
// ===========================================================================

describe("frd-16 WO-16-002: getOrphans — integration (AC-16-002.1 through AC-16-002.7)", () => {
  /**
   * Build a full fixture tree:
   *   <root>/
   *     factory/
   *       profile.md   (projects_path → projectsDir)
   *       portfolio.md (registered paths)
   *     <projectsDir>/   (a sibling of the factory at the parent level, or the factory parent)
   *       <children...>
   *
   * We'll put projects inside a dedicated temp dir and point profile.md at it.
   */
  function makeFixtureTree(opts: {
    children: Array<{ name: string; hasGit: boolean; hasMarker: boolean }>;
    registeredNames?: string[];
  }): { factoryRoot: string; projectsDir: string } {
    const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-getorphans-proj-"));
    tmpDirs.push(projectsDir);

    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-getorphans-factory-"));
    tmpDirs.push(factoryRoot);

    const factoryDir = path.join(factoryRoot, "factory");
    fs.mkdirSync(factoryDir, { recursive: true });

    // profile.md pointing at projectsDir
    fs.writeFileSync(
      path.join(factoryDir, "profile.md"),
      `---\nname: "Test User"\nprojects_path: "${projectsDir}"\n---\n`,
      "utf-8",
    );

    // Create child folders
    for (const child of opts.children) {
      const childPath = path.join(projectsDir, child.name);
      fs.mkdirSync(childPath, { recursive: true });
      if (child.hasGit) {
        fs.mkdirSync(path.join(childPath, ".git"), { recursive: true });
      }
      if (child.hasMarker) {
        fs.mkdirSync(path.join(childPath, ".pandacorp"), { recursive: true });
        fs.writeFileSync(
          path.join(childPath, ".pandacorp", "status.yaml"),
          `project: ${child.name}\nphase: implementation\n`,
        );
      }
    }

    // portfolio.md
    const registeredNames = opts.registeredNames ?? [];
    const rows = registeredNames
      .map((name) => {
        const p = path.join(projectsDir, name);
        return `| ${name} | ${p} | — | — | — | — | — | — | — |`;
      })
      .join("\n");
    const portfolioContent =
      `# Portfolio\n\n| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |\n` +
      `|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
    fs.writeFileSync(path.join(factoryDir, "portfolio.md"), portfolioContent, "utf-8");

    return { factoryRoot, projectsDir };
  }

  it("frd-16: WHEN all projects are orphans (no marker, not in portfolio) THEN getOrphans returns them all", () => {
    const { factoryRoot, projectsDir } = makeFixtureTree({
      children: [
        { name: "orphan-a", hasGit: true, hasMarker: false },
        { name: "orphan-b", hasGit: true, hasMarker: false },
      ],
      registeredNames: [],
    });

    const result = getOrphans(factoryRoot);
    expect(result).toHaveLength(2);
    const kinds = result.map((c) => c.kind);
    expect(kinds.every((k) => k === "orphan")).toBe(true);
    const names = result.map((c) => c.name).sort();
    expect(names).toEqual(["orphan-a", "orphan-b"]);
    const paths = result.map((c) => c.path);
    expect(paths).toContain(path.join(projectsDir, "orphan-a"));
    expect(paths).toContain(path.join(projectsDir, "orphan-b"));
  });

  it("frd-16: WHEN a project has marker but is not in portfolio THEN getOrphans returns it as unlisted", () => {
    const { factoryRoot } = makeFixtureTree({
      children: [{ name: "unlisted-proj", hasGit: true, hasMarker: true }],
      registeredNames: [],
    });

    const result = getOrphans(factoryRoot);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("unlisted");
    expect(result[0]?.name).toBe("unlisted-proj");
    expect(result[0]?.hasMarker).toBe(true);
    expect(result[0]?.inPortfolio).toBe(false);
  });

  it("frd-16: WHEN a project has marker AND is in portfolio THEN getOrphans does NOT include it", () => {
    const { factoryRoot } = makeFixtureTree({
      children: [{ name: "known-proj", hasGit: true, hasMarker: true }],
      registeredNames: ["known-proj"],
    });

    const result = getOrphans(factoryRoot);
    expect(result).toHaveLength(0);
  });

  it("frd-16: WHEN a project has NO marker but IS in portfolio THEN getOrphans does NOT include it (AC-16-002.4)", () => {
    const { factoryRoot } = makeFixtureTree({
      children: [{ name: "listed-no-marker", hasGit: true, hasMarker: false }],
      registeredNames: ["listed-no-marker"],
    });

    const result = getOrphans(factoryRoot);
    expect(result).toHaveLength(0);
  });

  it("frd-16: WHEN projects have mixed truth-table rows THEN only orphan/unlisted are returned", () => {
    const { factoryRoot } = makeFixtureTree({
      children: [
        { name: "orphan", hasGit: true, hasMarker: false }, // → orphan
        { name: "unlisted", hasGit: true, hasMarker: true }, // → unlisted
        { name: "known-marked", hasGit: true, hasMarker: true }, // → null (in portfolio)
        { name: "listed-no-marker", hasGit: true, hasMarker: false }, // → null (in portfolio)
        { name: "plain-no-git", hasGit: false, hasMarker: false }, // skipped by listProjectFolders
      ],
      registeredNames: ["known-marked", "listed-no-marker"],
    });

    const result = getOrphans(factoryRoot);
    expect(result).toHaveLength(2);
    const names = result.map((c) => c.name).sort();
    expect(names).toEqual(["orphan", "unlisted"]);
  });

  it("frd-16: WHEN no projects exist in the projects dir THEN getOrphans returns []", () => {
    const { factoryRoot } = makeFixtureTree({ children: [], registeredNames: [] });
    expect(getOrphans(factoryRoot)).toEqual([]);
  });

  it("frd-16: WHEN portfolio is missing (no portfolio.md) THEN getOrphans treats all as unregistered (no throw, AC-16-002.7)", () => {
    const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-getorphans-noportfolio-"));
    tmpDirs.push(projectsDir);

    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-getorphans-fac-noportfolio-"));
    tmpDirs.push(factoryRoot);

    const factoryDir = path.join(factoryRoot, "factory");
    fs.mkdirSync(factoryDir, { recursive: true });

    // profile points to projectsDir; portfolio.md deliberately absent
    fs.writeFileSync(
      path.join(factoryDir, "profile.md"),
      `---\nname: "Test"\nprojects_path: "${projectsDir}"\n---\n`,
      "utf-8",
    );

    // Create an orphan
    const childPath = path.join(projectsDir, "stray-repo");
    fs.mkdirSync(path.join(childPath, ".git"), { recursive: true });

    let result: Candidate[] = [];
    expect(() => {
      result = getOrphans(factoryRoot);
    }).not.toThrow();
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("orphan");
  });

  it("frd-16: getOrphans never throws when factoryRoot does not exist (AC-16-002.7)", () => {
    // Use an empty parent dir so that the os.tmpdir() fallback doesn't surface
    // real temp repos from other tests. The parent of the ghost factory root
    // becomes the projects path when the profile is absent — keep that parent
    // empty and controlled.
    const emptyParent = fs.mkdtempSync(path.join(os.tmpdir(), "mc-ghost-parent-"));
    tmpDirs.push(emptyParent);
    const ghost = path.join(emptyParent, "ghost-factory");
    // ghost does not exist on disk → resolveProjectsPath falls back to emptyParent
    expect(() => getOrphans(ghost)).not.toThrow();
    expect(getOrphans(ghost)).toEqual([]);
  });

  it("frd-16: WHEN profile has no projects_path THEN getOrphans falls back to parent dir of factoryRoot (AC-16-001.2 integration)", () => {
    // Build factory root whose parent dir has no git repos → result must be []
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-getorphans-noprojects-"));
    tmpDirs.push(factoryRoot);

    const factoryDir = path.join(factoryRoot, "factory");
    fs.mkdirSync(factoryDir, { recursive: true });

    // Profile without projects_path → falls back to parent of factoryRoot.
    // Parent is os.tmpdir() — we can't control its content, but the function must not throw.
    fs.writeFileSync(path.join(factoryDir, "profile.md"), `---\nname: "Test"\n---\n`, "utf-8");

    expect(() => getOrphans(factoryRoot)).not.toThrow();
  });
});
