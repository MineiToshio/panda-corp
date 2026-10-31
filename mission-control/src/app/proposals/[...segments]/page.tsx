import { notFound } from "next/navigation";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { loadProposalsData } from "@/lib/proposals/data";
import { validProposalsSegments } from "@/lib/proposals/routeSelection";
import ProposalsPage from "../page";
/** Validates proposals path identities before seeding the shared page. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  if (!validProposalsSegments(segments, loadProposalsData())) notFound();
  return (
    <NavigationSeedProvider href={routeHref("/proposals", segments, await searchParams)}>
      <ProposalsPage />
    </NavigationSeedProvider>
  );
}
