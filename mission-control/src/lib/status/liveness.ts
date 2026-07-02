/**
 * DR-066 consumer-side liveness/freshness — the SINGLE derivation (DR-092) every
 * surface uses to decide whether a build is live and how fresh its signal is.
 *
 * The three graded bands are defined off the producer tick T (the supervisor's
 * time-driven SupervisorTick cadence):
 *   - "live"      — age < 3·T                     → "en vivo"
 *   - "aging"     — 3·T ≤ age < hard TTL           → "datos de hace X" (age stamped)
 *   - "no-signal" — age ≥ hard TTL, or no stamp    → "sin señal" (never the last
 *                    value dressed as current)
 *
 * Liveness NEVER trusts the self-reported flag alone: live ⇔ running AND fresh.
 * A frozen `running: true` with a stale heartbeat is NOT live.
 */

/** T — the producer tick: the supervisor advances `supervisor_heartbeat` every ~minute. */
const SUPERVISOR_TICK_MS = 60_000;

/** "en vivo" band: age < 3·T (tolerates two missed ticks before degrading). */
export const LIVE_WINDOW_MS = 3 * SUPERVISOR_TICK_MS;

/** Hard TTL — the build's 10-minute concurrent-run TTL (DR-066): at/after this, "sin señal". */
export const NO_SIGNAL_TTL_MS = 10 * 60_000;

/** Graded freshness band (DR-066 rule b). */
export type FreshnessBand = "live" | "aging" | "no-signal";

/** A band verdict plus the signal age (null when there is no interpretable signal). */
export interface Freshness {
  band: FreshnessBand;
  /** Milliseconds since the signal stamp; null when the stamp is absent/invalid. */
  ageMs: number | null;
}

/**
 * Grade a signal stamp into the DR-066 freshness bands.
 *
 * @param lastSignalAt - ISO timestamp of the freshest producer signal (heartbeat,
 *   last event, …). Absent/unparseable → "no-signal" (a monitor never guesses).
 * @param nowMs - The caller's clock (epoch ms) — injected for purity/testability.
 */
export function freshnessBand(lastSignalAt: string | null | undefined, nowMs: number): Freshness {
  if (lastSignalAt === null || lastSignalAt === undefined || lastSignalAt.trim() === "") {
    return { band: "no-signal", ageMs: null };
  }
  const stampMs = Date.parse(lastSignalAt);
  if (!Number.isFinite(stampMs)) {
    return { band: "no-signal", ageMs: null };
  }
  // A future stamp (clock skew) reads as age 0 — fresh, never negative.
  const ageMs = Math.max(0, nowMs - stampMs);
  if (ageMs < LIVE_WINDOW_MS) return { band: "live", ageMs };
  if (ageMs < NO_SIGNAL_TTL_MS) return { band: "aging", ageMs };
  return { band: "no-signal", ageMs };
}

/**
 * DR-066 rule (a): liveness = running AND fresh — never the flag alone.
 *
 * "Fresh" here means the heartbeat is inside the hard TTL (a build between long
 * quiet agents may miss the "live" band but is still alive until the TTL).
 *
 * @param input - `running` + `supervisorHeartbeat` from `readStatus`.
 * @param nowMs - The caller's clock (epoch ms).
 */
export function isLive(
  input: { running?: boolean; supervisorHeartbeat?: string },
  nowMs: number,
): boolean {
  if (input.running !== true) return false;
  return freshnessBand(input.supervisorHeartbeat, nowMs).band !== "no-signal";
}
