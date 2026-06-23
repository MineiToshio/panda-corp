/**
 * IF-18-card — per-project card derivation (WO-18-004, FRD-18)
 *
 * Pure derivation helper: given a project's status snapshot and the current
 * time, produces all the flags and values needed to render a Cartera card.
 *
 * Pure: no I/O, no fs, no network, no side effects. Never throws.
 *
 * Traceability:
 *   AC-18-004.1 (REQ-18-015)  phase+version, WO progress, age-in-stage, next command
 *   AC-18-004.2 (REQ-18-016)  isLive / isNoSignal based on lastEventAt freshness
 *   AC-18-004.3 (REQ-18-017)  isStalled when phase age > STALENESS_THRESHOLD_DAYS
 *   AC-18-004.4 (REQ-18-018)  blockerReason from failing WO (passed in by caller)
 *   AC-18-004.5 (REQ-18-019)  isShipped for launched "release" phase + /pandacorp:review-launch
 *   AC-18-004.7               thresholds read from lib/constants — no magic numbers
 */

import { FRESHNESS_THRESHOLD_MS, STALENESS_THRESHOLD_DAYS } from "@/lib/constants";
import type { Phase } from "@/lib/status/status";

/**
 * Below this age (in full days) a non-shipped project shows the neutral
 * "Nd en fase" chip instead of staying silent — it is "young in phase", not
 * stalled. Mirrors the prototype's `fase_dias < 5` branch (dashboardView, ~L719).
 */
const YOUNG_IN_PHASE_MAX_DAYS = 5;

/** Map a Phase to its short Spanish display label (prototype `LBL`). */
const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  product: "Producto",
  design: "Diseño",
  architecture: "Arquitectura",
  implementation: "Implementación",
  release: "Release",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input bag for one project card derivation. */
export type CardInput = {
  /** Project name, for display. */
  name: string;
  /** Current phase from status.yaml. */
  phase: Phase;
  /** Version string from status.yaml (e.g. "v1"). */
  version: string;
  /** True when the build engine is actively running for this project. */
  running: boolean;
  /** Count of work orders in done/review state. */
  workOrdersDone: number;
  /** Total work order count. */
  workOrdersTotal: number;
  /**
   * ISO 8601 timestamp when the project entered its current phase.
   * Undefined when not available in status.yaml (ageInStageDays will be undefined).
   */
  phaseStartedAt: string | undefined;
  /**
   * ISO 8601 timestamp of the most recent event for this project.
   * Null or undefined when no events have been emitted yet.
   */
  lastEventAt: string | null | undefined;
  /**
   * The reason text from the most recent failing/blocked work order, or undefined
   * when no WO is currently failing. Supplied by the caller (from listWorkOrders).
   * An empty string is treated as undefined (no blocker).
   */
  failedWoReason: string | undefined;
  /**
   * The current wall-clock time in milliseconds (Date.now()).
   * Supplied by the caller so this function is deterministic in tests.
   */
  nowMs: number;
};

/** Work-order progress counts. */
type WoProgress = {
  done: number;
  total: number;
  /** Percentage, rounded to the nearest integer. */
  pct: number;
};

/** Derived card data — everything the Cartera component needs to render. */
export type CardData = {
  /** Project name. */
  name: string;
  /** Current phase label. */
  phase: Phase;
  /** Short Spanish phase label for display (e.g. "Implementación"). */
  phaseLabel: string;
  /** Version string (e.g. "v1"). */
  version: string;
  /** Work-order progress. */
  woProgress: WoProgress;
  /**
   * Number of full days the project has been in its current phase.
   * Undefined when phaseStartedAt is not available.
   */
  ageInStageDays: number | undefined;
  /** Next /pandacorp:* command the operator should run. */
  nextCommand: string;
  /**
   * True when the build engine is running AND the last event is fresh
   * (within FRESHNESS_THRESHOLD_MS). Shows "en vivo".
   */
  isLive: boolean;
  /**
   * True when the build engine is running BUT the last event is older than
   * FRESHNESS_THRESHOLD_MS (or no event exists). Shows "sin señal".
   * Mutually exclusive with isLive.
   */
  isNoSignal: boolean;
  /**
   * True when the project has been in its current phase for more than
   * STALENESS_THRESHOLD_DAYS. Shows "estancado".
   */
  isStalled: boolean;
  /**
   * True for launched ("release") phase projects (DR-085: the old "operation" phase).
   * Shows "estable · en operación".
   */
  isShipped: boolean;
  /**
   * True when the project is non-shipped and has been in its current phase for
   * fewer than YOUNG_IN_PHASE_MAX_DAYS. Drives the neutral "Nd en fase" chip
   * (prototype's `fase_dias < 5` branch). Mutually exclusive with isStalled.
   */
  isYoungInPhase: boolean;
  /**
   * Inline blocker reason from the most recent failing/blocked WO.
   * Undefined when no WO is failing.
   */
  blockerReason: string | undefined;
  /**
   * ISO timestamp of the last event, preserved for display when isNoSignal.
   * Undefined when not relevant.
   */
  lastEventAt: string | undefined;
};

// ---------------------------------------------------------------------------
// Phase → next command map (AC-18-004.1, AC-18-004.5)
// ---------------------------------------------------------------------------

/**
 * The /pandacorp:review-launch command is the next action for shipped projects
 * (AC-18-004.5, REQ-18-019, DR-043).
 */
const CMD_REVIEW_LAUNCH = "/pandacorp:review-launch";

/**
 * Map each phase to the primary next command.
 * Construction (implementation) → release (launch it).
 * Launched (release) → review-launch (the shipped follow-up, DR-043 / DR-085).
 */
const PHASE_TO_COMMAND: Readonly<Record<Phase, string>> = {
  product: "/pandacorp:design",
  design: "/pandacorp:blueprint",
  architecture: "/pandacorp:implement",
  implementation: "/pandacorp:release",
  release: CMD_REVIEW_LAUNCH,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive WO progress — pure, division-safe. */
function deriveProgress(done: number, total: number): WoProgress {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/** Derive age in full days since `startedAt`. Returns undefined on invalid/missing input. */
function deriveAgeDays(phaseStartedAt: string | undefined, nowMs: number): number | undefined {
  if (!phaseStartedAt) return undefined;
  const startMs = new Date(phaseStartedAt).getTime();
  if (!Number.isFinite(startMs)) return undefined;
  const deltaMs = nowMs - startMs;
  if (deltaMs < 0) return 0; // clock skew guard
  return Math.floor(deltaMs / (24 * 60 * 60 * 1000));
}

/**
 * Derive the mutually-exclusive freshness flags (AC-18-004.2).
 * Only meaningful while the build is actively running; a non-running project is
 * neither live nor no-signal.
 */
function deriveFreshness(
  running: boolean,
  lastEventAt: string | null | undefined,
  nowMs: number,
): { isLive: boolean; isNoSignal: boolean } {
  if (!running) return { isLive: false, isNoSignal: false };
  if (!lastEventAt) return { isLive: false, isNoSignal: true }; // no event yet → no-signal
  const ageMs = nowMs - new Date(lastEventAt).getTime();
  const isLive = Number.isFinite(ageMs) && ageMs < FRESHNESS_THRESHOLD_MS;
  return { isLive, isNoSignal: !isLive };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive all display data for one project's Cartera card.
 *
 * Pure: same inputs always yield the same output.
 * Never throws: guards all numeric and date operations.
 *
 * @param input - Project snapshot and current time.
 * @returns CardData ready for rendering by the Cartera component.
 */
export function deriveCard(input: CardInput): CardData {
  const {
    name,
    phase,
    version,
    running,
    workOrdersDone,
    workOrdersTotal,
    phaseStartedAt,
    lastEventAt,
    failedWoReason,
    nowMs,
  } = input;

  // --- WO progress ---
  const woProgress = deriveProgress(workOrdersDone, workOrdersTotal);

  // --- Age in stage ---
  const ageInStageDays = deriveAgeDays(phaseStartedAt, nowMs);

  // --- Next command (AC-18-004.1, AC-18-004.5) ---
  const nextCommand = PHASE_TO_COMMAND[phase] ?? CMD_REVIEW_LAUNCH;

  // --- Freshness flags (AC-18-004.2) ---
  const { isLive, isNoSignal } = deriveFreshness(running, lastEventAt, nowMs);

  // --- Staleness flag (AC-18-004.3) ---
  const isStalled = ageInStageDays !== undefined && ageInStageDays > STALENESS_THRESHOLD_DAYS;

  // --- Shipped flag (AC-18-004.5) — launched "release" phase (DR-085) ---
  const isShipped = phase === "release";

  // --- Young-in-phase flag (prototype "Nd en fase" neutral chip) ---
  const isYoungInPhase =
    !isShipped && ageInStageDays !== undefined && ageInStageDays < YOUNG_IN_PHASE_MAX_DAYS;

  // --- Blocker reason (AC-18-004.4) — empty string normalised to undefined ---
  const blockerReason =
    failedWoReason !== undefined && failedWoReason.trim() !== "" ? failedWoReason : undefined;

  // --- lastEventAt for display (preserved when no-signal, others don't need it) ---
  const lastEventAtDisplay =
    lastEventAt !== null && lastEventAt !== undefined ? lastEventAt : undefined;

  return {
    name,
    phase,
    phaseLabel: PHASE_LABELS[phase] ?? phase,
    version,
    woProgress,
    ageInStageDays,
    nextCommand,
    isLive,
    isNoSignal,
    isStalled,
    isShipped,
    isYoungInPhase,
    blockerReason,
    lastEventAt: lastEventAtDisplay,
  };
}
