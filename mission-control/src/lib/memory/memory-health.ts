import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "../config/config";
import { readLessons } from "./memory";

/**
 * memory-health.ts — memoryHealth() computation (WO-17-002, FRD-17, IF-17-memory).
 *
 * Split from memory.ts to keep both modules under the 500-line limit (clean-code.md).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude, never write.
 *
 * Traceability:
 *   IF-17-memory → REQ-17-005
 *   AC-17-002.4  rawNotes counts inbox + per-project lesson-note lines
 *   AC-17-002.5  lastMemoryRunAt is the most recent mtime proxy; null for fresh factory
 *   AC-17-002.6  staleDays is the integer day delta from lastMemoryRunAt to now
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by memoryHealth(). */
export type MemoryHealth = {
  /** Count of non-empty lines in factory/memory/_inbox.md + per-project .pandacorp/run/lessons.md files. */
  rawNotes: number;
  /** Count of lessons with status === "candidate". */
  candidates: number;
  /**
   * ISO 8601 string of the most recent mtime among LESSON-*.md and _inbox.md files.
   * Null when no such files exist (fresh factory case).
   * Labelled approximate (it is a proxy for "when /pandacorp:memory last ran").
   */
  lastMemoryRunAt: string | null;
  /**
   * Integer days elapsed since lastMemoryRunAt (floor of diff in ms / ms-per-day).
   * Null when lastMemoryRunAt is null.
   */
  staleDays: number | null;
  /**
   * ISO timestamp written by the scheduled daily sweep to `factory/memory/_last-sweep`
   * (loop v2, WO-17-005) — the REAL "last full sweep" signal, unlike the mtime proxy.
   * Null when the marker is absent or its content is not a parseable date (honest empty).
   */
  lastSweepAt: string | null;
  /**
   * Portfolio project names whose `.pandacorp/status.yaml` says `phase: release` but has
   * NO `last_harvest:` stamp — a build that closed without harvesting its lessons
   * (loop v2, WO-17-005). Empty when none (honest empty, never fabricated).
   */
  harvestOrphans: string[];
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Count non-empty lines in a file, returning 0 when the file is absent/unreadable. */
function countNonEmptyLines(filePath: string): number {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return 0;
  }
  return raw.split("\n").filter((line) => line.trim().length > 0).length;
}

/** Return the most recent mtime (ms) among the listed paths, or null when none exist. */
function mostRecentMtime(paths: string[]): number | null {
  let latest: number | null = null;
  for (const p of paths) {
    try {
      const { mtimeMs } = fs.statSync(p);
      if (latest === null || mtimeMs > latest) {
        latest = mtimeMs;
      }
    } catch {
      // File absent or inaccessible — skip.
    }
  }
  return latest;
}

/**
 * Collect the paths of LESSON-*.md files and _inbox.md in the memory directory.
 * Returns [] when the directory is missing or unreadable (fail-soft).
 */
function collectMtimePaths(dir: string, inboxPath: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return result;
  }

  for (const filename of entries) {
    if (filename.startsWith("LESSON-") && filename.endsWith(".md")) {
      result.push(path.join(dir, filename));
    }
  }
  if (fs.existsSync(inboxPath)) {
    result.push(inboxPath);
  }
  return result;
}

/** Derive { lastMemoryRunAt, staleDays } from the most recent mtime (ms), or nulls. */
function deriveStaleness(latestMtimeMs: number | null): {
  lastMemoryRunAt: string | null;
  staleDays: number | null;
} {
  if (latestMtimeMs === null) {
    return { lastMemoryRunAt: null, staleDays: null };
  }
  const lastMemoryRunAt = new Date(latestMtimeMs).toISOString();
  const staleDays = Math.max(0, Math.floor((Date.now() - latestMtimeMs) / MS_PER_DAY));
  return { lastMemoryRunAt, staleDays };
}

/** Split a GFM table row string into trimmed cell strings. */
function splitCells(trimmed: string): string[] {
  return trimmed
    .slice(1)
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Resolve a portfolio path cell to an absolute path, or null when it is a placeholder. */
function resolvePortfolioPath(rawPath: string, factoryRoot: string): string | null {
  const normalizedPath = rawPath.trim();
  if (!normalizedPath || normalizedPath === "—" || normalizedPath === "-") return null;
  return path.isAbsolute(normalizedPath) ? normalizedPath : path.join(factoryRoot, normalizedPath);
}

/** A portfolio row reduced to what memory-health needs. */
type PortfolioProject = { name: string; projectPath: string };

/**
 * Extract project entries (name + absolute path) from a raw portfolio markdown string.
 *
 * Parses the GFM table to pull the first column (Name) and second column (Path).
 * Relative paths are resolved against factoryRoot; absolute paths are used verbatim.
 *
 * Kept inside lib/memory to avoid a circular-import risk with lib/portfolio.
 * Fail-soft: malformed rows are skipped.
 */
function extractProjectEntries(portfolioContent: string, factoryRoot: string): PortfolioProject[] {
  const entries: PortfolioProject[] = [];
  let hasHeader = false;

  for (const line of portfolioContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|[\s|:-]+\|?$/.test(trimmed)) continue;

    const cells = splitCells(trimmed);
    if ((cells[0] ?? "").toLowerCase() === "name") {
      hasHeader = true;
      continue;
    }
    if (!hasHeader) continue;

    const resolved = resolvePortfolioPath(cells[1] ?? "", factoryRoot);
    const name = (cells[0] ?? "").trim();
    if (resolved !== null && name !== "") entries.push({ name, projectPath: resolved });
  }

  return entries;
}

/** Read the portfolio and return its project entries; [] when absent/unreadable. */
function resolvePortfolioProjects(factoryRoot: string): PortfolioProject[] {
  try {
    const portfolioPath = path.join(factoryRoot, "factory", "portfolio.md");
    const portfolioMd = fs.readFileSync(portfolioPath, "utf-8");
    return extractProjectEntries(portfolioMd, factoryRoot);
  } catch {
    return [];
  }
}

/**
 * Read the daily sweep marker (`factory/memory/_last-sweep`, loop v2) and return its
 * ISO timestamp, or null when absent/unparseable (fail-soft, honest empty).
 */
function readLastSweep(dir: string): string | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(dir, "_last-sweep"), "utf-8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "" || Number.isNaN(new Date(trimmed).getTime())) return null;
  return trimmed;
}

/**
 * True when a project's `.pandacorp/status.yaml` says `phase: release` but carries
 * NO `last_harvest:` stamp — the build closed without harvesting (loop v2).
 * Line-anchored matching (LESSON-0008: parse lines, never greedy substrings);
 * a missing/unreadable status.yaml is NOT an orphan (fail-soft).
 */
function isHarvestOrphan(projectPath: string): boolean {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(projectPath, ".pandacorp", "status.yaml"), "utf-8");
  } catch {
    return false;
  }
  const lines = raw.split("\n").map((l) => l.trim());
  const isRelease = lines.some((l) => /^phase:\s*['"]?release['"]?\s*$/.test(l));
  const hasHarvest = lines.some((l) => /^last_harvest:\s*\S/.test(l));
  return isRelease && !hasHarvest;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the memory-health panel data for the self-learning loop (REQ-17-005).
 *
 * - rawNotes: count of non-empty lines in `factory/memory/_inbox.md` plus each
 *   project's `.pandacorp/run/lessons.md`. Per-project paths derived from the
 *   portfolio at call-time. Missing files contribute 0 (no throw).
 * - candidates: count of lessons with status === "candidate".
 * - lastMemoryRunAt: most recent mtime among LESSON-*.md and _inbox.md, as ISO string.
 *   Null when no such files exist (fresh factory; panel nudges to run a first harvest).
 * - staleDays: integer days since lastMemoryRunAt; null when lastMemoryRunAt is null.
 *
 * Read-only: zero writes. No Claude calls. Pure fs reads (FRD-17 non-goal).
 *
 * @returns MemoryHealth object; never throws.
 */
export function memoryHealth(): MemoryHealth {
  const factoryRoot = resolveFactoryRoot();
  const dir = path.join(factoryRoot, "factory", "memory");
  const inboxPath = path.join(dir, "_inbox.md");
  const projects = resolvePortfolioProjects(factoryRoot);

  // rawNotes = inbox lines + per-project run/lessons.md lines.
  let rawNotes = countNonEmptyLines(inboxPath);
  for (const { projectPath } of projects) {
    rawNotes += countNonEmptyLines(path.join(projectPath, ".pandacorp", "run", "lessons.md"));
  }

  const candidates = readLessons().filter((l) => l.status === "candidate").length;
  const { lastMemoryRunAt, staleDays } = deriveStaleness(
    mostRecentMtime(collectMtimePaths(dir, inboxPath)),
  );

  // Loop v2 signals (WO-17-005): the real sweep marker + release-without-harvest projects.
  const lastSweepAt = readLastSweep(dir);
  const harvestOrphans = projects.filter((p) => isHarvestOrphan(p.projectPath)).map((p) => p.name);

  return { rawNotes, candidates, lastMemoryRunAt, staleDays, lastSweepAt, harvestOrphans };
}
