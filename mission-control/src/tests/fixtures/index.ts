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

import fs from "node:fs";
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

/**
 * Git cannot track empty directories, so the FIXTURE_FRESH tree — whose whole
 * point is an *empty* `factory/ideas/` folder and the *absence* of profile.md /
 * portfolio.md — cannot be committed as static files. We anchor the tree in git
 * with `factory-fresh/factory/.gitkeep` and materialize the empty `ideas/`
 * directory here, at fixture-module load, idempotently. This keeps the fixture
 * available on any clean checkout while leaving `ideas/` genuinely empty.
 */
function ensureFreshFixture(): void {
  const ideasDir = path.join(FIXTURE_FRESH, "factory", "ideas");
  fs.mkdirSync(ideasDir, { recursive: true });
}

ensureFreshFixture();

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
 * NDJSON mixing one project's build events ("alpha", 3 events, earliest) with
 * another project's session noise ("beta", 6 later events). Pins the
 * readEvents project filter running BEFORE the tail cap (FRD-01, 2026-07-01).
 */
export const FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON: string = path.join(
  FIXTURE_EVENTS_DIR,
  "dashboard-events-multiproject-noise.ndjson",
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
