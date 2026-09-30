/**
 * lib/achievements/read-model/statsSchema.ts — the materialized store shapes + fail-loud parsers (FRD-23, WO-23-001/005).
 *
 * The `stats.json` portada (per project) and `stats-factory.json` (factory-wide) are **honest
 * caches** (DR-115) of the already-derived Informe numbers. They REUSE the report layer's shapes
 * verbatim (`report/types.ts`, DR-092) — they do NOT redefine them — so the materialized numbers
 * are the same type the live reader produces.
 *
 * SSOT split (DR-115, WO-23-005, REQ-23-006): factory-wide facts (`phaseTransitions`,
 * `scalars.projects`, `scalars.decisions`, `lessons`) live in ONE factory-scoped store validated
 * by a factory-wide seal; the per-project portada keeps ONLY the facts its per-project seal
 * (`docs/frds` + `status.yaml` history) validates: the WO-verified series and the FRD count.
 * Seal coverage (REQ-23-001): `commits`, `funnel` and the ideas-per-week series are NOT held by
 * either store because no seal covers them (commits move on any repo commit; `factory/ideas` is
 * gitignored); they are always live.
 * `ReportScalars` splits into `ProjectScalars` (`frds`) held per-project and
 * `FactoryScalars` (`projects`, `decisions`) held factory-wide.
 *
 * Fail-loud (DR-078): each parser returns a typed value OR `null` for an unrecognised shape (the
 * reader turns that `null` into an explicit `unparseable` result, never a silent `[]`/`null`
 * masquerading as "no activity"). The project has no Zod dependency (DR-052 — no mid-build dep
 * churn); we mirror the codebase's hand-written type-guard convention (`ideas.ts`).
 */

import type {
  LessonCounts,
  Phase,
  PhaseTransition,
  WeeklyBucket,
  WoVerifiedSeries,
} from "../report/types";

/**
 * Per-project scalar counts held in the portada (the per-project subset of `ReportScalars`).
 * `projects` / `decisions` are factory-wide (see `FactoryScalars`); `commits` and `testsPassing`
 * are not sealed by the per-project seal, so they are composed live at read time and live in
 * NEITHER store.
 */
export type ProjectScalars = {
  readonly frds: number;
};

/** Factory-wide scalar counts held in the factory store (the factory-wide subset of `ReportScalars`). */
export type FactoryScalars = {
  readonly projects: number;
  readonly decisions: number;
};

/**
 * The materialized read-model for one project (`.pandacorp/stats.json`).
 *
 * Holds ONLY the facts its seal validates (REQ-23-001/006.4): `woFlow` (WO-verified per ISO week,
 * from the `docs/frds` git history) and per-project `scalars` (`frds`). `seal` = the hash of the last
 * commit touching `docs/frds` + `.pandacorp/status.yaml`, so it validates 100% of the portada's
 * contents. Factory-wide facts live in `StatsFactory`; `commits`, `funnel` and the ideas series are
 * always live. `generatedAt` is provenance (ISO), NOT authority — the seal decides freshness.
 */
export type StatsPortada = {
  readonly seal: string;
  readonly generatedAt: string;
  readonly woFlow: WoVerifiedSeries;
  readonly scalars: ProjectScalars;
};

/** The aggregate index `sync-portfolio` joins from the N portadas (O(1) MC read). */
export type StatsAggregate = {
  readonly projects: Readonly<Record<string, StatsPortada>>;
};

/**
 * The factory-scoped store (`<factory-root>/.pandacorp/stats-factory.json`) — ONE store for the
 * factory-wide facts, single writer, re-derived from git (SSOT split, REQ-23-006.1).
 *
 * `seal` = the hash of the last commit touching the factory-wide routes (`factory/portfolio.md` +
 * `factory/decisions/` + `factory/memory/` + every project's `.pandacorp/status.yaml`); a change to
 * any of them (e.g. a phase change in project B) mismatches the seal and the store is treated stale
 * (REQ-23-006.2). It validates 100% of this store's contents. `generatedAt` is provenance.
 */
export type StatsFactory = {
  readonly seal: string;
  readonly generatedAt: string;
  readonly phaseTransitions: readonly PhaseTransition[];
  readonly scalars: FactoryScalars;
  readonly lessons: LessonCounts | null;
};

const PHASES: readonly Phase[] = ["product", "design", "architecture", "implementation", "release"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** A finite number (rejects NaN/Infinity — a corrupt count must fail loud, not read as a value). */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPhase(value: unknown): value is Phase {
  return isString(value) && (PHASES as readonly string[]).includes(value);
}

function isWeeklyBucket(value: unknown): value is WeeklyBucket {
  return isRecord(value) && isString(value.isoWeek) && isNumber(value.count);
}

function isWeeklyBucketArray(value: unknown): value is readonly WeeklyBucket[] {
  return Array.isArray(value) && value.every(isWeeklyBucket);
}

function parseWoFlow(value: unknown): WoVerifiedSeries | null {
  if (!isRecord(value)) return null;
  if (!isWeeklyBucketArray(value.woVerified)) return null;
  if (!isNumber(value.peakWeek)) return null;
  return { woVerified: value.woVerified, peakWeek: value.peakWeek };
}

function parsePhaseTransition(value: unknown): PhaseTransition | null {
  if (!isRecord(value)) return null;
  if (!isString(value.project)) return null;
  if (!isString(value.date)) return null;
  if (!isPhase(value.from)) return null;
  if (!isPhase(value.to)) return null;
  if (typeof value.isReopen !== "boolean") return null;
  return {
    project: value.project,
    date: value.date,
    from: value.from,
    to: value.to,
    isReopen: value.isReopen,
  };
}

function parsePhaseTransitions(value: unknown): readonly PhaseTransition[] | null {
  if (!Array.isArray(value)) return null;
  const out: PhaseTransition[] = [];
  for (const entry of value) {
    const parsed = parsePhaseTransition(entry);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/** Parse the per-project scalar subset (`frds`) held in the portada. */
function parseProjectScalars(value: unknown): ProjectScalars | null {
  if (!isRecord(value)) return null;
  if (!isNumber(value.frds)) return null;
  return { frds: value.frds };
}

/** Parse the factory-wide scalar subset (`projects`, `decisions`) held in the factory store. */
function parseFactoryScalars(value: unknown): FactoryScalars | null {
  if (!isRecord(value)) return null;
  if (!isNumber(value.projects)) return null;
  if (!isNumber(value.decisions)) return null;
  return { projects: value.projects, decisions: value.decisions };
}

function parseLessons(value: unknown): LessonCounts | null | undefined {
  // Legitimately null ("no cableado"); undefined here means "the key was invalid".
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (!isNumber(value.distilled) || !isNumber(value.captured)) return undefined;
  return { distilled: value.distilled, captured: value.captured };
}

/**
 * Parse an already-`JSON.parse`d value into a `StatsPortada`, or `null` on any unrecognised
 * shape (fail loud — the reader turns `null` into an explicit `unparseable` result).
 *
 * @param value - The parsed JSON of a `stats.json` file (`unknown` at this trust boundary).
 * @returns The typed portada, or `null` when the shape is not a valid portada.
 */
export function parseStatsPortada(value: unknown): StatsPortada | null {
  if (!isRecord(value)) return null;
  if (!isString(value.seal) || value.seal === "") return null;
  if (!isString(value.generatedAt)) return null;

  const woFlow = parseWoFlow(value.woFlow);
  if (woFlow === null) return null;

  const scalars = parseProjectScalars(value.scalars);
  if (scalars === null) return null;

  return { seal: value.seal, generatedAt: value.generatedAt, woFlow, scalars };
}

/**
 * Parse an already-`JSON.parse`d value into a `StatsFactory`, or `null` on any unrecognised shape
 * (fail loud — the reader turns `null` into an explicit `unparseable` result, DR-078).
 *
 * @param value - The parsed JSON of a `stats-factory.json` file (`unknown` at this trust boundary).
 * @returns The typed factory store, or `null` when the shape is not a valid factory store.
 */
export function parseStatsFactory(value: unknown): StatsFactory | null {
  if (!isRecord(value)) return null;
  if (!isString(value.seal) || value.seal === "") return null;
  if (!isString(value.generatedAt)) return null;

  const phaseTransitions = parsePhaseTransitions(value.phaseTransitions);
  if (phaseTransitions === null) return null;

  const scalars = parseFactoryScalars(value.scalars);
  if (scalars === null) return null;

  const lessons = parseLessons(value.lessons);
  if (lessons === undefined) return null;

  return {
    seal: value.seal,
    generatedAt: value.generatedAt,
    phaseTransitions,
    scalars,
    lessons,
  };
}

/**
 * Parse an already-`JSON.parse`d value into a `StatsAggregate`, or `null` on any unrecognised
 * shape (fail loud). Every project's portada must itself parse or the whole aggregate is rejected.
 *
 * @param value - The parsed JSON of the aggregate index (`unknown` at this trust boundary).
 * @returns The typed aggregate, or `null` when the shape is invalid.
 */
export function parseStatsAggregate(value: unknown): StatsAggregate | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.projects)) return null;
  const projects: Record<string, StatsPortada> = {};
  for (const [key, portada] of Object.entries(value.projects)) {
    const parsed = parseStatsPortada(portada);
    if (parsed === null) return null;
    projects[key] = parsed;
  }
  return { projects };
}
