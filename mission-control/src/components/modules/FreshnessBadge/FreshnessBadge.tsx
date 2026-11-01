"use client";
import { useEffect, useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { t } from "@/lib/copy/copy";
import { type BuildSignal, buildSignal } from "@/lib/fragua/build-signal";
import { formatSignalAge } from "@/lib/fragua/signal-age";
import { freshnessBand } from "@/lib/status/liveness";

export interface FreshnessBadgeProps {
  readonly signal: BuildSignal;
  readonly nowIso: string;
}

/** Shared build chip, regraded from the server instant plus elapsed client time. */
export function FreshnessBadge(props: FreshnessBadgeProps): React.JSX.Element | null {
  const serverMs = Date.parse(props.nowIso);
  const [nowMs, setNowMs] = useState(serverMs);
  useEffect(() => {
    setNowMs(serverMs);
    const start = performance.now();
    const timer = setInterval(() => setNowMs(serverMs + performance.now() - start), 30_000);
    return () => clearInterval(timer);
  }, [serverMs]);
  const initial = props.signal;
  const stamp = initial.lastSignalAt;
  const signal = buildSignal({
    running: initial.kind !== "idle",
    lastEventAt: initial.leaseRenewedAt ? initial.legacySignalAt : stamp,
    leaseRenewedAt: initial.leaseRenewedAt,
    leaseTtlSeconds: initial.leaseTtlSeconds,
    nowMs: nowMs,
  });
  if (signal.kind === "idle") return null;
  const freshness = freshnessBand(stamp, nowMs).band;
  const band = signal.kind === "no-signal" ? "no-signal" : freshness === "no-signal" ? "aging" : freshness;
  const ago = formatSignalAge(signal.ageMinutes);
  return (
    <span data-testid="freshness-badge" data-volatile="" data-band={band}>
      <Chip
        tone={signal.kind === "live" ? "violet" : "coral"}
        icon={signal.kind === "live" ? "loader" : "alert"}
      >
        {signal.kind === "live" ? t("common.build.building") : t("common.build.noSignal", { ago })}
      </Chip>
    </span>
  );
}
