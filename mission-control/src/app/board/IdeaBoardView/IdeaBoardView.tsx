"use client";
import { BoardColumn } from "@/app/board/_components/BoardColumn/BoardColumn";
import { PhaseNav } from "@/app/board/_components/PhaseNav/PhaseNav";
import { t } from "@/lib/copy/copy";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import { BOARD_PHASES, columnFor } from "./boardPhases";
import type { BoardCardEntry } from "./types";

export type { BoardCardEntry } from "./types";

import styles from "./IdeaBoardView.module.css";
export interface IdeaBoardViewProps {
  cards: BoardCardEntry[];
  allCards?: BoardCardEntry[];
  hideEmpty?: boolean;
  isLoading?: boolean;
  error?: string;
  onCardClick?: (slug: string) => void;
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}
/** Six phase columns and their keyboard-operable jump navigation. */
export function IdeaBoardView({
  cards,
  allCards = cards,
  hideEmpty = false,
  isLoading,
  error,
  onCardClick,
  favoriteAction,
}: IdeaBoardViewProps): React.JSX.Element {
  if (isLoading) return <section aria-busy="true" data-testid="board-loading-state" />;
  if (error)
    return (
      <section role="alert" data-testid="board-error-state">
        {error}
      </section>
    );
  const columns = BOARD_PHASES.map((phase) => ({
    ...phase,
    cards: cards.filter((card) => columnFor(card) === phase.id),
    total: allCards.filter((card) => columnFor(card) === phase.id).length,
  })).filter((phase) => !hideEmpty || phase.total > 0);
  return (
    <section data-testid="idea-board" aria-label={t("tablero.title")}>
      <PhaseNav phases={columns} />
      <section
        id="board-scroller"
        className={`kanban ideas ${styles.scroller}`}
        data-testid="board-scroll-container"
        aria-label={t("tablero.boardAria")}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal scroll region must be keyboard reachable
        tabIndex={0}
      >
        {columns.map((phase) => (
          <BoardColumn
            key={phase.id}
            phase={phase}
            onCardClick={onCardClick}
            favoriteAction={favoriteAction}
          />
        ))}
      </section>
    </section>
  );
}
