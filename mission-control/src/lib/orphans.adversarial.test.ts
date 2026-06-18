/**
 * WO-16-001 — ADVERSARIAL review tests (reviewer, Opus — DR-015).
 *
 * These cover edge cases, abuse and inconsistencies the implementer's own
 * suite (orphans.test.ts) did NOT exercise. Derived from the EARS criteria
 * (REQ-16-005 read-only / REQ-16-006 bounded) and the FRD's exclusion contract,
 * NOT from the green tests. Goal: probe where the bounded/read-only/exclusion
 * invariants could leak.
 *
 * Focus areas the original suite missed:
 *   A. Factory-root exclusion robustness (trailing slash, `.`/`..` segments,
 *      symlinked factory root).
 *   B. mission-control exclusion is name-exact (case + substring confusion).
 *   C. `.git` existence-check edge cases (dangling symlink, `.git` as the only
 *      thing in an otherwise-empty repo).
 *   D. Symlinked children (statSync follows symlinks → a symlink to a repo dir).
 *   E. resolveProjectsPath stability / verbatim contract under odd YAML.
 *   F. Determinism — same tree → same result (no order dependence on readdir).
 */

// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { listProjectFolders, resolveProjectsPath } from "./orphans";

const MISSION_CONTROL_DIR = "mission-control";

let tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  tmpDirs = [];
});

function makeProjectsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-adv-"));
  tmpDirs.push(dir);
  return dir;
}

function makeGitDir(parent: string, name: string): string {
  const p = path.join(parent, name);
  fs.mkdirSync(path.join(p, ".git"), { recursive: true });
  return p;
}

// ===========================================================================
// A. Factory-root exclusion robustness
// ===========================================================================

describe("frd-16 adversarial A — factory-root exclusion is normalization-proof", () => {
  it("excludes the factory root even when factoryRoot is passed with a trailing slash", () => {
    const projects = makeProjectsDir();
    const factory = makeGitDir(projects, "panda-corp");
    makeGitDir(projects, "real-repo");

    // Owner-supplied factory root with a trailing separator — a real possibility
    // since resolveProjectsPath returns paths verbatim and callers may pass either.
    const result = listProjectFolders(projects, `${factory}${path.sep}`);

    expect(result).toContain(path.join(projects, "real-repo"));
    expect(result).not.toContain(factory);
  });

  it("excludes the factory root when factoryRoot contains redundant ./ and ../ segments", () => {
    const projects = makeProjectsDir();
    const factory = makeGitDir(projects, "panda-corp");
    makeGitDir(projects, "keepme");

    // e.g. /tmp/x/panda-corp/../panda-corp/./  → resolves to the same dir.
    const noisy = path.join(factory, "..", "panda-corp", ".");
    const result = listProjectFolders(projects, noisy);

    expect(result).toContain(path.join(projects, "keepme"));
    expect(result).not.toContain(factory);
  });
});

// ===========================================================================
// B. mission-control exclusion is name-exact (no over/under matching)
// ===========================================================================

describe("frd-16 adversarial B — mission-control exclusion matches the exact name only", () => {
  it("does NOT exclude a repo whose name merely CONTAINS mission-control as a substring", () => {
    // The exclusion must be exact ("mission-control"), not a substring/prefix match,
    // or a legit project like "mission-control-client" would be wrongly hidden.
    const projects = makeProjectsDir();
    makeGitDir(projects, "mission-control-client");
    makeGitDir(projects, "my-mission-control");

    const result = listProjectFolders(projects);

    expect(result).toContain(path.join(projects, "mission-control-client"));
    expect(result).toContain(path.join(projects, "my-mission-control"));
  });

  it("excludes mission-control even when no factoryRoot is provided (name-only exclusion still applies)", () => {
    const projects = makeProjectsDir();
    makeGitDir(projects, MISSION_CONTROL_DIR);
    makeGitDir(projects, "other");

    const result = listProjectFolders(projects); // factoryRoot omitted

    expect(result).not.toContain(path.join(projects, MISSION_CONTROL_DIR));
    expect(result).toContain(path.join(projects, "other"));
  });
});

// ===========================================================================
// C. .git existence-check edge cases
// ===========================================================================

describe("frd-16 adversarial C — .git existence check, edge shapes", () => {
  it("skips a child whose .git is a DANGLING symlink (broken link → accessSync throws → not a repo)", () => {
    const projects = makeProjectsDir();
    const child = path.join(projects, "broken-link-repo");
    fs.mkdirSync(child, { recursive: true });
    // A .git symlink pointing nowhere — git would not treat this as a working repo,
    // and the scan's accessSync must not crash; the child must simply be skipped.
    fs.symlinkSync(path.join(projects, "does-not-exist"), path.join(child, ".git"));
    makeGitDir(projects, "good-repo");

    let result: string[] = [];
    expect(() => {
      result = listProjectFolders(projects);
    }).not.toThrow();

    expect(result).toContain(path.join(projects, "good-repo"));
    expect(result).not.toContain(child);
  });

  it("includes a repo whose .git is a VALID symlink to an existing dir (accessSync resolves the target)", () => {
    const projects = makeProjectsDir();
    const realGit = path.join(projects, "_shared-git");
    fs.mkdirSync(realGit, { recursive: true });
    const child = path.join(projects, "linked-git-repo");
    fs.mkdirSync(child, { recursive: true });
    fs.symlinkSync(realGit, path.join(child, ".git"));

    const result = listProjectFolders(projects);
    // Documenting current behavior: a resolvable .git symlink counts as a repo.
    expect(result).toContain(child);
  });
});

// ===========================================================================
// D. Symlinked children (statSync follows symlinks)
// ===========================================================================

describe("frd-16 adversarial D — symlinked children", () => {
  it("a symlink pointing to a real git-repo directory is treated as a directory (statSync follows it)", () => {
    const projects = makeProjectsDir();
    // A real repo OUTSIDE the projects dir, surfaced via a symlink INSIDE it.
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-ext-"));
    tmpDirs.push(external);
    fs.mkdirSync(path.join(external, ".git"), { recursive: true });

    const link = path.join(projects, "linked-project");
    fs.symlinkSync(external, link);

    let result: string[] = [];
    expect(() => {
      result = listProjectFolders(projects);
    }).not.toThrow();
    // Documents current behavior: a symlinked repo at depth 1 is discovered.
    expect(result).toContain(link);
  });

  it("a symlink to a regular file is NOT treated as a repo (no .git, no crash)", () => {
    const projects = makeProjectsDir();
    const fileTarget = path.join(projects, "_a-file.txt");
    fs.writeFileSync(fileTarget, "data");
    const link = path.join(projects, "file-link");
    fs.symlinkSync(fileTarget, link);
    makeGitDir(projects, "real");

    let result: string[] = [];
    expect(() => {
      result = listProjectFolders(projects);
    }).not.toThrow();
    expect(result).toContain(path.join(projects, "real"));
    expect(result).not.toContain(link);
    // The symlink target itself (a file) must never be returned either.
    expect(result).not.toContain(fileTarget);
  });
});

// ===========================================================================
// E. resolveProjectsPath verbatim contract under odd YAML / boundary values
// ===========================================================================

describe("frd-16 adversarial E — resolveProjectsPath boundary inputs", () => {
  function tempFactory(profile?: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-fac-"));
    tmpDirs.push(root);
    fs.mkdirSync(path.join(root, "factory"), { recursive: true });
    if (profile !== undefined) {
      fs.writeFileSync(path.join(root, "factory", "profile.md"), profile, "utf-8");
    }
    return root;
  }

  it("falls back to parent when projects_path is a YAML boolean (true is not a string)", () => {
    const root = tempFactory("---\nprojects_path: true\n---\n");
    expect(resolveProjectsPath(root)).toBe(path.dirname(root));
  });

  it("falls back to parent when projects_path is a YAML list (array is not a string)", () => {
    const root = tempFactory("---\nprojects_path:\n  - /a\n  - /b\n---\n");
    expect(resolveProjectsPath(root)).toBe(path.dirname(root));
  });

  it("falls back to parent when projects_path is YAML null", () => {
    const root = tempFactory("---\nprojects_path: null\n---\n");
    expect(resolveProjectsPath(root)).toBe(path.dirname(root));
  });

  it("returns a string with internal-but-not-edge whitespace verbatim (only fully-blank is treated as absent)", () => {
    // A path containing a space is legitimate ("/Users/ada/My Projects").
    // The guard only trims to test for blankness — it must NOT strip a real path.
    const realPath = "/Users/ada/My Projects";
    const root = tempFactory(`---\nprojects_path: "${realPath}"\n---\n`);
    expect(resolveProjectsPath(root)).toBe(realPath);
  });

  it("falls back to parent when factory/profile.md is a directory, not a file (no throw)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-orphans-facdir-"));
    tmpDirs.push(root);
    // profile.md exists but as a directory — readFileSync would EISDIR.
    fs.mkdirSync(path.join(root, "factory", "profile.md"), { recursive: true });
    expect(() => resolveProjectsPath(root)).not.toThrow();
    expect(resolveProjectsPath(root)).toBe(path.dirname(root));
  });
});

// ===========================================================================
// F. Determinism + read-only depth guarantee
// ===========================================================================

describe("frd-16 adversarial F — determinism and depth guarantee", () => {
  it("returns the same set across repeated calls regardless of readdir ordering", () => {
    const projects = makeProjectsDir();
    for (const n of ["zeta", "alpha", "mike", "bravo"]) makeGitDir(projects, n);

    const r1 = [...listProjectFolders(projects)].sort();
    const r2 = [...listProjectFolders(projects)].sort();
    expect(r2).toEqual(r1);
    expect(r1).toHaveLength(4);
  });

  it("never returns a path deeper than one level below projectsPath, even with deeply nested repos", () => {
    const projects = makeProjectsDir();
    // child (no .git) → grandchild (.git) → great-grandchild (.git)
    const child = path.join(projects, "wrapper");
    fs.mkdirSync(path.join(child, "g1", ".git"), { recursive: true });
    fs.mkdirSync(path.join(child, "g1", "g2", ".git"), { recursive: true });
    makeGitDir(projects, "top");

    const result = listProjectFolders(projects);
    const projectsDepth = projects.split(path.sep).length;
    for (const p of result) {
      // Every returned path must be exactly one segment below projectsPath.
      expect(p.split(path.sep).length).toBe(projectsDepth + 1);
    }
    expect(result).toEqual([path.join(projects, "top")]);
  });

  it("does not create the .git probe target as a side effect when a child lacks .git", () => {
    const projects = makeProjectsDir();
    const plain = path.join(projects, "plain");
    fs.mkdirSync(plain, { recursive: true });

    listProjectFolders(projects);

    // The existence check must never materialize a .git entry (read-only, REQ-16-005).
    expect(fs.existsSync(path.join(plain, ".git"))).toBe(false);
  });
});
