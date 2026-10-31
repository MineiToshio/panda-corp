import { Button } from "@/components/core/Button/Button";
import { StateDot } from "@/components/core/StateDot/StateDot";
import { t } from "@/lib/copy/copy";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import styles from "./DependencyMap.module.css";
import { DependencyNode, dependencyTitle } from "./DependencyNode";
/** Focus details show direct prerequisites and consumers; chain highlighting remains transitive. */
export function DependencySide({
  order,
  orders,
  onFocus,
  onOpen,
}: {
  order: WorkOrder;
  orders: readonly WorkOrder[];
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const upstream = orders.filter((candidate) => order.dependsOn?.includes(candidate.id));
  const downstream = orders.filter((candidate) => candidate.dependsOn?.includes(order.id));
  return (
    <section
      className={`dag-side ${styles.side}`}
      aria-label={t("workspace.observabilidad.dagOrders.focusAria")}
    >
      <div>
        <StateDot state={order.state === "fail" ? "blocked" : order.state} />
        <b>{order.id}</b>
        <p>{dependencyTitle(order)}</p>
        <Button size="sm" onClick={() => onOpen(order.id)}>
          {t("workspace.observabilidad.dagOrders.open")}
        </Button>
      </div>
      {[
        {
          id: "up",
          rows: upstream,
          label: t("workspace.observabilidad.dagOrders.dependsOn", { count: upstream.length }),
          empty: t("workspace.observabilidad.dagOrders.startingPoint"),
        },
        {
          id: "down",
          rows: downstream,
          label: t("workspace.observabilidad.dagOrders.unlocks", { count: downstream.length }),
          empty: t("workspace.observabilidad.dagOrders.nothingDepends"),
        },
      ].map((group) => (
        <div key={group.id}>
          <h3>{group.label}</h3>
          {group.rows.length ? (
            group.rows.map((candidate) => (
              <DependencyNode
                key={candidate.id}
                order={candidate}
                onActivate={() => onFocus(candidate.id)}
              />
            ))
          ) : (
            <p>{group.empty}</p>
          )}
        </div>
      ))}
    </section>
  );
}
