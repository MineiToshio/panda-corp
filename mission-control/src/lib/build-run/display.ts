import type { WorkOrder, WorkOrderState } from "../work-orders/work-orders";
import type { BuildRun, BuildRunUnit } from "./types";

const LIVE_COLUMN: Partial<Record<BuildRunUnit["state"], WorkOrderState>> = {
  queued: "todo",
  patching: "todo",
  admitted: "in_progress",
  running: "in_progress",
  rescue: "in_progress",
  abandoned: "fail",
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
function canOverlay(run: BuildRun): boolean {
  return (
    run.state?.status === "completed_with_gaps" ||
    (run.state?.status === "active" && run.matchesLease && run.live)
  );
}
function selectUnits(run: BuildRun): Map<string, BuildRunUnit> {
  const selected = new Map<string, BuildRunUnit>();
  const closedWithGaps = run.state?.status === "completed_with_gaps";
  if (!canOverlay(run)) return selected;
  for (const unit of run.state?.units ?? []) {
    if (closedWithGaps && unit.state !== "abandoned") continue;
    if (unit.kind !== "build" && unit.kind !== "patch") continue;
    for (const wo of unit.wos) {
      const previous = selected.get(wo);
      if (supersedes(previous, unit)) selected.set(wo, unit);
    }
  }
  return selected;
}
/** Shared Spanish reason for both the WO projection and build details. */
export function buildUnitReason(unit: BuildRunUnit): string | null {
  if (unit.state === "rescue" || unit.state === "abandoned")
    return `${unit.state === "rescue" ? "Rescate en curso" : "Abandonada"}: ${unit.rescue?.failure ?? unit.rescue?.cause ?? "sin motivo registrado"}`.replaceAll(
      "—",
      ",",
    );
  return unit.pending_answer ?? unit.waiting_gate ?? unit.parked;
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
              reason: buildUnitReason(unit),
            },
          }
        : {}),
    };
  });
  return { items, errors };
}
