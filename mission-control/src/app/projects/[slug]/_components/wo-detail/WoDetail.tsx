import { notFound } from "next/navigation";
import { listWorkOrders, readWorkOrderDoc } from "@/lib/work-orders/work-orders";
import { WorkOrderReport } from "../../_panels/WorkOrderReport";
import type { WorkspaceProject } from "../../_panels/workspaceProject";

export function WoDetail({
  project,
  woId,
  view,
}: {
  project: WorkspaceProject;
  woId: string;
  view: "Resumen" | "Documento completo";
}): React.JSX.Element {
  const order = listWorkOrders(project.projectPath).find((entry) => entry.id === woId);
  if (!order) notFound();
  return (
    <WorkOrderReport
      order={order}
      content={readWorkOrderDoc(project.projectPath, order.relPath)}
      activeWoTab={view === "Documento completo" ? "full" : "summary"}
    />
  );
}
