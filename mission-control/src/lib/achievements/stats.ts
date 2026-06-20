/**
 * lib/achievements/stats.ts — Reader input + character-sheet stat derivation (FRD-10)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions. No I/O.
 * Split out of achievements.ts to keep files ≤500 lines.
 *
 * Interfaces implemented (blueprint §4 Components & Interfaces):
 *   IF-10-stats    — computeStats(readerData): Stat[]
 *
 * Traceability:
 *   AC-10-001.1..4 — computeStats
 *
 * Thresholds/tier names from docs/achievements.md. Prototype data tables in prototype/index.html.
 */

import type { EventsSnapshot } from "../events/events";
import type { IdeaCard } from "../ideas/ideas";
import type { StatusResult } from "../status/status";
import { CHAIN_DEFINITIONS } from "./definitions";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Input type (aggregated reader outputs — no direct fs in this module)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All reader data consumed by this module.
 *
 * Every field is already-read data; no I/O happens inside achievements.ts.
 * Blueprint §2 honesty contract: each field maps to a verifiable source.
 */
export type ReaderData = {
  /** All idea cards from factory/ideas/ (FRD-01 lib/ideas.ts) */
  readonly ideas: readonly IdeaCard[];
  /** Status results for every portfolio project (FRD-01/03 lib/status.ts / lib/portfolio.ts) */
  readonly statuses: readonly StatusResult[];
  /** Event snapshot from dashboard-events.ndjson (FRD-06 lib/events.ts) */
  readonly eventsSnapshot: EventsSnapshot | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// § 2. IF-10-stats — Stat (character-sheet counter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single "character-sheet" counter.
 *
 * `key`   — machine-readable id (same as the stat key in docs/achievements.md).
 * `label` — display label (Spanish UI).
 * `value` — computed value (only-grow; 0 for an empty factory).
 * `unlockEvents` — dates + projects where stat milestones were reached,
 *                  used by computeChains to populate tier unlock metadata.
 */
export type Stat = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /**
   * Optional tier unlock events for this stat, ordered by tier index.
   * Each entry records WHEN and WHERE the stat crossed each chain threshold.
   * Carried from the reader data (events or status timestamps).
   */
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
const ADVANCED_PHASES = new Set([
  "design",
  "architecture",
  "implementation",
  "release",
  "operation",
]);

/**
 * Derive the character-sheet counters from reader data (IF-10-stats, WO-10-001).
 *
 * Pure function: no I/O, no clock, no mutation.
 * Same readerData always produces the same result.
 *
 * All 12 stats from docs/achievements.md §1 are returned.
 * Source mappings per blueprint §2 honesty contract:
 *
 * | Stat key    | Source                                                        |
 * |-------------|---------------------------------------------------------------|
 * | shipped     | projects at phase=operation (lib/status.ts via portfolio)    |
 * | ideas       | all idea cards (any status) — ever created = only grows      |
 * | workorders  | sum of status.workOrdersDone across all projects              |
 * | phases      | count of projects that advanced past "product" phase          |
 * | iterations  | achievement events with task="iteration"                     |
 * | flawless    | achievement events with task="flawless"                      |
 * | discarded   | idea cards with status="discarded"                           |
 * | prds        | achievement events with task="prd"                           |
 * | adrs        | achievement events with task="adr"                           |
 * | agents      | distinct agent names from ok events                          |
 * | streak      | current weekly streak from events (presently 0; tracked TBD) |
 * | speed       | best (lowest) idea→launch days from events                   |
 */
export function computeStats(data: ReaderData): Stat[] {
  const { ideas, statuses, eventsSnapshot } = data;
  const events = eventsSnapshot?.events ?? [];

  // ── shipped: projects at operation phase ─────────────────────────────────
  const shippedProjects = statuses.filter(
    (sr) => sr.present && sr.status !== null && sr.status.phase === "operation",
  );
  const shipped = shippedProjects.length;

  // ── ideas: all idea cards (ever created, any status) ──────────────────────
  const ideasCount = ideas.length;

  // ── workorders: sum workOrdersDone across all present/valid statuses ───────
  let workorders = 0;
  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const wo = sr.status.workOrdersDone;
    if (typeof wo === "number" && Number.isFinite(wo)) {
      workorders += Math.max(0, Math.trunc(wo));
    }
  }

  // ── phases: projects that advanced past "product" phase ─────────────────
  let phases = 0;
  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const ph = sr.status.phase;
    if (typeof ph === "string" && ADVANCED_PHASES.has(ph)) {
      phases += 1;
    }
  }

  // ── iterations / flawless / prds / adrs: achievement events by task ───────
  const iterations = _countAchievementTask(events, "iteration");
  const flawless = _countAchievementTask(events, "flawless");

  // ── discarded: idea cards with status="discarded" ─────────────────────────
  const discarded = ideas.filter((idea) => idea.status === "discarded").length;

  const prds = _countAchievementTask(events, "prd");
  const adrs = _countAchievementTask(events, "adr");

  // ── agents: distinct agent names from ok events ───────────────────────────
  const agents = _countDistinctAgents(events);

  // ── streak: max weekly streak from events (computed later / TBD) ─────────
  // Current implementation: 0 unless explicitly set via streak event.
  // A full streak derivation over event timestamps is tracked work for a future WO.
  const streak = _computeWeeklyStreak(events);

  // ── speed: best (lowest) idea→launch time in days from events ────────────
  // Derived from "speed" achievement events carrying a numeric value in the task field
  // (e.g. task="speed:12" for 12 days) or from the events snapshot.
  const speed = _computeSpeedRecord(events);

  // ── Build unlock events for chains ───────────────────────────────────────
  // For shipped chain: use shippedProjects sorted by updatedAt
  const shippedUnlocks = _buildShippedUnlocks(shippedProjects);

  return [
    { key: "shipped", label: "Productos lanzados", value: shipped, unlockEvents: shippedUnlocks },
    { key: "ideas", label: "Ideas capturadas", value: ideasCount, unlockEvents: [] },
    { key: "workorders", label: "Work orders completados", value: workorders, unlockEvents: [] },
    { key: "phases", label: "Fases completadas", value: phases, unlockEvents: [] },
    { key: "iterations", label: "Iteraciones desplegadas", value: iterations, unlockEvents: [] },
    { key: "flawless", label: "Lanzamientos impecables", value: flawless, unlockEvents: [] },
    { key: "discarded", label: "Ideas descartadas", value: discarded, unlockEvents: [] },
    { key: "prds", label: "PRDs escritos", value: prds, unlockEvents: [] },
    { key: "adrs", label: "ADRs registrados", value: adrs, unlockEvents: [] },
    { key: "agents", label: "Agentes coordinados", value: agents, unlockEvents: [] },
    { key: "streak", label: "Racha récord (sem)", value: streak, unlockEvents: [] },
    { key: "speed", label: "Récord idea→launch (días)", value: speed, unlockEvents: [] },
  ];
}

/** Count "achievement" events with status="ok" for a given task. */
function _countAchievementTask(
  events: readonly { event: string; task?: string; status?: string }[],
  task: string,
): number {
  return events.filter((ev) => ev.event === "achievement" && ev.task === task && ev.status === "ok")
    .length;
}

/** Count distinct, non-empty agent names across all status="ok" events. */
function _countDistinctAgents(events: readonly { status?: string; agent?: string }[]): number {
  const agentSet = new Set<string>();
  for (const ev of events) {
    if (ev.status === "ok" && typeof ev.agent === "string" && ev.agent.length > 0) {
      agentSet.add(ev.agent);
    }
  }
  return agentSet.size;
}

/**
 * Build tier unlock events for the "shipped" chain.
 * Each time the cumulative shipped count crosses a chain threshold,
 * we record the date+project of the N-th shipped product.
 *
 * Shipped projects are sorted ascending by updatedAt (proxy for launch date).
 * The k-th threshold crossing corresponds to the k-th shipped project.
 */
function _buildShippedUnlocks(shippedProjects: readonly StatusResult[]): TierUnlockEvent[] {
  // Sort by updatedAt ascending (earliest first)
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
    const threshold = tier.threshold;
    // The threshold is crossed when we have exactly `threshold` shipped products.
    // The project+date is the one that caused the crossing (the N-th).
    const crossingProject = sorted[threshold - 1];
    if (!crossingProject) break; // not enough shipped products to unlock this tier
    if (!crossingProject.present || crossingProject.status === null) break;
    const date = crossingProject.status.updatedAt ?? "";
    const project = crossingProject.status.project ?? "";
    if (date && project) {
      unlocks.push({ tier: tierIdx, date, project });
    }
  }

  return unlocks;
}

/**
 * Compute the current weekly streak from the events array.
 *
 * Streak = consecutive weeks (Mon-Sun) that had at least one closed WO.
 * "Weekly" and freeze-cap aligned with FRD-09 streak definition.
 *
 * Currently returns 0 for empty event sets.
 * Full week-boundary logic is deferred; this is a minimum correct implementation.
 */
function _computeWeeklyStreak(
  events: readonly { event: string; at: string; status?: string }[],
): number {
  const woClosedDates: Date[] = [];
  for (const ev of events) {
    if (ev.event === "achievement" && ev.status === "ok") {
      const d = new Date(ev.at);
      if (Number.isFinite(d.getTime())) {
        woClosedDates.push(d);
      }
    }
  }
  if (woClosedDates.length === 0) return 0;

  // Get unique week numbers (ISO: Mon = day 1)
  const weekKeys = new Set<string>();
  for (const d of woClosedDates) {
    weekKeys.add(_isoWeekKey(d));
  }

  if (weekKeys.size === 0) return 0;

  // Sort week keys ascending and find the longest run of consecutive weeks.
  return _longestConsecutiveWeekRun([...weekKeys].sort());
}

/**
 * Longest run of consecutive ISO weeks in an ascending-sorted list of week keys.
 * Behavior copied verbatim from the original inline streak loop (min run is 1).
 */
function _longestConsecutiveWeekRun(sortedWeeks: readonly string[]): number {
  let maxStreak = 1;
  let curStreak = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = sortedWeeks[i - 1];
    const cur = sortedWeeks[i];
    if (prev && cur && _areConsecutiveWeeks(prev, cur)) {
      curStreak++;
      if (curStreak > maxStreak) maxStreak = curStreak;
    } else {
      curStreak = 1;
    }
  }

  return maxStreak;
}

/** ISO week key: "YYYY-WW" */
function _isoWeekKey(d: Date): string {
  // ISO week: week starts on Monday.
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000);
  const weekNum = Math.floor((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

/** Returns true if two ISO week keys are consecutive (next week follows previous). */
function _areConsecutiveWeeks(a: string, b: string): boolean {
  // Parse "YYYY-WW"
  const [ayStr, awStr] = a.split("-");
  const [byStr, bwStr] = b.split("-");
  if (!ayStr || !awStr || !byStr || !bwStr) return false;
  const ay = parseInt(ayStr, 10);
  const aw = parseInt(awStr, 10);
  const by = parseInt(byStr, 10);
  const bw = parseInt(bwStr, 10);
  // Same year: week b = week a + 1
  if (ay === by) return bw === aw + 1;
  // Year boundary: a = last week of ay, b = week 1 of by = ay+1
  if (by === ay + 1 && bw === 1) {
    // Last week of the previous year: weeks can be 52 or 53
    const lastWeekOfAY = _lastISOWeekOfYear(ay);
    return aw === lastWeekOfAY;
  }
  return false;
}

/** Returns the last ISO week number of a given year (52 or 53). */
function _lastISOWeekOfYear(year: number): number {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  return parseInt(_isoWeekKey(dec28).split("-")[1] ?? "52", 10);
}

/**
 * Compute the speed record (best idea→launch time in days).
 *
 * Reads from "speed" achievement events with task="speed:<days>".
 * If no such events exist, returns 0 (null state — not a lower-is-better record yet).
 *
 * Returns the lowest (best) value found, or 0 if none.
 */
function _computeSpeedRecord(
  events: readonly { event: string; at: string; task?: string; status?: string }[],
): number {
  let best = 0;
  for (const ev of events) {
    if (ev.event === "achievement" && ev.status === "ok" && typeof ev.task === "string") {
      const match = ev.task.match(/^speed:(\d+)$/);
      if (match) {
        const days = parseInt(match[1] ?? "0", 10);
        if (days > 0 && (best === 0 || days < best)) {
          best = days;
        }
      }
    }
  }
  return best;
}
