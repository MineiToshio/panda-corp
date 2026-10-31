import { cache } from "react";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import { type ProjectInbox, projectInboxes } from "./inbox";
export type FlightKind = "building" | "review" | "draft";
export interface FlightRow {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly href: string;
  readonly count?: number;
}
export interface FlightGroupData {
  readonly kind: FlightKind;
  readonly rows: readonly FlightRow[];
}
/** Group engine-owned work without silently showing empty groups. */
export function deriveFlightGroups(projects: readonly ProjectInbox[]): FlightGroupData[] {
  const groups: Record<FlightKind, FlightRow[]> = { building: [], review: [], draft: [] };
  for (const project of projects) {
    const href = (tab: string, extra: Record<string, string> = {}) =>
      navigationHref("/portfolio", { project: project.id, tab, ...extra });
    for (const change of project.changes.filter((item) => item.status === "building")) {
      groups.building.push({
        id: `${project.id}:${change.id}`,
        project: project.name,
        title: change.title,
        href: href("changes", { change: change.id }),
      });
    }
    for (const order of project.workOrders.filter((item) => item.state === "review")) {
      groups.review.push({
        id: `${project.id}:${order.id}`,
        project: project.name,
        title: `${order.id} · ${order.title}`,
        href: href("work-orders", { wo: order.id }),
      });
    }
    const count = project.changes.filter((item) => item.status === "draft").length;
    if (count)
      groups.draft.push({
        id: project.id,
        project: project.name,
        title: t("inicio.attention.draft.title", { count }),
        href: href("changes"),
      });
  }
  return (["building", "review", "draft"] as const).flatMap((kind) =>
    groups[kind].length ? [{ kind, rows: groups[kind] }] : [],
  );
}
/** Request-cached in-flight groups. Read errors remain named at the card boundary. */
export const inFlightGroups = cache((): FlightGroupData[] => deriveFlightGroups(projectInboxes()));
