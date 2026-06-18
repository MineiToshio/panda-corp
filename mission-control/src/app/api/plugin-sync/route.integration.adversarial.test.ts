/**
 * FRD-15 — Reviewer adversarial ROUTE INTEGRATION suite (DR-015).
 *
 * The shipped route test (route.test.ts) mocks getPluginSyncState entirely, so it
 * proves the handler's plumbing but NOT that the route returns the REAL verdict
 * computed from disk. This suite invokes the UNMOCKED GET handler against a real
 * temp git repo + real installed_plugins.json via env, exercising route → verdict
 * → readers together (WO-15-003 + WO-15-002 + WO-15-001 integrated).
 *
 * Anchored in:
 *   - AC-15-003.1 (200 + PluginSyncState JSON) over a real probe.
 *   - REQ-15-002 (behind detected end-to-end, body.drift true).
 *   - AC-15-003.4 / REQ-15-005 (a degraded probe → 200, drift false, never 500).
 *   - AC-15-003.3 (no-store header on the live path).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PluginSyncState } from "@/lib/plugin-sync";
// NOTE: no vi.mock — the route uses the real getPluginSyncState here.
import { GET } from "./route";

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeRepoWithPluginCommit(): { root: string; headSha: string } {
  const root = mkTmp("frd15-route-repo-");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const opts = { cwd: root, env, stdio: "ignore" as const };
  execFileSync("git", ["init", "-q"], opts);
  execFileSync("git", ["config", "user.email", "t@t.t"], opts);
  execFileSync("git", ["config", "user.name", "t"], opts);
  fs.mkdirSync(path.join(root, "plugin"));
  fs.writeFileSync(path.join(root, "plugin", "x.txt"), "one\n");
  execFileSync("git", ["add", "."], opts);
  execFileSync("git", ["commit", "-q", "-m", "touch plugin"], opts);
  const headSha = execFileSync("git", ["log", "-1", "--format=%H", "--", "plugin/"], {
    cwd: root,
    encoding: "utf-8",
    env,
  }).trim();
  return { root, headSha };
}

function writeInstalled(home: string, gitCommitSha: string): void {
  const dir = path.join(home, ".claude", "plugins");
  fs.mkdirSync(dir, { recursive: true });
  const body = {
    version: 2,
    plugins: { "pandacorp@panda-corp": [{ scope: "user", version: "9.9.9", gitCommitSha }] },
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
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-route-home-");
    const otherSha = headSha[0] === "0" ? `1${headSha.slice(1)}` : `0${headSha.slice(1)}`;
    writeInstalled(home, otherSha);
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PluginSyncState;
    expect(body.reason).toBe("behind");
    expect(body.drift).toBe(true);
    expect(body.pluginHeadSha).toBe(headSha);
    expect(body.installedSha).toBe(otherSha);
  });

  it("frd-15: REQ-15-004 — in-sync install → 200 with drift:false (banner self-clears)", async () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, headSha);
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PluginSyncState;
    expect(body.drift).toBe(false);
    expect(body.reason).toBe("in-sync");
  });

  it("frd-15: AC-15-003.4/REQ-15-005 — factory root not a git repo → still 200, drift:false, never a 500", async () => {
    const root = mkTmp("frd15-route-nogit-");
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, "a".repeat(40));
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
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-route-home-");
    writeInstalled(home, headSha);
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
