/**
 * lib/achievements/readerData.ts — The reader-input aggregate (FRD-10)
 *
 * Extracted into its own module so both `stats.ts` (which imports `signals.ts`) and
 * `signals.ts` can depend on the `ReaderData` type WITHOUT forming an import cycle
 * (stats → signals → stats). Pure type module; no runtime, no I/O.
 */

import type { Event, EventsSnapshot } from "../events/events";
import type { IdeaCard } from "../ideas/ideas";
import type { StatusResult } from "../status/status";

/**
 * All reader data consumed by the achievements engine.
 *
 * Every field is already-read data; no I/O happens inside the engine.
 * Blueprint §2 honesty contract: each field maps to a verifiable source.
 */
export type ReaderData = {
  /** All idea cards from factory/ideas/ (FRD-01 lib/ideas.ts) */
  readonly ideas: readonly IdeaCard[];
  /** Status results for every portfolio project (FRD-01/03 lib/status.ts / lib/portfolio.ts) */
  readonly statuses: readonly StatusResult[];
  /** Event snapshot from dashboard-events.ndjson (FRD-06 lib/events.ts) */
  readonly eventsSnapshot: EventsSnapshot | null;
  /**
   * Corroborated, durable result events. Production always supplies this field;
   * its presence (including an empty array) excludes untrusted live telemetry
   * from XP and durable achievement predicates. Production omission fails closed
   * to empty; raw fallback exists only under NODE_ENV=test for old pure fixtures.
   */
  readonly durableEvents?: readonly Event[];
  /**
   * LIVE total of work orders in state "done", summed across the whole portfolio
   * (DR-092/DR-115: `getGuildState().liveOutcomes.workOrdersDone`, itself derived from
   * `listWorkOrders`/`aggregateProgress` — never `status.yaml`'s cached counter, which
   * was removed from `ProjectStatus`). Optional/omitted → 0 (honest zero, fail-soft
   * for test fixtures that don't exercise this signal).
   */
  readonly workOrdersDoneLive?: number;
};
