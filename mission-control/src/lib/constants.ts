/**
 * Mission Control — shared constants.
 *
 * No magic strings: all cross-cutting constant values live here.
 * FRD-11 build-mode catalog: IF-11-modes (blueprint §2).
 */

// ---------------------------------------------------------------------------
// FRD-11 — Build mode catalog (IF-11-modes)
// ---------------------------------------------------------------------------

/** Union of all valid build-mode identifiers. */
export type BuildMode = "pro" | "balanced" | "powerful" | "deep";

/** Full descriptor for a single build mode. */
export interface BuildModeInfo {
  /** Stable identifier; never changes between releases. */
  id: BuildMode;
  /** i18n key for the mode label shown in the selector. */
  label: string;
  /** i18n key for the mode description (agents, models, recommended plan). */
  description: string;
  /**
   * The exact command the owner copies into Claude.
   * Balanced: "/pandacorp:implement" (no argument).
   * Others:   "/pandacorp:implement <id>".
   */
  command: string;
}

/**
 * Ordered catalog of build modes (AC-11-001.1 — Pro, Balanced, Powerful, Deep).
 * Deep-frozen: Object.freeze on both the outer array and every entry object so that
 * BUILD_MODES[n].id = "…" throws in strict mode (ESM files are strict by default).
 * This ensures the catalog remains the single source of truth with no mutable singletons.
 */
export const BUILD_MODES: readonly BuildModeInfo[] = Object.freeze(
  (
    [
      {
        id: "pro",
        label: "buildModes.pro.label",
        description: "buildModes.pro.description",
        command: "/pandacorp:implement pro",
      },
      {
        id: "balanced",
        label: "buildModes.balanced.label",
        description: "buildModes.balanced.description",
        command: "/pandacorp:implement",
      },
      {
        id: "powerful",
        label: "buildModes.powerful.label",
        description: "buildModes.powerful.description",
        command: "/pandacorp:implement powerful",
      },
      {
        id: "deep",
        label: "buildModes.deep.label",
        description: "buildModes.deep.description",
        command: "/pandacorp:implement deep",
      },
    ] as const satisfies BuildModeInfo[]
  ).map((m) => Object.freeze(m)),
);

/** Default mode when no choice has been persisted (AC-11-001.3). */
export const DEFAULT_BUILD_MODE: BuildMode = "balanced";

// ---------------------------------------------------------------------------
// FRD-17 — Self-suggestion thresholds (IF-17-suggest, WO-17-003)
// All magic numbers are centralized here per AC-17-003.6.
// ---------------------------------------------------------------------------

/**
 * Minimum number of ideas in the same board column to trigger a `bottleneck` suggestion.
 * (blueprint §4, REQ-17-004)
 */
export const BOTTLENECK_THRESHOLD = 5;

/**
 * A phase running longer than `VELOCITY_FACTOR × portfolio_median` triggers a `velocity` alert.
 * (blueprint §4, REQ-17-004)
 */
export const VELOCITY_FACTOR = 2;

/**
 * A shipped project older than `LAUNCH_REVIEW_DAYS` days triggers a `launch-review` suggestion.
 * Aligns with DR-043 (post-launch review cadence).
 * (blueprint §4, REQ-17-004)
 */
export const LAUNCH_REVIEW_DAYS = 30;

/**
 * Maximum number of events examined for velocity / unused-capability derivations.
 * Must be ≤ 200 (architecture §3 capped tail — AC-17-003.4).
 */
export const SELF_SUGGEST_EVENT_CAP = 200;

// ---------------------------------------------------------------------------
// FRD-17 — Memory-health panel thresholds (CMP-17-health, WO-17-005)
// These control when the nudge appears (AC-17-005.2, REQ-17-005 / REQ-17-008).
// ---------------------------------------------------------------------------

/**
 * Minimum raw-notes count that triggers the memory-health staleness nudge.
 * Below this, no nudge is shown (REQ-17-008: no nagging).
 * (blueprint §3 CMP-17-health, AC-17-005.2)
 */
export const MEMORY_RAW_NOTES_THRESHOLD = 10;

/**
 * Minimum stale days count that triggers the memory-health staleness nudge.
 * Below this, no nudge is shown (REQ-17-008: no nagging).
 * (blueprint §3 CMP-17-health, AC-17-005.2)
 */
export const MEMORY_STALE_DAYS_THRESHOLD = 7;
