/**
 * lib/achievements/report/flowSeries.ts — IF-10-flow-series (`weeklyFlow`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only. Fail-loud (DR-078): the pure
 * derivation returns a `ReportResult` — a typed value OR an explicit absent/error variant —
 * so the UI distinguishes "no activity yet" (a real zero) from "git unavailable / unparseable".
 *
 * WO-verified-per-week reads the git history of each `work-orders/wo-*.md` for the commit
 * where `implementation_status` crosses to VERIFIED, bucketed by ISO week. Ideas-per-week
 * reads the `created` frontmatter of `factory/ideas/*.md`. Git access is via `execSync`
 * (reusing build-track.ts's fail-soft pattern), scoped to the pathspec and `-n`-capped.
 *
 * Traceability: AC-10-014.1 / .7.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { resolveFactoryRoot } from "../../config/config";
import type { ReportResult, WeeklyBucket, WeeklyFlow } from "./types";

/**
 * ISO week key "YYYY-WW" (Monday-based) for a date. Matches signals.ts / stats.ts so the
 * three weekly series share one bucketing convention (DR-092).
 */
export function isoWeekKey(d: Date): string {
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000);
  const weekNum = Math.floor((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

/** Parsed inputs for the pure derivation — separated so it is testable without a repo. */
export type FlowInput = {
  /** ISO date strings (one per wo) of when each WO crossed to VERIFIED; null = never verified. */
  readonly verifiedAt: readonly (string | null)[];
  /** ISO date strings (one per idea) of the `created` frontmatter; null = no `created`. */
  readonly ideasCreated: readonly (string | null)[];
};

/** Bucket an array of ISO date strings by ISO week. Returns null when any date is unparseable. */
function bucketByWeek(dates: readonly (string | null)[]): Map<string, number> | null {
  const counts = new Map<string, number>();
  for (const raw of dates) {
    if (raw === null || raw === undefined) continue;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return null; // fail loud — never silently drop
    const key = isoWeekKey(new Date(ms));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Sort a week→count map into ascending-by-week buckets. */
function toBuckets(counts: Map<string, number>): WeeklyBucket[] {
  return [...counts.entries()]
    .map(([isoWeek, count]) => ({ isoWeek, count }))
    .sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
}

/**
 * Pure derivation of the weekly flow (IF-10-flow-series core).
 *
 * - `input === null` → the git source was unavailable → `{ ok: false, reason: "git-unavailable" }`.
 * - any unparseable date → `{ ok: false, reason: "unparseable" }` (fail loud, DR-078).
 * - otherwise the typed WeeklyFlow (an empty source is a legitimate `{ ok: true }` zero).
 */
export function deriveWeeklyFlow(input: FlowInput | null): ReportResult<WeeklyFlow> {
  if (input === null) return { ok: false, reason: "git-unavailable" };

  const woCounts = bucketByWeek(input.verifiedAt);
  if (woCounts === null) return { ok: false, reason: "unparseable" };

  // Ideas: a null `created` is EXCLUDED + tallied; a present-but-unparseable date fails loud.
  const ideasWithoutCreated = input.ideasCreated.filter(
    (c) => c === null || c === undefined,
  ).length;
  const ideaCounts = bucketByWeek(input.ideasCreated);
  if (ideaCounts === null) return { ok: false, reason: "unparseable" };

  const woVerified = toBuckets(woCounts);
  const peakWeek = woVerified.reduce((max, b) => Math.max(max, b.count), 0);

  return {
    ok: true,
    value: {
      woVerified,
      ideasCaptured: toBuckets(ideaCounts),
      peakWeek,
      ideasWithoutCreated,
    },
  };
}

// ---------------------------------------------------------------------------
// Impure shell — gather the inputs from git + the ideas frontmatter
// ---------------------------------------------------------------------------

/**
 * The earliest commit time (ISO) at which `implementation_status: VERIFIED` is ADDED to each
 * `wo-*.md`, gathered in a SINGLE `git log -p` pass over the whole `docs/frds` pathspec. Each
 * commit is prefixed by a NUL-marked ISO date (`--format=%x00%cI`); each diff's `+++ b/<path>`
 * header names the file, and the first `+…implementation_status: VERIFIED` added line per file
 * marks its crossing (first one wins, oldest→newest via `--reverse`). Keyed by the repo-root-
 * relative path git emits. `{}` when git is unavailable (fail-soft).
 *
 * NOT `-n`-capped: the combined pathspec has far more commits than any single wo, and a cap
 * (`-n N --reverse` keeps the N NEWEST) would drop the oldest crossings. This replaces one
 * `git log -G` pickaxe subprocess PER wo file (98 files ⇒ ~2s of process-spawn on the
 * /achievements render) with one subprocess for the whole tree (~150ms), output-identical to
 * the per-file scan (equivalence verified, DR-092 perf).
 */
function verifiedIsoByWo(repoRoot: string): Map<string, string> {
  const firstByPath = new Map<string, string>();
  let log = "";
  try {
    log = execSync('git log --reverse --format=%x00%cI -p -- "docs/frds"', {
      cwd: repoRoot,
      encoding: "utf-8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return firstByPath;
  }
  let currentIso = "";
  let currentFile = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("\0")) {
      currentIso = line.slice(1);
      continue;
    }
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (currentFile !== "" && /^\+.*implementation_status:\s*VERIFIED/.test(line)) {
      if (!firstByPath.has(currentFile)) firstByPath.set(currentFile, currentIso);
    }
  }
  return firstByPath;
}

/**
 * Resolve one wo file's VERIFIED ISO from the combined map. The map is keyed by the repo-root-
 * relative path git emits (`+++ b/<root-rel>`); `relPath` is project-root-relative, so when a
 * project shares a parent repo's `.git` (Mission Control lives INSIDE the factory repo) the key
 * is a suffix of the project path. Match exact-or-suffix. Null when the wo never crossed VERIFIED.
 */
function lookupVerified(map: ReadonlyMap<string, string>, relPath: string): string | null {
  const direct = map.get(relPath);
  if (direct !== undefined) return direct;
  for (const [key, iso] of map) {
    if (key.endsWith(`/${relPath}`)) return iso;
  }
  return null;
}

/** True when git is usable in `repoRoot` (a single cheap probe so absence is detectable). */
function gitAvailable(repoRoot: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/** Recursively collect every `wo-*.md` path under a project's docs/frds/. */
function collectWoFiles(projectPath: string): string[] {
  const frdsDir = path.join(projectPath, "docs", "frds");
  const result: string[] = [];
  let frds: fs.Dirent[];
  try {
    frds = fs.readdirSync(frdsDir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const frd of frds) {
    if (!frd.isDirectory()) continue;
    const woDir = path.join(frdsDir, frd.name, "work-orders");
    let entries: string[];
    try {
      entries = fs.readdirSync(woDir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (/^wo-.*\.md$/.test(f)) {
        result.push(path.relative(projectPath, path.join(woDir, f)));
      }
    }
  }
  return result;
}

/** Read every idea card's `created` frontmatter (null when absent/unparseable frontmatter). */
function readIdeaCreatedDates(factoryRoot: string): (string | null)[] {
  const ideasDir = path.join(factoryRoot, "factory", "ideas");
  let entries: string[];
  try {
    entries = fs.readdirSync(ideasDir);
  } catch {
    return [];
  }
  const dates: (string | null)[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md") || name.startsWith("_") || name === "decision-log.md") continue;
    let created: string | null = null;
    try {
      const fm = matter(fs.readFileSync(path.join(ideasDir, name), "utf-8")).data as Record<
        string,
        unknown
      >;
      const raw = fm.created;
      created = typeof raw === "string" ? raw : raw instanceof Date ? raw.toISOString() : null;
    } catch {
      created = null;
    }
    dates.push(created);
  }
  return dates;
}

/**
 * Read the weekly flow for a project (git-backed, fail-loud).
 *
 * @param projectPath - Absolute path to the project repo whose wo-*.md history is read.
 * @returns A `ReportResult<WeeklyFlow>` — absent when git is unavailable, unparseable on a bad date.
 */
function readWeeklyFlow(projectPath: string): ReportResult<WeeklyFlow> {
  if (!projectPath || projectPath.trim() === "" || !gitAvailable(projectPath)) {
    return { ok: false, reason: "git-unavailable" };
  }
  const woFiles = collectWoFiles(projectPath);
  const verifiedIso = verifiedIsoByWo(projectPath);
  const verifiedAt = woFiles.map((rel) => lookupVerified(verifiedIso, rel));
  const ideasCreated = readIdeaCreatedDates(resolveFactoryRoot());
  return deriveWeeklyFlow({ verifiedAt, ideasCreated });
}

/**
 * Per-request-cached `readWeeklyFlow` (React `cache`, DR-092) so a tab render does not
 * re-run git per row. Keyed on `projectPath`.
 */
export const weeklyFlow: (projectPath: string) => ReportResult<WeeklyFlow> = cache(readWeeklyFlow);
