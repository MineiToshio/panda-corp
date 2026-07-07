/**
 * lib/achievements/read-model/informeResolver.ts — the composed Informe reader (FRD-23, WO-23-003 → WO-23-006).
 *
 * Platform golden rule (architecture §1): read-only. Composes the Informe's sources from TWO stores,
 * each with an INDEPENDENT fail-loud fallback to the live `derive*` cores (DR-078, REQ-23-007):
 *
 *   - PER-PROJECT facts (`weeklyFlow`, per-project `scalars.{frds,commits}`, `funnel`) come from the
 *     portada (validated by the PER-PROJECT seal) when it is fresh, and fall back to the live git
 *     readers on ANY non-`ok` `PortadaResult` — `missing`, `stale`, `unparseable` (REQ-23-001).
 *   - FACTORY-WIDE facts (`phaseTransitions`, `scalars.{projects,decisions}`, `lessons`) come from the
 *     factory store (validated by the FACTORY seal) when it is fresh, and fall back to the live cores
 *     on ANY non-`ok` `FactoryResult` (REQ-23-006/007).
 *
 * The two fallbacks are INDEPENDENT (AC-23-007.2): a factory-store miss re-derives ONLY the
 * factory-wide facts, leaving valid per-project facts untouched, and vice-versa. This fixes the
 * cross-project staleness bug (AC-23-007.3): a phase change in project B mismatches the factory seal →
 * `readStatsFactory` returns non-`ok` → project A re-derives the factory-wide facts live rather than
 * serving B's stale embedded copy. Because factory-wide facts live in their OWN seal-validated store
 * (SSOT split, WO-23-005), A's fresh per-project portada can NO LONGER carry a stale copy of them.
 *
 * `getPendingMerge` (FRD-21) is untouched (AC-23-005.1). The render shape (`InformeSources`, FRD-10) is
 * unchanged — the split is invisible to the render; only the SOURCE of the numbers moves.
 *
 * Honesty (DR-078): a fallback calls the REAL live reader and returns whatever it produces verbatim —
 * including that reader's OWN fail-loud result (e.g. `git-unavailable`) — never a fabricated zero
 * synthesized here. The live readers are passed in as thunks so a fresh store genuinely skips the git
 * shell-out for the facts it supplies (AC-23-001.1). `testsPassing` is not held in either store — it is
 * always composed from the live scalars (never fabricated).
 *
 * BACK-COMPAT: `factoryResult` is optional. When omitted (the pre-WO-23-006 call site + the blessed
 * WO-23-001..004 reviewer chain, DR-080) the factory-wide facts come from the live cores ALWAYS — the
 * exact "factory-wide always live" behavior WO-23-005 shipped, so the split reviewer test is unchanged.
 */

import type {
  FunnelFlow,
  LessonCounts,
  PhaseTransition,
  ReportResult,
  ReportScalars,
  WeeklyFlow,
} from "../report/types";
import type { FactoryResult } from "./factoryStoreReader";
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

/** The factory-wide facts the resolver composes into the render's scalars, from ONE independent source. */
type FactoryWideFacts = {
  readonly phaseTransitions: ReportResult<PhaseTransition[]>;
  readonly projects: number;
  readonly decisions: number;
  readonly lessons: LessonCounts | null;
};

/**
 * Resolve the factory-wide facts from the factory store, falling back to the live cores on any
 * non-`ok` `FactoryResult` — INDEPENDENTLY of the per-project portada (AC-23-007.2). When
 * `factoryResult` is omitted (back-compat), the factory-wide facts come from live ALWAYS.
 *
 * The store holds `phaseTransitions` as a bare array (already-derived), so a fresh store wraps it as
 * `{ ok: true, value }` (the render's `ReportResult`); `testsPassing` is never held in the store and
 * is composed from the live scalars by the caller. Never a fabricated zero (DR-078).
 */
function resolveFactoryWide(
  live: LiveInformeReaders,
  factoryResult: FactoryResult | undefined,
): FactoryWideFacts {
  if (factoryResult?.ok) {
    const store = factoryResult.value;
    return {
      phaseTransitions: { ok: true, value: [...store.phaseTransitions] },
      projects: store.scalars.projects,
      decisions: store.scalars.decisions,
      lessons: store.lessons,
    };
  }
  // Missing / stale / unparseable / omitted → factory-wide facts fall back to the live cores.
  const liveScalars = live.scalars();
  return {
    phaseTransitions: live.phaseTransitions(),
    projects: liveScalars.projects,
    decisions: liveScalars.decisions,
    lessons: live.lessons(),
  };
}

/**
 * Compose the Informe's sources from the per-project portada + the factory-wide store, each with an
 * INDEPENDENT fail-loud fallback to the live `derive*` cores (REQ-23-007).
 *
 * PER-PROJECT facts (`weeklyFlow`, per-project `scalars.{frds,commits}`, `funnel`) come from the
 * portada when it is fresh (AC-23-001.1) and fall back to live on any non-`ok` `PortadaResult`
 * (AC-23-001.2..4). FACTORY-WIDE facts (`phaseTransitions`, `scalars.{projects,decisions}`,
 * `lessons`) come from the factory store when fresh and fall back to live on any non-`ok`
 * `FactoryResult` (AC-23-007.1/.2). The two fallbacks never collapse into one and never fabricate a
 * zero (DR-078). `testsPassing` is always composed from the live scalars (not held in either store).
 *
 * The independence fixes the cross-project staleness bug (AC-23-007.3): B's phase change mismatches
 * the factory seal → `factoryResult` is non-`ok` → A re-derives the factory-wide facts live, while
 * A's own fresh portada keeps supplying A's per-project facts untouched.
 *
 * @param portadaResult - The result of `readStatsPortada(projectPath)` (WO-23-001).
 * @param live - Lazy live-reader accessors (WO-10-014), invoked only for the scope that falls back.
 * @param factoryResult - The result of `readStatsFactory(factoryRoot)` (WO-23-005); omitted → factory-wide always live.
 * @returns The Informe sources composed from the portada (per-project) + factory store (factory-wide).
 */
export function resolveInformeSources(
  portadaResult: PortadaResult,
  live: LiveInformeReaders,
  factoryResult?: FactoryResult,
): InformeSources {
  const factory = resolveFactoryWide(live, factoryResult);

  if (portadaResult.ok) {
    const portada = portadaResult.value;
    return {
      weeklyFlow: { ok: true, value: portada.weeklyFlow },
      phaseTransitions: factory.phaseTransitions,
      // Compose the render's full `ReportScalars`: per-project counts from the portada +
      // factory-wide counts (projects/decisions) from the factory store/live; testsPassing live.
      scalars: {
        frds: portada.scalars.frds,
        commits: portada.scalars.commits,
        projects: factory.projects,
        decisions: factory.decisions,
        testsPassing: live.scalars().testsPassing,
      },
      lessons: factory.lessons,
      funnel: portada.funnel,
    };
  }

  // missing / stale / unparseable portada — per-project facts fall back to live (REQ-23-001);
  // factory-wide facts stay independently sourced above (a portada miss never touches them).
  const liveScalars = live.scalars();
  return {
    weeklyFlow: live.weeklyFlow(),
    phaseTransitions: factory.phaseTransitions,
    scalars: {
      frds: liveScalars.frds,
      commits: liveScalars.commits,
      projects: factory.projects,
      decisions: factory.decisions,
      testsPassing: liveScalars.testsPassing,
    },
    lessons: factory.lessons,
    funnel: live.funnel(),
  };
}
