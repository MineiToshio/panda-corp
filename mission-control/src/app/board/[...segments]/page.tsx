import { notFound, redirect } from "next/navigation";
import { IdeaPage } from "@/app/board/_components/IdeaHeader/IdeaPage";
import { readIdeaPage } from "@/app/board/_utils/readIdeaPage";
import {
  discardIdeaAction,
  restoreIdeaAction,
  toggleFavoriteAction,
} from "@/app/board/actions/actions";
import { readBoardDoc } from "@/app/board/actions/read-doc";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Card } from "@/components/core/Card/Card";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { t } from "@/lib/copy/copy";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { NavigationCanonical } from "@/lib/navigation/NavigationCanonical";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { navigationHref } from "@/lib/navigation/urls";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";

/** Resolve a stable idea identity and mount only that idea's request-scoped project bundle. */
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
  if (tab && !["proposal", "spec", "architecture", "documents", "campaign"].includes(tab))
    notFound();
  if (segments.length > 3 || (detail && tab !== "documents")) notFound();
  const data = readIdeaPage(idea);
  if (!data)
    return (
      <section data-screen="idea" data-testid="idea-not-found">
        <Card>
          <PageHead
            title={t("idea.notFound.title")}
            subtitle={t("idea.notFound.detail", { id: idea })}
          />
          <ButtonLink look="button" href="/board">
            {t("idea.notFound.back")}
          </ButtonLink>
        </Card>
      </section>
    );
  const requested = routeHref("/board", segments, await searchParams);
  const href = normalizeLegacyNavigation(requested);
  if (idea !== data.navigationSlug) redirect(navigationHref(href, { idea: data.navigationSlug }));
  if (requested !== href) redirect(href);
  return (
    <NavigationSeedProvider href={href}>
      <NavigationCanonical href={href} />
      <IdeaPage
        data={data}
        discardAction={discardIdeaAction}
        restoreAction={restoreIdeaAction}
        favoriteAction={toggleFavoriteAction}
        readDocAction={readBoardDoc}
      />
    </NavigationSeedProvider>
  );
}
