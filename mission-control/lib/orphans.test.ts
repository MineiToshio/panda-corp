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

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase).
// ---------------------------------------------------------------------------
import { listProjectFolders, resolveProjectsPath } from "./orphans";

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
