"use client";

/**
 * FRD-11 — Per-project build mode persistence (IF-11-mode-store, blueprint §2).
 *
 * Client-local only: reads/writes localStorage keyed by project slug.
 * NO writes to status.yaml or any factory/project file (architecture §7, REQ-01-011).
 * This is a UI preference exactly like the dashboard `visto_hasta` marker.
 *
 * Invariants:
 * - Never throws (FREEZE-ON-RED regression anchor).
 * - Returns DEFAULT_BUILD_MODE on any invalid/corrupt stored value (B1', I2, I3).
 * - Per-project isolation: key is scoped to the slug.
 */

import { BUILD_MODES, type BuildMode, DEFAULT_BUILD_MODE } from "./constants";

/** Set of valid BuildMode strings for O(1) membership checks. */
const VALID_MODES: ReadonlySet<string> = new Set<string>(BUILD_MODES.map((m) => m.id));

/** Derive a deterministic, stable localStorage key for a project slug. */
function storageKey(slug: string): string {
  return `mc:build-mode:${slug}`;
}

/**
 * Retrieve the remembered build mode for a project.
 *
 * @param slug - The project slug (any string; empty string → DEFAULT_BUILD_MODE).
 * @returns The persisted BuildMode, or DEFAULT_BUILD_MODE when unset, invalid, or
 *          on any localStorage error (SecurityError, QuotaExceededError, etc.).
 */
export function getRememberedMode(slug: string): BuildMode {
  try {
    const raw = localStorage.getItem(storageKey(slug));

    // Null means the key was never set.
    if (raw === null) return DEFAULT_BUILD_MODE;

    // Reject empty strings (regression I2).
    if (raw.trim() === "") return DEFAULT_BUILD_MODE;

    // Reject non-string stored values encoded as JSON arrays/objects (regression I3).
    // A valid BuildMode is a plain non-empty string — it never starts with '[' or '{'.
    if (raw.startsWith("[") || raw.startsWith("{")) return DEFAULT_BUILD_MODE;

    // Validate against the canonical set (regression B1' — rejects unknown strings,
    // NaN-coerced values, and anything else that is not a valid BuildMode literal).
    if (VALID_MODES.has(raw)) return raw as BuildMode;

    return DEFAULT_BUILD_MODE;
  } catch {
    // localStorage inaccessible (SecurityError, private-browsing restriction, etc.).
    return DEFAULT_BUILD_MODE;
  }
}

/**
 * Persist the build mode choice for a project.
 *
 * @param slug - The project slug.
 * @param mode - A valid BuildMode literal.
 *
 * Writes only to localStorage; never touches any file on disk (architecture §7).
 * Silent on error (quota exceeded, private-browsing, etc.) — the worst outcome is
 * that the choice is not remembered across reloads.
 */
export function rememberMode(slug: string, mode: BuildMode): void {
  try {
    localStorage.setItem(storageKey(slug), mode);
  } catch {
    // Storage unavailable — fail silently (preference loss, not a data loss).
  }
}
