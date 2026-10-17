import { type RouteQuery, routeHref, workspaceRouteState } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import PortfolioPage from "../page";

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
  const routeState = workspaceRouteState(href, segments);
  return (
    <NavigationSeedProvider href={href}>
      <PortfolioPage searchParams={Promise.resolve(query)} routeState={routeState} />
    </NavigationSeedProvider>
  );
}
