/**
 * FRD-15 — Reviewer adversarial ROUTE INTEGRATION suite (DR-015).
 *
 * The shipped route test (route.test.ts) mocks getPluginSyncState entirely, so it
 * proves the handler's plumbing but NOT that the route returns the REAL verdict
 * computed from disk. This suite invokes the UNMOCKED GET handler against a real
 * temp factory root (plugin/.claude-plugin/plugin.json) + real
 * installed_plugins.json via env, exercising route → verdict → readers together
 * (WO-15-003 + WO-15-002 + WO-15-001 integrated).
 *
 * Version-based drift (FRD-15): the verdict compares the installed semver `version`
 * against the source `version` — no git, no SHA, no dirty check.
 *
 * Anchored in:
 *   - AC-15-003.1 (200 + PluginSyncState JSON) over a real probe.
 *   - REQ-15-002 (behind detected end-to-end, body.drift true).
 *   - AC-15-003.4 / REQ-15-005 (a degraded probe → 200, drift false, never 500).
 *   - AC-15-003.3 (no-store header on the live path).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";
// NOTE: no vi.mock — the route uses the real getPluginSyncState here.
import { GET } from "../route";

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Build a factory root whose plugin manifest declares the given source `version`. */
function makeFactoryRootWithVersion(sourceVersion: string): { root: string } {
  const root = mkTmp("frd15-route-root-");
  const manifestDir = path.join(root, "plugin", ".claude-plugin");
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, "plugin.json"),
    JSON.stringify({ name: "pandacorp", version: sourceVersion }),
  );
  return { root };
}

/** Write an installed_plugins.json declaring the given installed semver `version`. */
function writeInstalled(home: string, installedVersion: string): void {
  const dir = path.join(home, ".claude", "plugins");
  fs.mkdirSync(dir, { recursive: true });
  const body = {
    version: 2,
    plugins: { "pandacorp@panda-corp": [{ scope: "user", version: installedVersion }] },
  };
  fs.writeFileSync(path.join(dir, "installed_plugins.json"), JSON.stringify(body));
}

let savedFactoryRoot: string | undefined;
let savedHome: string | undefined;
let savedUserProfile: string | undefined;

beforeEach(() => {
  savedFactoryRoot = process.env.PANDACORP_FACTORY_ROOT;
  savedHome = process.env.HOME;
  savedUserProfile = process.env.USERPROFILE;
});

afterEach(() => {
  if (savedFactoryRoot === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = savedFactoryRoot;
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = savedUserProfile;
});

describe("frd-15 route integration (reviewer): GET returns the REAL verdict (unmocked)", () => {
  it("frd-15: AC-15-003.1/REQ-15-002 — behind install → 200 with drift:true and reason:'behind' in the live body", async () => {
    const { root } = makeFactoryRootWithVersion("8.43.0");
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, "8.42.0");
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PluginSyncState;
    expect(body.reason).toBe("behind");
    expect(body.drift).toBe(true);
    expect(body.sourceVersion).toBe("8.43.0");
    expect(body.installedVersion).toBe("8.42.0");
  });

  it("frd-15: REQ-15-004 — in-sync install → 200 with drift:false (banner self-clears)", async () => {
    const { root } = makeFactoryRootWithVersion("8.42.0");
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, "8.42.0");
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PluginSyncState;
    expect(body.drift).toBe(false);
    expect(body.reason).toBe("in-sync");
  });

  it("frd-15: AC-15-003.4/REQ-15-005 — source manifest missing → still 200, drift:false, never a 500", async () => {
    const root = mkTmp("frd15-route-nomanifest-");
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, "8.42.0");
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PluginSyncState;
    expect(body.drift).toBe(false);
    expect(body.reason).toBe("unknown");
  });

  it("frd-15: AC-15-003.3 — the live response carries Cache-Control: no-store", () => {
    const { root } = makeFactoryRootWithVersion("8.42.0");
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, "8.42.0");
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
