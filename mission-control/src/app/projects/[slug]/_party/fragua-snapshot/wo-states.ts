/**
 * wo-states — translate the authoritative work-order frontmatter state into the
 * Party's per-WO visual `WoState`.
 *
 * The Work Orders board derives its Kanban column from each WO's
 * `implementation_status` frontmatter (via `listWorkOrders`). The Party scene
 * placed every running WO in the forge as `building`, derived independently
 * from the event stream — a second derivation of the same concept that drifts
 * (DR-092): the board showed `IN_REVIEW` while the Party still showed the WO
 * "building". This maps the board's authoritative state into the snapshot's
 * `WoState` vocabulary so both surfaces agree; `toFraguaSnapshot` consumes it
 * via `opts.woStates`.
 */

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

import type { WoState } from "../state-map/state-map";

/** WorkOrder frontmatter state → Party visual WoState (which room the sprite is in). */
const WO_STATE_TO_VISUAL: Readonly<Record<WorkOrderState, WoState>> = {
  todo: "building",
  in_progress: "building",
  review: "in_review",
  done: "verified",
  fail: "blocked",
};

/**
 * Build the authoritative per-WO visual-state map (id → WoState) the Party uses
 * to place each running sprite in the right room.
 *
 * @param workOrders - The project's work orders (from `listWorkOrders`).
 * @returns A plain record keyed by work-order id; empty when there are none.
 */
export function toWoStates(workOrders: readonly WorkOrder[]): Record<string, WoState> {
  const map: Record<string, WoState> = {};
  for (const wo of workOrders) {
    map[wo.id] = WO_STATE_TO_VISUAL[wo.state];
  }
  return map;
}
