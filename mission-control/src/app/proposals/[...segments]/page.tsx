import { notFound } from "next/navigation";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import ProposalsPage from "../page";

/** Resolve persistent proposals paths using the existing shared page. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  if (
    !["memory", "backlog"].includes(segments[0] ?? "") ||
    segments.length > (segments[0] === "memory" ? 3 : 2)
  )
    notFound();
  if (
    segments[0] === "memory" &&
    segments[1] &&
    !["candidate-lesson", "prune", "promotions"].includes(segments[1])
  )
    notFound();
  const href = routeHref("/proposals", segments, await searchParams);
  return (
    <NavigationSeedProvider href={href}>
      <ProposalsPage />
    </NavigationSeedProvider>
  );
}
