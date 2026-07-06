/**
 * lib/achievements/read-model/statsWriter.ts — the single portada writer (FRD-23, WO-23-002, REQ-23-002).
 *
 * The SINGLE writer (DR-115) of the materialized read-model `.pandacorp/stats.json`. It lives in
 * the **factory tooling** (invoked by the Stop hook / `post-commit` hook / `sync-portfolio` /
 * backfill) — NOT in the Mission Control render path (architecture §7, ADR-0004): MC only READS
 * the portada. The writer re-derives every number **from git** via the already-shipped pure report
 * cores (`src/lib/achievements/report/*`, DR-092) — it NEVER maintains numbers with incremental
 * `+1/-1` writes (DR-115 forbids it; that drifts).
 *
 * Honest cache (DR-115): the portada is a replica of what the live git reader derives. The writer
 * stamps `seal = currentSeal(projectPath)` (`git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`)
 * so a reader can validate freshness against git and fall back when stale. The materialized numbers
 * EQUAL the live-git numbers by construction — the writer assembles the portada from the very same
 * report readers the render uses, it does not re-implement any derivation (AC-23-002.3).
 *
 * The write is ATOMIC (tmp file + `fs.rename`, AC-23-002.2): a crash mid-write can only leave the
 * temp file — the real `stats.json` is either the whole previous version or the whole new one, so
 * the fail-loud reader never sees a half-written, corrupt JSON.
 */

import fs from "node:fs";
import path from "node:path";
import { getGuildState } from "../../gamification/guildState";
import type { IdeaCard } from "../../ideas/ideas";
import { readIdeas } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import { weeklyFlow } from "../report/flowSeries";
import { funnelAndFlow } from "../report/funnel";
import { lessonCounts } from "../report/lessons";
import { phaseTransitions } from "../report/phaseTransitions";
import { reportScalars } from "../report/scalars";
import type {
  FunnelFlow,
  LessonCounts,
  PhaseTransition,
  ReportResult,
  ReportScalars,
  WeeklyFlow,
} from "../report/types";
import { currentSeal } from "./seal";
import type { StatsPortada } from "./statsSchema";

/** The materialized portada file, relative to a project's `.pandacorp/`. */
const STATS_FILENAME = "stats.json";

/**
 * The live-derived report values the portada materializes — exactly the shapes the report readers
 * produce (DR-092: assembled from them, never re-derived). Injected into the pure `buildPortada`
 * so the assembly is unit-testable without git I/O and the equivalence check compares like-for-like.
 *
 * `weeklyFlow` / `phaseTransitions` are `ReportResult` (they can be `git-unavailable` /
 * `unparseable`); `buildPortada` unwraps them and refuses to materialize an un-derivable portada
 * (fail loud, DR-078) — a portada that lies about "no activity" is worse than no portada at all.
 */
export type LiveReportValues = {
  readonly weeklyFlow: ReportResult<WeeklyFlow>;
  readonly phaseTransitions: ReportResult<PhaseTransition[]>;
  readonly scalars: ReportScalars;
  readonly lessons: LessonCounts | null;
  readonly funnel: FunnelFlow;
};

/** Provenance + freshness stamp the writer adds on top of the derived numbers. */
export type PortadaStamp = {
  /** `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml` — the freshness seal. */
  readonly seal: string;
  /** ISO timestamp of when the portada was generated (provenance, NOT authority — the seal decides). */
  readonly generatedAt: string;
};

/**
 * Thrown when the live git readers could not derive the numbers the portada needs (a
 * `git-unavailable` / `unparseable` `ReportResult`, or a `null` seal). Materializing a portada
 * from a non-`ok` source would bake a fabricated "no activity" into the cache (DR-078) — so the
 * writer fails loud and writes nothing; the reader's live-git fallback covers the gap.
 */
export class PortadaDeriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortadaDeriveError";
  }
}

/**
 * Assemble a `StatsPortada` from the already-derived live report values + the freshness stamp.
 *
 * Pure: no I/O, no clock, no mutation — same inputs → same portada. It only UNWRAPS the report
 * results (it never re-derives a number, DR-092/DR-115), so the materialized portada equals the
 * live-git numbers by construction (AC-23-002.3). A non-`ok` `weeklyFlow`/`phaseTransitions`
 * throws `PortadaDeriveError` (fail loud — never materialize a fabricated zero, DR-078).
 *
 * @param values - The live report values (the same the render reads), some as `ReportResult`.
 * @param stamp  - The freshness seal + generation timestamp.
 * @returns The typed `StatsPortada` ready to serialize.
 * @throws PortadaDeriveError when a required source could not be derived from git.
 */
export function buildPortada(values: LiveReportValues, stamp: PortadaStamp): StatsPortada {
  if (!values.weeklyFlow.ok) {
    throw new PortadaDeriveError(`weeklyFlow could not be derived (${values.weeklyFlow.reason})`);
  }
  if (!values.phaseTransitions.ok) {
    throw new PortadaDeriveError(
      `phaseTransitions could not be derived (${values.phaseTransitions.reason})`,
    );
  }
  if (stamp.seal === "") {
    throw new PortadaDeriveError("cannot stamp an empty seal");
  }

  return {
    seal: stamp.seal,
    generatedAt: stamp.generatedAt,
    weeklyFlow: values.weeklyFlow.value,
    phaseTransitions: values.phaseTransitions.value,
    scalars: values.scalars,
    lessons: values.lessons,
    funnel: values.funnel,
  };
}

/**
 * Gather the live report values for a project through the SAME report readers the Informe render
 * uses (`weeklyFlow`, `phaseTransitions`, `reportScalars`, `lessonCounts`, `funnelAndFlow`) — so
 * the materialized portada is derived once, not twice (DR-092), and equals the live numbers.
 *
 * `ideas` + `statuses` feed the pure `funnelAndFlow`; when omitted they are read from the same
 * single sources the render reads (`readIdeas`, `getGuildState`), so a standalone writer call
 * (hook / backfill) produces the identical funnel the render would.
 *
 * @param projectPath - Absolute path to the project's git work-tree.
 * @param ideas       - Optional pre-read idea cards (defaults to `readIdeas()`).
 * @param statuses    - Optional pre-read project statuses (defaults to `getGuildState().statuses`).
 * @returns The live report values ready for `buildPortada`.
 */
export function gatherLiveValues(
  projectPath: string,
  ideas: readonly IdeaCard[] = readIdeas(),
  statuses: readonly StatusResult[] = getGuildState().statuses,
): LiveReportValues {
  return {
    weeklyFlow: weeklyFlow(projectPath),
    phaseTransitions: phaseTransitions(),
    scalars: reportScalars(projectPath),
    lessons: lessonCounts(),
    funnel: funnelAndFlow(ideas, statuses),
  };
}

/** Absolute path to a project's materialized portada. */
function portadaPath(projectPath: string): string {
  return path.join(projectPath, ".pandacorp", STATS_FILENAME);
}

/**
 * Write a serialized portada to `filePath` ATOMICALLY (AC-23-002.2): serialize to a sibling temp
 * file in the SAME directory (so `rename` is a same-filesystem atomic swap), then `fs.rename` it
 * over the target. A crash before the rename leaves only the temp file — never a half-written,
 * corrupt `stats.json` a reader could pick up. The temp file is cleaned up on a serialization/
 * write failure so a failed write does not litter the directory.
 *
 * @param filePath - Absolute path to the target `stats.json`.
 * @param portada  - The portada to serialize (pretty-printed, trailing newline).
 */
export function writePortadaAtomic(filePath: string, portada: StatsPortada): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  // A unique temp name in the SAME dir keeps the rename on one filesystem (atomic) and avoids
  // collisions if two writers race — each renames its own temp over the target (last wins, whole).
  const tmpPath = path.join(dir, `.${STATS_FILENAME}.${process.pid}.${Date.now()}.tmp`);
  const serialized = `${JSON.stringify(portada, null, 2)}\n`;
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

/**
 * The single writer (DR-115): re-derive a project's portada from git via the report cores and
 * write it atomically. Invoked by the factory tooling (hooks / backfill / `sync-portfolio`), NEVER
 * by the MC render path.
 *
 * Fails loud (DR-078): a `null` seal (git unavailable) or a non-`ok` required source throws
 * `PortadaDeriveError` and writes NOTHING — the reader's live-git fallback covers the gap rather
 * than the cache lying. On success the portada is written atomically and its absolute path returned.
 *
 * @param projectPath - Absolute path to the project's git work-tree.
 * @param now         - Injectable clock for `generatedAt` (defaults to the real wall clock).
 * @returns The absolute path of the written `stats.json`.
 * @throws PortadaDeriveError when git is unavailable or a required source could not be derived.
 */
export function writeStatsPortada(projectPath: string, now: () => Date = () => new Date()): string {
  const seal = currentSeal(projectPath);
  if (seal === null) {
    throw new PortadaDeriveError(
      `cannot compute a seal for ${projectPath} (git unavailable) — refusing to materialize`,
    );
  }
  const values = gatherLiveValues(projectPath);
  const portada = buildPortada(values, { seal, generatedAt: now().toISOString() });
  const filePath = portadaPath(projectPath);
  writePortadaAtomic(filePath, portada);
  return filePath;
}
