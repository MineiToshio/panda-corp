/**
 * lib/achievements/stats.ts — Reader input + character-sheet stat derivation (FRD-10)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions. No I/O.
 *
 * v2 (WO-10-010/011): the event-based counters are RE-ANCHORED to the REAL event vocabulary
 * via the signals layer (`deriveSignals`) — the v1 code read an `achievement`/`task=` event that
 * nothing ever emitted, so those counters were perpetually 0. `speed` (idea→launch days) has no
 * verifiable start timestamp in the current stream, so it stays an honest 0 (null record) until a
 * created-at emitter exists (docs/achievements.md §8 pending-emitter) — never fabricated.
 *
 * Interfaces implemented (blueprint §4):
 *   IF-10-stats — computeStats(readerData): Stat[]
 *
 * Traceability: AC-10-001.1..4.
 */

import type { StatusResult } from "../status/status";
import { CHAIN_DEFINITIONS } from "./definitions";
import type { ReaderData } from "./readerData";
import { deriveSignals } from "./signals";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Input type — re-exported from ./readerData (broken out to avoid the
//      stats ↔ signals import cycle; both modules depend on ReaderData).
// ─────────────────────────────────────────────────────────────────────────────

export type { ReaderData };

// ─────────────────────────────────────────────────────────────────────────────
// § 2. IF-10-stats — Stat (character-sheet counter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single "character-sheet" counter.
 *
 * `key`   — machine-readable id (same as the stat key in docs/achievements.md).
 * `label` — display label (Spanish UI).
 * `value` — computed value (only-grow; 0 for an empty factory).
 * `unlockEvents` — dates + projects where stat milestones were reached.
 */
export type Stat = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unlockEvents: readonly TierUnlockEvent[];
};

/** Date + project where a chain tier was unlocked (AC-10-002.2). */
export type TierUnlockEvent = {
  readonly tier: number;
  readonly date: string;
  readonly project: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// § 3. IF-10-stats — computeStats
// ─────────────────────────────────────────────────────────────────────────────

/** Phases that count as "past product" (used for phasesCompleted counter). */
const ADVANCED_PHASES = new Set(["design", "architecture", "implementation", "release"]);

/** Pipeline phase order → rank (product=0 … release=4). */
const PHASE_RANK: Record<string, number> = {
  product: 0,
  design: 1,
  architecture: 2,
  implementation: 3,
  release: 4,
};

/** Count present projects at or beyond the given phase rank. */
function countAtMinPhase(statuses: readonly StatusResult[], minRank: number): number {
  let n = 0;
  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const ph = sr.status.phase;
    if (typeof ph === "string" && (PHASE_RANK[ph] ?? -1) >= minRank) n += 1;
  }
  return n;
}

/**
 * Derive the character-sheet counters from reader data (IF-10-stats, WO-10-001/010).
 *
 * Pure function: no I/O, no clock, no mutation. Same readerData → same result.
 * Source mappings (blueprint §2 honesty contract, v2 real-signal anchoring):
 *
 * | Stat key   | Source                                                          |
 * |------------|-----------------------------------------------------------------|
 * | shipped    | projects at phase=release (statuses)                            |
 * | ideas      | all idea cards (any status)                                     |
 * | workorders | live portfolio-wide WO "done" total (signals.woClosed, DR-115)  |
 * | phases     | projects advanced past product (statuses)                       |
 * | iterations | build relaunches (signals.relaunches)                           |
 * | flawless   | gates passed with reopen 0 (signals.flawlessGates)              |
 * | discarded  | idea cards with status=discarded                                |
 * | prds       | projects at phase ≥ design (statuses)                            |
 * | adrs       | projects at phase ≥ architecture (statuses)                     |
 * | agents     | distinct roles coordinated (signals.distinctRoles)              |
 * | streak     | longest weekly streak from event timestamps (signals.weeklyStreak) |
 * | speed      | honest 0 — idea→launch has no verifiable start timestamp (§8)    |
 */
export function computeStats(data: ReaderData): Stat[] {
  const { ideas, statuses } = data;
  const sig = deriveSignals(data);

  const shippedProjects = statuses.filter(
    (sr) => sr.present && sr.status !== null && sr.status.phase === "release",
  );
  const shipped = shippedProjects.length;
  const ideasCount = ideas.length;

  let phases = 0;
  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const ph = sr.status.phase;
    if (typeof ph === "string" && ADVANCED_PHASES.has(ph)) phases += 1;
  }

  const discarded = ideas.filter((idea) => idea.status === "discarded").length;
  const shippedUnlocks = _buildShippedUnlocks(shippedProjects);

  return [
    { key: "shipped", label: "Productos lanzados", value: shipped, unlockEvents: shippedUnlocks },
    { key: "ideas", label: "Ideas capturadas", value: ideasCount, unlockEvents: [] },
    { key: "workorders", label: "Work orders completados", value: sig.woClosed, unlockEvents: [] },
    { key: "phases", label: "Fases completadas", value: phases, unlockEvents: [] },
    {
      key: "iterations",
      label: "Iteraciones desplegadas",
      value: sig.relaunches,
      unlockEvents: [],
    },
    {
      key: "flawless",
      label: "Lanzamientos impecables",
      value: sig.flawlessGates,
      unlockEvents: [],
    },
    { key: "discarded", label: "Ideas descartadas", value: discarded, unlockEvents: [] },
    { key: "prds", label: "PRDs escritos", value: countAtMinPhase(statuses, 1), unlockEvents: [] },
    {
      key: "adrs",
      label: "ADRs registrados",
      value: countAtMinPhase(statuses, 2),
      unlockEvents: [],
    },
    { key: "agents", label: "Agentes coordinados", value: sig.distinctRoles, unlockEvents: [] },
    { key: "streak", label: "Racha récord (sem)", value: sig.weeklyStreak, unlockEvents: [] },
    { key: "speed", label: "Récord idea→launch (días)", value: 0, unlockEvents: [] },
    // ── v2 new chains (FRD-10 §6), all from the real signal layer ──────────────
    { key: "builds", label: "Builds completados", value: sig.builds, unlockEvents: [] },
    { key: "subagents", label: "Subagentes coordinados", value: sig.subagents, unlockEvents: [] },
    { key: "gates", label: "Gates verdes", value: sig.gatePasses, unlockEvents: [] },
    { key: "reviews", label: "Reviews aprobadas", value: sig.reviewsApproved, unlockEvents: [] },
    { key: "findings", label: "Hallazgos atendidos", value: sig.findings, unlockEvents: [] },
    { key: "modes", label: "Modos de build usados", value: sig.distinctModes, unlockEvents: [] },
    { key: "activedays", label: "Días activos", value: sig.activeDays, unlockEvents: [] },
  ];
}

/**
 * Build tier unlock events for the "shipped" chain. Each time the cumulative shipped
 * count crosses a chain threshold, record the date+project of the N-th shipped product
 * (sorted ascending by updatedAt as a launch-date proxy).
 */
function _buildShippedUnlocks(shippedProjects: readonly StatusResult[]): TierUnlockEvent[] {
  const sorted = [...shippedProjects].sort((a, b) => {
    const da = (a.present && a.status !== null ? a.status.updatedAt : undefined) ?? "";
    const db = (b.present && b.status !== null ? b.status.updatedAt : undefined) ?? "";
    return da.localeCompare(db);
  });

  const shippedChain = CHAIN_DEFINITIONS.find((c) => c.statKey === "shipped");
  if (!shippedChain) return [];

  const unlocks: TierUnlockEvent[] = [];
  for (let tierIdx = 0; tierIdx < shippedChain.tiers.length; tierIdx++) {
    const tier = shippedChain.tiers[tierIdx];
    if (!tier) continue;
    const crossingProject = sorted[tier.threshold - 1];
    if (!crossingProject) break;
    if (!crossingProject.present || crossingProject.status === null) break;
    const date = crossingProject.status.updatedAt ?? "";
    const project = crossingProject.status.project ?? "";
    if (date && project) unlocks.push({ tier: tierIdx, date, project });
  }
  return unlocks;
}
