import type { ChainState, Unique } from "@/lib/achievements/achievements";
import type { UniqueCategory } from "@/lib/achievements/catalogue/types";
import type { Stat } from "@/lib/achievements/stats";
import type { Rarity } from "@/lib/achievements/tiers";

/** Six engine-derived guild attributes, clamped to the chart's actual scale. */
export type Attributes = Readonly<
  Record<"produccion" | "velocidad" | "calidad" | "constancia" | "ideacion" | "alcance", number>
>;
/** Preserve the v1 attribute formula; all inputs are real engine stats. */
export function attributesFor(stats: readonly Stat[], chains: readonly ChainState[]): Attributes {
  const value = (key: string): number => stats.find((stat) => stat.key === key)?.value ?? 0;
  return {
    produccion: Math.min(100, value("shipped") * 20),
    velocidad: Math.max(
      0,
      Math.min(100, value("speed") > 0 ? Math.round(100 - (value("speed") / 30) * 100) : 0),
    ),
    calidad: Math.min(100, value("flawless") * 33),
    constancia: Math.min(100, value("streak") * 10),
    ideacion: Math.min(100, value("ideas") * 10),
    alcance: Math.min(100, chains.filter((chain) => chain.currentTierIndex >= 0).length * 8),
  };
}
/** Stable ordering: missions near their next tier first, untouched missions last. */
export function orderedMissions(chains: readonly ChainState[]): ChainState[] {
  const untouched = (chain: ChainState): boolean => chain.currentTierIndex < 0 && !chain.value;
  return [...chains].sort(
    (a, b) => Number(untouched(a)) - Number(untouched(b)) || b.pctToNext - a.pctToNext,
  );
}
/** Shared ascending rarity order for targets and the remaining catalogue. */
export const RARITY_INDEX: Record<Rarity, number> = {
  Común: 0,
  "Poco común": 1,
  Raro: 2,
  Épico: 3,
  Leyenda: 4,
};
/** Lowest-rarity targets, preserving catalogue order for ties. */
export function nearestTrophies(uniques: readonly Unique[], category?: string): Unique[] {
  const locked = uniques
    .filter((item) => !item.unlocked && (!category || item.category === category))
    .sort((a, b) => RARITY_INDEX[a.rarity] - RARITY_INDEX[b.rarity]);
  if (category) return locked.slice(0, 3);
  const seen = new Set<UniqueCategory>();
  return locked
    .filter((item) => {
      if (seen.has(item.category)) return false;
      seen.add(item.category);
      return true;
    })
    .slice(0, 6);
}
/** Far eras collapse; the current era and its immediate successor remain open. */
export function eraCollapsed(era: number, currentEra: number): boolean {
  return era > currentEra + 1;
}
/** Attribute sentence inputs; ties retain the chart's axis order. */
export function attributeSummary(axes: Attributes): {
  strong: keyof Attributes | null;
  weak: keyof Attributes | null;
  zero: (keyof Attributes)[];
} {
  const keys = Object.keys(axes) as (keyof Attributes)[];
  if (keys.every((key) => axes[key] === 0)) return { strong: null, weak: null, zero: keys };
  const sorted = [...keys].sort((a, b) => axes[b] - axes[a]);
  return {
    strong: sorted[0] ?? "produccion",
    weak: keys.reduce(
      (weak, key) => (axes[key] < axes[weak] ? key : weak),
      keys[0] ?? "produccion",
    ),
    zero: keys.filter((key) => axes[key] === 0),
  };
}
/** Recent trophies use actual instants; undated unlocks follow dated ones without inventing dates. */
export function recentTrophies(uniques: readonly Unique[]): Unique[] {
  const time = (item: Unique): number =>
    item.date && Number.isFinite(Date.parse(item.date)) ? Date.parse(item.date) : -Infinity;
  return uniques
    .filter((item) => item.unlocked)
    .sort((a, b) => time(b) - time(a))
    .slice(0, 4);
}
