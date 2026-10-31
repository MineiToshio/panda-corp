import { ProjectAccounts } from "@/components/modules/ServicesDirectory/ProjectAccounts";
import type { PanelProps } from "./types";

export default function CuentasPanel({ project }: PanelProps): React.JSX.Element {
  return <ProjectAccounts data={project.services} projectId={project.serviceId} />;
}
