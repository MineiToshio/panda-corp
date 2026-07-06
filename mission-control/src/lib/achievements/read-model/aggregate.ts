/**
 * lib/achievements/read-model/aggregate.ts — the O(1) aggregate index join (FRD-23, WO-23-004, REQ-23-003).
 *
 * `sync-portfolio` already walks every project; this module JOINS the N per-project portadas
 * (`.pandacorp/stats.json`) into ONE aggregate file (`StatsAggregate`) Mission Control reads in
 * O(1) — a single `fs.readFileSync` + parse, independent of the number of projects (AC-23-003.1).
 * Before this, the Informe paid an O(N) git shell-out per navigation; the join moves that cost to
 * "once per project when it changes" (the writer) and once at portfolio-sync time (this join).
 *
 * Platform golden rule (architecture §1): the writers live in the factory tooling — this module is
 * invoked by the `sync-portfolio` skill / the CLI in `scripts/`, NOT by the MC render path. MC only
 * READS the aggregate (via `readStatsAggregate`, WO-23-001).
 *
 * Fail-loud (DR-078): `syncStatsAggregate` reads each project's portada through the fail-loud reader
 * (`readStatsPortada`) — a missing or corrupt portada is SKIPPED with an explicit reason (never a
 * silent empty poisoning the whole join), and the aggregate reader itself throws / returns an
 * explicit error on a malformed aggregate (AC-23-003.2). The write is ATOMIC (tmp + rename) so a
 * crash mid-write never leaves a half-written, corrupt index a reader could pick up.
 */

import fs from "node:fs";
import path from "node:path";
import { parseStatsPortada, type StatsAggregate, type StatsPortada } from "./statsSchema";

/** The default aggregate index filename (under the factory root's `.pandacorp/`). */
export const STATS_AGGREGATE_FILENAME = "stats-aggregate.json";

/** One project's contribution to the aggregate join: its stable key + its parsed portada. */
export type PortadaJoinEntry = {
  /** Stable project key (e.g. the portfolio path cell) — the aggregate's `projects` record key. */
  readonly projectKey: string;
  /** The project's already-parsed portada. */
  readonly portada: StatsPortada;
};

/**
 * Why a portada was not joined. Note: staleness is NOT a join-time skip — the aggregate is a JOIN
 * that may legitimately hold independently-stale entries; per-project seal validation happens at the
 * point of use (`readStatsPortada`, WO-23-001), NOT here. So a parseable-but-stale portada is still
 * joined; only a genuinely absent (`missing`) or corrupt (`unparseable`) one is skipped.
 */
type AggregateSkipReason = "missing" | "unparseable";

/** A project skipped during the sync join, with the fail-loud reason (never silently dropped). */
type AggregateSkip = {
  readonly projectKey: string;
  /** Why the portada was not joined — `missing` (no file) or `unparseable` (corrupt). */
  readonly reason: AggregateSkipReason;
};

/** The outcome of a `syncStatsAggregate` run — what was joined vs. explicitly skipped. */
export type AggregateSyncSummary = {
  /** How many portadas were joined into the aggregate. */
  readonly joined: number;
  /** Projects skipped (with an explicit reason) — reported, never silently absorbed. */
  readonly skipped: readonly AggregateSkip[];
};

/**
 * Join N per-project portadas into one `StatsAggregate` (pure — no I/O).
 *
 * Keyed by `projectKey`; a duplicate key is last-write-wins (the caller controls uniqueness). An
 * empty entry list yields an explicit `{ projects: {} }`, NOT an error — an empty portfolio is a
 * legitimate state, not a failure.
 *
 * @param entries - One `{ projectKey, portada }` per project to include.
 * @returns The aggregate index MC reads in O(1).
 */
export function buildStatsAggregate(entries: readonly PortadaJoinEntry[]): StatsAggregate {
  const projects: Record<string, StatsPortada> = {};
  for (const entry of entries) {
    projects[entry.projectKey] = entry.portada;
  }
  return { projects };
}

/**
 * Write a `StatsAggregate` to `filePath` ATOMICALLY (tmp file in the SAME dir → `fs.rename` is a
 * same-filesystem atomic swap). A crash before the rename leaves only the temp file — never a
 * half-written, corrupt index the fail-loud reader could pick up. Mirrors `writePortadaAtomic`.
 *
 * @param filePath  - Absolute path to the target aggregate file.
 * @param aggregate - The aggregate to serialize (pretty-printed, trailing newline).
 */
export function writeStatsAggregate(filePath: string, aggregate: StatsAggregate): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const serialized = `${JSON.stringify(aggregate, null, 2)}\n`;
  try {
    fs.writeFileSync(tmpPath, serialized, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // Best-effort cleanup — the original error is what matters, re-thrown below.
    }
    throw error;
  }
}

/** One project the sync join walks: its stable key + its absolute path (where the portada lives). */
export type AggregateSyncProject = {
  readonly projectKey: string;
  readonly projectPath: string;
};

/** The materialized portada file, relative to a project root. */
const STATS_FILENAME = "stats.json";

/** True when a filesystem error is a "file not found" (ENOENT) — a real absence, not corruption. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Parse-only read of one project's portada for the JOIN (no seal validation, by design — see
 * `AggregateSkipReason`). Fail-loud (DR-078): a discriminated result, never a silent empty.
 *   - present + parseable → `{ ok: true, portada }` (even if stale — seal is validated at read time)
 *   - absent (ENOENT)     → `{ ok: false, reason: "missing" }`
 *   - malformed / wrong shape → `{ ok: false, reason: "unparseable" }`
 * Any OTHER fs error (permissions, I/O) is genuinely unexpected and re-thrown, never swallowed.
 */
type JoinReadResult =
  | { readonly ok: true; readonly portada: StatsPortada }
  | { readonly ok: false; readonly reason: AggregateSkipReason };

function readPortadaForJoin(projectPath: string): JoinReadResult {
  const filePath = path.join(projectPath, ".pandacorp", STATS_FILENAME);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    if (isNotFound(error)) {
      return { ok: false, reason: "missing" };
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  const portada = parseStatsPortada(json);
  if (portada === null) {
    return { ok: false, reason: "unparseable" };
  }
  return { ok: true, portada };
}

/**
 * Read each project's on-disk portada and JOIN them into one aggregate index written to
 * `aggregatePath`, so MC then reads all projects' Informe numbers in O(1) (AC-23-003.1).
 *
 * Fail-loud per entry (DR-078): a project whose portada is `missing` or `unparseable` is SKIPPED
 * with its explicit reason (reported in the summary), never a silent empty that poisons the whole
 * join. A parseable-but-STALE portada IS joined (staleness is a read-time concern validated per
 * project by `readStatsPortada`, not a join-time skip) — the aggregate may legitimately hold
 * independently-stale entries. Only the successfully-parsed portadas are joined.
 *
 * @param projects      - The projects to walk ({ projectKey, projectPath }).
 * @param aggregatePath - Absolute path the joined aggregate is written to.
 * @param deps          - Injectable per-project parse-only reader (defaults to `readPortadaForJoin`).
 * @returns A summary of how many were joined and which were explicitly skipped.
 */
export function syncStatsAggregate(
  projects: readonly AggregateSyncProject[],
  aggregatePath: string,
  deps: { readPortada?: (projectPath: string) => JoinReadResult } = {},
): AggregateSyncSummary {
  const readPortada = deps.readPortada ?? readPortadaForJoin;

  const entries: PortadaJoinEntry[] = [];
  const skipped: AggregateSkip[] = [];

  for (const project of projects) {
    const result = readPortada(project.projectPath);
    if (result.ok) {
      entries.push({ projectKey: project.projectKey, portada: result.portada });
    } else {
      skipped.push({ projectKey: project.projectKey, reason: result.reason });
    }
  }

  writeStatsAggregate(aggregatePath, buildStatsAggregate(entries));
  return { joined: entries.length, skipped };
}
