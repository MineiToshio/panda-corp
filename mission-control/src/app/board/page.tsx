import { redirect } from "next/navigation";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import { toggleFavoriteAction } from "@/app/board/actions/actions";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/types";
import { deriveColumn } from "@/lib/board/board";
import { resolveProjectPath } from "@/lib/config/config";
import { readIdeas } from "@/lib/ideas/ideas";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { getIdeaNavigation } from "@/lib/navigation/identities";
import { NavigationCanonical } from "@/lib/navigation/NavigationCanonical";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { readStatus } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

/** Board cards need status, progress and summary only; project documents belong to the idea route. */
export default async function BoardPage({
  searchParams,
}: {
  searchParams?: Promise<RouteQuery>;
} = {}): Promise<React.JSX.Element> {
  const requested = routeHref("/board", [], (await searchParams) ?? {}).replace(
    /^\/board\/(?=\?|$)/,
    "/board",
  );
  const href = normalizeLegacyNavigation(requested);
  if (requested !== href) redirect(href);
  const cards: BoardCardEntry[] = readIdeas().map((card) => {
    const project = card.project ? readStatus(resolveProjectPath(card.project)) : null;
    return {
      ...card,
      navigationSlug: getIdeaNavigation(card.slug).slug,
      boardColumn: deriveColumn(card, project),
      workOrders: card.project ? listWorkOrders(resolveProjectPath(card.project)) : undefined,
      isRunning:
        card.status === "in-pipeline" &&
        project?.present === true &&
        project.status.running === true,
    };
  });
  return (
    <NavigationSeedProvider href={href}>
      <NavigationCanonical href={href} />
      <BoardShell cards={cards} favoriteAction={toggleFavoriteAction} />
    </NavigationSeedProvider>
  );
}
