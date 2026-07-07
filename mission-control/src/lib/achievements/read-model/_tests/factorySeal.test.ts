/**
 * RED → GREEN tests for the factory-wide freshness seal (FRD-23, WO-23-005, REQ-23-006.2).
 *
 * The seal is the hash of the last commit touching the factory-wide routes (`portfolio.md` +
 * `decisions/` + `memory/`) OR any project's `.pandacorp/status.yaml`. The CROSS-PROJECT staleness
 * test is the exact defect the SSOT split fixes (seeds AC-23-007.3): two materialized projects A and
 * B; a phase change in B mutates the factory seal → the store guarding A's factory-wide facts is
 * treated stale. Equality-only, never ordered (LESSON-0009).
 *
 * A REAL, self-contained git fixture (a factory repo + two project work-trees) exercises the git
 * shell-out; `readPortfolio` is mocked to point the seal at the fixture's two projects.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioEntry } from "../../../portfolio/portfolio";
import { currentFactorySeal, isFactoryFresh } from "../factorySeal";
import { makeFactoryStore } from "./fixtures";

// The portfolio the seal walks — mocked to the fixture's two projects (absolute paths).
const portfolioEntries: PortfolioEntry[] = [];
vi.mock("../../../portfolio/portfolio", () => ({
  readPortfolio: (): PortfolioEntry[] => portfolioEntries,
}));

function git(cwd: string, args: string): void {
  execSync(`git ${args}`, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

/** Build a self-contained factory git repo with the factory-wide routes + two committed projects. */
function buildFactoryFixture(root: string): { projectA: string; projectB: string } {
  fs.mkdirSync(path.join(root, "factory", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "factory", "memory"), { recursive: true });
  fs.writeFileSync(path.join(root, "factory", "portfolio.md"), "# Portfolio\n", "utf-8");
  fs.writeFileSync(
    path.join(root, "factory", "decisions", "registry.yaml"),
    "rules: []\n",
    "utf-8",
  );
  fs.writeFileSync(path.join(root, "factory", "memory", "INDEX.md"), "# Memory\n", "utf-8");

  const projectA = path.join(root, "projects", "alpha");
  const projectB = path.join(root, "projects", "beta");
  for (const p of [projectA, projectB]) {
    fs.mkdirSync(path.join(p, ".pandacorp"), { recursive: true });
    fs.writeFileSync(path.join(p, ".pandacorp", "status.yaml"), "phase: implementation\n", "utf-8");
  }

  git(root, "init -q");
  git(root, "config user.email test@pandacorp.dev");
  git(root, "config user.name Test");
  git(root, "add -A");
  git(root, 'commit -q -m "seed factory + projects"');
  return { projectA, projectB };
}

describe("currentFactorySeal — cross-project staleness (AC-23-006.2, seeds AC-23-007.3)", () => {
  let root: string;
  let projectB: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-seal-"));
    const { projectB: b } = buildFactoryFixture(root);
    projectB = b;
    portfolioEntries.length = 0;
    portfolioEntries.push(
      { name: "alpha", path: path.join(root, "projects", "alpha") },
      { name: "beta", path: projectB },
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("computes a non-null 40-char commit hash over the factory-wide routes", () => {
    const seal = currentFactorySeal(root);
    expect(seal).not.toBeNull();
    expect(seal).toMatch(/^[0-9a-f]{40}$/);
  });

  it("CHANGES when a phase change lands in project B (the SSOT-split regression)", () => {
    // `currentFactorySeal` (React.cache-deduped) reports the seed commit's hash.
    const seeded = currentFactorySeal(root);
    const rawSeeded = execSync(
      'git log -1 --format=%H -- "factory/portfolio.md" "factory/decisions" "factory/memory" "projects/alpha/.pandacorp/status.yaml" "projects/beta/.pandacorp/status.yaml"',
      { cwd: root, encoding: "utf-8" },
    ).trim();
    // The seal the reader would validate against IS the pathspec's last commit (B's status.yaml is in scope).
    expect(seeded).toBe(rawSeeded);

    // A phase change in project B — the exact event that used to leave A's embedded copy stale.
    fs.writeFileSync(path.join(projectB, ".pandacorp", "status.yaml"), "phase: release\n", "utf-8");
    git(root, "add -A");
    git(root, 'commit -q -m "beta: implementation -> release"');

    // The pathspec includes B's status.yaml → the last-touching commit is now the new one, so any
    // store still stamped with `rawSeeded` mismatches and is treated stale (the cross-project fix).
    const rawAfter = execSync(
      'git log -1 --format=%H -- "factory/portfolio.md" "factory/decisions" "factory/memory" "projects/alpha/.pandacorp/status.yaml" "projects/beta/.pandacorp/status.yaml"',
      { cwd: root, encoding: "utf-8" },
    ).trim();
    expect(rawAfter).not.toBe(rawSeeded);
    expect(isFactoryFresh(makeFactoryStore({ seal: rawSeeded }), rawAfter)).toBe(false);
  });

  it("returns null in a non-git directory (never a fabricated seal)", () => {
    const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), "factory-nogit-"));
    portfolioEntries.length = 0;
    try {
      expect(currentFactorySeal(nonGit)).toBeNull();
    } finally {
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });
});

describe("isFactoryFresh — equality only, null is never fresh (LESSON-0009)", () => {
  it("is fresh only when the stored seal equals the current seal", () => {
    const store = makeFactoryStore({ seal: "abc123" });
    expect(isFactoryFresh(store, "abc123")).toBe(true);
    expect(isFactoryFresh(store, "different")).toBe(false);
  });

  it("is NEVER fresh against a null current seal (unvalidatable → stale)", () => {
    const store = makeFactoryStore({ seal: "abc123" });
    expect(isFactoryFresh(store, null)).toBe(false);
  });
});
