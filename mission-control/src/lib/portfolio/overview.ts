import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { countOpenChanges } from "@/lib/changes/openChanges";
import { now } from "@/lib/clock/clock";
import { resolveProjectPath } from "@/lib/config/config";
import { countFrdFolders, listProjectDocs } from "@/lib/docs/tree";
import { readEvents } from "@/lib/events/events";
import { type BuildSignal, buildSignal } from "@/lib/fragua/build-signal";
import { latestBuildEvent } from "@/lib/fragua/live-events";
import { getProjectNavigation } from "@/lib/navigation/identities";
import { nextStep } from "@/lib/next-step/next-step";
import { projectDisplayName } from "@/lib/portfolio/displayName";
import type { Phase } from "@/lib/status/status";
import { aggregateProgress, listWorkOrders } from "@/lib/work-orders/work-orders";
import { getLastCommit, type LastCommit } from "./lastCommit";
import { allProjects, type ProjectListItem } from "./portfolio";

export interface ProjectOverviewItem {
  /** Stable mount seam for the workspace until its v2 work order. */
  readonly source: ProjectListItem;
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly repo?: string;
  readonly phase?: Phase;
  readonly stageIndex: number;
  readonly build: BuildSignal;
  readonly nowIso: string;
  readonly lastCommit: LastCommit;
  readonly pathMissing: boolean;
  readonly counts: {
    readonly ordersVerified: number | null;
    readonly ordersTotal: number | null;
    readonly frds: number | null;
    readonly docs: number | null;
    readonly adrs: number | null;
    readonly openChanges: number | null;
    readonly pendingDecisions: number | null;
  };
  readonly nextCommand: string;
}

const STAGE_INDEX = { product: 2, design: 3, architecture: 4, implementation: 5, release: 6 };
const UNKNOWN_COUNTS: ProjectOverviewItem["counts"] = {
  ordersVerified: null,
  ordersTotal: null,
  frds: null,
  docs: null,
  adrs: null,
  openChanges: null,
  pendingDecisions: null,
};

function projectCounts(item: ProjectListItem, projectPath: string): ProjectOverviewItem["counts"] {
  if (!item.exists) return UNKNOWN_COUNTS;
  try {
    assertReadableSources(path.join(projectPath, "docs"));
    return readCounts(item, projectPath);
  } catch {
    return UNKNOWN_COUNTS;
  }
}

function assertReadableSources(directory: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) assertReadableSources(child);
    else if (entry.isFile() && entry.name.endsWith(".md")) fs.accessSync(child, fs.constants.R_OK);
  }
}

function readCounts(item: ProjectListItem, projectPath: string): ProjectOverviewItem["counts"] {
  const progress = aggregateProgress(listWorkOrders(projectPath));
  const docs = listProjectDocs(projectPath);
  return {
    ordersVerified: progress.done,
    ordersTotal: progress.total,
    frds: countFrdFolders(docs),
    docs: docs.length,
    adrs: docs.filter((doc) => doc.relPath.startsWith("docs/adr/")).length,
    openChanges: countOpenChanges(projectPath).count,
    pendingDecisions:
      item.status.present && !item.status.malformed
        ? (item.status.status.pendingDecisions ?? null)
        : null,
  };
}

function overviewItem(item: ProjectListItem, nowIso: string): ProjectOverviewItem {
  const projectPath = resolveProjectPath(item.path);
  const counts = projectCounts(item, projectPath);
  const status = item.status.present && !item.status.malformed ? item.status.status : {};
  const eventProject = path.basename(projectPath);
  const events = item.exists
    ? readEvents({ project: eventProject, cap: Number.MAX_SAFE_INTEGER }).events
    : [];
  return {
    source: item,
    id: getProjectNavigation(item.path, item.name).slug,
    name: projectDisplayName(item.name),
    path: item.path,
    repo: item.repo,
    phase: item.stage,
    stageIndex: item.stage ? STAGE_INDEX[item.stage] : 0,
    build: buildSignal({
      running: item.running,
      supervisorHeartbeat: status.supervisorHeartbeat,
      lastEventAt: latestBuildEvent(events, eventProject),
      nowMs: Date.parse(nowIso),
    }),
    nowIso,
    lastCommit: item.exists ? getLastCommit(projectPath) : { at: null, reason: "no-repository" },
    pathMissing: !item.exists,
    counts,
    nextCommand:
      item.stage === "release"
        ? "/pandacorp:review-launch"
        : item.stage === "implementation" &&
            (counts.ordersTotal === null ||
              counts.ordersVerified === null ||
              counts.ordersVerified < counts.ordersTotal)
          ? "/pandacorp:implement"
          : nextStep({ cardStatus: "in-pipeline", phase: item.stage }).command,
  };
}

/** Shared request-scoped projection for cards, comparison, picker, sidebar and Inicio. */
export const getProjectOverview = cache((): ProjectOverviewItem[] => {
  const nowIso = now().toISOString();
  return allProjects()
    .map((item) => overviewItem(item, nowIso))
    .sort(
      (a, b) =>
        (b.lastCommit.at ? Date.parse(b.lastCommit.at) : -Infinity) -
          (a.lastCommit.at ? Date.parse(a.lastCommit.at) : -Infinity) ||
        a.name.localeCompare(b.name, "es"),
    );
});
