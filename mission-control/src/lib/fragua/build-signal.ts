import { freshnessBand } from "@/lib/status/liveness";
/** Serializable build liveness, shared by every project surface. */
export interface BuildSignal {
  readonly kind: "idle" | "live" | "no-signal";
  readonly lastSignalAt: string | null;
  readonly ageMinutes: number | null;
}
/** Authoritative running flag crossed with the freshest producer instant and the hard TTL. */
export function buildSignal(input: {
  running?: boolean;
  supervisorHeartbeat?: string | null;
  lastEventAt?: string | null;
  nowMs: number;
}): BuildSignal {
  const stamps = [input.supervisorHeartbeat, input.lastEventAt].filter(
    (value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)),
  );
  const lastSignalAt = stamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const freshness = freshnessBand(lastSignalAt, input.nowMs);
  return {
    kind: input.running !== true ? "idle" : freshness.band === "no-signal" ? "no-signal" : "live",
    lastSignalAt,
    ageMinutes: freshness.ageMs === null ? null : Math.floor(freshness.ageMs / 60000),
  };
}
