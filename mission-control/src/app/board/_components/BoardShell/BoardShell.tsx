"use client";

/** Board filters, capture and discarded-card navigation. */

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { DiscardedModal } from "@/app/board/_components/DiscardedModal/DiscardedModal";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/types";
import { Button } from "@/components/core/Button/Button";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { SearchField, Switch } from "@/components/core/Field/Field";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { CATEGORY_LABELS } from "@/components/modules/IdeaCard/IdeaCard";
import { t } from "@/lib/copy/copy";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import { navigationHref } from "@/lib/navigation/urls";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import styles from "./BoardShell.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BoardShellProps {
  /**
   * Pre-resolved cards from the Server Component (readIdeas + readStatus +
   * deriveColumn). The boardColumn field is already set.
   */
  cards: BoardCardEntry[];
  /**
   * Server Action that marks/unmarks an idea as a favourite (the board's third write, ADR-0003).
   * Injected for testability; optional so older callers/tests don't break.
   * When absent, the favourite star is simply not rendered (read-only).
   */
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIDE_EMPTY_STORAGE_KEY = "mission-control:board:hide-empty";

/** Derive the unique project_type values from the card list, preserving order. */
function extractCategories(cards: BoardCardEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const card of cards) {
    if (card.projectType != null && !seen.has(card.projectType)) {
      seen.add(card.projectType);
      result.push(card.projectType);
    }
  }
  return result.sort();
}

/** Return true when the card matches the active category filter (or no filter). */
function matchesCategory(card: BoardCardEntry, selectedCategory: string | null): boolean {
  if (selectedCategory === null) return true;
  return card.projectType === selectedCategory;
}

/** Return true when the card matches the search query (title + body, or empty query). */
function matchesQuery(card: BoardCardEntry, query: string): boolean {
  if (query === "") return true;
  const haystack = `${card.title} ${card.body ?? ""}`.toLowerCase();
  return haystack.includes(query);
}

export function BoardShell({ cards, favoriteAction }: BoardShellProps): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useUrlState("boardQuery", "");
  const [category, setCategory] = useUrlState("category", "");
  const selectedCategory = category || null;
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [discarded, setDiscarded] = useUrlState("discarded", "");
  const discardedOpen = discarded === "1";
  const setDiscardedOpen = (open: boolean) => setDiscarded(open ? "1" : "");

  const [hideEmpty, setHideEmpty] = useState(false);
  useLayoutEffect(() => {
    try {
      setHideEmpty(localStorage.getItem(HIDE_EMPTY_STORAGE_KEY) === "true");
    } catch {
      /* Browser preferences can be unavailable; the board remains usable. */
    }
  }, []);
  function handleHideEmpty(value: boolean): void {
    setHideEmpty(value);
    try {
      localStorage.setItem(HIDE_EMPTY_STORAGE_KEY, String(value));
    } catch {
      /* Keep the session preference when browser persistence is unavailable. */
    }
  }

  // Discarded ideas are NOT a board column — they live behind the "Ver descartadas"
  // button (DiscardedModal). Split them out so the board never shows them.
  const discardedCards = cards.filter((c) => c.status === "discarded");

  // Derive the unique categories from the full card list (not filtered).
  const visibleCards = cards.filter((card) => card.status !== "discarded");
  const categories = extractCategories(visibleCards);

  // Filtered card list for the board view (search query AND category).
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = cards.filter(
    (c) =>
      c.status !== "discarded" &&
      matchesQuery(c, normalizedQuery) &&
      matchesCategory(c, selectedCategory),
  );

  // Whether the "Limpiar" reset is offered (any active search or category).
  const hasActiveFilter = normalizedQuery !== "" || selectedCategory !== null;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  function handleCardClick(slug: string): void {
    const card = cards.find((entry) => entry.slug === slug);
    // Close overlays first: a shallow URL write after router.push would cancel the navigation.
    setIntakeOpen(false);
    updateNavigation({ discarded: null }, { replace: true });
    router.push(navigationHref("/board", { idea: card?.navigationSlug ?? slug }));
  }

  function handleClearFilters(): void {
    updateNavigation({ boardQuery: null, category: null });
  }

  return (
    <section data-testid="board-page" aria-label="Tablero de ideas Pandacorp">
      <PageHead
        title={t("tablero.title")}
        subtitle={t("tablero.subtitle")}
        actions={
          <>
            <Button
              variant="default"
              icon="archive"
              onClick={() => setDiscardedOpen(true)}
              data-testid="discarded-trigger"
            >
              {t("tablero.actions.discarded", { count: discardedCards.length })}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setIntakeOpen(true)}
              data-testid="intake-trigger"
            >
              {t("tablero.actions.capture")}
            </Button>
          </>
        }
      />
      {/* Intake modal — fixed overlay; board stays mounted behind (AC-02-003.3) */}
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />

      {/* Discarded ideas modal — opened from "Ver descartadas"; a row opens that card's detail */}
      <DiscardedModal
        open={discardedOpen}
        onClose={() => setDiscardedOpen(false)}
        cards={discardedCards}
        onSelect={handleCardClick}
      />

      <div>
        <div className={`toolbar ${styles.toolbar}`}>
          <div className={styles.search}>
            <SearchField
              label={t("tablero.search.aria")}
              placeholder={t("tablero.search.placeholder")}
              value={query}
              onChange={(value) => setQuery(value, true)}
            />
          </div>
          <fieldset className={styles.filters} aria-label={t("tablero.filters.categoryAria")}>
            <FilterChip pressed={!selectedCategory} onClick={() => setCategory("")}>
              {t("tablero.filters.all")} <span className={styles.count}>{visibleCards.length}</span>
            </FilterChip>
            {categories.map((cat) => (
              <FilterChip
                key={cat}
                pressed={selectedCategory === cat}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat]?.[0] ?? cat}
                <span className={styles.count}>
                  {visibleCards.filter((card) => card.projectType === cat).length}
                </span>
              </FilterChip>
            ))}
          </fieldset>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" icon="x" onClick={handleClearFilters}>
              {t("tablero.filters.clear")}
            </Button>
          )}
          <span className={styles.grow} />
          <p id="board-count" className="small faint" aria-live="polite">
            {hasActiveFilter && t("tablero.filters.matches", { count: filteredCards.length })}
          </p>
          <Switch
            label={t("tablero.filters.hideEmpty")}
            checked={hideEmpty}
            onChange={handleHideEmpty}
          />
        </div>
        {/* Two-axis routing preserves the project phase independently from the card status. */}
        <IdeaBoardView
          cards={filteredCards}
          allCards={visibleCards}
          hideEmpty={hideEmpty}
          onCardClick={handleCardClick}
          favoriteAction={favoriteAction}
        />
      </div>
    </section>
  );
}
