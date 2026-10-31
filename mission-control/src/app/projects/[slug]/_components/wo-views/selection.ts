import { statePresentation } from "@/components/core/Chip/vocabulary";
import type { ProjectFrd } from "@/lib/frds/frd-index";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
/** Canonical URL set order; labels, icons and hues come from the shared presentation table. */
export const STATES: readonly WorkOrderState[] = ["todo", "in_progress", "review", "done", "fail"];
/** Translate the reader's fail state into the shared vocabulary. */
export const presentation = (state: WorkOrderState) =>
  statePresentation(state === "fail" ? "blocked" : state);
/** Unknown input means no state filter; valid sets always use canonical order. */
export function parseStates(value?: string): WorkOrderState[] {
  const values = value?.split(",") ?? [];
  return values.some((state) => !STATES.includes(state as WorkOrderState))
    ? []
    : STATES.filter((state) => values.includes(state));
}
/** Resolve either a canonical code or a dependency map's folder slug against the discovered index. */
export function selectedFrd(frds: readonly ProjectFrd[], value?: string): string {
  return frds.find((frd) => frd.code === value || frd.slug === value)?.slug ?? "";
}
/** OR within the state set, AND with the selected FRD. */
export function filterOrders(
  orders: readonly WorkOrder[],
  frd: string,
  states: readonly WorkOrderState[],
): WorkOrder[] {
  return orders.filter(
    (order) => (!frd || order.frd === frd) && (!states.length || states.includes(order.state)),
  );
}
