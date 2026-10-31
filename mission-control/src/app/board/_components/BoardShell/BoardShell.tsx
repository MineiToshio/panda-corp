"use client";

/** Board controls and the transitional idea-detail branch. URL selections survive reload/history. */

import { useLayoutEffect, useState } from "react";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import { DiscardedModal } from "@/app/board/_components/DiscardedModal/DiscardedModal";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import { FavoriteButton } from "@/components/core/FavoriteButton/FavoriteButton";
import { SearchField, Switch } from "@/components/core/Field/Field";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { RestoreButton } from "@/components/core/RestoreButton/RestoreButton";
import { CATEGORY_LABELS, RETURN_LABELS } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn } from "@/lib/board/board";
import { t } from "@/lib/copy/copy";
import type { DiscardResult } from "@/lib/discard/discard";
import type { RestoreResult } from "@/lib/discard/restore";
import type { FavoriteResult } from "@/lib/favorite/favorite";
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
   * Server Action for discarding an idea.
   * Injected so the component stays testable without Next.js infrastructure.
   */
  discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
  /**
   * Server Action for restoring (un-discarding) an idea — "Volver a agregar".
   * The board's second write (ADR-002); injected like discardAction for testability.
   * Optional (like readDocAction) so older callers/tests don't break; when absent the
   * "Volver a agregar" affordance is simply not rendered.
   */
  restoreAction?: (slug: string) => Promise<RestoreResult>;
  /**
   * Read-only Server Action that returns a scoped project doc's body on demand
   * (the card-detail Documentos reader). Injected like discardAction so the
   * component stays testable; optional so older callers/tests don't break.
   */
  readDocAction?: (project: string, relPath: string) => Promise<string | null>;
  /**
   * Server Action that marks/unmarks an idea as a favourite (the board's third write, ADR-0003).
   * Injected like discardAction for testability; optional so older callers/tests don't break.
   * When absent, the favourite star is simply not rendered (read-only).
   */
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIDE_EMPTY_STORAGE_KEY = "mission-control:board:hide-empty";

/** Board column → Spanish "Etapa" label for the idea detail pageHead (BRD-02). */
const COLUMN_STAGE_LABEL: Record<BoardColumn, string> = {
  discovered: "Descubierta",
  documented: "Documentada",
  design: "Diseño",
  architecture: "Arquitectura",
  building: "En construcción",
  shipped: "Lanzada",
  discarded: "Descartada",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  return result;
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

/** Stage label for the idea detail pageHead — from the resolved board column. */
function stageLabel(card: BoardCardEntry): string {
  const col = card.boardColumn;
  return col != null ? COLUMN_STAGE_LABEL[col] : "—";
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors
// ---------------------------------------------------------------------------

// The page <main> + title + outer chrome come from PageLayout (DR-062). The board
// body just stacks its rows (full width — no bespoke padding/minHeight/background).
const CONTENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const DETAIL_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
  flexWrap: "wrap",
};

const DETAIL_TAIL_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
  flexWrap: "wrap",
};

const CATEGORY_TAIL_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  fontSize: "11px",
  padding: "2px 8px",
  borderRadius: "var(--radius-sm, 8px)",
  fontWeight: 500,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
  background: "var(--color-secondary, var(--color-card2, var(--color-panel)))",
  color: "var(--color-text2)",
};

const SCORE_TAIL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------------------------
// DetailTail — category + return chips + "Score N/100" for the detail pageHead
// ---------------------------------------------------------------------------

function DetailTail({ card }: { card: BoardCardEntry }): React.JSX.Element {
  const categoryEntry =
    card.projectType !== undefined ? CATEGORY_LABELS[card.projectType] : undefined;
  const categoryLabel = categoryEntry?.[0] ?? card.projectType;
  const categoryIcon = categoryEntry?.[1];
  const returnEntry = card.returnType !== undefined ? RETURN_LABELS[card.returnType] : undefined;

  return (
    <span style={DETAIL_TAIL_STYLE}>
      {categoryLabel !== undefined && (
        <span data-testid="detail-head-category" style={CATEGORY_TAIL_CHIP_STYLE}>
          {categoryIcon != null && (
            <i
              className={`ti ${categoryIcon}`}
              style={{ fontSize: "11px", verticalAlign: "-1px" }}
              aria-hidden="true"
            />
          )}
          {categoryLabel}
        </span>
      )}
      {returnEntry != null && (
        // inline-flex + center so the Chip aligns on the same line as the category
        // chip + score (a plain inline span baseline-aligned it ~2px low).
        <span
          data-testid="detail-head-return"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <Chip tone={returnEntry[1]}>{returnEntry[0]}</Chip>
        </span>
      )}
      <span data-testid="detail-head-score" style={SCORE_TAIL_STYLE}>
        Score {card.score ?? "—"}/100
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// DetailActions — the card-detail header action cluster (favourite · discard · restore).
// Extracted so BoardShell's render stays under the cognitive-complexity budget (clean-code).
// ---------------------------------------------------------------------------

interface DetailActionsProps {
  card: BoardCardEntry;
  canDiscard: boolean;
  discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
  restoreAction?: (slug: string) => Promise<RestoreResult>;
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}

function DetailActions({
  card,
  canDiscard,
  discardAction,
  restoreAction,
  favoriteAction,
}: DetailActionsProps): React.JSX.Element {
  const showRestore = card.status === "discarded" && restoreAction != null;
  return (
    <span style={DETAIL_TAIL_STYLE}>
      {favoriteAction != null && (
        <FavoriteButton
          slug={card.slug}
          favorite={card.favorite === true}
          favoriteAction={favoriteAction}
        />
      )}
      {canDiscard && <DiscardButton slug={card.slug} discardAction={discardAction} />}
      {showRestore && restoreAction != null && (
        <RestoreButton slug={card.slug} restoreAction={restoreAction} />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BoardShell — the interactive client shell for the /board page.
 *
 * State:
 *   1. `query`            — search text (title + body filter, BRD-01)
 *   2. `selectedCategory` — category filter for the board view
 *   3. `intakeOpen`       — whether the intake modal is open
 *   4. `openSlug`         — slug of the card whose detail is open (null = board view)
 */
export function BoardShell({
  cards,
  discardAction,
  restoreAction,
  readDocAction,
  favoriteAction,
}: BoardShellProps): React.JSX.Element {
  const [query, setQuery] = useUrlState("boardQuery", "");
  const [category, setCategory] = useUrlState("category", "");
  const selectedCategory = category || null;
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [discarded, setDiscarded] = useUrlState("discarded", "");
  const discardedOpen = discarded === "1";
  const setDiscardedOpen = (open: boolean) => setDiscarded(open ? "1" : "");
  const [openSlug] = useUrlState("idea", "");

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

  // When a card is open, locate it by slug.
  const openCard =
    openSlug != null
      ? (cards.find((c) => (c.navigationSlug ?? c.slug) === openSlug) ?? null)
      : null;

  // Whether the discard button should appear (not discarded or shipped).
  const canDiscard =
    openCard != null && openCard.status !== "discarded" && openCard.status !== "shipped";

  // Whether the "Limpiar" reset is offered (any active search or category).
  const hasActiveFilter = normalizedQuery !== "" || selectedCategory !== null;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  function handleCardClick(slug: string): void {
    const card = cards.find((entry) => entry.slug === slug);
    updateNavigation({
      idea: card?.navigationSlug ?? slug,
      boardTab: null,
      doc: null,
      phase: null,
      specFrd: null,
      architectureFrd: null,
      adr: null,
      model: null,
      modelQuery: null,
      entity: null,
      relationship: null,
      expanded: null,
      schemaTable: null,
      discarded: null,
    });
    // Close any overlay (only one at a time): intake + the discarded-ideas modal.
    setIntakeOpen(false);
    setDiscardedOpen(false);
  }

  function handleClearFilters(): void {
    updateNavigation({ boardQuery: null, category: null });
  }

  // Conditional page-title chrome (DR-062): the open card's own head, or the board title.
  const titleProps = openCard
    ? {
        icon: "ti-bulb",
        title: openCard.title,
        subtitle: `Etapa: ${stageLabel(openCard)}`,
        tail: (<DetailTail card={openCard} />) as React.ReactNode,
      }
    : {
        icon: "ti-layout-kanban",
        title: "Tablero",
        subtitle:
          "El tablero de ideas: cada una recorre las 6 fases del pipeline. Solo-lectura — los skills mueven las tarjetas.",
        tail: undefined,
      };

  return (
    <section data-testid="board-page" aria-label="Tablero de ideas Pandacorp">
      {openCard ? (
        <PageLayout
          icon={titleProps.icon}
          title={titleProps.title}
          subtitle={titleProps.subtitle}
          tail={titleProps.tail}
          ariaLabel="Tablero de ideas Pandacorp"
        >
          {null}
        </PageLayout>
      ) : (
        <PageHead
          title={t("tablero.title")}
          subtitle={t("tablero.subtitle")}
          actions={
            <>
              <Button
                variant="default"
                onClick={() => setDiscardedOpen(true)}
                data-testid="discarded-trigger"
              >
                {t("tablero.actions.discarded", { count: discardedCards.length })}
              </Button>
              <Button
                variant="primary"
                onClick={() => setIntakeOpen(true)}
                data-testid="intake-trigger"
              >
                {t("tablero.actions.capture")}
              </Button>
            </>
          }
        />
      )}
      {/* Intake modal — fixed overlay; board stays mounted behind (AC-02-003.3) */}
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />

      {/* Discarded ideas modal — opened from "Ver descartadas"; a row opens that card's detail */}
      <DiscardedModal
        open={discardedOpen}
        onClose={() => setDiscardedOpen(false)}
        cards={discardedCards}
        onSelect={handleCardClick}
      />

      <div style={CONTENT_STYLE}>
        {openCard != null ? (
          /* ---- Card detail view ---- */
          <>
            {/* Back nav + discard affordance */}
            <div style={DETAIL_HEADER_STYLE}>
              <Button
                variant="secondary"
                size="sm"
                data-testid="card-detail-back"
                onClick={() =>
                  updateNavigation({
                    idea: null,
                    boardTab: null,
                    doc: null,
                    phase: null,
                    specFrd: null,
                    architectureFrd: null,
                    adr: null,
                    model: null,
                    modelQuery: null,
                    entity: null,
                    relationship: null,
                    expanded: null,
                    schemaTable: null,
                  })
                }
                ariaLabel="Volver al tablero"
              >
                ← Volver al tablero
              </Button>

              <DetailActions
                card={openCard}
                canDiscard={canDiscard}
                discardAction={discardAction}
                restoreAction={restoreAction}
                favoriteAction={favoriteAction}
              />
            </div>

            {/* Discarded → show WHY it was discarded (the reason), above the docs. */}
            {openCard.status === "discarded" && (
              <div
                data-testid="detail-discard-reason"
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: "12px",
                  color: "var(--color-text2)",
                  lineHeight: 1.5,
                }}
              >
                <i
                  className="ti ti-archive"
                  aria-hidden="true"
                  style={{ fontSize: "14px", color: "var(--color-text3)", marginTop: "1px" }}
                />
                <span>
                  <strong style={{ color: "var(--color-text)" }}>Idea descartada.</strong>{" "}
                  {openCard.discardReason != null && openCard.discardReason !== ""
                    ? `Motivo: ${openCard.discardReason}`
                    : "Sin motivo registrado."}{" "}
                  Puedes leer toda su documentación abajo o volver a agregarla.
                </span>
              </div>
            )}

            {/* Card detail — Campaña · Documentos tabs */}
            <CardDetail
              key={openCard.navigationSlug ?? openCard.slug}
              slug={openCard.slug}
              title={openCard.title}
              status={openCard.status}
              phase={openCard.phase}
              deployTarget={openCard.deployTarget}
              projectType={openCard.projectType}
              targetPlatforms={openCard.targetPlatforms}
              body={openCard.body}
              docNodes={openCard.docNodes}
              frdCount={openCard.frdCount}
              specContent={openCard.specContent}
              architectureContent={openCard.architectureContent}
              dataModel={openCard.dataModel}
              workOrders={openCard.workOrders}
              envVars={openCard.envVars}
              adrs={openCard.adrs}
              project={openCard.project}
              readDocAction={readDocAction}
              isRunning={openCard.isRunning}
              onEnterForge={(slug) => {
                // AC-02-010.5: navigate host to Portfolio → Party tab.
                // In this shell we navigate by changing view; in the full app
                // the host router handles this cross-surface jump.
                void slug;
              }}
            />
          </>
        ) : (
          /* ---- Board view ---- */
          <>
            <div className={`toolbar ${styles.toolbar}`}>
              <div id="idea-search">
                <SearchField
                  label={t("tablero.search.aria")}
                  placeholder={t("tablero.search.placeholder")}
                  value={query}
                  onChange={(value) => setQuery(value, true)}
                />
              </div>
              <fieldset className={styles.filters} aria-label={t("tablero.filters.categoryAria")}>
                <FilterChip pressed={!selectedCategory} onClick={() => setCategory("")}>
                  {t("tablero.filters.all")} {visibleCards.length}
                </FilterChip>
                {categories.map((cat) => (
                  <FilterChip
                    key={cat}
                    pressed={selectedCategory === cat}
                    onClick={() => setCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]?.[0] ?? cat}{" "}
                    {visibleCards.filter((card) => card.projectType === cat).length}
                  </FilterChip>
                ))}
              </fieldset>
              <Switch
                label={t("tablero.filters.hideEmpty")}
                checked={hideEmpty}
                onChange={handleHideEmpty}
              />
              {hasActiveFilter && (
                <Button onClick={handleClearFilters}>{t("tablero.filters.clear")}</Button>
              )}
              <p id="board-count" aria-live="polite">
                {hasActiveFilter && t("tablero.filters.matches", { count: filteredCards.length })}
              </p>
            </div>
            {/* Two-axis routing preserves the project phase independently from the card status. */}
            <IdeaBoardView
              cards={filteredCards}
              allCards={visibleCards}
              hideEmpty={hideEmpty}
              onCardClick={handleCardClick}
              favoriteAction={favoriteAction}
            />
          </>
        )}
      </div>
    </section>
  );
}
