import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

/**
 * lib/backlog.ts — reader for the factory's actionable work queue (FRD-22, DR-103).
 *
 * Reads all `factory/backlog/BL-*.md` items into typed `BacklogItem` objects.
 * The backlog is plane-3 (actionable, closeable) — the counterpart of the plane-1
 * memory store this app already reads. Read-only: never writes, never calls Claude.
 *
 * Fail-loud read boundary (DR-078): a malformed `BL-*.md` (unparseable YAML,
 * missing a required field, or an out-of-range enum) is NOT silently dropped —
 * it is surfaced in `errors[]` so the UI can render an error state instead of a
 * misleadingly-empty list. Valid items still parse; "empty" and "could not
 * interpret" are distinct outcomes.
 *
 * Traceability:
 *   IF-22-backlog → REQ-22-001 (read BL-* items), REQ-22-004 (fail-loud)
 */

// ---------------------------------------------------------------------------
// Types (blueprint §3 IF-22-backlog)
// ---------------------------------------------------------------------------

type BacklogType = "bug" | "change";
export type BacklogStatus = "open" | "doing" | "done";
export type BacklogSeverity = "p0" | "p1" | "p2";

export type BacklogItem = {
  id: string;
  type: BacklogType;
  area: string;
  title: string;
  status: BacklogStatus;
  severity: BacklogSeverity | null;
  source: string;
  closes: string;
  links: string[];
  opened: string;
  closed: string | null;
  /** The markdown body (everything after the frontmatter) — rendered in the detail view. */
  body: string;
};

/** A file that could not be interpreted as a backlog item (fail-loud, DR-078). */
type BacklogReadError = { file: string; reason: string };

/**
 * The result of reading the backlog: the valid items PLUS any files that could
 * not be parsed. A non-empty `errors` array means the caller must render an
 * error state (never treat it as a legitimately-empty backlog).
 */
export type BacklogReadResult = {
  items: BacklogItem[];
  errors: BacklogReadError[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES: readonly BacklogType[] = ["bug", "change"];
const VALID_STATUSES: readonly BacklogStatus[] = ["open", "doing", "done"];
const VALID_SEVERITIES: readonly BacklogSeverity[] = ["p0", "p1", "p2"];

/** Files inside factory/backlog/ that are never backlog items. */
const SKIP_FILES: readonly string[] = ["README.md", "_item-template.md"];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isBacklogType(v: unknown): v is BacklogType {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

function isBacklogStatus(v: unknown): v is BacklogStatus {
  return typeof v === "string" && (VALID_STATUSES as readonly string[]).includes(v);
}

function isBacklogSeverity(v: unknown): v is BacklogSeverity {
  return typeof v === "string" && (VALID_SEVERITIES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Coercion helpers for optional fields
// ---------------------------------------------------------------------------

/** Coerce a scalar frontmatter value to a trimmed string ("" when absent). */
function coerceString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

/** Coerce a YAML date/scalar to an ISO `YYYY-MM-DD` string, or null when absent. */
function coerceDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

/** Coerce the `links` frontmatter field to a string[] (keeps only string items). */
function coerceLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// ---------------------------------------------------------------------------
// File reader
// ---------------------------------------------------------------------------

/** Resolve the backlog directory from the factory root at call time. */
function backlogDir(): string {
  return path.join(resolveFactoryRoot(), "factory", "backlog");
}

/** True when a filename should be parsed as a backlog item (BL-*.md, not skipped). */
function isBacklogFile(filename: string): boolean {
  if (!filename.endsWith(".md")) return false;
  if ((SKIP_FILES as readonly string[]).includes(filename)) return false;
  return filename.startsWith("BL-");
}

type ParseOutcome = { item: BacklogItem } | { error: string };

/**
 * Parse a single `BL-*.md` file into a `BacklogItem`, or return a fail-loud
 * `{ error }` describing why it could not be interpreted (DR-078).
 */
function parseBacklogFile(filePath: string): ParseOutcome {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { error: "file could not be read" };
  }

  if (!raw.trim()) return { error: "file is empty" };

  let parsed: matter.GrayMatterFile<string>;
  try {
    // { excerpt: false } bypasses gray-matter's content-keyed cache (a stale
    // empty object after a prior malformed parse — regression 2026-06-16).
    parsed = matter(raw, { excerpt: false });
  } catch {
    return { error: "malformed YAML frontmatter" };
  }

  const fm = parsed.data as Record<string, unknown>;

  const id = typeof fm.id === "string" ? fm.id : undefined;
  if (id === undefined) return { error: "missing required field: id" };
  if (!isBacklogType(fm.type)) return { error: `${id}: invalid or missing type (bug|change)` };
  const area = coerceString(fm.area);
  if (area === "") return { error: `${id}: missing required field: area` };
  const title = coerceString(fm.title);
  if (title === "") return { error: `${id}: missing required field: title` };
  if (!isBacklogStatus(fm.status)) {
    return { error: `${id}: invalid or missing status (open|doing|done)` };
  }

  return {
    item: {
      id,
      type: fm.type,
      area,
      title,
      status: fm.status,
      severity: isBacklogSeverity(fm.severity) ? fm.severity : null,
      source: coerceString(fm.source),
      closes: coerceString(fm.closes),
      links: coerceLinks(fm.links),
      opened: coerceDate(fm.opened) ?? "",
      closed: coerceDate(fm.closed),
      body: typeof parsed.content === "string" ? parsed.content.trim() : "",
    },
  };
}

/**
 * Read and parse all `BL-*.md` items from `factory/backlog/`.
 *
 * - Skips `README.md`, `_item-template.md`.
 * - A missing directory is a legitimately-empty backlog → `{ items: [], errors: [] }`.
 * - A malformed item is surfaced in `errors[]` (fail-loud, DR-078) — never dropped.
 * - Read-only: zero writes to disk.
 */
export function readBacklog(): BacklogReadResult {
  const dir = backlogDir();
  if (!fs.existsSync(dir)) {
    return { items: [], errors: [] };
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { items: [], errors: [{ file: dir, reason: "backlog directory could not be read" }] };
  }

  const items: BacklogItem[] = [];
  const errors: BacklogReadError[] = [];

  for (const filename of entries) {
    if (!isBacklogFile(filename)) continue;
    const outcome = parseBacklogFile(path.join(dir, filename));
    if ("item" in outcome) {
      items.push(outcome.item);
    } else {
      errors.push({ file: filename, reason: outcome.error });
    }
  }

  return { items, errors };
}
