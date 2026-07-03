import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discardBacklogItem } from "../discard-backlog";

/**
 * discardBacklogItem tests (FRD-22, mirrors lib/changes/discard-change.ts's proven
 * pattern, DR-103). Each test builds a real factory/backlog/ in a temp dir, points
 * PANDACORP_FACTORY_ROOT at it. The write touches exactly one file, rewriting only
 * `status` (+ `status_before_discard`) — preserving the body and all other
 * frontmatter fields verbatim.
 */

let tmpRoot: string;
let backlogDir: string;
const prevEnv = process.env.PANDACORP_FACTORY_ROOT;

function writeItem(filename: string, body: string): string {
  const dest = path.join(backlogDir, filename);
  fs.writeFileSync(dest, body, "utf-8");
  return dest;
}

function readFrontmatter(filePath: string): Record<string, unknown> {
  return matter(fs.readFileSync(filePath, "utf-8")).data as Record<string, unknown>;
}

const OPEN_ITEM = `---
id: BL-0001
type: bug
area: build-engine
title: A real closeable defect
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0002
closes:
links: [LESSON-0002]
---

## Problem
Something is wrong.
`;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-discard-backlog-"));
  backlogDir = path.join(tmpRoot, "factory", "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
});

afterEach(() => {
  if (prevEnv === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = prevEnv;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("discardBacklogItem — success", () => {
  it("rewrites status to discarded and records status_before_discard, preserving the body", () => {
    const filePath = writeItem("BL-0001-real.md", OPEN_ITEM);
    const result = discardBacklogItem("BL-0001");
    expect(result).toEqual({ ok: true });

    const fm = readFrontmatter(filePath);
    expect(fm.status).toBe("discarded");
    expect(fm.status_before_discard).toBe("open");
    // Other fields preserved verbatim.
    expect(fm.severity).toBe("p1");
    expect(fm.area).toBe("build-engine");

    const raw = fs.readFileSync(filePath, "utf-8");
    expect(raw).toContain("Something is wrong.");
  });

  it("discards a doing item", () => {
    const filePath = writeItem(
      "BL-0002-doing.md",
      OPEN_ITEM.replace("status: open", "status: doing").replace("BL-0001", "BL-0002"),
    );
    const result = discardBacklogItem("BL-0002");
    expect(result).toEqual({ ok: true });
    const fm = readFrontmatter(filePath);
    expect(fm.status).toBe("discarded");
    expect(fm.status_before_discard).toBe("doing");
  });
});

describe("discardBacklogItem — refusals", () => {
  it("refuses a done item (not-discardable) and leaves the file untouched", () => {
    const filePath = writeItem(
      "BL-0003-done.md",
      OPEN_ITEM.replace("status: open", "status: done").replace("BL-0001", "BL-0003"),
    );
    const before = fs.readFileSync(filePath, "utf-8");
    const result = discardBacklogItem("BL-0003");
    expect(result).toEqual({ ok: false, reason: "not-discardable" });
    expect(fs.readFileSync(filePath, "utf-8")).toBe(before);
  });

  it("refuses an already-discarded item", () => {
    writeItem(
      "BL-0004-discarded.md",
      OPEN_ITEM.replace("status: open", "status: discarded").replace("BL-0001", "BL-0004"),
    );
    const result = discardBacklogItem("BL-0004");
    expect(result).toEqual({ ok: false, reason: "not-discardable" });
  });

  it("returns not-found for a missing id", () => {
    const result = discardBacklogItem("BL-9999");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for an empty id", () => {
    const result = discardBacklogItem("");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found for a path-traversal id", () => {
    const result = discardBacklogItem("../outside");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns parse-error for malformed YAML frontmatter, leaving the file untouched", () => {
    const filePath = writeItem(
      "BL-0005-broken.md",
      "---\nid: BL-0005\n  bad: [unclosed\n---\nbody",
    );
    const before = fs.readFileSync(filePath, "utf-8");
    const result = discardBacklogItem("BL-0005");
    expect(result).toEqual({ ok: false, reason: "parse-error" });
    expect(fs.readFileSync(filePath, "utf-8")).toBe(before);
  });
});
