/**
 * Shared machine-state-version movement detector (DR-066 fix 3).
 *
 * Lifted out of `PartyLiveShell` so BOTH the Party live shell and the Work Orders
 * live refresher (`WoLiveRefresh`) share ONE implementation (2026-07-07).
 *
 * WHY: a build can rewrite `status.yaml` / work-order frontmatter WITHOUT emitting
 * an event — a cold start, a long gate, or a backward WO transition
 * (IN_REVIEW→PLANNED on a reopen). The SSE frame stamps `stateVersion` (the max
 * mtime of that machine state), so a consumer can refresh its server-derived view
 * even when no event moved.
 *
 * Pure except for the deliberate ref mutation — no I/O, no node built-ins.
 */

/**
 * Did the machine-state version move past the last one seen?
 *
 * The FIRST observed version only sets the baseline (the server render already
 * saw that state) and does NOT count as movement. Mutates `lastSeenRef`.
 *
 * @param stateVersion - The frame's `stateVersion` (max state mtime, or undefined).
 * @param lastSeenRef  - A mutable holder of the last version seen (`{ current }`).
 * @returns true only when `stateVersion` is a genuinely newer value.
 */
export function stateVersionMoved(
  stateVersion: number | undefined,
  lastSeenRef: { current: number | null },
): boolean {
  if (stateVersion === undefined) return false;
  if (lastSeenRef.current === null) {
    lastSeenRef.current = stateVersion;
    return false;
  }
  if (stateVersion <= lastSeenRef.current) return false;
  lastSeenRef.current = stateVersion;
  return true;
}
