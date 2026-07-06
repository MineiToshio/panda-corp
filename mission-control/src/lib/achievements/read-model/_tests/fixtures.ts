/**
 * Test fixtures for the materialized portada read-model (FRD-23, WO-23-001).
 *
 * A builder (defaults + override what the test cares about) for a REAL production-shape
 * `StatsPortada` — the numbers mirror what the live report readers derive (small, plausible).
 * Tests deliberately corrupt individual fields to exercise the fail-loud parser (DR-078).
 */

import type { StatsPortada } from "../statsSchema";

const DEFAULT_SEAL = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

/** A real-shape, well-typed portada; override any field to build a variant. */
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
    phaseTransitions: [
      {
        project: "mission-control",
        date: "2026-07-01",
        from: "architecture",
        to: "implementation",
        isReopen: false,
      },
    ],
    scalars: { frds: 23, commits: 412, decisions: 118, projects: 4, testsPassing: 631 },
    lessons: { distilled: 92, captured: 40 },
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

/** The seal the default fixture carries (so seal tests can match/mismatch deterministically). */
export const FIXTURE_SEAL = DEFAULT_SEAL;
