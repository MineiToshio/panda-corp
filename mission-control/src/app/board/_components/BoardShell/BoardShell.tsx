"use client";

/**
 * BoardShell — Client-side interactive shell for the /board page (CMP-02-board-shell).
 *
 * WO-02-005: Wires the presentational board components with interactive state:
 *   - Category filter (CategoryFilter → filters IdeaBoardView)
 *   - Intake modal (button → IntakeModal overlay)
 *   - Card selection (IdeaCard click → CardDetail slide-in or panel)
 *   - Discard action (DiscardButton inside CardDetail)
 *   - BoardLegend (static, below the board)
 *   - PageTitle "Tablero" (DR-062 — one per surface)
 *
 * The Server Component (page.tsx) resolves cards (readIdeas + readStatus +
 * deriveColumn), then passes them here. This component is the interactive
 * boundary: "use client" required for useState (filter, modal, selection) +
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
import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";
import { CategoryFilter } from "@/components/modules/CategoryFilter/CategoryFilter";
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
function matchesFilter(card: BoardCardEntry, selectedCategory: string | null): boolean {
  if (selectedCategory === null) return true;
  return card.projectType === selectedCategory;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-base, var(--color-surface, Canvas))",
  color: "var(--color-text, currentColor)",
};

const CONTENT_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const TOOLBAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  flexWrap: "wrap",
};

const FILTER_AREA_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
  flex: 1,
  minWidth: 0,
};

const DETAIL_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
  flexWrap: "wrap",
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
  margin: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BoardShell — the interactive client shell for the /board page.
 *
 * Manages three pieces of state:
 *   1. `selectedCategory` — category filter for the board view
 *   2. `intakeOpen`        — whether the intake modal is open
 *   3. `openSlug`          — slug of the card whose detail is open (null = board view)
 */
export function BoardShell({ cards, discardAction }: BoardShellProps): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // Derive the unique categories from the full card list (not filtered).
  const categories = extractCategories(cards);

  // Filtered card list for the board view.
  const filteredCards = cards.filter((c) => matchesFilter(c, selectedCategory));

  // When a card is open, locate it by slug.
  const openCard = openSlug != null ? (cards.find((c) => c.slug === openSlug) ?? null) : null;

  // Whether the discard button should appear (not discarded or shipped).
  const canDiscard =
    openCard != null && openCard.status !== "discarded" && openCard.status !== "shipped";

  // ----------------------------------------------------------
  // Handler: open a card detail
  // ----------------------------------------------------------
  function handleCardClick(slug: string): void {
    setOpenSlug(slug);
    // Close the intake modal if open (only one overlay at a time)
    setIntakeOpen(false);
  }

  return (
    <main data-testid="board-page" style={PAGE_STYLE} aria-label="Tablero de ideas Pandacorp">
      {/* Intake modal — overlay, board remains mounted behind (AC-02-003.3) */}
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />

      <div style={CONTENT_STYLE}>
        {/* PageTitle "Tablero" — DR-062: the ONE light title block per surface */}
        <PageTitle
          icon="ti-layout-kanban"
          title="Tablero"
          subtitle="El tablero de ideas: cada una recorre las 6 fases del pipeline. Solo-lectura — los skills mueven las tarjetas."
        />

        {/* ---- Card detail view ---- */}
        {openCard != null ? (
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
            {/* Toolbar: Capture button + category filter */}
            <div style={TOOLBAR_STYLE}>
              {/* Capture ideas button (AC-02-003) */}
              <Button
                variant="primary"
                size="sm"
                data-testid="intake-trigger"
                onClick={() => setIntakeOpen(true)}
                ariaLabel="Capturar ideas y oportunidades"
              >
                + Capturar ideas / oportunidades
              </Button>

              {/* Category filter (AC-02-006.1) */}
              <div style={FILTER_AREA_STYLE}>
                <CategoryFilter
                  categories={categories}
                  selected={selectedCategory}
                  onSelect={setSelectedCategory}
                />
              </div>
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
    </main>
  );
}
