import type { Event } from "@/lib/events/event-types";

const BUILD_EVENTS = new Set([
  "AgentWorking",
  "gate",
  "achievement",
  "wo_commit",
  "GateVerdict",
  "GateResult",
  "AgentDone",
  "wo_reopen",
]);
/** Project-owned build events only; unrelated hook noise cannot power a scene. */
export function latestBuildEvent(events: readonly Event[], project: string): string | null {
  return events
    .filter(
      (event) =>
        event.project === project &&
        BUILD_EVENTS.has(event.event) &&
        Number.isFinite(Date.parse(event.at)),
    )
    .reduce<string | null>(
      (latest, event) =>
        latest === null || Date.parse(event.at) > Date.parse(latest) ? event.at : latest,
      null,
    );
}
