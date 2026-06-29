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

// ─────────────────────────────────────────────────────────────────────────────
// Per-trophy rarity (FRD-10 v2) — a per-achievement attribute (NOT a chain tier).
// Maps onto the SAME 5 tier colors so the visual language stays coherent (DR-062).
// The single source for a trophy's rarity color + label (DR-092).
// ─────────────────────────────────────────────────────────────────────────────

/** Per-trophy rarity grade (docs/achievements.md §2). */
export type Rarity = "Común" | "Poco común" | "Raro" | "Épico" | "Leyenda";

/** Ordered rarity grades, common → legendary (the pyramid order). */
export const RARITY_ORDER: readonly Rarity[] = TIER_RARITY_NAMES;

/** 0-based index of a rarity grade (Común=0 … Leyenda=4). */
function rarityIndex(rarity: Rarity): number {
  const i = RARITY_ORDER.indexOf(rarity);
  return i < 0 ? 0 : i;
}

/** The rarity grade's display label (identity today; a seam for future i18n). */
export function rarityLabel(rarity: Rarity): string {
  return rarity;
}

/** CSS color token for a rarity grade — reuses the tier color tokens (DR-062). */
export function rarityColor(rarity: Rarity): string {
  return tierColor(rarityIndex(rarity));
}

/** A short estimated-difficulty blurb for a rarity grade (docs/achievements.md §2). */
export function rarityBlurb(rarity: Rarity): string {
  switch (rarity) {
    case "Común":
      return "logro común — un primer paso";
    case "Poco común":
      return "poco común — requiere algo de empeño";
    case "Raro":
      return "raro — una hazaña notable";
    case "Épico":
      return "épico — difícil, de excelencia sostenida";
    case "Leyenda":
      return "de leyenda — pocos lo alcanzan";
    default: {
      const _exhaustive: never = rarity;
      return _exhaustive;
    }
  }
}

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
