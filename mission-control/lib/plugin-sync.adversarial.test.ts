/**
 * WO-15-001 — ADVERSARIAL review tests (DR-015).
 *
 * Written by the reviewer (Opus), NOT the implementer. Targets edge cases, abuse and
 * downstream-contract hazards the implementer's RED suite did NOT cover. The goal is to
 * find places where the readers silently return a value that breaks WO-15-002's verdict
 * (`drift = installedSha && pluginHeadSha && installedSha !== pluginHeadSha`).
 *
 * Focus areas not in lib/plugin-sync.test.ts:
 *   A) SHA hygiene: a returned SHA must be usable as-is for prefix-safe equality. A value
 *      polluted with surrounding whitespace / newlines would make `installedSha !== pluginHeadSha`
 *      fire spuriously (false-positive "behind" banner) — the opposite of the FRD's no-false-alarm rule.
 *   B) Malformed-but-plausible installed_plugins.json shapes (null entry, nested null, array-as-entry,
 *      first element null, boolean/array gitCommitSha).
 *   C) git probes against unusual-but-real repo states (plugin/ path removed by a later commit;
 *      a bare repo; a path that is a FILE not a dir).
 *   D) Argument-injection hardening: a factoryRoot that looks like a git option must not be
 *      interpreted as a flag (arg-array form guarantees this — assert it holds).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readInstalledSha, readPluginDirty, readPluginHeadSha } from "./plugin-sync";

const SHA_40 = "a95037f84c041bf3e24a0f8a9c907fab97de1554";

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv-installed-"));
  tmpDirs.push(dir);
  const pluginsDir = path.join(dir, "plugins");
  fs.mkdirSync(pluginsDir, { recursive: true });
  fs.writeFileSync(path.join(pluginsDir, "installed_plugins.json"), JSON.stringify(value));
  return dir;
}

function gitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv-git-"));
  tmpDirs.push(dir);
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "T"], { cwd: dir });
  return dir;
}

function commitPlugin(dir: string, file: string, body: string): void {
  const pluginDir = path.join(dir, "plugin");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, file), body);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-m", `chore: ${file}`], { cwd: dir });
}

// ---------------------------------------------------------------------------
// A) SHA hygiene — the returned value must be safe for direct equality compare.
// ---------------------------------------------------------------------------
describe("adversarial A: readInstalledSha returns a clean, compare-safe SHA", () => {
  it("a SHA with surrounding whitespace/newline must NOT leak the whitespace (else WO-15-002 mis-compares)", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ scope: "user", gitCommitSha: `  ${SHA_40}\n` }] },
    });
    const result = readInstalledSha(home);
    // If non-null, it must equal the clean SHA — a value like "  <sha>\n" would make
    // installedSha !== pluginHeadSha fire even when they are the same commit.
    if (result !== null) {
      expect(result).toBe(SHA_40);
      expect(result).not.toMatch(/\s/);
    }
  });

  it("a returned SHA never contains leading/trailing whitespace", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ scope: "user", gitCommitSha: SHA_40 }] },
    });
    const result = readInstalledSha(home);
    expect(result).toBe(SHA_40);
    expect(result?.trim()).toBe(result);
  });
});

// ---------------------------------------------------------------------------
// B) Malformed-but-plausible shapes — must be null, never throw, never coerce.
// ---------------------------------------------------------------------------
describe("adversarial B: malformed installed_plugins.json shapes degrade to null", () => {
  it("entry value is literal null → null", () => {
    const home = writeInstalled({ version: 2, plugins: { "pandacorp@panda-corp": null } });
    expect(() => readInstalledSha(home)).not.toThrow();
    expect(readInstalledSha(home)).toBeNull();
  });

  it("entry array whose first element is null → null (no crash on null.gitCommitSha)", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [null, { gitCommitSha: SHA_40 }] },
    });
    expect(() => readInstalledSha(home)).not.toThrow();
    expect(readInstalledSha(home)).toBeNull();
  });

  it("gitCommitSha is a boolean → null (regression B1' family: only strings)", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ gitCommitSha: true }] },
    });
    expect(readInstalledSha(home)).toBeNull();
  });

  it("gitCommitSha is an array → null (array-shaped value must not coerce)", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [{ gitCommitSha: [SHA_40] }] },
    });
    expect(() => readInstalledSha(home)).not.toThrow();
    expect(readInstalledSha(home)).toBeNull();
  });

  it("root JSON is an array (not object) → null", () => {
    const home = writeInstalled([{ "pandacorp@panda-corp": [{ gitCommitSha: SHA_40 }] }]);
    expect(() => readInstalledSha(home)).not.toThrow();
    expect(readInstalledSha(home)).toBeNull();
  });

  it("plugins key missing entirely → null", () => {
    const home = writeInstalled({ version: 2 });
    expect(readInstalledSha(home)).toBeNull();
  });

  it("first element is an array (nested array) → null", () => {
    const home = writeInstalled({
      version: 2,
      plugins: { "pandacorp@panda-corp": [[{ gitCommitSha: SHA_40 }]] },
    });
    expect(() => readInstalledSha(home)).not.toThrow();
    expect(readInstalledSha(home)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C) git probes against unusual real states.
// ---------------------------------------------------------------------------
describe("adversarial C: git probes on unusual repo states", () => {
  it("plugin/ committed then DELETED in a later commit → still returns a SHA (history is what matters)", () => {
    const dir = gitRepo();
    commitPlugin(dir, "SKILL.md", "# skill\n");
    // Delete plugin/ entirely in a follow-up commit.
    fs.rmSync(path.join(dir, "plugin"), { recursive: true, force: true });
    execFileSync("git", ["add", "-A"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "chore: drop plugin"], { cwd: dir });

    const sha = readPluginHeadSha(dir);
    // git log -- plugin/ includes the deletion commit; a 40-hex SHA is expected, never a throw.
    expect(() => readPluginHeadSha(dir)).not.toThrow();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("returned HEAD SHA is exactly 40 chars with no trailing newline (compare-safe)", () => {
    const dir = gitRepo();
    commitPlugin(dir, "SKILL.md", "# skill\n");
    const sha = readPluginHeadSha(dir);
    expect(sha).not.toBeNull();
    expect(sha?.length).toBe(40);
    expect(sha?.trim()).toBe(sha);
  });

  it("readPluginHeadSha: factoryRoot is a FILE not a directory → null, no throw", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv-file-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "afile");
    fs.writeFileSync(file, "x");
    expect(() => readPluginHeadSha(file)).not.toThrow();
    expect(readPluginHeadSha(file)).toBeNull();
  });

  it("readPluginDirty: dirty file inside a SUBDIR of plugin/ → true (porcelain is recursive)", () => {
    const dir = gitRepo();
    commitPlugin(dir, "SKILL.md", "# skill\n");
    const nested = path.join(dir, "plugin", "skills", "x");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "SKILL.md"), "# nested\n");
    expect(readPluginDirty(dir)).toBe(true);
  });

  it("readPluginDirty: a file whose name merely starts with 'plugin' (sibling) does NOT count", () => {
    const dir = gitRepo();
    commitPlugin(dir, "SKILL.md", "# skill\n");
    // Create a sibling file 'plugins.txt' — the pathspec 'plugin/' must not match it.
    fs.writeFileSync(path.join(dir, "plugins.txt"), "not the plugin dir\n");
    expect(readPluginDirty(dir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D) Argument-injection hardening — factoryRoot that looks like a git flag.
// ---------------------------------------------------------------------------
describe("adversarial D: hostile factoryRoot values are inert (arg-array, no shell)", () => {
  it("factoryRoot resembling a git option string → null, never executes a flag", () => {
    // cwd does not exist → execFileSync throws → caught → null. The point: no shell expansion,
    // no flag interpretation, no throw escaping the function.
    expect(() => readPluginHeadSha("--upload-pack=touch /tmp/pwned")).not.toThrow();
    expect(readPluginHeadSha("--upload-pack=touch /tmp/pwned")).toBeNull();
    expect(() => readPluginDirty("; rm -rf /tmp/nope")).not.toThrow();
    expect(readPluginDirty("; rm -rf /tmp/nope")).toBe(false);
    expect(fs.existsSync("/tmp/pwned")).toBe(false);
  });
});
