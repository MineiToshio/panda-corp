import { notFound } from "next/navigation";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import ConfigurationPage from "../page";

/** Resolve persistent configuration paths using the existing shared page. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  if (
    segments.length > 2 ||
    !["skills", "agents", "rules", "standards"].includes(segments[0] ?? "")
  )
    notFound();
  const href = normalizeLegacyNavigation(routeHref("/configuration", segments, await searchParams));
  return (
    <NavigationSeedProvider href={href}>
      <ConfigurationPage />
    </NavigationSeedProvider>
  );
}
