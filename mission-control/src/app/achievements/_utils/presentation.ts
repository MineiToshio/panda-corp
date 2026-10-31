import type { Tone } from "@/components/core/Chip/vocabulary";
import type { UniqueCategory } from "@/lib/achievements/catalogue/types";
import type { Rarity } from "@/lib/achievements/tiers";
import { t } from "@/lib/copy/copy";

export const CATEGORIES: readonly UniqueCategory[] = [
  "Discovery",
  "Speed",
  "Quality",
  "Consistency",
  "Mastery",
  "Production",
  "Guild",
  "Resilience",
];
const CATEGORY_KEYS = {
  Discovery: "discovery",
  Speed: "speed",
  Quality: "quality",
  Consistency: "consistency",
  Mastery: "mastery",
  Production: "production",
  Guild: "guild",
  Resilience: "resilience",
  grand: "grand",
  Secret: "secret",
} as const;
/** Translate UI categories while preserving names from the engine as source content. */
export function categoryLabel(category: keyof typeof CATEGORY_KEYS): string {
  return t(`logros.categories.${CATEGORY_KEYS[category]}`);
}
const RARITY_KEYS = {
  Común: "common",
  "Poco común": "uncommon",
  Raro: "rare",
  Épico: "epic",
  Leyenda: "legend",
} as const;
/** Shared vocabulary for rarity text and hue. */
export function rarityPresentation(rarity: Rarity): { label: string; tone: Tone } {
  const tones = {
    Común: "slate",
    "Poco común": "green",
    Raro: "blue",
    Épico: "violet",
    Leyenda: "gold",
  } as const;
  return { label: t(`logros.rarity.${RARITY_KEYS[rarity]}`), tone: tones[rarity] };
}
