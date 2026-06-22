"use client";

/**
 * BoardShell — Client-side interactive shell for the /board page (CMP-02-board-shell).
 *
 * WO-02-005: Wires the presentational board components with interactive state:
 *   - Search input (filters by title + body) + "Limpiar" reset (BRD-01)
 *   - Category filter (CategoryFilter → filters IdeaBoardView)
 *   - Intake modal (button → IntakeModal overlay)
 *   - Card selection (IdeaCard click → CardDetail panel under a PageTitle, BRD-02)
 *   - Discard action (DiscardButton inside the detail header)
 *   - BoardLegend (static, below the board)
 *   - PageTitle — "Tablero" on the board; the idea's own pageHead on the detail
 *
 * The Server Component (page.tsx) resolves cards (readIdeas + readStatus +
 * deriveColumn), then passes them here. This component is the interactive
 * boundary: "use client" required for useState (search/filter/selection) +
 * DiscardButton (clipboard / Server Action).
 *
 * Traceability:
 *   CMP-02-board-shell → REQ-02-002, REQ-02-003, REQ-02-005, REQ-02-006,
 *                         REQ-02-007, REQ-02-008
 *   AC-02-002 — Wide columns, horizontal scroll, no drag
 *   AC-02-003 — Intake modal overlay with 4 commands
 *   AC-02-005 — Category + return chips on each card
 *   AC-02-006 — Filter by category; recommended badge
 *   AC-02-007 — Discard via Server Action (the only write)
 *   AC-02-008 — Building indicator; legend
 *
 * Design rules (AGENTS.md, FRD-13):
 *   - Zero hardcoded colors — all via CSS custom properties.
 *   - data-testid on every interactive element.
 *   - Spanish copy (single operator, Spanish UI).
 *   - No new shared components created here (reuse order: DR-057).
 */

import { useState } from "react";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";
import { CATEGORY_LABELS, RETURN_LABELS } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn } from "@/lib/board/board";
import type { DiscardResult } from "@/lib/discard/discard";

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
   * Server Action for discarding an idea (the app's only write).
   * Injected so the component stays testable without Next.js infrastructure.
   */
  discardAction: (slug: string) => Promise<DiscardResult>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const FILTER_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

/** Category <select> — prototype boardView select (canvas bg, bd2 border, inset shadow). */
const SELECT_STYLE: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "inherit",
  background: "var(--color-base, var(--color-panel))",
  color: "var(--color-text)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,.22)",
};

const SEARCH_WRAP_STYLE: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: "170px",
};

const SEARCH_ICON_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "10px",
  top: "9px",
  fontSize: "15px",
  color: "var(--color-text3)",
  pointerEvents: "none",
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px 8px 32px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "inherit",
  background: "var(--color-base, var(--color-panel))",
  color: "var(--color-text)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,.22)",
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

const HINT_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
  margin: 0,
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
export function BoardShell({ cards, discardAction }: BoardShellProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // Derive the unique categories from the full card list (not filtered).
  const categories = extractCategories(cards);

  // Filtered card list for the board view (search query AND category).
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = cards.filter(
    (c) => matchesQuery(c, normalizedQuery) && matchesCategory(c, selectedCategory),
  );

  // When a card is open, locate it by slug.
  const openCard = openSlug != null ? (cards.find((c) => c.slug === openSlug) ?? null) : null;

  // Whether the discard button should appear (not discarded or shipped).
  const canDiscard =
    openCard != null && openCard.status !== "discarded" && openCard.status !== "shipped";

  // Whether the "Limpiar" reset is offered (any active search or category).
  const hasActiveFilter = query !== "" || selectedCategory !== null;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  function handleCardClick(slug: string): void {
    setOpenSlug(slug);
    // Close the intake modal if open (only one overlay at a time)
    setIntakeOpen(false);
  }

  function handleClearFilters(): void {
    setQuery("");
    setSelectedCategory(null);
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
    <PageLayout
      icon={titleProps.icon}
      title={titleProps.title}
      subtitle={titleProps.subtitle}
      tail={titleProps.tail}
      testId="board-page"
      ariaLabel="Tablero de ideas Pandacorp"
    >
      {/* Intake modal — fixed overlay; board stays mounted behind (AC-02-003.3) */}
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />

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
                onClick={() => setOpenSlug(null)}
                ariaLabel="Volver al tablero"
              >
                ← Volver al tablero
              </Button>

              {canDiscard && <DiscardButton slug={openCard.slug} discardAction={discardAction} />}
            </div>

            {/* Card detail — Campaña · Documentos · Comandos tabs */}
            <CardDetail
              slug={openCard.slug}
              title={openCard.title}
              status={openCard.status}
              body={openCard.body}
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
            {/* Capture ideas button — standalone, above the filter row (prototype intakePanel).
                Neutral (secondary) button — card bg + bd2 border + accent-glow hover, like the
                prototype's default `button`, NOT an accent-filled primary. */}
            <div>
              <Button
                variant="secondary"
                size="sm"
                data-testid="intake-trigger"
                onClick={() => setIntakeOpen(true)}
                ariaLabel="Capturar ideas y oportunidades"
              >
                + Capturar ideas / oportunidades
              </Button>
            </div>

            {/* Filter row: search + category SELECT + Limpiar (AC-02-006.1, BRD-01; prototype boardView) */}
            <div style={FILTER_ROW_STYLE}>
              {/* Search input — filters by title + body (BRD-01) */}
              <div style={SEARCH_WRAP_STYLE}>
                <i className="ti ti-search" style={SEARCH_ICON_STYLE} aria-hidden="true" />
                <input
                  id="pc-q"
                  data-testid="board-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar ideas…"
                  aria-label="Buscar ideas por título o resumen"
                  style={SEARCH_INPUT_STYLE}
                />
              </div>

              {/* Category filter — native select (prototype boardView <select>) */}
              <select
                data-testid="category-filter"
                aria-label="Filtrar por categoría"
                value={selectedCategory ?? ""}
                onChange={(e) => setSelectedCategory(e.target.value === "" ? null : e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]?.[0] ?? cat}
                  </option>
                ))}
              </select>

              {/* Limpiar — visible only when there is an active search/category */}
              {hasActiveFilter && (
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="board-clear-filters"
                  onClick={handleClearFilters}
                  ariaLabel="Limpiar la búsqueda y el filtro"
                >
                  Limpiar
                </Button>
              )}
            </div>

            {/* Read-only hint */}
            <p style={HINT_STYLE}>
              Las tarjetas avanzan cuando apruebas el resultado de cada etapa; si no te gusta,
              re-corres el mismo comando y sigues iterando. Aquí solo lees y decides.
            </p>

            {/* Kanban board: 7 columns, two-axis routing, horizontal scroll */}
            <IdeaBoardView cards={filteredCards} onCardClick={handleCardClick} />

            {/* Legend: category / return / score (AC-02-008.3) */}
            <BoardLegend />
          </>
        )}
      </div>
    </PageLayout>
  );
}
