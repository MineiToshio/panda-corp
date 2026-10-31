import { countFrdFolders, listProjectDocs } from "@/lib/docs/tree";
import { readSpecArtifacts } from "@/lib/spec/read-artifacts";
import { TabSpec } from "../_components/tab-spec";
import type { PanelProps } from "./types";

export default function SpecPanel({ project, route }: PanelProps): React.JSX.Element {
  const spec = readSpecArtifacts(project.projectPath);
  const nodes = listProjectDocs(project.projectPath);
  return (
    <TabSpec
      key={project.projectPath}
      {...spec}
      title={project.name}
      project={project.slug}
      projectType={project.projectType}
      targetPlatforms={project.status.targetPlatforms}
      frdCount={spec.sourceErrors.frds ? undefined : countFrdFolders(nodes)}
      nodes={nodes}
      constructionStarted={project.constructionStarted}
      navigationBaseHref={route.navigationBaseHref}
    />
  );
}
