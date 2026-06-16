import { execFileSync } from "node:child_process";
import fs from "node:fs";
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
  return sha;
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
