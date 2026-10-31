import { readAdrs } from "@/lib/architecture/adr";
import { parseArchitecture } from "@/lib/architecture/architecture";
import { readDataModel } from "@/lib/architecture/data-model/read-data-model";
import { readEnvExample } from "@/lib/architecture/env";
import { readArchitectureDigest } from "@/lib/architecture/read-architecture";
import { readArtifact, readDigestWorkOrders } from "@/lib/spec/read-artifacts";
import { readDigestFrds } from "@/lib/spec/read-frds";

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
  const orders = readArtifact(
    () => (hasArchitecture ? readDigestWorkOrders(projectPath) : { items: [], errors: [] }),
    { items: [], errors: [] },
  );
  const env = readArtifact(() => (hasArchitecture ? readEnvExample(projectPath) : []), []);
  const adrs = readArtifact(() => (hasArchitecture ? readAdrs(projectPath) : []), []);
  const frds = readArtifact(() => readDigestFrds(projectPath, orders.value.items), []);
  return {
    architectureContent,
    dataModel,
    workOrders: hasArchitecture ? orders.value.items : undefined,
    envVars: hasArchitecture ? env.value : undefined,
    adrs: hasArchitecture ? adrs.value : undefined,
    frds: frds.value,
    sourceErrors: {
      workOrders:
        orders.error ??
        (orders.value.errors.map((issue) => `${issue.file}: ${issue.reason}`).join("; ") ||
          undefined),
      env: env.error,
      adrs: adrs.error,
      frds: frds.error,
    },
  };
}
