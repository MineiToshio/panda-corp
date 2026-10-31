import type React from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { type CategoryTone, RARITY_TONE } from "@/components/core/Chip/vocabulary";

// ── Tier → CSS token map ──────────────────────────────────────────────────────

/** Maps the legacy 1-indexed tier to the shared rarity presentation. */
const TIER_TONE: Record<TierLevel, CategoryTone> = {
  1: RARITY_TONE.common,
  2: RARITY_TONE.uncommon,
  3: RARITY_TONE.rare,
  4: RARITY_TONE.epic,
  5: RARITY_TONE.legend,
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
  return (
    <span data-testid="tier-badge-root" data-tier={tier} aria-label={`Rango ${name}`} role="img">
      <Chip tone={TIER_TONE[tier]}>
        <span data-testid="tier-badge-name">{name}</span>
      </Chip>
    </span>
  );
}
