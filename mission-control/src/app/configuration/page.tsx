import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { loadConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { ConfigurationShell } from "./ConfigurationShell";

/** Read-only server boundary; one request-scoped catalog resolver, no XP or event reads. */
export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams?: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const catalogs = loadConfigurationCatalogs();
  if (!searchParams) return <ConfigurationShell catalogs={catalogs} />;
  const href = normalizeLegacyNavigation(routeHref("/configuration", [], await searchParams));
  return (
    <NavigationSeedProvider href={href}>
      <ConfigurationShell catalogs={catalogs} />
    </NavigationSeedProvider>
  );
}
