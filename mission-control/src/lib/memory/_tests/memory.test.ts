/**
 * WO-17-001 — `lib/memory` lesson reader (RED phase)
 *
 * Tests are written BEFORE the implementation (`lib/memory.ts` does not exist yet).
 * Every test below will fail until the GREEN phase; that is the intent (TDD, DR-016).
 *
 * Traceability (FRD-17 EARS → AC → test):
 *   AC-17-001.1  GIVEN fixture lessons, readLessons() returns one Lesson per LESSON-*.md,
 *                with frontmatter mapped and the body captured.
 *   AC-17-001.2  Templates (_lesson-template.md) / README.md / _inbox.md are skipped.
 *   AC-17-001.3  A lesson missing optional fields (links, promotion) defaults safely
 *                (promotion: "none", links: []); malformed frontmatter → file skipped, no throw.
 *   AC-17-001.4  evalGate === "corroborated" for status: active; "awaiting-2nd" for a
 *                single-project status: candidate lesson.
 *   AC-17-001.5  projects parses ≥2 distinct projects from a multi-project source and,
 *                when the format is ambiguous, yields a conservative count (no over-count)
 *                — anchored to LESSON-0001.
 *
 * Derived views (REQ-17-002, blueprint §3):
 *   candidateLessons()  — status === "candidate" subset.
 *   promotionQueue()    — promotion === "proposed" subset.
 *   prunable()          — status === "deprecated" subset.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real incidents → regression tests):
 *   gray-matter cache bug (2026-06-16): gray-matter@4 caches by content; a malformed YAML
 *     that threw on first parse can still populate the cache and return {} on the second call.
 *     Fix: pass { excerpt: false } to bypass the cache on every call. Tests below verify that
 *     a malformed lesson does NOT produce a ghost entry and that the adjacent valid lesson IS
 *     returned (catches the cache-pollutes-neighbor failure mode).
 *   B1' (2026-06-16): typeof NaN === "number" passes numeric type guards silently. The
 *     `times_applied` field is numeric; any non-finite / NaN value must not pollute the
 *     Lesson object as a valid number. The evalGate derivation must not yield "corroborated"
 *     when projects.length is NaN-coerced.
 *   I2 (2026-06-16): empty-object/array inputs satisfy collection guards vacuously. An empty
 *     `links:` list in frontmatter must produce `links: []`, not undefined.
 *   I3 (2026-06-16): array-shaped objects fool typeof checks. The `source` field is a string;
 *     if it is somehow parsed as an array (e.g. YAML block sequence), the reader must not
 *     expose it as-is — it must coerce to string or treat it as unparseable.
 *   prototype-pollution (2026-06-16, rate.ts adversarial): LESSON file names whose ids match
 *     Object prototype keys ("constructor", "toString") must not corrupt the result set.
 *   WO-01-001 review: any fs read must be wrapped defensively; a non-existent MEMORY_DIR
 *     must return [] without throwing.
 *
 * Property-based tests (fast-check not yet a dep — inline generators cover invariants):
 *   - readLessons() count must equal the number of LESSON-*.md files (no extra, no missing).
 *   - evalGate must be exactly one of the two valid literals for every returned Lesson.
 *   - promotion must be exactly one of the four valid PromotionState literals.
 *
 * Stack: Vitest (Node environment, real fs reads against temp fixture trees).
 * No mocks — lib/memory.ts is a pure fs-in / typed-array-out module.
 * No network calls; no writes to disk (read-only invariant, FRD-17 non-goal).
 * Tests are fully isolated: each uses its own temp dir, cleaned up in afterEach.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withFactoryRoot } from "@/tests/fixtures";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase).
// ---------------------------------------------------------------------------
import { candidateLessons, promotionQueue, prunable, readLessons } from "../memory";

// ---------------------------------------------------------------------------
// Types (mirror blueprint §3 IF-17-memory; kept local so tests are self-contained).
// The module exports these — tests will break if the shapes diverge.
// ---------------------------------------------------------------------------

type PromotionState = "none" | "proposed" | "approved" | "rejected";
type LessonStatus = "candidate" | "active" | "deprecated";
type EvalGate = "corroborated" | "awaiting-2nd";

// biome-ignore lint/correctness/noUnusedVariables: mirrors the module's exported Lesson type — structural documentation anchor
type Lesson = {
  id: string;
  type: string;
  domain: string;
  status: LessonStatus;
  promotion: PromotionState;
  source: string;
  links: string[];
  projects: string[];
  body: string;
  evalGate: EvalGate;
};

// ---------------------------------------------------------------------------
// Fixture factory helpers
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

/** Minimal valid active lesson frontmatter. */
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

/** Minimal valid candidate lesson frontmatter (single project). */
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

const CANDIDATE_BODY = "**Situation:** A happened.\n\n**Lesson:** B.\n\n**Apply next time:** C.";

/** Multi-project lesson (two distinct projects in source → evalGate: "corroborated"). */
const MULTI_PROJECT_FM = {
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

const MULTI_PROJECT_BODY =
  "**Situation:** Seen twice.\n\n**Lesson:** Use this.\n\n**Apply next time:** Always.";

/** Deprecated lesson (for prunable()). */
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

/**
 * Creates a temp directory tree that mimics `factory/memory/` with a given
 * set of LESSON files and optionally skeleton files (template, README, _inbox).
 * Returns the factory root (one level above the memory dir, matching PANDACORP_FACTORY_ROOT).
 */
function makeTempMemoryDir(
  lessons: Array<{ filename: string; content: string }>,
  opts: { includeTemplate?: boolean; includeReadme?: boolean; includeInbox?: boolean } = {},
): string {
  // factory root → factory/memory/
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-memory-test-"));
  const memoryDir = path.join(factoryRoot, "factory", "memory");
  fs.mkdirSync(memoryDir, { recursive: true });

  for (const { filename, content } of lessons) {
    fs.writeFileSync(path.join(memoryDir, filename), content, "utf-8");
  }

  if (opts.includeTemplate) {
    fs.writeFileSync(
      path.join(memoryDir, "_lesson-template.md"),
      lessonMd(
        {
          id: "LESSON-NNNN",
          type: "problem-solution",
          domain: "<area>",
          status: "candidate",
          promotion: "none",
          source: "<ref>",
          provenance: "agent-inferred",
          created: "YYYY-MM-DD",
          confidence: "medium",
          times_applied: 0,
          links: [],
        },
        "**Situation:**\n\n**Lesson:**\n\n**Apply next time:**",
      ),
    );
  }

  if (opts.includeReadme) {
    fs.writeFileSync(
      path.join(memoryDir, "README.md"),
      "# factory/memory — engineering memory\n\nThis folder stores durable lessons.\n",
    );
  }

  if (opts.includeInbox) {
    fs.writeFileSync(
      path.join(memoryDir, "_inbox.md"),
      "# Raw lesson inbox\n\n- [2026-06-16] (agent-inferred) gotcha · some issue.\n",
    );
  }

  return factoryRoot;
}

// ---------------------------------------------------------------------------
// Teardown — remove every temp dir created during a test.
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
// AC-17-001.1 — GIVEN fixture lessons, readLessons returns one Lesson per LESSON-*.md
// ---------------------------------------------------------------------------

describe("frd-17: AC-17-001.1 — readLessons returns one Lesson per LESSON-*.md with full mapping", () => {
  it("frd-17: WHEN memory dir has one active LESSON-*.md THEN readLessons returns one Lesson with all fields mapped", async () => {
    const factoryRoot = makeTempMemoryDir([
      {
        filename: "LESSON-0001-anti-pattern-reflection.md",
        content: lessonMd(ACTIVE_FM, ACTIVE_BODY),
      },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by the length check above
    const lesson = lessons[0]!;
    expect(lesson.id).toBe("LESSON-0001");
    expect(lesson.type).toBe("anti-pattern");
    expect(lesson.domain).toBe("factory-engineering");
    expect(lesson.status).toBe("active");
    expect(lesson.promotion).toBe("none");
    expect(lesson.source).toBe("proj-alpha (WO-01-001 review)");
    expect(lesson.links).toEqual(["DR-047"]);
    expect(lesson.body).toContain("**Situation:**");
    expect(lesson.body).toContain("**Lesson:**");
    expect(lesson.body).toContain("**Apply next time:**");
  });

  it("frd-17: WHEN memory dir has multiple LESSON-*.md files THEN count equals the number of files", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      {
        filename: "LESSON-0003-multiproject.md",
        content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY),
      },
      { filename: "LESSON-0004-deprecated.md", content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(4);
  });

  it("frd-17: WHEN memory dir has no LESSON-*.md files THEN readLessons returns []", async () => {
    const factoryRoot = makeTempMemoryDir([], {
      includeTemplate: true,
      includeReadme: true,
      includeInbox: true,
    });
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN memory dir has a LESSON file, readLessons does NOT fabricate extra entries (count invariant)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-only.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-second.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // Exactly 2 LESSON-*.md files → exactly 2 lessons (invariant: no ghosts).
    expect(lessons.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.2 — Templates / README.md / _inbox.md are skipped
// ---------------------------------------------------------------------------

describe("frd-17: AC-17-001.2 — skipped files: _lesson-template.md, README.md, _inbox.md", () => {
  it("frd-17: WHEN memory dir has ONLY _lesson-template.md THEN readLessons returns []", async () => {
    const factoryRoot = makeTempMemoryDir([], { includeTemplate: true });
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN memory dir has ONLY README.md THEN readLessons returns []", async () => {
    const factoryRoot = makeTempMemoryDir([], { includeReadme: true });
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN memory dir has ONLY _inbox.md THEN readLessons returns []", async () => {
    const factoryRoot = makeTempMemoryDir([], { includeInbox: true });
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN memory dir has one LESSON and all three skip-files THEN readLessons returns exactly 1 lesson (skip-files excluded)", async () => {
    const factoryRoot = makeTempMemoryDir(
      [{ filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) }],
      { includeTemplate: true, includeReadme: true, includeInbox: true },
    );
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.id).toBe("LESSON-0001");
  });

  it("frd-17: WHEN a file is named LESSON-like but is actually _inbox.md THEN it is skipped", async () => {
    // Confirm the exact name `_inbox.md` is always excluded regardless of content.
    const factoryRoot = makeTempMemoryDir([
      { filename: "_inbox.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.3 — Missing optional fields default safely; malformed frontmatter → skip
// ---------------------------------------------------------------------------

describe("frd-17: AC-17-001.3 — optional-field defaults and malformed-file tolerance", () => {
  it("frd-17: WHEN a lesson has no 'promotion' field THEN promotion defaults to 'none'", async () => {
    const fm = { ...ACTIVE_FM };
    const { promotion: _, ...fmWithoutPromotion } = fm;

    const factoryRoot = makeTempMemoryDir([
      {
        filename: "LESSON-0001-nopromotion.md",
        content: lessonMd(fmWithoutPromotion, ACTIVE_BODY),
      },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.promotion).toBe("none");
  });

  it("frd-17: WHEN a lesson has no 'links' field THEN links defaults to []", async () => {
    const fm = { ...ACTIVE_FM };
    const { links: _, ...fmWithoutLinks } = fm;

    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-nolinks.md", content: lessonMd(fmWithoutLinks, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.links).toEqual([]);
  });

  it("frd-17: WHEN a lesson has empty links: [] in frontmatter THEN links is [] (regression I2: empty array guard)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0002-emptylinks.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.links).toEqual([]);
    expect(Array.isArray(lessons[0]?.links)).toBe(true);
  });

  it("frd-17: WHEN a lesson has malformed YAML frontmatter THEN that file is skipped, no throw", async () => {
    const malformedContent = "---\nid: LESSON-9999\nstatus: [unclosed bracket\n---\n\nBody text.";
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-9999-malformed.md", content: malformedContent },
    ]);
    tmpRoots.push(factoryRoot);

    expect(() => withFactoryRoot(factoryRoot, () => readLessons())).not.toThrow();
    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());
    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN one lesson is malformed and one is valid THEN only the valid lesson is returned (per-card catch, not batch throw)", async () => {
    const malformedContent = "---\nid: LESSON-9999\nstatus: [unclosed\n---\n\nBody.";
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-valid.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-9999-malformed.md", content: malformedContent },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.id).toBe("LESSON-0001");
  });

  it("frd-17: WHEN malformed and valid files are processed, valid file is NOT corrupted by malformed neighbor (regression: gray-matter cache pollution)", async () => {
    // gray-matter@4 caches by content string; a malformed parse that threw can
    // leave {} in the cache. If the reader calls matter() without { excerpt: false },
    // the adjacent valid call may silently return a stale result.
    // This test catches that: the valid lesson must have ALL its expected fields intact.
    const malformedContent = "---\nthis: is: not: valid: yaml\n---\n\nBody.";
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-valid.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0099-malformed.md", content: malformedContent },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by the length check above
    const lesson = lessons[0]!;
    // All fields of the valid lesson must be intact — not defaulted to {} remnants.
    expect(lesson.id).toBe("LESSON-0001");
    expect(lesson.status).toBe("active");
    expect(lesson.type).toBe("anti-pattern");
    expect(lesson.source).toBe("proj-alpha (WO-01-001 review)");
    expect(lesson.links).toEqual(["DR-047"]);
  });

  it("frd-17: WHEN a LESSON file is completely empty THEN it is skipped without throw", async () => {
    const factoryRoot = makeTempMemoryDir([{ filename: "LESSON-0001-empty.md", content: "" }]);
    tmpRoots.push(factoryRoot);

    expect(() => withFactoryRoot(factoryRoot, () => readLessons())).not.toThrow();
    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());
    expect(lessons).toEqual([]);
  });

  it("frd-17: WHEN factory/memory/ does not exist THEN readLessons returns [] without throw (regression: WO-01-001 ENOENT guard)", async () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-memory-nodir-"));
    tmpRoots.push(factoryRoot);
    // Intentionally do NOT create factory/memory/ inside factoryRoot.

    expect(() => withFactoryRoot(factoryRoot, () => readLessons())).not.toThrow();
    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());
    expect(lessons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.4 — evalGate derivation
// ---------------------------------------------------------------------------

describe("frd-17: AC-17-001.4 — evalGate is 'corroborated' for active; 'awaiting-2nd' for single-project candidate", () => {
  it("frd-17: WHEN status is 'active' THEN evalGate is 'corroborated'", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.status).toBe("active");
    expect(lessons[0]?.evalGate).toBe("corroborated");
  });

  it("frd-17: WHEN status is 'candidate' and source references a single project THEN evalGate is 'awaiting-2nd'", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.status).toBe("candidate");
    expect(lessons[0]?.evalGate).toBe("awaiting-2nd");
  });

  it("frd-17: WHEN status is 'candidate' and ≥2 distinct projects appear in source THEN evalGate is 'corroborated'", async () => {
    const factoryRoot = makeTempMemoryDir([
      {
        filename: "LESSON-0003-multiproject.md",
        content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY),
      },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.status).toBe("candidate");
    expect(lessons[0]?.evalGate).toBe("corroborated");
    expect(lessons[0]?.projects.length).toBeGreaterThanOrEqual(2);
  });

  it("frd-17: WHEN status is 'deprecated' THEN evalGate follows the same rule (active-like or source-based)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0004-deprecated.md", content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // evalGate must be one of the two valid literals — never undefined or a third value.
    expect(["corroborated", "awaiting-2nd"]).toContain(lessons[0]?.evalGate);
  });

  it("frd-17: WHEN evalGate is derived, it is always exactly one of the two literals for every lesson (invariant)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      { filename: "LESSON-0003-multi.md", content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY) },
      { filename: "LESSON-0004-deprecated.md", content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    for (const lesson of lessons) {
      expect(["corroborated", "awaiting-2nd"]).toContain(lesson.evalGate);
    }
  });

  it("frd-17: WHEN projects.length is 0 (source is empty string) THEN evalGate is 'awaiting-2nd' and never NaN-coerced (regression B1')", async () => {
    const fm = { ...CANDIDATE_FM, source: "" };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0002-nosource.md", content: lessonMd(fm, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    // projects.length >= 2 must be a real boolean comparison, not NaN >= 2 (which is false but from NaN).
    expect(lessons[0]?.evalGate).toBe("awaiting-2nd");
    expect(lessons[0]?.projects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.5 — projects parsing (multi-project source, conservative count)
// ---------------------------------------------------------------------------

describe("frd-17: AC-17-001.5 — projects: parsed from source, conservative on ambiguity", () => {
  it("frd-17: WHEN source is 'proj-alpha (WO-01-001 review)' THEN projects contains 'proj-alpha' (single project)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-single.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.projects).toHaveLength(1);
    expect(lessons[0]?.projects[0]).toBe("proj-alpha");
  });

  it("frd-17: WHEN source is 'proj-alpha (WO-01-001), proj-beta (WO-02-003 review)' THEN projects has exactly 2 distinct entries", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0003-multi.md", content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons[0]?.projects).toHaveLength(2);
    expect(lessons[0]?.projects).toContain("proj-alpha");
    expect(lessons[0]?.projects).toContain("proj-beta");
  });

  it("frd-17: WHEN source references the same project name twice THEN projects deduplicates (distinct count)", async () => {
    const fm = {
      ...MULTI_PROJECT_FM,
      source: "proj-alpha (WO-01-001), proj-alpha (WO-02-003)",
    };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0003-dupe.md", content: lessonMd(fm, MULTI_PROJECT_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // The same project name appears twice — conservative count: 1 distinct project.
    expect(lessons[0]?.projects).toHaveLength(1);
    expect(lessons[0]?.projects[0]).toBe("proj-alpha");
  });

  it("frd-17: WHEN source references LESSON-0001 real format ('docs/proposals/09-self-learning-factory.md') THEN does not over-count (conservative)", async () => {
    // Anchored to the real LESSON-0001 in factory/memory/ (blueprint §6 note).
    // The source is a doc ref, not a project name — parser must not invent project counts.
    const fm = {
      ...ACTIVE_FM,
      id: "LESSON-0001",
      source:
        "docs/proposals/09-self-learning-factory.md (deep-research 2026-06-15; ExpeL, arXiv:2308.10144)",
    };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-docref.md", content: lessonMd(fm, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    expect(lessons).toHaveLength(1);
    // A doc-ref source with no recognizable project names → projects is [] or at most 1.
    // It must NEVER yield 2+ (which would falsely corroborate via projects.length >= 2).
    expect(lessons[0]?.projects.length).toBeLessThanOrEqual(1);
  });

  it("frd-17: WHEN source is ambiguous (no clear project pattern) THEN conservative parse yields at most 1 (never auto-promotes via false 2-project count)", async () => {
    const fm = {
      ...CANDIDATE_FM,
      source: "some ambiguous reference without a clear project comma",
    };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0002-ambiguous.md", content: lessonMd(fm, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // Conservative: ambiguous sources must not fabricate a 2nd project.
    expect(lessons[0]?.projects?.length).toBeLessThanOrEqual(1);
    // If 1 project was parsed, evalGate stays awaiting-2nd (candidate + single project).
    if ((lessons[0]?.projects?.length ?? 0) < 2) {
      expect(lessons[0]?.evalGate).toBe("awaiting-2nd");
    }
  });

  it("frd-17: WHEN source field is parsed as an array by YAML (YAML block sequence) THEN reader does not expose raw array; coerces to string or skips (regression I3)", async () => {
    // If YAML parses `source` as a sequence (e.g. `source:\n  - item1\n  - item2`),
    // the reader must NOT return it as `string[]` for the `source` field (which is typed string).
    const yamlArraySource =
      "---\nid: LESSON-0001\ntype: anti-pattern\ndomain: test\nstatus: active\npromotion: none\nsource:\n  - proj-alpha\n  - proj-beta\nprovenance: agent-inferred\ncreated: 2026-06-16\nconfidence: high\ntimes_applied: 0\nlinks: []\n---\n\n**Situation:** X.\n\n**Lesson:** Y.\n\n**Apply next time:** Z.";

    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-arraysource.md", content: yamlArraySource },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // Either: lesson is skipped (malformed) OR lesson.source is a string (coerced).
    if (lessons.length > 0) {
      expect(typeof lessons[0]?.source).toBe("string");
    }
    // No throw is the primary invariant.
    expect(() => withFactoryRoot(factoryRoot, () => readLessons())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Derived views: candidateLessons(), promotionQueue(), prunable()
// ---------------------------------------------------------------------------

describe("frd-17: candidateLessons() — filters to status === 'candidate'", () => {
  it("frd-17: WHEN there are active, candidate, and deprecated lessons THEN candidateLessons returns only candidate ones", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      { filename: "LESSON-0003-multi.md", content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY) },
      { filename: "LESSON-0004-deprecated.md", content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const candidates = await withFactoryRoot(factoryRoot, () => candidateLessons());

    expect(candidates.length).toBe(2); // LESSON-0002 (candidate/none) and LESSON-0003 (candidate/proposed)
    for (const c of candidates) {
      expect(c.status).toBe("candidate");
    }
  });

  it("frd-17: WHEN there are no candidate lessons THEN candidateLessons returns []", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const candidates = await withFactoryRoot(factoryRoot, () => candidateLessons());

    expect(candidates).toEqual([]);
  });
});

describe("frd-17: promotionQueue() — filters to promotion === 'proposed'", () => {
  it("frd-17: WHEN one lesson has promotion: 'proposed' THEN promotionQueue returns exactly that lesson", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
      {
        filename: "LESSON-0003-proposed.md",
        content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY),
      },
    ]);
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue).toHaveLength(1);
    expect(queue[0]?.id).toBe("LESSON-0003");
    expect(queue[0]?.promotion).toBe("proposed");
  });

  it("frd-17: WHEN promotion is 'none', 'approved', or 'rejected' THEN those lessons are NOT in promotionQueue", async () => {
    const approvedFm = { ...ACTIVE_FM, id: "LESSON-0005", promotion: "approved" };
    const rejectedFm = { ...CANDIDATE_FM, id: "LESSON-0006", promotion: "rejected" };

    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-none.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0005-approved.md", content: lessonMd(approvedFm, ACTIVE_BODY) },
      { filename: "LESSON-0006-rejected.md", content: lessonMd(rejectedFm, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue).toEqual([]);
  });

  it("frd-17: WHEN promotionQueue is called, every returned Lesson has promotion === 'proposed' (invariant)", async () => {
    const proposedFm1 = { ...MULTI_PROJECT_FM, id: "LESSON-0003" };
    const proposedFm2 = { ...MULTI_PROJECT_FM, id: "LESSON-0007" };

    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-none.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0003-proposed1.md", content: lessonMd(proposedFm1, MULTI_PROJECT_BODY) },
      { filename: "LESSON-0007-proposed2.md", content: lessonMd(proposedFm2, MULTI_PROJECT_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const queue = await withFactoryRoot(factoryRoot, () => promotionQueue());

    expect(queue.length).toBeGreaterThanOrEqual(2);
    for (const lesson of queue) {
      expect(lesson.promotion).toBe("proposed");
    }
  });
});

describe("frd-17: prunable() — filters to status === 'deprecated'", () => {
  it("frd-17: WHEN one lesson has status: 'deprecated' THEN prunable returns exactly that lesson", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0004-deprecated.md", content: lessonMd(DEPRECATED_FM, DEPRECATED_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const prunables = await withFactoryRoot(factoryRoot, () => prunable());

    expect(prunables).toHaveLength(1);
    expect(prunables[0]?.id).toBe("LESSON-0004");
    expect(prunables[0]?.status).toBe("deprecated");
  });

  it("frd-17: WHEN there are no deprecated lessons THEN prunable returns []", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      { filename: "LESSON-0002-candidate.md", content: lessonMd(CANDIDATE_FM, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const prunables = await withFactoryRoot(factoryRoot, () => prunable());

    expect(prunables).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PromotionState invariant — every lesson.promotion is a valid literal
// ---------------------------------------------------------------------------

describe("frd-17: promotion field — every returned lesson has a valid PromotionState literal", () => {
  it("frd-17: WHEN all PromotionState values are present in the fixture THEN all are returned as valid literals", async () => {
    const approvedFm = { ...ACTIVE_FM, id: "LESSON-0005", promotion: "approved" };
    const rejectedFm = { ...CANDIDATE_FM, id: "LESSON-0006", promotion: "rejected" };

    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-none.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
      {
        filename: "LESSON-0003-proposed.md",
        content: lessonMd(MULTI_PROJECT_FM, MULTI_PROJECT_BODY),
      },
      { filename: "LESSON-0005-approved.md", content: lessonMd(approvedFm, ACTIVE_BODY) },
      { filename: "LESSON-0006-rejected.md", content: lessonMd(rejectedFm, CANDIDATE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    const validPromotions: PromotionState[] = ["none", "proposed", "approved", "rejected"];
    for (const lesson of lessons) {
      expect(validPromotions).toContain(lesson.promotion);
    }
  });

  it("frd-17: WHEN a lesson has an unknown promotion value in frontmatter THEN it defaults to 'none' (safe default)", async () => {
    const fm = { ...ACTIVE_FM, promotion: "unknown-value" };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-unknownpromo.md", content: lessonMd(fm, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());

    // Either the lesson is skipped or promotion defaults to "none".
    if (lessons.length > 0) {
      expect(lessons[0]?.promotion).toBe("none");
    }
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution guard — file names matching Object prototype keys
// ---------------------------------------------------------------------------

describe("frd-17: prototype-pollution — LESSON ids matching prototype property names are safe", () => {
  it("frd-17: WHEN a LESSON file would produce id 'constructor' THEN readLessons does not corrupt the result set", async () => {
    const fm = { ...ACTIVE_FM, id: "constructor" };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-constructor-edge.md", content: lessonMd(fm, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    // Must not throw and must return a flat Array (not corrupt the prototype chain).
    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());
    expect(Array.isArray(lessons)).toBe(true);
    // If returned, the entry must be a plain object, not the Function constructor.
    if (lessons.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: guarded by length check above
      expect(typeof lessons[0]!).toBe("object");
      // biome-ignore lint/style/noNonNullAssertion: guarded by length check above
      expect(lessons[0]!).not.toBe(Object.prototype.constructor);
    }
  });

  it("frd-17: WHEN a LESSON file would produce id 'toString' THEN readLessons returns an Array (not polluted)", async () => {
    const fm = { ...ACTIVE_FM, id: "toString" };
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-toString-edge.md", content: lessonMd(fm, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    expect(() => withFactoryRoot(factoryRoot, () => readLessons())).not.toThrow();
    const lessons = await withFactoryRoot(factoryRoot, () => readLessons());
    expect(Array.isArray(lessons)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant (FRD-17 non-goal: lib/memory.ts never writes)
// ---------------------------------------------------------------------------

describe("frd-17: read-only invariant — readLessons never writes to the memory dir", () => {
  it("frd-17: WHEN readLessons is called THEN the factory/memory directory is not modified (no new files, no changed mtime of existing LESSON files)", async () => {
    const factoryRoot = makeTempMemoryDir([
      { filename: "LESSON-0001-active.md", content: lessonMd(ACTIVE_FM, ACTIVE_BODY) },
    ]);
    tmpRoots.push(factoryRoot);

    const memoryDir = path.join(factoryRoot, "factory", "memory");
    const filesBefore = fs.readdirSync(memoryDir).sort();
    const mtimeBefore = fs.statSync(path.join(memoryDir, "LESSON-0001-active.md")).mtimeMs;

    await withFactoryRoot(factoryRoot, () => readLessons());

    const filesAfter = fs.readdirSync(memoryDir).sort();
    const mtimeAfter = fs.statSync(path.join(memoryDir, "LESSON-0001-active.md")).mtimeMs;

    expect(filesAfter).toEqual(filesBefore);
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});
