"use server";
/**
 * snapshotGamificationLedger — Server Action (WO-09-006, AC-09-006.2)
 *
 * Fire-and-forget write: when any live metric exceeds the stored ledger value,
 * updates the ledger to the new maximum. Called from `GamificationLedgerSync`
 * (a "use client" component) on mount — after the page has already rendered so
 * this write NEVER blocks the render or increases Time to First Byte.
 *
 * Write path: `factory/gamification-ledger.json` (resolved via `resolveFactoryRoot()`).
 * Gitignored — personal data (DR-033, AC-09-006.3).
 *
 * Atomicity: read → compare via `needsSnapshot` → write only if needed. The JSON
 * file is small enough that a single `writeFileSync` is effectively atomic on a
 * local filesystem (no partial-write window; process crash leaves the old file
 * intact or replaces it wholly).
 *
 * Traceability:
 *   AC-09-006.2 — writes only when live metric exceeds ledger (snapshot-on-exceed)
 *   AC-09-006.3 — resolves to factory/gamification-ledger.json (gitignored)
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveFactoryRoot } from "@/lib/config/config";
import type { GuildOutcomes } from "@/lib/gamification/gamification";
import {
  type GamificationLedger,
  mergeLedgerOutcomes,
  needsSnapshot,
  readLedger,
} from "@/lib/gamification/ledger";

/**
 * Snapshot the gamification ledger with the current live outcomes.
 *
 * Reads the existing ledger (absent → zero-totals), merges with live outcomes via
 * `MAX(live, ledger)`, and writes back only when at least one metric has increased.
 *
 * Resolves to `void` — callers must not await or depend on the result.
 * Any I/O error is silently swallowed (fire-and-forget; never crashes the page).
 *
 * @param live  The live `GuildOutcomes` derived from the current portfolio state.
 */
export async function snapshotGamificationLedger(live: GuildOutcomes): Promise<void> {
  try {
    const ledgerPath = join(resolveFactoryRoot(), "factory", "gamification-ledger.json");
    const existing = readLedger(ledgerPath);

    if (!needsSnapshot(live, existing)) {
      // Live values are already at or below the stored ledger — no write needed.
      return;
    }

    const merged = mergeLedgerOutcomes(live, existing);
    const newLedger: GamificationLedger = {
      version: 1,
      updatedAt: new Date().toISOString(),
      totals: {
        workOrdersDone: merged.workOrdersDone,
        phasesCompleted: merged.phasesCompleted,
        releases: merged.releases,
      },
    };

    writeFileSync(ledgerPath, JSON.stringify(newLedger, null, 2), "utf8");
  } catch {
    // Fire-and-forget: silently swallow any I/O error.
    // The page has already rendered; a write failure must never crash it.
  }
}
