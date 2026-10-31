import type { Unique } from "@/lib/achievements/achievements";

/** Shared seven-day or explicit-new predicate for unlocked achievement notices. */
export function isFreshAchievement(unique: Unique, nowIso: string): boolean {
  const age = unique.date ? Date.parse(nowIso) - Date.parse(unique.date) : NaN;
  return unique.isNew === true || (age >= 0 && age <= 7 * 86400000);
}
