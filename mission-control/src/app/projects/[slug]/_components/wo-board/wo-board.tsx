import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { STATES } from "../wo-views/selection";
import styles from "./board.module.css";
import { WorkOrderColumn } from "./WorkOrderColumn";
export interface WorkOrderBoardProps {
  orders: WorkOrder[];
  navigationBaseHref?: string;
  hasFailures?: boolean;
}
/** Responsive, read-only board with a blocker column only when a source order failed. */
export function WorkOrderBoard({
  orders,
  navigationBaseHref = "?",
  hasFailures = orders.some((order) => order.state === "fail"),
}: WorkOrderBoardProps): React.JSX.Element {
  const states = STATES.filter((state) => state !== "fail" || hasFailures);
  return (
    <div
      className={`wo-kanban ${styles.board}`}
      data-testid="wo-board"
      style={{ "--cols": states.length } as React.CSSProperties}
    >
      {states.map((state) => (
        <WorkOrderColumn
          key={state}
          state={state}
          orders={orders.filter((order) => order.state === state)}
          href={navigationBaseHref}
        />
      ))}
    </div>
  );
}
