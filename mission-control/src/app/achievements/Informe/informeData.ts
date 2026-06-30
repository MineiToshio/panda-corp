/**
 * Informe/informeData.ts — the assembled, render-ready data for the CMP-10-informe
 * sober operator report (WO-10-015).
 *
 * Pure data-assembly over the WO-10-014 readers: the Server Component (`page.tsx`)
 * reads the typed aggregates (fail-loud `ReportResult` for the git-backed ones) and
 * `buildInformeData` shapes them into the single `InformeData` the `Informe` view
 * renders. No I/O here — the readers are called by the page; this only composes.
 *
 * Honesty contract (DR-078, REQ-10-020): every figure with no wired source is carried
 * as `null` (rendered "—" / "no cableado"), never a fabricated zero. The git-backed
 * series keep their `ReportResult` so the UI can render an explicit error band.
 *
 * Traceability: REQ-10-020..025 (the six bands consume these shapes).
 */

import type {
  FunnelFlow,
  Phase,
  PhaseTransition,
  ReportResult,
  UsageMix,
  WeeklyFlow,
} from "@/lib/achievements/report/types";
import type { NextAction, ReportMetrics } from "@/lib/achievements/report/verdict";
import { factoryVerdict, nextActions } from "@/lib/achievements/report/verdict";
import type { StatusResult } from "@/lib/status/status";

// ── Phase order (mirrors the data layer, single convention) ───────────────────
const PHASE_ORDER: readonly Phase[] = [
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
];

const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  product: "producto",
  design: "diseño",
  architecture: "arquitectura",
  implementation: "construcción",
  release: "lanzado",
};

// ── Shapes the Informe view consumes ──────────────────────────────────────────

/** The pulse band's KPI row (one verdict + four KPIs). */
export type InformePulse = {
  /** WO verified in the most recent week. */
  readonly woPerWeek: number;
  /** WO verified in the previous week (for the delta). */
  readonly woPrevWeek: number;
  /** Active projects (WIP). */
  readonly wip: number;
  /** A short label naming the WIP project(s), or an empty string. */
  readonly wipLabel: string;
  /** Ideas→launched conversion %. */
  readonly conversionPct: number;
  /** Projects launched. */
  readonly launched: number;
  /** Total ideas captured. */
  readonly totalIdeas: number;
  /** Idea→release lead time — `null` ("no cableado"), never a fabricated zero. */
  readonly leadTime: number | null;
};

/** One project's current phase (for the health band's projects-by-phase column). */
export type ProjectPhase = {
  readonly project: string;
  readonly phase: Phase;
};

/** The process-signals column of the health band. */
export type InformeSignals = {
  /** Distilled LESSON cards, or null when the memory source is absent. */
  readonly distilledLessons: number | null;
  /** Captured raw notes, or null when the memory source is absent. */
  readonly capturedLessons: number | null;
  /** Build relaunches. */
  readonly relaunches: number;
  /** Discards without a structured reason. */
  readonly discardsWithoutReason: number;
  /** Quality telemetry — `null` ("no cableado"), never a fabricated zero. */
  readonly qualityTelemetry: number | null;
};

/** The full, render-ready report data the Informe view renders as six bands. */
export type InformeData = {
  readonly verdict: string;
  readonly pulse: InformePulse;
  readonly weeklyFlow: ReportResult<WeeklyFlow>;
  readonly usage: ReportResult<UsageMix>;
  readonly funnel: FunnelFlow;
  readonly transitions: ReportResult<PhaseTransition[]>;
  readonly projectsByPhase: readonly ProjectPhase[];
  readonly signals: InformeSignals;
  readonly actions: readonly NextAction[];
};

// ── Assembly inputs ───────────────────────────────────────────────────────────

/** The readers + statuses the page passes in (already read; this stays pure). */
export type InformeInputs = {
  readonly weeklyFlow: ReportResult<WeeklyFlow>;
  readonly usage: ReportResult<UsageMix>;
  readonly funnel: FunnelFlow;
  readonly transitions: ReportResult<PhaseTransition[]>;
  readonly statuses: readonly StatusResult[];
  readonly lessons: { readonly distilled: number; readonly captured: number } | null;
  readonly relaunches: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The most-recent and previous WO-verified week counts from the flow series. */
function woWeekCounts(weeklyFlow: ReportResult<WeeklyFlow>): { current: number; previous: number } {
  if (!weeklyFlow.ok) return { current: 0, previous: 0 };
  const series = weeklyFlow.value.woVerified;
  const last = series.at(-1);
  const prev = series.at(-2);
  return { current: last?.count ?? 0, previous: prev?.count ?? 0 };
}

/** Active projects with a readable phase, as project→phase rows (for the health band). */
function activeProjectPhases(statuses: readonly StatusResult[]): ProjectPhase[] {
  const rows: ProjectPhase[] = [];
  for (const s of statuses) {
    if (!s.present || s.malformed) continue;
    const project = s.status.project;
    const phase = s.status.phase;
    if (project === undefined || phase === undefined) continue;
    rows.push({ project, phase });
  }
  return rows.sort(
    (a, b) =>
      PHASE_ORDER.indexOf(b.phase) - PHASE_ORDER.indexOf(a.phase) ||
      a.project.localeCompare(b.project),
  );
}

/** A short "name · phase" label for the first WIP project, or "" when none. */
function wipLabelOf(rows: readonly ProjectPhase[]): string {
  const wipPhases: readonly Phase[] = ["design", "architecture", "implementation"];
  const first = rows.find((r) => wipPhases.includes(r.phase));
  return first === undefined ? "" : `${first.project} · ${PHASE_LABELS[first.phase]}`;
}

// ── Public: assemble the Informe data ─────────────────────────────────────────

/**
 * Compose the render-ready `InformeData` from the already-read aggregates (pure).
 *
 * @param inputs - The WO-10-014 reader outputs + statuses + lessons + relaunches.
 * @returns The six-band data, with every unwired figure carried as `null`.
 */
export function buildInformeData(inputs: InformeInputs): InformeData {
  const { current, previous } = woWeekCounts(inputs.weeklyFlow);
  const projectsByPhase = activeProjectPhases(inputs.statuses);

  const metrics: ReportMetrics = {
    launched: inputs.funnel.launched,
    wip: inputs.funnel.wip,
    conversionPct: inputs.funnel.conversionPct,
    discardsWithoutReason: inputs.funnel.discardsWithoutReason,
    lessonCaptured: inputs.lessons?.captured ?? 0,
    lessonDistilled: inputs.lessons?.distilled ?? 0,
    peakWeek: inputs.weeklyFlow.ok ? inputs.weeklyFlow.value.peakWeek : 0,
  };

  return {
    verdict: factoryVerdict(metrics),
    pulse: {
      woPerWeek: current,
      woPrevWeek: previous,
      wip: inputs.funnel.wip,
      wipLabel: wipLabelOf(projectsByPhase),
      conversionPct: inputs.funnel.conversionPct,
      launched: inputs.funnel.launched,
      totalIdeas: inputs.funnel.totalIdeas,
      leadTime: null,
    },
    weeklyFlow: inputs.weeklyFlow,
    usage: inputs.usage,
    funnel: inputs.funnel,
    transitions: inputs.transitions,
    projectsByPhase,
    signals: {
      distilledLessons: inputs.lessons?.distilled ?? null,
      capturedLessons: inputs.lessons?.captured ?? null,
      relaunches: inputs.relaunches,
      discardsWithoutReason: inputs.funnel.discardsWithoutReason,
      qualityTelemetry: null,
    },
    actions: nextActions(metrics),
  };
}
