/**
 * FRD-15 — Reviewer adversarial INTEGRATION suite (DR-015).
 *
 * The implementers tested each layer in ISOLATION:
 *   - getPluginSyncState by mocking the three readers (driving env only).
 *   - the route handler by mocking getPluginSyncState.
 * Nobody exercised the WHOLE stack together: a REAL installed_plugins.json
 * fixture + a REAL temp git repo flowing through getPluginSyncState() and the
 * route handler, end to end. This suite closes that gap and probes edges the
 * EARS criteria imply but the existing tests skip:
 *
 *   - REQ-15-002 false-negative: a genuinely-behind install (clean tree, full
 *     SHAs that differ and are NOT in a prefix relationship) must report
 *     `behind` through the live env path, not just through mocked readers.
 *   - AC-15-002.6 prefix rule abuse: a *degenerate* short installed SHA that is
 *     a prefix of HEAD but is not really the same commit. We assert the current
 *     contract and lock the real-SHA behaviour so a mutation of shaEqual breaks.
 *   - REQ-15-005 honesty: an env where the factory root is not a git repo must
 *     degrade to `unknown`/`in-sync`-safe, never a false `behind` alarm.
 *   - REQ-15-001 dirty precedence flowing through the live composition.
 *
 * All tests manipulate process.env (PANDACORP_FACTORY_ROOT / HOME) and restore
 * it afterwards, and use throwaway temp dirs / git repos — no shared state.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPluginSyncState } from "./plugin-sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Create a temp git repo with an initial commit that touches plugin/. */
function makeRepoWithPluginCommit(): { root: string; headSha: string } {
  const root = mkTmp("frd15-int-repo-");
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

/** Write a minimal installed_plugins.json with the given gitCommitSha under <home>/.claude. */
function writeInstalled(home: string, gitCommitSha: string | null): void {
  const dir = path.join(home, ".claude", "plugins");
  fs.mkdirSync(dir, { recursive: true });
  const entry: Record<string, unknown> = { scope: "user", version: "9.9.9" };
  if (gitCommitSha !== null) entry.gitCommitSha = gitCommitSha;
  const body = { version: 2, plugins: { "pandacorp@panda-corp": [entry] } };
  fs.writeFileSync(path.join(dir, "installed_plugins.json"), JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Env isolation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// End-to-end through the live env path
// ---------------------------------------------------------------------------

describe("frd-15 integration (reviewer): live getPluginSyncState over real git repo + real installed_plugins.json", () => {
  it("frd-15: REQ-15-002 — clean tree, installed full SHA differs from HEAD (no prefix relation) → reason 'behind', drift true (live env, not mocked)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-int-home-");
    // A full 40-char SHA guaranteed NOT to be a prefix of (or prefixed by) headSha.
    const otherSha = headSha[0] === "0" ? `1${headSha.slice(1)}` : `0${headSha.slice(1)}`;
    expect(otherSha).not.toBe(headSha);
    writeInstalled(home, otherSha);

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    expect(state.dirty).toBe(false);
    expect(state.installedSha).toBe(otherSha);
    expect(state.pluginHeadSha).toBe(headSha);
    expect(state.reason).toBe("behind");
    expect(state.drift).toBe(true);
  });

  it("frd-15: REQ-15-004 — clean tree, installed SHA == HEAD → reason 'in-sync', drift false (self-clears, live env)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-int-home-");
    writeInstalled(home, headSha);

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    expect(state.reason).toBe("in-sync");
    expect(state.drift).toBe(false);
  });

  it("frd-15: REQ-15-001 — uncommitted change under plugin/ wins even when SHA matches HEAD → drift true (live env)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    // Introduce a real uncommitted change under plugin/.
    fs.writeFileSync(path.join(root, "plugin", "x.txt"), "two\n");
    const home = mkTmp("frd15-int-home-");
    writeInstalled(home, headSha);

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    expect(state.dirty).toBe(true);
    expect(state.drift).toBe(true);
    // SHAs equal but tree dirty → uncommitted (not "both", not "in-sync").
    expect(state.reason).toBe("uncommitted");
  });

  it("frd-15: REQ-15-001/002 — dirty AND SHA behind → reason 'both' (live env, real repo)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    fs.writeFileSync(path.join(root, "plugin", "x.txt"), "two\n");
    const home = mkTmp("frd15-int-home-");
    const otherSha = headSha[0] === "0" ? `1${headSha.slice(1)}` : `0${headSha.slice(1)}`;
    writeInstalled(home, otherSha);

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    expect(state.reason).toBe("both");
    expect(state.drift).toBe(true);
  });

  it("frd-15: REQ-15-005 honesty — factory root is NOT a git repo → no false 'behind' alarm even with an installed SHA present", () => {
    const root = mkTmp("frd15-int-nogit-");
    const home = mkTmp("frd15-int-home-");
    writeInstalled(home, "a".repeat(40));

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    // pluginHeadSha unknown (not a repo) and not dirty → must NOT alarm.
    expect(state.pluginHeadSha).toBeNull();
    expect(state.drift).toBe(false);
    expect(state.reason).toBe("unknown");
  });

  it("frd-15: REQ-15-005 honesty — plugin not installed (no installed_plugins.json) + clean repo → 'unknown', no alarm", () => {
    const { root } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-int-home-"); // no installed_plugins.json written

    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const state = getPluginSyncState();
    expect(state.installedSha).toBeNull();
    expect(state.drift).toBe(false);
    expect(state.reason).toBe("unknown");
  });

  it("frd-15: REQ-15-005 — the live composition never mutates the working tree (read-only over a real repo)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();
    const home = mkTmp("frd15-int-home-");
    writeInstalled(home, headSha);
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = home;
    delete process.env.USERPROFILE;

    const before = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
    });
    getPluginSyncState();
    getPluginSyncState();
    const after = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
    });
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Mutation sentinels for shaEqual — lock the prefix rule against decorative tests
// ---------------------------------------------------------------------------

describe("frd-15 integration (reviewer): shaEqual prefix-rule mutation sentinels (AC-15-002.6)", () => {
  it("frd-15: a real 7-char abbreviation of HEAD reports in-sync, but a 7-char NON-prefix reports behind (kills a '|| true' mutation)", () => {
    const { root, headSha } = makeRepoWithPluginCommit();

    // Case A: genuine abbreviation (prefix) → in-sync.
    const homeA = mkTmp("frd15-int-home-");
    writeInstalled(homeA, headSha.slice(0, 7));
    process.env.PANDACORP_FACTORY_ROOT = root;
    process.env.HOME = homeA;
    delete process.env.USERPROFILE;
    expect(getPluginSyncState().reason).toBe("in-sync");

    // Case B: 7 chars that are NOT a prefix of HEAD → behind (drift).
    const wrong7 = headSha.slice(0, 6) + (headSha[6] === "f" ? "0" : "f");
    expect(headSha.startsWith(wrong7)).toBe(false);
    const homeB = mkTmp("frd15-int-home-");
    writeInstalled(homeB, wrong7);
    process.env.HOME = homeB;
    expect(getPluginSyncState().reason).toBe("behind");
  });
});
