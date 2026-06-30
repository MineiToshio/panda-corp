/**
 * lib/achievements/report/usage.ts — IF-10-usage (`usageMix`), WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only, PURE — no new fs. Aggregates the
 * most-used workflows (from the real `SubagentStop` background-task names surfaced on
 * `Event.workflows`) and the effort mix (from `Event.effortLevel`) over the already-read
 * `eventsSnapshot`. An absent snapshot → honest empty (never fabricated).
 *
 * Traceability: AC-10-014.4.
 */

import type { Event } from "../../events/events";
import type { ReaderData } from "../readerData";
import type { EffortLevel, UsageCount, UsageMix } from "./types";

/** The effort levels the report surfaces (real `data.effort.level` vocabulary). */
const EFFORT_LEVELS: readonly EffortLevel[] = ["high", "xhigh", "max", "medium"];

/** Tally a string key → count map and return it sorted descending by count (ties: name asc). */
function sortedCounts(counts: Map<string, number>): UsageCount[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));
}

/** Count each workflow name across the events (an event may carry several names). */
function tallyWorkflows(events: readonly Event[]): UsageCount[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const workflows = ev.workflows;
    if (workflows === undefined) continue;
    for (const name of workflows) {
      if (name.trim() === "") continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return sortedCounts(counts);
}

/** Count each effort level across the events, descending by count. */
function tallyEffort(events: readonly Event[]): { level: EffortLevel; count: number }[] {
  const counts = new Map<EffortLevel, number>();
  for (const ev of events) {
    const level = ev.effortLevel;
    if (level !== undefined && (EFFORT_LEVELS as readonly string[]).includes(level)) {
      const lvl = level as EffortLevel;
      counts.set(lvl, (counts.get(lvl) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Derive the usage mix from the reader's already-read event snapshot (IF-10-usage).
 *
 * Pure: no I/O, no clock, no mutation. Same `data` → same result.
 *
 * @param data - The reader-input aggregate (`eventsSnapshot` may be null → empty mix).
 * @returns A `UsageMix` — top workflows + effort mix, both descending.
 */
export function usageMix(data: ReaderData): UsageMix {
  const events = data.eventsSnapshot?.events ?? [];
  return {
    workflows: tallyWorkflows(events),
    effort: tallyEffort(events),
  };
}
