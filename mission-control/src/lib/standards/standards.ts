/**
 * lib/standards.ts — read factory/standards/*.md into typed Standard objects.
 *
 * Implements IF-07-standards (FRD-07 blueprint §3, WO-07-004).
 *
 * Strategy:
 *   (A) Frontmatter: when a standards file carries `domain`, `severity`, `enforcement`
 *       (and optional `summary`) in YAML frontmatter, those values are used verbatim.
 *   (B) Derivation map: when frontmatter is absent, a static map keyed by filename
 *       supplies metadata for the known factory/standards/*.md files.
 *   (default) Unmapped files without frontmatter get `domain: "Other"`,
 *       `severity: "SHOULD"`, `enforcement: "checklist"` and a typed console.warn —
 *       they are never dropped, and never cause a crash.
 *
 * `summary` defaults to the body's first bullet list (- items) or, when no bullets
 * are present, the first non-empty non-heading paragraph.
 *
 * Platform golden rule (architecture §1): read-only; never call Claude; never write.
 *
 * Traceability:
 *   IF-07-standards → AC-07-004.1 (one entry per *.md, skip README.md)
 *   AC-07-004.2 frontmatter values verbatim (option A)
 *   AC-07-004.3 derivation-map fallback + default + typed warning (option B)
 *   AC-07-004.4 summary defaults to first bullet list or lead paragraph
 *   AC-07-004.5 uses resolveFactoryRoot(); reflects added/renamed files automatically
 *
 * NOTE (owner flag — DR-046 §6): the cleanest fit is option A — adding
 * `domain/severity/enforcement/summary` frontmatter to each `factory/standards/*.md`.
 * That is a factory-repo change outside Mission Control's write scope. Until the owner
 * adds the frontmatter, option B (this map) serves as the safety net. See blueprint §6.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type StandardSeverity = "MUST" | "SHOULD" | "MAY";
type StandardEnforcement = "lint" | "CI" | "checklist" | "human gate" | string;
export type StandardDomain =
  | "Programming"
  | "Architecture"
  | "Design"
  | "Technology"
  | "Quality"
  | "Security"
  | "Operation"
  | "Data/Privacy"
  | "Product/Docs"
  | "Other"
  | string;

export interface Standard {
  /** Filename, e.g. "quality.md". Stable ID for linking. */
  id: string;
  /** H1 heading from the markdown body. */
  title: string;
  /** Full markdown body (includes frontmatter-stripped content). */
  body: string;
  /** Domain category, e.g. "Quality", "Security". */
  domain: StandardDomain;
  /** Severity level: MUST / SHOULD / MAY. */
  severity: StandardSeverity;
  /** Enforcement mechanism: lint / CI / checklist / human gate. */
  enforcement: StandardEnforcement;
  /** Key points — from frontmatter when present, else derived from the body. */
  summary: string[];
}

// ---------------------------------------------------------------------------
// Static derivation map (option B) — keyed by filename
// Covers all real factory/standards/*.md files as of 2026-06-17.
// This map should be updated when new standards are added, until option A lands.
// ---------------------------------------------------------------------------

interface DerivationEntry {
  domain: StandardDomain;
  severity: StandardSeverity;
  enforcement: StandardEnforcement;
}

const DERIVATION_MAP: Readonly<Record<string, DerivationEntry>> = {
  "api-design.md": { domain: "Programming", severity: "MUST", enforcement: "lint/CI" },
  "build-orchestration.md": { domain: "Product/Docs", severity: "MUST", enforcement: "checklist" },
  "conventions.md": { domain: "Programming", severity: "MUST", enforcement: "lint" },
  "design.md": { domain: "Design", severity: "MUST", enforcement: "checklist" },
  "documentation.md": { domain: "Product/Docs", severity: "MUST", enforcement: "checklist" },
  "external-services.md": { domain: "Technology", severity: "MUST", enforcement: "checklist" },
  "infra.md": { domain: "Operation", severity: "SHOULD", enforcement: "checklist" },
  "observability.md": { domain: "Operation", severity: "MUST", enforcement: "checklist" },
  "patterns.md": { domain: "Architecture", severity: "SHOULD", enforcement: "checklist" },
  "performance.md": { domain: "Quality", severity: "MUST", enforcement: "CI" },
  "privacy.md": { domain: "Data/Privacy", severity: "MUST", enforcement: "human gate" },
  "quality.md": { domain: "Quality", severity: "MUST", enforcement: "CI" },
  "seo-i18n.md": { domain: "Product/Docs", severity: "SHOULD", enforcement: "checklist" },
  "stack.md": { domain: "Technology", severity: "SHOULD", enforcement: "checklist" },
  "structure.md": { domain: "Architecture", severity: "SHOULD", enforcement: "checklist" },
  "web-security.md": { domain: "Security", severity: "MUST", enforcement: "CI" },
};

/** Default metadata when a file has no frontmatter and is not in the derivation map. */
const DEFAULT_ENTRY: DerivationEntry = {
  domain: "Other",
  severity: "SHOULD",
  enforcement: "checklist",
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Extract the H1 title from markdown body text. */
function extractTitle(body: string): string {
  const match = /^#\s+(.+)$/m.exec(body);
  if (match?.[1]) {
    return match[1].trim();
  }
  // Fallback: use the first non-empty line
  const firstLine = body.split("\n").find((l) => l.trim().length > 0);
  return firstLine?.replace(/^#+\s*/, "").trim() ?? "Untitled";
}

/**
 * Derive summary from the body markdown.
 *
 * Priority:
 *  1. First contiguous block of `- ` or `* ` bullet items.
 *  2. First non-empty, non-heading paragraph (split into sentences).
 */
/** Collect the first contiguous block of `- `/`* ` bullet items (trimmed). */
function extractFirstBulletBlock(lines: readonly string[]): string[] {
  const bullets: string[] = [];
  let inBulletBlock = false;
  for (const line of lines) {
    const bulletMatch = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bulletMatch?.[1]) {
      bullets.push(bulletMatch[1].trim());
      inBulletBlock = true;
    } else if (inBulletBlock) {
      // A blank or non-bullet line ends the contiguous block.
      break;
    }
  }
  return bullets;
}

/** The first non-empty, non-heading, non-blockquote paragraph, or null. */
function extractLeadParagraph(lines: readonly string[]): string | null {
  const paragraphs: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
    } else if (!trimmed.startsWith("#") && !trimmed.startsWith(">")) {
      current.push(trimmed);
    } else {
      // Heading/blockquote after text ends the paragraph.
      flush();
    }
  }
  flush();

  return paragraphs.find((p) => p.trim().length > 0) ?? null;
}

function deriveSummary(body: string): string[] {
  const lines = body.split("\n");

  const bullets = extractFirstBulletBlock(lines);
  if (bullets.length > 0) {
    return bullets;
  }

  const firstParagraph = extractLeadParagraph(lines);
  return firstParagraph !== null ? [firstParagraph] : [];
}

/** Coerce a frontmatter value to string[] for the summary field. */
function coerceSummary(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const items = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return items.length > 0 ? items : null;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return null;
}

/** Coerce a severity value to the canonical type. */
function coerceSeverity(raw: unknown): StandardSeverity | null {
  if (raw === "MUST" || raw === "SHOULD" || raw === "MAY") {
    return raw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main reader — AC-07-004.1..5
// ---------------------------------------------------------------------------

/**
 * Read all standards from `factory/standards/` in the resolved factory root.
 *
 * Returns one `Standard` per `*.md` file, excluding `README.md`. Never throws.
 * Added/renamed files are automatically included (no static catalog of content).
 */
/** Resolved frontmatter view: the data map plus whether usable frontmatter exists. */
type ParsedFrontmatter = {
  fm: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
};

/**
 * Parse a standards file's frontmatter, fail-soft on malformed YAML.
 *
 * Applies the gray-matter cache bypass (LESSON inbox 2026-06-16): pass
 * `{ excerpt: false }` so gray-matter skips its internal LRU cache, which can
 * return stale/empty results when two files share identical content in tests.
 */
function parseStandardFrontmatter(raw: string): ParsedFrontmatter {
  let parsed: matter.GrayMatterFile<string>;
  let frontmatterMalformed = false;
  try {
    parsed = matter(raw, { excerpt: false });
  } catch {
    // Malformed YAML frontmatter — treat as if no frontmatter (option B/default).
    frontmatterMalformed = true;
    parsed = {
      data: {},
      content: raw,
      orig: raw,
      matter: "",
      stringify: () => raw,
      language: "yaml",
      excerpt: "",
    };
  }

  const fm = parsed.data as Record<string, unknown>;
  return {
    fm,
    body: parsed.content.trim(),
    hasFrontmatter: !frontmatterMalformed && Object.keys(fm).length > 0,
  };
}

/**
 * Resolve domain / severity / enforcement: frontmatter (option A) → derivation
 * map (option B) → defaults with a typed warning.
 */
function resolveMetadata(
  filename: string,
  fm: Record<string, unknown>,
  hasFrontmatter: boolean,
): DerivationEntry {
  // Option A: frontmatter present and carries the fields.
  if (hasFrontmatter && typeof fm.domain === "string" && fm.domain.trim() !== "") {
    return {
      domain: fm.domain.trim(),
      severity: coerceSeverity(fm.severity) ?? DEFAULT_ENTRY.severity,
      enforcement:
        typeof fm.enforcement === "string" ? fm.enforcement.trim() : DEFAULT_ENTRY.enforcement,
    };
  }

  // Option B: derivation map.
  const mapped = DERIVATION_MAP[filename];
  if (mapped) {
    return mapped;
  }

  // Default: AC-07-004.3 unmapped file → typed warning + defaults.
  console.warn(
    `[standards.ts] No frontmatter and no derivation map entry for "${filename}". ` +
      `Using defaults (domain: "Other", severity: "SHOULD", enforcement: "checklist"). ` +
      `Add frontmatter to factory/standards/${filename} (option A, DR-046) or add it to the derivation map.`,
  );
  return DEFAULT_ENTRY;
}

/** Parse a single standards file into a Standard, or null when unreadable. */
function parseStandardFile(standardsDir: string, filename: string): Standard | null {
  const filePath = path.join(standardsDir, filename);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  const { fm, body, hasFrontmatter } = parseStandardFrontmatter(raw);
  const title = extractTitle(body);
  const { domain, severity, enforcement } = resolveMetadata(filename, fm, hasFrontmatter);

  // --- Summary (AC-07-004.4) ---
  const fmSummary = hasFrontmatter ? coerceSummary(fm.summary) : null;
  const summary = fmSummary !== null ? fmSummary : deriveSummary(body);

  return { id: filename, title, body, domain, severity, enforcement, summary };
}

export function readStandards(factoryRoot: string = resolveFactoryRoot()): Standard[] {
  const standardsDir = path.join(factoryRoot, "factory", "standards");

  if (!fs.existsSync(standardsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(standardsDir);
  } catch {
    return [];
  }

  const results: Standard[] = [];

  for (const filename of entries.sort()) {
    // AC-07-004.1: only *.md, skip README.md
    if (!filename.endsWith(".md") || filename === "README.md") {
      continue;
    }

    const standard = parseStandardFile(standardsDir, filename);
    if (standard !== null) {
      results.push(standard);
    }
  }

  return results;
}
