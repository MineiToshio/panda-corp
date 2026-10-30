import { notFound } from "next/navigation";
import { resolveProjectPath } from "@/lib/config/config";
import { listProjectDocs } from "@/lib/docs/tree";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import type { RouteQuery } from "@/lib/navigation/routeState";
import { navigationHref, parseNavigationUrl } from "@/lib/navigation/urls";
import { resolveWorkspaceTab, type WorkspaceSelection } from "./ProjectWorkspace";

export function workspaceSelection(
  rawParams: RouteQuery,
  projectPath?: string,
): WorkspaceSelection {
  const params = parseNavigationUrl(normalizeLegacyNavigation(workspaceQueryHref(rawParams)));
  const activeTab = resolveWorkspaceTab(params.tab);
  if (typeof params.tab === "string" && params.tab !== activeTab) notFound();
  const defaultDoc =
    activeTab === "documents" && params.doc === undefined && projectPath
      ? listProjectDocs(resolveProjectPath(projectPath))[0]?.id
      : undefined;
  return {
    activeTab,
    docParam: typeof params.doc === "string" ? params.doc : defaultDoc,
    woParam: typeof params.wo === "string" && params.wo.length > 0 ? params.wo : undefined,
    woTabParam: (params.woview ?? params.wotab) === "full" ? "full" : "summary",
  };
}

export function workspaceHref(
  family: "/portfolio" | "/projects",
  params: RouteQuery,
  project: string | undefined,
  selection: WorkspaceSelection,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  return normalizeLegacyNavigation(
    navigationHref(`${family}?${query}`, {
      project: project ?? null,
      tab: selection.activeTab,
      doc: selection.activeTab === "documents" ? (selection.docParam ?? null) : null,
      wotab: selection.woParam ? selection.woTabParam : null,
      woview: selection.woParam ? selection.woTabParam : null,
    }),
  );
}

function workspaceQueryHref(params: RouteQuery): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  return `/portfolio?${query}`;
}
