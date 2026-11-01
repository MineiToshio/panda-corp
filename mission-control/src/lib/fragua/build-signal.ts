import { type BuildClocks, freshnessBand, isLive, latestBuildSignal } from "@/lib/status/liveness";
/** Serializable build liveness, shared by every project surface. */
export interface BuildSignal {
  readonly kind: "idle" | "live" | "no-signal";
  readonly lastSignalAt: string | null;
  readonly ageMinutes: number | null;
  readonly leaseRenewedAt?: string;
  readonly leaseTtlSeconds?: number;
  /** Preserve legacy provenance so clients cannot extend an expired lease with its own stamp. */
  readonly legacySignalAt?: string | null;
}
/** Authoritative running flag crossed with the freshest producer instant and the hard TTL. */
export function buildSignal(input: BuildClocks & {
  running?: boolean;
  nowMs: number;
}): BuildSignal {
  const lastSignalAt = latestBuildSignal(input, input.nowMs);
  const freshness = freshnessBand(lastSignalAt, input.nowMs);
  return {
    kind: input.running !== true ? "idle" : isLive(input, input.nowMs) ? "live" : "no-signal",
    ...(input.leaseRenewedAt ? {
      leaseRenewedAt: input.leaseRenewedAt,
      leaseTtlSeconds: input.leaseTtlSeconds,
      legacySignalAt: latestBuildSignal({
        supervisorHeartbeat: input.supervisorHeartbeat,
        lastEventAt: input.lastEventAt,
      }, input.nowMs),
    } : {}),
    lastSignalAt,
    ageMinutes: freshness.ageMs === null ? null : Math.floor(freshness.ageMs / 60000),
  };
}
