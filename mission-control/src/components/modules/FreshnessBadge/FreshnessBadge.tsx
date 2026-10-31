"use client";
import { useEffect, useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { t } from "@/lib/copy/copy";
import { type BuildSignal, buildSignal } from "@/lib/fragua/build-signal";
import { formatSignalAge } from "@/lib/fragua/signal-age";
import { freshnessBand } from "@/lib/status/liveness";

/** The legacy timestamp prop remains accepted until its last scene consumer is retired. */
export type FreshnessBadgeProps =
  | { signal: BuildSignal; nowIso: string; lastSignalAt?: never }
  | { lastSignalAt: string | null; signal?: never; nowIso?: string };

/** Shared build chip, regraded from the server instant plus elapsed client time. */
export function FreshnessBadge(props: FreshnessBadgeProps): React.JSX.Element | null {
  const [legacyNow] = useState(() => Date.now());
  const serverMs = props.nowIso ? Date.parse(props.nowIso) : legacyNow;
  const [nowMs, setNowMs] = useState(serverMs);
  useEffect(() => {
    setNowMs(serverMs);
    const start = performance.now();
    const timer = setInterval(() => setNowMs(serverMs + performance.now() - start), 30_000);
    return () => clearInterval(timer);
  }, [serverMs]);
  const initial = props.signal;
  const stamp = initial?.lastSignalAt ?? props.lastSignalAt ?? null;
  const signal = buildSignal({
    running: initial ? initial.kind !== "idle" : true,
    lastEventAt: stamp,
    nowMs: nowMs,
  });
  if (signal.kind === "idle") return null;
  const band = freshnessBand(stamp, nowMs).band;
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
