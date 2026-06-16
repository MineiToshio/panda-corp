/**
 * WO-05-001 — `lib/work-orders.ts`: discover + parse work orders
 *
 * Implements IF-05-work-orders (blueprint §2).
 *
 * Traceability:
 *   REQ-05-002   EACH card SHALL indicate which FRD it belongs to.
 *   REQ-05-005   The kanban SHALL reflect live state (read-only).
 *   AC-05-002.1  Each WorkOrder carries frd = the parent feature slug.
 *   AC-05-005.1  Read-only; state is derived from on-disk markers.
 *   AC-05-006.1  No work orders → [] (consumed by CMP-05-empty for empty state).
 */

import fs from "node:fs";
import path from "node:path";

export type WorkOrderState = "todo" | "in_progress" | "review" | "done" | "fail";

export interface WorkOrder {
  /** e.g. "WO-05-003" — unique per project */
  id: string;
  title: string;
  /** The source feature slug, e.g. "frd-05-work-orders" */
  frd: string;
  state: WorkOrderState;
  /** Relative path (forward slashes) from project root to the wo markdown file */
  relPath: string;
  /** Short description for the Summary tab (optional) */
  summary?: string;
}

export interface WorkOrderProgress {
  done: number;
  total: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// State marker regex
// Matches:
//   ## Status: done
//   ## Status: DONE
//   **Status:** done
//   Status: **DONE**
//   Status: IN_PROGRESS
// Case-insensitive; value captured in group 1. Anchored to line start (optionally
// a heading "##" or bold) so prose like "...the Status: blocked situation..." or
// "status: IdeaStatus" mid-line cannot shadow the canonical marker (WO-05-001 adv).
// ---------------------------------------------------------------------------
const STATUS_LINE_RE =
  /^\s{0,3}(?:#{1,6}\s*)?(?:\*{1,2}Status:?\*{0,2}|\*{0,2}Status\*{0,2}:)\s*\*{0,2}([^\s*\n]+)/i;

// Canonical value map — producer writes these; we normalise to WorkOrderState.
const STATE_MAP: Record<string, WorkOrderState> = {
  todo: "todo",
  in_progress: "in_progress",
  in_progress_alt: "in_progress",
  review: "review",
  done: "done",
  fail: "fail",
  blocked: "fail",
};

function normaliseState(raw: string): WorkOrderState {
  const key = raw.trim().toLowerCase();
  return STATE_MAP[key] ?? "todo";
}

// ---------------------------------------------------------------------------
// Per-file parsing (partial-tolerant — never throws)
// ---------------------------------------------------------------------------
function parseWorkOrderFile(absPath: string, frdSlug: string, projectPath: string): WorkOrder {
  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf-8");
  } catch {
    // unreadable → todo
  }

  const lines = content.split("\n");

  // Title: first H1 line (# …), trimmed; fallback to filename stem.
  let title = "";
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line);
    if (m?.[1]) {
      title = m[1].trim();
      break;
    }
  }
  if (!title) {
    title = path.basename(absPath, ".md");
  }

  // ID: first token that matches WO-\d\d-\d\d\d in the title, or derived from filename.
  let id = "";
  const titleIdMatch = /\b(WO-\d{2,}-\d{3,})\b/.exec(title);
  if (titleIdMatch?.[1]) {
    id = titleIdMatch[1];
  } else {
    // Derive from filename: "wo-05-001-work-orders-reader.md" → "WO-05-001"
    const fnMatch = /^(wo-\d{2,}-\d{3,})/i.exec(path.basename(absPath));
    if (fnMatch?.[1]) {
      id = fnMatch[1].toUpperCase();
    } else {
      id = path.basename(absPath, ".md");
    }
  }

  // State from the on-disk marker. Prefer the canonical "## Status:" heading over
  // any other line-start marker, and ignore "Status:" embedded mid-prose, so an
  // earlier narrative mention can't shadow the real marker (WO-05-001 adversarial).
  let state: WorkOrderState = "todo";
  let headingState: string | undefined;
  let plainState: string | undefined;
  for (const line of lines) {
    const m = STATUS_LINE_RE.exec(line);
    if (!m?.[1]) continue;
    if (/^\s{0,3}#{1,6}/.test(line)) {
      if (headingState === undefined) headingState = m[1];
    } else if (plainState === undefined) {
      plainState = m[1];
    }
  }
  const stateRaw = headingState ?? plainState;
  if (stateRaw) {
    state = normaliseState(stateRaw);
  }

  // Summary: text under a "## Summary" section, first non-empty paragraph.
  let summary: string | undefined;
  const summaryRe = /^#{1,6}\s+Summary\s*$/im;
  const summaryStart = summaryRe.exec(content);
  if (summaryStart) {
    const after = content.slice((summaryStart.index ?? 0) + summaryStart[0].length);
    // Collect lines until the next heading or end of file.
    const paragraphLines: string[] = [];
    for (const line of after.split("\n")) {
      if (/^#{1,6}\s/.test(line)) break;
      paragraphLines.push(line);
    }
    const paragraph = paragraphLines.join("\n").trim();
    if (paragraph.length > 0) {
      summary = paragraph;
    }
  }

  // relPath: forward-slash relative path from project root.
  const relPath = path.relative(projectPath, absPath).split(path.sep).join("/");

  return {
    id: id.trim(),
    title: title.trim(),
    frd: frdSlug.trim(),
    state,
    relPath: relPath.trim(),
    ...(summary !== undefined ? { summary } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover work orders across ALL features:
 * docs/frds/frd-NN-SLUG/work-orders/wo-*.md
 *
 * For each file, returns id, title, frd (parent feature slug), state,
 * relPath and optional summary.
 *
 * Partial-tolerant: an unparseable work order defaults to state "todo".
 * Absent work-orders/ directory → 0 items for that FRD (not an error).
 * Never throws.
 * Read-only (no fs.write* calls).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns Array of WorkOrder. Empty array when none found.
 */
export function listWorkOrders(projectPath: string): WorkOrder[] {
  if (!projectPath || projectPath.trim() === "") return [];

  const frdsDir = path.join(projectPath, "docs", "frds");

  let frdEntries: string[];
  try {
    frdEntries = fs.readdirSync(frdsDir);
  } catch {
    // docs/frds/ absent or unreadable → no work orders
    return [];
  }

  const results: WorkOrder[] = [];

  for (const entry of frdEntries) {
    // Only process directories matching frd-<digit>...
    if (!/^frd-\d/.test(entry)) continue;

    const frdPath = path.join(frdsDir, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(frdPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const woDir = path.join(frdPath, "work-orders");
    let woEntries: string[];
    try {
      woEntries = fs.readdirSync(woDir);
    } catch {
      // No work-orders/ dir → 0 items for this FRD
      continue;
    }

    for (const woFile of woEntries) {
      // Only process files matching wo-*.md
      if (!/^wo-.+\.md$/i.test(woFile)) continue;

      const woAbsPath = path.join(woDir, woFile);
      try {
        const wfStat = fs.statSync(woAbsPath);
        if (!wfStat.isFile()) continue;
      } catch {
        continue;
      }

      const wo = parseWorkOrderFile(woAbsPath, entry, projectPath);
      results.push(wo);
    }
  }

  return results;
}

/**
 * Aggregate progress across a list of work orders.
 *
 * Pure function: no fs calls.
 *
 * @param orders - The full list of work orders for a project.
 * @returns {done, total, pct} where pct is rounded to 1 decimal place.
 */
export function aggregateProgress(orders: WorkOrder[]): WorkOrderProgress {
  const total = orders.length;
  const done = orders.filter((o) => o.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
  return { done, total, pct };
}
