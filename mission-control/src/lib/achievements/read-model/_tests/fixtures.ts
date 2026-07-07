/**
 * Test fixtures for the materialized portada read-model (FRD-23, WO-23-001).
 *
 * A builder (defaults + override what the test cares about) for a REAL production-shape
 * `StatsPortada` — the numbers mirror what the live report readers derive (small, plausible).
 * Tests deliberately corrupt individual fields to exercise the fail-loud parser (DR-078).
 */

import type { StatsFactory, StatsPortada } from "../statsSchema";

const DEFAULT_SEAL = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
const DEFAULT_FACTORY_SEAL = "f0e1d2c3b4a5968778695a4b3c2d1e0f00112233";

/**
 * A real-shape, well-typed per-project portada; override any field to build a variant.
 *
 * SSOT split (WO-23-005): the portada holds ONLY per-project facts — `weeklyFlow`, per-project
 * `scalars` (`frds`, `commits`) and `funnel`. Factory-wide facts live in `makeFactoryStore`.
 */
export function makePortada(over: Partial<StatsPortada> = {}): StatsPortada {
  const base: StatsPortada = {
    seal: DEFAULT_SEAL,
    generatedAt: "2026-07-06T12:00:00.000Z",
    weeklyFlow: {
      woVerified: [
        { isoWeek: "2026-26", count: 4 },
        { isoWeek: "2026-27", count: 7 },
      ],
      ideasCaptured: [
        { isoWeek: "2026-26", count: 2 },
        { isoWeek: "2026-27", count: 3 },
      ],
      peakWeek: 7,
      ideasWithoutCreated: 1,
    },
    scalars: { frds: 23, commits: 412 },
    funnel: {
      totalIdeas: 18,
      byStatus: {
        discovered: 6,
        recommended: 0,
        "in-pipeline": 2,
        shipped: 1,
        discarded: 9,
      },
      launched: 1,
      conversionPct: 6,
      wip: 1,
      discardsWithoutReason: 6,
    },
  };
  return { ...base, ...over };
}

/**
 * A real-shape, well-typed factory-scoped store; override any field to build a variant (WO-23-005).
 * Holds the factory-wide facts that left the per-project portada: `phaseTransitions`, factory
 * `scalars` (`projects`, `decisions`) and `lessons`.
 */
export function makeFactoryStore(over: Partial<StatsFactory> = {}): StatsFactory {
  const base: StatsFactory = {
    seal: DEFAULT_FACTORY_SEAL,
    generatedAt: "2026-07-06T12:00:00.000Z",
    phaseTransitions: [
      {
        project: "mission-control",
        date: "2026-07-01",
        from: "architecture",
        to: "implementation",
        isReopen: false,
      },
    ],
    scalars: { projects: 4, decisions: 118 },
    lessons: { distilled: 92, captured: 40 },
  };
  return { ...base, ...over };
}

/** The seal the default portada fixture carries (so seal tests can match/mismatch deterministically). */
export const FIXTURE_SEAL = DEFAULT_SEAL;

/** The seal the default factory-store fixture carries. */
export const FIXTURE_FACTORY_SEAL = DEFAULT_FACTORY_SEAL;
