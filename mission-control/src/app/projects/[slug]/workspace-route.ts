import { resolveProjectPath } from "@/lib/config/config";
import { listProjectDocs } from "@/lib/docs/tree";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import type { RouteQuery } from "@/lib/navigation/routeState";
import { navigationHref, parseNavigationUrl } from "@/lib/navigation/urls";
import type { WorkspaceSelection } from "./_panels/types";
import { resolveWorkspaceTab } from "./ProjectWorkspace";

export function workspaceSelection(
  rawParams: RouteQuery,
  projectPath?: string,
): WorkspaceSelection {
  const params = parseNavigationUrl(normalizeLegacyNavigation(workspaceQueryHref(rawParams)));
  const activeTab = resolveWorkspaceTab(params.tab);

  const defaultDoc =
    activeTab === "documents" && params.doc === undefined && projectPath
      ? listProjectDocs(resolveProjectPath(projectPath))[0]?.id
      : undefined;
  return {
    activeTab,
    ...(activeTab === "unknown"
      ? { rawTab: typeof rawParams.raw === "string" ? decodeRawTab(rawParams.raw) : params.tab }
      : {}),
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
      raw: null,
      tab:
        selection.activeTab === "unknown" ? (selection.rawTab ?? "unknown") : selection.activeTab,
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
  if (!query.has("project")) query.set("project", "workspace");
  return `/portfolio?${query}`;
}

function decodeRawTab(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
