/**
 * FRD-20 — Project overlay freshness.
 *
 * Tells the owner, in a project's Resumen, whether its Pandacorp overlay (the
 * `.pandacorp/` integration layer, versioned by `overlay_version` in status.yaml)
 * is at the factory's current `OVERLAY_VERSION` or **behind** it — i.e. whether
 * `/pandacorp:upgrade` has work to do.
 *
 * This is the PROJECT-overlay analogue of FRD-15 (which compares the INSTALLED
 * plugin version against the plugin source version). Here we compare:
 *   - project version: `overlay_version` from `<project>/.pandacorp/status.yaml`
 *     (already parsed by readStatus → ProjectStatus.overlayVersion).
 *   - factory version: the `plugin/templates/OVERLAY_VERSION` file — the single
 *     source `/pandacorp:upgrade` syncs a project's overlay up to (DR-051).
 *
 * Platform golden rule (architecture §1/§7): read-only, never calls Claude, never
 * writes. Every reader is defensive: an unreadable/unparseable input yields the
 * explicit `"unknown"` reason (never a false "behind" alarm, never a silent throw).
 *
 * Traceability: IF-20-freshness → REQ-20-001 (verdict), REQ-20-003 (read-only).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "../config/config";

/** The factory's current overlay version file, relative to the factory root. */
const OVERLAY_VERSION_REL = path.join("plugin", "templates", "OVERLAY_VERSION");

/** The command the owner copies + runs to bring an out-of-date overlay up to the factory. */
export const UPGRADE_COMMAND = "/pandacorp:upgrade";

/**
 * The freshness verdict.
 *   - "up-to-date" → the project's overlay equals OR is newer than the factory's (no upgrade needed).
 *   - "behind"     → the project's overlay is strictly older (an upgrade is genuinely available).
 *   - "unknown"    → either version is missing/unparseable (no badge, no false alarm).
 */
type OverlayFreshnessReason = "up-to-date" | "behind" | "unknown";

/** The computed overlay-freshness state for the Resumen badge (FRD-20). */
export type OverlayFreshnessState = {
  /** The project's `overlay_version` (status.yaml), or null if absent/empty. */
  projectVersion: string | null;
  /** The factory's current `OVERLAY_VERSION`, or null if unreadable. */
  factoryVersion: string | null;
  /** The verdict. Only "behind" surfaces the upgrade prompt. */
  reason: OverlayFreshnessReason;
  /** Human (Spanish) one-liner for the badge, always non-empty. */
  detail: string;
  /** The copyable `/pandacorp:upgrade` command (shown only when "behind"). */
  upgradeCommand: string;
};

/**
 * Read the factory's current overlay version from
 * `<factoryRoot>/plugin/templates/OVERLAY_VERSION`.
 *
 * @returns the trimmed version string, or `null` if the file is missing, empty,
 *   or unreadable. Never throws.
 */
export function readFactoryOverlayVersion(factoryRoot: string): string | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(factoryRoot, OVERLAY_VERSION_REL), "utf-8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Semver comparison (mirrors lib/plugin-sync — the second occurrence is tolerated
// per the rule of three; both compare a project/installed version to a source one).
// ---------------------------------------------------------------------------

/** Parse a semver core (`MAJOR.MINOR.PATCH`) into a numeric tuple; null if unparseable. */
function parseSemver(version: string): [number, number, number] | null {
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
 * Compare the project's overlay version against the factory's.
 *   - "behind"      → project strictly older than factory (upgrade available).
 *   - "up-to-date"  → project equals OR is newer than factory.
 *   - "unknown"     → either version is unparseable (no false alarm).
 */
function compareOverlay(projectVersion: string, factoryVersion: string): OverlayFreshnessReason {
  const a = parseSemver(projectVersion);
  const b = parseSemver(factoryVersion);
  if (a === null || b === null) return "unknown";
  for (let i = 0; i < 3; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai < bi) return "behind";
    if (ai > bi) return "up-to-date"; // project ahead of the factory → nothing to upgrade
  }
  return "up-to-date";
}

/** Build the Spanish detail one-liner for the badge. */
function buildDetail(
  projectVersion: string | null,
  factoryVersion: string | null,
  reason: OverlayFreshnessReason,
): string {
  const proj = projectVersion ? `v${projectVersion}` : "desconocida";
  const fac = factoryVersion ? `v${factoryVersion}` : "desconocida";

  switch (reason) {
    case "behind":
      return `este proyecto usa el motor de Pandacorp ${proj} · la fábrica ya va por ${fac}`;
    case "up-to-date":
      return `este proyecto usa el motor de Pandacorp ${fac} · la última versión de la fábrica`;
    case "unknown":
      return "versión del motor de Pandacorp desconocida (no se pudo determinar)";
  }
}

/**
 * Compute the overlay-freshness verdict for a project.
 *
 * @param projectOverlayVersion the project's `overlay_version` (ProjectStatus.overlayVersion),
 *   or undefined/null when status.yaml lacks it.
 * @param factoryRoot the factory root to read OVERLAY_VERSION from (defaults to the
 *   env-aware resolved root, matching the rest of the data layer).
 *
 * Defensive contract (REQ-20-003): any unreadable/unparseable input → reason "unknown",
 * never a false "behind". Never throws. Read-only.
 */
export function getOverlayFreshness(
  projectOverlayVersion: string | null | undefined,
  factoryRoot: string = resolveFactoryRoot(),
): OverlayFreshnessState {
  const projectVersion =
    typeof projectOverlayVersion === "string" && projectOverlayVersion.trim() !== ""
      ? projectOverlayVersion.trim()
      : null;
  const factoryVersion = readFactoryOverlayVersion(factoryRoot);

  const reason: OverlayFreshnessReason =
    projectVersion === null || factoryVersion === null
      ? "unknown"
      : compareOverlay(projectVersion, factoryVersion);

  return {
    projectVersion,
    factoryVersion,
    reason,
    detail: buildDetail(projectVersion, factoryVersion, reason),
    upgradeCommand: UPGRADE_COMMAND,
  };
}
