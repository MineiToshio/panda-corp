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
 * Frozen to enforce the readonly invariant at runtime.
 */
export const BUILD_MODES: readonly BuildModeInfo[] = Object.freeze([
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
] as const satisfies BuildModeInfo[]);

/** Default mode when no choice has been persisted (AC-11-001.3). */
export const DEFAULT_BUILD_MODE: BuildMode = "balanced";
