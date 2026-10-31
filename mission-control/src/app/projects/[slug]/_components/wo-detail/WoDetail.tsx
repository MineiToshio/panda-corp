import { Card, CardHeader } from "@/components/core/Card/Card";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import { listWorkOrders, readWorkOrderDetail } from "@/lib/work-orders/work-orders";
import type { WorkspaceProject } from "../../_panels/workspaceProject";
import styles from "./detail.module.css";
import { WorkOrderDetail } from "./wo-detail";
/** Self-loading detail seam. Missing documents remain an honest in-tab state. */
export function WoDetail({
  project,
  woId,
  view,
  navigationBaseHref,
}: {
  project: WorkspaceProject;
  woId: string;
  view: "Resumen" | "Documento completo";
  navigationBaseHref?: string;
}): React.JSX.Element {
  const detail = readWorkOrderDetail(project.projectPath, woId);
  const href =
    navigationBaseHref ??
    `/portfolio/${encodeURIComponent(project.slug)}/observability?wo=${encodeURIComponent(woId)}`;
  if (detail.kind === "not-found")
    return (
      <Card tone="slate">
        <CardHeader title={t("workspace.observabilidad.notFound.title")} />
        <p>{t("workspace.observabilidad.notFound.detail", { id: woId, project: project.name })}</p>
        <a className={styles.link} href={navigationHref(href, { wo: null, woview: null })}>
          {t("workspace.observabilidad.notFound.link")}
        </a>
      </Card>
    );
  return (
    <WorkOrderDetail
      order={detail.order}
      content={detail.markdown}
      activeWoTab={view === "Documento completo" ? "full" : "summary"}
      sections={detail.sections}
      dependents={detail.dependents}
      orders={listWorkOrders(project.projectPath)}
      frd={project.frds.find((frd) => frd.slug === detail.order.frd)}
      navigationBaseHref={href}
    />
  );
}
