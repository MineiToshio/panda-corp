/**
 * lib/achievements/report/funnel.ts — IF-10-funnel (`funnelAndFlow`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only, PURE over `readIdeas` + `readStatus` —
 * no new I/O. The ideas→launched funnel, WIP (active projects), the idea-status breakdown,
 * conversion %, and discards-without-structured-reason (a hygiene signal).
 *
 * Traceability: AC-10-014.4.
 */

import type { IdeaCard, IdeaStatus } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import type { FunnelFlow } from "./types";

/** Every idea status, so the breakdown always has every bucket (never a missing key). */
const ALL_STATUSES: readonly IdeaStatus[] = [
  "discovered",
  "recommended",
  "in-pipeline",
  "shipped",
  "discarded",
];

/** Phases that count as work-in-progress (active project, not yet launched, past product). */
const WIP_PHASES: ReadonlySet<string> = new Set(["design", "architecture", "implementation"]);

/** Count present projects at phase === release (launched). */
function countLaunched(statuses: readonly StatusResult[]): number {
  let n = 0;
  for (const sr of statuses) {
    if (sr.present && sr.status !== null && sr.status.phase === "release") n += 1;
  }
  return n;
}

/** Count present projects whose phase is an active WIP phase. */
function countWip(statuses: readonly StatusResult[]): number {
  let n = 0;
  for (const sr of statuses) {
    if (sr.present && sr.status !== null && typeof sr.status.phase === "string") {
      if (WIP_PHASES.has(sr.status.phase)) n += 1;
    }
  }
  return n;
}

/** Tally idea cards by status (every bucket present, even at 0). */
function tallyByStatus(ideas: readonly IdeaCard[]): Record<IdeaStatus, number> {
  const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    IdeaStatus,
    number
  >;
  for (const idea of ideas) byStatus[idea.status] += 1;
  return byStatus;
}

/** Discarded cards with no structured `discard_reason` (empty/absent) — a hygiene signal. */
function countDiscardsWithoutReason(ideas: readonly IdeaCard[]): number {
  let n = 0;
  for (const idea of ideas) {
    if (idea.status === "discarded" && (idea.discardReason ?? "").trim() === "") n += 1;
  }
  return n;
}

/**
 * Derive the funnel/flow aggregates from idea cards + project statuses (IF-10-funnel).
 *
 * Pure: no I/O, no clock, no mutation. Same inputs → same result.
 *
 * @param ideas    - All idea cards (`readIdeas`).
 * @param statuses - Status results for every portfolio project (`readStatus`).
 * @returns A `FunnelFlow` — funnel, WIP, status breakdown, conversion, discard hygiene.
 */
export function funnelAndFlow(
  ideas: readonly IdeaCard[],
  statuses: readonly StatusResult[],
): FunnelFlow {
  const totalIdeas = ideas.length;
  const launched = countLaunched(statuses);
  const conversionPct = totalIdeas === 0 ? 0 : Math.round((launched / totalIdeas) * 100);

  return {
    totalIdeas,
    byStatus: tallyByStatus(ideas),
    launched,
    conversionPct,
    wip: countWip(statuses),
    discardsWithoutReason: countDiscardsWithoutReason(ideas),
  };
}
