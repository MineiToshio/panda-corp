import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * lib/changes.ts — reader for a project's change queue (FRD-04, DR-069, DR-078).
 *
 * Reads `.pandacorp/inbox/changes/*.md` (pending) and `.../changes/done/*.md`
 * (archived) into typed `ChangeQueueItem` objects. The queue is written by
 * `/pandacorp:change`, `/pandacorp:bug` and `/pandacorp:iterate` (the build's
 * drain engine) — Mission Control only reads it.
 *
 * Fail-loud read boundary (DR-078): a malformed change file (unparseable YAML,
 * an invalid/missing `type` or `status`, or a body with no H1 title) is NOT
 * silently dropped — it is surfaced in `errors[]` so the UI can render an error
 * state instead of a misleadingly-empty list.
 *
 * Traceability:
 *   IF-04-changes → REQ-04-006 (read the change queue), REQ-04-007 (fail-loud)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChangeType = "bug" | "feature" | "change";
type ChangeClass = "expedite" | "standard" | "intangible" | "fixed-date";
export type ChangeQueueStatus = "ready" | "draft" | "done";

export type ChangeQueueItem = {
  /** Filename stem (no `.md`) — the same slug `/pandacorp:implement change:<id>` expects. */
  id: string;
  type: ChangeType;
  cls: ChangeClass;
  status: ChangeQueueStatus;
  date: string;
  frd: string;
  rebuildsVerified: boolean;
  dependsOn: string;
  /** One-line title — the body's first `# ` (H1) heading. */
  title: string;
  /** The markdown body with that first H1 line removed — rendered in the detail view. */
  body: string;
};

/** A file that could not be interpreted as a change item (fail-loud, DR-078). */
type ChangeReadError = { file: string; reason: string };

export type ChangeQueueReadResult = {
  items: ChangeQueueItem[];
  errors: ChangeReadError[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES: readonly ChangeType[] = ["bug", "feature", "change"];
const VALID_CLASSES: readonly ChangeClass[] = ["expedite", "standard", "intangible", "fixed-date"];
const VALID_STATUSES: readonly ChangeQueueStatus[] = ["ready", "draft", "done"];

/** Files inside .pandacorp/inbox/changes/ that are never change items. */
const SKIP_FILES: readonly string[] = ["README.md"];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isChangeType(v: unknown): v is ChangeType {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

function isChangeClass(v: unknown): v is ChangeClass {
  return typeof v === "string" && (VALID_CLASSES as readonly string[]).includes(v);
}

function isChangeQueueStatus(v: unknown): v is ChangeQueueStatus {
  return typeof v === "string" && (VALID_STATUSES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Coercion helpers for optional fields
// ---------------------------------------------------------------------------

/** Coerce a scalar frontmatter value to a trimmed string ("" when absent). */
function coerceString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

/** Coerce the `rebuilds_verified` field to boolean (default false — non-critical, fail-soft). */
function coerceBoolean(value: unknown): boolean {
  return value === true;
}

// ---------------------------------------------------------------------------
// Title extraction — the first `# ` (H1) line in the body
// ---------------------------------------------------------------------------

const H1_LINE_RE = /^#\s+(.+?)\s*$/;

/**
 * Split a markdown body into its title (the first H1 heading) and the rest.
 * Returns `null` when no H1 heading is found — the caller treats that as
 * fail-loud (a change card without a title cannot be shown).
 */
function extractTitle(content: string): { title: string; body: string } | null {
  const lines = content.split("\n");
  const index = lines.findIndex((line) => H1_LINE_RE.test(line.trim()));
  if (index === -1) return null;

  const match = H1_LINE_RE.exec(lines[index]?.trim() ?? "");
  const title = match?.[1]?.trim();
  if (title === undefined || title === "") return null;

  const rest = [...lines.slice(0, index), ...lines.slice(index + 1)].join("\n").trim();
  return { title, body: rest };
}

// ---------------------------------------------------------------------------
// File reader
// ---------------------------------------------------------------------------

/** Resolve the pending + archived change-queue directories for a project. */
function changeDirs(projectPath: string): { pending: string; done: string } {
  const pending = path.join(projectPath, ".pandacorp", "inbox", "changes");
  return { pending, done: path.join(pending, "done") };
}

/** True when a filename should be parsed as a change item (.md, not skipped/hidden). */
function isChangeFile(filename: string): boolean {
  if (!filename.endsWith(".md")) return false;
  if (filename.startsWith("_")) return false;
  return !(SKIP_FILES as readonly string[]).includes(filename);
}

type ParseOutcome = { item: ChangeQueueItem } | { error: string };

/** Parse a single change file into a `ChangeQueueItem`, or a fail-loud `{ error }` (DR-078). */
function parseChangeFile(filePath: string, id: string): ParseOutcome {
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

  if (!isChangeType(fm.type)) {
    return { error: `${id}: invalid or missing type (bug|feature|change)` };
  }
  if (!isChangeQueueStatus(fm.status)) {
    return { error: `${id}: invalid or missing status (ready|draft|done)` };
  }

  const extracted = extractTitle(typeof parsed.content === "string" ? parsed.content : "");
  if (extracted === null) {
    return { error: `${id}: missing title (no H1 heading in body)` };
  }

  return {
    item: {
      id,
      type: fm.type,
      cls: isChangeClass(fm.class) ? fm.class : "standard",
      status: fm.status,
      date: coerceString(fm.date),
      frd: coerceString(fm.frd),
      rebuildsVerified: coerceBoolean(fm.rebuilds_verified),
      dependsOn: coerceString(fm.depends_on),
      title: extracted.title,
      body: extracted.body,
    },
  };
}

/** List `.md` change files in `dir`, or `[]` when the directory is absent/unreadable. */
function listChangeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir).filter(isChangeFile);
  } catch {
    return [];
  }
}

/**
 * Read and parse all change-queue items for a project: pending items in
 * `.pandacorp/inbox/changes/` plus archived items in `.../changes/done/`.
 *
 * - Skips `README.md` and any `_*` template file.
 * - A missing directory is a legitimately-empty queue → `{ items: [], errors: [] }`.
 * - A malformed item is surfaced in `errors[]` (fail-loud, DR-078) — never dropped.
 * - Read-only: zero writes to disk.
 */
export function readChangeQueue(projectPath: string): ChangeQueueReadResult {
  const { pending, done } = changeDirs(projectPath);

  const items: ChangeQueueItem[] = [];
  const errors: ChangeReadError[] = [];
  // id → the first filename that defined it (across BOTH pending and done) — a
  // second file with the same id is a data-integrity defect: surface it
  // fail-loud and keep only the first (same discipline as factory/backlog, BL-0013).
  const seenIds = new Map<string, string>();

  const sources: ReadonlyArray<{ dir: string; label: string }> = [
    { dir: pending, label: "" },
    { dir: done, label: "done/" },
  ];

  for (const { dir, label } of sources) {
    for (const filename of listChangeFiles(dir)) {
      const id = filename.slice(0, -".md".length);
      const displayName = `${label}${filename}`;
      const outcome = parseChangeFile(path.join(dir, filename), id);
      if (!("item" in outcome)) {
        errors.push({ file: displayName, reason: outcome.error });
        continue;
      }
      const priorFile = seenIds.get(outcome.item.id);
      if (priorFile !== undefined) {
        errors.push({
          file: displayName,
          reason: `duplicate id ${outcome.item.id} (already defined in ${priorFile})`,
        });
        continue;
      }
      seenIds.set(outcome.item.id, displayName);
      items.push(outcome.item);
    }
  }

  return { items, errors };
}
