import { cache } from "react";
import { resolveProjectPath } from "@/lib/config/config";
import { t } from "@/lib/copy/copy";
import { listProjectFrds } from "@/lib/frds/frd-index";
import { readIdeas } from "@/lib/ideas/ideas";
import { workspaceCommands } from "@/lib/next-step/next-step";
import { getProjectOverview, type ProjectOverviewItem } from "@/lib/portfolio/overview";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { getServicesDirectory } from "@/lib/services/services";
import { projectServiceRows } from "@/lib/services/views";
import { readArtifact } from "@/lib/spec/read-artifacts";

/** Compose shared facts once; failed counts retain their unknown state. */
/** The idea body's first real paragraph as plain text: the hero never shows markdown syntax. */
function firstUsefulParagraph(markdown: string | undefined): string | undefined {
  return markdown
    ?.split(/\n\s*\n/)
    .map((part) =>
      part
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/[*_`[\]]/g, "")
        .trim(),
    )
    .find((part) => part.length > 20 && !part.startsWith("|"));
}

export const loadWorkspaceProject = cache((item: ProjectListItem) => {
  const projectPath = resolveProjectPath(item.path);
  const projects = getProjectOverview();
  const overview = projects.find((entry) => resolveProjectPath(entry.path) === projectPath);
  if (!overview) throw new Error(`Workspace project is absent from the portfolio: ${item.path}`);
  const status = item.status.present && !item.status.malformed ? item.status.status : {};
  const services = getServicesDirectory();
  const accountHref = `/portfolio/${encodeURIComponent(overview.id)}/accounts`;
  const serviceId =
    services.allocations.find((row) => row.projectHref === accountHref)?.projectId ?? overview.id;
  const serviceCount = services.issues.some(
    (issue) =>
      issue.source === "factory/services/catalog.yaml" ||
      issue.source ===
        `projects/${projectPath
          .split("/")
          .at(-1)
          ?.replace(/[^a-zA-Z0-9_-]/g, "_")}/.pandacorp/accounts/services.yaml`,
  )
    ? null
    : projectServiceRows(services, serviceId).length;
  const { ordersVerified: done, ordersTotal: total } = overview.counts;
  const progress = {
    done,
    total,
    pct: done !== null && total !== null && total > 0 ? Math.round((done / total) * 100) : null,
  };
  const card = readIdeas().find(
    (idea) => idea.project && resolveProjectPath(idea.project) === projectPath,
  );
  const frds = readArtifact(() => listProjectFrds(projectPath), []);
  return {
    slug: overview.id,
    name: overview.name,
    projectPath,
    folder: projectPath.split("/").at(-1) ?? overview.id,
    status,
    phase: overview.phase,
    version: status.version,
    build: overview.build,
    nowIso: overview.nowIso,
    projects,
    overview,
    progress,
    counts: {
      orders: total,
      frds: overview.counts.frds,
      documents: overview.counts.docs,
      adrs: overview.counts.adrs,
      openChanges: overview.counts.openChanges,
      services: serviceCount,
    },
    pendingDecisions: overview.counts.pendingDecisions,
    lastMove: overview.lastCommit.at,
    nextStep: { command: overview.nextCommand, sentence: nextSentence(overview) },
    summary: firstUsefulParagraph(card?.body) ?? overview.name,
    projectType: card?.projectType,
    frds: frds.value,
    frdError: frds.error,
    services,
    serviceId,
    constructionStarted: overview.phase === "implementation" || overview.phase === "release",
  };
});
export type WorkspaceProject = ReturnType<typeof loadWorkspaceProject>;

function nextSentence(overview: ProjectOverviewItem): string {
  if (overview.phase === "release") return t("workspace.resumen.nextStep.release");
  const { ordersTotal: total, ordersVerified: done, openChanges } = overview.counts;
  if (overview.phase === "implementation" && overview.nextCommand === "/pandacorp:implement") {
    if (total !== null && done !== null && total > done) {
      const remaining = total - done;
      return remaining === 1
        ? t("workspace.resumen.nextStep.implementOne")
        : t("workspace.resumen.nextStep.implementMany", { count: remaining });
    }
    return t(
      openChanges
        ? "workspace.resumen.nextStep.implementChanges"
        : "workspace.resumen.nextStep.implementContinue",
    );
  }
  if (overview.phase) {
    const row = workspaceCommands(overview.phase).find(
      (row) => row.command === overview.nextCommand,
    );
    if (row) return row.when;
  }
  return t("workspace.resumen.nextStep.reviewProject");
}
