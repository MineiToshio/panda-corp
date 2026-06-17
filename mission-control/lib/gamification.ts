/**
 * lib/gamification.ts — Pure XP / level / celebration engine (FRD-09)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions.
 * This module is flagged as a NEW file in blueprint §7.
 *
 * Interfaces implemented (blueprint §3):
 *   IF-09-celebration — classifyCelebration(event): CelebrationTier
 *
 * Traceability:
 *   AC-09-005.1 — maps outcome events to the correct celebration tier
 *   AC-09-005.2 — non-result/activity events → "none" (ethical constraint: no XP for activity)
 *   AC-09-005.3 — ambiguous/unknown → "none" (never a default celebration); pure function
 *
 * FRD-09 non-negotiable design constraints enforced here:
 *   - XP / celebrations ONLY for verifiable results (WO closed, phase done, release, level-up).
 *   - NO celebration for: app-open, read, write, edit, message, navigation, failure.
 *   - Celebrations SCALE: toast (WO) → phase → release → levelup. Never flat.
 *   - Forbidden patterns: leaderboards, lives, daily-reset streaks, false urgency.
 */
import type { Event } from "./events";

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
