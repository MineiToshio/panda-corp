import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { presentation } from "./selection";
import styles from "./views.module.css";
/** Read-only order link with state text and a fixed-width dependency count. */
export function WorkOrderRow({
  order,
  href,
}: {
  order: WorkOrder;
  href: string;
}): React.JSX.Element {
  const meta = presentation(order.state);
  return (
    <a
      className={`worow ${styles.row} ${order.state === "fail" ? `is-failed ${styles.failed}` : ""}`}
      data-tone={meta.tone}
      href={navigationHref(href, { wo: order.id, woview: null })}
    >
      <code>
        {order.state === "fail" && <Icon name="alert" size="sm" />}
        {order.id}
      </code>
      <span>{order.title.replace(/^WO-\d+-\d+\s*[—–:·-]?\s*/, "")}</span>
      <Chip tone={meta.tone} icon={meta.icon}>
        {t(meta.labelKey)}
      </Chip>
      <span className={styles.deps}>
        <Icon name="link" size="sm" />
        {order.dependsOn?.length ?? 0}
      </span>
    </a>
  );
}
