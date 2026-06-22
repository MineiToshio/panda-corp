/**
 * lib/reference.ts — skills + agents catalog readers (WO-07-001, FRD-07, IF-07-reference).
 *
 * Derives both catalogs from the canonical plugin source files — never a static array
 * (DR-046 "no hand-copied list"). Both share the readPluginDir helper.
 *
 * - readSkills()  → SkillRef[]  from plugin/skills/<slug>/SKILL.md
 * - readAgents()  → AgentRef[]  from plugin/agents/<id>.md
 *
 * Platform golden rule (architecture §1): read-only, zero writes, never calls Claude.
 *
 * Traceability:
 *   IF-07-reference  → AC-07-001.1/.2/.3/.4/.5  (skills)
 *                    → AC-07-002.1/.2/.3/.4      (agents)
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

// ---------------------------------------------------------------------------
// Types (blueprint §3 IF-07-reference)
// ---------------------------------------------------------------------------

/** Where the skill is used: inside the factory or inside a project. */
export type RunsIn = "factory" | "project" | "unknown";

/**
 * One entry in the skills catalog.
 * - `slug`        = the directory name (NEVER a `name:` frontmatter field — CLAUDE.md rule).
 * - `description` = frontmatter `description` field.
 * - `runsIn`      = inferred from description/body; ambiguous → "unknown".
 * - `internal`    = derived: the skill is normally invoked by ANOTHER skill, not run
 *                   directly by the owner ("interno" flag — AC-07-006). DR-046: derived
 *                   from the description, never a hand-copied list.
 * - `produces`    = derived: a short "what it produces" line (the skill's output), or
 *                   null when no machine-readable output is declared.
 * - `agents`      = canonical agent ids/roles this skill uses, in document order
 *                   (derived from the body — powers the cross-navigation EARS).
 * - `body`        = raw markdown after the frontmatter (for the detail view).
 */
export type SkillRef = {
  slug: string;
  description: string;
  runsIn: RunsIn;
  /**
   * Derived flags (always populated by readSkills(); optional on the type so
   * lightweight fixtures that predate these fields still satisfy SkillRef).
   */
  internal?: boolean;
  produces?: string | null;
  agents?: string[];
  body: string;
};

/**
 * One entry in the agents catalog.
 * - `id`          = filename without `.md` extension.
 * - `name`        = frontmatter `name`; null when absent.
 * - `description` = frontmatter `description`; null when absent.
 * - `model`       = frontmatter `model`; "unknown" when absent.
 * - `body`        = raw markdown after the frontmatter.
 */
export type AgentRef = {
  id: string;
  name: string | null;
  description: string | null;
  model: string;
  body: string;
};

// ---------------------------------------------------------------------------
// Shared helper — read one markdown file from the plugin directory tree
// ---------------------------------------------------------------------------

/**
 * Parse a single markdown file with gray-matter.
 *
 * Returns `null` if the file cannot be read or has fatally malformed frontmatter.
 * Passes `{ excerpt: false }` to bypass gray-matter's content-based cache
 * (regression: gray-matter@4 cache bug 2026-06-16, same fix as lib/memory.ts).
 */
function parsePluginFile(filePath: string): matter.GrayMatterFile<string> | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  if (!raw.trim()) return null;

  try {
    return matter(raw, { excerpt: false });
  } catch {
    return null;
  }
}

/**
 * Resolve the plugin root path from the factory root at call-time.
 * Honors `PANDACORP_FACTORY_ROOT` so fixture tests are isolated.
 */
function pluginSkillsDir(): string {
  return path.join(resolveFactoryRoot(), "plugin", "skills");
}

function pluginAgentsDir(): string {
  return path.join(resolveFactoryRoot(), "plugin", "agents");
}

// ---------------------------------------------------------------------------
// runsIn inference (AC-07-001.3)
//
// Heuristic: scan the description and body for keywords that signal where
// the skill is meant to be run. This is intentionally conservative:
//   - "factory" signals: "in the factory", "from the factory", "factory context",
//     "runs from the factory"
//   - "project" signals: "inside the project", "in the project", "inside a project",
//     "use inside the project", "run inside the project"
//   - Ambiguous (both or neither) → "unknown"
//
// A future improvement is an explicit `runs_in:` frontmatter field on SKILL.md
// (flagged in blueprint §6 — not invented here, only inferred).
// ---------------------------------------------------------------------------

const FACTORY_PATTERNS: readonly RegExp[] = [
  /\bfrom the factory\b/i,
  /\bin the factory\b/i,
  /\bin panda-corp\b/i,
  /\bfactory context\b/i,
  /\bruns in the factory\b/i,
  /\brun from the factory\b/i,
];

const PROJECT_PATTERNS: readonly RegExp[] = [
  /\binside the project\b/i,
  /\bin the project\b/i,
  /\binside a project\b/i,
  /\buse inside the project\b/i,
  /\brun inside the project\b/i,
  /\buse inside a project\b/i,
];

function inferRunsIn(description: string, body: string): RunsIn {
  const text = `${description} ${body}`;
  const isFactory = FACTORY_PATTERNS.some((re) => re.test(text));
  const isProject = PROJECT_PATTERNS.some((re) => re.test(text));

  if (isFactory && !isProject) return "factory";
  if (isProject && !isFactory) return "project";
  // Both or neither → unknown (ambiguous, per AC-07-001.3).
  return "unknown";
}

// ---------------------------------------------------------------------------
// internal inference (AC-07-006 — the "interno" flag)
//
// An internal skill is one normally invoked by ANOTHER skill, not run directly
// by the owner. The plugin descriptions state this consistently ("invoked by
// /pandacorp:spec", "created by /pandacorp:blueprint together with…", "use …
// separately only to…"). Derived from the description — never a hand-copied list
// (DR-046).
// ---------------------------------------------------------------------------

const INTERNAL_PATTERNS: readonly RegExp[] = [
  /\binvoked by\b/i,
  /\bcreated by\b/i,
  /\bnormally invoked by\b/i,
  /\buse (?:it|this skill)? ?separately only\b/i,
  /\bmechanical step\b/i,
];

function inferInternal(description: string): boolean {
  return INTERNAL_PATTERNS.some((re) => re.test(description));
}

// ---------------------------------------------------------------------------
// produces inference (AC-07-006 — "what it produces")
//
// Scan the description/body for the skill's declared output. Conservative: the
// first sentence that names a produced artifact ("creates", "generates",
// "produces", "documents"). Returns null when nothing machine-readable is found.
// ---------------------------------------------------------------------------

const PRODUCES_PATTERNS: readonly RegExp[] = [
  /\b(?:creates?|generates?|produces?|documents?|creates the)\b[^.\n]*/i,
];

function inferProduces(description: string, body: string): string | null {
  for (const re of PRODUCES_PATTERNS) {
    const fromDesc = description.match(re);
    if (fromDesc?.[0]) return fromDesc[0].trim();
    const fromBody = body.match(re);
    if (fromBody?.[0]) return fromBody[0].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// agents inference (AC-07-006 cross-navigation)
//
// Extract the canonical agent roles a skill references in its body, in document
// order, deduplicated. Powers the clickable agent chips in the skill's mini-flow.
// ---------------------------------------------------------------------------

/** Canonical agent role names, longest-first to avoid partial matches. */
const KNOWN_AGENT_ROLES: readonly string[] = [
  "security-auditor",
  "product-manager",
  "frontend-dev",
  "backend-dev",
  "test-writer",
  "implementer",
  "researcher",
  "librarian",
  "copywriter",
  "architect",
  "designer",
  "analytics",
  "reviewer",
  "devops",
];

function inferAgents(body: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const lower = body.toLowerCase();
  // Walk the body in order; record each known role at its first occurrence.
  const positions: Array<{ role: string; at: number }> = [];
  for (const role of KNOWN_AGENT_ROLES) {
    const at = lower.indexOf(role.toLowerCase());
    if (at !== -1) positions.push({ role, at });
  }
  positions.sort((a, b) => a.at - b.at);
  for (const { role } of positions) {
    if (!seen.has(role)) {
      found.push(role);
      seen.add(role);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// readSkills() — AC-07-001.*
// ---------------------------------------------------------------------------

/**
 * Derive the skills catalog from `plugin/skills/<slug>/SKILL.md`.
 *
 * - `slug`        = the directory name (never a `name:` field — CLAUDE.md rule).
 * - `description` = frontmatter `description` (required; missing → skill skipped + warning).
 * - `runsIn`      = inferred from description + body.
 * - `body`        = raw markdown after the frontmatter.
 *
 * Defensive: missing/malformed/description-less files are skipped with a console.warn;
 * the reader never throws (AC-07-001.2).
 *
 * Returns [] when the directory is absent (AC-07-001.5).
 */
export function readSkills(): SkillRef[] {
  const skillsDir = pluginSkillsDir();

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillRef[] = [];

  for (const entry of entries) {
    // Only process directories (each skill lives in its own dir).
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const skillFile = path.join(skillsDir, slug, "SKILL.md");

    if (!fs.existsSync(skillFile)) continue;

    const parsed = parsePluginFile(skillFile);
    if (parsed === null) {
      console.warn(`[reference] Skipped malformed SKILL.md: ${skillFile}`);
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;

    // `description` is required (AC-07-001.2).
    const description = typeof fm.description === "string" ? fm.description.trim() : null;
    if (!description) {
      console.warn(`[reference] Skipped skill "${slug}": missing description frontmatter`);
      continue;
    }

    const body = typeof parsed.content === "string" ? parsed.content.trim() : "";
    const runsIn = inferRunsIn(description, body);
    const internal = inferInternal(description);
    const produces = inferProduces(description, body);
    const agents = inferAgents(body);

    skills.push({ slug, description, runsIn, internal, produces, agents, body });
  }

  return skills;
}

// ---------------------------------------------------------------------------
// readAgents() — AC-07-002.*
// ---------------------------------------------------------------------------

/**
 * Derive the agents catalog from `plugin/agents/<id>.md`.
 *
 * - `id`          = filename without `.md` (AC-07-002.1).
 * - `name`        = frontmatter `name`; null when absent (AC-07-002.2).
 * - `description` = frontmatter `description`; null when absent (AC-07-002.2).
 * - `model`       = frontmatter `model`; "unknown" when absent (AC-07-002.2).
 * - `body`        = raw markdown after the frontmatter.
 *
 * Defensive: a totally malformed file (unparseable YAML) is skipped with a warning,
 * never throws (AC-07-002.2). Returns [] when the directory is absent (AC-07-002.4).
 */
export function readAgents(): AgentRef[] {
  const agentsDir = pluginAgentsDir();

  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(agentsDir);
  } catch {
    return [];
  }

  const agents: AgentRef[] = [];

  for (const filename of entries) {
    // Only process .md files.
    if (!filename.endsWith(".md")) continue;

    const id = filename.slice(0, -".md".length);
    const filePath = path.join(agentsDir, filename);

    const parsed = parsePluginFile(filePath);
    if (parsed === null) {
      console.warn(`[reference] Skipped malformed agent file: ${filePath}`);
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;

    // For agents: missing fields get typed defaults (AC-07-002.2).
    const name: string | null = typeof fm.name === "string" ? fm.name : null;
    const description: string | null = typeof fm.description === "string" ? fm.description : null;
    const model: string = typeof fm.model === "string" ? fm.model : "unknown";

    const body = typeof parsed.content === "string" ? parsed.content.trim() : "";

    agents.push({ id, name, description, model, body });
  }

  return agents;
}
