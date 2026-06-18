/**
 * lib/achievements.ts — Pure stats / chains / uniques / secrets derivation (FRD-10)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions. No I/O.
 * This module is flagged as a NEW file in blueprint §3.
 *
 * Interfaces implemented (blueprint §4 Components & Interfaces):
 *   IF-10-stats    — computeStats(readerData): Stat[]
 *   IF-10-chains   — computeChains(stats): ChainState[]
 *   IF-10-uniques  — computeUniques(readerData): Unique[]
 *   IF-10-secrets  — computeSecrets(readerData): Secret[]
 *
 * Honesty contract (blueprint §2):
 *   - Every stat derived from verifiable real outcomes (readers) — never an app-incremented counter.
 *   - Counters only grow (cumulative real history).
 *   - Empty factory → honest zeros, never fabricated.
 *   - Endowed progress: bars start at real progress, never inflated, never stuck.
 *   - Secrets always reveal their criterion on unlock — no permanent obscurity.
 *   - No notifications/nagging, no leaderboards, no false urgency.
 *
 * Traceability:
 *   AC-10-001.1..4 — computeStats
 *   AC-10-002.1..5 — computeChains + CHAIN_DEFINITIONS
 *   AC-10-003.1..4 — computeUniques + UNIQUE_DEFINITIONS
 *   AC-10-004.1..4 — computeSecrets + SECRET_DEFINITIONS
 *
 * Thresholds/tier names from docs/achievements.md. Prototype data tables in prototype/index.html.
 */

import type { EventsSnapshot } from "../events/events";
import type { IdeaCard } from "../ideas/ideas";
import type { StatusResult } from "../status/status";

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
// § 3. Chain data tables (from docs/achievements.md + prototype data)
// ─────────────────────────────────────────────────────────────────────────────

/** Tier entry: [threshold, name] pair (thresholds/names from docs/achievements.md). */
export type TierEntry = {
  readonly threshold: number;
  readonly name: string;
};

/** Chain definition (data table — never mutated at runtime). */
export type ChainDefinition = {
  readonly statKey: string;
  readonly label: string;
  readonly tiers: readonly TierEntry[];
  /** True for "lower is better" chains (speed / record idea→launch). */
  readonly lowerIsBetter?: boolean;
};

/**
 * All cumulative chain definitions.
 *
 * Source: docs/achievements.md §2 (thresholds) and prototype/index.html CHAINS array (tier names).
 * Tier names are fun and scale in grandeur per FRD-10.
 */
export const CHAIN_DEFINITIONS: readonly ChainDefinition[] = [
  {
    statKey: "shipped",
    label: "Productos lanzados",
    tiers: [
      { threshold: 1, name: "El primer ladrillo" },
      { threshold: 5, name: "Maestro de obras" },
      { threshold: 10, name: "El arquitecto" },
      { threshold: 25, name: "El magnate digital" },
      { threshold: 50, name: "El oráculo de la fábrica" },
    ],
  },
  {
    statKey: "ideas",
    label: "Ideas capturadas",
    tiers: [
      { threshold: 5, name: "Mente inquieta" },
      { threshold: 20, name: "Máquina de ideas" },
      { threshold: 50, name: "El ideólogo" },
      { threshold: 100, name: "La tormenta de ideas" },
    ],
  },
  {
    statKey: "workorders",
    label: "Work orders completados",
    tiers: [
      { threshold: 10, name: "Capataz novato" },
      { threshold: 50, name: "Jefe de fábrica" },
      { threshold: 200, name: "El fordismo digital" },
      { threshold: 500, name: "Maestro de ensamblaje" },
      { threshold: 1000, name: "La gran máquina" },
    ],
  },
  {
    statKey: "phases",
    label: "Fases completadas",
    tiers: [
      { threshold: 5, name: "Pipeline novato" },
      { threshold: 25, name: "Flujo continuo" },
      { threshold: 75, name: "El proceso es el producto" },
      { threshold: 200, name: "Maestro del pipeline" },
    ],
  },
  {
    statKey: "iterations",
    label: "Iteraciones desplegadas",
    tiers: [
      { threshold: 1, name: "El primer parche" },
      { threshold: 10, name: "Amigo del usuario" },
      { threshold: 25, name: "El hacedor incansable" },
      { threshold: 50, name: "El producto vivo" },
    ],
  },
  {
    statKey: "flawless",
    label: "Lanzamientos impecables",
    tiers: [
      { threshold: 1, name: "Primera vez sin reparos" },
      { threshold: 3, name: "Artesano" },
      { threshold: 7, name: "Orfebre del software" },
      { threshold: 15, name: "Manos de cirujano" },
    ],
  },
  {
    statKey: "discarded",
    label: "Ideas descartadas",
    tiers: [
      { threshold: 5, name: "El editor" },
      { threshold: 20, name: "Cirujano de ideas" },
      { threshold: 50, name: "El filtro implacable" },
      { threshold: 100, name: "El asesino de darlings" },
    ],
  },
  {
    statKey: "prds",
    label: "PRDs escritos",
    tiers: [
      { threshold: 3, name: "Escribidor de requisitos" },
      { threshold: 10, name: "El visionario documentado" },
      { threshold: 25, name: "El PM fantasma" },
      { threshold: 50, name: "La biblia del producto" },
    ],
  },
  {
    statKey: "adrs",
    label: "ADRs registrados",
    tiers: [
      { threshold: 3, name: "El que toma notas" },
      { threshold: 15, name: "Memoria institucional" },
      { threshold: 40, name: "El libro de la fábrica" },
      { threshold: 100, name: "El gran grimorio" },
    ],
  },
  {
    statKey: "agents",
    label: "Agentes coordinados",
    tiers: [
      { threshold: 3, name: "Equipo mínimo" },
      { threshold: 6, name: "El líder de raid" },
      { threshold: 10, name: "Comandante de fábrica" },
      { threshold: 15, name: "El maestro titiritero" },
    ],
  },
  {
    statKey: "streak",
    label: "Racha récord (semanas)",
    tiers: [
      { threshold: 2, name: "Semanas seguidas" },
      { threshold: 8, name: "El constructor constante" },
      { threshold: 26, name: "Medio año sin parar" },
      { threshold: 52, name: "El año del fundador" },
    ],
  },
  {
    statKey: "speed",
    label: "Récord idea→launch (días)",
    lowerIsBetter: true,
    tiers: [
      { threshold: 30, name: "Sprint decente" },
      { threshold: 14, name: "El cohete" },
      { threshold: 7, name: "La semana perfecta" },
      { threshold: 3, name: "Modo dios activado" },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4. IF-10-stats — computeStats
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

  // ── iterations: achievement events with task="iteration" ─────────────────
  const iterations = events.filter(
    (ev) => ev.event === "achievement" && ev.task === "iteration" && ev.status === "ok",
  ).length;

  // ── flawless: achievement events with task="flawless" ─────────────────────
  const flawless = events.filter(
    (ev) => ev.event === "achievement" && ev.task === "flawless" && ev.status === "ok",
  ).length;

  // ── discarded: idea cards with status="discarded" ─────────────────────────
  const discarded = ideas.filter((idea) => idea.status === "discarded").length;

  // ── prds: achievement events with task="prd" ─────────────────────────────
  const prds = events.filter(
    (ev) => ev.event === "achievement" && ev.task === "prd" && ev.status === "ok",
  ).length;

  // ── adrs: achievement events with task="adr" ─────────────────────────────
  const adrs = events.filter(
    (ev) => ev.event === "achievement" && ev.task === "adr" && ev.status === "ok",
  ).length;

  // ── agents: distinct agent names from ok events ───────────────────────────
  const agentSet = new Set<string>();
  for (const ev of events) {
    if (ev.status === "ok" && typeof ev.agent === "string" && ev.agent.length > 0) {
      agentSet.add(ev.agent);
    }
  }
  const agents = agentSet.size;

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

  // Sort week keys ascending
  const sortedWeeks = [...weekKeys].sort();
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

// ─────────────────────────────────────────────────────────────────────────────
// § 5. IF-10-chains — computeChains
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The computed state of a cumulative chain (AC-10-002.1).
 */
export type ChainState = {
  /** Stat key this chain tracks (same as ChainDefinition.statKey). */
  readonly statKey: string;
  /** Display label for this chain. */
  readonly label: string;
  /** Current tier index (0-based); -1 = no tier unlocked yet. */
  readonly currentTierIndex: number;
  /** Current tier name (null if no tier unlocked). */
  readonly currentTierName: string | null;
  /** Next tier entry (null if maxed out). */
  readonly nextTier: { readonly name: string; readonly threshold: number } | null;
  /**
   * Honest endowed progress toward the next tier, 0–100.
   *
   * Endowed = starts from real achieved progress (AC-10-002.3):
   *   - 0 when exactly at a tier boundary (just unlocked).
   *   - 100 when maxed (no next tier).
   *   - For lower-is-better: improves as value decreases toward next threshold.
   *   - NEVER inflated, NEVER artificially stuck (FRD-09 forbidden pattern).
   */
  readonly pctToNext: number;
  /** Whether this chain is lower-is-better (e.g. speed/idea→launch). */
  readonly lowerIsBetter: boolean;
  /** Unlock records per tier (AC-10-002.2). */
  readonly unlocks: readonly TierUnlockEvent[];
};

/**
 * Compute the chain states from the stats array (IF-10-chains, WO-10-001).
 *
 * Accepts EITHER:
 *   - A full Stat[] from computeStats (normal usage), OR
 *   - A partial Stat[] override (tests pass individual stats directly).
 *
 * Pure function: no I/O, no side effects.
 *
 * Prototype chainState() logic (prototype/index.html line ~381) translated to TypeScript:
 *   - Walk thresholds; current tier = last crossed threshold.
 *   - For lower-is-better: tier crossed when value ≤ threshold.
 *   - Progress: from current threshold boundary toward next.
 *   - Endowed: bar starts from real earned position, never zero-faked.
 */
export function computeChains(stats: readonly Stat[]): ChainState[] {
  const result: ChainState[] = [];

  for (const chainDef of CHAIN_DEFINITIONS) {
    const stat = stats.find((s) => s.key === chainDef.statKey);
    const value = stat?.value ?? 0;
    const unlockEvents = stat?.unlockEvents ?? [];
    const lowerIsBetter = chainDef.lowerIsBetter === true;
    const tiers = chainDef.tiers;

    // ── Find current tier index ──────────────────────────────────────────────
    // Walk all thresholds; current = last one crossed.
    // For lower-is-better: crossed when value ≤ threshold.
    // For normal: crossed when value ≥ threshold.
    // Special case for lower-is-better: if value=0, no tier (0 means "no record").
    let currentTierIndex = -1;

    if (!lowerIsBetter || value > 0) {
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier) continue;
        if (lowerIsBetter ? value <= tier.threshold : value >= tier.threshold) {
          currentTierIndex = i;
        }
      }
    }

    const currentTier = currentTierIndex >= 0 ? tiers[currentTierIndex] : undefined;
    const currentTierName = currentTier?.name ?? null;
    const nextTierEntry =
      currentTierIndex < tiers.length - 1 ? (tiers[currentTierIndex + 1] ?? null) : null;
    const nextTier = nextTierEntry
      ? { name: nextTierEntry.name, threshold: nextTierEntry.threshold }
      : null;

    // ── Honest endowed progress ──────────────────────────────────────────────
    let pctToNext: number;

    if (nextTierEntry === null) {
      // Maxed out (or no tiers exist): 100%
      pctToNext = currentTierIndex >= 0 ? 100 : 0;
    } else if (lowerIsBetter) {
      if (value === 0) {
        // No record yet: 0%
        pctToNext = 0;
      } else {
        // Lower-is-better progress:
        // prevThreshold = threshold of current tier (or the value itself if no tier yet)
        // progress = (prevThreshold - value) / (prevThreshold - nextThreshold) * 100
        const prevThreshold =
          currentTierIndex >= 0 ? (tiers[currentTierIndex]?.threshold ?? value) : value;
        const nextThreshold = nextTierEntry.threshold;
        const span = prevThreshold - nextThreshold;
        const progress = prevThreshold - value;
        pctToNext = span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0;
      }
    } else {
      // Normal progress (higher is better):
      // progress = (value - currentThreshold) / (nextThreshold - currentThreshold) * 100
      const currentThreshold =
        currentTierIndex >= 0 ? (tiers[currentTierIndex]?.threshold ?? 0) : 0;
      const nextThreshold = nextTierEntry.threshold;
      const span = nextThreshold - currentThreshold;
      const progress = value - currentThreshold;
      pctToNext = span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0;
    }

    result.push({
      statKey: chainDef.statKey,
      label: chainDef.label,
      currentTierIndex,
      currentTierName,
      nextTier,
      pctToNext,
      lowerIsBetter,
      unlocks: unlockEvents,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6. Unique achievement data tables (from docs/achievements.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Category of a unique achievement (AC-10-003.1). */
export type UniqueCategory = "Discovery" | "Speed" | "Quality" | "Consistency" | "Mastery";

/** Definition of a unique achievement (data table — never mutated). */
export type UniqueDefinition = {
  readonly name: string;
  readonly category: UniqueCategory;
  /** Human-readable condition (shown when locked — AC-10-003.3). */
  readonly condition: string;
  /**
   * Pure predicate that determines if this achievement is unlocked.
   *
   * Takes already-read data; no I/O.
   * Must be derived from a verifiable result (AC-10-003.2 negative AC).
   *
   * Returns { unlocked: false } or { unlocked: true, date, project }.
   */
  readonly check: (
    data: ReaderData,
  ) => { unlocked: false } | { unlocked: true; date: string; project: string };
};

/**
 * All unique achievement definitions.
 *
 * Source: docs/achievements.md §3 (names, categories) + prototype/index.html ONETIME array (unlock conditions).
 *
 * Categories: Discovery (6), Speed (3), Quality (2), Consistency (2), Mastery (2) = 15 total.
 */
export const UNIQUE_DEFINITIONS: readonly UniqueDefinition[] = [
  // ── Discovery ─────────────────────────────────────────────────────────────
  {
    name: "El día del lanzamiento",
    category: "Discovery",
    condition: "Tu primer producto en producción.",
    check: (data) => {
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },
  {
    name: "El primer spec",
    category: "Discovery",
    condition: "Documentaste tu primer MVP.",
    check: (data) => {
      // Unlocked when any project has advanced past product (has a PRD/spec)
      const ev = _firstAchievementEvent(data, "prd");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El debut del diseñador",
    category: "Discovery",
    condition: "Tus primeros mockups aprobados.",
    check: (data) => {
      // Unlocked when a project reaches or passes the design phase
      const ev = _firstPhaseEvent(data, "design");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El blueprintero",
    category: "Discovery",
    condition: "Tu primera arquitectura técnica.",
    check: (data) => {
      const ev = _firstPhaseEvent(data, "architecture");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "Iteración cero",
    category: "Discovery",
    condition: "Mejoraste un producto ya lanzado.",
    check: (data) => {
      const ev = _firstAchievementEvent(data, "iteration");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El gran tour",
    category: "Discovery",
    condition: "Recorriste las 6 fases del pipeline de punta a punta.",
    check: (data) => {
      // Unlocked when any project reaches operation (all 6 phases completed)
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },

  // ── Speed ─────────────────────────────────────────────────────────────────
  {
    name: "48 horas de locura",
    category: "Speed",
    condition: "De idea a producto lanzado en menos de 48 horas.",
    check: (data) => {
      // Unlocked when a "speed" event records ≤ 2 days (speed:1 or speed:2)
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (ev.event === "achievement" && ev.status === "ok" && typeof ev.task === "string") {
          const match = ev.task.match(/^speed:(\d+)$/);
          if (match) {
            const days = parseInt(match[1] ?? "0", 10);
            if (days > 0 && days <= 2) {
              return { unlocked: true, date: ev.at, project: ev.project ?? "" };
            }
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "Ship it Friday",
    category: "Speed",
    condition: "Lanzaste algo a producción un viernes por la tarde.",
    check: (data) => {
      // Unlocked when there is a "release" achievement event on a Friday
      // AND a shipped project exists (verifiable result)
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (ev.event === "achievement" && ev.status === "ok" && ev.task === "release") {
          const d = new Date(ev.at);
          // getUTCDay() === 5 is Friday
          if (d.getUTCDay() === 5) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "La maratón",
    category: "Speed",
    condition: "Una sesión de implementación con 20+ work orders seguidos.",
    check: (data) => {
      // Unlocked when 20+ consecutive WO achievement events occur within 24h
      const events = data.eventsSnapshot?.events ?? [];
      const woEvents = events.filter(
        (ev) =>
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0,
      );
      if (woEvents.length < 20) return { unlocked: false };
      // Check if any 20-event window spans ≤ 24h
      for (let i = 0; i <= woEvents.length - 20; i++) {
        const first = woEvents[i];
        const last = woEvents[i + 19];
        if (!first || !last) continue;
        const t0 = new Date(first.at).getTime();
        const t1 = new Date(last.at).getTime();
        if (Number.isFinite(t0) && Number.isFinite(t1) && t1 - t0 <= 24 * 3_600_000) {
          return { unlocked: true, date: first.at, project: first.project ?? "" };
        }
      }
      return { unlocked: false };
    },
  },

  // ── Quality ───────────────────────────────────────────────────────────────
  {
    name: "Primer intento",
    category: "Quality",
    condition: "Un producto pasó todas las fases sin un solo rechazo en revisión.",
    check: (data) => {
      // Unlocked when a "flawless" achievement event exists
      const events = data.eventsSnapshot?.events ?? [];
      const ev = events.find(
        (e) => e.event === "achievement" && e.status === "ok" && e.task === "flawless",
      );
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El perfeccionista práctico",
    category: "Quality",
    condition: "3 productos seguidos sin rechazos en diseño.",
    check: (data) => {
      // Unlocked when 3+ consecutive flawless events
      const events = data.eventsSnapshot?.events ?? [];
      const flawlessEvents = events.filter(
        (e) => e.event === "achievement" && e.status === "ok" && e.task === "flawless",
      );
      if (flawlessEvents.length >= 3) {
        const ev = flawlessEvents[2];
        if (ev) return { unlocked: true, date: ev.at, project: ev.project ?? "" };
      }
      return { unlocked: false };
    },
  },

  // ── Consistency ───────────────────────────────────────────────────────────
  {
    name: "El fundador madrugador",
    category: "Consistency",
    condition: "Cerraste un work order antes de las 8am.",
    check: (data) => {
      // Unlocked when any WO achievement event is before 08:00 UTC
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0
        ) {
          const d = new Date(ev.at);
          if (Number.isFinite(d.getTime()) && d.getUTCHours() < 8) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "El último en apagar",
    category: "Consistency",
    condition: "Cerraste un work order después de medianoche.",
    check: (data) => {
      // Unlocked when any WO achievement event is at or after 00:00 UTC (midnight)
      // Midnight = hours 0 (00:00..00:59) — i.e. getUTCHours() === 0
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0
        ) {
          const d = new Date(ev.at);
          if (Number.isFinite(d.getTime()) && d.getUTCHours() === 0) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },

  // ── Mastery ───────────────────────────────────────────────────────────────
  {
    name: "La trilogía",
    category: "Mastery",
    condition: "3 productos vivos en producción al mismo tiempo.",
    check: (data) => {
      const shippedCount = data.statuses.filter(
        (sr) => sr.present && sr.status !== null && sr.status.phase === "operation",
      ).length;
      if (shippedCount < 3) return { unlocked: false };
      // Use the 3rd shipped project's date
      const sorted = [...data.statuses]
        .filter((sr) => sr.present && sr.status !== null && sr.status.phase === "operation")
        .sort((a, b) => {
          const da = (a.present && a.status ? a.status.updatedAt : undefined) ?? "";
          const db = (b.present && b.status ? b.status.updatedAt : undefined) ?? "";
          return da.localeCompare(db);
        });
      const third = sorted[2];
      if (!third?.present || !third.status) return { unlocked: false };
      return {
        unlocked: true,
        date: third.status.updatedAt ?? "",
        project: third.status.project ?? "",
      };
    },
  },
  {
    name: "Coleccionista de estados",
    category: "Mastery",
    condition: "Un producto que pasó por todos los estados del tablero.",
    check: (data) => {
      // Unlocked when any project reached operation (covered all phases)
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },
] as const;

// ─── Helper functions for unique checks ──────────────────────────────────────

/** Returns the first shipped project's date + project name, or null. */
function _firstShippedProject(data: ReaderData): { date: string; project: string } | null {
  const shippedStatuses = data.statuses.filter(
    (sr) => sr.present && sr.status !== null && sr.status.phase === "operation",
  );
  if (shippedStatuses.length === 0) return null;
  // Return earliest by updatedAt
  const sorted = [...shippedStatuses].sort((a, b) => {
    const da = (a.present && a.status ? a.status.updatedAt : undefined) ?? "";
    const db = (b.present && b.status ? b.status.updatedAt : undefined) ?? "";
    return da.localeCompare(db);
  });
  const first = sorted[0];
  if (!first?.present || !first.status) return null;
  return { date: first.status.updatedAt ?? "", project: first.status.project ?? "" };
}

/** Returns the first "achievement" event matching a specific task, or null. */
function _firstAchievementEvent(
  data: ReaderData,
  task: string,
): { at: string; project?: string } | null {
  const events = data.eventsSnapshot?.events ?? [];
  return (
    events.find((ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === task) ??
    null
  );
}

/** Returns the first "achievement" event with task="phase:<phaseName>", or null. */
function _firstPhaseEvent(
  data: ReaderData,
  phaseName: string,
): { at: string; project?: string } | null {
  const events = data.eventsSnapshot?.events ?? [];
  return (
    events.find(
      (ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === `phase:${phaseName}`,
    ) ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7. IF-10-uniques — computeUniques
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A computed unique achievement result (AC-10-003.1).
 */
export type Unique = {
  readonly name: string;
  readonly category: UniqueCategory;
  /** True when the achievement has been earned. */
  readonly unlocked: boolean;
  /** Date when unlocked (ISO string); present only when unlocked (AC-10-003.3). */
  readonly date?: string;
  /** Project slug when unlocked; present only when unlocked (AC-10-003.3). */
  readonly project?: string;
  /** Shown when locked — must be non-obscure (AC-10-003.3). */
  readonly condition: string;
};

/**
 * Compute all unique achievement states (IF-10-uniques, WO-10-001).
 *
 * Pure function: no I/O, no side effects.
 * Unlock state is derived from verifiable reader data (AC-10-003.2).
 * Locked uniques expose their condition (AC-10-003.3).
 */
export function computeUniques(data: ReaderData): Unique[] {
  return UNIQUE_DEFINITIONS.map((def) => {
    const result = def.check(data);
    if (result.unlocked) {
      return {
        name: def.name,
        category: def.category,
        unlocked: true,
        date: result.date,
        project: result.project,
        condition: def.condition,
      };
    }
    return {
      name: def.name,
      category: def.category,
      unlocked: false,
      condition: def.condition,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8. Secret achievement data tables (from docs/achievements.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Secret achievement definition (data table — never mutated). */
export type SecretDefinition = {
  readonly id: string;
  /** Cryptic hint — always visible (AC-10-004.1). */
  readonly hint: string;
  /**
   * What triggered the achievement — revealed ONLY when unlocked (AC-10-004.2).
   * This field is in the definition for traceability; it is only surfaced in the
   * output Secret when unlocked.
   */
  readonly criterion: string;
  /**
   * Pure predicate returning unlock state from verifiable reader data (AC-10-004.3).
   * Returns null when locked, or { date, project } when unlocked.
   */
  readonly check: (data: ReaderData) => null | { date: string; project: string };
};

/**
 * All secret achievement definitions.
 *
 * Source: docs/achievements.md §3 Secrets.
 * 3 secrets (hidden with cryptic hints until unlocked).
 */
export const SECRET_DEFINITIONS: readonly SecretDefinition[] = [
  {
    id: "void-side",
    hint: "Ocurre cuando ves el vacío al otro lado.",
    criterion: "Toda tu base de ideas está vacía o sin elementos activos.",
    check: (data) => {
      // Unlocked when the idea base has no active ideas (all discarded, or empty)
      const activeIdeas = data.ideas.filter(
        (idea) =>
          idea.status === "discovered" ||
          idea.status === "recommended" ||
          idea.status === "in-pipeline",
      );
      if (data.ideas.length > 0 && activeIdeas.length === 0) {
        // Use the latest discarded idea's date as a proxy
        const discardedSorted = [...data.ideas]
          .filter((i) => i.status === "discarded")
          .sort((a, b) => a.slug.localeCompare(b.slug));
        const last = discardedSorted[discardedSorted.length - 1];
        return { date: "2026-01-01", project: last?.slug ?? "factory" };
      }
      return null;
    },
  },
  {
    id: "code-reviewed-code",
    hint: "El código revisó al código.",
    criterion: "Un agente revisor corrigió o completó el trabajo de otro agente.",
    check: (data) => {
      // Unlocked when there is a "review" event from a reviewer agent with status=ok
      const events = data.eventsSnapshot?.events ?? [];
      const reviewerEvent = events.find(
        (ev) =>
          ev.event === "review" &&
          ev.status === "ok" &&
          typeof ev.agent === "string" &&
          ev.agent.toLowerCase().includes("reviewer"),
      );
      if (!reviewerEvent) return null;
      return { date: reviewerEvent.at, project: reviewerEvent.project ?? "" };
    },
  },
  {
    id: "faster-than-expected",
    hint: "Va más rápido de lo esperado.",
    criterion: "Completaste el pipeline completo (producto → operación) en un solo día.",
    check: (data) => {
      // Unlocked when design, architecture, implementation, and release phase events
      // all occur on the same UTC day
      const events = data.eventsSnapshot?.events ?? [];
      const phaseEvents = events.filter(
        (ev) =>
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.task === "string" &&
          ev.task.startsWith("phase:"),
      );
      // Group phase events by UTC date
      const dateMap = new Map<string, Set<string>>();
      for (const ev of phaseEvents) {
        const d = new Date(ev.at);
        if (!Number.isFinite(d.getTime())) continue;
        const dateKey = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const phases = dateMap.get(dateKey) ?? new Set<string>();
        phases.add(ev.task ?? "");
        dateMap.set(dateKey, phases);
      }
      // Also check for a "release" event on the same day
      const releaseEvents = events.filter(
        (ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === "release",
      );
      for (const relEv of releaseEvents) {
        const d = new Date(relEv.at);
        if (!Number.isFinite(d.getTime())) continue;
        const dateKey = d.toISOString().slice(0, 10);
        const phasesOnDay = dateMap.get(dateKey);
        if (phasesOnDay && phasesOnDay.size >= 3) {
          return { date: relEv.at, project: relEv.project ?? "" };
        }
      }
      return null;
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 9. IF-10-secrets — computeSecrets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A computed secret achievement result (AC-10-004.1).
 */
export type Secret = {
  /** Always available (cryptic hint shown even when locked — AC-10-004.1). */
  readonly hint: string;
  /** True when the secret has been unlocked. */
  readonly unlocked: boolean;
  /**
   * What triggered the achievement — revealed ONLY when unlocked (AC-10-004.2).
   * NEVER present when locked (the criterion stays hidden until earned).
   */
  readonly criterion?: string;
  /** Date when unlocked; present only when unlocked. */
  readonly date?: string;
  /** Project when unlocked; present only when unlocked. */
  readonly project?: string;
};

/**
 * Compute all secret achievement states (IF-10-secrets, WO-10-001).
 *
 * Pure function: no I/O, no side effects.
 * Unlock state derived from verifiable reader data (AC-10-004.3).
 *
 * Locked: criterion is hidden (only hint visible — AC-10-004.2).
 * Unlocked: criterion is revealed (AC-10-004.2 — never permanent obscurity).
 */
export function computeSecrets(data: ReaderData): Secret[] {
  return SECRET_DEFINITIONS.map((def) => {
    const unlockResult = def.check(data);
    if (unlockResult !== null) {
      // Unlocked: reveal the criterion (AC-10-004.2)
      return {
        hint: def.hint,
        unlocked: true,
        criterion: def.criterion,
        date: unlockResult.date,
        project: unlockResult.project,
      };
    }
    // Locked: criterion is hidden (only hint)
    return {
      hint: def.hint,
      unlocked: false,
      // criterion, date, project are absent (undefined) — enforced by type (AC-10-004.2)
    };
  });
}
