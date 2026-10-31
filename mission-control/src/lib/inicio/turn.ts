import { cache } from "react";
import { now } from "@/lib/clock/clock";
import { t } from "@/lib/copy/copy";
import { formatRelative } from "@/lib/copy/dates";
import { isEngineLogEntry } from "@/lib/docs/activity";
import { type InboxError, type ProjectInbox, projectInboxes } from "./inbox";

export interface OwnerTurnItem {
  readonly kind: "decision" | "change";
  readonly id: string;
  readonly title: string;
  readonly project: string;
  readonly projectId: string;
  readonly where: string;
  readonly command: string;
  readonly date: string | null;
  readonly ageDays: number | null;
  readonly ageLabel: string;
  readonly ask?: string;
  readonly recommendation?: string;
  readonly context?: string;
  readonly body?: string;
}
export interface OwnerTurnResult {
  readonly items: readonly OwnerTurnItem[];
  readonly count: number;
  readonly errors: readonly InboxError[];
}

function itemBase(project: ProjectInbox, date: string | null, nowIso: string) {
  const elapsed = date ? Date.parse(nowIso) - Date.parse(date) : Number.NaN;
  return {
    project: project.name,
    projectId: project.id,
    where: project.path,
    date,
    ageDays: Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86400000)) : null,
    ageLabel: date ? formatRelative(date, nowIso) : t("common.relativeTime.noRecord"),
  };
}
/** Decisions first, then ready changes; never truncate or count work owned by the engine. */
export function deriveOwnerTurn(
  projects: readonly ProjectInbox[],
  nowIso: string,
  project?: string,
): OwnerTurnResult {
  const selected = projects.filter(
    (entry) => !project || [entry.id, entry.name, entry.path].includes(project),
  );
  const decisions: OwnerTurnItem[] = selected.flatMap((entry) =>
    entry.decisions
      .filter((point) => !point.resolved && !point.resolvedInFile && !isEngineLogEntry(point))
      .map((point) => ({
        ...itemBase(entry, point.date, nowIso),
        kind: "decision" as const,
        id: point.id,
        title: point.title,
        command: `/pandacorp:decide ${point.id}`,
        ask: point.ask,
        context: point.context,
        recommendation: point.recommendation,
      })),
  );
  const changes: OwnerTurnItem[] = selected.flatMap((entry) =>
    entry.changes
      .filter((change) => change.status === "ready")
      .map((change) => ({
        ...itemBase(entry, change.date || null, nowIso),
        kind: "change" as const,
        id: change.id,
        title: change.title,
        body: change.body,
        command: `/pandacorp:implement change:${change.id}`,
      })),
  );
  const items = [...decisions, ...changes];
  return {
    items,
    count: items.length,
    errors: selected.flatMap((entry) =>
      entry.errors.filter((error) => error.source !== "work-orders"),
    ),
  };
}
/** The shared owner queue/count, optionally scoped to one project identity. */
export const ownerTurnItems = cache(
  (options?: { readonly project?: string }): OwnerTurnResult =>
    deriveOwnerTurn(projectInboxes(), now().toISOString(), options?.project),
);
