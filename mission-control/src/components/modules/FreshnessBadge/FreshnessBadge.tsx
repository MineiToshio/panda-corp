"use client";

/**
 * FreshnessBadge — DR-066 rule (b): a live surface DECLARES its own freshness in
 * three graded bands instead of passing old data off as current.
 *
 *   live      → "● en vivo"
 *   aging     → "hace N min" (age stamped, never dressed as live)
 *   no-signal → "sin señal"
 *
 * The band comes from the single liveness derivation (`lib/status/liveness`,
 * DR-092). The badge re-grades on a coarse interval so an aging signal degrades
 * on screen without a data change. Carries `data-volatile` (DR-088): its text is
 * time-relative, so the visual gate must not pin it.
 */

import { useEffect, useState } from "react";

import { type FreshnessBand, freshnessBand } from "@/lib/status/liveness";

/** Re-grade cadence — coarse on purpose (band edges are minutes apart). */
const REGRADE_MS = 30_000;

const BAND_LABEL: Readonly<Record<FreshnessBand, string>> = {
  live: "en vivo",
  aging: "datos de hace",
  "no-signal": "sin señal",
};

const BAND_COLOR: Readonly<Record<FreshnessBand, string>> = {
  live: "var(--color-ok, var(--color-accent))",
  aging: "var(--color-warn, var(--color-text-muted, var(--color-text)))",
  "no-signal": "var(--color-text-muted, var(--color-text))",
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  lineHeight: 1,
  padding: "4px 8px",
  borderRadius: "999px",
  border: "0.5px solid var(--color-border-strong)",
  background: "var(--color-card)",
};

export interface FreshnessBadgeProps {
  /** ISO stamp of the freshest producer signal (heartbeat / last event); null = none. */
  lastSignalAt: string | null;
}

/** Whole minutes for the "hace N min" band; hours past 90 min. */
function ageLabel(ageMs: number): string {
  const min = Math.round(ageMs / 60_000);
  if (min <= 90) return `${min} min`;
  return `${Math.round(min / 60)} h`;
}

/**
 * Graded freshness chip for live surfaces (Party, and any future monitor view).
 *
 * @param props.lastSignalAt - Freshest producer signal stamp; absent → "sin señal".
 */
export function FreshnessBadge({ lastSignalAt }: FreshnessBadgeProps): React.JSX.Element {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), REGRADE_MS);
    return () => clearInterval(timer);
  }, []);

  const { band, ageMs } = freshnessBand(lastSignalAt, nowMs);
  const detail = band === "aging" && ageMs !== null ? ` ${ageLabel(ageMs)}` : "";

  return (
    <span
      data-testid="freshness-badge"
      data-band={band}
      data-volatile=""
      style={{ ...BADGE_STYLE, color: BAND_COLOR[band] }}
      title="Frescura de la señal del build (DR-066): en vivo · datos de hace X · sin señal"
    >
      <span aria-hidden="true">{band === "live" ? "●" : "○"}</span>
      {BAND_LABEL[band]}
      {detail}
    </span>
  );
}
