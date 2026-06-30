/**
 * lib/achievements/report/lessons.ts — IF-10-lessons (`lessonCounts`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only. Honesty (DR-078): when a source is
 * missing the reader returns `null` → the UI renders "no cableado", never a fabricated 0/0.
 *
 *   - distilled → count of `factory/memory/LESSON-*.md` cards (reuse lib/memory `readLessons`)
 *   - captured  → non-empty lines of `factory/memory/_inbox.md`
 *
 * Traceability: AC-10-014.5.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "../../config/config";
import { readLessons } from "../../memory/memory";
import type { LessonCounts } from "./types";

/** Injected source counts; a `null` source means "no cableado" (missing/unreadable). */
export type LessonSources = {
  readonly distilled: number | null;
  readonly captured: number | null;
} | null;

/**
 * Pure derivation of the lesson counts (IF-10-lessons core).
 * Any missing source (null) collapses the whole result to null ("no cableado") — never a
 * fabricated 0; a real 0/0 (empty-but-present memory) is a legitimate `{ distilled: 0, captured: 0 }`.
 */
export function deriveLessonCounts(sources: LessonSources): LessonCounts | null {
  if (sources === null) return null;
  if (sources.distilled === null || sources.captured === null) return null;
  return { distilled: sources.distilled, captured: sources.captured };
}

/** Count non-empty lines of a file, or null when the file is absent/unreadable. */
function countNonEmptyLines(filePath: string): number | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  return raw.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * Read the distilled-vs-captured lesson counts from `factory/memory/` (fail-loud).
 *
 * When the memory directory is absent the result is `null` ("no cableado"); otherwise
 * distilled = LESSON-*.md count, captured = inbox non-empty lines (a missing inbox alone
 * is a legitimate captured = 0 once the memory dir exists).
 *
 * @returns A `LessonCounts`, or `null` when the source is missing.
 */
export function lessonCounts(): LessonCounts | null {
  const memoryDir = path.join(resolveFactoryRoot(), "factory", "memory");
  if (!fs.existsSync(memoryDir)) return deriveLessonCounts(null);

  const distilled = readLessons().length;
  const inboxLines = countNonEmptyLines(path.join(memoryDir, "_inbox.md"));
  // The memory dir exists → an absent inbox is a real captured=0, not "no cableado".
  const captured = inboxLines ?? 0;
  return deriveLessonCounts({ distilled, captured });
}
