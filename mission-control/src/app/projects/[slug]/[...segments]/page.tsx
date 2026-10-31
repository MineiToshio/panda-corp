import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { type RouteQuery, routeHref, workspaceRouteState } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import ProjectWorkspacePage from "../page";

/** Keep standalone workspace deep links in their original presentation context. */
export default async function PersistentProject({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { slug, segments } = await params;
  const query = await searchParams;
  const href = routeHref("/projects", [slug, ...segments], query);
  workspaceRouteState(href, [slug, ...segments]);
  const canonical = normalizeLegacyNavigation(href);
  const routeState = workspaceRouteState(
    canonical,
    new URL(canonical, "http://localhost").pathname.split("/").slice(2),
  );
  return (
    <NavigationSeedProvider href={canonical}>
      <ProjectWorkspacePage
        params={Promise.resolve({ slug })}
        searchParams={Promise.resolve(query)}
        routeState={routeState}
        requestHref={href}
      />
    </NavigationSeedProvider>
  );
}
