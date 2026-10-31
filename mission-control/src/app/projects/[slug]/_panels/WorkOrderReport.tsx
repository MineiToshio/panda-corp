"use client";
import { useWorkspaceNavigation } from "../_components/WorkspaceNavigation";
import { WorkOrderDetail, type WorkOrderDetailProps } from "../_components/wo-detail/wo-detail";

export function WorkOrderReport(
  props: Omit<WorkOrderDetailProps, "navigationBaseHref">,
): React.JSX.Element {
  return <WorkOrderDetail {...props} navigationBaseHref={useWorkspaceNavigation()} />;
}
