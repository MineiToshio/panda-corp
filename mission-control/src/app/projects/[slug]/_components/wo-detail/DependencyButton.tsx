import { StateDot } from "@/components/core/StateDot/StateDot";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
/** A real dependency link preserving the list's filters and the order's state. */
export function DependencyButton({
  order,
  href,
}: {
  order: Pick<WorkOrder, "id"> & Partial<WorkOrder>;
  href: string;
}): React.JSX.Element {
  return (
    <a
      className="btn sm"
      data-wo={order.id}
      href={navigationHref(href, { wo: order.id, woview: null })}
    >
      <code>{order.id}</code>
      <StateDot state={order.state === "fail" ? "blocked" : order.state} />
    </a>
  );
}
