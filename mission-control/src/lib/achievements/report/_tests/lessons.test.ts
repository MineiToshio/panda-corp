/**
 * RED → GREEN tests for IF-10-lessons (`lessonCounts` / `deriveLessonCounts`), WO-10-014, AC-10-014.5.
 *
 * Distilled (LESSON-*.md) vs captured (inbox lines), or an explicit null → "no cableado"
 * when a source is missing. Pure derivation driven with injected counts + a real-fixture read.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withFactoryRoot } from "../../../../tests/fixtures/index";
import { deriveLessonCounts, lessonCounts } from "../lessons";

describe("deriveLessonCounts — pure", () => {
  it("returns distilled + captured when both sources are present", () => {
    expect(deriveLessonCounts({ distilled: 2, captured: 131 })).toEqual({
      distilled: 2,
      captured: 131,
    });
  });

  it("a missing source (null) → null (no cableado), never a fabricated 0", () => {
    expect(deriveLessonCounts({ distilled: 2, captured: null })).toBeNull();
    expect(deriveLessonCounts({ distilled: null, captured: 131 })).toBeNull();
    expect(deriveLessonCounts(null)).toBeNull();
  });

  it("a real empty memory (0 distilled, 0 captured) is a legitimate zero, NOT null", () => {
    expect(deriveLessonCounts({ distilled: 0, captured: 0 })).toEqual({
      distilled: 0,
      captured: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Real-fixture read (DR-078: the actual shape it meets in production)
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-report-lessons-"));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeMemory(files: Record<string, string>): void {
  const dir = path.join(tmpRoot, "factory", "memory");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, "utf-8");
  }
}

const REAL_LESSON = `---
id: LESSON-0001
type: anti-pattern
domain: build
status: active
promotion: none
source: mission-control (WO-10-014)
---
A real distilled lesson body.
`;

describe("lessonCounts — real fixture", () => {
  it("counts LESSON-*.md as distilled and inbox non-empty lines as captured", async () => {
    writeMemory({
      "LESSON-0001-anti.md": REAL_LESSON,
      "_inbox.md": "note one\nnote two\n\nnote three\n",
      "README.md": "not a lesson",
      "_lesson-template.md": "template",
    });
    const counts = await withFactoryRoot(tmpRoot, () => lessonCounts());
    expect(counts).toEqual({ distilled: 1, captured: 3 });
  });

  it("a missing memory directory → null (no cableado), never 0/0 fabricated", async () => {
    const counts = await withFactoryRoot(tmpRoot, () => lessonCounts());
    expect(counts).toBeNull();
  });
});
