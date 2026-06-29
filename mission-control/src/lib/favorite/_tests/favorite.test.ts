/**
 * setFavorite — mark / unmark an idea card as a favourite (visual-only flag).
 *
 * AC-02-012.1 — marking writes `favorite: true`, preserving body + other frontmatter.
 * AC-02-012.2 — unmarking removes the `favorite` field (the card stays byte-clean).
 * The flag never touches `status` or any other field (visual-only, FRD-02 REQ-02-012).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setFavorite } from "../favorite";

let tmpDir: string;

function writeCard(name: string, content: string): string {
  const dest = path.join(tmpDir, name);
  fs.writeFileSync(dest, content, "utf-8");
  return dest;
}

function card(opts: { favorite?: boolean; status?: string } = {}): string {
  const lines = [
    "---",
    "title: A favourite-able idea",
    `status: ${opts.status ?? "discovered"}`,
    ...(opts.favorite !== undefined ? [`favorite: ${opts.favorite}`] : []),
    "project_type: web",
    "score: 71",
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "favorite-test-"));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("frd-02: setFavorite — marking (AC-02-012.1)", () => {
  it("returns { ok: true, favorite: true } and writes favorite: true", () => {
    const dest = card();
    const result = setFavorite("idea", true, tmpDir);
    expect(result).toEqual({ ok: true, favorite: true });
    expect(readFrontmatter(dest).favorite).toBe(true);
  });

  it("is idempotent when the card is already a favourite", () => {
    const dest = card({ favorite: true });
    const result = setFavorite("idea", true, tmpDir);
    expect(result).toEqual({ ok: true, favorite: true });
    expect(readFrontmatter(dest).favorite).toBe(true);
  });

  it("does NOT change the card status or its column (visual-only)", () => {
    const dest = card({ status: "in-pipeline" });
    setFavorite("idea", true, tmpDir);
    expect(readFrontmatter(dest).status).toBe("in-pipeline");
  });

  it("preserves the body and all other frontmatter fields verbatim", () => {
    const dest = card();
    const bodyBefore = readBody(dest);
    setFavorite("idea", true, tmpDir);
    const fm = readFrontmatter(dest);
    expect(readBody(dest)).toBe(bodyBefore);
    expect(fm.title).toBe("A favourite-able idea");
    expect(fm.project_type).toBe("web");
    expect(fm.score).toBe(71);
  });
});

describe("frd-02: setFavorite — unmarking (AC-02-012.2)", () => {
  it("returns { ok: true, favorite: false } and removes the favorite field", () => {
    const dest = card({ favorite: true });
    const result = setFavorite("idea", false, tmpDir);
    expect(result).toEqual({ ok: true, favorite: false });
    expect(readFrontmatter(dest).favorite).toBeUndefined();
  });

  it("is idempotent when the card was never a favourite", () => {
    const dest = card();
    const result = setFavorite("idea", false, tmpDir);
    expect(result).toEqual({ ok: true, favorite: false });
    expect(readFrontmatter(dest).favorite).toBeUndefined();
  });

  it("mark → unmark round-trips the field back to absent", () => {
    const dest = card();
    setFavorite("idea", true, tmpDir);
    setFavorite("idea", false, tmpDir);
    expect(readFrontmatter(dest).favorite).toBeUndefined();
  });
});

describe("frd-02: setFavorite — guards", () => {
  it("returns not-found for an empty slug (no fs access)", () => {
    expect(setFavorite("", true, tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a missing file", () => {
    expect(setFavorite("nope", true, tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a path-traversal slug (never escapes the dir)", () => {
    expect(setFavorite("../secret", true, tmpDir)).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns parse-error and leaves the file untouched on malformed frontmatter", () => {
    const dest = writeCard("idea.md", "---\nstatus: discovered\n  bad: : :\n---\nbody");
    const before = fs.readFileSync(dest, "utf-8");
    const result = setFavorite("idea", true, tmpDir);
    expect(result.ok).toBe(false);
    expect(fs.readFileSync(dest, "utf-8")).toBe(before);
  });
});
