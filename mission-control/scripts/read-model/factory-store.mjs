/**
 * scripts/read-model/factory-store.mjs — the factory-store writer CLI (FRD-23, WO-23-005, REQ-23-006.1).
 *
 * Thin CLI over the SINGLE factory-store writer (`writeStatsFactory`, DR-115): it re-derives the
 * factory-wide facts (`phaseTransitions`, `scalars.{projects,decisions}`, `lessons`) ONCE via the
 * report cores and writes them atomically to `<factory-root>/.pandacorp/stats-factory.json` with its
 * own factory-wide freshness seal. This is the write-side counterpart of `sync-aggregate` (which joins
 * the per-project portadas): `sync-portfolio` runs it BEFORE the join so the factory store is fresh,
 * and it is the CLI a future universal per-commit trigger will call (architecture §7, ADR-0004).
 *
 * The factory root is resolved by `resolveFactoryRoot()` (env override `PANDACORP_FACTORY_ROOT`, else
 * one level up from cwd — the same config semantics MC's readers use).
 *
 * Run from the Mission Control repo root:
 *   node --loader ./scripts/read-model/ts-loader.mjs scripts/read-model/factory-store.mjs
 *
 * Degrades honestly (resilience + DR-078), exactly like `regen`: if the factory-wide numbers cannot
 * be derived from git (`FactoryDeriveError` — git unavailable / un-derivable phaseTransitions), it
 * prints a skip note and exits 0 (the composed reader's live-git fallback covers the gap) rather than
 * baking a fabricated "no activity" into the cache. Any other error propagates (non-zero exit) so it
 * is never silently swallowed.
 */

import {
  FactoryDeriveError,
  writeStatsFactory,
} from "../../src/lib/achievements/read-model/factoryStoreWriter.ts";
import { resolveFactoryRoot } from "../../src/lib/config/config.ts";

function main() {
  const factoryRoot = resolveFactoryRoot();
  try {
    const written = writeStatsFactory(factoryRoot);
    process.stdout.write(`factory-store: wrote ${written}\n`);
  } catch (error) {
    if (error instanceof FactoryDeriveError) {
      // Honest degrade — never materialize a fabricated zero; MC falls back to live git factory-wide.
      process.stdout.write(
        `factory-store: skipped ${factoryRoot} (${error.message}) — live-git fallback covers it\n`,
      );
      return;
    }
    throw error;
  }
}

main();
