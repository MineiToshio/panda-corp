/**
 * lib/achievements/read-model/informeResolver.ts — the Informe wiring (FRD-23, WO-23-003).
 *
 * Platform golden rule (architecture §1): read-only. Wires the Informe's five materialized
 * sources to try the portada first and fall back to the existing live git readers (WO-10-014)
 * on ANY non-`ok` `PortadaResult` — `missing`, `stale`, AND `unparseable` all fall back
 * (REQ-23-001). The live readers are UNCHANGED (this module only decides which result to use);
 * `getPendingMerge` (FRD-21) is untouched — it is not one of the five sources here and stays
 * on its own always-live path (AC-23-005.1).
 *
 * Honesty (DR-078): a fallback calls the REAL live reader and returns whatever it produces
 * verbatim — including that reader's OWN fail-loud result (e.g. `git-unavailable`) — never a
 * fabricated zero synthesized here. The live readers are passed in as thunks so a fresh portada
 * genuinely skips the git shell-out (AC-23-001.1), not just "ignores the result".
 */

import type {
  FunnelFlow,
  LessonCounts,
  PhaseTransition,
  ReportResult,
  ReportScalars,
  WeeklyFlow,
} from "../report/types";
import type { PortadaResult } from "./statsReader";

/** The five sources the Informe wiring resolves per project (REQ-23-001). */
export type InformeSources = {
  readonly weeklyFlow: ReportResult<WeeklyFlow>;
  readonly phaseTransitions: ReportResult<PhaseTransition[]>;
  readonly scalars: ReportScalars;
  readonly lessons: LessonCounts | null;
  readonly funnel: FunnelFlow;
};

/** Lazy accessors to the existing live git readers (WO-10-014) — called ONLY on fallback. */
export type LiveInformeReaders = {
  readonly weeklyFlow: () => ReportResult<WeeklyFlow>;
  readonly phaseTransitions: () => ReportResult<PhaseTransition[]>;
  readonly scalars: () => ReportScalars;
  readonly lessons: () => LessonCounts | null;
  readonly funnel: () => FunnelFlow;
};

/**
 * Resolve the Informe's five sources from a project's `PortadaResult`, falling back to the
 * live readers on any non-`ok` result (REQ-23-001, AC-23-001.1..4).
 *
 * @param portadaResult - The result of `readStatsPortada(projectPath)` (WO-23-001).
 * @param live - Lazy live-reader accessors (WO-10-014); invoked only when falling back.
 * @returns The five sources, either all from the portada or all from the live readers.
 */
export function resolveInformeSources(
  portadaResult: PortadaResult,
  live: LiveInformeReaders,
): InformeSources {
  if (portadaResult.ok) {
    const portada = portadaResult.value;
    return {
      weeklyFlow: { ok: true, value: portada.weeklyFlow },
      phaseTransitions: { ok: true, value: portada.phaseTransitions as PhaseTransition[] },
      scalars: portada.scalars,
      lessons: portada.lessons,
      funnel: portada.funnel,
    };
  }

  // missing / stale / unparseable — ALL fall back to live (REQ-23-001), never a fabricated zero.
  return {
    weeklyFlow: live.weeklyFlow(),
    phaseTransitions: live.phaseTransitions(),
    scalars: live.scalars(),
    lessons: live.lessons(),
    funnel: live.funnel(),
  };
}
