/**
 * lib/gamification.ts — Pure XP / level / celebration engine (FRD-09)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions.
 * This module is flagged as a NEW file in blueprint §7.
 *
 * Interfaces implemented (blueprint §3):
 *   IF-09-guild-xp  — computeGuildLevel(outcomes): GuildLevel
 *   IF-09-celebration — classifyCelebration(event): CelebrationTier
 *
 * Traceability:
 *   AC-09-001.1 — computeGuildLevel returns { level, title, xp, next, pctToNext }
 *   AC-09-001.2 — XP only from verifiable results (WO closed, phase, release, green tests)
 *   AC-09-001.3 — No outcomes → honest zero state; never bar stuck at ~80%
 *   AC-09-001.4 — Streak is weekly (with freeze cap), never daily-reset
 *   AC-09-001.5 — Pure function, fixture-tested
 *   AC-09-005.1 — maps outcome events to the correct celebration tier
 *   AC-09-005.2 — non-result/activity events → "none" (ethical constraint: no XP for activity)
 *   AC-09-005.3 — ambiguous/unknown → "none" (never a default celebration); pure function
 *
 * FRD-09 non-negotiable design constraints enforced here:
 *   - XP / celebrations ONLY for verifiable results (WO closed, phase done, release, level-up).
 *   - NO XP for: app-open, read, write, edit, message, navigation, activity.
 *   - NO celebration for: activity events, failure, ambiguous.
 *   - Celebrations SCALE: toast (WO) → phase → release → levelup. Never flat.
 *   - Forbidden patterns: leaderboards, lives, daily-reset streaks, false urgency, bar at ~80%.
 */
import type { Event, EventsSnapshot } from "../events/events";
import type { StatusResult } from "../status/status";

// Agent-level scoring (WO-09-002) lives in ./agents; re-exported here so the
// public surface of `@/lib/gamification/gamification` stays identical.
export {
  AGENT_RANKS,
  AGENT_XP_THRESHOLDS,
  type AgentLevelResult,
  computeAgentLevel,
} from "./agents";

// ---------------------------------------------------------------------------
// IF-09-guild-xp — computeGuildLevel (WO-09-001)
// ---------------------------------------------------------------------------

/**
 * Rank entry in the guild XP ladder.
 *
 * `threshold` is the minimum XP required to hold this rank.
 * The first rank always has threshold = 0 (no XP required).
 * Thresholds must be strictly increasing.
 */
export type Rank = {
  readonly title: string;
  readonly threshold: number;
};

/**
 * The guild rank ladder (honest RPG names, Spanish, from blueprint §3).
 *
 * Progression: Aprendiz → Artesano → Oficial → Maestro → Gran Maestro → Maestro del Gremio
 *
 * XP weights (per outcome, §2 honesty contract):
 *   - work order done : 10 XP
 *   - phase completed : 50 XP
 *   - release         : 200 XP
 *   - green test run  : 1 XP  (each run, minor confirmation)
 *   - weekly streak   : 5 XP/week, capped at MAX_STREAK_WEEKS
 *
 * Thresholds are calibrated so a fresh guild with ~5 WOs is solidly Artesano,
 * and reaching Gran Maestro requires several released projects.
 */
export const RANKS: readonly Rank[] = [
  { title: "Aprendiz", threshold: 0 },
  { title: "Artesano", threshold: 100 },
  { title: "Oficial", threshold: 500 },
  { title: "Maestro", threshold: 1500 },
  { title: "Gran Maestro", threshold: 4000 },
  { title: "Maestro del Gremio", threshold: 10_000 },
] as const;

/** Maximum weekly streak weeks counted (freeze concept — no unbounded multiplier). */
const MAX_STREAK_WEEKS = 52;

/** XP earned per closed work order. */
const XP_PER_WO = 10;

/** XP earned per completed phase. */
const XP_PER_PHASE = 50;

/** XP earned per release / launch (reaching operation phase). */
const XP_PER_RELEASE = 200;

/** XP earned per green test run (minor confirmation signal). */
const XP_PER_GREEN_TEST = 1;

/** XP earned per week of weekly streak (capped at MAX_STREAK_WEEKS). */
const XP_PER_STREAK_WEEK = 5;

/**
 * The verifiable outcomes that drive guild XP.
 *
 * Each field maps to a source from the honesty contract (blueprint §2):
 *   - `workOrdersDone`  ← `status.yaml:work_orders_done` / `achievement` event with workOrder
 *   - `phasesCompleted` ← `status.yaml:phase` transitions
 *   - `releases`        ← `phase: operation` reached in portfolio
 *   - `greenTestRuns`   ← `test_ok` events
 *   - `weeklyStreak`    ← optional; weekly cadence with freeze (never daily-reset)
 *
 * Deliberately ABSENT from this type (FRD-09 ethical constraint):
 *   - No `appOpens`, `navigations`, `pageViews` — activity is NOT rewarded.
 *   - No `dailyStreak` — only `weeklyStreak` with freeze.
 */
export type GuildOutcomes = {
  /** Number of work orders closed green. */
  readonly workOrdersDone: number;
  /** Number of phases completed (design, architecture, implementation, release, operation). */
  readonly phasesCompleted: number;
  /** Number of releases (projects reaching operation phase). */
  readonly releases: number;
  /** Number of green test suite runs. */
  readonly greenTestRuns: number;
  /**
   * Current weekly streak (weeks with at least one closed WO).
   * Optional — omit or set to 0 for no streak bonus.
   * Capped at MAX_STREAK_WEEKS (freeze concept).
   */
  readonly weeklyStreak?: number;
};

/**
 * The computed guild level result.
 *
 * All fields are derived purely from GuildOutcomes — no I/O, no clock, no engagement bonus.
 */
export type GuildLevel = {
  /** Current rank index (1-based; level 1 = Aprendiz). */
  readonly level: number;
  /** Human-readable rank title from the RANKS ladder. */
  readonly title: string;
  /** Total accumulated XP (sum of all verifiable outcomes). */
  readonly xp: number;
  /** XP threshold required for the next rank (= current threshold if at max rank). */
  readonly next: number;
  /**
   * Percentage progress toward the next rank, 0–100.
   * Exactly 0 when xp = 0 (honest zero state — never near 80% with no real work).
   * Exactly 100 when at the top rank (full bar).
   */
  readonly pctToNext: number;
};

/**
 * Compute the guild's current level, title, XP, next threshold and progress bar
 * from a set of verifiable real outcomes (WO-09-001, IF-09-guild-xp).
 *
 * Pure function: no I/O, no clock, no time-decay, no engagement bonus, no mutation.
 * Same outcomes always produce the same result.
 *
 * XP is derived ONLY from the honesty contract (blueprint §2):
 *   work orders done, phases completed, releases, green test runs, weekly streak.
 *
 * Forbidden (never contributes XP):
 *   - App opens, navigation, page views, messages, file reads/writes.
 *   - Daily-reset streaks (only weekly, capped).
 *
 * Honest zero state: when all outcome counts are zero, xp = 0, pctToNext = 0,
 * level = 1, title = RANKS[0].title. The bar is NEVER artificially inflated.
 */
export function computeGuildLevel(outcomes: GuildOutcomes): GuildLevel {
  // ── XP derivation (honesty contract) ──────────────────────────────────────
  const cappedStreak = Math.min(
    Math.max(0, Math.trunc(outcomes.weeklyStreak ?? 0)),
    MAX_STREAK_WEEKS,
  );

  const xp =
    outcomes.workOrdersDone * XP_PER_WO +
    outcomes.phasesCompleted * XP_PER_PHASE +
    outcomes.releases * XP_PER_RELEASE +
    outcomes.greenTestRuns * XP_PER_GREEN_TEST +
    cappedStreak * XP_PER_STREAK_WEEK;

  // ── Rank resolution ────────────────────────────────────────────────────────
  // Walk from the highest rank down to find the current rank.
  // RANKS are sorted ascending; the current rank is the last one whose
  // threshold is <= xp.
  let rankIndex = 0;
  for (let i = 0; i < RANKS.length; i++) {
    const rank = RANKS[i];
    if (rank !== undefined && xp >= rank.threshold) {
      rankIndex = i;
    }
  }

  // biome-ignore lint/style/noNonNullAssertion: RANKS is non-empty (length >= 4, verified by tests)
  const currentRank = RANKS[rankIndex]!;
  const level = rankIndex + 1; // 1-based
  const isMaxRank = rankIndex === RANKS.length - 1;

  // ── Progress bar ───────────────────────────────────────────────────────────
  let pctToNext: number;
  let next: number;

  if (isMaxRank) {
    // At the top rank: bar is full (100%), next = current threshold (nowhere to go).
    pctToNext = 100;
    next = currentRank.threshold;
  } else {
    // biome-ignore lint/style/noNonNullAssertion: not at max rank, so RANKS[rankIndex + 1] exists
    const nextRank = RANKS[rankIndex + 1]!;
    next = nextRank.threshold;
    const span = nextRank.threshold - currentRank.threshold;
    const progress = xp - currentRank.threshold;
    // Guard: span > 0 is always true for valid RANKS (strictly increasing thresholds).
    pctToNext = span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0;
  }

  return {
    level,
    title: currentRank.title,
    xp,
    next,
    pctToNext,
  };
}

/**
 * The four celebration tiers (plus "none"), ordered by scale.
 *
 *   "toast"   — work order closed (green tests, achievement + workOrder)
 *   "phase"   — phase completed (phase transition or phase-scoped end/handoff)
 *   "release" — project released / reached operation phase
 *   "levelup" — guild or agent crossed a level threshold
 *   "none"    — no celebration (activity events, unknown, failure, ambiguous)
 */
export type CelebrationTier = "toast" | "phase" | "release" | "levelup" | "none";

/**
 * Classify an event from the dashboard stream into a celebration tier.
 *
 * Pure function: same input always yields same output; no side effects; event is never mutated.
 *
 * Decision table (FRD-09 blueprint §2 + AC-09-005.*):
 *
 * | event         | conditions                          | tier     |
 * |---------------|-------------------------------------|----------|
 * | achievement   | task = "levelup" or "level-up"      | levelup  |
 * | achievement   | task = "release"                    | release  |
 * | achievement   | task starts with "phase:"           | phase    |
 * | achievement   | workOrder present, status ≠ "fail"  | toast    |
 * | test_ok       | workOrder present                   | toast    |
 * | end           | task = "release"                    | release  |
 * | end           | task starts with "phase:"           | phase    |
 * | handoff       | task starts with "phase:"           | phase    |
 * | (anything)    | status = "fail"                     | none     |
 * | (anything)    | unknown / activity                  | none     |
 *
 * Ethical invariant (FRD-09): activity events (read, write, edit, message, start, review,
 * blocked, test_fail, navigation, app-open) ALWAYS return "none".
 */
export function classifyCelebration(event: Event): CelebrationTier {
  // Failure is never a celebration (FRD-09 ethical constraint).
  if (event.status === "fail") {
    return "none";
  }

  const { event: kind, task, workOrder } = event;

  // ── achievement events (the primary verifiable-result signal) ──────────────
  if (kind === "achievement") {
    // Level-up crossing takes priority over everything else.
    if (task === "levelup" || task === "level-up") {
      return "levelup";
    }
    // Release / launch (reached operation phase).
    if (task === "release") {
      return "release";
    }
    // Phase completion (e.g. "phase:design", "phase:architecture").
    if (typeof task === "string" && task.startsWith("phase:")) {
      return "phase";
    }
    // Work-order closed (the most common verifiable result).
    if (typeof workOrder === "string" && workOrder.length > 0) {
      return "toast";
    }
    // achievement with no meaningful context → ambiguous → none.
    return "none";
  }

  // ── test_ok: green test suite with a work-order attribution ───────────────
  if (kind === "test_ok") {
    if (typeof workOrder === "string" && workOrder.length > 0) {
      return "toast";
    }
    // test_ok without a work-order is ambiguous (could be a standalone run).
    return "none";
  }

  // ── end / handoff: phase-scoped transitions ────────────────────────────────
  if (kind === "end" || kind === "handoff") {
    if (task === "release") {
      return "release";
    }
    if (typeof task === "string" && task.startsWith("phase:")) {
      return "phase";
    }
    // end/handoff without a phase scope is not a verifiable result.
    return "none";
  }

  // ── everything else: activity events (read, write, edit, message, start,
  //    review, blocked, test_fail, navigation, app-open, unknown) ─────────────
  return "none";
}

// ---------------------------------------------------------------------------
// deriveGuildOutcomes — aggregate real outcomes from portfolio statuses + events (WO-09-004)
//
// Pure derivation layer: takes already-read data and produces GuildOutcomes.
// No I/O — the caller (Server Component in app/layout.tsx) reads the data;
// this function only processes what it receives (architecture §6: data layer
// boundary is lib/, components never touch fs directly).
// ---------------------------------------------------------------------------

/**
 * Input for deriveGuildOutcomes: the already-read statuses for every portfolio project
 * and the events snapshot (for green test runs).
 */
export type GuildOutcomesInput = {
  /** StatusResult for each portfolio project (read via readStatus). */
  statuses: readonly StatusResult[];
  /**
   * Events snapshot from readEvents() (for greenTestRuns count).
   * May be omitted (treated as zero test runs).
   */
  eventsSnapshot?: EventsSnapshot | null;
  /**
   * Current weekly streak (weeks with at least one closed WO).
   * Optional — 0 when not tracked yet.
   */
  weeklyStreak?: number;
};

/**
 * Derive GuildOutcomes from the portfolio's real data (WO-09-004, AC-09-004.1).
 *
 * Honesty contract (blueprint §2):
 *   - workOrdersDone  = sum of status.workOrdersDone across all projects (present + valid)
 *   - phasesCompleted = count of projects whose phase is in { design, architecture, implementation,
 *                       release, operation } (each project that advanced past product = 1 phase)
 *   - releases        = count of projects in "operation" phase (reached launch)
 *   - greenTestRuns   = count of "test_ok" events in the snapshot
 *
 * All missing/malformed statuses are skipped (never throws, fail-soft).
 * Never inflates XP — strictly derived from verifiable outcomes.
 *
 * Pure function: no I/O, no side-effects, same input → same output.
 */
export function deriveGuildOutcomes(input: GuildOutcomesInput): GuildOutcomes {
  const { statuses, eventsSnapshot, weeklyStreak } = input;

  let workOrdersDone = 0;
  let phasesCompleted = 0;
  let releases = 0;

  const COMPLETED_PHASES = new Set([
    "design",
    "architecture",
    "implementation",
    "release",
    "operation",
  ]);

  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const st = sr.status;

    // workOrdersDone: accumulate per-project WOs closed
    if (typeof st.workOrdersDone === "number" && Number.isFinite(st.workOrdersDone)) {
      workOrdersDone += Math.max(0, Math.trunc(st.workOrdersDone));
    }

    // phasesCompleted: project advanced beyond "product" phase
    if (typeof st.phase === "string" && COMPLETED_PHASES.has(st.phase)) {
      phasesCompleted += 1;
    }

    // releases: project reached operation (launched)
    if (st.phase === "operation") {
      releases += 1;
    }
  }

  // greenTestRuns: count test_ok events in the snapshot
  let greenTestRuns = 0;
  if (eventsSnapshot) {
    for (const ev of eventsSnapshot.events) {
      if (ev.event === "test_ok") {
        greenTestRuns += 1;
      }
    }
  }

  return {
    workOrdersDone,
    phasesCompleted,
    releases,
    greenTestRuns,
    weeklyStreak: weeklyStreak ?? 0,
  };
}
