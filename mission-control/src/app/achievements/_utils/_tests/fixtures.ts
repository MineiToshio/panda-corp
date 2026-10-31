import type { ChainState, Unique } from "@/lib/achievements/achievements";
import { type GuildLevel, RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
/** Engine-shaped mission fixture with explicit overrides. */
export function mission(overrides: Partial<ChainState> = {}): ChainState {
  return {
    statKey: "workorders",
    label: "Work orders",
    saga: "La Construcción",
    currentTierIndex: -1,
    currentTierName: null,
    nextTier: { name: "First tier", threshold: 10 },
    pctToNext: 0,
    value: 0,
    lowerIsBetter: false,
    unlocks: [],
    ...overrides,
  };
}
/** Engine-shaped trophy fixture; locked by default. */
export function trophy(name: string, overrides: Partial<Unique> = {}): Unique {
  return {
    name,
    category: "Discovery",
    rarity: "Común",
    unlocked: false,
    condition: "Real evidence",
    ...overrides,
  };
}
/** Real rank table and XP curve for presentation tests. */
export function guildLevel(value = 1): GuildLevel {
  const rankIndex = rankForLevel(value);
  const rank = RANKS[rankIndex];
  return {
    level: value,
    rankIndex,
    title: rank?.title ?? "",
    icon: rank?.icon,
    sprite: rank?.sprite,
    grade: rank?.grade,
    xp: xpForLevel(value),
    next: xpForLevel(value + 1),
    pctToNext: 0,
  };
}
