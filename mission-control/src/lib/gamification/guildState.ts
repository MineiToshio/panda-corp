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
 * Read-only: `readPortfolio` + `readStatusWithLiveInboxCounts` + `readEvents` +
 * `listWorkOrders` (for the live workOrdersDone total, DR-115) — no writes, no Claude.
 *
 * Traceability: FRD-09 (gamification) — CMP-09-guild-state.
 */

import path from "node:path";
import { cache } from "react";
import { resolveProjectPath } from "@/lib/config/config";
import { type EventsSnapshot, readEvents } from "@/lib/events/events";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatusWithLiveInboxCounts, type StatusResult } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import {
  computeGuildLevel,
  deriveGuildOutcomes,
  type GuildLevel,
  type GuildOutcomes,
} from "./gamification";
import { mergeLedgerOutcomes, readLedger, realInProject } from "./ledger";

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
   * ledger merge. Exposed for read-only presentation/diagnostics only. The
   * snapshot action re-reads canonical files server-side and never accepts this
   * aggregate from a client.
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
  const portfolioPaths = readPortfolio().map((entry) => resolveProjectPath(entry.path));
  const statuses = portfolioPaths.map((absPath) =>
    realInProject(absPath, path.join(absPath, ".pandacorp", "status.yaml"), "file")
      ? readStatusWithLiveInboxCounts(absPath)
      : { present: false as const, malformed: false as const, status: null },
  );
  const eventsSnapshot = readEvents();

  // workOrdersDone: LIVE count of WOs in state "done", summed across the whole portfolio
  // (DR-092/DR-115) — never status.yaml's cached work_orders_done counter, which drifts
  // the moment a WO is added/reopened/closed without a build-engine write happening.
  const workOrdersDoneLive = portfolioPaths.reduce(
    (sum, absPath) => sum + listWorkOrders(absPath).filter((wo) => wo.state === "done").length,
    0,
  );

  // Live outcomes from the current portfolio state.
  // Raw transports are live telemetry, not an accounting oracle. Event-derived
  // XP enters only through the durable ledger reconciler.
  const liveOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot: null, workOrdersDoneLive });

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
