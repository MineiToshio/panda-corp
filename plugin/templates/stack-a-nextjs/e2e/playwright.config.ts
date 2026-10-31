import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +
 * Shell-Presence Gate (DR-075) + the Production-Build Smoke (proposal 40, PANDACORP_PROD_SMOKE). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by
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
 *
 * Parallel tier (OPTIONAL, DR-143): a project-local `e2e/parallel-safe.json` — never part of the
 * template, never overwritten by /pandacorp:upgrade — lists the spec files (relative to e2e/) proven
 * to write nothing a sibling spec reads. The full `verify.sh` runs them first on several workers
 * (PANDACORP_E2E_TIER=parallel), then everything else on one (PANDACORP_E2E_TIER=serial). Serial is the
 * default: a spec that is not listed keeps the determinism above, and with no file nothing changes.
 * The visual gate may never be listed, because pixel baselines require a single worker (DR-056).
 *
 * A project-local `e2e/globalSetup.ts` (optional, seed) is wired in when present, so a project can
 * hold a machine-wide test lease without forking this file.
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

// Build lanes (proposal 40 Phase B): a lane worktree carries its own `.pandacorp/run/lane.env` (PANDACORP_LANE and the
// lane's PORT), written by the build engine. It is read from DISK, not only from the shell env: a builder's fresh shell
// never sourced it, and an e2e on the default port would test a sibling lane's (or main's) server.
const LANE_ENV_FILE = path.resolve(".pandacorp", "run", "lane.env");
const laneEnv: Record<string, string> = fs.existsSync(LANE_ENV_FILE)
  ? Object.fromEntries(
      fs
        .readFileSync(LANE_ENV_FILE, "utf8")
        .split("\n")
        .map((line) => /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim()))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => [m[1], m[2]]),
    )
  : {};

const PORT = Number(serverEnv.PORT ?? laneEnv.PORT ?? process.env.PORT) || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Production-Build Smoke (proposal 40): the build engine sets PANDACORP_PROD_SMOKE in a detached worktree, so the
// server is the production artifact (`next build && next start`, its real CSP), never a reused dev server.
const PROD_SMOKE = Boolean(process.env.PANDACORP_PROD_SMOKE);
// In a lane (its lane.env, or PANDACORP_LANE in the env) the e2e never reuses a server a sibling lane or main left running.
const LANE = Boolean(laneEnv.PANDACORP_LANE || process.env.PANDACORP_LANE);

const PARALLEL_SAFE_FILE = path.resolve("e2e", "parallel-safe.json");
const readParallelSafe = (): string[] => {
  if (!fs.existsSync(PARALLEL_SAFE_FILE)) return [];
  const specs: unknown = JSON.parse(fs.readFileSync(PARALLEL_SAFE_FILE, "utf8"));
  if (!Array.isArray(specs)) throw new Error("e2e/parallel-safe.json must be a JSON array of spec paths");
  return specs.map((spec) => {
    if (typeof spec !== "string" || !fs.existsSync(path.resolve("e2e", spec))) {
      throw new Error(`e2e/parallel-safe.json lists a spec that does not exist: ${String(spec)}`);
    }
    if (spec === "visual.spec.ts") throw new Error("visual.spec.ts must stay on one worker (DR-056)");
    return `**/e2e/${spec}`;
  });
};
const TIER = process.env.PANDACORP_E2E_TIER;
if (TIER !== undefined && TIER !== "parallel" && TIER !== "serial") {
  throw new Error(`Unknown PANDACORP_E2E_TIER: ${TIER}`);
}
const PARALLEL_SAFE = readParallelSafe();
const PARALLEL_WORKERS = Number(process.env.PANDACORP_E2E_WORKERS) || 3;
const GLOBAL_SETUP = path.resolve("e2e", "globalSetup.ts");
// Each of these specs sets its own viewport or never renders one, so a second project repeats them.
const VIEWPORT_AGNOSTIC = ["**/e2e/shell.spec.ts", "**/e2e/headers.spec.ts", "**/e2e/hydration.spec.ts"];
const TIER_IGNORE = TIER === "serial" ? PARALLEL_SAFE : [];

export default defineConfig({
  testDir: "./e2e",
  ...(TIER === "parallel" ? { testMatch: PARALLEL_SAFE } : {}),
  ...(fs.existsSync(GLOBAL_SETUP) ? { globalSetup: "./e2e/globalSetup.ts" } : {}),
  fullyParallel: false,
  workers: TIER === "parallel" ? PARALLEL_WORKERS : 1,
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
      testIgnore: TIER_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      testIgnore: [...TIER_IGNORE, ...VIEWPORT_AGNOSTIC],
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: PROD_SMOKE
      ? `next build && next start --hostname 127.0.0.1 --port ${PORT}`
      : `next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !PROD_SMOKE && !LANE && !isCI && Object.keys(serverEnv).length === 0,
    timeout: PROD_SMOKE ? 600_000 : 180_000,
    env: serverEnv,
  },
});
