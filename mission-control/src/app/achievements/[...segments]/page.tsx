import { notFound } from "next/navigation";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import HallPage from "../page";

/** Resolve persistent achievements paths using the existing shared page. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  if (
    segments.length !== 1 ||
    !["summary", "missions", "trophies", "statistics", "ranks"].includes(segments[0] ?? "")
  )
    notFound();
  const href = routeHref("/achievements", segments, await searchParams);
  return (
    <NavigationSeedProvider href={href}>
      <HallPage />
    </NavigationSeedProvider>
  );
}
