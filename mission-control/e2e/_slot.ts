import path from "node:path";

export const CANONICAL_FACTORY_ROOT = path.resolve("e2e/fixtures/factory-root");
const slots = Number(process.env.PANDACORP_E2E_SLOTS || 0);
const index = process.env.TEST_PARALLEL_INDEX;
if (slots > 0 && index !== undefined && (!/^\d+$/.test(index) || Number(index) >= slots))
  throw new Error("Fixture slot index is outside the configured worker pool");

// Resolved at worker import time, after Playwright reloads the config for parallelIndex.
// Wave-2 serial navigation explicitly uses CANONICAL_FACTORY_ROOT until its isolation audit.
export const FIXTURES =
  slots > 0 && index !== undefined
    ? path.resolve("test-results/e2e-slots", index, "fixtures")
    : path.resolve("e2e/fixtures");
export const FACTORY_ROOT = path.join(FIXTURES, "factory-root");
