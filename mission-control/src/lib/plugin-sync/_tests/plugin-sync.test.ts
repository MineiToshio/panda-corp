/**
 * FRD-15 — Plugin out-of-sync warning (version-based, FRD-15).
 *
 * The banner fires ONLY when the installed plugin `version`
 * (`~/.claude/plugins/installed_plugins.json`) is strictly behind the source
 * `version` (`plugin/.claude-plugin/plugin.json`) — the same signal
 * `claude plugin update` uses. No git, no SHA, no dirty check.
 *
 * Traceability: IF-15-sync → REQ-15-002 (version mismatch), REQ-15-005 (read-only).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPluginSyncState, readInstalledVersion, readPluginSourceVersion } from "../plugin-sync";

// ---------------------------------------------------------------------------
// Temp-filesystem helpers
// ---------------------------------------------------------------------------

const PLUGIN_KEY = "pandacorp@panda-corp";

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Write `<claudeDir>/plugins/installed_plugins.json` with the given raw or object content. */
function writeInstalled(claudeDir: string, content: unknown | string): void {
  const dir = path.join(claudeDir, "plugins");
  fs.mkdirSync(dir, { recursive: true });
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  fs.writeFileSync(path.join(dir, "installed_plugins.json"), raw, "utf-8");
}

/** Write `<factoryRoot>/plugin/.claude-plugin/plugin.json` with the given raw or object content. */
function writeManifest(factoryRoot: string, content: unknown | string): void {
  const dir = path.join(factoryRoot, "plugin", ".claude-plugin");
  fs.mkdirSync(dir, { recursive: true });
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  fs.writeFileSync(path.join(dir, "plugin.json"), raw, "utf-8");
}

/** Canonical installed_plugins.json shape (array entry) with a given plugin version. */
function installedFixture(version: string): unknown {
  return { version: 2, plugins: { [PLUGIN_KEY]: [{ version, installPath: "/x" }] } };
}

// ---------------------------------------------------------------------------
// readInstalledVersion — defensive parsing (REQ-15-005, never throws)
// ---------------------------------------------------------------------------

describe("readInstalledVersion", () => {
  let claudeDir: string;
  beforeEach(() => {
    claudeDir = mkTmp("pc-claude-");
  });
  afterEach(() => {
    fs.rmSync(claudeDir, { recursive: true, force: true });
  });

  it("returns the entry version from the canonical array shape", () => {
    writeInstalled(claudeDir, installedFixture("8.42.0"));
    expect(readInstalledVersion(claudeDir)).toBe("8.42.0");
  });

  it("reads the ENTRY version, not the top-level file-format version", () => {
    // top-level version:2 must NOT be mistaken for the plugin version
    writeInstalled(claudeDir, { version: 2, plugins: { [PLUGIN_KEY]: [{ version: "9.0.1" }] } });
    expect(readInstalledVersion(claudeDir)).toBe("9.0.1");
  });

  it("tolerates a single-object entry (not an array)", () => {
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: { version: "7.1.0" } } });
    expect(readInstalledVersion(claudeDir)).toBe("7.1.0");
  });

  it("trims surrounding whitespace", () => {
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: [{ version: "  8.42.0  " }] } });
    expect(readInstalledVersion(claudeDir)).toBe("8.42.0");
  });

  it("returns null when the file does not exist", () => {
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });

  it("returns null on invalid JSON (never throws)", () => {
    writeInstalled(claudeDir, "{ not json");
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });

  it("returns null when there is no entry for the plugin key", () => {
    writeInstalled(claudeDir, { plugins: { "other@thing": [{ version: "1.0.0" }] } });
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });

  it("returns null when the entry array is empty", () => {
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: [] } });
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });

  it("returns null when version is missing, empty, or non-string", () => {
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: [{ installPath: "/x" }] } });
    expect(readInstalledVersion(claudeDir)).toBeNull();
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: [{ version: "" }] } });
    expect(readInstalledVersion(claudeDir)).toBeNull();
    writeInstalled(claudeDir, { plugins: { [PLUGIN_KEY]: [{ version: 8 }] } });
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });

  it("returns null when the root is not a plain object", () => {
    writeInstalled(claudeDir, "[1,2,3]");
    expect(readInstalledVersion(claudeDir)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPluginSourceVersion — defensive parsing (REQ-15-005, never throws)
// ---------------------------------------------------------------------------

describe("readPluginSourceVersion", () => {
  let factoryRoot: string;
  beforeEach(() => {
    factoryRoot = mkTmp("pc-factory-");
  });
  afterEach(() => {
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  it("returns the version from plugin/.claude-plugin/plugin.json", () => {
    writeManifest(factoryRoot, { name: "pandacorp", version: "8.42.0" });
    expect(readPluginSourceVersion(factoryRoot)).toBe("8.42.0");
  });

  it("trims surrounding whitespace", () => {
    writeManifest(factoryRoot, { version: " 8.43.0 " });
    expect(readPluginSourceVersion(factoryRoot)).toBe("8.43.0");
  });

  it("returns null when the manifest is missing", () => {
    expect(readPluginSourceVersion(factoryRoot)).toBeNull();
  });

  it("returns null on invalid JSON (never throws)", () => {
    writeManifest(factoryRoot, "{{ broken");
    expect(readPluginSourceVersion(factoryRoot)).toBeNull();
  });

  it("returns null when version is absent or empty", () => {
    writeManifest(factoryRoot, { name: "pandacorp" });
    expect(readPluginSourceVersion(factoryRoot)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPluginSyncState — version verdict (REQ-15-002)
// ---------------------------------------------------------------------------

describe("getPluginSyncState — version verdict", () => {
  let claudeHome: string;
  let factoryRoot: string;
  let prevHome: string | undefined;
  let prevFactory: string | undefined;

  beforeEach(() => {
    prevHome = process.env.HOME;
    prevFactory = process.env.PANDACORP_FACTORY_ROOT;
    claudeHome = mkTmp("pc-home-");
    factoryRoot = mkTmp("pc-factory-");
    process.env.HOME = claudeHome;
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
  });
  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevFactory === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
    else process.env.PANDACORP_FACTORY_ROOT = prevFactory;
    fs.rmSync(claudeHome, { recursive: true, force: true });
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  /** HOME → ~/.claude (resolveClaudeHome joins ".claude"). */
  function seed(installed: string | null, source: string | null): void {
    if (installed !== null) {
      writeInstalled(path.join(claudeHome, ".claude"), installedFixture(installed));
    }
    if (source !== null) writeManifest(factoryRoot, { version: source });
  }

  it("installed BEHIND source → drift, reason 'behind', detail names both versions", () => {
    seed("8.42.0", "8.43.0");
    const s = getPluginSyncState();
    expect(s.reason).toBe("behind");
    expect(s.drift).toBe(true);
    expect(s.installedVersion).toBe("8.42.0");
    expect(s.sourceVersion).toBe("8.43.0");
    expect(s.detail).toContain("8.42.0");
    expect(s.detail).toContain("8.43.0");
  });

  it("installed EQUAL to source → in-sync, no drift (the bug this fixes)", () => {
    seed("8.42.0", "8.42.0");
    const s = getPluginSyncState();
    expect(s.reason).toBe("in-sync");
    expect(s.drift).toBe(false);
  });

  it("installed NEWER than source → in-sync, no drift (installed ahead)", () => {
    seed("8.43.0", "8.42.0");
    const s = getPluginSyncState();
    expect(s.reason).toBe("in-sync");
    expect(s.drift).toBe(false);
  });

  it("behind by a patch is detected (8.42.0 < 8.42.1)", () => {
    seed("8.42.0", "8.42.1");
    expect(getPluginSyncState().reason).toBe("behind");
  });

  it("installed version missing → unknown, no drift (no false alarm)", () => {
    seed(null, "8.42.0");
    const s = getPluginSyncState();
    expect(s.reason).toBe("unknown");
    expect(s.drift).toBe(false);
  });

  it("source version missing → unknown, no drift (no false alarm)", () => {
    seed("8.42.0", null);
    const s = getPluginSyncState();
    expect(s.reason).toBe("unknown");
    expect(s.drift).toBe(false);
  });

  it("unparseable versions → unknown, never a false 'behind'", () => {
    seed("not-a-version", "also-bad");
    const s = getPluginSyncState();
    expect(s.reason).toBe("unknown");
    expect(s.drift).toBe(false);
  });

  it("never throws even when both inputs are absent", () => {
    seed(null, null);
    expect(() => getPluginSyncState()).not.toThrow();
    expect(getPluginSyncState().drift).toBe(false);
  });

  it("a 'v'-prefixed installed version still compares numerically", () => {
    seed("v8.42.0", "8.43.0");
    expect(getPluginSyncState().reason).toBe("behind");
  });
});
