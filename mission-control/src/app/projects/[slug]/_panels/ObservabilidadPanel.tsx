import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import { readFrdDrift } from "@/lib/frds/frd-drift";
import { listProjectFrds } from "@/lib/frds/frd-index";
import { readArtifact } from "@/lib/spec/read-artifacts";
import { readPublishedWorkOrders } from "@/lib/work-orders/published";
import { DependencyMap } from "../_components/deps/DependencyMap";
import { WoDetail } from "../_components/wo-detail/WoDetail";
import { WorkOrderEmpty } from "../_components/wo-empty/wo-empty";
import { selectedFrd } from "../_components/wo-views/selection";
import { WoNavigationRefresh } from "../_components/wo-views/WoNavigationRefresh";
import { WoViews } from "../_components/wo-views/WoViews";
import { WoLiveRefresh } from "../_observability/WoLiveRefresh/wo-live-refresh";
import type { PanelProps } from "./types";
/** One server data set and one live subscriber across lists, dependencies and the detail. */
export default function ObservabilidadPanel({ project, route }: PanelProps): React.JSX.Element {
  let body: React.ReactNode;
  if (route.woParam)
    body = (
      <WoDetail
        project={project}
        woId={route.woParam}
        view={route.woTabParam === "full" ? "Documento completo" : "Resumen"}
        navigationBaseHref={route.navigationBaseHref}
      />
    );
  else {
    const orders = readArtifact(() => readPublishedWorkOrders(project.projectPath), []);
    const frds = readArtifact(() => listProjectFrds(project.projectPath), []);
    if (orders.error || frds.error)
      body = (
        <Notice icon="alert" kind="error">
          {t("inicio.worktrees.unreadable")}
          <code>{orders.error ? "docs/frds/*/work-orders/" : "docs/frds/"}</code>
        </Notice>
      );
    else if (!orders.value.length) body = <WorkOrderEmpty />;
    else {
      const drifts = Object.fromEntries(
        frds.value.map((frd) => [frd.slug, readFrdDrift(project.projectPath, frd.slug)]),
      );
      body = (
        <WoViews
          orders={orders.value}
          frds={frds.value}
          drifts={drifts}
          href={route.navigationBaseHref}
          state={route.state}
        >
          {route.state.view === "deps" && (
            <DependencyMap
              project={{ slug: project.slug, path: project.projectPath }}
              route={{
                dag: route.state.dag,
                focus: route.state.focus,
                frd: selectedFrd(frds.value, route.state.frd) || undefined,
              }}
            />
          )}
        </WoViews>
      );
    }
  }
  return (
    <>
      <WoLiveRefresh project={project.folder} />
      <WoNavigationRefresh wo={route.woParam} />
      {body}
    </>
  );
}
