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
type FreshnessBand = "live" | "aging" | "no-signal";

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

/** Producer clocks accepted by all build liveness surfaces. */
export interface BuildClocks {
  supervisorHeartbeat?: string | null;
  lastEventAt?: string | null;
  leaseRenewedAt?: string;
  leaseTtlSeconds?: number;
}

/** Lease validity uses the producer's own TTL, including TTLs above the legacy status window. */
export function isLeaseFresh(input: BuildClocks, nowMs: number): boolean {
  const leaseMs = Date.parse(input.leaseRenewedAt ?? "");
  return Number.isFinite(leaseMs) && Number.isFinite(input.leaseTtlSeconds) &&
    (input.leaseTtlSeconds ?? 0) > 0 && nowMs - leaseMs < (input.leaseTtlSeconds ?? 0) * 1000;
}

/** Freshest producer instant; a lease contributes only within its own TTL. */
export function latestBuildSignal(input: BuildClocks, nowMs: number): string | null {
  const freshLease = isLeaseFresh(input, nowMs);
  const stamps = [input.supervisorHeartbeat, input.lastEventAt, freshLease ? input.leaseRenewedAt : null]
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  return stamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

/** Running crossed with a lease inside its own TTL or a fresh legacy status/event stamp. */
export function isLive(
  input: BuildClocks & { running?: boolean },
  nowMs: number,
): boolean {
  if (input.running !== true) return false;
  return isLeaseFresh(input, nowMs) || freshnessBand(latestBuildSignal(input, nowMs), nowMs).band !== "no-signal";
}
