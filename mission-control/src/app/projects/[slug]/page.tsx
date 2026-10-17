/**
 * Project workspace page (CMP-04-workspace) — the standalone deep-link.
 *
 * Resolves the project from the URL slug + status, derives the URL-driven tab selection, and renders
 * the SHARED <ProjectWorkspace> (the same body the Portfolio right pane embeds — prototype projectPane,
 * DEC-4). The page column (#pcapp, centered 1240px maximum) supplied by the shell frames it in normal flow.
 *
 * URL-driven selection (AC-04-001.2): ?tab / ?doc / ?wo / ?wotab. Absent/invalid tab → "summary".
 *
 * Traceability: CMP-04-workspace → REQ-04-001/002; IF-04-status, IF-03-activeProjects.
 */

import { notFound } from "next/navigation";
import { getProjectNavigation, resolveProjectNavigation } from "@/lib/navigation/identities";
import { NavigationCanonical } from "@/lib/navigation/NavigationCanonical";
import { routeHref } from "@/lib/navigation/routeState";
import { activeProjects } from "@/lib/portfolio/portfolio";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { workspaceHref, workspaceSelection } from "./workspace-route";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  routeState?: Record<string, string>;
}

export default async function ProjectWorkspacePage({
  params,
  searchParams,
  routeState = {},
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const rawQuery = await searchParams;
  routeHref("/projects", [slug], rawQuery);
  const sp = { ...rawQuery, ...routeState };

  // Resolve the project from the portfolio (selection.ts pattern). 404 when unknown.
  // The dashboard/portfolio links route to a kebab slug (nameToSlug), so match on
  // that; tolerate a raw-name slug too for older/direct links. (Without the slug
  // match, every project deep-link 404s — the links are kebab, names are not.)
  const item = resolveProjectNavigation(routeState.project ?? slug, activeProjects());
  if (item === undefined) {
    notFound();
  }

  const selection = workspaceSelection(sp, item.path);
  const href = workspaceHref(
    "/projects",
    sp,
    getProjectNavigation(item.path, item.name).slug,
    selection,
  );
  return (
    <>
      <NavigationCanonical href={href} />
      <ProjectWorkspace item={item} selection={selection} navigationBaseHref={href} />
    </>
  );
}
