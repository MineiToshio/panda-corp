import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discardChange } from "../discard-change";

/**
 * discardChange tests (FRD-04, mirrors lib/discard/discard.ts's proven pattern, ADR-0002).
 *
 * Each test builds a real project's .pandacorp/inbox/changes/ in a temp dir. The write
 * touches exactly one file, rewriting only `status` (+ `status_before_discard`) —
 * preserving the body and all other frontmatter fields verbatim.
 */

let projectPath: string;
let changesDir: string;

function writeChange(filename: string, body: string, subdir = ""): string {
  const dir = subdir === "" ? changesDir : path.join(changesDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, body, "utf-8");
  return dest;
}

function readFrontmatter(filePath: string): Record<string, unknown> {
  return matter(fs.readFileSync(filePath, "utf-8")).data as Record<string, unknown>;
}

function readBody(filePath: string): string {
  return matter(fs.readFileSync(filePath, "utf-8")).content;
}

const READY_ITEM = `---
type: feature
class: standard
status: ready
date: 2026-07-01
frd: frd-05-settings
rebuilds_verified: false
depends_on:
---

# Agrega exportar a CSV

## Qué se quiere
Un botón que exporte a CSV.
`;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "mc-discard-change-"));
  changesDir = path.join(projectPath, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(changesDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("discardChange — happy path", () => {
  it("rewrites status to discarded for a ready item, preserving the body", () => {
    const dest = writeChange("mc-export-csv.md", READY_ITEM);
    const bodyBefore = readBody(dest);

    const result = discardChange(projectPath, "mc-export-csv");

    expect(result).toEqual({ ok: true });
    const fm = readFrontmatter(dest);
    expect(fm.status).toBe("discarded");
    expect(fm.status_before_discard).toBe("ready");
    expect(readBody(dest)).toBe(bodyBefore);
  });

  it("discards a draft item too", () => {
    const dest = writeChange(
      "mc-draft-idea.md",
      READY_ITEM.replace("status: ready", "status: draft"),
    );
    const result = discardChange(projectPath, "mc-draft-idea");
    expect(result).toEqual({ ok: true });
    expect(readFrontmatter(dest).status).toBe("discarded");
    expect(readFrontmatter(dest).status_before_discard).toBe("draft");
  });

  it("preserves every other frontmatter field verbatim", () => {
    const dest = writeChange("mc-export-csv.md", READY_ITEM);
    const fmBefore = readFrontmatter(dest);

    discardChange(projectPath, "mc-export-csv");

    const fmAfter = readFrontmatter(dest);
    for (const key of Object.keys(fmBefore)) {
      if (key === "status") continue;
      expect(fmAfter[key]).toEqual(fmBefore[key]);
    }
  });

  it("touches no sibling file (write isolation)", () => {
    writeChange("mc-export-csv.md", READY_ITEM);
    const other = writeChange("mc-other.md", READY_ITEM.replace("mc-export-csv", "mc-other"));
    const mtimeBefore = fs.statSync(other).mtimeMs;

    discardChange(projectPath, "mc-export-csv");

    expect(fs.statSync(other).mtimeMs).toBe(mtimeBefore);
  });
});

describe("discardChange — not-discardable guard", () => {
  it("refuses to discard a done item still sitting in the active queue", () => {
    // Structurally, a done item lives in done/ (DR-069) — but the guard must hold even
    // for the edge case of a done-status file still in the active dir.
    const dest = writeChange("mc-old-fix.md", READY_ITEM.replace("status: ready", "status: done"));
    const before = fs.readFileSync(dest, "utf-8");

    const result = discardChange(projectPath, "mc-old-fix");

    expect(result).toEqual({ ok: false, reason: "not-discardable" });
    expect(fs.readFileSync(dest, "utf-8")).toBe(before);
  });

  it("refuses to re-discard an already-discarded item", () => {
    const dest = writeChange(
      "mc-already-discarded.md",
      READY_ITEM.replace("status: ready", "status: discarded"),
    );
    const before = fs.readFileSync(dest, "utf-8");

    const result = discardChange(projectPath, "mc-already-discarded");

    expect(result).toEqual({ ok: false, reason: "not-discardable" });
    expect(fs.readFileSync(dest, "utf-8")).toBe(before);
  });
});

describe("discardChange — error paths", () => {
  it("returns not-found for a missing id", () => {
    const result = discardChange(projectPath, "mc-nonexistent");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for an empty id", () => {
    const result = discardChange(projectPath, "");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a path-traversal id (never escapes the changes dir)", () => {
    const result = discardChange(projectPath, "../../../etc/passwd");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns parse-error for malformed YAML frontmatter, leaving the file untouched", () => {
    const dest = writeChange("mc-broken.md", "---\ntype: bug\n  bad: [unclosed\n---\n# t\nbody");
    const before = fs.readFileSync(dest, "utf-8");

    const result = discardChange(projectPath, "mc-broken");

    expect(result).toEqual({ ok: false, reason: "parse-error" });
    expect(fs.readFileSync(dest, "utf-8")).toBe(before);
  });

  it("does not discard an item that only exists in done/ (only the active queue is scanned)", () => {
    writeChange("mc-shipped.md", READY_ITEM.replace("status: ready", "status: done"), "done");
    const result = discardChange(projectPath, "mc-shipped");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});
