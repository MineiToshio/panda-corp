/**
 * CMP-13-tierbadge — Tier rarity medal badge (WO-13-008, FND-3)
 *
 * Bronze → Legend rarity medal. The tier NAME TEXT always rides alongside
 * the tier color — state is NEVER conveyed by color alone (REQ-13-007).
 *
 * Design contract (rpgSkin.herostat.tierBadge, design-tokens.json):
 *   9px pixel font · color var(--color-base) on tier bg ·
 *   padding 1px 6px · border-radius 4px
 *   Tier colors: --color-tier-1 (Bronce) → --color-tier-5 (Leyenda)
 *
 * Rules:
 *   - Tokens only — zero hardcoded colors.
 *   - data-tier attribute present for non-color signal (a11y + testing).
 *   - aria-label in Spanish (REQ-13-008).
 *   - tabular-nums applied globally; no extra assertion needed here.
 *
 * Server Component — pure, no "use client".
 *
 * Traceability:
 *   AC-WO-13-008: TierBadge · text+color (never color-alone) · tokens · aria-label
 *   CMP-13-tierbadge → WO-13-008 → FRD-13 REQ-13-002,007,008
 */

import type React from "react";

// ── Tier → CSS token map ──────────────────────────────────────────────────────

/** Maps 1-indexed tier to its CSS custom property. Never a hardcoded hex. */
const TIER_COLOR_TOKEN: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "var(--color-tier-1)",
  2: "var(--color-tier-2)",
  3: "var(--color-tier-3)",
  4: "var(--color-tier-4)",
  5: "var(--color-tier-5)",
};

// ── Props ──────────────────────────────────────────────────────────────────────

type TierLevel = 1 | 2 | 3 | 4 | 5;

export type TierBadgeProps = {
  /** Tier level 1–5 (Bronze=1 … Legend=5). */
  tier: TierLevel;
  /**
   * Human-readable tier name in Spanish.
   * E.g. "Bronce", "Plata", "Oro", "Platino", "Leyenda".
   * Also accepts chain-specific display names (e.g. "Constructor prolífico").
   * ALWAYS rendered as visible text — tier is never color-alone.
   */
  name: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * TierBadge — the rarity medal label for cumulative chains.
 *
 * Used inline in ChainCard / herostat tier pip row (FRD-10).
 * The name text is mandatory and always visible — color is reinforcement only.
 *
 * Server Component: pure, deterministic, no I/O.
 */
export function TierBadge({ tier, name }: TierBadgeProps): React.JSX.Element {
  const colorToken = TIER_COLOR_TOKEN[tier];

  return (
    <span
      data-testid="tier-badge-root"
      data-tier={tier}
      aria-label={`Rango ${name}`}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-pixel)",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--color-base)",
        background: colorToken,
        padding: "1px 6px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Name text ALWAYS visible — tier is never color-alone (REQ-13-007) */}
      <span data-testid="tier-badge-name">{name}</span>
    </span>
  );
}
