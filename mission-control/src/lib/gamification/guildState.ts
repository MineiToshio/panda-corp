/**
 * Guild state — THE single source of truth for the guild's level / rank / XP.
 *
 * Every surface that shows the guild's level (the cross-cutting GuildBar in
 * `app/layout.tsx`, the Inicio dashboard, the Logros GuildHero) MUST read it
 * from here — never re-derive `deriveGuildOutcomes` + `computeGuildLevel` on its
 * own. Three independent derivations is exactly how the header once showed
 * "NV 3 Oficial" while Logros showed "Nivel 1 Aprendiz" (one call site passed an
 * unresolved portfolio path to `readStatus`). One reader, one truth.
 *
 * The read is wrapped in React's `cache()` so the portfolio→status→events
 * traversal runs once per request and every consumer in that request gets the
 * exact same object.
 *
 * Read-only: `readPortfolio` + `readStatus` + `readEvents` — no writes, no Claude.
 *
 * Traceability: FRD-09 (gamification) — CMP-09-guild-state.
 */

import { cache } from "react";
import { resolveProjectPath } from "@/lib/config/config";
import { type EventsSnapshot, readEvents } from "@/lib/events/events";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatus, type StatusResult } from "@/lib/status/status";
import {
  computeGuildLevel,
  deriveGuildOutcomes,
  type GuildLevel,
  type GuildOutcomes,
} from "./gamification";

/**
 * Everything the guild surfaces need, derived once from the live data layers.
 * Consumers take what they need — but the `level` shown anywhere is THIS `level`.
 */
export type GuildState = {
  /** Per-project status, read with each portfolio path resolved to absolute. */
  readonly statuses: readonly StatusResult[];
  /** The dashboard-events snapshot (shared so consumers don't re-read it). */
  readonly eventsSnapshot: EventsSnapshot;
  /** The guild outcomes feeding the level (products shipped, work orders, …). */
  readonly outcomes: GuildOutcomes;
  /** The single guild level / rank / XP shown across the whole app. */
  readonly level: GuildLevel;
};

/**
 * Uncached core: reads the live data layers and derives the guild state.
 *
 * Exported so tests can exercise it without React's request-scoped `cache`
 * (which would memoize the first call across test fixtures). Production code
 * should use {@link getGuildState}.
 */
export function readGuildState(): GuildState {
  // The portfolio path is factory-root-relative (e.g. "mission-control"); it MUST
  // be resolved before readStatus, or every project reads ABSENT (the original bug).
  const statuses = readPortfolio().map((entry) => readStatus(resolveProjectPath(entry.path)));
  const eventsSnapshot = readEvents();
  const outcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });
  const level = computeGuildLevel(outcomes);
  return { statuses, eventsSnapshot, outcomes, level };
}

/**
 * Request-cached accessor — call this from Server Components. Within one request
 * the underlying reads run once and every caller gets the identical guild state.
 */
export const getGuildState = cache(readGuildState);
