import { notFound, redirect } from "next/navigation";
import { readIdeas } from "@/lib/ideas/ideas";
import { getIdeaNavigation, resolveIdeaNavigation } from "@/lib/navigation/identities";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { navigationHref } from "@/lib/navigation/urls";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import BoardPage from "../page";

/** Resolve stable idea URLs independently of mutable card filenames. */
export default async function PersistentBoard({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  const [idea, tab, detail] = segments;
  if (!idea) notFound();
  const cardSlug = resolveIdeaNavigation(idea, readIdeas());
  if (!cardSlug) notFound();
  if (tab && !["proposal", "spec", "architecture", "documents", "campaign"].includes(tab))
    notFound();
  if (segments.length > 3 || (detail && tab !== "documents")) notFound();
  const href = routeHref("/board", segments, await searchParams);
  const canonicalSlug = getIdeaNavigation(cardSlug).slug;
  if (idea !== canonicalSlug) redirect(navigationHref(href, { idea: canonicalSlug }));
  return (
    <NavigationSeedProvider href={href}>
      <BoardPage />
    </NavigationSeedProvider>
  );
}
