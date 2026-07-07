/**
 * lib/achievements/read-model/factoryStoreWriter.ts — the single factory-store writer (FRD-23, WO-23-005, REQ-23-006.1).
 *
 * The SINGLE writer (DR-115) of the factory-scoped store `<factory-root>/.pandacorp/stats-factory.json`.
 * It holds the factory-wide facts that must be derived ONCE, not once per project (the SSOT defect
 * the split fixes): `phaseTransitions`, `scalars.{projects,decisions}`, `lessons`. It lives in the
 * factory tooling (invoked by `sync-portfolio` — which already walks the whole factory — and/or the
 * universal per-commit trigger) — NOT the Mission Control render path (architecture §7, ADR-0004).
 *
 * It re-derives every number via the already-shipped pure report cores (`phaseTransitions`,
 * `reportScalars`, `lessonCounts`, DR-092) — it NEVER maintains numbers with incremental `+1/-1`
 * writes (DR-115 forbids it). It stamps `seal = currentFactorySeal(factoryRoot)` so a reader can
 * validate factory-wide freshness and fall back when stale. The materialized numbers EQUAL the live
 * numbers by construction — the writer assembles the store from the very same report readers, it
 * does not re-implement any derivation.
 *
 * The write is ATOMIC (tmp file + `fs.rename`, AC-23-006.3): a crash mid-write can only leave the
 * temp file — the real `stats-factory.json` is either the whole previous version or the whole new
 * one, so the fail-loud reader never sees a half-written, corrupt JSON.
 */

import fs from "node:fs";
import path from "node:path";
import { lessonCounts } from "../report/lessons";
import { phaseTransitions } from "../report/phaseTransitions";
import { reportScalars } from "../report/scalars";
import type { LessonCounts, PhaseTransition, ReportResult } from "../report/types";
import { currentFactorySeal } from "./factorySeal";
import type { FactoryScalars, StatsFactory } from "./statsSchema";

/** The factory-scoped store filename, under the factory root's `.pandacorp/`. */
const STATS_FACTORY_FILENAME = "stats-factory.json";

/**
 * The live-derived factory-wide values the store materializes — exactly the shapes the report
 * readers produce (DR-092: assembled from them, never re-derived). Injected into the pure
 * `buildFactoryStore` so the assembly is unit-testable without git I/O and the equivalence check
 * compares like-for-like.
 *
 * `phaseTransitions` is a `ReportResult` (it can be `git-unavailable` / `unparseable`);
 * `buildFactoryStore` unwraps it and refuses to materialize an un-derivable store (fail loud,
 * DR-078) — a store that lies about "no activity" is worse than no store at all.
 */
export type LiveFactoryValues = {
  readonly phaseTransitions: ReportResult<PhaseTransition[]>;
  readonly scalars: FactoryScalars;
  readonly lessons: LessonCounts | null;
};

/** Provenance + freshness stamp the writer adds on top of the derived numbers. */
export type FactoryStamp = {
  /** `git log -1 --format=%H` across the factory-wide routes — the factory-wide freshness seal. */
  readonly seal: string;
  /** ISO timestamp of when the store was generated (provenance, NOT authority — the seal decides). */
  readonly generatedAt: string;
};

/**
 * Thrown when the live report cores could not derive the factory-wide numbers, or the factory seal
 * is unavailable. Materializing from a non-`ok` source would bake a fabricated "no activity" into
 * the cache (DR-078) — so the writer fails loud and writes nothing; the composed reader's live
 * fallback covers the gap.
 */
export class FactoryDeriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactoryDeriveError";
  }
}

/**
 * Assemble a `StatsFactory` from the already-derived live values + the freshness stamp.
 *
 * Pure: no I/O, no clock, no mutation — same inputs → same store. It only UNWRAPS the report
 * results (it never re-derives a number, DR-092/DR-115), so the materialized store equals the live
 * numbers by construction (equivalence). A non-`ok` `phaseTransitions` or an empty seal throws
 * `FactoryDeriveError` (fail loud — never materialize a fabricated zero, DR-078).
 *
 * @param values - The live factory-wide values (the same the render reads), phaseTransitions as `ReportResult`.
 * @param stamp  - The factory-wide freshness seal + generation timestamp.
 * @returns The typed `StatsFactory` ready to serialize.
 * @throws FactoryDeriveError when a required source could not be derived from git.
 */
export function buildFactoryStore(values: LiveFactoryValues, stamp: FactoryStamp): StatsFactory {
  if (!values.phaseTransitions.ok) {
    throw new FactoryDeriveError(
      `phaseTransitions could not be derived (${values.phaseTransitions.reason})`,
    );
  }
  if (stamp.seal === "") {
    throw new FactoryDeriveError("cannot stamp an empty factory seal");
  }

  return {
    seal: stamp.seal,
    generatedAt: stamp.generatedAt,
    phaseTransitions: values.phaseTransitions.value,
    scalars: values.scalars,
    lessons: values.lessons,
  };
}

/**
 * Gather the live factory-wide values through the SAME report readers the Informe render uses
 * (`phaseTransitions`, `reportScalars`, `lessonCounts`) — so the materialized store is derived once,
 * not twice (DR-092), and equals the live numbers. `reportScalars` needs a project path only to
 * derive its per-project counts; the factory-wide subset it returns (`projects`, `decisions`) is
 * identical for any project, so the factory root is passed.
 *
 * @param factoryRoot - Absolute path to the factory repo root (also the projectPath for `reportScalars`).
 * @returns The live factory-wide values ready for `buildFactoryStore`.
 */
function gatherFactoryValues(factoryRoot: string): LiveFactoryValues {
  const scalars = reportScalars(factoryRoot);
  return {
    phaseTransitions: phaseTransitions(),
    scalars: { projects: scalars.projects, decisions: scalars.decisions },
    lessons: lessonCounts(),
  };
}

/**
 * Write a serialized factory store to `filePath` ATOMICALLY (AC-23-006.3): serialize to a sibling
 * temp file in the SAME directory (so `rename` is a same-filesystem atomic swap), then `fs.rename`
 * it over the target. A crash before the rename leaves only the temp file — never a half-written,
 * corrupt `stats-factory.json` a reader could pick up. The temp file is cleaned up on a failure so
 * a failed write does not litter the directory. Mirrors `writePortadaAtomic`.
 *
 * @param filePath - Absolute path to the target `stats-factory.json`.
 * @param store    - The store to serialize (pretty-printed, trailing newline).
 */
export function writeFactoryStoreAtomic(filePath: string, store: StatsFactory): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${STATS_FACTORY_FILENAME}.${process.pid}.${Date.now()}.tmp`);
  const serialized = `${JSON.stringify(store, null, 2)}\n`;
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

/** Absolute path to the factory-scoped store. */
function factoryStorePath(factoryRoot: string): string {
  return path.join(factoryRoot, ".pandacorp", STATS_FACTORY_FILENAME);
}

/**
 * The single writer (DR-115): re-derive the factory-wide facts from git via the report cores and
 * write the factory store atomically. Invoked by the factory tooling (`sync-portfolio` / the
 * per-commit trigger), NEVER by the MC render path.
 *
 * Fails loud (DR-078): a `null` factory seal (git unavailable) or a non-`ok` `phaseTransitions`
 * throws `FactoryDeriveError` and writes NOTHING — the composed reader's live fallback covers the
 * gap rather than the cache lying. On success the store is written atomically and its path returned.
 *
 * @param factoryRoot - Absolute path to the factory repo root.
 * @param now         - Injectable clock for `generatedAt` (defaults to the real wall clock).
 * @returns The absolute path of the written `stats-factory.json`.
 * @throws FactoryDeriveError when git is unavailable or a required source could not be derived.
 */
export function writeStatsFactory(factoryRoot: string, now: () => Date = () => new Date()): string {
  const seal = currentFactorySeal(factoryRoot);
  if (seal === null) {
    throw new FactoryDeriveError(
      `cannot compute a factory seal for ${factoryRoot} (git unavailable) — refusing to materialize`,
    );
  }
  const values = gatherFactoryValues(factoryRoot);
  const store = buildFactoryStore(values, { seal, generatedAt: now().toISOString() });
  const filePath = factoryStorePath(factoryRoot);
  writeFactoryStoreAtomic(filePath, store);
  return filePath;
}
