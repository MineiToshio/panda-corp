/**
 * lib/manual.ts — WO-08-001 (FRD-08, IF-08-manual-index)
 *
 * Indexes the app-local authored Manual content (Tutorial / Guides / Concepts
 * MDX/markdown under `content/manual/`), returning grouped, ordered pages with
 * title and body.
 *
 * Distinct from `lib/docs.ts` (which reads per-project docs from
 * `<projectPath>/docs/`). This module only reads the app's own authored content.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude, never write.
 *
 * Traceability:
 *   IF-08-manual-index → AC-08-001.1 (fields: group, slug, title, order, body)
 *   AC-08-001.2 (grouped, ordered; deterministic)
 *   AC-08-001.3 (malformed/missing metadata → skip + warn; no throw)
 *   AC-08-001.4 (reads from content/manual/; fixture-testable via appRoot param)
 *
 * Contract:
 *   export type ManualPage = { group: string; slug: string; title: string; order: number; body: string };
 *   export function readManualPages(appRoot?: string): ManualPage[]
 *   // Returns all valid pages sorted by (group ASC, order ASC).
 *   // Missing directory → []. Malformed page → skip + console.warn. Never throws.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single authored Manual page (Tutorial / Guides / Concepts).
 * Diátaxis quadrant is stored in `group`.
 */
export type ManualPage = {
  /** Diátaxis quadrant: "tutorial" | "guides" | "concepts" (or any custom group). */
  group: string;
  /** Derived from the filename without extension (e.g. "como-empezar"). */
  slug: string;
  /** Page title from frontmatter `title`. */
  title: string;
  /** Sort order within the group, from frontmatter `order` (integer). */
  order: number;
  /** Full markdown body, frontmatter stripped. */
  body: string;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Read and index all authored Manual pages from `content/manual/<group>/*.md`.
 *
 * @param appRoot - The root of the Next.js app (defaults to process.cwd(), i.e.
 *   the mission-control directory). Override for fixture tests.
 * @returns Sorted array of valid ManualPage objects (group ASC, order ASC).
 *          Never throws — malformed pages are skipped with a console.warn.
 */
export function readManualPages(appRoot: string = process.cwd()): ManualPage[] {
  const manualDir = path.join(appRoot, "content", "manual");

  // AC-08-001.4 — if the directory doesn't exist, return []
  if (!fs.existsSync(manualDir)) {
    return [];
  }

  const pages: ManualPage[] = [];

  let groupEntries: fs.Dirent[];
  try {
    groupEntries = fs.readdirSync(manualDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const groupEntry of groupEntries) {
    // Only process directories (each directory = one Diátaxis group)
    if (!groupEntry.isDirectory()) {
      continue;
    }

    const group = groupEntry.name;
    const groupDir = path.join(manualDir, group);
    pages.push(...readGroupPages(groupDir, group));
  }

  // AC-08-001.2 — sort by group then by order (deterministic)
  pages.sort((a, b) => {
    const groupCmp = a.group.localeCompare(b.group);
    if (groupCmp !== 0) return groupCmp;
    return a.order - b.order;
  });

  return pages;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read all valid manual pages from a single group directory.
 *
 * @returns The parsed pages; an unreadable directory yields []. Never throws.
 */
function readGroupPages(groupDir: string, group: string): ManualPage[] {
  let fileEntries: fs.Dirent[];
  try {
    fileEntries = fs.readdirSync(groupDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const pages: ManualPage[] = [];

  for (const fileEntry of fileEntries) {
    // AC-08-001.4 — only .md files (and .mdx, for future extensibility)
    if (!fileEntry.isFile()) {
      continue;
    }
    const filename = fileEntry.name;
    if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) {
      continue;
    }

    const filePath = path.join(groupDir, filename);
    const page = parseManualPage(filePath, filename, group);
    if (page !== null) {
      pages.push(page);
    }
  }

  return pages;
}

/**
 * Parse a single manual page file.
 *
 * @returns A ManualPage on success; null when required fields are missing
 *   (AC-08-001.3 — skip malformed with typed warning).
 */
function parseManualPage(filePath: string, filename: string, group: string): ManualPage | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    console.warn(`[lib/manual] Skipping unreadable file: ${filename} (group: ${group})`);
    return null;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw, { excerpt: false });
  } catch {
    console.warn(`[lib/manual] Skipping unparseable frontmatter in: ${filename} (group: ${group})`);
    return null;
  }

  const fm = parsed.data;

  // AC-08-001.1 — required fields: title, group (may differ from dir), order
  const title = typeof fm.title === "string" && fm.title.trim() !== "" ? fm.title.trim() : null;
  const fmGroup = typeof fm.group === "string" && fm.group.trim() !== "" ? fm.group.trim() : null;
  const order = typeof fm.order === "number" ? fm.order : null;

  if (title === null) {
    console.warn(
      `[lib/manual] Skipping ${filename}: missing or empty required field "title" (group: ${group})`,
    );
    return null;
  }

  if (fmGroup === null) {
    console.warn(
      `[lib/manual] Skipping ${filename}: missing or empty required field "group" (group: ${group})`,
    );
    return null;
  }

  if (order === null) {
    console.warn(
      `[lib/manual] Skipping ${filename}: missing or non-numeric required field "order" (group: ${group})`,
    );
    return null;
  }

  // slug = filename without extension
  const slug = filename.replace(/\.(md|mdx)$/, "");

  // body = frontmatter-stripped content
  const body = parsed.content;

  return {
    group: fmGroup,
    slug,
    title,
    order,
    body,
  };
}
