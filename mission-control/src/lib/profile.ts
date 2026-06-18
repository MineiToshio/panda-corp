/**
 * WO-01-002 — `readProfile` (presence + parse) — CMP-01-profile, IF-01-readProfile
 *
 * Traceability:
 *   REQ-01-001 (absence signal) → AC-01-001.1
 *   REQ-01-002 (parse + personalize) → AC-01-002.1
 *   REQ-01-011 (read-only invariant, cross-cutting)
 *
 * Contract:
 *   export function readProfile(profilePath?: string): ProfileResult;
 *   // Defaults to config.PROFILE (factory/profile.md relative to PANDACORP_FACTORY_ROOT).
 *   // Absent file → { present: false } — drives the onboarding gate.
 *   // Present file → { present: true; profile: Profile } — parse frontmatter + body.
 *   // Never throws. Never writes. Never calls Claude.
 *
 * Tolerance rules (blueprint §3 fail-soft):
 *   - Absent file           → { present: false }
 *   - Malformed frontmatter → { present: true, profile: { body } } (fields stay undefined)
 *   - Empty file            → { present: true, profile: { body: "" } }
 *   - Missing optional fields → undefined (never null, never empty string)
 *
 * gray-matter key mapping:
 *   - `projects_path` (snake_case in YAML) → `projectsPath` (camelCase in Profile)
 *   - All other fields are direct: name, goals, interests, assets.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Profile = {
  name?: string;
  goals?: string;
  interests?: string[];
  assets?: string[];
  /** Mapped from `projects_path` in the YAML frontmatter. Bounds the FRD-16 orphan scan. */
  projectsPath?: string;
  /** Raw markdown body (everything after the frontmatter block). Always a string. */
  body: string;
};

export type ProfileResult = { present: false } | { present: true; profile: Profile };

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Reads and parses `factory/profile.md`.
 *
 * - When called with no argument, reads from `PROFILE` (derived from `PANDACORP_FACTORY_ROOT`).
 * - When called with an explicit `profilePath`, reads from that path (used in tests and
 *   when the caller already knows the absolute path).
 *
 * Read-only invariant: only calls `fs.readFileSync` — no writes, no network, no Claude.
 */
export function readProfile(profilePath?: string): ProfileResult {
  // Resolve at call-time so that PANDACORP_FACTORY_ROOT env changes (e.g. in tests via
  // withFactoryRoot) are respected. Using the frozen PROFILE constant would ignore the env swap.
  const resolvedPath = profilePath ?? path.join(resolveFactoryRoot(), "factory", "profile.md");

  // --- Absence check (AC-01-001.1) ---
  let raw: string;
  try {
    raw = fs.readFileSync(resolvedPath, "utf-8");
  } catch {
    // File absent or unreadable → explicit absence signal.
    return { present: false };
  }

  // --- Parse frontmatter (fail-soft, blueprint §3) ---
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    // gray-matter threw on malformed frontmatter → fall back to raw body with no fields.
    return {
      present: true,
      profile: { body: stripFrontmatterFallback(raw) },
    };
  }

  // --- Extract and map fields (AC-01-002.1) ---
  const data = parsed.data as Record<string, unknown>;

  const profile: Profile = {
    body: parsed.content ?? "",
  };

  // name: string | undefined
  if (typeof data.name === "string") {
    profile.name = data.name;
  }

  // goals: string | undefined
  if (typeof data.goals === "string") {
    profile.goals = data.goals;
  }

  // interests: string[] | undefined — must be an array of strings
  if (Array.isArray(data.interests) && data.interests.every((v) => typeof v === "string")) {
    profile.interests = data.interests as string[];
  }

  // assets: string[] | undefined — must be an array of strings
  if (Array.isArray(data.assets) && data.assets.every((v) => typeof v === "string")) {
    profile.assets = data.assets as string[];
  }

  // projects_path → projectsPath (snake_case → camelCase mapping)
  if (typeof data.projects_path === "string") {
    profile.projectsPath = data.projects_path;
  }

  return { present: true, profile };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort body extraction when gray-matter itself throws.
 *
 * Strips the leading `---…---` frontmatter block (if any) and returns the rest.
 * If the content is not recognizable as frontmatter, returns the whole raw string.
 * This is only called on the parse-error path; it must never throw.
 */
function stripFrontmatterFallback(raw: string): string {
  try {
    // Match an opening `---`, any content (including newlines), and a closing `---` or `...`.
    const match = raw.match(/^---[\s\S]*?^(?:---|\.\.\.)\s*\n?([\s\S]*)$/m);
    if (match) {
      return match[1] ?? "";
    }
    return raw;
  } catch {
    return raw;
  }
}
