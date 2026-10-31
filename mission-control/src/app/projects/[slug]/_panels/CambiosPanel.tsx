import { readChangeQueue } from "@/lib/changes/changes";
import { TabChanges } from "../_components/tab-changes/tab-changes";
import type { PanelProps } from "./types";

export default function CambiosPanel({ project }: PanelProps): React.JSX.Element {
  return (
    <TabChanges
      result={readChangeQueue(project.projectPath)}
      projectPath={project.projectPath}
      slug={project.slug}
    />
  );
}
