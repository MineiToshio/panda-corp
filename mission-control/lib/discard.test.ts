/**
 * WO-02-004 — `discardIdea` — RED phase
 *
 * Tests are written BEFORE the implementation (`lib/discard.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-02-007.1  WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                `status: discarded` in the `.md` frontmatter, preserving the rest
 *                of the file (Pandacorp's only write).
 *
 * EARS breakdown:
 *   - WHEN slug exists and file is parseable → status becomes "discarded", body + all
 *     other frontmatter fields preserved verbatim.
 *   - WHEN slug is already discarded → idempotent, returns { ok: true }.
 *   - WHEN slug does not exist → { ok: false, reason: "not-found" }, nothing written.
 *   - WHEN file has unparseable frontmatter → { ok: false, reason: "parse-error" },
 *     file left untouched.
 *   - WHEN discardIdea runs on one card, no OTHER file in the tree is modified
 *     (write isolation: this is the single write in the whole codebase).
 *
 * Regression anchors from .pandacorp/comms/progress.md (past incidents → regression tests):
 *   B1' (2026-06-16): NaN and non-finite numbers bypass numeric guards — parser-level
 *     incident. Regression here: the discard write MUST NOT corrupt numeric frontmatter
 *     fields (score, etc.) to NaN or drop them.
 *   I2 (2026-06-16): empty/array objects satisfied vacuous checks — regression here:
 *     after discard, frontmatter fields that were objects/arrays MUST be preserved
 *     as-is, not silently emptied.
 *   I3 (2026-06-16): array-shaped values fool typeof — regression here: if a card
 *     has an array-valued frontmatter field, discardIdea MUST preserve it verbatim,
 *     not coerce it.
 *   B-2 (2026-06-16, layout.guard.test): write-isolation invariant must be killed by
 *     mutation; every sibling file is stat-checked before and after the call.
 *
 * Design notes:
 *   - Operates on a COPY of the fixture in a temp dir so the source fixture is never
 *     mutated. `PANDACORP_FACTORY_ROOT` points at the temp tree.
 *   - `discardIdea(slug, ideasDir?)` — ideasDir defaults to config.IDEAS_DIR when
 *     omitted; tests pass an explicit dir to stay isolated.
 *   - The function is NOT async (pure fs.readFileSync + fs.writeFileSync).
 *
 * Stack: Vitest + gray-matter (already in package.json).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The module under test (does not exist yet — tests are RED).
import { discardIdea } from "./discard";

// ---------------------------------------------------------------------------
// Temp-dir harness
// ---------------------------------------------------------------------------

/** Absolute path to the live temp ideas dir for the current test. */
let tmpDir: string;

/** Copy one fixture card into the temp ideas dir. Returns the path of the copy. */
function seedCard(fixtureName: string, asName?: string): string {
  const src = path.join(
    import.meta.dirname,
    "../tests/fixtures/factory-full/factory/ideas",
    fixtureName,
  );
  const destName = asName ?? fixtureName;
  const dest = path.join(tmpDir, destName);
  fs.copyFileSync(src, dest);
  return dest;
}

/** Write an ad-hoc card file directly into the temp dir. */
function writeCard(name: string, content: string): string {
  const dest = path.join(tmpDir, name);
  fs.writeFileSync(dest, content, "utf-8");
  return dest;
}

/** Read parsed frontmatter from a file. */
function readFrontmatter(filePath: string): Record<string, unknown> {
  return matter(fs.readFileSync(filePath, "utf-8")).data as Record<string, unknown>;
}

/** Read body (content after frontmatter) from a file. */
function readBody(filePath: string): string {
  return matter(fs.readFileSync(filePath, "utf-8")).content;
}

/** Return a map of { relativeName → mtime } for every .md file in the given dir. */
function snapshotMtimes(dir: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    const full = path.join(dir, entry);
    result.set(entry, fs.statSync(full).mtimeMs);
  }
  return result;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discard-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC-02-007.1 — happy path: status → "discarded", rest of file preserved
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — happy path (AC-02-007.1)", () => {
  it("frd-02: WHEN owner presses discard on a discovered card THEN returns { ok: true }", () => {
    seedCard("idea-discovered.md");
    const result = discardIdea("idea-discovered", tmpDir);
    expect(result).toEqual({ ok: true });
  });

  it('frd-02: WHEN owner presses discard on a discovered card THEN status is rewritten to "discarded"', () => {
    const dest = seedCard("idea-discovered.md");
    discardIdea("idea-discovered", tmpDir);
    const fm = readFrontmatter(dest);
    expect(fm["status"]).toBe("discarded");
  });

  it("frd-02: WHEN owner discards an idea THEN the body text is preserved verbatim", () => {
    const dest = seedCard("idea-discovered.md");
    const bodyBefore = readBody(dest);
    discardIdea("idea-discovered", tmpDir);
    expect(readBody(dest)).toBe(bodyBefore);
  });

  it("frd-02: WHEN owner discards an idea THEN title frontmatter field is preserved verbatim", () => {
    const dest = seedCard("idea-discovered.md");
    const fmBefore = readFrontmatter(dest);
    discardIdea("idea-discovered", tmpDir);
    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["title"]).toBe(fmBefore["title"]);
  });

  it("frd-02: WHEN owner discards an idea THEN project_type frontmatter field is preserved verbatim", () => {
    const dest = seedCard("idea-discovered.md");
    const fmBefore = readFrontmatter(dest);
    discardIdea("idea-discovered", tmpDir);
    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["project_type"]).toBe(fmBefore["project_type"]);
  });

  it("frd-02: WHEN owner discards an idea THEN return_type frontmatter field is preserved verbatim", () => {
    const dest = seedCard("idea-discovered.md");
    const fmBefore = readFrontmatter(dest);
    discardIdea("idea-discovered", tmpDir);
    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["return_type"]).toBe(fmBefore["return_type"]);
  });

  it("frd-02: WHEN owner discards an idea THEN score frontmatter field is preserved verbatim (regression B1': no NaN corruption)", () => {
    const dest = seedCard("idea-discovered.md");
    const fmBefore = readFrontmatter(dest);
    discardIdea("idea-discovered", tmpDir);
    const fmAfter = readFrontmatter(dest);
    // Score must be the exact numeric value — not NaN, not undefined, not coerced
    expect(fmAfter["score"]).toBe(fmBefore["score"]);
    expect(Number.isFinite(fmAfter["score"] as number)).toBe(true);
  });

  it("frd-02: WHEN owner discards an idea THEN no new frontmatter fields are added", () => {
    const dest = seedCard("idea-discovered.md");
    const keysBefore = Object.keys(readFrontmatter(dest)).sort();
    discardIdea("idea-discovered", tmpDir);
    const keysAfter = Object.keys(readFrontmatter(dest)).sort();
    // Exactly the same keys; status is updated in-place, nothing added
    expect(keysAfter).toEqual(keysBefore);
  });

  it('frd-02: WHEN owner discards a recommended card THEN returns { ok: true } and status becomes "discarded"', () => {
    const dest = seedCard("idea-recommended.md");
    const result = discardIdea("idea-recommended", tmpDir);
    expect(result).toEqual({ ok: true });
    expect(readFrontmatter(dest)["status"]).toBe("discarded");
  });

  it('frd-02: WHEN owner discards an in-pipeline card THEN returns { ok: true } and status becomes "discarded"', () => {
    const dest = seedCard("idea-in-pipeline.md");
    const result = discardIdea("idea-in-pipeline", tmpDir);
    expect(result).toEqual({ ok: true });
    expect(readFrontmatter(dest)["status"]).toBe("discarded");
  });

  it('frd-02: WHEN owner discards a shipped card THEN returns { ok: true } and status becomes "discarded"', () => {
    const dest = seedCard("idea-shipped.md");
    const result = discardIdea("idea-shipped", tmpDir);
    expect(result).toEqual({ ok: true });
    expect(readFrontmatter(dest)["status"]).toBe("discarded");
  });
});

// ---------------------------------------------------------------------------
// AC-02-007.1 — idempotency: already-discarded card
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — idempotency (AC-02-007.1)", () => {
  it("frd-02: WHEN owner discards an already-discarded card THEN returns { ok: true }", () => {
    seedCard("idea-discarded.md");
    const result = discardIdea("idea-discarded", tmpDir);
    expect(result).toEqual({ ok: true });
  });

  it('frd-02: WHEN owner discards an already-discarded card THEN status remains "discarded"', () => {
    const dest = seedCard("idea-discarded.md");
    discardIdea("idea-discarded", tmpDir);
    expect(readFrontmatter(dest)["status"]).toBe("discarded");
  });

  it("frd-02: WHEN owner discards a card twice THEN second call also returns { ok: true }", () => {
    seedCard("idea-discovered.md");
    discardIdea("idea-discovered", tmpDir);
    const secondResult = discardIdea("idea-discovered", tmpDir);
    expect(secondResult).toEqual({ ok: true });
  });

  it('frd-02: WHEN owner discards a card twice THEN final status is still "discarded" (no double-wrap)', () => {
    const dest = seedCard("idea-discovered.md");
    discardIdea("idea-discovered", tmpDir);
    discardIdea("idea-discovered", tmpDir);
    expect(readFrontmatter(dest)["status"]).toBe("discarded");
  });
});

// ---------------------------------------------------------------------------
// AC-02-007.1 — error path: missing slug
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — not-found error path (AC-02-007.1)", () => {
  it('frd-02: WHEN slug does not match any file THEN returns { ok: false, reason: "not-found" }', () => {
    const result = discardIdea("idea-nonexistent", tmpDir);
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("frd-02: WHEN slug does not match any file THEN no file is created in the ideas dir", () => {
    const filesBefore = fs.readdirSync(tmpDir);
    discardIdea("idea-nonexistent", tmpDir);
    const filesAfter = fs.readdirSync(tmpDir);
    expect(filesAfter).toEqual(filesBefore);
  });

  it('frd-02: WHEN slug is an empty string THEN returns { ok: false, reason: "not-found" }', () => {
    const result = discardIdea("", tmpDir);
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it('frd-02: WHEN slug contains path-traversal characters THEN returns { ok: false, reason: "not-found" } (no escape from ideasDir)', () => {
    // Path traversal must not resolve outside the ideasDir
    const result = discardIdea("../../etc/passwd", tmpDir);
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

// ---------------------------------------------------------------------------
// AC-02-007.1 — error path: unparseable frontmatter
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — parse-error error path (AC-02-007.1)", () => {
  it('frd-02: WHEN file has broken frontmatter THEN returns { ok: false, reason: "parse-error" }', () => {
    // idea-malformed.md has an unclosed title string — gray-matter throws
    seedCard("idea-malformed.md");
    const result = discardIdea("idea-malformed", tmpDir);
    expect(result).toEqual({ ok: false, reason: "parse-error" });
  });

  it("frd-02: WHEN file has broken frontmatter THEN the file content is left untouched", () => {
    const dest = seedCard("idea-malformed.md");
    const contentBefore = fs.readFileSync(dest, "utf-8");
    discardIdea("idea-malformed", tmpDir);
    expect(fs.readFileSync(dest, "utf-8")).toBe(contentBefore);
  });

  it('frd-02: WHEN a card is a directory (not a file) THEN returns { ok: false, reason: "not-found" } or "parse-error" without throwing', () => {
    // A directory named idea-dir.md should be handled gracefully, not crash
    fs.mkdirSync(path.join(tmpDir, "idea-dir.md"));
    const result = discardIdea("idea-dir", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["not-found", "parse-error"]).toContain(result.reason);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-02-007.1 — write isolation: only the targeted card is modified
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — write isolation (architecture §1/§7)", () => {
  it("frd-02: WHEN owner discards one card THEN no other .md file in the ideas dir is modified", () => {
    // Seed all fixture cards so there are multiple siblings
    seedCard("idea-discovered.md");
    seedCard("idea-recommended.md");
    seedCard("idea-in-pipeline.md");
    seedCard("idea-shipped.md");
    seedCard("idea-discarded.md");

    // Snapshot mtimes of all files BEFORE the call
    const mtimesBefore = snapshotMtimes(tmpDir);

    discardIdea("idea-discovered", tmpDir);

    const mtimesAfter = snapshotMtimes(tmpDir);

    // Every sibling (not the target) must have the same mtime
    for (const [name, mtimeBefore] of mtimesBefore) {
      if (name === "idea-discovered.md") continue; // the target — allowed to change
      expect(mtimesAfter.get(name), `Sibling file "${name}" was unexpectedly modified`).toBe(
        mtimeBefore,
      );
    }
  });

  it("frd-02: WHEN owner discards one card THEN the file count in the ideas dir does not change", () => {
    seedCard("idea-discovered.md");
    seedCard("idea-recommended.md");
    const countBefore = fs.readdirSync(tmpDir).length;
    discardIdea("idea-discovered", tmpDir);
    expect(fs.readdirSync(tmpDir).length).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: cards with non-standard but valid frontmatter
// ---------------------------------------------------------------------------

describe("frd-02: discardIdea — frontmatter preservation edge cases", () => {
  it("frd-02: WHEN a card has an array-valued frontmatter field THEN it is preserved verbatim after discard (regression I3)", () => {
    // Array values must not be coerced (regression I3: array-shaped objects fool typeof)
    const cardContent = [
      "---",
      "title: Array card",
      "status: discovered",
      "tags:",
      "  - ai",
      "  - tool",
      "score: 50",
      "---",
      "",
      "Body text.",
    ].join("\n");
    const dest = writeCard("idea-array.md", cardContent);
    const fmBefore = readFrontmatter(dest);

    discardIdea("idea-array", tmpDir);

    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["tags"]).toEqual(fmBefore["tags"]);
  });

  it("frd-02: WHEN a card has an object-valued frontmatter field THEN it is preserved verbatim after discard (regression I2)", () => {
    // Object fields must not be emptied vacuously (regression I2)
    const cardContent = [
      "---",
      "title: Object card",
      "status: discovered",
      "meta:",
      "  source: indie-hackers",
      "  validated: true",
      "score: 55",
      "---",
      "",
      "Body with object meta.",
    ].join("\n");
    const dest = writeCard("idea-object.md", cardContent);
    const fmBefore = readFrontmatter(dest);

    discardIdea("idea-object", tmpDir);

    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["meta"]).toEqual(fmBefore["meta"]);
  });

  it("frd-02: WHEN a card has a numeric score of 0 THEN score is preserved as 0 after discard (not dropped as falsy)", () => {
    const cardContent = [
      "---",
      "title: Zero score card",
      "status: discovered",
      "score: 0",
      "---",
      "",
      "Body.",
    ].join("\n");
    const dest = writeCard("idea-zero.md", cardContent);
    discardIdea("idea-zero", tmpDir);
    expect(readFrontmatter(dest)["score"]).toBe(0);
  });

  it("frd-02: WHEN a card body contains YAML-like text THEN the body is preserved exactly after discard", () => {
    const cardContent = [
      "---",
      "title: Body with YAML",
      "status: discovered",
      "score: 70",
      "---",
      "",
      "## Key points",
      "- key: value",
      "- another: thing",
      "  sub: nested",
    ].join("\n");
    const dest = writeCard("idea-yaml-body.md", cardContent);
    const bodyBefore = readBody(dest);
    discardIdea("idea-yaml-body", tmpDir);
    expect(readBody(dest)).toBe(bodyBefore);
  });

  it("frd-02: WHEN a card body is empty (no content after frontmatter) THEN body remains empty after discard", () => {
    const cardContent = [
      "---",
      "title: Empty body",
      "status: discovered",
      "score: 40",
      "---",
      "",
    ].join("\n");
    const dest = writeCard("idea-empty-body.md", cardContent);
    discardIdea("idea-empty-body", tmpDir);
    // Body must not have content injected
    expect(readBody(dest).trim()).toBe("");
  });

  it("frd-02: WHEN a card has no score field THEN discardIdea succeeds and score field remains absent", () => {
    const cardContent = [
      "---",
      "title: No score",
      "status: discovered",
      "project_type: cli",
      "---",
      "",
      "No score here.",
    ].join("\n");
    const dest = writeCard("idea-no-score.md", cardContent);
    discardIdea("idea-no-score", tmpDir);
    const fmAfter = readFrontmatter(dest);
    expect(fmAfter["status"]).toBe("discarded");
    expect(Object.hasOwn(fmAfter, "score")).toBe(false);
  });
});
