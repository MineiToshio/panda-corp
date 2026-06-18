/**
 * WO-14-001 — `lib/snapshot.ts`: pure helpers for the snapshot panel.
 *
 * Traceability:
 *   IF-14-snapshot (blueprint §2)
 *   REQ-14-001 (snapshot panel with last probable point + worktree command)
 *   REQ-14-002 (distinguish "building now" from "last probable point")
 *   REQ-14-003 (staleness warning when snapshot is far behind HEAD)
 *   AC-14-001.2 — worktreeCommand = `git worktree add ../<slug>-review <sha>`
 *   AC-14-001.3 — absent lastGreenSha → null
 *   AC-14-002.1 — buildingNow set when running; undefined otherwise
 *   AC-14-003.1 — isSnapshotStale pure verdict against threshold
 *
 * Pure: no fs, no git, no side effects. Inputs come from the caller (already-read
 * ProjectStatus fields, and commitsBehind/hoursSinceGreen from the route-handler
 * probe — see blueprint §5 flag and WO-14-002).
 *
 * Thresholds live here (not in lib/constants.ts which owns build-mode catalog).
 * They are exported so callers can reference the documented limit, not a magic number.
 */

import type { ProjectStatus } from "./status";

// ---------------------------------------------------------------------------
// Threshold constants (no magic numbers — AC-14-003.1)
// ---------------------------------------------------------------------------

/**
 * How many commits behind HEAD qualifies the snapshot as stale.
 * At or above this number → stale = true.
 * Documented threshold; change here propagates to both isSnapshotStale and the UI warning.
 */
export const SNAPSHOT_STALE_COMMITS_THRESHOLD = 10;

/**
 * How many hours since the last green SHA qualifies the snapshot as stale.
 * At or above this number → stale = true.
 */
export const SNAPSHOT_STALE_HOURS_THRESHOLD = 24;

// ---------------------------------------------------------------------------
// SnapshotInfo — the shaped result of buildSnapshot
// ---------------------------------------------------------------------------

export interface SnapshotInfo {
  /** The last_green_sha value. */
  sha: string;
  /** safe_to_test from the status — false when absent. */
  safeToTest: boolean;
  /** Ready-to-copy git worktree command (AC-14-001.2). */
  worktreeCommand: string;
  /**
   * Set when running=true; contains a human-readable progress string
   * ("building now: <progress>%") so the UI can show it without re-deriving (AC-14-002.1).
   * Undefined when not running.
   */
  buildingNow?: string;
  /**
   * Staleness verdict — true when the snapshot is far behind HEAD.
   * Defaults to false; the caller (WO-14-002 route handler) re-derives this after
   * probing git; here it is always false because buildSnapshot is pure/no-git.
   * WO-14-002 will compute commitsBehind/hoursSinceGreen and call isSnapshotStale,
   * then can reconstruct or augment this result as needed.
   */
  stale: boolean;
}

// ---------------------------------------------------------------------------
// buildSnapshot — AC-14-001.2, AC-14-001.3, AC-14-002.1
// ---------------------------------------------------------------------------

/**
 * Derives a `SnapshotInfo` from already-read status fields.
 *
 * Returns `null` when `lastGreenSha` is absent or empty (AC-14-001.3) — the
 * snapshot panel should be omitted entirely (nothing probable yet).
 *
 * @param slug   — the project slug used in the worktree path (e.g. "mission-control")
 * @param status — a Partial<ProjectStatus> (tolerates partial; never throws)
 * @returns SnapshotInfo or null
 */
export function buildSnapshot(slug: string, status: Partial<ProjectStatus>): SnapshotInfo | null {
  const sha = status.lastGreenSha;

  // AC-14-001.3 — absent or empty sha → return null, no broken command.
  if (!sha || sha.trim() === "") {
    return null;
  }

  // AC-14-001.2 — worktree command
  const worktreeCommand = `git worktree add ../${slug}-review ${sha}`;

  // safe_to_test — default false when absent (fail-safe: don't mislead the user)
  const safeToTest = status.safeToTest === true;

  // AC-14-002.1 — buildingNow only when running
  let buildingNow: string | undefined;
  if (status.running === true) {
    const progress = status.progress;
    if (typeof progress === "number" && Number.isFinite(progress)) {
      buildingNow = `building now: ${progress}%`;
    } else {
      buildingNow = "building now";
    }
  }

  return {
    sha,
    safeToTest,
    worktreeCommand,
    buildingNow,
    stale: false, // default; caller sets true after git probe (WO-14-002)
  };
}

// ---------------------------------------------------------------------------
// isSnapshotStale — AC-14-003.1
// ---------------------------------------------------------------------------

/**
 * Pure staleness verdict.
 *
 * Returns true when EITHER:
 * - `commitsBehind` >= SNAPSHOT_STALE_COMMITS_THRESHOLD, OR
 * - `hoursSinceGreen` >= SNAPSHOT_STALE_HOURS_THRESHOLD.
 *
 * Both inputs come from the caller's git probe (route handler, WO-14-002);
 * this function is pure and testable in isolation.
 *
 * At-threshold = stale (>=, not >), so the boundary is inclusive: a snapshot
 * exactly 10 commits behind is already stale.
 *
 * @param commitsBehind    — number of commits HEAD is ahead of last_green_sha
 * @param hoursSinceGreen  — hours elapsed since last_green_sha was set
 */
export function isSnapshotStale(commitsBehind: number, hoursSinceGreen: number): boolean {
  return (
    commitsBehind >= SNAPSHOT_STALE_COMMITS_THRESHOLD ||
    hoursSinceGreen >= SNAPSHOT_STALE_HOURS_THRESHOLD
  );
}
