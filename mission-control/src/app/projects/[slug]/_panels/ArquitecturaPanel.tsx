import { readArchitectureArtifacts } from "@/lib/architecture/read-artifacts";
import { listProjectDocs } from "@/lib/docs/tree";
import { ArchitectureReport } from "./ArchitectureReport";
import type { PanelProps } from "./types";

export default function ArquitecturaPanel({ project, route }: PanelProps): React.JSX.Element {
  const architecture = readArchitectureArtifacts(project.projectPath);
  return (
    <ArchitectureReport
      key={project.projectPath}
      {...architecture}
      body={architecture.architectureContent ?? ""}
      title={project.name}
      project={project.slug}
      nodes={listProjectDocs(project.projectPath)}
      projectType={project.projectType}
      targetPlatforms={project.status.targetPlatforms}
      constructionStarted={project.constructionStarted}
      navigationBaseHref={route.navigationBaseHref}
    />
  );
}
