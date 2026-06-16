import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "./config";

/**
 * lib/memory.ts — lesson reader for factory/memory/ (WO-17-001, FRD-17, IF-17-memory).
 *
 * Reads all `factory/memory/LESSON-*.md` files into typed `Lesson` objects.
 * Implements `readLessons()`, `candidateLessons()`, `promotionQueue()`, `prunable()`.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude, never write.
 *
 * Traceability:
 *   IF-17-memory → REQ-17-002, REQ-17-007
 *   AC-17-001.1  frontmatter + body mapping
 *   AC-17-001.2  skip templates / README / _inbox
 *   AC-17-001.3  optional-field defaults; malformed → skip, no throw
 *   AC-17-001.4  evalGate derivation
 *   AC-17-001.5  projects parsing (conservative, no over-count)
 */

// ---------------------------------------------------------------------------
// Types (blueprint §3 IF-17-memory)
// ---------------------------------------------------------------------------

export type PromotionState = "none" | "proposed" | "approved" | "rejected";
export type LessonStatus = "candidate" | "active" | "deprecated";
export type EvalGate = "corroborated" | "awaiting-2nd";

export type Lesson = {
  id: string;
  type: string;
  domain: string;
  status: LessonStatus;
  promotion: PromotionState;
  source: string;
  links: string[];
  projects: string[];
  body: string;
  evalGate: EvalGate;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_LESSON_STATUSES: readonly LessonStatus[] = ["candidate", "active", "deprecated"];
const VALID_PROMOTION_STATES: readonly PromotionState[] = [
  "none",
  "proposed",
  "approved",
  "rejected",
];

/** Files inside factory/memory/ that are never lesson cards. */
const SKIP_FILES: readonly string[] = ["_lesson-template.md", "README.md", "_inbox.md"];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isLessonStatus(v: unknown): v is LessonStatus {
  return typeof v === "string" && (VALID_LESSON_STATUSES as readonly string[]).includes(v);
}

function isPromotionState(v: unknown): v is PromotionState {
  return typeof v === "string" && (VALID_PROMOTION_STATES as readonly string[]).includes(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

// ---------------------------------------------------------------------------
// projects extraction (AC-17-001.5)
//
// The source field uses the semi-structured format:
//   "proj-alpha (WO-01-001 review)"                 → ["proj-alpha"]
//   "proj-alpha (WO-01-001), proj-beta (WO-02-003)" → ["proj-alpha", "proj-beta"]
//   "docs/proposals/09-self-learning-factory.md …"  → [] (doc ref, no project)
//
// Strategy: split on ", " (comma-space), then for each segment take the
// leading token (up to the first space or paren). A token that looks like a
// file path (contains "/" or ".md") is not a project name. Deduplicate.
//
// Conservative: ambiguous inputs produce at most 1 entry (never fabricate
// a 2nd project to trigger auto-corroboration). A source with no recognizable
// project token yields [].
// ---------------------------------------------------------------------------

/** Return true if the token looks like a file-system path, not a project slug. */
function looksLikePath(token: string): boolean {
  return token.includes("/") || token.endsWith(".md");
}

/**
 * Parse distinct project names from the `source` field.
 *
 * Conservative rule (blueprint §6): when the format is ambiguous, fall back to
 * `awaiting-2nd` (i.e. return fewer entries rather than more).
 *
 * Strategy:
 *   1. Strip all parenthetical content `(...)` — those are context annotations
 *      (e.g. "WO-01-001 review", "deep-research 2026-06-15; ExpeL, arXiv:...")
 *      and their commas must NOT be treated as project separators.
 *   2. Split the cleaned string on ", " to get project entries.
 *   3. For each entry, take the leading alphanumeric slug token.
 *   4. Reject path-like tokens (containing "/" or ending in ".md").
 *
 * This prevents the adversarial case where a comma inside a parenthetical
 * note (e.g. "proj-alpha (note, with comma)") is split and the word after
 * the inner comma ("with") is counted as a phantom project.
 */
function parseProjects(source: string): string[] {
  if (!source || source.trim() === "") {
    return [];
  }

  // Step 1: strip all parenthetical content — the parens and everything inside.
  // This removes the context annotations that may contain commas.
  // Use a global replace so all parentheticals in the string are removed.
  const stripped = source.replace(/\([^)]*\)/g, "");

  // Step 2: split on ", " to separate project entries.
  const segments = stripped.split(", ");

  const projectNames: string[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Take the leading token: up to the first space or "(" character.
    const match = /^([^\s(]+)/.exec(trimmed);
    if (!match?.[1]) continue;

    const token = match[1];

    // Reject tokens that look like file paths.
    if (looksLikePath(token)) continue;

    // Reject tokens that don't look like a project slug.
    // A project slug is expected to be alphanumeric+hyphens (no dots, no slashes).
    // Being conservative: if the token contains characters that suggest it is
    // not a plain slug (e.g. parens without a preceding name), skip it.
    if (!/^[a-zA-Z0-9]/.test(token)) continue;

    projectNames.push(token);
  }

  // Deduplicate (AC-17-001.5 distinct count).
  return [...new Set(projectNames)];
}

// ---------------------------------------------------------------------------
// evalGate derivation (AC-17-001.4)
//
// "corroborated" if:
//   - status === "active"  (already corroborated by the librarian), OR
//   - projects.length >= 2 (seen in ≥2 distinct projects)
// "awaiting-2nd" otherwise.
// ---------------------------------------------------------------------------

function deriveEvalGate(status: LessonStatus, projects: string[]): EvalGate {
  if (status === "active") return "corroborated";
  // projects.length is always a real non-negative integer (Array.prototype.length
  // is never NaN), so the comparison is safe (regression B1').
  if (projects.length >= 2) return "corroborated";
  return "awaiting-2nd";
}

// ---------------------------------------------------------------------------
// File reader
// ---------------------------------------------------------------------------

/** Resolve the memory directory from the factory root at call time. */
function memoryDir(): string {
  return path.join(resolveFactoryRoot(), "factory", "memory");
}

/**
 * Read and parse all `LESSON-*.md` files from `factory/memory/`.
 *
 * - Skips `_lesson-template.md`, `README.md`, `_inbox.md`.
 * - Only processes files whose name matches `LESSON-*.md`.
 * - Malformed frontmatter → file skipped, never throws.
 * - Missing directory → returns [].
 * - Read-only: zero writes to disk (FRD-17 non-goal).
 *
 * @returns Array of typed `Lesson` objects; never throws.
 */
export function readLessons(): Lesson[] {
  const dir = memoryDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const lessons: Lesson[] = [];

  for (const filename of entries) {
    // Only process .md files matching LESSON-*.md (AC-17-001.2).
    if (!filename.endsWith(".md")) continue;

    // Skip the explicitly excluded files (AC-17-001.2).
    if ((SKIP_FILES as readonly string[]).includes(filename)) continue;

    // Only files that start with "LESSON-" (skip README, _inbox, _template
    // even if they somehow match .md and aren't in SKIP_FILES).
    if (!filename.startsWith("LESSON-")) continue;

    const filePath = path.join(dir, filename);

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    // Empty file → skip (AC-17-001.3).
    if (!raw.trim()) continue;

    let parsed: matter.GrayMatterFile<string>;
    try {
      // Pass { excerpt: false } to bypass gray-matter's internal content-based
      // cache that can cause a malformed parse to pollute the next call with
      // a stale empty object (regression: gray-matter cache bug 2026-06-16).
      parsed = matter(raw, { excerpt: false });
    } catch {
      // Malformed YAML frontmatter → skip file, no throw (AC-17-001.3).
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;

    // --- Required fields ---

    const id = typeof fm.id === "string" ? fm.id : undefined;
    const type = typeof fm.type === "string" ? fm.type : undefined;
    const domain = typeof fm.domain === "string" ? fm.domain : undefined;

    if (id === undefined || type === undefined || domain === undefined) {
      continue;
    }

    const status = isLessonStatus(fm.status) ? fm.status : undefined;
    if (status === undefined) continue;

    // --- Optional fields with safe defaults (AC-17-001.3) ---

    // promotion: default "none" if absent or not a valid PromotionState.
    const promotion: PromotionState = isPromotionState(fm.promotion) ? fm.promotion : "none";

    // source: must be a string; if it was parsed as an array (YAML block sequence),
    // coerce to a joined string rather than exposing it as unknown (regression I3).
    let source: string;
    if (typeof fm.source === "string") {
      source = fm.source;
    } else if (Array.isArray(fm.source)) {
      // Array-shaped source: join safely (I3 regression — do not expose string[]).
      source = (fm.source as unknown[]).filter((item) => typeof item === "string").join(", ");
    } else {
      source = "";
    }

    // links: default [] if absent or not a string[]; filter out non-string items
    // rather than rejecting the whole lesson (regression I2: empty array guard).
    let links: string[];
    if (isStringArray(fm.links)) {
      links = fm.links;
    } else if (Array.isArray(fm.links)) {
      // Partial array: keep only string items.
      links = (fm.links as unknown[]).filter((item): item is string => typeof item === "string");
    } else {
      links = [];
    }

    // body: gray-matter exposes content after the frontmatter as `.content`.
    const body: string = typeof parsed.content === "string" ? parsed.content.trim() : "";

    // --- Derived fields ---

    const projects = parseProjects(source);
    const evalGate = deriveEvalGate(status, projects);

    const lesson: Lesson = {
      id,
      type,
      domain,
      status,
      promotion,
      source,
      links,
      projects,
      body,
      evalGate,
    };

    lessons.push(lesson);
  }

  return lessons;
}

// ---------------------------------------------------------------------------
// Derived views (blueprint §3 IF-17-memory)
// ---------------------------------------------------------------------------

/**
 * All lessons with `status === "candidate"`.
 * REQ-17-002: candidate lessons stream in the proposals inbox.
 */
export function candidateLessons(): Lesson[] {
  return readLessons().filter((l) => l.status === "candidate");
}

/**
 * All lessons with `promotion === "proposed"`.
 * REQ-17-006: durable promotions queue.
 */
export function promotionQueue(): Lesson[] {
  return readLessons().filter((l) => l.promotion === "proposed");
}

/**
 * All lessons with `status === "deprecated"`.
 * REQ-17-002: prune proposals stream.
 */
export function prunable(): Lesson[] {
  return readLessons().filter((l) => l.status === "deprecated");
}
