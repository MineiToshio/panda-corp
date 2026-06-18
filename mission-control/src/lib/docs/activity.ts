// =============================================================================
// IF-04-docs — WO-04-002
// `readActivityLog` + `readDecisions`: comms readers for the Summary tab.
//
// Traceability:
//   AC-04-003.2 Summary tab renders the activity log from .pandacorp/comms/progress.md.
//   AC-04-003.3 Summary tab renders decision points from .pandacorp/inbox/decisions.md.
//   REQ-04-003  Summary tab reads both comms files.
//   REQ-04-004  Pending decisions are highlighted; count = filter(!resolved).length.
//
// Files are Spanish, gitignored, owner-facing comms (architecture §4.5) — read as-is.
// Read-only: no writes, no Claude calls.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { pathExists } from "../fs-utils/fs-utils";

/**
 * The parsed activity log from `.pandacorp/comms/progress.md`.
 *
 * `entries` is a genuine JS Array of non-empty strings, each representing a
 * bullet line from the file (the leading "- " prefix is stripped).
 * Absent or empty file → `{ entries: [] }`. Never throws.
 */
export interface ActivityLog {
  /** Each bullet-line item from progress.md, trimmed, leading "- " stripped. */
  entries: string[];
}

/**
 * A single decision block parsed from `.pandacorp/inbox/decisions.md`.
 *
 * `title`          — the text after "OPEN:" or "CLOSED:" in the heading (trimmed).
 * `recommendation` — text after a `- **Recommendation:**` line in the block, or
 *                    `undefined` when the block has no such line.
 * `resolved`       — `true` for CLOSED blocks, `false` for OPEN blocks.
 */
export interface DecisionPoint {
  title: string;
  recommendation?: string;
  resolved: boolean;
}

/**
 * Parse `.pandacorp/comms/progress.md` into an ActivityLog.
 *
 * Collects all lines that start with "- " (optionally after trimming leading spaces),
 * strips the "- " prefix, and returns them as `entries`.
 *
 * Fail-soft tolerance:
 *   - Absent file → `{ entries: [] }` (no throw; AC-04-003.2 empty state).
 *   - Non-existent projectPath → `{ entries: [] }` (no throw).
 *   - Empty or whitespace-only file → `{ entries: [] }` (regression I2 vacuous-truth).
 *   - entries.length is always a genuine finite integer (regression B1').
 *   - entries is always a genuine JS Array (regression I3).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns `ActivityLog` with `entries` as a genuine JS Array. Never throws.
 */
export function readActivityLog(projectPath: string): ActivityLog {
  const empty: ActivityLog = { entries: [] };

  if (!projectPath || projectPath.trim() === "") {
    return empty;
  }
  if (!pathExists(projectPath)) {
    return empty;
  }

  const progressPath = path.join(projectPath, ".pandacorp", "comms", "progress.md");
  if (!pathExists(progressPath)) {
    return empty;
  }

  let content: string;
  try {
    content = fs.readFileSync(progressPath, "utf-8");
  } catch {
    return empty;
  }

  // Collect genuine bullet lines (lines starting with "- " after leading whitespace).
  // Regression I2: only non-blank entries after stripping the prefix.
  // Regression I3: built with push into a genuine Array literal.
  const entries: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ")) {
      const text = trimmed.slice(2).trim();
      // Regression I2: never push blank entries.
      if (text.length > 0) {
        entries.push(text);
      }
    }
  }

  return { entries };
}

/**
 * Parse `.pandacorp/inbox/decisions.md` into an array of DecisionPoint objects.
 *
 * The file is expected to contain `## OPEN: <title>` or `## CLOSED: <title>` (or
 * `## RESOLVED: <title>`) section headings. Each heading opens a new block; lines
 * within the block are scanned for an optional
 * `- **Recommendation:** <text>` line.
 *
 * Fail-soft tolerance:
 *   - Absent file → `[]` (no throw; AC-04-003.3 empty state).
 *   - Non-existent projectPath → `[]` (no throw).
 *   - Empty or whitespace-only file → `[]` (regression I2 vacuous-truth).
 *   - result.length is always a genuine finite integer (regression B1').
 *   - Result is always a genuine JS Array (regression I3).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns `DecisionPoint[]` — genuine JS Array. Never throws.
 */
export function readDecisions(projectPath: string): DecisionPoint[] {
  if (!projectPath || projectPath.trim() === "") {
    return [];
  }
  if (!pathExists(projectPath)) {
    return [];
  }

  const decisionsPath = path.join(projectPath, ".pandacorp", "inbox", "decisions.md");
  if (!pathExists(decisionsPath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(decisionsPath, "utf-8");
  } catch {
    return [];
  }

  // Pattern for OPEN / CLOSED / RESOLVED headings at H2 level.
  // The status word is captured in group 1; the title text in group 2.
  const BLOCK_HEADING = /^##\s+(OPEN|CLOSED|RESOLVED):\s*(.+)/i;
  // Pattern for a recommendation bullet: "- **Recommendation:** <text>"
  // Both bold styles: **Recommendation:** or *Recommendation:*
  const RECOMMENDATION_LINE = /^-\s+\*{1,2}Recommendation:\*{1,2}\s*(.+)/i;

  // Regression I3: genuine Array built with push.
  const result: DecisionPoint[] = [];

  let currentStatus: string | null = null;
  let currentTitle: string | null = null;
  let currentRecommendation: string | undefined;

  const flush = (): void => {
    if (currentTitle !== null && currentTitle.trim().length > 0 && currentStatus !== null) {
      const resolved = currentStatus.toUpperCase() !== "OPEN";
      const dp: DecisionPoint = { title: currentTitle, resolved };
      if (currentRecommendation !== undefined) {
        dp.recommendation = currentRecommendation;
      }
      result.push(dp);
    }
  };

  for (const line of content.split("\n")) {
    const headingMatch = BLOCK_HEADING.exec(line);
    if (headingMatch) {
      // Flush the previous block before starting a new one.
      flush();
      currentStatus = headingMatch[1] ?? null;
      currentTitle = (headingMatch[2] ?? "").trim();
      currentRecommendation = undefined;
      continue;
    }

    if (currentTitle !== null) {
      const recMatch = RECOMMENDATION_LINE.exec(line);
      if (recMatch) {
        const text = (recMatch[1] ?? "").trim();
        if (text.length > 0) {
          currentRecommendation = text;
        }
      }
    }
  }

  // Flush the last block.
  flush();

  return result;
}
