import { cache } from "react";
import { PHASES, type Phase } from "@/components/core/Chip/vocabulary";
import { deriveColumn } from "@/lib/board/board";
import { resolveProjectPath } from "@/lib/config/config";
import { countLaunched, type IdeaCard, readIdeas } from "@/lib/ideas/ideas";
import { getProjectOverview, type ProjectOverviewItem } from "@/lib/portfolio/overview";
export interface FunnelData {
  readonly rows: readonly { readonly phase: Phase; readonly count: number }[];
  readonly discarded: number;
}
const COLUMN_PHASE = {
  discovered: "discovered",
  documented: "product",
  design: "design",
  architecture: "architecture",
  building: "implementation",
} as const;
/** Board-derived phases and the shared launch bridge; discards are a separate count. */
export function deriveIdeaFunnel(
  ideas: readonly IdeaCard[],
  projects: readonly ProjectOverviewItem[],
): FunnelData {
  const counts: Record<Phase, number> = {
    discovered: 0,
    product: 0,
    design: 0,
    architecture: 0,
    implementation: 0,
    release: 0,
  };
  let discarded = 0;
  for (const idea of ideas) {
    const project = projects.find(
      (item) => idea.project && resolveProjectPath(idea.project) === resolveProjectPath(item.path),
    );
    const column = deriveColumn(idea, project?.source.status ?? null);
    if (column === "discarded") discarded++;
    else if (column !== "shipped") counts[COLUMN_PHASE[column]]++;
  }
  counts.release = countLaunched(
    ideas,
    projects.map((project) => project.source.status),
  );
  return { rows: PHASES.map((phase) => ({ phase, count: counts[phase] })), discarded };
}
/** Request-cached factory funnel. */
export const ideaFunnel = cache(
  (): FunnelData => deriveIdeaFunnel(readIdeas(), getProjectOverview()),
);
