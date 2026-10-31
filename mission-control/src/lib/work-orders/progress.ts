import type { WorkOrder, WorkOrderProgress } from "./work-orders";
/** Pure progress resolver, safe for server and client views. */
export function aggregateProgress(orders: WorkOrder[]): WorkOrderProgress {
  const total = orders.length;
  const done = orders.filter((o) => o.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
  return { done, total, pct };
}
