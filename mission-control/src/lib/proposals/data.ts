import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { type BacklogReadResult, readBacklog } from "@/lib/backlog/backlog";
import { resolveFactoryRoot } from "@/lib/config/config";
import { type Lesson, readLessons } from "@/lib/memory/memory";
import { type MemoryHealth, memoryHealth } from "@/lib/memory/memory-health";
import { gatherSuggestionsInput } from "@/lib/self-suggest/gather";
import { computeSuggestions, type Suggestion } from "@/lib/self-suggest/self-suggest";
/** Public proposals data contract. */
export interface ProposalsData {
  readonly lessons: Lesson[];
  readonly health: MemoryHealth;
  readonly memoryError: string | null;
  readonly suggestions: Suggestion[];
  readonly backlog: BacklogReadResult;
  readonly discoveredIdeas: number;
  readonly skillCount: number;
}
/** Request-local shared reads, including explicit directory failures that the legacy lesson reader omits. */
export const loadProposalsData = cache((): ProposalsData => {
  const dir = path.join(resolveFactoryRoot(), "factory", "memory");
  let memoryError: string | null = null;
  try {
    fs.readdirSync(dir);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) memoryError = dir;
  }
  const lessons = memoryError ? [] : readLessons();
  const input = gatherSuggestionsInput(lessons);
  return {
    lessons,
    health: memoryHealth(lessons),
    memoryError,
    suggestions: computeSuggestions(input),
    backlog: readBacklog(),
    discoveredIdeas: input.boardColumnCounts.discovered ?? 0,
    skillCount: input.capabilities.filter((x) => x.kind === "skill").length,
  };
});
