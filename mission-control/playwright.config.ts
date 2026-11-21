import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +
 * Shell-Presence Gate (DR-075) + the Production-Build Smoke (proposal 40, PANDACORP_PROD_SMOKE). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by
 * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret
 * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the
 * gate fails OPEN; DR-056 forbids it). Full-scope verify freezes baselines through
 * PANDACORP_E2E_SNAPSHOTS=none; feature gates keep missing-baseline creation for DR-080 blessing.
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
 * to write nothing a sibling spec reads. The full `verify.sh` uses a single combined run: parallel projects first, then
 * desktop and mobile serial projects in dependency order, sharing one owned server. Serial is the
 * default: a spec that is not listed keeps the determinism above, and with no file nothing changes.
 * The visual gate may never be listed, because pixel baselines require a single worker (DR-056).
 * An optional isolated-specs.json reason object instead permits fixture writers on worker-owned
 * copies/servers from the same build. Only combined production runs activate these slots; manual
 * dev/since runs keep their canonical serial coverage. No inventory, no additional servers.
 *
 * Production-build server (OPTIONAL, DR-143): a project-local `e2e/prod-server.mjs` — seed, never
 * overwritten — takes `build` or `start <port>` and owns the project's fixture environment. The full
 * `verify.sh` builds once and sets PANDACORP_E2E_SERVER=prod; canonical and slot servers share that artifact. Manual
 * and `--since` runs stay on `next dev`, and so does any project without the seed.
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
      ).map(([key, raw]) => {
        const value = key === "PORT" ? String(raw) : raw;
        if (typeof value !== "string") throw new Error(`Invalid server environment: ${key}`);
        return [key, value.startsWith(".") ? path.resolve(value) : value];
      }),
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

// Bootstrap owns only ignored state. Queue gates pin committed identity (auth/media URLs can
// depend on it), while manual worktrees and build lanes take precedence over the shared JSON.
const PORT_FILE = path.resolve(".pandacorp/run/e2e-port");
const privatePort = fs.existsSync(PORT_FILE)
  ? fs.readFileSync(PORT_FILE, "utf8").trim()
  : undefined;
if (
  process.env.PANDACORP_E2E_COMMITTED_PORT !== "1" &&
  privatePort !== undefined &&
  (!/^\d+$/.test(privatePort) || Number(privatePort) < 1 || Number(privatePort) > 65535)
)
  throw new Error("Invalid worktree e2e-port");
const PORT =
  Number(
    process.env.PANDACORP_E2E_COMMITTED_PORT === "1"
      ? serverEnv.PORT
      : (privatePort ?? laneEnv.PORT ?? serverEnv.PORT ?? process.env.PORT),
  ) || 3000;
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
  if (!Array.isArray(specs))
    throw new Error("e2e/parallel-safe.json must be a JSON array of spec paths");
  return specs.map((spec) => {
    if (typeof spec !== "string" || !fs.existsSync(path.resolve("e2e", spec))) {
      throw new Error(`e2e/parallel-safe.json lists a spec that does not exist: ${String(spec)}`);
    }
    if (!/^[\w./-]+\.spec\.[cm]?ts$/.test(spec) || spec.split("/").includes(".."))
      throw new Error(`Unsafe parallel spec path: ${spec}`);
    if (spec === "visual.spec.ts")
      throw new Error("visual.spec.ts must stay on one worker (DR-056)");
    return `**/e2e/${spec}`;
  });
};
const GATE_PROD = process.env.PANDACORP_E2E_SERVER === "prod";
if (GATE_PROD && !fs.existsSync(path.resolve("e2e", "prod-server.mjs"))) {
  throw new Error("PANDACORP_E2E_SERVER=prod needs e2e/prod-server.mjs");
}
const TIER = process.env.PANDACORP_E2E_TIER;
if (TIER !== undefined && TIER !== "parallel" && TIER !== "serial" && TIER !== "combined") {
  throw new Error(`Unknown PANDACORP_E2E_TIER: ${TIER}`);
}
const PARALLEL_SAFE = readParallelSafe();
const ISOLATED_FILE = path.resolve("e2e/isolated-specs.json");
const readIsolated = (): string[] => {
  if (!fs.existsSync(ISOLATED_FILE)) return [];
  const inventory: unknown = JSON.parse(fs.readFileSync(ISOLATED_FILE, "utf8"));
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))
    throw new Error("e2e/isolated-specs.json must be a {spec: reason} object");
  return Object.entries(inventory).map(([spec, reason]) => {
    if (
      !/^[\w./-]+\.spec\.[cm]?ts$/.test(spec) ||
      path.isAbsolute(spec) ||
      spec.split("/").includes("..") ||
      !fs.existsSync(path.resolve("e2e", spec)) ||
      typeof reason !== "string" ||
      !reason.trim()
    )
      throw new Error(`Invalid isolated spec: ${spec}`);
    if (spec === "visual.spec.ts" || PARALLEL_SAFE.includes(`**/e2e/${spec}`))
      throw new Error(`Isolated spec must be disjoint and non-visual: ${spec}`);
    return `**/e2e/${spec}`;
  });
};
const ISOLATED = readIsolated();
const PARALLEL_WORKERS = Number(process.env.PANDACORP_E2E_WORKERS) || 3;
const GLOBAL_SETUP = path.resolve("e2e", "globalSetup.ts");
// An upgrade without a reviewed inventory preserves DR-143's complete mobile selection.
// Reviewed inventories exclude only named duplicates; unknown/new specs stay on mobile.
const MOBILE_FILE = path.resolve("e2e", "mobile-specs.json");
const MOBILE_CORE = ["smoke.spec.ts", "visual.spec.ts", "responsive.spec.ts"];
const LEGACY_MOBILE_IGNORE = ["shell.spec.ts", "headers.spec.ts", "hydration.spec.ts"];
const readMobileExclusions = (): string[] => {
  if (!fs.existsSync(MOBILE_FILE)) return LEGACY_MOBILE_IGNORE;
  const inventory: unknown = JSON.parse(fs.readFileSync(MOBILE_FILE, "utf8"));
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))
    throw new Error(
      "e2e/mobile-specs.json needs a reviewed {include, desktopOnly, review} inventory",
    );
  const { include, desktopOnly, review, ...unknown } = inventory as Record<string, unknown>;
  if (
    !Array.isArray(include) ||
    !Array.isArray(desktopOnly) ||
    Object.keys(unknown).length ||
    typeof review !== "string" ||
    !/^docs\/reviews\/[\w./-]+\.md$/.test(review) ||
    review.split("/").includes("..") ||
    !fs.existsSync(path.resolve(review))
  )
    throw new Error(
      "Mobile coverage reductions require a valid review document and classified spec lists",
    );
  for (const spec of [...include, ...desktopOnly]) {
    if (
      typeof spec !== "string" ||
      !/^[\w./-]+\.spec\.[cm]?ts$/.test(spec) ||
      spec.split("/").includes("..") ||
      !fs.existsSync(path.resolve("e2e", spec))
    )
      throw new Error(`Invalid mobile spec: ${String(spec)}`);
  }
  if (desktopOnly.some((spec) => include.includes(spec) || MOBILE_CORE.includes(spec)))
    throw new Error("Mobile core and included specs cannot be excluded");
  return desktopOnly as string[];
};
const MOBILE_IGNORE = readMobileExclusions().map((spec) => `**/e2e/${spec}`);
const MOBILE_PARALLEL = PARALLEL_SAFE.filter((spec) => !MOBILE_IGNORE.includes(spec));
const COMBINED = TIER === "combined" && (PARALLEL_SAFE.length > 0 || ISOLATED.length > 0);
const DIAGNOSTIC = process.env.PANDACORP_VERIFY_NO_BAIL === "1";
const WORKERS = COMBINED && DIAGNOSTIC ? 1 : PARALLEL_WORKERS;
const SLOTS = GATE_PROD && COMBINED && ISOLATED.length > 0;
const slotPorts = SLOTS
  ? process.env.PANDACORP_E2E_SLOT_PORTS
    ? process.env.PANDACORP_E2E_SLOT_PORTS.split(",").map((port) => {
        if (!/^\d+$/.test(port)) throw new Error("Invalid slot port");
        return Number(port);
      })
    : Array.from({ length: WORKERS }, (_, index) => PORT + index + 1)
  : [];
if (
  SLOTS &&
  (slotPorts.length !== WORKERS ||
    new Set(slotPorts).size !== WORKERS ||
    slotPorts.some((port) => !Number.isInteger(port) || port < 1 || port > 65535 || port === PORT))
)
  throw new Error(
    "Slot ports must be distinct, valid, match worker count and exclude canonical PORT",
  );
if (SLOTS) process.env.PANDACORP_E2E_SLOTS = String(WORKERS);
else delete process.env.PANDACORP_E2E_SLOTS;
const slotIndex = process.env.TEST_PARALLEL_INDEX;
if (SLOTS && slotIndex !== undefined && (!/^\d+$/.test(slotIndex) || Number(slotIndex) >= WORKERS))
  throw new Error("Invalid TEST_PARALLEL_INDEX for isolated slots");
const SLOT_URL =
  slotIndex === undefined ? BASE_URL : `http://127.0.0.1:${slotPorts[Number(slotIndex)]}`;
const TIER_IGNORE = [
  ...(TIER === "serial" || TIER === "combined" ? PARALLEL_SAFE : []),
  ...(SLOTS ? ISOLATED : []),
];
// Dependencies require SUCCESS, so diagnostics omit them and use one global worker.
// All projects then run even on red, without overlapping shared-state readers/writers.
const parallelProjects: (Project & { name: string })[] = COMBINED
  ? [
      {
        name: "desktop-parallel",
        testMatch: PARALLEL_SAFE,
        use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      },
      {
        name: "mobile-parallel",
        testMatch: MOBILE_PARALLEL,
        use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
      },
    ]
  : [];
if (SLOTS) {
  parallelProjects.push(
    {
      name: "desktop-isolated",
      testMatch: ISOLATED,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        baseURL: SLOT_URL,
      },
    },
    {
      name: "mobile-isolated",
      testMatch: ISOLATED.filter((spec) => !MOBILE_IGNORE.includes(spec)),
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        baseURL: SLOT_URL,
      },
    },
  );
}
const canonicalServer = {
  command: GATE_PROD
    ? `node e2e/prod-server.mjs start ${PORT}`
    : PROD_SMOKE
      ? `next build && next start --hostname 127.0.0.1 --port ${PORT}`
      : `next dev --hostname 127.0.0.1 --port ${PORT}`,
  url: BASE_URL,
  reuseExistingServer:
    process.env.PANDACORP_E2E_CERTIFICATION !== "1" &&
    !PROD_SMOKE &&
    !GATE_PROD &&
    !LANE &&
    !isCI &&
    Object.keys(serverEnv).length === 0,
  timeout: PROD_SMOKE ? 600_000 : 180_000,
  env: serverEnv,
};

export default defineConfig({
  testDir: "./e2e",
  ...(TIER === "parallel" ? { testMatch: PARALLEL_SAFE } : {}),
  ...(fs.existsSync(GLOBAL_SETUP) ? { globalSetup: "./e2e/globalSetup.ts" } : {}),
  fullyParallel: false,
  workers: TIER === "parallel" || COMBINED ? WORKERS : 1,
  maxFailures: process.env.PANDACORP_E2E_CERTIFICATION === "1" && !DIAGNOSTIC ? 1 : 0,
  forbidOnly: isCI,
  retries: 0,
  reporter: [["list"]],
  updateSnapshots: process.env.PANDACORP_E2E_SNAPSHOTS === "none" ? "none" : "missing",
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
    ...parallelProjects,
    {
      name: "desktop",
      ...(COMBINED
        ? {
            workers: 1,
            ...(DIAGNOSTIC
              ? {}
              : { dependencies: parallelProjects.map((project) => project.name) }),
          }
        : {}),
      testIgnore: TIER_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      ...(TIER === "parallel" ? { testMatch: MOBILE_PARALLEL } : {}),
      testIgnore: [...TIER_IGNORE, ...MOBILE_IGNORE],
      ...(COMBINED ? { workers: 1, ...(DIAGNOSTIC ? {} : { dependencies: ["desktop"] }) } : {}),
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: SLOTS
    ? [
        canonicalServer,
        ...slotPorts.map((port, index) => ({
          ...canonicalServer,
          command: `node e2e/prod-server.mjs start ${port} --slot ${index}`,
          url: `http://127.0.0.1:${port}`,
          reuseExistingServer: false,
        })),
      ]
    : canonicalServer,
});
