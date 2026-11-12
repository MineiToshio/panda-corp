import {
  type BuildClocks,
  freshnessBand,
  hasActiveBuild,
  isLive,
  latestBuildSignal,
} from "@/lib/status/liveness";
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
export function buildSignal(
  input: BuildClocks & {
    running?: boolean;
    nowMs: number;
  },
): BuildSignal {
  const live = isLive(input, input.nowMs);
  // A client regrades only public clocks. Withhold invalid/terminal v2 clocks so it cannot revive them.
  const blockedV2 = input.buildRun?.present && !live;
  const lastSignalAt = blockedV2 ? null : latestBuildSignal(input, input.nowMs);
  const leaseRenewedAt = blockedV2
    ? undefined
    : (input.buildRun?.lease?.renewed_at ?? input.leaseRenewedAt);
  const leaseTtlSeconds = input.buildRun?.lease?.ttl_seconds ?? input.leaseTtlSeconds;
  const freshness = freshnessBand(lastSignalAt, input.nowMs);
  return {
    kind: live ? "live" : hasActiveBuild(input) ? "no-signal" : "idle",
    ...(leaseRenewedAt
      ? {
          leaseRenewedAt,
          leaseTtlSeconds,
          legacySignalAt: latestBuildSignal(
            {
              supervisorHeartbeat: input.supervisorHeartbeat,
              lastEventAt: input.lastEventAt,
            },
            input.nowMs,
          ),
        }
      : {}),
    lastSignalAt,
    ageMinutes: freshness.ageMs === null ? null : Math.floor(freshness.ageMs / 60000),
  };
}
