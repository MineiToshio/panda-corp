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
import { mergeLedgerOutcomes, readLedger } from "./ledger";

/**
 * Everything the guild surfaces need, derived once from the live data layers.
 * Consumers take what they need — but the `level` shown anywhere is THIS `level`.
 */
export type GuildState = {
  /** Per-project status, read with each portfolio path resolved to absolute. */
  readonly statuses: readonly StatusResult[];
  /** The dashboard-events snapshot (shared so consumers don't re-read it). */
  readonly eventsSnapshot: EventsSnapshot;
  /**
   * The raw live outcomes derived from the current portfolio state, BEFORE the
   * ledger merge. Exposed so `GamificationLedgerSync` can pass them to the
   * snapshot action — which itself applies MAX(live, ledger) and writes only when
   * the live value genuinely exceeds the stored maximum (AC-09-006.2).
   * Passing the pre-merged outcomes to the action would cause `needsSnapshot` to
   * never fire (it would see ledger values as "live"), breaking the snapshot logic.
   */
  readonly liveOutcomes: GuildOutcomes;
  /**
   * The ledger-merged outcomes: MAX(live, ledger) for each metric (AC-09-006.1).
   * This is what feeds `level` — deleting a project never decreases XP/level.
   */
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

  // Live outcomes from the current portfolio state.
  const liveOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });

  // WO-09-006 — ledger merge: MAX(live, ledger) so deleting a project NEVER
  // decreases the guild's XP or level (AC-09-006.1).
  // readLedger returns zero-totals if the file is absent or malformed (AC-09-006.3).
  const ledger = readLedger();
  const outcomes = mergeLedgerOutcomes(liveOutcomes, ledger);

  const level = computeGuildLevel(outcomes);
  return { statuses, eventsSnapshot, liveOutcomes, outcomes, level };
}

/**
 * Request-cached accessor — call this from Server Components. Within one request
 * the underlying reads run once and every caller gets the identical guild state.
 */
export const getGuildState = cache(readGuildState);
