import { TabCommands } from "../_components/tab-commands/tab-commands";
import type { PanelProps } from "./types";

export default function ComandosPanel({ project }: PanelProps): React.JSX.Element {
  return <TabCommands phase={project.phase ?? "product"} slug={project.slug} />;
}
