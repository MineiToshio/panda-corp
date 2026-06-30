/**
 * Project workspace page (CMP-04-workspace) — the standalone deep-link.
 *
 * Resolves the project from the URL slug + status, derives the URL-driven tab selection, and renders
 * the SHARED <ProjectWorkspace> (the same body the Portfolio right pane embeds — prototype projectPane,
 * DEC-4). The page column (#pcapp, 1240px) supplied by the shell frames it in normal flow.
 *
 * URL-driven selection (AC-04-001.2): ?tab / ?doc / ?wo / ?wotab. Absent/invalid tab → "summary".
 *
 * Traceability: CMP-04-workspace → REQ-04-001/002; IF-04-status, IF-03-activeProjects.
 */

import { notFound } from "next/navigation";
import { activeProjects } from "@/lib/portfolio/portfolio";
import { nameToSlug } from "@/lib/slug";
import { ProjectWorkspace, resolveWorkspaceTab, type WorkspaceSelection } from "./ProjectWorkspace";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const sp = await searchParams;

  // Resolve the project from the portfolio (selection.ts pattern). 404 when unknown.
  // The dashboard/portfolio links route to a kebab slug (nameToSlug), so match on
  // that; tolerate a raw-name slug too for older/direct links. (Without the slug
  // match, every project deep-link 404s — the links are kebab, names are not.)
  const item = activeProjects().find((p) => nameToSlug(p.name) === slug || p.name === slug);
  if (item === undefined) {
    notFound();
  }

  const selection: WorkspaceSelection = {
    activeTab: resolveWorkspaceTab(sp.tab),
    docParam: typeof sp.doc === "string" ? sp.doc : undefined,
    woParam: typeof sp.wo === "string" && sp.wo.length > 0 ? sp.wo : undefined,
    woTabParam: typeof sp.wotab === "string" && sp.wotab === "full" ? "full" : "summary",
  };

  return <ProjectWorkspace item={item} selection={selection} />;
}
