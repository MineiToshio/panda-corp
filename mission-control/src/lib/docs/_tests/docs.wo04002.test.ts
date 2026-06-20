/**
 * WO-04-002 — `lib/docs.ts`: readActivityLog + readDecisions — RED phase
 *
 * Tests are written BEFORE the implementation of IF-04-docs comms readers.
 * `readActivityLog` and `readDecisions` do NOT yet exist in lib/docs.ts; every
 * test here will fail (RED) until the GREEN phase. That is the intent.
 *
 * Traceability:
 *   AC-04-003.2  The Summary tab SHALL render the activity log read from
 *                `.pandacorp/comms/progress.md`; WHEN the file is absent it
 *                SHALL show a graceful "no activity yet" empty state.
 *                → readActivityLog happy-path + absent-file tests.
 *   AC-04-003.3  The Summary tab SHALL render the decision points read from
 *                `.pandacorp/inbox/decisions.md`, each highlighted, with a
 *                total count badge.
 *                → readDecisions happy-path + structure + count tests.
 *   REQ-04-003   Summary tab reads .pandacorp/inbox/decisions.md and
 *                .pandacorp/comms/progress.md.
 *   REQ-04-004   WHEN there are pending decisions, the workspace SHALL
 *                highlight them. (pending count = filter(!resolved).length)
 *
 * Regression anchors (real bugs from .pandacorp/comms/progress.md):
 *   B1' (2026-06-16, NaN-bypass): discovery counts must be finite integers;
 *     `entries.length` and the count of DecisionPoints must never be NaN.
 *   I2 (2026-06-16, vacuous-truth on empty collection): an empty progress.md
 *     must produce `{ entries: [] }` — no phantom entries.
 *   I3 (2026-06-16, array-shaped objects fool typeof): `entries` in ActivityLog
 *     and the DecisionPoint[] array must be genuine JS Arrays (Array.isArray).
 *   WO-01-001 (2026-06-16): pathExists must be used (or equivalent) so
 *     non-existent paths never cause an ENOENT crash from inside the readers.
 *
 * --- IF-04-docs contract (blueprint §2, WO-04-002) ---------------------------
 *
 * export interface ActivityLog { entries: string[]; }
 * export function readActivityLog(projectPath: string): ActivityLog;
 *   // Parses .pandacorp/comms/progress.md into a list of bullet/log items.
 *   // Absent file → { entries: [] }. Never throws on absence.
 *
 * export interface DecisionPoint {
 *   title: string;
 *   recommendation?: string;
 *   resolved: boolean;
 * }
 * export function readDecisions(projectPath: string): DecisionPoint[];
 *   // Parses .pandacorp/inbox/decisions.md.
 *   // Absent file → []. Never throws on absence.
 *   // A pending count is derived by the caller as filter(!resolved).length.
 *
 * Files are Spanish, gitignored, owner-facing comms — read as-is (architecture §4.5).
 * Read-only: no writes.
 * ---------------------------------------------------------------------------
 *
 * Fixture anatomy (FIXTURE_FULL/projects/proj-a/.pandacorp/):
 *   comms/progress.md  — has sections "## 2026-06-15" with 2 bullet entries
 *                         and "## Bugs conocidos" with 1 bullet entry
 *   inbox/decisions.md — has 2 OPEN decision blocks (no CLOSED/RESOLVED block)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_FULL } from "@/tests/fixtures";
import { readActivityLog, readDecisions } from "../activity";

// ---------------------------------------------------------------------------
// Local type mirrors — mirror the IF-04-docs contract.
// Kept here so tests describe the expected shape without depending on the
// production types (which do not exist yet in the RED phase).
// ---------------------------------------------------------------------------

type ActivityLog = { entries: string[] };
type DecisionPoint = { title: string; recommendation?: string; resolved: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** proj-a absolute path (full .pandacorp/ tree in the fixture). */
const PROJ_A = path.join(FIXTURE_FULL, "projects", "proj-a");

/**
 * Create a minimal temporary project tree.
 * Returned dir is absolute. Clean up with fs.rmSync(dir, {recursive:true, force:true}).
 */
function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-wo04002-"));
  if (setup) setup(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// AC-04-003.2 — readActivityLog: happy path (progress.md exists)
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog — AC-04-003.2 WHEN progress.md exists THEN returns parsed entries", () => {
  it("frd-04: AC-04-003.2 — WHEN progress.md exists THEN readActivityLog does NOT throw", () => {
    expect(() => readActivityLog(PROJ_A)).not.toThrow();
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md exists THEN returns an object with an 'entries' key", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    expect("entries" in log).toBe(true);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md exists THEN entries is a genuine JS Array (regression I3)", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    expect(Array.isArray(log.entries)).toBe(true);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has bullet lines THEN entries is non-empty", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    expect(log.entries.length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has bullet lines THEN every entry is a non-empty string", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    for (const entry of log.entries) {
      expect(typeof entry).toBe("string");
      expect(entry.trim().length).toBeGreaterThan(0);
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has the fixture content THEN entries contains the WO-01-000 line", () => {
    // Fixture progress.md has: "- WO-01-000 completado: fixtures creadas y harness configurado."
    const log = readActivityLog(PROJ_A) as ActivityLog;
    const hasWo = log.entries.some((e) => e.includes("WO-01-000"));
    expect(hasWo).toBe(true);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has the fixture content THEN entries contains the WO-01-001 line", () => {
    // Fixture progress.md has: "- WO-01-001 en progreso: `pathExists` helper implementado."
    const log = readActivityLog(PROJ_A) as ActivityLog;
    const hasWo = log.entries.some((e) => e.includes("WO-01-001"));
    expect(hasWo).toBe(true);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has bullet entries THEN entries.length is a finite integer (regression B1')", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    expect(Number.isFinite(log.entries.length)).toBe(true);
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md is read THEN no entry is undefined or null", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    for (const entry of log.entries) {
      expect(entry).not.toBeUndefined();
      expect(entry).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.2 — readActivityLog: absent file → { entries: [] }, no throw
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog — AC-04-003.2 WHEN progress.md is absent THEN graceful empty state", () => {
  it("frd-04: AC-04-003.2 — WHEN project path has no progress.md THEN readActivityLog does NOT throw", () => {
    const dir = makeTempProject();
    try {
      expect(() => readActivityLog(dir)).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN project path has no progress.md THEN returns { entries: [] }", () => {
    const dir = makeTempProject();
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      expect(log.entries).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN .pandacorp/comms/ dir exists but progress.md is absent THEN entries is []", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      // No progress.md inside
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      expect(log.entries).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN project path does not exist THEN readActivityLog does NOT throw", () => {
    expect(() => readActivityLog("/nonexistent/project/path/wo04002-probe")).not.toThrow();
  });

  it("frd-04: AC-04-003.2 — WHEN project path does not exist THEN returns { entries: [] }", () => {
    const log = readActivityLog("/nonexistent/project/path/wo04002-probe") as ActivityLog;
    expect(Array.isArray(log.entries)).toBe(true);
    expect(log.entries).toHaveLength(0);
  });

  it("frd-04: AC-04-003.2 — WHEN empty string is passed THEN readActivityLog does NOT throw", () => {
    expect(() => readActivityLog("")).not.toThrow();
  });

  it("frd-04: AC-04-003.2 — WHEN empty string is passed THEN returns { entries: [] }", () => {
    const log = readActivityLog("") as ActivityLog;
    expect(Array.isArray(log.entries)).toBe(true);
    expect(log.entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.2 — readActivityLog: progress.md with varied formats
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog — AC-04-003.2 content parsing edge cases", () => {
  it("frd-04: AC-04-003.2 — WHEN progress.md is completely empty THEN returns { entries: [] }", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(path.join(root, ".pandacorp", "comms", "progress.md"), "");
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      expect(log.entries).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has only headings and no bullets THEN entries is empty or has no blank entries", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "comms", "progress.md"),
        "# Log\n\n## 2026-06-15\n\n## 2026-06-16\n",
      );
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      // No bullet lines → either empty or only non-blank strings
      for (const e of log.entries) {
        expect(e.trim().length).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has exactly 1 bullet THEN entries has 1 entry", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "comms", "progress.md"),
        "# Log\n\n## 2026-06-15\n- Solo entry.\n",
      );
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0]).toContain("Solo entry");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has 3 bullets THEN entries has at least 3 entries", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "comms", "progress.md"),
        "# Log\n- Alpha done.\n- Beta done.\n- Gamma in progress.\n",
      );
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(log.entries.length).toBeGreaterThanOrEqual(3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has Spanish text THEN entries are returned verbatim (no truncation)", () => {
    const spanishLine = "- WO-04-001 completado: `listProjectDocs` implementado sin errores.";
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "comms", "progress.md"),
        `# Log\n${spanishLine}\n`,
      );
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      const found = log.entries.some((e) => e.includes("listProjectDocs"));
      expect(found).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.2 — WHEN progress.md has only whitespace lines THEN entries has no entries with blank content (regression I2 vacuous-truth)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      fs.writeFileSync(path.join(root, ".pandacorp", "comms", "progress.md"), "\n\n  \n\n");
    });
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Array.isArray(log.entries)).toBe(true);
      for (const e of log.entries) {
        expect(e.trim().length).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.2 — readActivityLog: read-only invariant (never writes)
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog — read-only invariant (no writes)", () => {
  it("frd-04: WHEN readActivityLog runs THEN the mtime of progress.md is unchanged", () => {
    const progressPath = path.join(PROJ_A, ".pandacorp", "comms", "progress.md");
    const before = fs.statSync(progressPath);
    readActivityLog(PROJ_A);
    const after = fs.statSync(progressPath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-04: WHEN readActivityLog is called on a non-existent projectPath THEN no file or dir is created", () => {
    const ghostPath = "/tmp/pandacorp-activitylog-ghost-wo04002";
    if (fs.existsSync(ghostPath)) fs.rmSync(ghostPath, { recursive: true, force: true });
    readActivityLog(ghostPath);
    expect(fs.existsSync(ghostPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.2 — readActivityLog: idempotency
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog — idempotency", () => {
  it("frd-04: WHEN readActivityLog is called twice on proj-a THEN both return the same entries", () => {
    const first = readActivityLog(PROJ_A) as ActivityLog;
    const second = readActivityLog(PROJ_A) as ActivityLog;
    expect(first.entries).toEqual(second.entries);
  });

  it("frd-04: WHEN readActivityLog is called twice on a non-existent path THEN both return { entries: [] }", () => {
    const first = readActivityLog("/nonexistent/ghost-wo04002") as ActivityLog;
    const second = readActivityLog("/nonexistent/ghost-wo04002") as ActivityLog;
    expect(first.entries).toHaveLength(0);
    expect(second.entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: happy path (decisions.md exists)
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 WHEN decisions.md exists THEN returns parsed DecisionPoints", () => {
  it("frd-04: AC-04-003.3 — WHEN decisions.md exists THEN readDecisions does NOT throw", () => {
    expect(() => readDecisions(PROJ_A)).not.toThrow();
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md exists THEN returns a genuine JS Array (regression I3)", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has decision blocks THEN result is non-empty", () => {
    // Fixture decisions.md has 2 OPEN decision blocks.
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    expect(result.length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 2 OPEN blocks THEN result has 2 DecisionPoints", () => {
    // Fixture: 2 OPEN sections, no CLOSED.
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    expect(result).toHaveLength(2);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has OPEN blocks THEN each DecisionPoint has a non-empty title", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      expect(typeof dp.title).toBe("string");
      expect(dp.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 'OPEN: Should we add Playwright e2e tests?' THEN a DecisionPoint with that title exists", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    const found = result.some((dp) => dp.title.includes("Playwright"));
    expect(found).toBe(true);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 'OPEN: Default event cap for readEvents' THEN a DecisionPoint with that title exists", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    const found = result.some((dp) => dp.title.includes("event cap"));
    expect(found).toBe(true);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has OPEN blocks THEN each DecisionPoint has resolved = false", () => {
    // Fixture has only OPEN blocks — all must be unresolved.
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      expect(dp.resolved).toBe(false);
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 2 OPEN blocks THEN pending count (filter !resolved) is 2 (REQ-04-004)", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    const pendingCount = result.filter((dp) => !dp.resolved).length;
    expect(pendingCount).toBe(2);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md is parsed THEN every DecisionPoint has a boolean 'resolved' field", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      expect(typeof dp.resolved).toBe("boolean");
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has OPEN blocks THEN result.length is a finite integer (regression B1')", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    expect(Number.isFinite(result.length)).toBe(true);
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md is parsed THEN every DecisionPoint title is a plain string (not an array — regression I3)", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      expect(Array.isArray(dp.title)).toBe(false);
      expect(typeof dp.title).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: resolved vs. pending semantics
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 resolved vs. pending semantics", () => {
  it("frd-04: AC-04-003.3 — WHEN a block is marked CLOSED THEN its DecisionPoint has resolved = true", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Decisions\n\n## CLOSED: Choose auth library\n- Decision: Use NextAuth.\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(result.length).toBeGreaterThan(0);
      const closed = result.find(
        (dp) => dp.title.includes("auth library") || dp.title.includes("Choose auth"),
      );
      expect(closed?.resolved).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN a block is marked OPEN THEN its DecisionPoint has resolved = false", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Decisions\n\n## OPEN: Pick database\n- Context: SQL vs NoSQL.\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(result.length).toBeGreaterThan(0);
      const open = result.find(
        (dp) => dp.title.includes("database") || dp.title.includes("Pick database"),
      );
      expect(open?.resolved).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 1 OPEN + 1 CLOSED THEN pending count is 1 and resolved count is 1", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        [
          "# Decisions",
          "",
          "## OPEN: Pending decision",
          "- Context: Still open.",
          "",
          "## CLOSED: Already decided",
          "- Decision: Done.",
        ].join("\n"),
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      const pending = result.filter((dp) => !dp.resolved);
      const resolved = result.filter((dp) => dp.resolved);
      expect(pending).toHaveLength(1);
      expect(resolved).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN all blocks are CLOSED THEN pending count is 0 (REQ-04-004 no-highlight state)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Decisions\n\n## CLOSED: Old decision\n- Done.\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      const pendingCount = result.filter((dp) => !dp.resolved).length;
      expect(pendingCount).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: optional recommendation field
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 optional recommendation field", () => {
  it("frd-04: AC-04-003.3 — WHEN a block has no recommendation THEN recommendation is undefined (not empty string)", () => {
    // Fixture decisions.md blocks have no explicit recommendation line.
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    // At least one block should not have a recommendation (they have Options but no chosen one).
    const noRec = result.some((dp) => dp.recommendation === undefined);
    expect(noRec).toBe(true);
  });

  it("frd-04: AC-04-003.3 — WHEN a block has a recommendation THEN it is a non-empty string", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        [
          "# Decisions",
          "",
          "## OPEN: Choose testing strategy",
          "- Context: We need a strategy.",
          "- **Recommendation:** Use option B (Playwright for 5 flows).",
          "- Owner action needed: Confirm.",
        ].join("\n"),
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      const dp = result.find(
        (dp) => dp.title.includes("testing strategy") || dp.title.includes("Choose testing"),
      );
      expect(dp).toBeDefined();
      if (dp?.recommendation !== undefined) {
        // If the parser picks up a recommendation, it must be a non-empty string.
        expect(typeof dp.recommendation).toBe("string");
        expect(dp.recommendation.trim().length).toBeGreaterThan(0);
      }
      // Whether or not the recommendation is captured, the block must parse without throwing.
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN recommendation is present THEN it is not an array (regression I3)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Decisions\n\n## OPEN: A choice\n- **Recommendation:** Option A.\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      for (const dp of result) {
        if (dp.recommendation !== undefined) {
          expect(Array.isArray(dp.recommendation)).toBe(false);
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: absent file → [], no throw
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 WHEN decisions.md is absent THEN graceful empty state", () => {
  it("frd-04: AC-04-003.3 — WHEN project has no decisions.md THEN readDecisions does NOT throw", () => {
    const dir = makeTempProject();
    try {
      expect(() => readDecisions(dir)).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN project has no decisions.md THEN readDecisions returns []", () => {
    const dir = makeTempProject();
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN .pandacorp/inbox/ dir exists but decisions.md is absent THEN returns []", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      // No decisions.md
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN project path does not exist THEN readDecisions does NOT throw", () => {
    expect(() => readDecisions("/nonexistent/project/path/wo04002-probe")).not.toThrow();
  });

  it("frd-04: AC-04-003.3 — WHEN project path does not exist THEN readDecisions returns []", () => {
    const result = readDecisions("/nonexistent/project/path/wo04002-probe") as DecisionPoint[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-04: AC-04-003.3 — WHEN empty string is passed THEN readDecisions does NOT throw", () => {
    expect(() => readDecisions("")).not.toThrow();
  });

  it("frd-04: AC-04-003.3 — WHEN empty string is passed THEN readDecisions returns []", () => {
    const result = readDecisions("") as DecisionPoint[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: content edge cases
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 content edge cases", () => {
  it("frd-04: AC-04-003.3 — WHEN decisions.md is completely empty THEN returns []", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(path.join(root, ".pandacorp", "inbox", "decisions.md"), "");
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has only a heading and no decision blocks THEN returns []", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Pending decisions — proj-a\n\n(ninguno por ahora)\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has 3 OPEN blocks THEN result has 3 entries with resolved=false", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        [
          "# Decisions",
          "",
          "## OPEN: First open",
          "- Context: First.",
          "",
          "## OPEN: Second open",
          "- Context: Second.",
          "",
          "## OPEN: Third open",
          "- Context: Third.",
        ].join("\n"),
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(result).toHaveLength(3);
      for (const dp of result) {
        expect(dp.resolved).toBe(false);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has Spanish text in titles THEN titles are preserved verbatim", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".pandacorp", "inbox", "decisions.md"),
        "# Decisions\n\n## OPEN: ¿Usar autenticación con NextAuth?\n- Contexto: Seguridad.\n",
      );
    });
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      const found = result.some(
        (dp) => dp.title.includes("autenticación") || dp.title.includes("NextAuth"),
      );
      expect(found).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-003.3 — WHEN decisions.md has only whitespace THEN returns [] without throwing (regression I2)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
      fs.writeFileSync(path.join(root, ".pandacorp", "inbox", "decisions.md"), "\n\n  \n\n");
    });
    try {
      expect(() => readDecisions(dir)).not.toThrow();
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Array.isArray(result)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: DecisionPoint shape invariants
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — AC-04-003.3 DecisionPoint shape invariants", () => {
  it("frd-04: WHEN readDecisions returns items THEN every item has title, resolved fields", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      expect("title" in dp).toBe(true);
      expect("resolved" in dp).toBe(true);
    }
  });

  it("frd-04: WHEN readDecisions returns items THEN recommendation is either undefined or a string (never null)", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    for (const dp of result) {
      if ("recommendation" in dp) {
        // If present, must be a string — never null.
        expect(dp.recommendation).not.toBeNull();
        if (dp.recommendation !== undefined) {
          expect(typeof dp.recommendation).toBe("string");
        }
      }
    }
  });

  it("frd-04: WHEN readDecisions returns items THEN the result survives a JSON round-trip unchanged (serializability)", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    const round = JSON.parse(JSON.stringify(result)) as unknown;
    expect(round).toEqual(result);
  });

  it("frd-04: WHEN readDecisions returns items THEN result is a genuine JS Array, not an array-like object (regression I3)", () => {
    const result = readDecisions(PROJ_A);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: read-only invariant (never writes)
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — read-only invariant (no writes)", () => {
  it("frd-04: WHEN readDecisions runs THEN the mtime of decisions.md is unchanged", () => {
    const decisionsPath = path.join(PROJ_A, ".pandacorp", "inbox", "decisions.md");
    const before = fs.statSync(decisionsPath);
    readDecisions(PROJ_A);
    const after = fs.statSync(decisionsPath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-04: WHEN readDecisions is called on a non-existent projectPath THEN no file or dir is created", () => {
    const ghostPath = "/tmp/pandacorp-decisions-ghost-wo04002";
    if (fs.existsSync(ghostPath)) fs.rmSync(ghostPath, { recursive: true, force: true });
    readDecisions(ghostPath);
    expect(fs.existsSync(ghostPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — readDecisions: idempotency
// ---------------------------------------------------------------------------

describe("frd-04: readDecisions — idempotency", () => {
  it("frd-04: WHEN readDecisions is called twice on proj-a THEN both return the same number of DecisionPoints", () => {
    const first = readDecisions(PROJ_A) as DecisionPoint[];
    const second = readDecisions(PROJ_A) as DecisionPoint[];
    expect(first.length).toBe(second.length);
  });

  it("frd-04: WHEN readDecisions is called twice on proj-a THEN both calls return identical titles", () => {
    const first = readDecisions(PROJ_A) as DecisionPoint[];
    const second = readDecisions(PROJ_A) as DecisionPoint[];
    const firstTitles = first.map((dp) => dp.title).sort();
    const secondTitles = second.map((dp) => dp.title).sort();
    expect(firstTitles).toEqual(secondTitles);
  });

  it("frd-04: WHEN readDecisions is called twice on a non-existent path THEN both return []", () => {
    const first = readDecisions("/nonexistent/ghost-wo04002") as DecisionPoint[];
    const second = readDecisions("/nonexistent/ghost-wo04002") as DecisionPoint[];
    expect(first).toHaveLength(0);
    expect(second).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: readActivityLog × readDecisions — orthogonality
// Two independent readers on the same project must not interfere.
// ---------------------------------------------------------------------------

describe("frd-04: readActivityLog × readDecisions — orthogonality (called together)", () => {
  it("frd-04: WHEN both are called on proj-a THEN neither throws and both return non-trivial results", () => {
    expect(() => {
      const log = readActivityLog(PROJ_A) as ActivityLog;
      const dps = readDecisions(PROJ_A) as DecisionPoint[];
      // proj-a fixture has content in both files
      expect(log.entries.length).toBeGreaterThan(0);
      expect(dps.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it("frd-04: WHEN both are called on a project with no .pandacorp/ dir THEN both return graceful empty values", () => {
    const dir = makeTempProject();
    try {
      const log = readActivityLog(dir) as ActivityLog;
      const dps = readDecisions(dir) as DecisionPoint[];
      expect(log.entries).toHaveLength(0);
      expect(dps).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: WHEN readActivityLog runs THEN decisions.md mtime is unchanged (no cross-contamination write)", () => {
    const decisionsPath = path.join(PROJ_A, ".pandacorp", "inbox", "decisions.md");
    const before = fs.statSync(decisionsPath);
    readActivityLog(PROJ_A);
    const after = fs.statSync(decisionsPath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-04: WHEN readDecisions runs THEN progress.md mtime is unchanged (no cross-contamination write)", () => {
    const progressPath = path.join(PROJ_A, ".pandacorp", "comms", "progress.md");
    const before = fs.statSync(progressPath);
    readDecisions(PROJ_A);
    const after = fs.statSync(progressPath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });
});

// ---------------------------------------------------------------------------
// Regression: B1' (NaN bypass) — length checks for both readers
// ---------------------------------------------------------------------------

describe("frd-04: regression B1' — readActivityLog + readDecisions counts must never be NaN", () => {
  it("frd-04: B1' — WHEN progress.md exists with bullets THEN entries.length is a finite integer", () => {
    const log = readActivityLog(PROJ_A) as ActivityLog;
    expect(Number.isFinite(log.entries.length)).toBe(true);
  });

  it("frd-04: B1' — WHEN decisions.md exists with blocks THEN result.length is a finite integer", () => {
    const result = readDecisions(PROJ_A) as DecisionPoint[];
    expect(Number.isFinite(result.length)).toBe(true);
  });

  it("frd-04: B1' — WHEN progress.md is absent THEN entries.length is 0 (not NaN)", () => {
    const dir = makeTempProject();
    try {
      const log = readActivityLog(dir) as ActivityLog;
      expect(Number.isFinite(log.entries.length)).toBe(true);
      expect(log.entries.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: B1' — WHEN decisions.md is absent THEN result.length is 0 (not NaN)", () => {
    const dir = makeTempProject();
    try {
      const result = readDecisions(dir) as DecisionPoint[];
      expect(Number.isFinite(result.length)).toBe(true);
      expect(result.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
