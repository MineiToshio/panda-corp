import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { NON_IDEA_FILES, resolveFactoryRoot } from "./config";

/**
 * Data-reading module for idea cards (FRD-01, CMP-01-ideas).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is `fs.readFileSync` only — no writes, no egress.
 *
 * Traceability:
 *   IF-01-readIdeas → REQ-01-003 → AC-01-003.1
 */

export type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";

export type IdeaCard = {
  slug: string;
  title: string;
  status: IdeaStatus;
  projectType?: string;
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number;
  project?: string;
  body: string;
};

const VALID_STATUSES: readonly IdeaStatus[] = [
  "discovered",
  "recommended",
  "in-pipeline",
  "shipped",
  "discarded",
];

function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);
}

function isValidReturnType(
  value: unknown,
): value is "monetary" | "opportunity" | "personal" | "mixed" {
  return (
    typeof value === "string" && ["monetary", "opportunity", "personal", "mixed"].includes(value)
  );
}

/**
 * Read and parse all idea cards from the ideas directory.
 *
 * Behavior (blueprint §3 tolerance rules):
 * - Skips files listed in `NON_IDEA_FILES` (`_idea-template.md`, `decision-log.md`).
 * - Only processes files ending in `.md`.
 * - A card with unparseable frontmatter is skipped (logged), not fatal.
 * - Missing directory → `[]` (graceful).
 * - Maps snake_case frontmatter keys to camelCase: `project_type` → `projectType`,
 *   `return_type` → `returnType`.
 * - `slug` = filename without `.md`.
 * - Results are sorted by slug for idempotency (OS readdir order is non-deterministic).
 *
 * @param ideasDir - Optional override. Defaults to `config.IDEAS_DIR`
 *   (derived from `PANDACORP_FACTORY_ROOT` or one level up from cwd).
 * @returns Typed array of `IdeaCard` objects; never throws.
 */
export function readIdeas(ideasDir?: string): IdeaCard[] {
  // Resolve the directory: explicit arg > env-derived default.
  // We re-derive from config at call time (not module load time) so that
  // PANDACORP_FACTORY_ROOT overrides set by withFactoryRoot() in tests are respected.
  const dir = ideasDir ?? path.join(resolveFactoryRoot(), "factory", "ideas");

  // Missing or non-directory → graceful empty result (blueprint §3).
  if (!fs.existsSync(dir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const cards: IdeaCard[] = [];

  for (const filename of entries) {
    // Only process .md files.
    if (!filename.endsWith(".md")) {
      continue;
    }

    // Skip non-idea files (template, decision log).
    if ((NON_IDEA_FILES as readonly string[]).includes(filename)) {
      continue;
    }

    const slug = filename.slice(0, -3); // strip ".md"
    const filePath = path.join(dir, filename);

    let parsed: matter.GrayMatterFile<string>;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      // gray-matter throws on malformed YAML frontmatter (regression B1, 2026-06-16).
      // Catch per-card so a single bad card never aborts the batch.
      parsed = matter(raw);
    } catch {
      // Malformed card: skip silently (blueprint §3, AC-01-003.1 edge case).
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;

    // Validate required fields; skip card if title or status is missing/invalid.
    const title = typeof fm.title === "string" ? fm.title : undefined;
    const status = isIdeaStatus(fm.status) ? fm.status : undefined;

    if (title === undefined || status === undefined) {
      continue;
    }

    // Optional fields — map from snake_case + validate.
    const projectType = typeof fm.project_type === "string" ? fm.project_type : undefined;

    const returnType = isValidReturnType(fm.return_type) ? fm.return_type : undefined;

    const score = typeof fm.score === "number" ? fm.score : undefined;

    const project = typeof fm.project === "string" ? fm.project : undefined;

    // gray-matter exposes the markdown body (content after the frontmatter block) as `.content`.
    const body: string = typeof parsed.content === "string" ? parsed.content : "";

    const card: IdeaCard = {
      slug,
      title,
      status,
      body,
    };

    if (projectType !== undefined) card.projectType = projectType;
    if (returnType !== undefined) card.returnType = returnType;
    if (score !== undefined) card.score = score;
    if (project !== undefined) card.project = project;

    cards.push(card);
  }

  // Sort by slug for idempotency (readdir order is not guaranteed across OS/FS).
  cards.sort((a, b) => a.slug.localeCompare(b.slug));

  return cards;
}
