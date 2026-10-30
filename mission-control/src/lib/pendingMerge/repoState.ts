export const CLEANUP_COUNT = 3;
export const REVIEW_HOURS = 24;
export const CLEANUP_HOURS = 7 * REVIEW_HOURS;
export type RepoState = "cleanNow" | "reviewSoon" | "upToDate" | "clean";
export function repoState({
  branches,
  leftovers,
}: {
  branches: readonly { ageHours: number }[];
  leftovers: number;
}): RepoState {
  if (
    leftovers >= CLEANUP_COUNT ||
    branches.length >= CLEANUP_COUNT ||
    branches.some((b) => b.ageHours > CLEANUP_HOURS)
  )
    return "cleanNow";
  if (leftovers > 0 || branches.some((b) => b.ageHours > REVIEW_HOURS)) return "reviewSoon";
  return branches.length ? "upToDate" : "clean";
}
export const WORKTREES_CARD_ID = "worktrees-card";
