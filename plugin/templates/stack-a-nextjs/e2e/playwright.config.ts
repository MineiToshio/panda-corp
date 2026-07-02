import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +
 * Shell-Presence Gate (DR-075). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by
 * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret
 * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the
 * gate fails OPEN; DR-056 forbids it). In CI baselines are frozen (`updateSnapshots:'none'`);
 * locally a NEW route's baseline is written once and must then be reviewed/blessed by the FRD gate.
 *
 * The dev server runs on the project's reserved dev port (factory/standards/infra.md). Adjust PORT
 * to this project's `dev_port_base` if it differs from the default below.
 *
 * Deterministic data sources (OPTIONAL): a project-local `e2e/server-env.json` — never part of the
 * template, never overwritten by /pandacorp:upgrade — is injected into the webServer environment.
 * It is the hook for pinning the app's data sources to frozen fixtures so LIVE data can never move
 * gate pixels. Values starting with "." resolve against the project root; a `PORT` entry moves the
 * e2e server to its own port. When the file is present the server is NEVER reused — an
 * already-running dev server would read live data instead of the pinned fixture.
 */
const isCI = Boolean(process.env.CI);

const SERVER_ENV_FILE = path.resolve("e2e", "server-env.json");
const serverEnv: Record<string, string> = fs.existsSync(SERVER_ENV_FILE)
  ? Object.fromEntries(
      Object.entries(
        JSON.parse(fs.readFileSync(SERVER_ENV_FILE, "utf8")) as Record<string, string>,
      ).map(([key, value]) => [key, value.startsWith(".") ? path.resolve(value) : value]),
    )
  : {};

const PORT = Number(serverEnv.PORT ?? process.env.PORT) || 3000;
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
    reuseExistingServer: !isCI && Object.keys(serverEnv).length === 0,
    timeout: 180_000,
    env: serverEnv,
  },
});
