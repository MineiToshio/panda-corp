/**
 * WO-02-011 — `phaseFromStatus` pure derivation (CMP-02-phase-from-status, IF-02-phaseFromStatus)
 *
 * Derives the active campaign phase index (0–5) from the same two axes as `deriveColumn`
 * (blueprint §4b, REQ-02-010, AC-02-010.2):
 *   - Card `status` (IdeaStatus from FRD-01)
 *   - Project `phase` (Phase from FRD-01 readStatus)
 *
 * Pure function: no fs, no writes, no network, no Claude calls, no side effects.
 * Never throws. Fallback to `0` (research) for any absent/unrecognized input.
 *
 * Phase index legend:
 *   0 = research · 1 = product · 2 = design · 3 = architecture · 4 = build · 5 = release
 *
 * Mapping table (blueprint §4b):
 *
 *   Card status       | Project phase         | → CampaignPhase
 *   ------------------|-----------------------|----------------
 *   discovered        | —                     | 0 (research)
 *   recommended       | —                     | 0 (research)
 *   in-pipeline       | product               | 1 (product)
 *   in-pipeline       | design                | 2 (design)
 *   in-pipeline       | architecture          | 3 (architecture)
 *   in-pipeline       | implementation        | 4 (build)
 *   in-pipeline       | release               | 4 (build)
 *   in-pipeline       | operation             | 5 (release)
 *   shipped           | —                     | 5 (release)
 *   absent / unrecog. | —                     | 0 (research fallback)
 *
 * Traceability:
 *   AC-02-010.2 — derive active phase from real status; absent → research fallback
 *   REQ-02-010, CMP-02-phase-from-status, IF-02-phaseFromStatus
 */

import type { IdeaStatus } from "../ideas/ideas";
import type { Phase } from "../status/status";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Active campaign phase index: 0–5 (research through release). */
export type CampaignPhase = 0 | 1 | 2 | 3 | 4 | 5;

/** Input for `phaseFromStatus`. Both axes are optional for fail-soft operation. */
export type PhaseFromStatusInput = {
  cardStatus?: IdeaStatus;
  phase?: Phase;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback: research is the first phase and the safe default. */
const FALLBACK: CampaignPhase = 0;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Derive the active campaign phase index from the card status and project phase.
 *
 * - `discovered` / `recommended` → 0 (research — not yet handed off to a project)
 * - `in-pipeline` + project `phase` → 1–5 per the mapping table
 * - `in-pipeline` with no phase (missing project / status.yaml absent) → 0 (fallback)
 * - `shipped` → 5 (release — the campaign completed)
 * - Any other / absent / unrecognized → 0 (fallback, never throws)
 *
 * @param input - Card status and optional project phase (both are optional).
 * @returns Active campaign phase index (0–5). Never throws.
 */
export function phaseFromStatus(input: PhaseFromStatusInput): CampaignPhase {
  const { cardStatus, phase } = input;

  // --- Pre-pipeline: discovered / recommended → research (0) ---
  if (cardStatus === "discovered" || cardStatus === "recommended") {
    return 0;
  }

  // --- Terminal: shipped → release (5) ---
  if (cardStatus === "shipped") {
    return 5;
  }

  // --- In-pipeline: derive from project phase ---
  if (cardStatus === "in-pipeline") {
    return phaseFromProjectPhase(phase);
  }

  // --- Fallback for any other value (discarded, undefined, unrecognized) ---
  return FALLBACK;
}

/**
 * Map the project `phase` to a campaign phase index.
 * Returns `FALLBACK` (0) when phase is undefined or doesn't match a known value.
 */
function phaseFromProjectPhase(phase: Phase | undefined): CampaignPhase {
  if (phase === undefined) {
    return FALLBACK;
  }

  switch (phase) {
    case "product":
      return 1;
    case "design":
      return 2;
    case "architecture":
      return 3;
    case "implementation":
      return 4;
    case "release":
      return 4;
    case "operation":
      return 5;
    default: {
      // Exhaustive guard: TypeScript enforces Phase is a closed union.
      // A defensive default ensures the function never throws if the union is extended.
      const _exhaustive: never = phase;
      void _exhaustive;
      return FALLBACK;
    }
  }
}
