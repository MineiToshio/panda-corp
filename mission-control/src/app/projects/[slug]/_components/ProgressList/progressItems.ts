import type { BuildTimeline } from "@/lib/build-track/build-track";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { type CopyKey, t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import { navigationHref } from "@/lib/navigation/urls";

/** One dated fact from a structured source, optionally linking to its change. */
export interface ProgressItem {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly subject: string;
  readonly tone: "green" | "pink" | "blue" | "slate";
  readonly href?: string;
}
const CHANGE_LABELS = {
  ready: "workspace.resumen.progress.changeReady",
  draft: "workspace.resumen.progress.changeDraft",
  building: "workspace.resumen.progress.changeBuilding",
  closing: "workspace.resumen.progress.changeBuilding",
  done: "workspace.resumen.progress.changeDone",
  discarded: "workspace.resumen.progress.changeDiscarded",
} as const satisfies Record<ChangeQueueItem["status"], CopyKey>;

function verifiedDays(timeline: BuildTimeline): ProgressItem[] {
  if (timeline.source !== "track") return [];
  const days = new Map<string, { date: string; count: number; frds: Set<string> }>();
  for (const frd of timeline.frds) {
    for (const order of frd.workOrders) {
      if (order.state !== "done" || order.endMs === null || !Number.isFinite(order.endMs)) continue;
      const date = new Date(order.endMs).toISOString();
      const day = formatDate(date);
      const group = days.get(day) ?? { date, count: 0, frds: new Set<string>() };
      group.count++;
      group.frds.add(frd.label);
      if (Date.parse(date) > Date.parse(group.date)) group.date = date;
      days.set(day, group);
    }
  }
  return [...days].map(([day, group]) => ({
    id: `verified-${day}`,
    date: group.date,
    label: t("workspace.resumen.progress.ordersVerified", { count: group.count }),
    subject: [...group.frds].sort().join(" · "),
    tone: "green",
  }));
}

function changeTone(status: ChangeQueueItem["status"]): ProgressItem["tone"] {
  if (status === "done") return "green";
  if (status === "building" || status === "closing") return "blue";
  return status === "discarded" ? "slate" : "pink";
}

/** Verified track end times by calendar day and dated changes, newest six instants first. */
export function progressItems(
  timeline: BuildTimeline,
  changes: readonly ChangeQueueItem[],
  navigationBaseHref: string,
): ProgressItem[] {
  const items = verifiedDays(timeline);
  for (const change of changes) {
    if (!Number.isFinite(Date.parse(change.date))) continue;
    items.push({
      id: `change-${change.id}`,
      date: change.date,
      label: t(CHANGE_LABELS[change.status]),
      subject: change.title,
      tone: changeTone(change.status),
      href: navigationHref(navigationBaseHref, { tab: "changes", change: change.id }),
    });
  }
  return items
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id))
    .slice(0, 6);
}
