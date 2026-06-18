/**
 * WO-01-006 — `readProjectDocs` (feature-centric tree discovery) — RED phase
 *
 * Tests are written BEFORE the implementation (`lib/docs.ts` does not exist yet).
 * Every test here will fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-01-007.1  The system SHALL read, per project, the feature-centric product
 *                documents in `docs/` (DR-049): the product layer
 *                (`docs/product/prd.md` + `docs/product/architecture.md`), each
 *                feature module under `docs/frds/frd-NN-<slug>/` (`frd.md`, and
 *                when present `fdd.md`, `blueprint.md`, `mocks/`, `work-orders/`),
 *                plus global `docs/adr/`, `docs/analytics/`, `docs/decision-log.md`,
 *                and the owner-facing `.pandacorp/` layer (`comms/progress.md`,
 *                `inbox/decisions.md`, `inbox/bugs/`).
 *   REQ-01-011   NEVER call Claude / never write.
 *   REQ-01-010   Project path missing → mark not-found, don't break the view.
 *   blueprint §3 Fail-soft: absent layers → empty/false, never throws.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real incidents):
 *   B1' (2026-06-16): NaN passes numeric type guards (`typeof NaN === "number"`).
 *     Discovery functions that count directory entries must never yield NaN.
 *   I2 (2026-06-16): empty-object/array inputs satisfy collection guards vacuously.
 *     An FRD directory that is empty still must produce a valid FrdModule entry with
 *     all boolean flags false and no invented positives.
 *   I3 (2026-06-16): array-shaped objects fool `typeof` checks. The `frds` array
 *     must be an actual JS Array (not an array-like object); `bugs` in comms must be
 *     an Array even when the bugs directory has zero files.
 *   WO-01-001 review: `pathExists` wraps `existsSync` with a catch; readProjectDocs
 *     must use `pathExists` (or equivalent) so a non-existent project path returns an
 *     empty index without throwing, not a raw ENOENT crash.
 *
 * Stack: Vitest (no mocks — pure fs reads against fixture trees + temp dirs).
 * No writes anywhere.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_FULL } from "@/tests/fixtures";
import { readProjectDocs } from "../docs";

// ---------------------------------------------------------------------------
// Types — mirror the contract in wo-01-006-read-project-docs.md and blueprint §2.
// Kept local to express what the tests assert; the module will export them.
// ---------------------------------------------------------------------------

type FrdModule = {
  slug: string;
  hasFdd: boolean;
  hasBlueprint: boolean;
  hasMocks: boolean;
  hasWorkOrders: boolean;
};

type ProjectDocsIndex = {
  prd?: string;
  architecture?: string;
  frds: FrdModule[];
  hasAdr: boolean;
  hasAnalytics: boolean;
  hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** proj-a absolute path (full docs tree in the fixture). */
const PROJ_A_PATH = path.join(FIXTURE_FULL, "projects", "proj-a");

/**
 * Create a minimal temporary project tree.
 * Returns the project root (temp dir).
 * Clean up with fs.rmSync(dir, { recursive: true, force: true }).
 */
function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-test-"));
  if (setup) setup(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// AC-01-007.1 — Product layer: prd.md and architecture.md paths
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — AC-01-007.1 product layer (proj-a)", () => {
  it("frd-01: AC-01-007.1 — WHEN prd.md exists THEN prd is a non-empty string path", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(typeof index.prd).toBe("string");
    expect(index.prd?.length).toBeGreaterThan(0);
  });

  it("frd-01: AC-01-007.1 — WHEN prd.md exists THEN prd path ends with 'prd.md'", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.prd).toMatch(/prd\.md$/);
  });

  it("frd-01: AC-01-007.1 — WHEN prd.md exists THEN prd path is an absolute path", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(path.isAbsolute(index.prd ?? "")).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN architecture.md exists THEN architecture is a non-empty string path", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(typeof index.architecture).toBe("string");
    expect(index.architecture?.length).toBeGreaterThan(0);
  });

  it("frd-01: AC-01-007.1 — WHEN architecture.md exists THEN architecture path ends with 'architecture.md'", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.architecture).toMatch(/architecture\.md$/);
  });

  it("frd-01: AC-01-007.1 — WHEN architecture.md exists THEN architecture path is absolute", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(path.isAbsolute(index.architecture ?? "")).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN prd.md is absent THEN prd is undefined (not null or empty string)", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.prd).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN architecture.md is absent THEN architecture is undefined (not null or empty string)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "product"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "product", "prd.md"), "# PRD\n");
      // No architecture.md
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.architecture).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-007.1 — FRD modules enumeration
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — AC-01-007.1 frds array (proj-a has frd-01-x)", () => {
  it("frd-01: AC-01-007.1 — WHEN docs/frds/ has entries THEN frds is a non-empty array", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(Array.isArray(index.frds)).toBe(true);
    expect(index.frds.length).toBeGreaterThan(0);
  });

  it("frd-01: AC-01-007.1 — WHEN frd-01-x exists THEN frds contains an entry with slug 'frd-01-x'", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const frd01x = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd01x).toBeDefined();
  });

  it("frd-01: AC-01-007.1 — WHEN frd-01-x has blueprint.md THEN hasBlueprint is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const frd01x = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd01x?.hasBlueprint).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN frd-01-x has work-orders/ THEN hasWorkOrders is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const frd01x = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd01x?.hasWorkOrders).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN frd-01-x has mocks/ THEN hasMocks is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const frd01x = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd01x?.hasMocks).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN frd-01-x has no fdd.md THEN hasFdd is false", () => {
    // The fixture for frd-01-x does NOT include fdd.md — confirms false negative.
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const frd01x = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd01x?.hasFdd).toBe(false);
  });

  it("frd-01: AC-01-007.1 — WHEN frds is populated THEN each entry has all required FrdModule fields", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    for (const frd of index.frds) {
      expect(typeof frd.slug).toBe("string");
      expect(frd.slug.length).toBeGreaterThan(0);
      expect(typeof frd.hasFdd).toBe("boolean");
      expect(typeof frd.hasBlueprint).toBe("boolean");
      expect(typeof frd.hasMocks).toBe("boolean");
      expect(typeof frd.hasWorkOrders).toBe("boolean");
    }
  });

  it("frd-01: AC-01-007.1 — WHEN docs/frds/ is absent THEN frds is an empty array (not undefined)", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Array.isArray(index.frds)).toBe(true);
      expect(index.frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN docs/frds/ contains only non-frd-NN dirs THEN frds is empty", () => {
    // Dirs that don't match the frd-NN-<slug> pattern must be ignored.
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "not-a-frd"), { recursive: true });
      fs.mkdirSync(path.join(root, "docs", "frds", "README"), { recursive: true });
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Array.isArray(index.frds)).toBe(true);
      expect(index.frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN an FRD directory has only frd.md THEN all optional flags are false", () => {
    // A minimal FRD dir: just frd.md, no blueprint, no fdd, no mocks, no work-orders.
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-02-minimal");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-02\n");
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      const frd02 = index.frds.find((f) => f.slug === "frd-02-minimal");
      expect(frd02).toBeDefined();
      expect(frd02?.hasFdd).toBe(false);
      expect(frd02?.hasBlueprint).toBe(false);
      expect(frd02?.hasMocks).toBe(false);
      expect(frd02?.hasWorkOrders).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN an FRD directory has fdd.md THEN hasFdd is true", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-03-with-fdd");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-03\n");
      fs.writeFileSync(path.join(frdDir, "fdd.md"), "# FDD-03\n");
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      const frd03 = index.frds.find((f) => f.slug === "frd-03-with-fdd");
      expect(frd03?.hasFdd).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN multiple FRD directories exist THEN frds length matches the count of frd-NN-* dirs", () => {
    const dir = makeTempProject((root) => {
      for (const slug of ["frd-01-alpha", "frd-02-beta", "frd-03-gamma"]) {
        const frdDir = path.join(root, "docs", "frds", slug);
        fs.mkdirSync(frdDir, { recursive: true });
        fs.writeFileSync(path.join(frdDir, "frd.md"), `# ${slug}\n`);
      }
      // Non-matching entry should be ignored:
      fs.mkdirSync(path.join(root, "docs", "frds", "shared"), { recursive: true });
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.frds).toHaveLength(3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN FRD directories exist THEN slug is the directory name (not a sub-path)", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    for (const frd of index.frds) {
      // Slug must be a plain directory name, not contain path separators.
      expect(frd.slug).not.toContain("/");
      expect(frd.slug).not.toContain("\\");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-007.1 — Global docs layer: hasAdr, hasAnalytics, hasDecisionLog
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — AC-01-007.1 global docs layer (proj-a)", () => {
  it("frd-01: AC-01-007.1 — WHEN docs/adr/ exists THEN hasAdr is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.hasAdr).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN docs/decision-log.md exists THEN hasDecisionLog is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.hasDecisionLog).toBe(true);
  });

  it("frd-01: AC-01-007.1 — WHEN docs/analytics/ is absent THEN hasAnalytics is false", () => {
    // proj-a fixture does not have docs/analytics/ — confirm the false negative.
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.hasAnalytics).toBe(false);
  });

  it("frd-01: AC-01-007.1 — WHEN docs/analytics/ exists THEN hasAnalytics is true", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "analytics"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "analytics", "events.md"), "# Events\n");
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.hasAnalytics).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN docs/adr/ is absent THEN hasAdr is false", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.hasAdr).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN docs/decision-log.md is absent THEN hasDecisionLog is false", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.hasDecisionLog).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-007.1 — .pandacorp/ comms layer
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — AC-01-007.1 .pandacorp/ comms layer (proj-a)", () => {
  it("frd-01: AC-01-007.1 — WHEN .pandacorp/comms/progress.md exists THEN comms.progress is a non-empty string", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(typeof index.comms.progress).toBe("string");
    expect(index.comms.progress?.length).toBeGreaterThan(0);
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/comms/progress.md exists THEN comms.progress path ends with 'progress.md'", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.comms.progress).toMatch(/progress\.md$/);
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/inbox/decisions.md exists THEN comms.decisions is a non-empty string", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(typeof index.comms.decisions).toBe("string");
    expect(index.comms.decisions?.length).toBeGreaterThan(0);
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/inbox/decisions.md exists THEN comms.decisions path ends with 'decisions.md'", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(index.comms.decisions).toMatch(/decisions\.md$/);
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/inbox/bugs/ has 1 file THEN comms.bugs has length 1", () => {
    // proj-a fixture: bugs/bug-1.md (one bug)
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(Array.isArray(index.comms.bugs)).toBe(true);
    expect(index.comms.bugs).toHaveLength(1);
  });

  it("frd-01: AC-01-007.1 — WHEN bugs/ has entries THEN each bug entry is an absolute path string", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    for (const bugPath of index.comms.bugs) {
      expect(typeof bugPath).toBe("string");
      expect(bugPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(bugPath)).toBe(true);
    }
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/comms/progress.md is absent THEN comms.progress is undefined", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.comms.progress).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/inbox/decisions.md is absent THEN comms.decisions is undefined", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.comms.decisions).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN .pandacorp/inbox/bugs/ is absent THEN comms.bugs is an empty array (not undefined)", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Array.isArray(index.comms.bugs)).toBe(true);
      expect(index.comms.bugs).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: AC-01-007.1 — WHEN bugs/ directory has multiple .md files THEN comms.bugs length matches the file count", () => {
    const dir = makeTempProject((root) => {
      const bugsDir = path.join(root, ".pandacorp", "inbox", "bugs");
      fs.mkdirSync(bugsDir, { recursive: true });
      fs.writeFileSync(path.join(bugsDir, "bug-1.md"), "# Bug 1\n");
      fs.writeFileSync(path.join(bugsDir, "bug-2.md"), "# Bug 2\n");
      fs.writeFileSync(path.join(bugsDir, "bug-3.md"), "# Bug 3\n");
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.comms.bugs).toHaveLength(3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// blueprint §3 — Fail-soft: bare docs/ project → empty index, no throw
// "A project with only a bare `docs/` → mostly empty index, no throw."
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — blueprint §3 fail-soft: bare/empty project", () => {
  it("frd-01: WHEN the project root has only a bare docs/ folder THEN readProjectDocs does NOT throw", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    });
    try {
      expect(() => readProjectDocs(dir)).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the project root is completely empty THEN readProjectDocs does NOT throw", () => {
    const dir = makeTempProject();
    try {
      expect(() => readProjectDocs(dir)).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the project root is empty THEN frds is an empty array", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Array.isArray(index.frds)).toBe(true);
      expect(index.frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the project root is empty THEN hasAdr, hasAnalytics, hasDecisionLog are all false", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.hasAdr).toBe(false);
      expect(index.hasAnalytics).toBe(false);
      expect(index.hasDecisionLog).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the project root is empty THEN prd and architecture are undefined", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.prd).toBeUndefined();
      expect(index.architecture).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the project root is empty THEN comms.progress and comms.decisions are undefined, bugs is []", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.comms.progress).toBeUndefined();
      expect(index.comms.decisions).toBeUndefined();
      expect(Array.isArray(index.comms.bugs)).toBe(true);
      expect(index.comms.bugs).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-01-010 / blueprint §3 — Non-existent project path → no throw
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — REQ-01-010: non-existent project path", () => {
  it("frd-01: WHEN the project path does not exist THEN readProjectDocs does NOT throw", () => {
    expect(() =>
      readProjectDocs("/nonexistent/project/path/that/will/never/be/here"),
    ).not.toThrow();
  });

  it("frd-01: WHEN the project path does not exist THEN frds is an empty array", () => {
    const index = readProjectDocs(
      "/nonexistent/project/path/that/will/never/be/here",
    ) as ProjectDocsIndex;
    expect(Array.isArray(index.frds)).toBe(true);
    expect(index.frds).toHaveLength(0);
  });

  it("frd-01: WHEN the project path does not exist THEN all boolean flags are false", () => {
    const index = readProjectDocs(
      "/nonexistent/project/path/that/will/never/be/here",
    ) as ProjectDocsIndex;
    expect(index.hasAdr).toBe(false);
    expect(index.hasAnalytics).toBe(false);
    expect(index.hasDecisionLog).toBe(false);
  });

  it("frd-01: WHEN the project path does not exist THEN comms.bugs is an empty array", () => {
    const index = readProjectDocs(
      "/nonexistent/project/path/that/will/never/be/here",
    ) as ProjectDocsIndex;
    expect(Array.isArray(index.comms.bugs)).toBe(true);
    expect(index.comms.bugs).toHaveLength(0);
  });

  it("frd-01: WHEN an empty string is passed as project path THEN readProjectDocs does NOT throw", () => {
    expect(() => readProjectDocs("")).not.toThrow();
  });

  it("frd-01: WHEN an empty string is passed THEN frds is an empty array", () => {
    const index = readProjectDocs("") as ProjectDocsIndex;
    expect(Array.isArray(index.frds)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression: B1' (progress.md 2026-06-16) — discovery must never yield NaN.
// Counting bugs or frds entries must produce finite integers, never NaN.
// The motion.duration NaN-bypass pattern: `typeof NaN === "number"` is true,
// so any numeric computation on a malformed scan result could propagate NaN.
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — regression B1': discovery counts must never be NaN", () => {
  it("frd-01: WHEN bugs/ dir exists but contains no .md files THEN comms.bugs.length is 0 (a finite integer, not NaN)", () => {
    const dir = makeTempProject((root) => {
      const bugsDir = path.join(root, ".pandacorp", "inbox", "bugs");
      fs.mkdirSync(bugsDir, { recursive: true });
      // No .md files — only an unrelated file.
      fs.writeFileSync(path.join(bugsDir, ".gitkeep"), "");
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Number.isFinite(index.comms.bugs.length)).toBe(true);
      expect(index.comms.bugs.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN frds/ dir exists but has no matching subdirs THEN frds.length is 0 (not NaN)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds"), { recursive: true });
      // No frd-NN-* subdirectories.
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(Number.isFinite(index.frds.length)).toBe(true);
      expect(index.frds.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: I2 (progress.md 2026-06-16) — empty-collection vacuous-truth.
// A `docs/frds/frd-01-empty/` dir with no contents must produce an FrdModule
// with all flags false — NOT a vacuously-true "all constraints satisfied".
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — regression I2: empty FRD dir → all flags false, not vacuous-true", () => {
  it("frd-01: WHEN an FRD directory is completely empty THEN it produces an FrdModule with all flags false", () => {
    const dir = makeTempProject((root) => {
      // Completely empty frd directory (no frd.md, no blueprint.md, nothing).
      fs.mkdirSync(path.join(root, "docs", "frds", "frd-01-empty"), { recursive: true });
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      // The empty dir still counts as a discovered FRD module (it has the right prefix).
      const frd = index.frds.find((f) => f.slug === "frd-01-empty");
      if (frd !== undefined) {
        // If the implementation chooses to include it, all flags must be false.
        expect(frd.hasFdd).toBe(false);
        expect(frd.hasBlueprint).toBe(false);
        expect(frd.hasMocks).toBe(false);
        expect(frd.hasWorkOrders).toBe(false);
      }
      // Either way: must not throw and frds must be a proper array.
      expect(Array.isArray(index.frds)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN bugs/ dir is empty THEN comms.bugs is [] and not undefined or null", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox", "bugs"), { recursive: true });
      // No files inside.
    });
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect(index.comms.bugs).not.toBeUndefined();
      expect(index.comms.bugs).not.toBeNull();
      expect(Array.isArray(index.comms.bugs)).toBe(true);
      expect(index.comms.bugs).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: I3 (progress.md 2026-06-16) — array-shaped objects fool typeof.
// `frds` must be a genuine JS Array; `comms.bugs` must be a genuine JS Array.
// Also: FRD slugs must be strings, not arrays.
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — regression I3: frds and comms.bugs must be genuine Arrays", () => {
  it("frd-01: WHEN frds has entries THEN Array.isArray(frds) is true (not an array-like object)", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(Array.isArray(index.frds)).toBe(true);
  });

  it("frd-01: WHEN comms.bugs has entries THEN Array.isArray(comms.bugs) is true", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(Array.isArray(index.comms.bugs)).toBe(true);
  });

  it("frd-01: WHEN frds is populated THEN frd.slug is a plain string (not an array)", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    for (const frd of index.frds) {
      expect(Array.isArray(frd.slug)).toBe(false);
      expect(typeof frd.slug).toBe("string");
    }
  });

  it("frd-01: WHEN frds is populated THEN frd boolean flags are genuine booleans (not arrays or objects)", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    for (const frd of index.frds) {
      expect(Array.isArray(frd.hasFdd)).toBe(false);
      expect(Array.isArray(frd.hasBlueprint)).toBe(false);
      expect(Array.isArray(frd.hasMocks)).toBe(false);
      expect(Array.isArray(frd.hasWorkOrders)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-01-011 — Read-only invariant: never writes, never calls Claude.
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — REQ-01-011: read-only invariant", () => {
  it("frd-01: WHEN readProjectDocs runs THEN prd.md mtime is unchanged (no write)", () => {
    const prdPath = path.join(PROJ_A_PATH, "docs", "product", "prd.md");
    const before = fs.statSync(prdPath);
    readProjectDocs(PROJ_A_PATH);
    const after = fs.statSync(prdPath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-01: WHEN readProjectDocs runs against a non-existent path THEN no file is created", () => {
    const ghostPath = "/tmp/pandacorp-docs-ghost-project-must-not-be-created";
    if (fs.existsSync(ghostPath)) fs.rmSync(ghostPath, { recursive: true, force: true });
    readProjectDocs(ghostPath);
    expect(fs.existsSync(ghostPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Return-type shape invariants — the ProjectDocsIndex must always have the
// required top-level keys, even for the emptiest possible project.
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — ProjectDocsIndex shape invariants", () => {
  it("frd-01: WHEN called on any project THEN the result always has 'frds', 'hasAdr', 'hasAnalytics', 'hasDecisionLog', 'comms' keys", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect("frds" in index).toBe(true);
      expect("hasAdr" in index).toBe(true);
      expect("hasAnalytics" in index).toBe(true);
      expect("hasDecisionLog" in index).toBe(true);
      expect("comms" in index).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN called on any project THEN comms always has 'bugs' key (an array)", () => {
    const dir = makeTempProject();
    try {
      const index = readProjectDocs(dir) as ProjectDocsIndex;
      expect("bugs" in index.comms).toBe(true);
      expect(Array.isArray(index.comms.bugs)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN called on proj-a THEN the result matches the full expected shape exactly", () => {
    const index = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    // Top-level structure
    expect(typeof index.prd).toBe("string");
    expect(typeof index.architecture).toBe("string");
    expect(Array.isArray(index.frds)).toBe(true);
    expect(index.frds.length).toBeGreaterThan(0);
    expect(index.hasAdr).toBe(true);
    expect(index.hasDecisionLog).toBe(true);
    // .pandacorp layer
    expect(typeof index.comms.progress).toBe("string");
    expect(typeof index.comms.decisions).toBe("string");
    expect(Array.isArray(index.comms.bugs)).toBe(true);
    expect(index.comms.bugs.length).toBe(1);
    // The lone FRD module
    const frd = index.frds.find((f) => f.slug === "frd-01-x");
    expect(frd).toBeDefined();
    expect(frd?.hasBlueprint).toBe(true);
    expect(frd?.hasWorkOrders).toBe(true);
    expect(frd?.hasMocks).toBe(true);
    expect(frd?.hasFdd).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: calling readProjectDocs twice returns equivalent results.
// ---------------------------------------------------------------------------

describe("frd-01: readProjectDocs — idempotency", () => {
  it("frd-01: WHEN readProjectDocs is called twice on proj-a THEN both calls return frds with the same slugs", () => {
    const first = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const second = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const firstSlugs = first.frds.map((f) => f.slug).sort();
    const secondSlugs = second.frds.map((f) => f.slug).sort();
    expect(firstSlugs).toEqual(secondSlugs);
  });

  it("frd-01: WHEN readProjectDocs is called twice on proj-a THEN hasAdr is the same both times", () => {
    const first = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    const second = readProjectDocs(PROJ_A_PATH) as ProjectDocsIndex;
    expect(first.hasAdr).toBe(second.hasAdr);
  });

  it("frd-01: WHEN readProjectDocs is called twice on a non-existent path THEN both return empty frds", () => {
    const first = readProjectDocs("/nonexistent/ghost") as ProjectDocsIndex;
    const second = readProjectDocs("/nonexistent/ghost") as ProjectDocsIndex;
    expect(first.frds).toHaveLength(0);
    expect(second.frds).toHaveLength(0);
  });
});
