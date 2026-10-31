import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { type RouteQuery, routeHref, workspaceRouteState } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { PortfolioContent } from "../PortfolioContent";

/** Resolve persistent portfolio paths without duplicating its workspace. */
export default async function PersistentPortfolio({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  const query = await searchParams;
  const href = routeHref("/portfolio", segments, query);
  workspaceRouteState(href, segments);
  const canonical = normalizeLegacyNavigation(href);
  const routeState = workspaceRouteState(
    canonical,
    new URL(canonical, "http://localhost").pathname.split("/").slice(2),
  );
  return (
    <NavigationSeedProvider href={canonical}>
      <PortfolioContent
        searchParams={Promise.resolve(query)}
        routeState={routeState}
        requestHref={href}
      />
    </NavigationSeedProvider>
  );
}
