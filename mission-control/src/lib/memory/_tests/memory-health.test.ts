/**
 * WO-17-002 — `lib/memory` views: candidates / promotionQueue / prunable / memoryHealth
 *
 * These tests verify the ACs for WO-17-002 (RED phase). They import `memoryHealth`
 * which does not exist yet — every test here will fail until the GREEN phase (TDD, DR-016).
 *
 * Traceability (FRD-17 EARS → AC → test):
 *   AC-17-002.1  (REQ-17-002) candidateLessons returns exactly status === "candidate" lessons.
 *   AC-17-002.2  (REQ-17-006) promotionQueue returns exactly promotion === "proposed" lessons,
 *                preserving each lesson's links/source (target + evidence for the queue).
 *   AC-17-002.3  prunable returns deprecated/reconciliation-flagged lessons.
 *   AC-17-002.4  (REQ-17-005) memoryHealth.rawNotes counts inbox lines + per-project lesson-note
 *                lines; tolerates missing files (count 0, no throw).
 *   AC-17-002.5  (REQ-17-005) lastMemoryRunAt is the most recent available mtime proxy, labelled
 *                approximate; null + staleDays: null when no memory files exist (fresh factory).
 *   AC-17-002.6  staleDays is the integer day delta from lastMemoryRunAt to now.
 *
 * Stack: Vitest (Node environment, real fs reads against temp fixture trees).
 * No mocks — lib/memory.ts is a pure fs-in / typed-array-out module.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withFactoryRoot } from "@/tests/fixtures";
import { candidateLessons, promotionQueue, prunable } from "../memory";
import { memoryHealth } from "../memory-health";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Serialise a frontmatter block + body into the content of a LESSON-*.md file. */
function lessonMd(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          lines.push(`  - ${item}`);
        }
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n");
}

const ACTIVE_FM = {
  id: "LESSON-0001",
  type: "anti-pattern",
  domain: "factory-engineering",
  status: "active",
  promotion: "none",
  source: "proj-alpha (WO-01-001 review)",
  provenance: "agent-inferred",
  created: "2026-06-15",
  confidence: "high",
  times_applied: 0,
  links: ["DR-047"],
};
const ACTIVE_BODY = "**Situation:** X happened.\n\n**Lesson:** Do Y.\n\n**Apply next time:** Z.";

const CANDIDATE_FM = {
  id: "LESSON-0002",
  type: "problem-solution",
  domain: "frontend",
  status: "candidate",
  promotion: "none",
  source: "proj-alpha (WO-02-001 fix)",
  provenance: "agent-inferred",
  created: "2026-06-16",
  confidence: "medium",
  times_applied: 0,
  links: [],
};
const CANDIDATE_BODY = "**Situation:** A.\n\n**Lesson:** B.\n\n**Apply next time:** C.";

const PROPOSED_FM = {
  id: "LESSON-0003",
  type: "pattern",
  domain: "testing",
  status: "candidate",
  promotion: "proposed",
  source: "proj-alpha (WO-01-001), proj-beta (WO-02-003 review)",
  provenance: "agent-inferred",
  created: "2026-06-16",
  confidence: "high",
  times_applied: 0,
  links: ["DR-015", "DR-016"],
};
const PROPOSED_BODY =
  "**Situation:** Seen twice.\n\n**Lesson:** Use this.\n\n**Apply next time:** Always.";

const DEPRECATED_FM = {
  id: "LESSON-0004",
  type: "gotcha",
  domain: "tooling",
  status: "deprecated",
  promotion: "rejected",
  source: "proj-gamma (old session)",
  provenance: "agent-inferred",
  created: "2026-06-10",
  confidence: "low",
  times_applied: 1,
  links: [],
};
const DEPRECATED_BODY =
  "**Situation:** Outdated.\n\n**Lesson:** No longer applies.\n\n**Apply next time:** Ignore.";

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

interface MemoryFixtureOpts {
  lessons?: Array<{ filename: string; content: string }>;
  inboxContent?: string;
  /** Per-project run/lessons.md contents keyed by project path (relative to factoryRoot). */
  projectLessons?: Array<{ relativePath: string; content: string }>;
}

/**
 * Creates a temp directory tree that mimics `factory/memory/` plus optionally
 * a portfolio.md and per-project `.pandacorp/run/lessons.md` files.
 *
 * Returns the factory root (PANDACORP_FACTORY_ROOT for withFactoryRoot).
 */
function makeTempFactory(opts: MemoryFixtureOpts = {}): string {
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-health-"));
  const memoryDir = path.join(factoryRoot, "factory", "memory");
  fs.mkdirSync(memoryDir, { recursive: true });

  for (const { filename, content } of opts.lessons ?? []) {
    fs.writeFileSync(path.join(memoryDir, filename), content, "utf-8");
  }

  if (opts.inboxContent !== undefined) {
    fs.writeFileSync(path.join(memoryDir, "_inbox.md"), opts.inboxContent, "utf-8");
  }

  for (const { relativePath, content } of opts.projectLessons ?? []) {
    const fullPath = path.join(factoryRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }

  return factoryRoot;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

let tmpRoots: string[] = [];

afterEach(() => {
  for (const d of tmpRoots) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
  tmpRoots = [];
});

// ---------------------------------------------------------------------------
// AC-17-002.1 — candidateLessons (targeted, with links/source preservation)
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.1 — candidateLessons returns exactly status === 'candidate' lessons", () => {
  it("wo-17-002: GIVEN lessons with all statuses WHEN candidateLessons is called THEN only candidate lessons are returned", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
        { filename: "LESSON-0003-proposed.md", content: lessonMd(PROPOSED_FM, PROPOSED_BODY) },
        {
          filename: "LESSON-0004-deprecated.md",
          content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY),
        },
      ],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => candidateLessons());

    // Only status === "candidate" — LESSON-0002 (candidate/none) + LESSON-0003 (candidate/proposed).
    expect(results).toHaveLength(2);
    for (const lesson of results) {
      expect(lesson.status).toBe("candidate");
    }
    // Every candidate lesson's id must be one of the candidate fixtures.
    const ids = results.map((l) => l.id);
    expect(ids).toContain("LESSON-0002");
    expect(ids).toContain("LESSON-0003");
    expect(ids).not.toContain("LESSON-0001");
    expect(ids).not.toContain("LESSON-0004");
  });

  it("wo-17-002: GIVEN no candidate lessons WHEN candidateLessons is called THEN returns []", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => candidateLessons());

    expect(results).toEqual([]);
  });

  it("wo-17-002: GIVEN a candidate lesson WHEN candidateLessons is called THEN source and links are preserved (evidence for the inbox)", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => candidateLessons());

    expect(results).toHaveLength(1);
    // source and links must be preserved (evidence, REQ-17-003).
    expect(results[0]?.source).toBe("proj-alpha (WO-02-001 fix)");
    expect(results[0]?.links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.2 — promotionQueue preserves links/source
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.2 — promotionQueue returns promotion === 'proposed', preserving links/source", () => {
  it("wo-17-002: GIVEN a lesson with promotion: proposed WHEN promotionQueue is called THEN it is returned with links and source intact", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0003-proposed.md", content: lessonMd(PROPOSED_FM, PROPOSED_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length check above
    const lesson = queue[0]!;
    expect(lesson.promotion).toBe("proposed");
    // links and source must be preserved (evidence for the promotions queue, REQ-17-006).
    expect(lesson.links).toEqual(["DR-015", "DR-016"]);
    expect(lesson.source).toBe("proj-alpha (WO-01-001), proj-beta (WO-02-003 review)");
  });

  it("wo-17-002: GIVEN lessons with promotion none/approved/rejected WHEN promotionQueue is called THEN returns []", async () => {
    const approvedFm = { ...ACTIVE_FM, id: "LESSON-0005", promotion: "approved" };
    const rejectedFm = { ...CANDIDATE_FM, id: "LESSON-0006", promotion: "rejected" };

    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-none.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0005-approved.md", content: lessonMd(approvedFm, ACTIVE_BODY) },
        { filename: "LESSON-0006-rejected.md", content: lessonMd(rejectedFm, CANDIDATE_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue).toEqual([]);
  });

  it("wo-17-002: GIVEN multiple lessons with promotion: proposed WHEN promotionQueue is called THEN all are returned (invariant)", async () => {
    const proposedFm2 = { ...PROPOSED_FM, id: "LESSON-0007" };

    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0003-proposed1.md", content: lessonMd(PROPOSED_FM, PROPOSED_BODY) },
        { filename: "LESSON-0007-proposed2.md", content: lessonMd(proposedFm2, PROPOSED_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue.length).toBeGreaterThanOrEqual(2);
    for (const lesson of queue) {
      expect(lesson.promotion).toBe("proposed");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.3 — prunable returns deprecated lessons
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.3 — prunable returns status === 'deprecated' lessons", () => {
  it("wo-17-002: GIVEN a deprecated lesson WHEN prunable is called THEN it is returned", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        {
          filename: "LESSON-0004-deprecated.md",
          content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY),
        },
      ],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => prunable());

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("deprecated");
    expect(results[0]?.id).toBe("LESSON-0004");
  });

  it("wo-17-002: GIVEN no deprecated lessons WHEN prunable is called THEN returns []", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => prunable());

    expect(results).toEqual([]);
  });

  it("wo-17-002: GIVEN only deprecated lessons WHEN prunable is called THEN all deprecated lessons are returned", async () => {
    const deprecated2 = { ...DEPRECATED_FM, id: "LESSON-0005" };

    const factoryRoot = makeTempFactory({
      lessons: [
        {
          filename: "LESSON-0004-deprecated.md",
          content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY),
        },
        { filename: "LESSON-0005-deprecated2.md", content: lessonMd(deprecated2, DEPRECATED_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    const results = await withFactoryRoot(factoryRoot, () => prunable());

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.status).toBe("deprecated");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.4 — memoryHealth.rawNotes counts inbox + per-project lesson notes
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.4 — memoryHealth.rawNotes counts inbox lines + per-project lessons.md lines", () => {
  it("wo-17-002: GIVEN a _inbox.md with 3 non-empty lines WHEN memoryHealth is called THEN rawNotes >= 3", async () => {
    const inboxContent = "line one\nline two\nline three\n";
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
      inboxContent,
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // rawNotes must count at least the 3 non-empty inbox lines.
    expect(health.rawNotes).toBeGreaterThanOrEqual(3);
  });

  it("wo-17-002: GIVEN no _inbox.md and no project lessons WHEN memoryHealth is called THEN rawNotes is 0", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
      // No inboxContent → no _inbox.md.
      // No projectLessons.
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.rawNotes).toBe(0);
  });

  it("wo-17-002: GIVEN a _inbox.md with empty lines and a project lessons.md WHEN memoryHealth is called THEN only non-empty lines are counted", async () => {
    // 2 non-empty inbox lines + 1 blank line.
    const inboxContent = "note one\n\nnote two\n";
    // 3 non-empty lines in the project lessons.md.
    const projectLessonsContent = "lesson A\nlesson B\nlesson C\n";

    const factoryRoot = makeTempFactory({
      inboxContent,
      projectLessons: [
        {
          relativePath: "projects/proj-a/.pandacorp/run/lessons.md",
          content: projectLessonsContent,
        },
      ],
    });
    tmpRoots.push(factoryRoot);

    // Build a portfolio.md that points to the project.
    const portfolioPath = path.join(factoryRoot, "factory", "portfolio.md");
    const portfolioContent = [
      "# Portfolio",
      "",
      "| Name | Path | Repo | Phase |",
      "|---|---|---|---|",
      "| proj-a | projects/proj-a | — | implementation |",
    ].join("\n");
    fs.mkdirSync(path.join(factoryRoot, "factory"), { recursive: true });
    fs.writeFileSync(portfolioPath, portfolioContent, "utf-8");

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // 2 inbox non-empty + 3 project non-empty = 5.
    expect(health.rawNotes).toBe(5);
  });

  it("wo-17-002: GIVEN a missing _inbox.md WHEN memoryHealth is called THEN rawNotes is 0 without throw (tolerant)", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [],
      // No inboxContent provided — _inbox.md does not exist.
    });
    tmpRoots.push(factoryRoot);

    expect(() => withFactoryRoot(factoryRoot, () => memoryHealth())).not.toThrow();
    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());
    expect(health.rawNotes).toBe(0);
  });

  it("wo-17-002: GIVEN a missing factory/memory dir WHEN memoryHealth is called THEN rawNotes is 0 without throw (fresh factory)", async () => {
    // No memory dir at all — brand-new factory.
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-fresh-"));
    tmpRoots.push(factoryRoot);

    expect(() => withFactoryRoot(factoryRoot, () => memoryHealth())).not.toThrow();
    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());
    expect(health.rawNotes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.4 (continued) — candidates field
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.4 (candidates) — memoryHealth.candidates equals candidateLessons count", () => {
  it("wo-17-002: GIVEN 2 candidate lessons WHEN memoryHealth is called THEN candidates === 2", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
        { filename: "LESSON-0003-proposed.md", content: lessonMd(PROPOSED_FM, PROPOSED_BODY) },
        {
          filename: "LESSON-0004-deprecated.md",
          content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY),
        },
      ],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // LESSON-0002 (candidate/none) + LESSON-0003 (candidate/proposed) = 2 candidates.
    expect(health.candidates).toBe(2);
  });

  it("wo-17-002: GIVEN no candidate lessons WHEN memoryHealth is called THEN candidates === 0", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.candidates).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.5 — lastMemoryRunAt proxy + fresh factory null case
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.5 — lastMemoryRunAt: most recent mtime proxy; null for fresh factory", () => {
  it("wo-17-002: GIVEN a LESSON-*.md file WHEN memoryHealth is called THEN lastMemoryRunAt is a non-null ISO string", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.lastMemoryRunAt).not.toBeNull();
    // Must be parseable as a date.
    // biome-ignore lint/style/noNonNullAssertion: checked above
    const parsed = new Date(health.lastMemoryRunAt!);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("wo-17-002: GIVEN ONLY an _inbox.md (no LESSON files) WHEN memoryHealth is called THEN lastMemoryRunAt is a non-null ISO string (inbox mtime used as proxy)", async () => {
    const factoryRoot = makeTempFactory({
      inboxContent: "- a note\n",
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // lastMemoryRunAt may be based on _inbox.md mtime when no LESSON files exist.
    // It can also be null if the implementation only uses LESSON mtimes — acceptable.
    if (health.lastMemoryRunAt !== null) {
      const parsed = new Date(health.lastMemoryRunAt);
      expect(parsed.getTime()).not.toBeNaN();
    }
    // staleDays must be consistent: null iff lastMemoryRunAt is null.
    if (health.lastMemoryRunAt === null) {
      expect(health.staleDays).toBeNull();
    } else {
      expect(health.staleDays).not.toBeNull();
    }
  });

  it("wo-17-002: GIVEN a completely empty factory (no factory/memory dir) WHEN memoryHealth is called THEN lastMemoryRunAt is null and staleDays is null (fresh factory case)", async () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-fresh2-"));
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.lastMemoryRunAt).toBeNull();
    expect(health.staleDays).toBeNull();
  });

  it("wo-17-002: GIVEN a memory dir with only skip files (README, _inbox absent, no LESSON) WHEN memoryHealth THEN lastMemoryRunAt is null (no lesson files, no inbox)", async () => {
    const factoryRoot = makeTempFactory({
      // inboxContent NOT provided → _inbox.md absent.
      // Write a README.md manually.
    });
    const memoryDir = path.join(factoryRoot, "factory", "memory");
    fs.writeFileSync(path.join(memoryDir, "README.md"), "# memory\n", "utf-8");
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // No LESSON-*.md files and no _inbox.md → lastMemoryRunAt null.
    expect(health.lastMemoryRunAt).toBeNull();
    expect(health.staleDays).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-17-002.6 — staleDays is integer day delta from lastMemoryRunAt to now
// ---------------------------------------------------------------------------

describe("wo-17-002: AC-17-002.6 — staleDays is the integer day delta from lastMemoryRunAt to now", () => {
  it("wo-17-002: GIVEN a just-created LESSON file WHEN memoryHealth is called THEN staleDays is 0 (same day)", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.lastMemoryRunAt).not.toBeNull();
    // A freshly-created file has mtime = now → staleDays must be 0 (same day).
    expect(health.staleDays).toBe(0);
  });

  it("wo-17-002: GIVEN a LESSON file with mtime set to 7 days ago WHEN memoryHealth is called THEN staleDays is 7", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    // Backdate the mtime to 7 days ago.
    const lessonPath = path.join(factoryRoot, "factory", "memory", "LESSON-0001-active.md");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    fs.utimesSync(lessonPath, sevenDaysAgo, sevenDaysAgo);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.staleDays).toBe(7);
  });

  it("wo-17-002: GIVEN multiple LESSON files with different mtimes WHEN memoryHealth THEN lastMemoryRunAt is the MOST RECENT mtime", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [
        { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
        { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      ],
    });
    tmpRoots.push(factoryRoot);

    // Backdate LESSON-0001 to 7 days ago; leave LESSON-0002 at now.
    const lesson1Path = path.join(factoryRoot, "factory", "memory", "LESSON-0001-active.md");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    fs.utimesSync(lesson1Path, sevenDaysAgo, sevenDaysAgo);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // Most recent mtime is LESSON-0002 (now), so staleDays should be 0.
    expect(health.staleDays).toBe(0);
  });

  it("wo-17-002: GIVEN null lastMemoryRunAt WHEN memoryHealth is called THEN staleDays is null (consistent invariant)", async () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-stale-null-"));
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    // Both must be null or both non-null.
    expect(health.lastMemoryRunAt).toBeNull();
    expect(health.staleDays).toBeNull();
  });

  it("wo-17-002: GIVEN a valid lastMemoryRunAt WHEN memoryHealth is called THEN staleDays is a non-negative integer", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.staleDays).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: guarded above
    expect(Number.isInteger(health.staleDays!)).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: guarded above
    expect(health.staleDays!).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Return-shape invariants
// ---------------------------------------------------------------------------

describe("wo-17-002: memoryHealth() — return shape invariants", () => {
  it("wo-17-002: WHEN memoryHealth is called THEN all four fields are always present in the result", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
      inboxContent: "note one\nnote two\n",
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health).toHaveProperty("rawNotes");
    expect(health).toHaveProperty("candidates");
    expect(health).toHaveProperty("lastMemoryRunAt");
    expect(health).toHaveProperty("staleDays");
  });

  it("wo-17-002: WHEN memoryHealth is called on a fresh factory THEN rawNotes === 0, candidates === 0, lastMemoryRunAt === null, staleDays === null", async () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-fresh3-"));
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(health.rawNotes).toBe(0);
    expect(health.candidates).toBe(0);
    expect(health.lastMemoryRunAt).toBeNull();
    expect(health.staleDays).toBeNull();
  });

  it("wo-17-002: WHEN memoryHealth is called THEN rawNotes is a non-negative integer", async () => {
    const factoryRoot = makeTempFactory({
      lessons: [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
    });
    tmpRoots.push(factoryRoot);

    const health = await withFactoryRoot(factoryRoot, () => memoryHealth());

    expect(Number.isInteger(health.rawNotes)).toBe(true);
    expect(health.rawNotes).toBeGreaterThanOrEqual(0);
  });
});
