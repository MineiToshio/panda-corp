import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/app/projects/[slug]/ProjectWorkspace";
import { workspaceHref, workspaceSelection } from "@/app/projects/[slug]/workspace-route";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { t } from "@/lib/copy/copy";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { resolveProjectNavigation } from "@/lib/navigation/identities";
import { NavigationCanonical } from "@/lib/navigation/NavigationCanonical";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { getProjectOverview } from "@/lib/portfolio/overview";
import { getServicesDirectory } from "@/lib/services/services";
import { PortfolioOverview } from "./PortfolioOverview";

/** Reusable portfolio composition; internal path selections stay outside Next page props. */
export async function PortfolioContent({
  searchParams,
  routeState = {},
}: {
  searchParams: Promise<RouteQuery>;
  routeState?: Record<string, string>;
}): Promise<React.JSX.Element> {
  const rawQuery = await searchParams;
  const legacy = routeHref("/portfolio", [], rawQuery);
  const canonical = normalizeLegacyNavigation(legacy);
  const params = { ...parseNavigationUrl(canonical), ...routeState };
  const projects = getProjectOverview();
  if (params.project !== undefined) {
    const item = resolveProjectNavigation(
      params.project,
      projects.map((project) => project.source),
    );
    if (!item) notFound();
    const project = projects.find((project) => project.path === item.path);
    if (!project) notFound();
    const selection = workspaceSelection(params, item.path);
    const href = workspaceHref("/portfolio", params, project.id, selection);
    return (
      <NavigationSeedProvider href={href}>
        <NavigationCanonical href={href} />
        <div data-testid="portfolio-page-workspace">
          <ProjectWorkspace
            item={item}
            selection={selection}
            headingLevel={1}
            navigationBaseHref={href}
          />
        </div>
      </NavigationSeedProvider>
    );
  }
  const view = params.view ?? "tarjetas";
  if (!["tarjetas", "lista", "cuentas"].includes(view)) notFound();
  const href = canonical.replace(/^\/portfolio\//, "/portfolio");
  return (
    <NavigationSeedProvider href={href}>
      <NavigationCanonical href={href} />
      <div data-testid="portfolio-overview">
        <PageHead title={t("portafolio.title")} subtitle={t("portafolio.subtitle")} />
        <PortfolioOverview
          projects={projects}
          directory={getServicesDirectory()}
          resolvedView={view}
        />
      </div>
    </NavigationSeedProvider>
  );
}
