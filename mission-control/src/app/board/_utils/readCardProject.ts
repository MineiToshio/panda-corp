import { readAdrs } from "@/lib/architecture/adr";
import { readEnvExample } from "@/lib/architecture/env";
import { readArchitectureDigest } from "@/lib/architecture/read-architecture";
import { resolveProjectPath } from "@/lib/config/config";
import { countFrdFolders, type DocNode, listProjectDocs } from "@/lib/docs/tree";
import type { IdeaCard } from "@/lib/ideas/ideas";
import { readSpecDigest } from "@/lib/spec/read-spec";
import { readStatus, type StatusResult } from "@/lib/status/status";
import { listWorkOrders, type WorkOrder } from "@/lib/work-orders/work-orders";

/** Everything the board reads from a card's linked project (all absent for a card with none). */
export type CardProjectData = {
  projectStatus: StatusResult | null;
  /** Scoped doc structure for the Documentos tab (PRD + research + per-FRD). */
  docNodes: DocNode[] | undefined;
  /** Real on-disk FRD folder count for the Spec tab's "N FRDs" badge. */
  frdCount: number | undefined;
  specContent: string | undefined;
  architectureContent: string | undefined;
  workOrders: WorkOrder[] | undefined;
  envVars: ReturnType<typeof readEnvExample> | undefined;
  adrs: ReturnType<typeof readAdrs> | undefined;
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
 * Read a card's linked project for the board: status, scoped docs, FRD count and the Spec /
 * Arquitectura digests. Runs for ANY card with a `project` (in-pipeline, shipped, discarded), so a
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
  if (!card.project) return NO_PROJECT;

  const projectPath = resolveProjectPath(card.project);
  const allDocNodes = listProjectDocs(projectPath);
  const architectureContent = readArchitectureDigest(projectPath) ?? undefined;
  // The (heavier) live architecture artifacts are read only once the digest exists, i.e. when
  // the Arquitectura tab will actually render them.
  const hasArchitecture = architectureContent != null;
  return {
    projectStatus: readStatus(projectPath),
    docNodes: allDocNodes.filter(isScopedBoardDoc),
    frdCount: countFrdFolders(allDocNodes),
    specContent: readSpecDigest(projectPath) ?? undefined,
    architectureContent,
    workOrders: hasArchitecture ? listWorkOrders(projectPath) : undefined,
    envVars: hasArchitecture ? readEnvExample(projectPath) : undefined,
    adrs: hasArchitecture ? readAdrs(projectPath) : undefined,
  };
}
