/**
 * restoreIdea — "Volver a agregar" (un-discard) write. Inverse of discardIdea.
 *
 * AC-02-007.3 — restore returns a discarded card to its prior status
 *   (status_before_discard, fallback "discovered") and clears discard_reason +
 *   status_before_discard, preserving the body + all other frontmatter verbatim.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restoreIdea } from "../restore";

let tmpDir: string;

function writeCard(name: string, content: string): string {
  const dest = path.join(tmpDir, name);
  fs.writeFileSync(dest, content, "utf-8");
  return dest;
}

function discardedCard(opts: { before?: string; reason?: string; extra?: string } = {}): string {
  const lines = [
    "---",
    "title: A discarded idea",
    "status: discarded",
    ...(opts.before !== undefined ? [`status_before_discard: ${opts.before}`] : []),
    ...(opts.reason !== undefined ? [`discard_reason: ${opts.reason}`] : []),
    "project_type: web",
    "score: 71",
    ...(opts.extra !== undefined ? [opts.extra] : []),
    "---",
    "",
    "The full proposal body, preserved verbatim.",
  ];
  return writeCard("idea.md", lines.join("\n"));
}

function readFrontmatter(filePath: string): Record<string, unknown> {
  return matter(fs.readFileSync(filePath, "utf-8")).data as Record<string, unknown>;
}

function readBody(filePath: string): string {
  return matter(fs.readFileSync(filePath, "utf-8")).content;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "restore-test-"));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("frd-02: restoreIdea — happy path (AC-02-007.3)", () => {
  it("returns { ok: true, restoredTo } with the prior status", () => {
    discardedCard({ before: "recommended", reason: "saturado" });
    const result = restoreIdea("idea", tmpDir);
    expect(result).toEqual({ ok: true, restoredTo: "recommended" });
  });

  it("rewrites status back to the prior status", () => {
    const dest = discardedCard({ before: "recommended", reason: "saturado" });
    restoreIdea("idea", tmpDir);
    expect(readFrontmatter(dest).status).toBe("recommended");
  });

  it("clears discard_reason and status_before_discard", () => {
    const dest = discardedCard({ before: "discovered", reason: "muy complejo" });
    restoreIdea("idea", tmpDir);
    const fm = readFrontmatter(dest);
    expect(fm.discard_reason).toBeUndefined();
    expect(fm.status_before_discard).toBeUndefined();
  });

  it("falls back to 'discovered' when no prior status was recorded", () => {
    const dest = discardedCard({ reason: "x" }); // no status_before_discard
    const result = restoreIdea("idea", tmpDir);
    expect(result).toEqual({ ok: true, restoredTo: "discovered" });
    expect(readFrontmatter(dest).status).toBe("discovered");
  });

  it("falls back to 'discovered' when the recorded prior status is invalid", () => {
    const dest = discardedCard({ before: "bogus", reason: "x" });
    restoreIdea("idea", tmpDir);
    expect(readFrontmatter(dest).status).toBe("discovered");
  });

  it("preserves the body and other frontmatter fields verbatim", () => {
    const dest = discardedCard({ before: "in-pipeline", reason: "x" });
    const bodyBefore = readBody(dest);
    restoreIdea("idea", tmpDir);
    const fm = readFrontmatter(dest);
    expect(readBody(dest)).toBe(bodyBefore);
    expect(fm.title).toBe("A discarded idea");
    expect(fm.project_type).toBe("web");
    expect(fm.score).toBe(71);
  });

  it("discard → restore round-trips back to the original status", () => {
    const dest = discardedCard({ before: "recommended", reason: "x" });
    restoreIdea("idea", tmpDir);
    expect(readFrontmatter(dest).status).toBe("recommended");
  });
});

describe("frd-02: restoreIdea — guards", () => {
  it("returns not-found for an empty slug (no fs access)", () => {
    expect(restoreIdea("", tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a missing file", () => {
    expect(restoreIdea("nope", tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a path-traversal slug (never escapes the dir)", () => {
    expect(restoreIdea("../secret", tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns parse-error and leaves the file untouched on malformed frontmatter", () => {
    const dest = writeCard("idea.md", "---\nstatus: discarded\n  bad: : :\n---\nbody");
    const before = fs.readFileSync(dest, "utf-8");
    const result = restoreIdea("idea", tmpDir);
    expect(result.ok).toBe(false);
    expect(fs.readFileSync(dest, "utf-8")).toBe(before);
  });
});
