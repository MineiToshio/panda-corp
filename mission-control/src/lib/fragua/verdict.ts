import type { Presentation } from "@/components/core/Chip/vocabulary";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import type { BuildSignal } from "./build-signal";
import { formatSignalAge } from "./signal-age";

const HEALTH = {
  noSignal: { tone: "coral", icon: "alert", labelKey: "workspace.resumen.verdict.noSignal" },
  waitingYou: { tone: "amber", icon: "flag", labelKey: "workspace.resumen.verdict.waitingYou" },
  building: { tone: "violet", icon: "loader", labelKey: "workspace.resumen.verdict.building" },
  paused: { tone: "slate", icon: "clock", labelKey: "workspace.resumen.verdict.paused" },
  readyToLaunch: {
    tone: "green",
    icon: "rocket",
    labelKey: "workspace.resumen.verdict.readyToLaunch",
  },
  advancing: { tone: "green", icon: "activity", labelKey: "workspace.resumen.verdict.advancing" },
} as const satisfies Record<string, Presentation>;
interface VerdictInput {
  readonly orders: readonly WorkOrder[];
  readonly phase?: string;
  readonly signal: BuildSignal;
  readonly nowMs: number;
  readonly openChanges?: number | null;
  readonly ownerPending?: number | null;
  readonly lastActivityAt?: string | null;
}
function health(input: VerdictInput): keyof typeof HEALTH {
  if (input.signal.kind === "no-signal") return "noSignal";
  if (input.ownerPending) return "waitingYou";
  if (input.signal.kind === "live") return "building";
  if (input.lastActivityAt && input.nowMs - Date.parse(input.lastActivityAt) > 7 * 86400000)
    return "paused";
  if (
    input.orders.length &&
    input.orders.every((order) => order.state === "done") &&
    input.phase === "implementation"
  )
    return "readyToLaunch";
  return "advancing";
}
function progressText(input: VerdictInput): string[] {
  const total = input.orders.length;
  const n = (state: WorkOrder["state"]) =>
    input.orders.filter((order) => order.state === state).length;
  const done = n("done"),
    left = total - done;
  const phase = t(phasePresentation(input.phase).labelKey);
  if (!total)
    return [t("workspace.resumen.verdict.noOrders", { phase: phase.toLocaleLowerCase("es") })];
  const parts = [
    t("workspace.resumen.verdict.progress", {
      phase,
      pct: Math.round((done / total) * 100),
      done,
      total,
    }),
  ];
  if (!left) return parts;
  if (n("review") === left) {
    parts.push(
      t(
        left === 1
          ? "workspace.resumen.verdict.remainingOneReview"
          : "workspace.resumen.verdict.remainingManyReview",
        { left },
      ),
    );
    return parts;
  }
  const remaining = [
    n("review") ? t("workspace.resumen.verdict.partReview", { count: n("review") }) : "",
    n("in_progress")
      ? t("workspace.resumen.verdict.partInProgress", { count: n("in_progress") })
      : "",
    n("todo") ? t("workspace.resumen.verdict.partTodo", { count: n("todo") }) : "",
    n("fail") ? t("workspace.resumen.verdict.partBlocked", { count: n("fail") }) : "",
  ]
    .filter(Boolean)
    .join(", ");
  parts.push(
    t(
      left === 1 ? "workspace.resumen.verdict.missingOne" : "workspace.resumen.verdict.missingMany",
      { left, parts: remaining },
    ),
  );
  return parts;
}
/** Project verdict with explicit omission of unavailable facts, never invented counts. */
export function deriveVerdict(input: VerdictInput): {
  health: keyof typeof HEALTH;
  presentation: Presentation;
  text: string;
} {
  const parts = progressText(input);
  if (input.openChanges)
    parts.push(t("workspace.resumen.verdict.openChanges", { count: input.openChanges }));
  if (input.signal.kind === "no-signal")
    parts.push(
      input.signal.ageMinutes === null
        ? t("workspace.resumen.verdict.noSignalRegistered")
        : t("workspace.resumen.verdict.noSignalSince", {
            ago: formatSignalAge(input.signal.ageMinutes),
          }),
    );
  if (input.ownerPending != null)
    parts.push(
      input.ownerPending
        ? t("workspace.resumen.verdict.waitingCount", { count: input.ownerPending })
        : t("workspace.resumen.verdict.nothingWaiting"),
    );
  const key = health(input);
  return { health: key, presentation: HEALTH[key], text: parts.join(" ") };
}
