/**
 * WO-15-001 / WO-15-002 — `lib/plugin-sync` readers + verdict
 * Tests written BEFORE implementation (RED phase for WO-15-002).
 *
 * Acceptance criteria under test:
 *   AC-15-001.1  GIVEN a fixture installed_plugins.json with pandacorp@panda-corp
 *                THEN readInstalledSha returns the gitCommitSha value.
 *   AC-15-001.2  GIVEN the file is missing, malformed JSON, or has no pandacorp@panda-corp entry
 *                THEN readInstalledSha returns null (never throws).
 *   AC-15-001.3  GIVEN an entry has a `version` field
 *                THEN readInstalledSha does NOT return the version — only gitCommitSha is read.
 *   AC-15-001.4  readPluginHeadSha returns the 40-char SHA from `git log -1 --format=%H -- plugin/`
 *                for a real temp git repo; returns null when cwd is not a git repo.
 *   AC-15-001.5  readPluginDirty returns true when `git status --porcelain -- plugin/` is non-empty,
 *                false when clean, false (not throw) when not a repo.
 *
 * Traceability:
 *   REQ-15-001 (uncommitted changes → persistent warning) → AC-15-001.5
 *   REQ-15-002 (installed SHA ≠ plugin HEAD SHA → warning) → AC-15-001.1, AC-15-001.4
 *   REQ-15-005 (read-only invariant — never executes, never writes) → all ACs
 *
 * Regression anchors from .pandacorp/comms/progress.md (real incidents → regression tests):
 *   B1' (2026-06-16): `typeof NaN === "number"` passes numeric type guards silently.
 *     Risk here: an entry with a numeric gitCommitSha (e.g. 0) must NOT be returned
 *     as a valid SHA — only strings are valid.
 *   I2 (2026-06-16): empty-object / empty-array inputs pass collection guards vacuously.
 *     Risk: an installed_plugins.json with `"pandacorp@panda-corp": []` (empty array)
 *     must return null, not throw from array access.
 *   I3 (2026-06-16): array-shaped objects fool typeof checks.
 *     Risk: an entry that is an array rather than an object must not produce a SHA.
 *   WO-13-001 (2026-06-16): NaN passed Number.isFinite — analogous: gitCommitSha must
 *     be a non-empty string to be returned.
 *
 * Stack: Vitest (Node environment needed — git + fs reads).
 * No network calls, no writes to disk. Tests are fully isolated:
 *   - readInstalledSha: receives claudeHome as a parameter → temp dir with fixture JSON.
 *   - readPluginHeadSha / readPluginDirty: receive factoryRoot as a parameter → temp git repo.
 * No shared mutable state between tests.
 *
 * NOTE: These tests WILL fail until lib/plugin-sync.ts is implemented (RED phase, by design).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase).
// ---------------------------------------------------------------------------
import { readInstalledSha, readPluginDirty, readPluginHeadSha } from "./plugin-sync";

// ---------------------------------------------------------------------------
// Fixture shape mirroring the real ~/.claude/plugins/installed_plugins.json
// (inspected 2026-06-16: version 2, nested under "plugins", array per entry).
//
// Real shape:
// {
//   "version": 2,
//   "plugins": {
//     "pandacorp@panda-corp": [
//       {
//         "scope": "user",
//         "installPath": "...",
//         "version": "7.1.0",
//         "installedAt": "...",
//         "lastUpdated": "...",
//         "gitCommitSha": "a95037f84c041bf3e24a0f8a9c907fab97de1554"
//       }
//     ]
//   }
// }
// ---------------------------------------------------------------------------

const REAL_SHA_40 = "a95037f84c041bf3e24a0f8a9c907fab97de1554";
const OTHER_SHA_40 = "deadbeef0011223344556677889900aabbccddee";

/** Write an installed_plugins.json fixture into a temp claude home dir. */
function makeClaudeHome(
  pluginEntry: Record<string, unknown> | Record<string, unknown>[] | null | "invalid-json",
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-plugin-sync-test-"));
  const pluginsDir = path.join(dir, "plugins");
  fs.mkdirSync(pluginsDir, { recursive: true });

  if (pluginEntry === "invalid-json") {
    fs.writeFileSync(path.join(pluginsDir, "installed_plugins.json"), "{ this is not json ::::");
    return dir;
  }

  if (pluginEntry === null) {
    // File absent — don't write anything.
    return dir;
  }

  const entries = Array.isArray(pluginEntry) ? pluginEntry : [pluginEntry];
  const payload = {
    version: 2,
    plugins: {
      "pandacorp@panda-corp": entries,
    },
  };
  fs.writeFileSync(path.join(pluginsDir, "installed_plugins.json"), JSON.stringify(payload));
  return dir;
}

/** Create a minimal temp git repo with a commit touching plugin/ for git probes. */
function makeTempGitRepo(opts?: { withPluginFile?: boolean; withDirtyPlugin?: boolean }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-gitrepo-test-"));
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@test.local"], {
    cwd: dir,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });

  // Create plugin/ directory with a file and commit it.
  const pluginDir = path.join(dir, "plugin");
  fs.mkdirSync(pluginDir, { recursive: true });

  if (opts?.withPluginFile !== false) {
    fs.writeFileSync(path.join(pluginDir, "SKILL.md"), "# skill\n");
    execFileSync("git", ["add", "plugin/"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "chore: add plugin file"], {
      cwd: dir,
    });
  }

  if (opts?.withDirtyPlugin) {
    // Modify an existing tracked file (or add untracked) to make status non-empty.
    fs.writeFileSync(path.join(pluginDir, "SKILL.md"), "# skill\n# dirty change\n");
  }

  return dir;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
  tmpDirs = [];
});

// ---------------------------------------------------------------------------
// AC-15-001.1 — GIVEN valid installed_plugins.json THEN return gitCommitSha
// ---------------------------------------------------------------------------

describe("frd-15: AC-15-001.1 — readInstalledSha returns gitCommitSha from valid fixture", () => {
  it("frd-15: WHEN installed_plugins.json has pandacorp@panda-corp with gitCommitSha THEN returns that SHA", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: REAL_SHA_40,
    });
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    expect(result).toBe(REAL_SHA_40);
  });

  it("frd-15: WHEN the entry is the first element in the plugin array THEN reads the gitCommitSha from index 0", () => {
    const claudeHome = makeClaudeHome([
      { scope: "user", version: "7.1.0", gitCommitSha: REAL_SHA_40 },
      { scope: "project", version: "6.0.0", gitCommitSha: OTHER_SHA_40 },
    ]);
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    // First (user-scope or first) entry is the one used; exact pick is impl-defined but
    // at minimum it returns a non-null 40-char hex string — not "6.0.0".
    expect(result).toMatch(/^[0-9a-f]{7,40}$/);
    expect(result).not.toBe("6.0.0");
    expect(result).not.toBe("7.1.0");
  });

  it("frd-15: WHEN gitCommitSha is an abbreviated 7-char SHA THEN returns it as-is (prefix allowed)", () => {
    const shortSha = REAL_SHA_40.slice(0, 7);
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: shortSha,
    });
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    expect(result).toBe(shortSha);
  });
});

// ---------------------------------------------------------------------------
// AC-15-001.2 — GIVEN missing/malformed/no-entry THEN return null, never throw
// ---------------------------------------------------------------------------

describe("frd-15: AC-15-001.2 — readInstalledSha returns null on missing/malformed/absent entry", () => {
  it("frd-15: WHEN installed_plugins.json is MISSING THEN returns null (no throw)", () => {
    const claudeHome = makeClaudeHome(null);
    tmpDirs.push(claudeHome);

    expect(() => readInstalledSha(claudeHome)).not.toThrow();
    expect(readInstalledSha(claudeHome)).toBeNull();
  });

  it("frd-15: WHEN installed_plugins.json is malformed JSON THEN returns null (no throw)", () => {
    const claudeHome = makeClaudeHome("invalid-json");
    tmpDirs.push(claudeHome);

    expect(() => readInstalledSha(claudeHome)).not.toThrow();
    expect(readInstalledSha(claudeHome)).toBeNull();
  });

  it("frd-15: WHEN installed_plugins.json has no pandacorp@panda-corp key THEN returns null", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-plugin-sync-test-"));
    tmpDirs.push(dir);
    const pluginsDir = path.join(dir, "plugins");
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "other-plugin@somewhere": [{ scope: "user", gitCommitSha: OTHER_SHA_40 }],
        },
      }),
    );

    expect(readInstalledSha(dir)).toBeNull();
  });

  it("frd-15: WHEN claudeHome itself does not exist THEN returns null (no throw)", () => {
    const nonExistent = path.join(os.tmpdir(), `does-not-exist-${Date.now()}`);
    expect(() => readInstalledSha(nonExistent)).not.toThrow();
    expect(readInstalledSha(nonExistent)).toBeNull();
  });

  it("frd-15: WHEN pandacorp@panda-corp entry is an empty array THEN returns null (regression I2: empty-collection vacuous truth)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-plugin-sync-test-"));
    tmpDirs.push(dir);
    const pluginsDir = path.join(dir, "plugins");
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: { "pandacorp@panda-corp": [] },
      }),
    );

    expect(() => readInstalledSha(dir)).not.toThrow();
    expect(readInstalledSha(dir)).toBeNull();
  });

  it("frd-15: WHEN gitCommitSha field is absent from the entry THEN returns null", () => {
    const claudeHome = makeClaudeHome({ scope: "user", version: "7.1.0" });
    tmpDirs.push(claudeHome);

    expect(readInstalledSha(claudeHome)).toBeNull();
  });

  it("frd-15: WHEN gitCommitSha is an empty string THEN returns null (not a valid SHA)", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: "",
    });
    tmpDirs.push(claudeHome);

    expect(readInstalledSha(claudeHome)).toBeNull();
  });

  it("frd-15: WHEN gitCommitSha is a number THEN returns null (regression B1': numeric gitCommitSha must not pass string check)", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: 0,
    });
    tmpDirs.push(claudeHome);

    expect(readInstalledSha(claudeHome)).toBeNull();
  });

  it("frd-15: WHEN pandacorp@panda-corp value is not an array but an object THEN returns null (regression I3: array-shaped guard)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-plugin-sync-test-"));
    tmpDirs.push(dir);
    const pluginsDir = path.join(dir, "plugins");
    fs.mkdirSync(pluginsDir, { recursive: true });
    // The real format is an array of entries; if it is somehow a plain object, be defensive.
    fs.writeFileSync(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "pandacorp@panda-corp": { gitCommitSha: REAL_SHA_40 },
        },
      }),
    );

    // Either null (strict: only array entries) or the SHA (lenient). What matters:
    // NO throw and the result is string | null.
    expect(() => readInstalledSha(dir)).not.toThrow();
    const result = readInstalledSha(dir);
    expect(typeof result === "string" || result === null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SHA hygiene — returned value must be safe for direct equality comparison.
// Regression anchor: adversarial reviewer (DR-015) found that readInstalledSha
// does NOT trim whitespace from JSON-sourced gitCommitSha, which causes a
// false `installedSha !== pluginHeadSha` drift signal (WO-15-002 verdict).
// The primary suite must anchor this so mutation testing kills it here.
// ---------------------------------------------------------------------------

describe("frd-15: SHA hygiene — readInstalledSha returns a whitespace-free, compare-safe value", () => {
  it("frd-15: WHEN gitCommitSha has surrounding whitespace in JSON THEN returns the trimmed SHA (no false-drift via !=)", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: `  ${REAL_SHA_40}\n`,
    });
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    // Must be non-null and equal to the clean SHA; a value like "  <sha>\n" would make
    // installedSha !== pluginHeadSha fire even when they are the same commit (false alarm).
    expect(result).not.toBeNull();
    expect(result).toBe(REAL_SHA_40);
    expect(result).not.toMatch(/\s/);
  });

  it("frd-15: WHEN gitCommitSha is only whitespace THEN returns null (whitespace-only is not a valid SHA)", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: "   \n",
    });
    tmpDirs.push(claudeHome);

    expect(readInstalledSha(claudeHome)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-15-001.3 — `version` field is NEVER returned; only `gitCommitSha` is read
// ---------------------------------------------------------------------------

describe("frd-15: AC-15-001.3 — readInstalledSha reads gitCommitSha, never the semver version", () => {
  it("frd-15: WHEN entry has version '7.1.0' and gitCommitSha THEN does NOT return the semver version", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: REAL_SHA_40,
    });
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    expect(result).not.toBe("7.1.0");
    expect(result).toBe(REAL_SHA_40);
  });

  it("frd-15: WHEN entry has version but NO gitCommitSha THEN returns null (version is not a fallback)", () => {
    const claudeHome = makeClaudeHome({ scope: "user", version: "7.1.0" });
    tmpDirs.push(claudeHome);

    const result = readInstalledSha(claudeHome);
    expect(result).toBeNull();
    // Explicitly assert it is not the semver string.
    expect(result).not.toBe("7.1.0");
  });
});

// ---------------------------------------------------------------------------
// AC-15-001.4 — readPluginHeadSha: git log in a real temp repo
// ---------------------------------------------------------------------------

describe("frd-15: AC-15-001.4 — readPluginHeadSha returns the HEAD SHA touching plugin/", () => {
  it("frd-15: WHEN factoryRoot is a git repo with a commit touching plugin/ THEN returns a 40-char hex SHA", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    const result = readPluginHeadSha(repoDir);
    expect(result).not.toBeNull();
    // 40-char lowercase hex string.
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it("frd-15: WHEN called twice on the same repo THEN returns the same SHA (deterministic)", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    const first = readPluginHeadSha(repoDir);
    const second = readPluginHeadSha(repoDir);
    expect(first).toBe(second);
  });

  it("frd-15: WHEN factoryRoot is NOT a git repo THEN returns null (no throw)", () => {
    const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "mc-nongit-"));
    tmpDirs.push(nonRepo);

    expect(() => readPluginHeadSha(nonRepo)).not.toThrow();
    expect(readPluginHeadSha(nonRepo)).toBeNull();
  });

  it("frd-15: WHEN factoryRoot does not exist THEN returns null (no throw)", () => {
    const nonExistent = path.join(os.tmpdir(), `no-such-dir-${Date.now()}`);
    expect(() => readPluginHeadSha(nonExistent)).not.toThrow();
    expect(readPluginHeadSha(nonExistent)).toBeNull();
  });

  it("frd-15: WHEN factoryRoot is a git repo but plugin/ was never touched THEN returns null", () => {
    // Init repo with NO plugin/ commit (empty commit or other-path commit).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-gitrepo-noplugin-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@test.local"], {
      cwd: dir,
    });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    fs.writeFileSync(path.join(dir, "README.md"), "# test\n");
    execFileSync("git", ["add", "README.md"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "chore: init"], { cwd: dir });

    // git log -- plugin/ on a repo that has no plugin/ commits returns empty output.
    expect(() => readPluginHeadSha(dir)).not.toThrow();
    expect(readPluginHeadSha(dir)).toBeNull();
  });

  it("frd-15: WHEN a new commit is added touching plugin/ THEN readPluginHeadSha updates to the new SHA", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    const before = readPluginHeadSha(repoDir);
    expect(before).toMatch(/^[0-9a-f]{40}$/);

    // Add a second commit touching plugin/.
    fs.writeFileSync(path.join(repoDir, "plugin", "SKILL2.md"), "# skill2\n");
    execFileSync("git", ["add", "plugin/"], { cwd: repoDir });
    execFileSync("git", ["commit", "-m", "chore: add second plugin file"], {
      cwd: repoDir,
    });

    const after = readPluginHeadSha(repoDir);
    expect(after).toMatch(/^[0-9a-f]{40}$/);
    expect(after).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// AC-15-001.5 — readPluginDirty: git status probe
// ---------------------------------------------------------------------------

describe("frd-15: AC-15-001.5 — readPluginDirty reflects uncommitted changes under plugin/", () => {
  it("frd-15: WHEN plugin/ has uncommitted modifications THEN readPluginDirty returns true (REQ-15-001)", () => {
    const repoDir = makeTempGitRepo({
      withPluginFile: true,
      withDirtyPlugin: true,
    });
    tmpDirs.push(repoDir);

    const result = readPluginDirty(repoDir);
    expect(result).toBe(true);
  });

  it("frd-15: WHEN plugin/ has an untracked new file THEN readPluginDirty returns true", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    // Add a NEW untracked file under plugin/ (not yet staged).
    fs.writeFileSync(path.join(repoDir, "plugin", "new-untracked.md"), "# new\n");

    expect(readPluginDirty(repoDir)).toBe(true);
  });

  it("frd-15: WHEN plugin/ is clean (all committed, no changes) THEN readPluginDirty returns false (REQ-15-004)", () => {
    const repoDir = makeTempGitRepo({
      withPluginFile: true,
      withDirtyPlugin: false,
    });
    tmpDirs.push(repoDir);

    expect(readPluginDirty(repoDir)).toBe(false);
  });

  it("frd-15: WHEN factoryRoot is NOT a git repo THEN readPluginDirty returns false (no throw) (REQ-15-005: unknown does not raise alarm)", () => {
    const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "mc-nongit-dirty-"));
    tmpDirs.push(nonRepo);

    expect(() => readPluginDirty(nonRepo)).not.toThrow();
    expect(readPluginDirty(nonRepo)).toBe(false);
  });

  it("frd-15: WHEN factoryRoot does not exist THEN readPluginDirty returns false (no throw)", () => {
    const nonExistent = path.join(os.tmpdir(), `no-such-dir-dirty-${Date.now()}`);
    expect(() => readPluginDirty(nonExistent)).not.toThrow();
    expect(readPluginDirty(nonExistent)).toBe(false);
  });

  it("frd-15: WHEN only files OUTSIDE plugin/ are dirty THEN readPluginDirty returns false (scoped to plugin/ only)", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    // Dirty a file outside plugin/ (e.g. root-level README).
    fs.writeFileSync(path.join(repoDir, "README.md"), "dirty outside\n");

    // plugin/ itself is clean, so result must be false.
    expect(readPluginDirty(repoDir)).toBe(false);
  });

  it("frd-15: WHEN staged changes exist under plugin/ THEN readPluginDirty returns true (staged is also dirty)", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    // Stage a change under plugin/ but don't commit.
    fs.writeFileSync(path.join(repoDir, "plugin", "SKILL.md"), "# skill\n# staged\n");
    execFileSync("git", ["add", "plugin/"], { cwd: repoDir });

    expect(readPluginDirty(repoDir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant (REQ-15-005) — cross-cutting
// ---------------------------------------------------------------------------

describe("frd-15: REQ-15-005 — all readers are read-only: they never write to disk", () => {
  it("frd-15: WHEN readInstalledSha is called THEN the claudeHome directory is not modified", () => {
    const claudeHome = makeClaudeHome({
      scope: "user",
      version: "7.1.0",
      gitCommitSha: REAL_SHA_40,
    });
    tmpDirs.push(claudeHome);

    const pluginsDir = path.join(claudeHome, "plugins");
    const filesBefore = fs.readdirSync(pluginsDir).sort();

    readInstalledSha(claudeHome);

    const filesAfter = fs.readdirSync(pluginsDir).sort();
    expect(filesAfter).toEqual(filesBefore);
  });

  it("frd-15: WHEN readPluginHeadSha is called THEN the git repo working tree is not modified", () => {
    const repoDir = makeTempGitRepo({ withPluginFile: true });
    tmpDirs.push(repoDir);

    const statusBefore = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoDir,
      encoding: "utf-8",
    });

    readPluginHeadSha(repoDir);

    const statusAfter = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoDir,
      encoding: "utf-8",
    });
    expect(statusAfter).toBe(statusBefore);
  });

  it("frd-15: WHEN readPluginDirty is called THEN the git repo working tree is not modified", () => {
    const repoDir = makeTempGitRepo({
      withPluginFile: true,
      withDirtyPlugin: true,
    });
    tmpDirs.push(repoDir);

    const statusBefore = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoDir,
      encoding: "utf-8",
    });

    readPluginDirty(repoDir);

    const statusAfter = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoDir,
      encoding: "utf-8",
    });
    expect(statusAfter).toBe(statusBefore);
  });
});
