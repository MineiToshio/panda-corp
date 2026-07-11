/**
 * WO-05-001 — `lib/work-orders.ts`: discover + parse work orders
 * WO-05-005 — `readWorkOrderDoc`: raw content reader for the Full document tab
 *
 * Implements IF-05-work-orders (blueprint §2).
 *
 * Traceability:
 *   REQ-05-002   EACH card SHALL indicate which FRD it belongs to.
 *   REQ-05-003   WHEN the owner clicks a work order, show Summary + Full document tabs.
 *   REQ-05-005   The kanban SHALL reflect live state (read-only).
 *   AC-05-002.1  Each WorkOrder carries frd = the parent feature slug.
 *   AC-05-003.2  The Full document tab renders the entire work order markdown.
 *   AC-05-005.1  Read-only; state is derived from on-disk markers.
 *   AC-05-006.1  No work orders → [] (consumed by CMP-05-empty for empty state).
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

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
  /**
   * Upstream work-order ids this WO depends on (DR-087) — read verbatim from the
   * frontmatter `dependsOn` list, the machine-readable source of truth for the
   * dependency graph. Absent/empty when the WO has no declared dependencies.
   */
  dependsOn?: string[];
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
// Used for the legacy ## Status: body marker.
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
// DR-050 frontmatter `implementation_status` support
//
// Values: PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED
// Mapping to WorkOrderState:
//   PLANNED     → "todo"
//   IN_PROGRESS → "in_progress"
//   IN_REVIEW   → "review"
//   VERIFIED    → "done"
//   BLOCKED     → "fail"
// ---------------------------------------------------------------------------
const FRONTMATTER_STATUS_MAP: Record<string, WorkOrderState> = {
  planned: "todo",
  in_progress: "in_progress",
  in_review: "review",
  verified: "done",
  blocked: "fail",
};

/**
 * Parse YAML frontmatter and extract `implementation_status`.
 *
 * Returns the mapped WorkOrderState if `implementation_status` is a recognised
 * DR-050 value, or `null` if absent / unrecognised (so the caller falls back
 * to the legacy ## Status: body marker).
 *
 * Partial-tolerant: malformed YAML → returns null (never throws).
 *
 * gray-matter gotcha (factory/memory/_inbox.md, 2026-06-16): passing
 * `{ excerpt: false }` bypasses the internal LRU cache so a previously-failed
 * parse cannot shadow a valid one later in the same process.
 */
function parseFrontmatterStatus(content: string): WorkOrderState | null {
  try {
    const parsed = matter(content, { excerpt: false });
    const raw = parsed.data.implementation_status;
    if (typeof raw !== "string" || raw.trim() === "") {
      return null;
    }
    const key = raw.trim().toLowerCase();
    return FRONTMATTER_STATUS_MAP[key] ?? null;
  } catch {
    // Malformed YAML → fall back to legacy body marker.
    return null;
  }
}

/** A well-formed work-order id, e.g. "WO-12-003". */
const WO_ID_TOKEN = /^WO-\d{2,}-\d{3,}$/;

/**
 * Parse `dependsOn` from frontmatter — the work order's explicit upstream WO ids
 * (DR-087: dependencies live in the frontmatter, the machine-readable source of
 * truth for the dependency graph). Accepts a YAML list of strings; keeps only
 * well-formed WO ids, de-duplicated. Returns [] when absent.
 *
 * Partial-tolerant: malformed YAML → [] (never throws).
 */
function parseFrontmatterDeps(content: string): string[] {
  try {
    const parsed = matter(content, { excerpt: false });
    const raw = parsed.data.dependsOn;
    if (!Array.isArray(raw)) return [];
    const ids = raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => WO_ID_TOKEN.test(v));
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Per-file parsing (partial-tolerant — never throws)
// ---------------------------------------------------------------------------

/** Title: first H1 line (# …), trimmed; fallback to filename stem. */
function deriveTitle(lines: readonly string[], absPath: string): string {
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  return path.basename(absPath, ".md");
}

/** ID: first WO-\d\d-\d\d\d token in the title, else derived from filename. */
function deriveId(title: string, absPath: string): string {
  const titleIdMatch = /\b(WO-\d{2,}-\d{3,})\b/.exec(title);
  if (titleIdMatch?.[1]) {
    return titleIdMatch[1];
  }
  // Derive from filename: "wo-05-001-work-orders-reader.md" → "WO-05-001"
  const fnMatch = /^(wo-\d{2,}-\d{3,})/i.exec(path.basename(absPath));
  if (fnMatch?.[1]) {
    return fnMatch[1].toUpperCase();
  }
  return path.basename(absPath, ".md");
}

/**
 * Legacy ## Status: body-marker scan. A heading marker wins over a plain one.
 * Returns the normalised WorkOrderState, or "todo" when no marker is present.
 */
function deriveLegacyBodyState(lines: readonly string[]): WorkOrderState {
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
  return stateRaw ? normaliseState(stateRaw) : "todo";
}

/**
 * State derivation — DR-050 frontmatter takes precedence over the legacy
 * ## Status: body marker.
 *
 * Precedence:
 *   1. frontmatter `implementation_status` (DR-050, source of truth when present)
 *   2. ## Status: body marker (legacy retrocompat — projects not yet migrated)
 *   3. Default: "todo" (partial-tolerant)
 */
function deriveState(content: string, lines: readonly string[]): WorkOrderState {
  const frontmatterState = parseFrontmatterStatus(content);
  if (frontmatterState !== null) {
    return frontmatterState;
  }
  return deriveLegacyBodyState(lines);
}

/** Summary: text under a "## Summary" section, first non-empty paragraph. */
function deriveWorkOrderSummary(content: string): string | undefined {
  const summaryRe = /^#{1,6}\s+Summary\s*$/im;
  const summaryStart = summaryRe.exec(content);
  if (!summaryStart) return undefined;
  const after = content.slice((summaryStart.index ?? 0) + summaryStart[0].length);
  // Collect lines until the next heading or end of file.
  const paragraphLines: string[] = [];
  for (const line of after.split("\n")) {
    if (/^#{1,6}\s/.test(line)) break;
    paragraphLines.push(line);
  }
  const paragraph = paragraphLines.join("\n").trim();
  return paragraph.length > 0 ? paragraph : undefined;
}

function parseWorkOrderFile(absPath: string, frdSlug: string, projectPath: string): WorkOrder {
  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf-8");
  } catch {
    // unreadable → todo
  }

  const lines = content.split("\n");
  const title = deriveTitle(lines, absPath);
  const id = deriveId(title, absPath);
  const state = deriveState(content, lines);
  const summary = deriveWorkOrderSummary(content);
  const dependsOn = parseFrontmatterDeps(content);

  // relPath: forward-slash relative path from project root.
  const relPath = path.relative(projectPath, absPath).split(path.sep).join("/");

  return {
    id: id.trim(),
    title: title.trim(),
    frd: frdSlug.trim(),
    state,
    relPath: relPath.trim(),
    ...(summary !== undefined ? { summary } : {}),
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
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
/** True when `absPath` is a directory (fail-soft: any stat error → false). */
function isRealInTree(absPath: string, projectPath: string, kind: "file" | "directory"): boolean {
  try {
    const entry = fs.lstatSync(absPath);
    const rootEntry = fs.lstatSync(projectPath);
    if (entry.isSymbolicLink() || rootEntry.isSymbolicLink() || !rootEntry.isDirectory())
      return false;
    if (kind === "directory" ? !entry.isDirectory() : !entry.isFile()) return false;
    const rootReal = fs.realpathSync(projectPath);
    return (
      fs.realpathSync(absPath) ===
      path.join(rootReal, path.relative(path.resolve(projectPath), path.resolve(absPath)))
    );
  } catch {
    return false;
  }
}

/** True when `absPath` is a regular file (fail-soft: any stat error → false). */
const isDirectorySafe = (absPath: string, projectPath: string): boolean =>
  isRealInTree(absPath, projectPath, "directory");
const isFileSafe = (absPath: string, projectPath: string): boolean =>
  isRealInTree(absPath, projectPath, "file");

/**
 * Parse all wo-*.md files in a single FRD's work-orders/ directory.
 * Absent/unreadable work-orders/ → [] (not an error).
 */
function listWorkOrdersForFrd(frdPath: string, frdSlug: string, projectPath: string): WorkOrder[] {
  const woDir = path.join(frdPath, "work-orders");
  if (!isDirectorySafe(woDir, projectPath)) return [];
  let woEntries: string[];
  try {
    woEntries = fs.readdirSync(woDir);
  } catch {
    // No work-orders/ dir → 0 items for this FRD
    return [];
  }

  const results: WorkOrder[] = [];
  for (const woFile of woEntries) {
    // Only process files matching wo-*.md
    if (!/^wo-.+\.md$/i.test(woFile)) continue;

    const woAbsPath = path.join(woDir, woFile);
    if (!isFileSafe(woAbsPath, projectPath)) continue;

    results.push(parseWorkOrderFile(woAbsPath, frdSlug, projectPath));
  }
  return results;
}

export function listWorkOrders(projectPath: string): WorkOrder[] {
  if (!projectPath || projectPath.trim() === "") return [];

  const frdsDir = path.join(projectPath, "docs", "frds");
  if (!isDirectorySafe(frdsDir, projectPath)) return [];

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
    if (!isDirectorySafe(frdPath, projectPath)) continue;

    results.push(...listWorkOrdersForFrd(frdPath, entry, projectPath));
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

// ---------------------------------------------------------------------------
// WO-05-005 — readWorkOrderDoc (Full document tab, AC-05-003.2)
//
// Reads the raw markdown content of a work order file, given its relPath
// (as stored in WorkOrder.relPath, relative to projectPath).
//
// Security model: relPath must match the pattern for work order files:
//   docs/frds/frd-NN-<slug>/work-orders/wo-*.md
// Any path outside this pattern (traversal, absolute, etc.) returns null.
//
// Separate from lib/docs.ts readDoc, which only surfaces docs discovered by
// listProjectDocs (FRD/blueprint/etc.) — work order files are not in that
// set (architecture §4.5).
//
// Read-only: only fs.readFileSync — no writes, no Claude calls.
// Fail-soft: any fs error or security rejection → null (never throws).
// ---------------------------------------------------------------------------

/** Pattern a valid work-order relPath must satisfy (prevents traversal). */
const WO_REL_PATH_PATTERN = /^docs\/frds\/frd-\d[^/]*\/work-orders\/wo-[^/]+\.md$/;

/**
 * Read the raw markdown of a work order file.
 *
 * AC-05-003.2: the Full document tab SHALL render the entire work order markdown.
 *
 * @param projectPath - Absolute path to the project root.
 * @param relPath     - Relative path from the project root (from WorkOrder.relPath).
 * @returns Raw markdown string, or null when the path is invalid / unreadable.
 */
export function readWorkOrderDoc(projectPath: string, relPath: string): string | null {
  // Guard: blank inputs.
  if (!projectPath || !relPath || relPath.trim() === "") return null;

  // Security: only accept work-order relPaths matching the canonical pattern.
  // Rejects absolute paths, traversal (".."), symlinks outside the tree, etc.
  if (!WO_REL_PATH_PATTERN.test(relPath)) return null;

  // Additional traversal guard: no ".." components allowed anywhere.
  if (relPath.includes("..")) return null;

  const absPath = path.join(projectPath, relPath);

  // Verify the resolved path starts with projectPath (no escaping via symlinks
  // or edge cases in path.join on unusual inputs).
  const resolvedProject = path.resolve(projectPath);
  const resolvedFile = path.resolve(absPath);
  if (!resolvedFile.startsWith(resolvedProject + path.sep)) return null;

  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
}
