import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Plugin sync readers for FRD-15 — Plugin out-of-sync warning.
 *
 * Platform golden rule (architecture §1/§7): read-only, never call Claude, never write.
 * Every function is defensive: unreadable/missing inputs → null/"unknown", never throws.
 *
 * Critical invariant (FRD-15, amended 2026-06-22 — version-based, see decision-log):
 *   Drift is determined by comparing the **installed semver `version`**
 *   (`~/.claude/plugins/installed_plugins.json`) against the **source `version`**
 *   (`plugin/.claude-plugin/plugin.json`) — the SAME signal `claude plugin update` uses.
 *   The banner shows ONLY when the installed version is strictly behind the source version.
 *
 *   (Previously this compared git commit SHAs. That produced permanent false "behind"
 *   alarms: `installed_plugins.json.gitCommitSha` is frozen at install time and does NOT
 *   advance when `claude plugin update` runs, while the compared `git log -1 -- plugin/`
 *   advanced on every plugin commit — so the banner was always on. See FRD-15.)
 *
 * Traceability:
 *   IF-15-sync → REQ-15-002 (version mismatch), REQ-15-005 (read-only)
 */

/**
 * The key in `plugins/installed_plugins.json` for the pandacorp plugin.
 * Must match exactly (the file uses this as a JSON object key).
 */
const PLUGIN_KEY = "pandacorp@panda-corp";

/** Source-of-truth manifest for the plugin's published version, relative to the factory root. */
const PLUGIN_MANIFEST_REL = path.join("plugin", ".claude-plugin", "plugin.json");
const CODEX_PLUGIN_MANIFEST_REL = path.join("plugin", ".codex-plugin", "plugin.json");

/**
 * Read the installed plugin's semver `version` from
 * `<claudeHome>/plugins/installed_plugins.json` for `pandacorp@panda-corp`.
 *
 * This is the version `claude plugin update` maintains (NOT the unreliable
 * `gitCommitSha`, which is frozen at install time — FRD-15).
 *
 * @returns the `version` string, or `null` if the file is missing, invalid JSON,
 *   has no `pandacorp@panda-corp` entry, or no non-empty `version`. Never throws.
 */
export function readInstalledVersion(claudeHome: string): string | null {
  const filePath = path.join(claudeHome, "plugins", "installed_plugins.json");
  const parsed = readJsonFile(filePath);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const plugins = (parsed as Record<string, unknown>).plugins;
  if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) {
    return null;
  }

  const entry = (plugins as Record<string, unknown>)[PLUGIN_KEY];

  // Canonical format is an array of entries; tolerate a single object too (lenient, no throw).
  const record = Array.isArray(entry) ? entry[0] : entry;
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return null;
  }

  return extractVersion(record as Record<string, unknown>);
}

/**
 * Read the source `version` from `<factoryRoot>/plugin/.claude-plugin/plugin.json`.
 * This is the authoritative "latest published" version.
 *
 * @returns the `version` string, or `null` if the manifest is missing/invalid or
 *   has no non-empty `version`. Never throws.
 */
export function readPluginSourceVersion(factoryRoot: string): string | null {
  const parsed = readJsonFile(path.join(factoryRoot, PLUGIN_MANIFEST_REL));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return extractVersion(parsed as Record<string, unknown>);
}

/** Read the independently generated Codex source manifest version. */
export function readCodexSourceVersion(factoryRoot: string): string | null {
  const parsed = readJsonFile(path.join(factoryRoot, CODEX_PLUGIN_MANIFEST_REL));
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? extractVersion(parsed as Record<string, unknown>)
    : null;
}

/**
 * Read the installed Codex cache verdict without conflating it with Claude's cache.
 * `PANDACORP_CODEX_PLUGIN_ROOT` is the authoritative activation pointer; the cache
 * probe is a conservative fallback for the standard personal-plugin layout.
 */
export function readCodexInstalledVersion(codexHome: string): string | null {
  const explicit = process.env.PANDACORP_CODEX_PLUGIN_ROOT;
  if (explicit && explicit.trim() !== "") {
    const parsed = readJsonFile(path.join(explicit, ".codex-plugin", "plugin.json"));
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return extractVersion(parsed as Record<string, unknown>);
    }
  }
  const cacheRoot = path.join(codexHome, "plugins", "cache");
  const candidates = [
    path.join(cacheRoot, "pandacorp", ".codex-plugin", "plugin.json"),
    path.join(cacheRoot, "personal", "pandacorp", ".codex-plugin", "plugin.json"),
  ];
  for (const candidate of candidates) {
    const parsed = readJsonFile(candidate);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const version = extractVersion(parsed as Record<string, unknown>);
      if (version !== null) return version;
    }
  }
  return null;
}

/** Read + JSON.parse a file; return the parsed value or null on any error. */
function readJsonFile(filePath: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Extract a non-empty, trimmed `version` string from a record, else null. */
function extractVersion(record: Record<string, unknown>): string | null {
  const version = record.version;
  if (typeof version !== "string" || version.trim() === "") {
    return null;
  }
  return version.trim();
}

// ---------------------------------------------------------------------------
// Semver comparison
// ---------------------------------------------------------------------------

/** Parse a semver core (`MAJOR.MINOR.PATCH`) into a numeric tuple; null if unparseable. */
function parseSemver(version: string): [number, number, number] | null {
  // Strip an optional leading "v" and any pre-release / build suffix (-beta, +build).
  const core = version.trim().replace(/^v/i, "").split(/[-+]/)[0] ?? "";
  const parts = core.split(".");
  const major = Number.parseInt(parts[0] ?? "", 10);
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  const patch = Number.parseInt(parts[2] ?? "0", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return [major, minor, patch];
}

/**
 * Compare installed vs source versions.
 *   - "behind"  → installed is strictly older than source (an update is genuinely needed).
 *   - "in-sync" → installed equals OR is newer than source (no update needed).
 *   - "unknown" → either version is unparseable (no false alarm).
 */
function compareVersions(installed: string, source: string): "behind" | "in-sync" | "unknown" {
  const a = parseSemver(installed);
  const b = parseSemver(source);
  if (a === null || b === null) return "unknown";
  for (let i = 0; i < 3; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai < bi) return "behind";
    if (ai > bi) return "in-sync"; // installed ahead of source → nothing to update
  }
  return "in-sync";
}

// ---------------------------------------------------------------------------
// PluginSyncState verdict
// ---------------------------------------------------------------------------

/**
 * The computed drift verdict for FRD-15's banner.
 * Version-based (FRD-15): the banner fires ONLY on reason "behind".
 */
export type PluginSyncState = {
  /** Installed semver version (installed_plugins.json), or null if not installed/unreadable. */
  installedVersion: string | null;
  /** Source semver version (plugin/.claude-plugin/plugin.json), or null if unreadable. */
  sourceVersion: string | null;
  /** True ONLY when the installed version is strictly behind the source version. */
  drift: boolean;
  /** The drift reason. Only "behind" raises the banner. */
  reason: "behind" | "in-sync" | "unknown";
  /** Human (Spanish) one-liner for the banner, always non-empty. */
  detail: string;
  /** Separate installed-cache verdicts. Optional only for legacy API fixtures. */
  runtimes?: {
    readonly claude: RuntimePluginSyncVerdict;
    readonly codex: RuntimePluginSyncVerdict;
  };
};

export type RuntimePluginSyncVerdict = {
  readonly runtime: "claude" | "codex";
  readonly installedVersion: string | null;
  readonly sourceVersion: string | null;
  readonly drift: boolean;
  readonly reason: "behind" | "in-sync" | "unknown";
};

/** Resolve `~/.claude` from env, falling back to `os.homedir()`. */
function resolveClaudeHome(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  return path.join(home, ".claude");
}

/**
 * Resolve the factory root: PANDACORP_FACTORY_ROOT env override if set,
 * otherwise one level up from cwd (matching lib/config.ts resolveFactoryRoot).
 */
function resolveFactoryRootLocal(): string {
  const override = process.env.PANDACORP_FACTORY_ROOT;
  if (override && override.trim() !== "") {
    return path.resolve(override);
  }
  return path.resolve(process.cwd(), "..");
}

/** Build the Spanish detail one-liner for the banner. */
function buildDetail(
  installedVersion: string | null,
  sourceVersion: string | null,
  reason: PluginSyncState["reason"],
): string {
  const inst = installedVersion ? `v${installedVersion}` : "desconocida";
  const src = sourceVersion ? `v${sourceVersion}` : "desconocida";

  switch (reason) {
    case "behind":
      return `instalado ${inst} · hay una versión más nueva del plugin (${src})`;
    case "in-sync":
      return `instalado ${inst} · plugin al día`;
    case "unknown":
      return "estado desconocido (plugin no instalado o versión no disponible)";
  }
}

/**
 * Compose the readers into the version-based drift verdict.
 *
 * Reads:
 *   - HOME / USERPROFILE → ~/.claude/plugins/installed_plugins.json (`version`)
 *   - PANDACORP_FACTORY_ROOT (or ../cwd) → plugin/.claude-plugin/plugin.json (`version`)
 *
 * Defensive contract (REQ-15-005): any unreadable/unparseable input → reason "unknown",
 * drift false (NEVER a false alarm). Only a strictly-older installed version raises drift.
 * Never throws. Read-only.
 */
export function getPluginSyncState(): PluginSyncState {
  const installedVersion = readInstalledVersion(resolveClaudeHome());
  const sourceVersion = readPluginSourceVersion(resolveFactoryRootLocal());

  let reason: PluginSyncState["reason"];
  if (installedVersion === null || sourceVersion === null) {
    reason = "unknown";
  } else {
    reason = compareVersions(installedVersion, sourceVersion);
  }

  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  const codexInstalled = readCodexInstalledVersion(path.join(home, ".codex"));
  const codexSource = readCodexSourceVersion(resolveFactoryRootLocal());
  const codexReason =
    codexInstalled === null || codexSource === null
      ? "unknown"
      : compareVersions(codexInstalled, codexSource);
  const runtimes = {
    claude: {
      runtime: "claude" as const,
      installedVersion,
      sourceVersion,
      drift: reason === "behind",
      reason,
    },
    codex: {
      runtime: "codex" as const,
      installedVersion: codexInstalled,
      sourceVersion: codexSource,
      drift: codexReason === "behind",
      reason: codexReason,
    },
  };
  const drift = runtimes.claude.drift || runtimes.codex.drift;
  const aggregateReason: PluginSyncState["reason"] = drift ? "behind" : reason;
  const detail = drift
    ? `Claude: ${buildDetail(installedVersion, sourceVersion, reason)} · Codex: ${buildDetail(codexInstalled, codexSource, codexReason)}`
    : buildDetail(installedVersion, sourceVersion, reason);

  return { installedVersion, sourceVersion, drift, reason: aggregateReason, detail, runtimes };
}
