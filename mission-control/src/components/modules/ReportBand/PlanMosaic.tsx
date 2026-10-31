import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import styles from "./reportBand.module.css";

/** Labels and tones follow the live frontmatter state normalized by the work-order reader. */
export const ORDER_STATES = {
  todo: { label: t("common.workOrderStates.todo"), tone: "slate" },
  in_progress: { label: t("common.workOrderStates.inProgress"), tone: "blue" },
  review: { label: t("common.workOrderStates.review"), tone: "violet" },
  done: { label: t("common.workOrderStates.done"), tone: "teal" },
  fail: { label: t("common.workOrderStates.blocked"), tone: "coral" },
} satisfies Record<WorkOrderState, { label: string; tone: Tone }>;

/** A static, accessible state tile per real work order, grouped by FRD. */
export function PlanMosaic({
  workOrders,
  started = false,
  frds = [],
}: {
  readonly workOrders: readonly WorkOrder[];
  readonly started?: boolean;
  readonly frds?: readonly { id: string; title: string }[];
}): React.JSX.Element {
  if (!started)
    return <p>{t("workspace.arquitectura.plan.orders", { count: workOrders.length })}</p>;
  if (workOrders.length === 0)
    return (
      <p>
        {t("workspace.arquitectura.plan.orders", { count: 0 })} ·{" "}
        {t("workspace.arquitectura.plan.noOrders")}
      </p>
    );
  const groups = new Map<string, WorkOrder[]>();
  for (const order of workOrders) groups.set(order.frd, [...(groups.get(order.frd) ?? []), order]);
  return (
    <div className={`mosaic ${styles.mosaic}`}>
      {[...groups].map(([frd, orders]) => (
        <div key={frd}>
          <b>
            {frd.match(/^frd-\d+/i)?.[0].toUpperCase() ?? frd}{" "}
            {
              frds.find(
                (item) => item.id.toLowerCase() === frd.match(/^frd-\d+/i)?.[0].toLowerCase(),
              )?.title
            }
          </b>
          <div className={styles.tiles}>
            {orders.map((order) => (
              <span
                key={order.id}
                role="img"
                title={`${order.id} · ${order.title} · ${ORDER_STATES[order.state].label}`}
                aria-label={`${order.id} · ${order.title} · ${ORDER_STATES[order.state].label}`}
                data-tone={ORDER_STATES[order.state].tone}
                className={styles.tile}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
