"use client";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import type { IdeaPageData } from "@/app/board/_utils/readIdeaPage";
import { deriveColumn } from "@/lib/board/board";
import type { DiscardResult } from "@/lib/discard/discard";
import type { RestoreResult } from "@/lib/discard/restore";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import { IdeaHeader } from "./IdeaHeader";

interface IdeaPageProps {
  readonly data: IdeaPageData;
  readonly discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
  readonly restoreAction: (slug: string) => Promise<RestoreResult>;
  readonly favoriteAction: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
  readonly readDocAction: (project: string, path: string) => Promise<string | null>;
}

/** Idea page owns optimistic header state; the bounded actions remain the sole writers. */
export function IdeaPage({
  data,
  discardAction,
  restoreAction,
  favoriteAction,
  readDocAction,
}: IdeaPageProps): React.JSX.Element {
  const router = useRouter();
  const [card, setCard] = useOptimistic(data.card, (current, patch: Partial<typeof data.card>) => ({
    ...current,
    ...patch,
  }));
  async function discard(slug: string, reason?: string): Promise<DiscardResult> {
    setCard({ status: "discarded", discardReason: reason });
    const result = await discardAction(slug, reason);
    if (result.ok) router.refresh();
    return result;
  }
  async function restore(slug: string): Promise<RestoreResult> {
    setCard({ status: card.project ? "in-pipeline" : "discovered", discardReason: undefined });
    const result = await restoreAction(slug);
    if (result.ok) router.refresh();
    return result;
  }
  async function favorite(slug: string, value: boolean): Promise<FavoriteResult> {
    const result = await favoriteAction(slug, value);
    if (result.ok) router.refresh();
    return result;
  }
  return (
    <section data-screen="idea" data-testid="idea-page">
      <IdeaHeader
        card={card}
        column={deriveColumn(card, data.projectStatus)}
        forgeHref={data.forgeHref}
        discardAction={discard}
        restoreAction={restore}
        favoriteAction={favorite}
      />
      <CardDetail
        slug={card.slug}
        title={card.title}
        status={card.status}
        body={card.body}
        project={card.project}
        phase={data.phase}
        isRunning={data.isRunning}
        projectType={card.projectType}
        targetPlatforms={data.targetPlatforms}
        docNodes={data.docNodes}
        frdCount={data.frdCount}
        specContent={data.specContent}
        architectureContent={data.architectureContent}
        dataModel={data.dataModel}
        workOrders={data.workOrders}
        envVars={data.envVars}
        adrs={data.adrs}
        sourceErrors={data.sourceErrors}
        frds={data.frds}
        navigationBaseHref={data.navigationBaseHref}
        constructionStarted={data.constructionStarted}
        forgeHref={data.forgeHref}
        readDocAction={readDocAction}
      />
    </section>
  );
}
