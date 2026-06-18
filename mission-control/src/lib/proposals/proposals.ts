/**
 * lib/proposals/proposals.ts — open proposal count derivation (WO-17-007).
 *
 * Derives the total number of open (non-dismissed) proposals from the factory
 * memory for use in the top-bar guild badge and per-project portfolio-rail chip
 * (CMP-17-badge, AC-17-007.1, AC-17-007.2).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude, never write.
 * Client-local dismissals (localStorage) are NOT applied here — the badge count
 * is the server-side open count; dismissed items are filtered on the client
 * (see CMP-17-dismiss / proposalsDismissStore.ts).
 *
 * Traceability:
 *   CMP-17-badge → REQ-17-001, REQ-17-008
 *   AC-17-007.1 (open count for the top-bar badge)
 *   AC-17-007.2 (per-project proposals count for the rail chip)
 *   AC-17-007.4 (calm when 0 — consumer reads the count)
 */

import { readLessons } from "../memory/memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape for the open proposal count breakdown. */
export type ProposalCounts = {
  /** Lessons with `status === "candidate"` (awaiting corroboration). */
  candidates: number;
  /** Lessons with `promotion === "proposed"` (promotion queue). */
  promotions: number;
  /** Lessons with `status === "deprecated"` (prune proposals). */
  prunable: number;
  /**
   * Total open proposals = candidates + promotions + prunable.
   * Self-suggestions are computed client-side (or per-request); not included here
   * since they require additional data (board, events, etc.) and this function
   * is lightweight (only reads factory/memory/).
   */
  total: number;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the total count of open proposals from factory/memory/.
 *
 * Open proposals = candidates + promotions + prunable.
 * Self-suggestions are excluded (they require board/event data).
 *
 * Fail-soft: missing memory directory → all zeros. Never throws.
 *
 * @returns ProposalCounts; never throws.
 */
export function countOpenProposals(): ProposalCounts {
  try {
    const lessons = readLessons();
    const candidates = lessons.filter((l) => l.status === "candidate").length;
    const promotions = lessons.filter((l) => l.promotion === "proposed").length;
    const prunable = lessons.filter((l) => l.status === "deprecated").length;
    const total = candidates + promotions + prunable;
    return { candidates, promotions, prunable, total };
  } catch {
    return { candidates: 0, promotions: 0, prunable: 0, total: 0 };
  }
}
