import { cache } from "react";
import { computeUniques, type Unique } from "@/lib/achievements/achievements";
import { now } from "@/lib/clock/clock";
import { durableEvents, readLedger } from "@/lib/gamification/ledger";
import { readIdeas } from "@/lib/ideas/ideas";
import { inicioGuild } from "@/lib/inicio/guild";
export interface LastAchievementData {
  readonly title: string;
  readonly unlockedAt: string | null;
  readonly fresh: boolean;
}
/** Newest unlocked unique and the one predicate for its seven-day notice. */
export function selectLastAchievement(
  uniques: readonly Unique[],
  nowIso: string,
): LastAchievementData | null {
  const unique = uniques
    .filter((item) => item.unlocked)
    .sort(
      (a, b) =>
        (b.date && Number.isFinite(Date.parse(b.date)) ? Date.parse(b.date) : -Infinity) -
        (a.date && Number.isFinite(Date.parse(a.date)) ? Date.parse(a.date) : -Infinity),
    )[0];
  if (!unique) return null;
  const age = unique.date ? Date.parse(nowIso) - Date.parse(unique.date) : NaN;
  return {
    title: unique.name,
    unlockedAt: unique.date ?? null,
    fresh: unique.isNew === true || (age >= 0 && age <= 7 * 86400000),
  };
}
/** Request-cached existing unique predicates, shared by the count and last unlock. */
export const guildAchievements = cache((): readonly Unique[] => {
  const guild = inicioGuild();
  return computeUniques(
    {
      ideas: readIdeas(),
      statuses: guild.statuses,
      eventsSnapshot: guild.eventsSnapshot,
      workOrdersDoneLive: guild.outcomes.workOrdersDone,
      durableEvents: durableEvents(readLedger()),
    },
    now().getTime(),
  );
});

/** Shared last-unlock predicate for Inicio and the sidebar notice. */
export const lastAchievement = cache((): LastAchievementData | null =>
  selectLastAchievement(guildAchievements(), now().toISOString()),
);
