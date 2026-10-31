import { cache } from "react";
import { readArchitectureArtifacts } from "@/lib/architecture/read-artifacts";
import { resolveProjectPath } from "@/lib/config/config";
import { countFrdFolders, type DocNode, listProjectDocs } from "@/lib/docs/tree";
import type { IdeaCard } from "@/lib/ideas/ideas";
import { readSpecArtifacts } from "@/lib/spec/read-artifacts";
import { readSpecDigest } from "@/lib/spec/read-spec";
import { readStatus, type StatusResult } from "@/lib/status/status";

/** The open idea's project artifact bundle (all absent for a card with none). */
export type CardProjectData = Partial<ReturnType<typeof readArchitectureArtifacts>> & {
  projectStatus: StatusResult | null;
  docNodes: DocNode[] | undefined;
  frdCount: number | undefined;
  specContent: string | undefined;
};

const NO_PROJECT: CardProjectData = {
  projectStatus: null,
  docNodes: undefined,
  frdCount: undefined,
  specContent: undefined,
  architectureContent: undefined,
  workOrders: undefined,
  envVars: undefined,
  adrs: undefined,
};

/**
 * Keep a DocNode only if it is the PRD, the research doc, or a per-FRD doc (DR-046): the
 * Documentos tab never surfaces architecture.md, the Global group or anything in .pandacorp/.
 */
function isScopedBoardDoc(node: DocNode): boolean {
  return (
    node.relPath === "docs/product/prd.md" ||
    node.relPath === "docs/product/research.md" ||
    node.group.startsWith("Feature:")
  );
}

/**
 * Read the open idea's linked project: status, scoped docs, FRD count and the Spec /
 * Arquitectura digests. Runs for any open card with a `project` (in-pipeline, shipped, discarded), so a
 * launched or discarded project keeps its full documentation; a card without one reads nothing.
 *
 * The project path goes through the canonical `resolveProjectPath` (the same resolver the
 * portfolio uses) so the board and portfolio agree on where a project lives, including Mission
 * Control, which lives INSIDE the factory.
 *
 * @param card - the idea card (only `project` is read)
 * @returns the project-side data; every field undefined/null when the card has no project
 */
export function readCardProject(card: IdeaCard): CardProjectData {
  return readProject(card.project);
}

const readProject = cache((project: string | undefined): CardProjectData => {
  if (!project) return NO_PROJECT;

  const projectPath = resolveProjectPath(project);
  const allDocNodes = listProjectDocs(projectPath);
  const architecture = readArchitectureArtifacts(projectPath);
  const specContent = readSpecDigest(projectPath) ?? undefined;
  const spec =
    architecture.workOrders === undefined && specContent
      ? readSpecArtifacts(projectPath)
      : undefined;
  return {
    projectStatus: readStatus(projectPath),
    docNodes: allDocNodes.filter(isScopedBoardDoc),
    frdCount: countFrdFolders(allDocNodes),
    specContent,
    ...architecture,
    ...(spec
      ? {
          workOrders: spec.workOrders,
          frds: spec.frds,
          sourceErrors: { ...architecture.sourceErrors, ...spec.sourceErrors },
        }
      : {}),
  };
});
