import { defineConfig, devices } from "@playwright/test";

/**
 * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074).
 * VERBATIM stack template (DR-059) — installed at the project ROOT, conformance-checked by
 * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret
 * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the
 * gate fails OPEN; DR-056 forbids it). In CI baselines are frozen (`updateSnapshots:'none'`);
 * locally a NEW route's baseline is written once and must then be reviewed/blessed by the FRD gate.
 *
 * The dev server runs on the project's reserved dev port (factory/standards/infra.md). Adjust PORT
 * to this project's `dev_port_base` if it differs from the default below.
 */
const isCI = Boolean(process.env.CI);
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  reporter: [["list"]],
  updateSnapshots: isCI ? "none" : "missing",
  use: { baseURL: BASE_URL, trace: "off" },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
