/**
 * WO-05-003 — TabWorkOrders (CMP-05-empty coordinator)
 *
 * Server Component. Coordinates the work-orders tab view:
 *   - When orders.length === 0  → renders WorkOrderEmpty (AC-05-006.1)
 *   - When orders.length > 0   → renders WorkOrderBoard (AC-05-001.1)
 *
 * Also mounts WoLiveRefresh (a thin "use client" child) so the board updates
 * live off the SSE event stream without polling (AC-05-005.1).
 *
 * Note (#22): the per-tab work-order progress bar was REMOVED — it duplicated the
 * canonical objectives/progress bar in the project header (the prototype's
 * `projWO()` has no progress bar; it lives in the header). The aggregated count
 * is owned by the header now, so the tab no longer aggregates it.
 *
 * Traceability:
 *   AC-05-005.1  Board SHALL update LIVE as agents change WO state (no reload).
 *   AC-05-006.1  WHEN a project has no work orders, show the blueprint message.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on root and significant elements.
 *   - Server Component (no "use client" — client children hydrate themselves).
 */

import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderEmpty } from "../wo-empty/wo-empty";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";
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
 * Server Component. Routes to the empty state or the kanban board depending on
 * whether the project has any work orders.
 *
 * The aggregated done/total progress is NOT shown here (#22): it duplicated the
 * canonical objectives bar in the project header. The header owns that figure now.
 *
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

  return (
    <div data-testid="tab-work-orders" style={ROOT_STYLE}>
      {/* Live SSE connector — invisible, triggers router.refresh() on new events */}
      {project !== undefined && <WoLiveRefresh project={project} />}
      <WoFrdFilteredBoard orders={orders} />
    </div>
  );
}
