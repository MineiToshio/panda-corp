import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { NON_IDEA_FILES, resolveFactoryRoot } from "../config/config";
import type { StatusResult } from "../status/status";

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
  /** `discard_reason` frontmatter — the owner's why for discarding (only on discarded cards). */
  discardReason?: string;
  /** `favorite: true` frontmatter — the owner pinned this card as a favourite (visual-only, FRD-02). */
  favorite?: boolean;
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

/** True when a filename should be parsed as an idea card (.md, not a non-idea file). */
function isIdeaFile(filename: string): boolean {
  if (!filename.endsWith(".md")) {
    return false;
  }
  return !(NON_IDEA_FILES as readonly string[]).includes(filename);
}

/** A frontmatter value as a string, or `undefined` when it isn't one. */
function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** A frontmatter value as a non-empty string (an empty `""` is treated as absent), or `undefined`. */
function readNonEmptyString(value: unknown): string | undefined {
  const str = readString(value);
  return str !== undefined && str !== "" ? str : undefined;
}

/**
 * Parse a single idea-card file into an `IdeaCard`, or `null` when it should be
 * skipped (unparseable frontmatter, or missing/invalid required fields).
 */
function parseIdeaCard(filePath: string, slug: string): IdeaCard | null {
  let parsed: matter.GrayMatterFile<string>;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    // gray-matter throws on malformed YAML frontmatter (regression B1, 2026-06-16).
    // Catch per-card so a single bad card never aborts the batch.
    parsed = matter(raw);
  } catch {
    // Malformed card: skip silently (blueprint §3, AC-01-003.1 edge case).
    return null;
  }

  const fm = parsed.data as Record<string, unknown>;

  // Validate required fields; skip card if title or status is missing/invalid.
  const title = readString(fm.title);
  const status = isIdeaStatus(fm.status) ? fm.status : undefined;

  if (title === undefined || status === undefined) {
    return null;
  }

  // Optional fields — map from snake_case + validate.
  const projectType = readString(fm.project_type);
  const returnType = isValidReturnType(fm.return_type) ? fm.return_type : undefined;
  const score = typeof fm.score === "number" ? fm.score : undefined;
  // `project: ""` (non-in-pipeline ideas) and `discard_reason: ""` are treated as absent.
  const project = readNonEmptyString(fm.project);
  const discardReason = readNonEmptyString(fm.discard_reason);
  // `favorite: true` only — any other value (absent, false, non-bool) means "not a favourite".
  const favorite = fm.favorite === true ? true : undefined;

  // gray-matter exposes the markdown body (content after the frontmatter block) as `.content`.
  const body: string = typeof parsed.content === "string" ? parsed.content : "";

  const card: IdeaCard = {
    slug,
    title,
    status,
    body,
  };

  // Assign optional fields only when present (never inject undefined-valued keys).
  // A single loop keeps this function under the cognitive-complexity budget.
  const optional: Partial<IdeaCard> = {
    projectType,
    returnType,
    score,
    project,
    discardReason,
    favorite,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      (card as Record<string, unknown>)[key] = value;
    }
  }

  return card;
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
    if (!isIdeaFile(filename)) {
      continue;
    }

    const slug = filename.slice(0, -3); // strip ".md"
    const card = parseIdeaCard(path.join(dir, filename), slug);
    if (card !== null) {
      cards.push(card);
    }
  }

  // Sort by slug for idempotency (readdir order is not guaranteed across OS/FS).
  cards.sort((a, b) => a.slug.localeCompare(b.slug));

  return cards;
}

// =============================================================================
// THE single source of truth for idea counts (DR-092/DR-115).
//
// Before this resolver, `page.tsx` (Pulso) and `funnel.ts` each re-filtered
// `readIdeas()` by status independently — two legitimate but INDEPENDENT
// derivations of "how many ideas". Re-deriving the same concept in two places
// is how it drifts (DR-092: a value derived from the data layer that more than
// one surface shows belongs in ONE resolver, consumed everywhere).
//
// `countIdeas` is the pure derivation (no I/O) — call it when you already hold
// an `IdeaCard[]` (e.g. `funnelAndFlow`, which is itself pure over its inputs).
// `getIdeaCounts` is the request-cached resolver — call it from a Server
// Component that doesn't already have the ideas array in scope.
// =============================================================================

/** Named idea-count facts — every consumer reads from here, never re-filters `IdeaCard[]` itself. */
export type IdeaCounts = {
  /** Every idea card ever created, regardless of status (the historical total). */
  readonly totalIdeas: number;
  /** Ideas still "in the funnel" — excludes `shipped` and `discarded` (the launched/dead ends). */
  readonly ideasAlive: number;
  /** Ideas that reached `shipped` (launched). */
  readonly ideasShipped: number;
  /** Ideas that reached `discarded` (killed). */
  readonly ideasDiscarded: number;
  /** Every status bucket, always present (even at 0) — the full breakdown `funnelAndFlow` needs. */
  readonly byStatus: Readonly<Record<IdeaStatus, number>>;
};

/** Every idea status, so `byStatus` always has every bucket (never a missing key). */
const ALL_IDEA_STATUSES: readonly IdeaStatus[] = [
  "discovered",
  "recommended",
  "in-pipeline",
  "shipped",
  "discarded",
];

/**
 * Derive the named idea-count facts from an already-read `IdeaCard[]` (pure, no I/O).
 * Use this when the caller already holds the ideas array (e.g. `funnelAndFlow`); use
 * {@link getIdeaCounts} when it doesn't.
 */
export function countIdeas(ideas: readonly IdeaCard[]): IdeaCounts {
  const byStatus = Object.fromEntries(ALL_IDEA_STATUSES.map((s) => [s, 0])) as Record<
    IdeaStatus,
    number
  >;
  for (const idea of ideas) byStatus[idea.status] += 1;

  return {
    totalIdeas: ideas.length,
    ideasAlive: ideas.length - byStatus.shipped - byStatus.discarded,
    ideasShipped: byStatus.shipped,
    ideasDiscarded: byStatus.discarded,
    byStatus,
  };
}

/**
 * Request-cached idea-counts resolver — call this from a Server Component that
 * doesn't already hold the ideas array. Wraps `readIdeas()` + `countIdeas()` in
 * React's `cache()` so the read+derive runs once per request (same pattern as
 * `getGuildState` in `lib/gamification/guildState.ts`).
 */
export const getIdeaCounts = cache((): IdeaCounts => countIdeas(readIdeas()));

// =============================================================================
// THE single source of truth for "how many launches" (DR-085/DR-115 bridge).
//
// Before this resolver, `pulse.ts` (Inicio's "Lanzados" KPI) counted ONLY idea
// cards with `status: "shipped"`, while `funnel.ts`'s local `countLaunched`
// counted ONLY portfolio projects with `phase: "release"` — two independent
// derivations of the same underlying fact ("how many things did we launch"),
// which is exactly how Inicio showed "Lanzados 0" while Logros showed
// "Lanzados 2" for the identical factory state (DR-115).
//
// DR-085's actual lifecycle: once a card goes `in-pipeline` it freezes as a
// pointer forever (it never flips back to `status: "shipped"`) — the project's
// OWN `.pandacorp/status.yaml` `phase` becomes the source of truth for that
// launch instead. So a launch is either:
//   (a) a legacy/pre-project idea hand-marked `status: "shipped"` (no linked
//       project — nothing in `statuses` could possibly represent it), or
//   (b) a portfolio project whose `status.yaml` reports `phase: "release"`.
//
// No-double-count rule: a shipped card that DOES carry a `project` pointer is
// excluded from the ideas-side count — DR-085 says that project's phase (the
// `statuses` side) is the authoritative record of that launch. This is a
// structural rule over data the `IdeaCard` itself already carries (`project`
// present/absent) — never a fuzzy match of `IdeaCard.project` against
// `StatusResult.project` (those are three incompatible namespaces in practice:
// an absolute path, a bare slug, or a human display name — see
// `personal-page-v2` vs `mission-control`'s card/status pair — so string-matching
// them would silently misclassify the moment one project's `project:` format
// changes).
// =============================================================================

/**
 * Count "launched" (DR-085: internal or external) as a single honest fact —
 * the bridge between the ideas plane and the portfolio-status plane.
 *
 * `launched = (shipped cards with NO linked project) + (portfolio projects at phase "release")`.
 *
 * Every surface that shows "how many launches" (Inicio's Pulso KPI, Logros'
 * Informe funnel) MUST call this — never re-derive it locally, or it drifts
 * the moment either side's filter changes (DR-115).
 *
 * Pure: no I/O. Callers that already hold both arrays (Server Components) pass
 * them straight through; nothing here re-reads the filesystem.
 *
 * @param ideas    - All idea cards (`readIdeas()`).
 * @param statuses - Status results for every active portfolio project (e.g. `getGuildState().statuses`).
 * @returns The de-duplicated launched count. Never throws.
 */
export function countLaunched(
  ideas: readonly IdeaCard[],
  statuses: readonly StatusResult[],
): number {
  // (a) Shipped cards with no linked project — the only ideas-side cases that
  // cannot ALSO be represented on the statuses side (DR-085: a card with a
  // project pointer is superseded by that project's own status.yaml phase).
  const shippedWithoutProject = ideas.filter(
    (idea) => idea.status === "shipped" && idea.project === undefined,
  ).length;

  // (b) Portfolio projects that have reached the launched/terminal phase.
  let releasedProjects = 0;
  for (const sr of statuses) {
    if (sr.present && sr.status !== null && sr.status.phase === "release") releasedProjects += 1;
  }

  return shippedWithoutProject + releasedProjects;
}
