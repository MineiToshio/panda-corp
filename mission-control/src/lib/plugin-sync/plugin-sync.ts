import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Plugin sync readers for FRD-15 — Plugin out-of-sync warning.
 *
 * Platform golden rule (architecture §1/§7): read-only, never call Claude, never write.
 * All three functions are defensive: unreadable/missing inputs → null/false, never throws.
 *
 * Critical invariant (blueprint §1, architecture §4.7):
 *   Drift is determined by comparing the installed `gitCommitSha` against the git HEAD commit
 *   that last touched `plugin/`. The semver `version` field is NEVER used for comparison.
 *
 * Traceability:
 *   IF-15-sync → REQ-15-001 (dirty check), REQ-15-002 (SHA mismatch), REQ-15-005 (read-only)
 *   WO-15-001 → AC-15-001.1..5
 */

/**
 * The key in `plugins/installed_plugins.json` for the pandacorp plugin.
 * Must match exactly (the file uses this as a JSON object key).
 */
const PLUGIN_KEY = "pandacorp@panda-corp";

/**
 * Parse `<claudeHome>/plugins/installed_plugins.json` and return the `gitCommitSha`
 * of the `pandacorp@panda-corp` entry. Reads only `gitCommitSha`, NEVER the semver
 * `version` field (architecture §4.7, AC-15-001.3).
 *
 * @param claudeHome - Path to the user's `~/.claude` directory.
 * @returns The `gitCommitSha` string, or `null` if:
 *   - The file does not exist.
 *   - The file contains invalid JSON.
 *   - There is no `pandacorp@panda-corp` key.
 *   - The entry array is empty.
 *   - The `gitCommitSha` field is absent, empty, or not a non-empty string.
 * Never throws (AC-15-001.2).
 */
export function readInstalledSha(claudeHome: string): string | null {
  const filePath = path.join(claudeHome, "plugins", "installed_plugins.json");
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Expect: { version: 2, plugins: { "pandacorp@panda-corp": [ { gitCommitSha: "..." } ] } }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const root = parsed as Record<string, unknown>;
  const plugins = root.plugins;
  if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) {
    return null;
  }

  const pluginsMap = plugins as Record<string, unknown>;
  const entry = pluginsMap[PLUGIN_KEY];

  // The canonical format is an array of entries. If it is not an array, attempt to
  // read it as a single object (lenient, regression I3 — no throw, return null or SHA).
  if (!Array.isArray(entry)) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    return extractSha(entry as Record<string, unknown>);
  }

  // Array format: use the first element (regression I2: empty array → null).
  if (entry.length === 0) {
    return null;
  }

  const first = entry[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return null;
  }

  return extractSha(first as Record<string, unknown>);
}

/**
 * Extract and validate a `gitCommitSha` from a plugin entry object.
 * Returns the SHA string only when it is a non-empty string.
 * Returns `null` for absent, empty, or non-string values (regression B1').
 */
function extractSha(entry: Record<string, unknown>): string | null {
  const sha = entry.gitCommitSha;
  // Only accept non-empty strings (regression B1': typeof 0 === "number" != "string").
  if (typeof sha !== "string" || sha.trim() === "") {
    return null;
  }
  // Trim surrounding whitespace so equality comparisons with pluginHeadSha never
  // produce false-drift alarms (SHA hygiene, AC-15-001.3 invariant / WO-15-002 verdict).
  return sha.trim();
}

/**
 * Return the 40-char commit SHA of the most recent commit that touched `plugin/`
 * in the factory git repo, using `git log -1 --format=%H -- plugin/`.
 *
 * @param factoryRoot - Absolute path to the factory git repo root.
 * @returns The 40-char hex SHA, or `null` if:
 *   - `factoryRoot` is not a git repo.
 *   - `git` is not available.
 *   - `plugin/` has never been touched in this repo.
 *   - Any other error condition.
 * Never throws (AC-15-001.4). Uses the arg-array form of execFileSync (no shell injection).
 */
export function readPluginHeadSha(factoryRoot: string): string | null {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%H", "--", "plugin/"], {
      cwd: factoryRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const sha = output.trim();
    // git log returns empty string when no commit touches plugin/.
    if (sha === "") {
      return null;
    }
    return sha;
  } catch {
    return null;
  }
}

/**
 * Return `true` when `git status --porcelain -- plugin/` reports any output (staged
 * or unstaged changes, untracked files) under `plugin/`.
 *
 * @param factoryRoot - Absolute path to the factory git repo root.
 * @returns `true` if there are uncommitted changes under `plugin/`.
 *          `false` when `plugin/` is clean, when `factoryRoot` is not a git repo,
 *          or on any other error condition. Never throws (AC-15-001.5, REQ-15-005).
 * Uses the arg-array form of execFileSync (no shell injection).
 */
export function readPluginDirty(factoryRoot: string): boolean {
  try {
    const output = execFileSync("git", ["status", "--porcelain", "--", "plugin/"], {
      cwd: factoryRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// WO-15-002 — PluginSyncState verdict
// ---------------------------------------------------------------------------

/**
 * The computed drift verdict for FRD-15's banner.
 *
 * Traceability:
 *   IF-15-sync (blueprint §3) · WO-15-002 AC-15-002.1..7
 */
export type PluginSyncState = {
  /** gitCommitSha of pandacorp@panda-corp, or null if not installed/unreadable. */
  installedSha: string | null;
  /** git log -1 --format=%H -- plugin/ (null if git/path unreadable). */
  pluginHeadSha: string | null;
  /** git status --porcelain -- plugin/ is non-empty. */
  dirty: boolean;
  /** True only on a positive drift signal (dirty or two known SHAs that differ). */
  drift: boolean;
  /** The drift reason. "unknown" never raises the alarm (REQ-15-005). */
  reason: "uncommitted" | "behind" | "both" | "in-sync" | "unknown";
  /** Human (Spanish) one-liner for the banner, always non-empty. */
  detail: string;
};

/**
 * Resolve the user's home directory from env, falling back to `os.homedir()`.
 * Separate from lib/config.ts to keep plugin-sync.ts self-contained (no circular dep).
 */
function resolveClaudeHome(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  return path.join(home, ".claude");
}

/**
 * Resolve the factory root: use PANDACORP_FACTORY_ROOT env override if set,
 * otherwise one level up from cwd (matching lib/config.ts resolveFactoryRoot).
 */
function resolveFactoryRootLocal(): string {
  const override = process.env.PANDACORP_FACTORY_ROOT;
  if (override && override.trim() !== "") {
    return path.resolve(override);
  }
  return path.resolve(process.cwd(), "..");
}

/**
 * Check whether one SHA is "equal" to another under the prefix-safe rule
 * (AC-15-002.6): an abbreviated installed SHA that is a prefix of the full
 * plugin HEAD SHA counts as equal (no spurious "behind" alarm).
 *
 * Both directions are checked: installed is a prefix of head, OR head is a
 * prefix of installed (handles future format changes gracefully).
 */
function shaEqual(installed: string, head: string): boolean {
  if (installed === head) return true;
  // Prefix-safe: one starts with the other (shorter is the abbreviation)
  if (head.startsWith(installed) || installed.startsWith(head)) return true;
  return false;
}

/**
 * Build the Spanish detail one-liner for the banner.
 * Blueprint §2 example: "instalado 18a9389 · hay cambios sin commitear"
 */
/** "instalado <sha> · <tail>" when the SHA is known, else `fallback`. */
function withInstalledPrefix(
  shortInstalled: string | null,
  tail: string,
  fallback: string,
): string {
  return shortInstalled ? `instalado ${shortInstalled} · ${tail}` : fallback;
}

function buildDetail(
  installedSha: string | null,
  pluginHeadSha: string | null,
  reason: PluginSyncState["reason"],
): string {
  const shortInstalled = installedSha ? installedSha.slice(0, 7) : null;
  const shortHead = pluginHeadSha ? pluginHeadSha.slice(0, 7) : null;
  const headSuffix = shortHead ? ` (${shortHead})` : "";

  switch (reason) {
    case "uncommitted":
      return withInstalledPrefix(
        shortInstalled,
        "hay cambios sin commitear",
        "hay cambios sin commitear en plugin/",
      );
    case "behind":
      return withInstalledPrefix(
        shortInstalled,
        `el plugin instalado está atrás del HEAD${headSuffix}`,
        `el plugin instalado está atrás del HEAD${headSuffix}`,
      );
    case "both":
      return withInstalledPrefix(
        shortInstalled,
        "atrás del HEAD y hay cambios sin commitear",
        "atrás del HEAD y hay cambios sin commitear en plugin/",
      );
    case "in-sync":
      return withInstalledPrefix(shortInstalled, "plugin al día", "plugin al día");
    case "unknown":
      return withInstalledPrefix(
        shortInstalled,
        "estado desconocido (no se puede verificar)",
        "estado desconocido (plugin no instalado o repo no disponible)",
      );
  }
}

/**
 * Compose the three primitive readers into the drift verdict.
 *
 * Reads paths from the environment:
 *   - PANDACORP_FACTORY_ROOT (or ../cwd) → git probes
 *   - HOME / USERPROFILE → ~/.claude/plugins/installed_plugins.json
 *
 * Defensive contract (blueprint §3, REQ-15-005):
 *   - Unknown/unreadable inputs → reason "unknown", drift false (no false alarm).
 *   - Only a POSITIVE signal (dirty, or two known SHAs that differ) raises drift.
 *   - A null SHA never produces reason "behind".
 *
 * Prefix-safe SHA comparison (AC-15-002.6): abbreviated installed SHA that is
 * a prefix of the full HEAD SHA counts as equal.
 *
 * Never throws. Read-only.
 */
export function getPluginSyncState(): PluginSyncState {
  const factoryRoot = resolveFactoryRootLocal();
  const claudeHome = resolveClaudeHome();

  const installedSha = readInstalledSha(claudeHome);
  const pluginHeadSha = readPluginHeadSha(factoryRoot);
  const dirty = readPluginDirty(factoryRoot);

  // Determine reason using the precedence matrix (AC-15-002.1..5):
  //   1. dirty && known-SHAs-differ → "both"
  //   2. dirty (regardless of SHAs)  → "uncommitted"
  //   3. both SHAs known && differ   → "behind"
  //   4. both SHAs known && equal    → "in-sync"
  //   5. any null SHA && not dirty   → "unknown"
  let reason: PluginSyncState["reason"];

  const bothKnown = installedSha !== null && pluginHeadSha !== null;
  const shasDiffer = bothKnown && !shaEqual(installedSha as string, pluginHeadSha as string);

  if (dirty && shasDiffer) {
    reason = "both";
  } else if (dirty) {
    reason = "uncommitted";
  } else if (shasDiffer) {
    reason = "behind";
  } else if (bothKnown) {
    // Both known and equal (prefix-safe)
    reason = "in-sync";
  } else {
    // At least one SHA unknown and not dirty → unknown (no false alarm)
    reason = "unknown";
  }

  const drift = reason !== "in-sync" && reason !== "unknown";
  const detail = buildDetail(installedSha, pluginHeadSha, reason);

  return { installedSha, pluginHeadSha, dirty, drift, reason, detail };
}
