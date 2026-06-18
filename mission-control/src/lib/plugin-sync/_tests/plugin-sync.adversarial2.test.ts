/**
 * WO-15-001 — ADVERSARIAL review tests, round 2 (DR-015, cycle 2 verification).
 *
 * Written by the reviewer (Opus), NOT the implementer, AFTER the B1 trim fix landed
 * (commit d732d74). These probe edges the first adversarial round and the implementer's
 * primary suite did NOT cover, and act as mutation sentinels for the trim fix.
 *
 * New angles:
 *   E) Mutation sentinel for the .trim() fix in extractSha — a CR-only ("\r") pollution and
 *      an internal-tab SHA. The CR case proves the trim is real (removing .trim() would leak
 *      a "\r"); the internal-whitespace case proves trim only strips the edges (not a global
 *      replace that would silently "clean" a corrupt SHA into a different one).
 *   F) Bare repo for readPluginHeadSha / readPluginDirty (the round-1 header named it but
 *      never asserted it) — must degrade to null/false, never throw.
 *   G) readInstalledSha against a DIRECTORY at the installed_plugins.json path
 *      (EISDIR on read) → null, no throw.
 *   H) Cross-reader consistency: when the installed SHA equals the plugin HEAD SHA but the
 *      JSON wraps it in whitespace, the two readers must produce EQUAL strings (the exact
 *      false-drift scenario WO-15-002's verdict depends on).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readInstalledSha, readPluginDirty, readPluginHeadSha } from "../plugin-sync";

let tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
  tmpDirs = [];
});

function writeInstalled(value: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv2-installed-"));
  tmpDirs.push(dir);
  const pluginsDir = path.join(dir, "plugins");
  fs.mkdirSync(pluginsDir, { recursive: true });
  fs.writeFileSync(path.join(pluginsDir, "installed_plugins.json"), JSON.stringify(value));
  return dir;
}

function realPluginHeadSha(repoDir: string): string {
  return execFileSync("git", ["log", "-1", "--format=%H", "--", "plugin/"], {
    cwd: repoDir,
    encoding: "utf-8",
  }).trim();
}

// ---------------------------------------------------------------------------
// E) Mutation sentinels for the trim fix.
// ---------------------------------------------------------------------------
describe("adversarial2 E: extractSha trim is real and edge-only", () => {
  it("a gitCommitSha polluted with a carriage return ('\\r') returns the clean 40-char SHA", () => {
    const clean = "a95037f84c041bf3e24a0f8a9c907fab97de1554";
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ scope: "user", gitCommitSha: `${clean}\r` }] },
    });
    const result = readInstalledSha(home);
    // Removing .trim() from extractSha's return would leak the "\r" and fail this.
    expect(result).toBe(clean);
    expect(result).not.toMatch(/[\r\n]/);
  });

  it("a SHA with INTERNAL whitespace is only edge-trimmed, never globally scrubbed", () => {
    // A corrupt value with an internal space must NOT be silently rewritten into a
    // different-but-clean string (which a `.replace(/\s/g,"")` mutation would do).
    const corrupt = "  a95037f8 4c041bf3e24a0f8a9c907fab97de1554  ";
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ scope: "user", gitCommitSha: corrupt }] },
    });
    const result = readInstalledSha(home);
    // Edge-trim only: leading/trailing gone, the internal space preserved verbatim.
    expect(result).toBe("a95037f8 4c041bf3e24a0f8a9c907fab97de1554");
  });
});

// ---------------------------------------------------------------------------
// F) Bare repo — git verbs that need a worktree.
// ---------------------------------------------------------------------------
describe("adversarial2 F: bare git repo degrades gracefully", () => {
  it("readPluginHeadSha on a bare repo → null, never throws", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv2-bare-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "--bare", "--initial-branch=main"], { cwd: dir });
    expect(() => readPluginHeadSha(dir)).not.toThrow();
    expect(readPluginHeadSha(dir)).toBeNull();
  });

  it("readPluginDirty on a bare repo → false, never throws (git status fails without worktree)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv2-bare2-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "--bare", "--initial-branch=main"], { cwd: dir });
    expect(() => readPluginDirty(dir)).not.toThrow();
    expect(readPluginDirty(dir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// G) installed_plugins.json path is a DIRECTORY (EISDIR).
// ---------------------------------------------------------------------------
describe("adversarial2 G: installed_plugins.json is a directory", () => {
  it("readInstalledSha → null, no throw when the JSON path is actually a dir", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv2-eisdir-"));
    tmpDirs.push(dir);
    // Create plugins/installed_plugins.json as a DIRECTORY.
    fs.mkdirSync(path.join(dir, "plugins", "installed_plugins.json"), { recursive: true });
    expect(() => readInstalledSha(dir)).not.toThrow();
    expect(readInstalledSha(dir)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// H) Cross-reader consistency — the exact WO-15-002 no-false-drift scenario.
// ---------------------------------------------------------------------------
describe("adversarial2 H: installed (whitespace-wrapped) == HEAD ⇒ no false drift", () => {
  it("installedSha === pluginHeadSha when both point at the same commit despite JSON whitespace", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv2-cons-"));
    tmpDirs.push(repo);
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "T"], { cwd: repo });
    fs.mkdirSync(path.join(repo, "plugin"), { recursive: true });
    fs.writeFileSync(path.join(repo, "plugin", "SKILL.md"), "# skill\n");
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["commit", "-m", "chore: plugin"], { cwd: repo });

    const headSha = realPluginHeadSha(repo);
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ scope: "user", gitCommitSha: `\t${headSha}\n` }] },
    });

    const installed = readInstalledSha(home);
    const head = readPluginHeadSha(repo);
    // The WO-15-002 verdict is `installed !== head`. With the trim fix these must be EQUAL.
    expect(installed).toBe(head);
    expect(installed !== head).toBe(false);
  });
});
