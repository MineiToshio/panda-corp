/**
 * lib/achievements/report/funnel.ts — IF-10-funnel (`funnelAndFlow`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only, PURE over `readIdeas` + `readStatus` —
 * no new I/O. The ideas→launched funnel, WIP (active projects), the idea-status breakdown,
 * conversion %, and discards-without-structured-reason (a hygiene signal).
 *
 * Traceability: AC-10-014.4.
 */

import { countIdeas, countLaunched, type IdeaCard } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import type { FunnelFlow } from "./types";

/** Phases that count as work-in-progress (active project, not yet launched, past product). */
const WIP_PHASES: ReadonlySet<string> = new Set(["design", "architecture", "implementation"]);

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
 * Pure: no I/O, no clock, no mutation. Same inputs → same result. Idea counts
 * (`totalIdeas`, `byStatus`) come from THE single resolver (`countIdeas`, DR-092/
 * DR-115); the launched count comes from THE single bridge resolver (`countLaunched`,
 * `lib/ideas/ideas.ts`, DR-085/DR-115) — never a local status filter/tally, or this
 * drifts from the dashboard's Pulso count the moment either side's filter changes.
 *
 * @param ideas    - All idea cards (`readIdeas`).
 * @param statuses - Status results for every portfolio project (`readStatus`).
 * @returns A `FunnelFlow` — funnel, WIP, status breakdown, conversion, discard hygiene.
 */
export function funnelAndFlow(
  ideas: readonly IdeaCard[],
  statuses: readonly StatusResult[],
): FunnelFlow {
  const { totalIdeas, byStatus } = countIdeas(ideas);
  const launched = countLaunched(ideas, statuses);
  const conversionPct = totalIdeas === 0 ? 0 : Math.round((launched / totalIdeas) * 100);

  return {
    totalIdeas,
    byStatus,
    launched,
    conversionPct,
    wip: countWip(statuses),
    discardsWithoutReason: countDiscardsWithoutReason(ideas),
  };
}
