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
  const routeState = workspaceRouteState(href, [slug, ...segments]);
  return (
    <NavigationSeedProvider href={href}>
      <ProjectWorkspacePage
        params={Promise.resolve({ slug })}
        searchParams={Promise.resolve(query)}
        routeState={routeState}
      />
    </NavigationSeedProvider>
  );
}
