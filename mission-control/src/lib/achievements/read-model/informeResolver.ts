/**
 * lib/achievements/read-model/informeResolver.ts — the Informe wiring (FRD-23, WO-23-003 + WO-23-005 SSOT split).
 *
 * Platform golden rule (architecture §1): read-only. Wires the Informe's sources: PER-PROJECT facts
 * (`weeklyFlow`, per-project `scalars`, `funnel`) come from the portada when it is fresh and fall
 * back to the live git readers on ANY non-`ok` `PortadaResult` — `missing`, `stale`, AND
 * `unparseable` all fall back (REQ-23-001). The live readers are UNCHANGED (this module only decides
 * which result to use); `getPendingMerge` (FRD-21) is untouched (AC-23-005.1).
 *
 * SSOT split (WO-23-005): the portada NO LONGER holds factory-wide facts (`phaseTransitions`,
 * `scalars.{projects,decisions}`, `lessons`) — its per-project seal cannot validate them. Until the
 * factory store is wired in (WO-23-006 recompose), the factory-wide facts here come from the live
 * `derive*` cores ALWAYS (never a stale embedded copy). The render shape (`InformeSources`,
 * FRD-10) is unchanged — the split is invisible to the render, only the SOURCE of the numbers moves.
 *
 * Honesty (DR-078): a fallback calls the REAL live reader and returns whatever it produces
 * verbatim — including that reader's OWN fail-loud result (e.g. `git-unavailable`) — never a
 * fabricated zero synthesized here. The live readers are passed in as thunks so a fresh portada
 * genuinely skips the git shell-out for the per-project facts (AC-23-001.1).
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

/** The sources the Informe wiring resolves per project (the shape FRD-10 renders, unchanged). */
export type InformeSources = {
  readonly weeklyFlow: ReportResult<WeeklyFlow>;
  readonly phaseTransitions: ReportResult<PhaseTransition[]>;
  readonly scalars: ReportScalars;
  readonly lessons: LessonCounts | null;
  readonly funnel: FunnelFlow;
};

/** Lazy accessors to the existing live git readers (WO-10-014) — called ONLY on fallback / for factory-wide facts. */
export type LiveInformeReaders = {
  readonly weeklyFlow: () => ReportResult<WeeklyFlow>;
  readonly phaseTransitions: () => ReportResult<PhaseTransition[]>;
  readonly scalars: () => ReportScalars;
  readonly lessons: () => LessonCounts | null;
  readonly funnel: () => FunnelFlow;
};

/**
 * Resolve the Informe's sources from a project's `PortadaResult`.
 *
 * PER-PROJECT facts (`weeklyFlow`, per-project `scalars.{frds,commits}`, `funnel`) come from the
 * portada when it is fresh (AC-23-001.1) and fall back to the live readers on any non-`ok` result
 * (AC-23-001.2..4). FACTORY-WIDE facts (`phaseTransitions`, `scalars.{projects,decisions}`,
 * `lessons`) always come from the live `derive*` cores — the portada no longer holds them (SSOT
 * split, REQ-23-006.4). Never a fabricated zero (DR-078).
 *
 * @param portadaResult - The result of `readStatsPortada(projectPath)` (WO-23-001).
 * @param live - Lazy live-reader accessors (WO-10-014); the factory-wide ones are always invoked.
 * @returns The Informe sources composed from the portada (per-project) + live (factory-wide).
 */
export function resolveInformeSources(
  portadaResult: PortadaResult,
  live: LiveInformeReaders,
): InformeSources {
  // Factory-wide facts are not validated by the per-project seal → always live (SSOT split).
  const phaseTransitions = live.phaseTransitions();
  const lessons = live.lessons();
  const liveScalars = live.scalars();

  if (portadaResult.ok) {
    const portada = portadaResult.value;
    return {
      weeklyFlow: { ok: true, value: portada.weeklyFlow },
      phaseTransitions,
      // Compose the render's full `ReportScalars`: per-project counts from the portada +
      // factory-wide counts (projects/decisions/testsPassing) from the live cores.
      scalars: {
        frds: portada.scalars.frds,
        commits: portada.scalars.commits,
        projects: liveScalars.projects,
        decisions: liveScalars.decisions,
        testsPassing: liveScalars.testsPassing,
      },
      lessons,
      funnel: portada.funnel,
    };
  }

  // missing / stale / unparseable — per-project facts fall back to live too (REQ-23-001).
  return {
    weeklyFlow: live.weeklyFlow(),
    phaseTransitions,
    scalars: liveScalars,
    lessons,
    funnel: live.funnel(),
  };
}
