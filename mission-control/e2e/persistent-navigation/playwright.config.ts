import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 4902);
const fixture = path.resolve("test-results/navigation-fixture");
const temporary = path.resolve("test-results/navigation-tmp");
const production = process.env.PANDACORP_PROD_SMOKE === "1";
const endpoint = process.env.PW_TEST_CONNECT_WS_ENDPOINT;

// Config is also loaded in workers: assign paths here, copy files only in the server command.
process.env.NAVIGATION_TEST_FACTORY_ROOT = fixture;
process.env.TMPDIR = temporary;

export default defineConfig({
  testDir: path.resolve("e2e"),
  testMatch: ["persistent-navigation.spec.ts", "persistent-navigation/history-race.spec.ts"],
  grep: /post-build registration|canonical WO defaults|shallow views|live first frame|canonical WO URL|Back to Documents|throttled live refresh/,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 60_000 },
  reporter: "list",
  outputDir: path.resolve("test-results/navigation-results"),
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    navigationTimeout: 120_000,
    actionTimeout: 60_000,
    ...(endpoint ? { connectOptions: { wsEndpoint: endpoint } } : {}),
  },
  webServer: {
    cwd: process.cwd(),
    command: `node e2e/persistent-navigation/prepare-fixture.mjs && ${
      production ? "pnpm exec next build && pnpm exec next start" : "pnpm exec next dev --webpack"
    } -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 600_000,
    env: {
      PANDACORP_FACTORY_ROOT: fixture,
      PANDACORP_EVENTS_FILE: path.join(fixture, "events.ndjson"),
      TMPDIR: temporary,
      WATCHPACK_POLLING: "true",
    },
  },
});
