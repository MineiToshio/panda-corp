"use client";

/**
 * WO-05-004 — WoFrdFilteredBoard (CMP-05-frd-filter integration)
 *
 * Client Component ("use client"). Stateful wrapper that combines:
 *   - WoFrdFilter  — the pill-style FRD filter bar
 *   - WorkOrderBoard — the 4-column read-only kanban
 *
 * Manages the selected-FRD state and passes a filtered WorkOrder[] to the
 * board so that selecting an FRD narrows the visible cards (AC-05-002.2).
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on the wrapper root for integration tests.
 *   - Server-first: only this component (the stateful filter shell) is client;
 *     the board and filter are rendered inside it.
 *
 * Traceability:
 *   AC-05-002.2  The kanban SHALL allow grouping/filtering by FRD.
 */

import { useState } from "react";

import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderBoard } from "./wo-board";
import { WoFrdFilter } from "./wo-frd-filter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the ordered list of distinct FRD slugs from the work orders. */
function distinctFrds(orders: WorkOrder[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const order of orders) {
    if (!seen.has(order.frd)) {
      seen.add(order.frd);
      result.push(order.frd);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WoFrdFilteredBoardProps {
  /** All work orders for this project (from listWorkOrders). */
  orders: WorkOrder[];
}

/**
 * WoFrdFilteredBoard — stateful wrapper combining the FRD filter + kanban board.
 *
 * "use client" because it owns the selectedFrd state that drives filtering.
 * AC-05-002.2: selecting an FRD narrows the kanban to that FRD's cards only;
 * selecting "All" (null) restores the full set.
 */
export function WoFrdFilteredBoard({ orders }: WoFrdFilteredBoardProps): React.JSX.Element {
  const [selectedFrd, setSelectedFrd] = useState<string | null>(null);

  const frds = distinctFrds(orders);

  const visibleOrders = selectedFrd === null ? orders : orders.filter((o) => o.frd === selectedFrd);

  return (
    <div
      data-testid="wo-frd-filtered-board"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <WoFrdFilter frds={frds} selected={selectedFrd} onSelect={setSelectedFrd} />
      <WorkOrderBoard orders={visibleOrders} />
    </div>
  );
}
