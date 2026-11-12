import { readBuildTargets } from "@/lib/build-targets";
import { TabCommands } from "../_components/tab-commands/tab-commands";
import type { PanelProps } from "./types";

/** Resolve the read-only target catalogue once per request and preserve shared next-step facts. */
export default function ComandosPanel({ project }: PanelProps): React.JSX.Element {
  return (
    <TabCommands
      phase={project.phase}
      slug={project.slug}
      nextStep={project.nextStep}
      targets={readBuildTargets(project.projectPath)}
    />
  );
}
