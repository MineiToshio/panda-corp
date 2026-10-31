import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { type ChangeQueueItem, readChangeQueue } from "@/lib/changes/changes";
import { resolveProjectPath } from "@/lib/config/config";
import { type DecisionPoint, readDecisionSource } from "@/lib/docs/activity";
import { getProjectNavigation } from "@/lib/navigation/identities";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { listWorkOrders, type WorkOrder } from "@/lib/work-orders/work-orders";

export interface InboxError {
  readonly project: string;
  readonly source: "decisions" | "changes" | "work-orders";
}
export interface ProjectInbox {
  readonly name: string;
  readonly id: string;
  readonly path: string;
  readonly decisions: readonly DecisionPoint[];
  readonly changes: readonly ChangeQueueItem[];
  readonly workOrders: readonly WorkOrder[];
  readonly errors: readonly InboxError[];
}

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function assertQueueReadable(directory: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (missing(error)) return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === "done") assertQueueReadable(target);
    else if (entry.isFile() && entry.name.endsWith(".md")) fs.accessSync(target, fs.constants.R_OK);
  }
}
/** Read one project's inbox, preserving a named error for every unreadable source. */
export function readProjectInbox(
  project: Pick<ProjectInbox, "name" | "id" | "path">,
): ProjectInbox {
  const errors: InboxError[] = [];
  let decisions: DecisionPoint[] = [];
  let changes: ChangeQueueItem[] = [];
  let workOrders: WorkOrder[] = [];
  try {
    const result = readDecisionSource(project.path);
    decisions = result.decisions;
    if (result.invalid) errors.push({ project: project.name, source: "decisions" });
  } catch {
    errors.push({ project: project.name, source: "decisions" });
  }
  try {
    assertQueueReadable(path.join(project.path, ".pandacorp/inbox/changes"));
    const queue = readChangeQueue(project.path);
    changes = queue.items;
    if (queue.errors.length) errors.push({ project: project.name, source: "changes" });
  } catch {
    errors.push({ project: project.name, source: "changes" });
  }
  try {
    workOrders = listWorkOrders(project.path);
  } catch {
    errors.push({ project: project.name, source: "work-orders" });
  }
  return { ...project, decisions, changes, workOrders, errors };
}
/** Request-cached inbox traversal in the portfolio's source order. */
export const projectInboxes = cache((): ProjectInbox[] =>
  readPortfolio().map((project) =>
    readProjectInbox({
      name: project.name,
      id: getProjectNavigation(project.path, project.name).slug,
      path: resolveProjectPath(project.path),
    }),
  ),
);
