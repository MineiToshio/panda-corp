import { cache } from "react";
import { now } from "@/lib/clock/clock";
import { type Lesson, promotionQueue } from "@/lib/memory/memory";
import { loadProposalsData, type ProposalsData } from "./data";
export const MEMORY_UNREVIEWED_DAYS = 2;
export type OwnerActionKind = "urgent" | "decide" | "important" | "ideas" | "memoryStale";
/** Public owner action contract. */
export interface OwnerAction {
  readonly kind: OwnerActionKind;
  readonly count: number;
  readonly command: string;
  readonly href: string;
  readonly firstTitle?: string;
}
/** Public owner actions result contract. */
export interface OwnerActionsResult {
  readonly actions: readonly OwnerAction[];
  readonly badgeCount: number;
  readonly upkeep:
    | { readonly kind: "current"; readonly date: string }
    | { readonly kind: "stale"; readonly days: number | null; readonly date?: string | null };
  readonly facts: {
    readonly activeRules: number | null;
    readonly waiting: number | null;
    readonly candidates: number | null;
    readonly rawNotes: number | null;
    readonly backlog: {
      readonly p0: number;
      readonly p1: number;
      readonly p2: number;
      readonly doing: number;
      readonly actionable: number;
    } | null;
  };
  readonly errors: readonly { readonly source: "memory" | "backlog"; readonly message: string }[];
  readonly waitingLessons: readonly Lesson[];
  readonly recentLessons: readonly Lesson[];
}
/** All views use the same union: queued + recently recurring, excluding already-decided lessons. */
export function resolveOwnerActions(data: ProposalsData, instant: Date): OwnerActionsResult {
  const recurringIds = new Set(
    data.suggestions.filter((x) => x.kind === "recurring-lesson").map((x) => x.target),
  );
  const eligible = data.lessons.filter(
    (x) => x.status !== "deprecated" && x.promotion !== "approved" && x.promotion !== "rejected",
  );
  const queue = promotionQueue(data.lessons);
  const recent = eligible.filter((x) => x.promotion !== "proposed" && recurringIds.has(x.id));
  const waiting = [...new Map([...queue, ...recent].map((x) => [x.id, x])).values()];
  const open = data.backlog.items.filter((x) => x.status === "open");
  const urgent = open.filter((x) => x.severity === "p0");
  const important = open.filter((x) => x.severity === "p1");
  const errors: OwnerActionsResult["errors"][number][] = [];
  if (data.memoryError) errors.push({ source: "memory", message: data.memoryError });
  if (data.backlog.errors.length)
    errors.push({
      source: "backlog",
      message: data.backlog.errors.map((e) => `${e.file}: ${e.reason}`).join("; "),
    });
  const sweep = data.health.lastSweepAt;
  const elapsed = sweep ? instant.getTime() - Date.parse(sweep) : Number.NaN;
  const current =
    Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= MEMORY_UNREVIEWED_DAYS * 86400000;
  const days = Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / 86400000) : null;
  const upkeep: OwnerActionsResult["upkeep"] =
    current && sweep ? { kind: "current", date: sweep } : { kind: "stale", days, date: sweep };
  const actions: OwnerAction[] = [];
  if (urgent.length > 0)
    actions.push({
      kind: "urgent",
      count: urgent.length,
      command: `/pandacorp:implement-backlog ${urgent[0]?.id}`,
      href: "/proposals/backlog",
      firstTitle: urgent[0]?.title,
    });
  if (!data.memoryError && waiting.length > 0)
    actions.push({
      kind: "decide",
      count: waiting.length,
      command: `/pandacorp:learn ${waiting[0]?.id}`,
      href: "/proposals/memory",
    });
  if (important.length > 0)
    actions.push({
      kind: "important",
      count: important.length,
      command: `/pandacorp:implement-backlog ${important[0]?.id}`,
      href: "/proposals/backlog",
    });
  if (data.discoveredIdeas > 0)
    actions.push({
      kind: "ideas",
      count: data.discoveredIdeas,
      command: "/pandacorp:recommend",
      href: "/board",
    });
  if (!data.memoryError && !current && days !== null)
    actions.push({
      kind: "memoryStale",
      count: days,
      command: "/pandacorp:memory harvest",
      href: "/proposals/memory",
    });
  return {
    actions,
    badgeCount: actions.length,
    upkeep,
    errors,
    waitingLessons: waiting,
    recentLessons: recent,
    facts: resolveFacts(data, waiting.length),
  };
}

function resolveFacts(data: ProposalsData, waiting: number): OwnerActionsResult["facts"] {
  const open = data.backlog.items.filter((x) => x.status === "open");
  return {
    activeRules: data.memoryError ? null : data.lessons.filter((x) => x.status === "active").length,
    waiting: data.memoryError ? null : waiting,
    candidates: data.memoryError
      ? null
      : data.lessons.filter((x) => x.status === "candidate").length,
    rawNotes: data.memoryError ? null : data.health.rawNotes,
    backlog: data.backlog.errors.some(
      (error) => error.reason === "backlog directory could not be read",
    )
      ? null
      : {
          p0: open.filter((x) => x.severity === "p0").length,
          p1: open.filter((x) => x.severity === "p1").length,
          p2: open.filter((x) => x.severity === "p2").length,
          doing: data.backlog.items.filter((x) => x.status === "doing").length,
          actionable: data.backlog.items.filter((x) => x.status === "open" || x.status === "doing")
            .length,
        },
  };
}

/** Shared public resolver used by the page and the future sidebar. */
export const ownerActions = cache(
  (): OwnerActionsResult => resolveOwnerActions(loadProposalsData(), now()),
);
