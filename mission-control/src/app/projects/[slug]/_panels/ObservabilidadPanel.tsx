import { readBuildTimeline } from "@/lib/build-track/build-track";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import { TabWorkOrders } from "../_components/tab-work-orders/tab-work-orders";
import { WoLiveRefresh } from "../_components/tab-work-orders/wo-live-refresh";
import { WoDetail } from "../_components/wo-detail/WoDetail";
import { ObservabilidadTab } from "../_observability/ObservabilidadTab/ObservabilidadTab";
import type { PanelProps } from "./types";

export default function ObservabilidadPanel({ project, route }: PanelProps): React.JSX.Element {
  if (route.woParam)
    return (
      <>
        <WoLiveRefresh project={project.folder} />
        <WoDetail
          project={project}
          woId={route.woParam}
          view={route.woTabParam === "full" ? "Documento completo" : "Resumen"}
        />
      </>
    );
  const orders = listWorkOrders(project.projectPath);
  return (
    <>
      <TabWorkOrders
        orders={orders}
        project={project.folder}
        navigationBaseHref={route.navigationBaseHref}
      />
      <ObservabilidadTab
        liveProject={project.folder}
        workOrders={orders}
        timeline={readBuildTimeline(project.projectPath, orders)}
        project={project.slug}
      />
    </>
  );
}
