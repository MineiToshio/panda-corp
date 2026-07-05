/**
 * WO-18-003 — `IF-18-pulse` pure derivation helper.
 *
 * Computes the "Pulso de la fábrica" signals from pre-counted factory counts.
 * Pure: no I/O, no side-effects, deterministic given the same inputs. Never throws.
 *
 * The caller (CMP-18-page / Server Component) is responsible for reading the
 * lib/** layer and computing the counts before calling this function.
 *
 * Signals (≤5, AC-18-003.1):
 *   1. ideasAlive        — ideas in the funnel (discovered/recommended/in-pipeline)
 *   2. inConstructionLive — builds with a recent event (FRD-12 "En vivo")
 *   3. ideasShipped      — shipped ideas (launched "release" phase)
 *   4. ownerWaiting      — items genuinely requiring the owner (pending decisions etc.)
 *   5. conversionPct     — idea→shipped as an integer percentage (safe, 0 when no ideas)
 *
 * The live/stale split (AC-18-003.2) is carried inside the result so the component
 * can render both signals without additional computation.
 *
 * Traceability: WO-18-003 → IF-18-pulse → AC-18-003.1..4 → REQ-18-013/014.
 */

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Pre-counted factory signals fed into the pulse derivation.
 *
 * All counts are non-negative integers; the caller ensures correctness.
 * The pure function never reads from disk or network.
 */
export type PulseInput = {
  /** Total ideas in play: discovered + recommended + in-pipeline (non-shipped, non-discarded). */
  ideasAlive: number;
  /**
   * Launched count (internal or external), from `countLaunched` (`lib/ideas/ideas.ts`,
   * DR-085/DR-115 bridge) — shipped cards plus portfolio projects at `phase: "release"`,
   * de-duplicated. NOT a local re-filter of ideas by `status: "shipped"` alone, or this
   * drifts from the Logros Informe's launched count (DR-115).
   */
  ideasShipped: number;
  /**
   * In-construction builds whose last event is within the freshness threshold
   * (FRD-12 "En vivo" / live indicator, AC-18-003.2).
   */
  inConstructionLive: number;
  /**
   * In-construction builds whose last event is BEYOND the freshness threshold
   * (FRD-12 "Sin señal" / stale indicator, AC-18-003.2).
   */
  inConstructionStale: number;
  /**
   * Items genuinely requiring the owner (pending decisions, review-launch, memory
   * backlog nudge, undiscovered ideas awaiting prioritization). Does NOT include
   * running builds, auto-retried failed WOs, or advance_pending (REQ-18-010/011).
   */
  ownerWaiting: number;
};

/**
 * Derived pulse signals (≤5) ready for the component to render.
 *
 * All numeric values are safe (no NaN, no Infinity, no negatives).
 * `conversionPct` is a rounded integer percentage [0, 100] (AC-18-003.3).
 */
export type PulseResult = {
  /** Pass-through: ideas in the funnel. */
  ideasAlive: number;
  /** Pass-through: launched count (internal or external) — see `PulseInput.ideasShipped`. */
  ideasShipped: number;
  /**
   * Live in-construction count (FRD-12 "En vivo", AC-18-003.2).
   * Counts toward the 5-signal budget as one signal (combined with stale via hasStale).
   */
  inConstructionLive: number;
  /** Stale in-construction count (FRD-12 "Sin señal", AC-18-003.2). */
  inConstructionStale: number;
  /** Items genuinely awaiting the owner. */
  ownerWaiting: number;
  /**
   * idea→shipped conversion: Math.round(ideasShipped / ideasAlive * 100).
   * Safe: returns 0 when ideasAlive = 0 (no divide-by-zero, AC-18-003.4).
   * Clamped to [0, 100] to guard against impossible ratios.
   */
  conversionPct: number;
  /**
   * True when the factory is in a calm/healthy state requiring no attention:
   * no stale builds, no owner-waiting items, and no active builds in progress.
   * Used to render the "al día" state (exception-first UX, FRD-18 AC / REQ-18-003).
   */
  calm: boolean;
  /**
   * True when any stale (no-signal) builds exist.
   * Surfaces the FRD-12 no-signal alarm without a separate signal slot.
   */
  hasStale: boolean;
};

// ---------------------------------------------------------------------------
// Pure derivation
// ---------------------------------------------------------------------------

/**
 * Compute the "Pulso de la fábrica" signals from pre-counted factory data.
 *
 * @param input - Pre-counted factory signals (read by the Server Component from lib/**).
 * @returns A `PulseResult` with ≤5 display signals. Never throws.
 *
 * Traceability:
 *   AC-18-003.1 — ≤5 signals present in result.
 *   AC-18-003.2 — live/stale split preserved in inConstructionLive + inConstructionStale.
 *   AC-18-003.3 — conversionPct = round(shipped / alive * 100), safe.
 *   AC-18-003.4 — fresh factory: 0% conversion, calm=true, no throw.
 */
export function pulse(input: PulseInput): PulseResult {
  const { ideasAlive, ideasShipped, inConstructionLive, inConstructionStale, ownerWaiting } = input;

  // --- AC-18-003.3: safe conversion (no divide-by-zero) ---
  // conversionPct = round(shipped / alive * 100), clamped to [0, 100].
  // When ideasAlive = 0 (fresh factory, AC-18-003.4) → 0%, never NaN.
  const conversionPct =
    ideasAlive > 0 ? Math.min(100, Math.max(0, Math.round((ideasShipped / ideasAlive) * 100))) : 0;

  // --- AC-18-003.2: stale flag ---
  const hasStale = inConstructionStale > 0;

  // --- Calm state (exception-first, REQ-18-003 / FRD-18) ---
  // Calm = nothing needs attention: no owner-waiting, no stale builds, no active builds.
  const calm = ownerWaiting === 0 && !hasStale && inConstructionLive === 0;

  return {
    ideasAlive,
    ideasShipped,
    inConstructionLive,
    inConstructionStale,
    ownerWaiting,
    conversionPct,
    calm,
    hasStale,
  };
}
