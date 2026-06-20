/**
 * Fixture path constants and test harness for FRD-01 (WO-01-000).
 *
 * Usage:
 *   import { FIXTURE_FULL, FIXTURE_FRESH, FIXTURE_EVENTS, withFactoryRoot } from "./index";
 *
 * All paths are absolute so tests are location-independent.
 * `withFactoryRoot` sets/restores PANDACORP_FACTORY_ROOT around a test callback,
 * enabling isolation of every lib/ reader.
 */

import path from "node:path";

/** Absolute path to the fixtures directory (this folder). */
export const FIXTURES_DIR: string = path.resolve(import.meta.dirname);

/**
 * Personalized factory fixture: profile.md present, full ideas set (all statuses
 * including malformed), portfolio with three rows (full, missing-repo, broken-path),
 * proj-a with complete status + docs + .pandacorp/ comms, proj-b with malformed YAML.
 *
 * Use this for: happy-path reads, tolerance tests, in-pipeline phase derivation.
 */
export const FIXTURE_FULL: string = path.join(FIXTURES_DIR, "factory-full");

/**
 * Fresh factory fixture: NO profile.md, empty ideas folder.
 *
 * Use this for: onboarding-gate trigger, empty-ideas edge case.
 */
export const FIXTURE_FRESH: string = path.join(FIXTURES_DIR, "factory-fresh");

/** Absolute path to the events fixture directory. */
export const FIXTURE_EVENTS_DIR: string = path.join(FIXTURES_DIR, "events");

/** NDJSON with 10 valid events (with + without `project`), 1 malformed line. */
export const FIXTURE_EVENTS_NDJSON: string = path.join(
  FIXTURE_EVENTS_DIR,
  "dashboard-events.ndjson",
);

/** Empty NDJSON file (0 bytes). */
export const FIXTURE_EVENTS_EMPTY_NDJSON: string = path.join(
  FIXTURE_EVENTS_DIR,
  "dashboard-events-empty.ndjson",
);

/**
 * NDJSON with enriched AgentWorking events carrying {frd, wo, phase, activity, mode, role}.
 * Used for toFraguaSnapshot tests (WO-06-005 La Fragua redesign).
 * Contains 9 valid events (including 2 achievements/VERIFIED), 1 malformed line.
 */
export const FIXTURE_EVENTS_ENRICHED_NDJSON: string = path.join(
  FIXTURE_EVENTS_DIR,
  "dashboard-events-enriched.ndjson",
);

/**
 * Sets `PANDACORP_FACTORY_ROOT` to `fixturePath`, runs `fn`, then restores
 * the prior value (or deletes the var if it was not set).
 *
 * Synchronous wrapper — fn may be async; await the returned Promise.
 *
 *   await withFactoryRoot(FIXTURE_FULL, async () => {
 *     // resolveFactoryRoot() now returns FIXTURE_FULL
 *   });
 */
export async function withFactoryRoot<T>(
  fixturePath: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prior = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = fixturePath;
  try {
    return await fn();
  } finally {
    if (prior === undefined) {
      delete process.env.PANDACORP_FACTORY_ROOT;
    } else {
      process.env.PANDACORP_FACTORY_ROOT = prior;
    }
  }
}
