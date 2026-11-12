import type { WorkOrder, WorkOrderState } from "../work-orders/work-orders";
import type { BuildRun, BuildRunUnit } from "./types";

const LIVE_COLUMN: Partial<Record<BuildRunUnit["state"], WorkOrderState>> = {
  queued: "todo",
  patching: "todo",
  admitted: "in_progress",
  running: "in_progress",
  reported: "review",
  committed: "review",
  integrated: "review",
  reviewing: "review",
  verified: "review",
  blocked: "fail",
  landed: "done",
};
/** Work-order display preserves durable main state and its live unit provenance separately. */
export type DisplayWorkOrder = WorkOrder & {
  durableState: WorkOrderState;
  inBuild: boolean;
  buildUnit?: { id: string; state: BuildRunUnit["state"]; reason: string | null };
};
function supersedes(previous: BuildRunUnit | undefined, unit: BuildRunUnit): boolean {
  if (previous?.kind === "patch" && unit.kind === "build") return false;
  return previous?.id !== unit.id || previous.attempt <= unit.attempt;
}
function selectUnits(run: BuildRun): Map<string, BuildRunUnit> {
  const selected = new Map<string, BuildRunUnit>();
  if (run.state?.status !== "active" || !run.matchesLease || !run.live) return selected;
  for (const unit of run.state.units) {
    if (unit.kind !== "build" && unit.kind !== "patch") continue;
    for (const wo of unit.wos) {
      const previous = selected.get(wo);
      if (supersedes(previous, unit)) selected.set(wo, unit);
    }
  }
  return selected;
}
/** One live/durable mapping for bars, columns and scenes. Unknown WOs remain explicit errors. */
export function buildWorkOrderDisplay(
  orders: readonly WorkOrder[],
  run: BuildRun,
): {
  items: DisplayWorkOrder[];
  errors: { path: string; reason: string }[];
} {
  const selected = selectUnits(run);
  const known = new Set(orders.map((wo) => wo.id));
  const errors = [...selected.keys()]
    .filter((id) => !known.has(id))
    .map((id) => ({
      path: ".pandacorp/run/build/state.json",
      reason: `Referencia a work order sin documento: ${id}`,
    }));
  const items = orders.map((wo): DisplayWorkOrder => {
    const unit = selected.get(wo.id);
    return {
      ...wo,
      durableState: wo.state,
      state: unit ? (LIVE_COLUMN[unit.state] ?? wo.state) : wo.state,
      inBuild: Boolean(unit),
      ...(unit
        ? {
            buildUnit: {
              id: unit.id,
              state: unit.state,
              reason: unit.pending_answer ?? unit.waiting_gate ?? unit.parked,
            },
          }
        : {}),
    };
  });
  return { items, errors };
}
