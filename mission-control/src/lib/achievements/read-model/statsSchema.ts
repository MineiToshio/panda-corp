/**
 * lib/achievements/read-model/statsSchema.ts — the materialized portada shape + fail-loud parser (FRD-23, WO-23-001).
 *
 * The `stats.json` portada is an **honest cache** (DR-115) of the already-derived Informe
 * numbers. It REUSES the report layer's shapes verbatim (`report/types.ts`, DR-092) — it does
 * NOT redefine them — so the materialized numbers are the same type the live reader produces.
 *
 * Fail-loud (DR-078): the parser returns a typed `StatsPortada` OR `null` for an unrecognised
 * shape (the reader turns that `null` into an explicit `unparseable` result, never a silent
 * `[]`/`null` masquerading as "no activity"). The project has no Zod dependency (DR-052 — no
 * mid-build dep churn); we mirror the codebase's hand-written type-guard convention (`ideas.ts`).
 */

import type { IdeaStatus } from "../../ideas/ideas";
import type {
  FunnelFlow,
  LessonCounts,
  Phase,
  PhaseTransition,
  ReportScalars,
  WeeklyBucket,
  WeeklyFlow,
} from "../report/types";

/**
 * The materialized read-model for one project (`.pandacorp/stats.json`).
 *
 * `seal` = the hash of the last commit touching the routes that feed the Informe
 * (`git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`). On read, MC compares it against
 * git's current state: match → use the portada; mismatch → stale → fall back to live git.
 * `generatedAt` is provenance (ISO), NOT authority — the seal decides freshness.
 */
export type StatsPortada = {
  readonly seal: string;
  readonly generatedAt: string;
  readonly weeklyFlow: WeeklyFlow;
  readonly phaseTransitions: readonly PhaseTransition[];
  readonly scalars: ReportScalars;
  readonly lessons: LessonCounts | null;
  readonly funnel: FunnelFlow;
};

/** The aggregate index `sync-portfolio` joins from the N portadas (O(1) MC read). */
export type StatsAggregate = {
  readonly projects: Readonly<Record<string, StatsPortada>>;
};

const PHASES: readonly Phase[] = ["product", "design", "architecture", "implementation", "release"];

const IDEA_STATUSES: readonly IdeaStatus[] = [
  "discovered",
  "recommended",
  "in-pipeline",
  "shipped",
  "discarded",
];

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

function parseWeeklyFlow(value: unknown): WeeklyFlow | null {
  if (!isRecord(value)) return null;
  if (!isWeeklyBucketArray(value.woVerified)) return null;
  if (!isWeeklyBucketArray(value.ideasCaptured)) return null;
  if (!isNumber(value.peakWeek)) return null;
  if (!isNumber(value.ideasWithoutCreated)) return null;
  return {
    woVerified: value.woVerified,
    ideasCaptured: value.ideasCaptured,
    peakWeek: value.peakWeek,
    ideasWithoutCreated: value.ideasWithoutCreated,
  };
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

function parseScalars(value: unknown): ReportScalars | null {
  if (!isRecord(value)) return null;
  if (!isNumber(value.frds)) return null;
  if (!isNumber(value.commits)) return null;
  if (!isNumber(value.decisions)) return null;
  if (!isNumber(value.projects)) return null;
  // testsPassing is `number | null` — a real absence ("no cableado"), not corruption.
  if (value.testsPassing !== null && !isNumber(value.testsPassing)) return null;
  return {
    frds: value.frds,
    commits: value.commits,
    decisions: value.decisions,
    projects: value.projects,
    testsPassing: value.testsPassing === null ? null : (value.testsPassing as number),
  };
}

function parseLessons(value: unknown): LessonCounts | null | undefined {
  // Legitimately null ("no cableado"); undefined here means "the key was invalid".
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (!isNumber(value.distilled) || !isNumber(value.captured)) return undefined;
  return { distilled: value.distilled, captured: value.captured };
}

function parseByStatus(value: unknown): Readonly<Record<IdeaStatus, number>> | null {
  if (!isRecord(value)) return null;
  const out = {} as Record<IdeaStatus, number>;
  for (const status of IDEA_STATUSES) {
    const n = value[status];
    if (!isNumber(n)) return null;
    out[status] = n;
  }
  return out;
}

function parseFunnel(value: unknown): FunnelFlow | null {
  if (!isRecord(value)) return null;
  const byStatus = parseByStatus(value.byStatus);
  if (byStatus === null) return null;
  if (!isNumber(value.totalIdeas)) return null;
  if (!isNumber(value.launched)) return null;
  if (!isNumber(value.conversionPct)) return null;
  if (!isNumber(value.wip)) return null;
  if (!isNumber(value.discardsWithoutReason)) return null;
  return {
    totalIdeas: value.totalIdeas,
    byStatus,
    launched: value.launched,
    conversionPct: value.conversionPct,
    wip: value.wip,
    discardsWithoutReason: value.discardsWithoutReason,
  };
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

  const weeklyFlow = parseWeeklyFlow(value.weeklyFlow);
  if (weeklyFlow === null) return null;

  const phaseTransitions = parsePhaseTransitions(value.phaseTransitions);
  if (phaseTransitions === null) return null;

  const scalars = parseScalars(value.scalars);
  if (scalars === null) return null;

  const lessons = parseLessons(value.lessons);
  if (lessons === undefined) return null;

  const funnel = parseFunnel(value.funnel);
  if (funnel === null) return null;

  return {
    seal: value.seal,
    generatedAt: value.generatedAt,
    weeklyFlow,
    phaseTransitions,
    scalars,
    lessons,
    funnel,
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
