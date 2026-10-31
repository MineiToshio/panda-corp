import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { presentation } from "../wo-views/selection";
import styles from "./board.module.css";
/** One wrapping card; a failed order is a variant of the same card. */
export function WorkOrderCard({
  order,
  href,
}: {
  order: WorkOrder;
  href: string;
}): React.JSX.Element {
  const meta = presentation(order.state),
    code = `FRD-${order.frd.match(/^frd-(\d+)/i)?.[1] ?? ""}`;
  return (
    <a
      href={navigationHref(href, { wo: order.id, woview: null })}
      className={`wocard ${styles.card} ${order.state === "fail" ? `is-failed ${styles.failed}` : ""}`}
      data-tone={meta.tone}
      data-testid="wo-card-link"
    >
      <code>
        {order.state === "fail" && <Icon name="alert" size="sm" />}
        {order.id}
      </code>
      <strong>{order.title.replace(/^WO-\d+-\d+\s*[—–:·-]?\s*/, "")}</strong>
      <small>
        {code} ·{" "}
        {t("workspace.observabilidad.kanban.dependencies", { count: order.dependsOn?.length ?? 0 })}
      </small>
      {order.state === "fail" && (
        <>
          <Chip tone="coral" icon="alert">
            {t(meta.labelKey)}
          </Chip>
          {order.blockedReason && <p className="wo-block">{order.blockedReason}</p>}
        </>
      )}
    </a>
  );
}
