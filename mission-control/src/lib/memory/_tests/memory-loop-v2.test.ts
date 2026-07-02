/**
 * WO-17-005 — Loop v2 fields & signals (RED phase).
 *
 * The factory's self-learning loop v2 (plugin v9.49.0) extended the lesson
 * schema (`trigger:`, `applied_in:`) and the loop's health signals
 * (`factory/memory/_last-sweep` marker, `last_harvest:` stamp in each
 * project's status.yaml). These tests pin the reader/health contract.
 *
 * Traceability:
 *   AC-17-006.1  trigger/applied_in exposed typed; absent → ""/[] (fail-soft)
 *   AC-17-006.2  lastSweepAt from _last-sweep (null honest); harvestOrphans
 *                lists exactly release-without-harvest projects
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withFactoryRoot } from "@/tests/fixtures";
import { readLessons } from "../memory";
import { memoryHealth } from "../memory-health";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const tmpRoots: string[] = [];

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Create a temp factory root with a factory/memory dir; return its path. */
function makeFactoryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-v2-"));
  fs.mkdirSync(path.join(root, "factory", "memory"), { recursive: true });
  tmpRoots.push(root);
  return root;
}

/** Write a LESSON file from raw frontmatter lines + body. */
function writeLesson(root: string, filename: string, fmLines: string[], body: string): void {
  const content = ["---", ...fmLines, "---", "", body].join("\n");
  fs.writeFileSync(path.join(root, "factory", "memory", filename), content, "utf-8");
}

const BASE_FM = [
  "id: LESSON-0001",
  "type: gotcha",
  "domain: nodejs",
  "status: active",
  "promotion: none",
  "source: proj-alpha (WO-01-001 review)",
  "created: 2026-06-30",
];

/** Write a portfolio.md pointing at the given project rows (name → relative path). */
function writePortfolio(root: string, rows: ReadonlyArray<{ name: string; rel: string }>): void {
  const table = [
    "# Portfolio",
    "",
    "| Name | Path | Repo | Phase |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${r.name} | ${r.rel} | — | implementation |`),
  ].join("\n");
  fs.writeFileSync(path.join(root, "factory", "portfolio.md"), table, "utf-8");
}

/** Write a project's .pandacorp/status.yaml with the given raw lines. */
function writeStatus(root: string, rel: string, lines: string[]): void {
  const dir = path.join(root, rel, ".pandacorp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "status.yaml"), lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// Reader: trigger / applied_in (AC-17-006.1)
// ---------------------------------------------------------------------------

describe("readLessons — loop v2 fields", () => {
  it("exposes trigger and appliedIn when present in frontmatter", async () => {
    const root = makeFactoryRoot();
    writeLesson(
      root,
      "LESSON-0001-v2.md",
      [
        ...BASE_FM,
        "trigger: use this when parsing frontmatter with gray-matter@4",
        "applied_in: [proj-a, proj-b]",
      ],
      "**Lesson:** body.",
    );

    const lessons = await withFactoryRoot(root, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.trigger).toBe("use this when parsing frontmatter with gray-matter@4");
    expect(lessons[0]?.appliedIn).toEqual(["proj-a", "proj-b"]);
  });

  it("defaults trigger to '' and appliedIn to [] on a pre-v2 lesson (fail-soft)", async () => {
    const root = makeFactoryRoot();
    writeLesson(root, "LESSON-0001-old.md", BASE_FM, "**Lesson:** body.");

    const lessons = await withFactoryRoot(root, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.trigger).toBe("");
    expect(lessons[0]?.appliedIn).toEqual([]);
  });

  it("coerces a malformed applied_in (non-array / mixed) safely", async () => {
    const root = makeFactoryRoot();
    writeLesson(
      root,
      "LESSON-0001-bad.md",
      [...BASE_FM, "applied_in: not-a-list"],
      "**Lesson:** body.",
    );

    const lessons = await withFactoryRoot(root, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.appliedIn).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Health: lastSweepAt (AC-17-006.2)
// ---------------------------------------------------------------------------

describe("memoryHealth — lastSweepAt from _last-sweep", () => {
  it("returns the marker's ISO timestamp when _last-sweep exists", async () => {
    const root = makeFactoryRoot();
    fs.writeFileSync(
      path.join(root, "factory", "memory", "_last-sweep"),
      "2026-07-02T09:03:00Z\n",
      "utf-8",
    );

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.lastSweepAt).toBe("2026-07-02T09:03:00Z");
  });

  it("returns null when the marker is absent (honest empty)", async () => {
    const root = makeFactoryRoot();

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.lastSweepAt).toBeNull();
  });

  it("returns null when the marker content is not a parseable date (fail-soft, no throw)", async () => {
    const root = makeFactoryRoot();
    fs.writeFileSync(path.join(root, "factory", "memory", "_last-sweep"), "garbage", "utf-8");

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.lastSweepAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Health: harvestOrphans (AC-17-006.2)
// ---------------------------------------------------------------------------

describe("memoryHealth — harvestOrphans", () => {
  it("lists a release project with no last_harvest stamp", async () => {
    const root = makeFactoryRoot();
    writePortfolio(root, [{ name: "proj-a", rel: "projects/proj-a" }]);
    writeStatus(root, "projects/proj-a", ["phase: release", "running: false"]);

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.harvestOrphans).toEqual(["proj-a"]);
  });

  it("excludes a release project whose last_harvest is stamped", async () => {
    const root = makeFactoryRoot();
    writePortfolio(root, [{ name: "proj-a", rel: "projects/proj-a" }]);
    writeStatus(root, "projects/proj-a", ["phase: release", "last_harvest: 2026-07-02T10:00:00Z"]);

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.harvestOrphans).toEqual([]);
  });

  it("excludes projects not in phase release, and tolerates a missing status.yaml", async () => {
    const root = makeFactoryRoot();
    writePortfolio(root, [
      { name: "proj-building", rel: "projects/proj-building" },
      { name: "proj-ghost", rel: "projects/proj-ghost" },
    ]);
    writeStatus(root, "projects/proj-building", ["phase: implementation"]);
    // proj-ghost has no .pandacorp/status.yaml at all.

    const health = await withFactoryRoot(root, () => memoryHealth());

    expect(health.harvestOrphans).toEqual([]);
  });
});
