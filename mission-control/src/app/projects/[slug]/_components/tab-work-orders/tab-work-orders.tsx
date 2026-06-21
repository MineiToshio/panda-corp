/**
 * WO-05-003 — TabWorkOrders (CMP-05-progress + CMP-05-empty coordinator)
 *
 * Server Component. Coordinates the work-orders tab view:
 *   - When orders.length === 0  → renders WorkOrderEmpty (AC-05-006.1)
 *   - When orders.length > 0   → renders WorkOrderProgressBar + WorkOrderBoard
 *                                 (AC-05-004.1 + AC-05-001.1)
 *
 * Also mounts WoLiveRefresh (a thin "use client" child) so the board updates
 * live off the SSE event stream without polling (AC-05-005.1).
 *
 * Traceability:
 *   AC-05-004.1  The view SHALL show aggregated progress done/total and %.
 *   AC-05-005.1  Board SHALL update LIVE as agents change WO state (no reload).
 *   AC-05-006.1  WHEN a project has no work orders, show the blueprint message.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on root and significant elements.
 *   - Server Component (no "use client" — client children hydrate themselves).
 */

import { aggregateProgress, type WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderEmpty } from "../wo-empty/wo-empty";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";
import { WorkOrderProgressBar } from "../wo-progress/wo-progress";
import { WoLiveRefresh } from "./wo-live-refresh";

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
  /**
   * Project slug — passed to WoLiveRefresh so it subscribes to the right
   * SSE stream (AC-05-005.1). Optional: if absent, live refresh is disabled
   * (e.g. in tests that don't need live updates).
   */
  project?: string;
}

/**
 * TabWorkOrders — top-level coordinator for the Work Orders tab.
 *
 * Server Component. Routes to empty state or (progress bar + kanban board)
 * depending on whether the project has any work orders.
 *
 * AC-05-004.1: progress aggregated from aggregateProgress(orders).
 * AC-05-005.1: WoLiveRefresh subscribes to SSE and calls router.refresh() on
 *   new events, causing the Server Component tree to re-run and re-read files.
 * AC-05-006.1: empty state with /pandacorp:blueprint command + copy button.
 */
export function TabWorkOrders({ orders, project }: TabWorkOrdersProps): React.JSX.Element {
  if (orders.length === 0) {
    return (
      <div data-testid="tab-work-orders" style={ROOT_STYLE}>
        {project !== undefined && <WoLiveRefresh project={project} />}
        <WorkOrderEmpty />
      </div>
    );
  }

  const progress = aggregateProgress(orders);

  return (
    <div data-testid="tab-work-orders" style={ROOT_STYLE}>
      {/* Live SSE connector — invisible, triggers router.refresh() on new events */}
      {project !== undefined && <WoLiveRefresh project={project} />}
      <WorkOrderProgressBar progress={progress} />
      <WoFrdFilteredBoard orders={orders} />
    </div>
  );
}
