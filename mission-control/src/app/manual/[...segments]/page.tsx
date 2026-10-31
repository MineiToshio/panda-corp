import { notFound, redirect } from "next/navigation";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import ManualPage from "../page";

/** Seed authored reader URLs; forward recognized legacy catalog resources to their canonical owner. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  const href = routeHref("/manual", segments, await searchParams);
  if (segments[0] === "reference") {
    const target = normalizeLegacyNavigation(href);
    if (target === href) notFound();
    redirect(target);
  }
  if (segments.length > 2) notFound();
  return (
    <NavigationSeedProvider href={href}>
      <ManualPage />
    </NavigationSeedProvider>
  );
}
