import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { FavoriteButton } from "@/components/core/FavoriteButton/FavoriteButton";
import { IdeaCard } from "@/components/modules/IdeaCard/IdeaCard";
import { t } from "@/lib/copy/copy";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import styles from "./BoardColumn.module.css";

interface Phase {
  id: string;
  step: number;
  label: string;
  tone: Tone;
  cards: BoardCardEntry[];
  total: number;
}
/** One numbered phase, retaining the distinction between empty and filtered out. */
export function BoardColumn({
  phase,
  onCardClick,
  favoriteAction,
}: {
  phase: Phase;
  onCardClick?: (slug: string) => void;
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}): React.JSX.Element {
  const empty = phase.cards.length === 0;
  const emptyLabel = t(phase.total ? "tablero.column.noMatches" : "tablero.column.empty");
  return (
    <section
      id={`phase-${phase.id}`}
      data-testid={`board-column-${phase.id}`}
      data-tone={phase.tone}
      data-empty={empty}
      className={`kcol ${empty ? "is-empty" : ""} ${styles.column}`}
      aria-label={t("tablero.column.aria", {
        phase: phase.label,
        ideas: t("tablero.column.ideas", { count: phase.cards.length }),
      })}
    >
      <header className={styles.head}>
        <h2>
          <span>{phase.step}</span> {phase.label}
        </h2>
        <Chip tone="slate" variant="plain">
          {phase.cards.length}
        </Chip>
      </header>
      {empty ? (
        <p className={styles.empty} role="status" aria-label={emptyLabel}>
          {emptyLabel}
        </p>
      ) : (
        phase.cards.map((card) => (
          <div key={card.slug} className={styles.slot}>
            <IdeaCard
              {...card}
              ordersTotal={card.workOrders?.length}
              ordersDone={card.workOrders?.filter((order) => order.state === "done").length}
              href={`/board/${encodeURIComponent(card.navigationSlug ?? card.slug)}`}
              onNavigate={onCardClick ? () => onCardClick(card.slug) : undefined}
            />
            {favoriteAction && (
              <span className={styles.star}>
                <FavoriteButton
                  slug={card.slug}
                  title={card.title}
                  favorite={card.favorite === true}
                  favoriteAction={favoriteAction}
                />
              </span>
            )}
          </div>
        ))
      )}
    </section>
  );
}
