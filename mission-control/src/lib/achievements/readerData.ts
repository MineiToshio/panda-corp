/**
 * lib/achievements/readerData.ts — The reader-input aggregate (FRD-10)
 *
 * Extracted into its own module so both `stats.ts` (which imports `signals.ts`) and
 * `signals.ts` can depend on the `ReaderData` type WITHOUT forming an import cycle
 * (stats → signals → stats). Pure type module; no runtime, no I/O.
 */

import type { EventsSnapshot } from "../events/events";
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
};
