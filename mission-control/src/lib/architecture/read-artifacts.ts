import { readAdrs } from "@/lib/architecture/adr";
import { parseArchitecture } from "@/lib/architecture/architecture";
import { readDataModel } from "@/lib/architecture/data-model/read-data-model";
import { readEnvExample } from "@/lib/architecture/env";
import { readArchitectureDigest } from "@/lib/architecture/read-architecture";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

/** Read the same architecture artifacts for board and workspace without creating replicas. */
export function readArchitectureArtifacts(projectPath: string) {
  const architectureContent = readArchitectureDigest(projectPath) ?? undefined;
  const result = readDataModel(projectPath);
  const dataModel =
    result.kind === "missing" &&
    architectureContent !== undefined &&
    parseArchitecture(architectureContent).dataModel?.isNone
      ? { kind: "none" as const }
      : result;
  const hasArchitecture = architectureContent !== undefined || dataModel.kind !== "missing";
  return {
    architectureContent,
    dataModel,
    workOrders: hasArchitecture ? listWorkOrders(projectPath) : undefined,
    envVars: hasArchitecture ? readEnvExample(projectPath) : undefined,
    adrs: hasArchitecture ? readAdrs(projectPath) : undefined,
  };
}
