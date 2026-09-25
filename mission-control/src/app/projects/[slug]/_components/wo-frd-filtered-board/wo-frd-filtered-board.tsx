"use client";

/**
 * WO-05-004 — WoFrdFilteredBoard (CMP-05-frd-filter integration)
 * WO-05-007 — + WoStateFilter (CMP-05-state-filter), combined by logical AND
 *
 * Client Component ("use client"). Stateful wrapper that combines:
 *   - WoFrdFilter    — the pill-style FRD filter bar
 *   - WoStateFilter  — the pill-style work-order state filter bar
 *   - WorkOrderBoard — the 5-column read-only kanban
 *
 * Manages the selected-FRD and selected-state state and passes a filtered
 * WorkOrder[] to the board: selecting an FRD narrows the visible cards
 * (AC-05-002.2), selecting a state narrows them further (AC-05-007.1), and
 * both filters combine with logical AND (AC-05-007.2) — clearing either
 * ("All") restores the other's view.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on the wrapper root for integration tests.
 *   - Server-first: only this component (the stateful filter shell) is client;
 *     the board and filters are rendered inside it.
 *
 * Traceability:
 *   AC-05-002.2  The kanban SHALL allow grouping/filtering by FRD.
 *   REQ-05-007 / AC-05-007.1 / AC-05-007.2 / AC-05-007.3  Secondary state filter, AND-combined.
 */

import { useState } from "react";

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { WorkOrderBoard } from "../wo-board/wo-board";
import { WoFrdFilter } from "../wo-frd-filter/wo-frd-filter";
import { WoStateFilter } from "../wo-state-filter/wo-state-filter";

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
 * WoFrdFilteredBoard — stateful wrapper combining the FRD + state filters + kanban board.
 *
 * "use client" because it owns the selectedFrd/selectedState state that drives filtering.
 * AC-05-002.2: selecting an FRD narrows the kanban to that FRD's cards only.
 * AC-05-007.1: selecting a state narrows the kanban to that state's cards only.
 * AC-05-007.2: both filters combine with logical AND; selecting "All" (null) on either
 * restores the OTHER filter's view (not the full set) — the two states are independent.
 */
export function WoFrdFilteredBoard({ orders }: WoFrdFilteredBoardProps): React.JSX.Element {
  const [selectedFrd, setSelectedFrd] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<WorkOrderState | null>(null);

  const frds = distinctFrds(orders);

  const visibleOrders = orders
    .filter((o) => selectedFrd === null || o.frd === selectedFrd)
    .filter((o) => selectedState === null || o.state === selectedState);

  return (
    <div data-testid="wo-frd-filtered-board" style={{ display: "flex", flexDirection: "column" }}>
      <WoFrdFilter frds={frds} selected={selectedFrd} onSelect={setSelectedFrd} />
      <WoStateFilter selected={selectedState} onSelect={setSelectedState} />
      <WorkOrderBoard orders={visibleOrders} />
    </div>
  );
}
