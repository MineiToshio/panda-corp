/**
 * lib/achievements/tiers.ts — Chain-tier RARITY names + colors (FRD-10)
 *
 * THE single source for the 5 chain-tier rarity labels and their colors. Both the
 * Misiones ChainCard and the Estadísticas StatsPanel read from here, so a tier's
 * name/color can never drift between the two surfaces.
 *
 * Rarity names per FRD-10 ("5 tiers — Común → Poco común → Raro → Épico → Leyenda"),
 * matching the prototype TIERN array. NOT metal names (Bronce/Plata/…). 0-indexed by
 * tier index (the same `currentTierIndex` carried on ChainState; -1 = no tier).
 *
 * Colors map to the --color-tier-N tokens (with agent-token fallbacks), matching the
 * prototype TIERC palette. Pure data + helpers — no I/O.
 */

/** The 5 chain-tier rarity names, 0-indexed (Común → Leyenda). Prototype TIERN. */
const TIER_RARITY_NAMES = ["Común", "Poco común", "Raro", "Épico", "Leyenda"] as const;

/**
 * Rarity name for a 0-based tier index. Indices are clamped into [0, 4]; callers
 * decide what to show for "no tier yet" (currentTierIndex < 0) — pass that case
 * their own label (e.g. "Sin tier") rather than calling this.
 */
export function tierRarityName(tierIndex: number): string {
  const clamped = Math.min(Math.max(tierIndex, 0), TIER_RARITY_NAMES.length - 1);
  return TIER_RARITY_NAMES[clamped] ?? "—";
}

/**
 * CSS color token for a 0-based tier index (prototype TIERC). Returns the neutral
 * border token for "no tier" (index < 0). Never a hardcoded hex/rgb.
 */
export function tierColor(tierIndex: number): string {
  switch (tierIndex) {
    case 0:
      return "var(--color-tier-1, var(--color-agent-researcher))";
    case 1:
      return "var(--color-tier-2, var(--color-agent-frontend-dev))";
    case 2:
      return "var(--color-tier-3, var(--color-accent))";
    case 3:
      return "var(--color-tier-4, var(--color-agent-reviewer))";
    case 4:
      return "var(--color-tier-5, var(--color-agent-product-manager))";
    default:
      return "var(--color-border-strong)";
  }
}
