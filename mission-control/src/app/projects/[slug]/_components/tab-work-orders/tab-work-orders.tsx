/**
 * WO-05-006 — TabWorkOrders (CMP-05-progress + CMP-05-empty coordinator)
 *
 * Server Component. Coordinates the work-orders tab view:
 *   - When orders.length === 0  → renders WorkOrderEmpty (AC-05-006.1)
 *   - When orders.length > 0   → renders WorkOrderProgressBar + WorkOrderBoard
 *                                 (AC-05-004.1 + AC-05-001.1)
 *
 * Traceability:
 *   AC-05-004.1  The view SHALL show aggregated progress done/total and %.
 *   AC-05-006.1  WHEN a project has no work orders, show the blueprint message.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on root and significant elements.
 *   - Server Component (no "use client" — CopyButton inside WorkOrderEmpty hydrates itself).
 */

import { aggregateProgress, type WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderEmpty } from "../wo-empty/wo-empty";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";
import { WorkOrderProgressBar } from "../wo-progress/wo-progress";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  overflow: "hidden",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TabWorkOrdersProps {
  /** All work orders for this project (from listWorkOrders). */
  orders: WorkOrder[];
}

/**
 * TabWorkOrders — top-level coordinator for the Work Orders tab.
 *
 * Server Component. Routes to empty state or (progress bar + kanban board)
 * depending on whether the project has any work orders.
 *
 * AC-05-004.1: progress aggregated from aggregateProgress(orders).
 * AC-05-006.1: empty state with /pandacorp:blueprint command + copy button.
 */
export function TabWorkOrders({ orders }: TabWorkOrdersProps): React.JSX.Element {
  if (orders.length === 0) {
    return (
      <div data-testid="tab-work-orders" style={ROOT_STYLE}>
        <WorkOrderEmpty />
      </div>
    );
  }

  const progress = aggregateProgress(orders);

  return (
    <div data-testid="tab-work-orders" style={ROOT_STYLE}>
      <WorkOrderProgressBar progress={progress} />
      <WoFrdFilteredBoard orders={orders} />
    </div>
  );
}
