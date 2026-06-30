/**
 * adr.ts — server-only reader for a project's ADRs (`docs/adr/*.md`). Feeds the "Decisiones (ADRs)"
 * block of the Arquitectura tab — read LIVE from the real files so it never drifts; the modal needs
 * the full body, so the reader returns it too.
 *
 * Each ADR: frontmatter `id`/`title`, a `## Decision` (or `## Decisión`) section whose first
 * paragraph is the one-line decision, and the full markdown for the modal.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Adr {
  /** Normalized id, e.g. "ADR-0001" (frontmatter `id`, else derived from the filename). */
  id: string;
  /** Human title (frontmatter `title`, else the H1 with any leading "ADR-NNNN — " stripped). */
  title: string;
  /** One-line decision: the first paragraph under `## Decision`/`## Decisión`; empty when absent. */
  decision: string;
  /** The full ADR markdown (rendered in the modal). */
  body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const ADR_FILE_RE = /^adr-.+\.md$/i;

/** Read a single frontmatter scalar (`key: value`), unquoted; null when absent. */
function frontmatterValue(raw: string, key: string): string | null {
  const m = raw.match(FRONTMATTER_RE);
  if (m?.[1] == null) return null;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (kv?.[1]?.trim() === key && kv[2] != null) {
      const v = kv[2].trim().replace(/^["']|["']$/g, "");
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

/** Derive an id from a filename: "adr-0001-approved-stack.md" → "ADR-0001". */
function idFromFile(file: string): string {
  const m = file.match(/^adr-(\d+)/i);
  return m?.[1] != null ? `ADR-${m[1]}` : file.replace(/\.md$/i, "");
}

/** First H1, with any leading "ADR-NNNN — " / "ADR-NNNN:" prefix stripped. */
function titleFromBody(raw: string, fallback: string): string {
  for (const line of raw.split("\n")) {
    const m = line.match(/^#\s+(.+)$/);
    if (m?.[1] != null) {
      return m[1].replace(/^ADR[\s-]?\d+\s*[—\-:·]\s*/i, "").trim();
    }
  }
  return fallback;
}

/** First non-empty paragraph under a `## Decision`/`## Decisión` heading; empty when absent. */
function extractDecision(raw: string): string {
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /^##\s+(decision|decisión|decisiones)\b/i.test(l.trim()));
  if (start === -1) return "";
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^#{1,6}\s/.test(line)) break; // next heading
    if (line.trim() === "") {
      if (out.length > 0) break; // first paragraph collected
      continue;
    }
    out.push(line.trim());
  }
  return out.join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Read all ADRs from `<project>/docs/adr/`, sorted by id. Absent dir → [] (a project may have no
 * ADRs). Unreadable file → skipped (degrade rather than crash). Read-only.
 */
export function readAdrs(projectPath: string): Adr[] {
  const dir = join(projectPath, "docs", "adr");
  if (!existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => ADR_FILE_RE.test(f));
  } catch {
    return [];
  }

  const adrs: Adr[] = [];
  for (const file of files.sort()) {
    let raw: string;
    try {
      raw = readFileSync(join(dir, file), "utf-8");
    } catch {
      continue;
    }
    const id = frontmatterValue(raw, "id") ?? idFromFile(file);
    adrs.push({
      id,
      title: frontmatterValue(raw, "title") ?? titleFromBody(raw, id),
      decision: extractDecision(raw),
      body: raw,
    });
  }
  return adrs;
}
