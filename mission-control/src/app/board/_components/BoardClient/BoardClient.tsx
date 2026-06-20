"use client";

/**
 * BoardClient — Interactive board surface wrapper (CMP-02-board-client).
 *
 * WO-02-005: Wraps all interactive state for the board page:
 *   - categoryFilter: which project_type is active (null = all)
 *   - openCardSlug: the slug of the idea card whose detail is open (null = none)
 *   - intakeOpen: whether the intake modal is open
 *
 * Receives pre-resolved `BoardCardEntry[]` from the Server Component (page.tsx).
 * Pure presentational composition: no filesystem access, no Claude calls.
 *
 * Layout (from prototype `boardView()`, line ~792):
 *   PageTitle "Tablero"
 *   intake button → IntakeModal overlay
 *   CategoryFilter chips row
 *   info paragraph
 *   horizontal-scroll kanban (IdeaBoardView)
 *   BoardLegend
 *
 * Design rules:
 *   - ZERO hardcoded colors — all via CSS custom properties / design tokens.
 *   - data-testid on every significant element.
 *   - Spanish copy (single operator, AGENTS.md).
 *   - All components reuse core primitives (PageTitle, CategoryFilter, IntakeModal,
 *     IdeaBoardView, BoardLegend, CardDetail, DiscardButton) — no bespoke forks.
 *
 * Traceability:
 *   CMP-02-board-client → REQ-02-002, REQ-02-003, REQ-02-005, REQ-02-006,
 *                          REQ-02-007, REQ-02-008
 *   AC-02-002, AC-02-003, AC-02-005, AC-02-006, AC-02-007, AC-02-008
 */

import { useState } from "react";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";
import { discardIdeaAction } from "@/app/board/actions/actions";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";
import { CategoryFilter } from "@/components/modules/CategoryFilter/CategoryFilter";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded values
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-canvas, var(--canvas, Canvas))",
  color: "var(--color-text, var(--t1, currentColor))",
  padding: "24px 20px 60px",
  maxWidth: "1240px",
  margin: "0 auto",
};

const INTAKE_ROW_STYLE: React.CSSProperties = {
  marginBottom: "12px",
};

const INTAKE_BUTTON_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-display, var(--display, system-ui))",
  fontWeight: 500,
  fontSize: "13px",
  background: "var(--color-card, var(--card, Canvas))",
  border: "1px solid var(--color-border2, var(--bd2, currentColor))",
  color: "var(--color-text, var(--t1, currentColor))",
  borderRadius: "8px",
  padding: "7px 13px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const FILTER_ROW_STYLE: React.CSSProperties = {
  marginBottom: "12px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap",
};

const INFO_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--t3, currentColor))",
  margin: "0 0 10px",
  opacity: 0.85,
};

const LEGEND_SECTION_STYLE: React.CSSProperties = {
  marginTop: "20px",
};

const CARD_DETAIL_OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
};

const CARD_DETAIL_BACKDROP_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "var(--color-backdrop, rgba(0,0,0,0.4))",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
};

const CARD_DETAIL_PANEL_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "var(--color-panel, var(--panel, Canvas))",
  border: "1px solid var(--color-border, var(--bd, currentColor))",
  borderRadius: "12px 0 0 12px",
  padding: "20px",
  width: "min(480px, 90vw)",
  height: "100vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BoardClientProps {
  /** Pre-resolved board cards from the Server Component (page.tsx). */
  cards: BoardCardEntry[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BoardClient — the interactive board surface.
 *
 * "use client" because: useState (filter/modal/card-detail state),
 *   DiscardButton (useTransition), IntakeModal (useEffect keyboard).
 *
 * All data is passed as props from the Server Component — no client-side
 * filesystem access ever occurs. Read-only (the only write is discard via
 * DiscardButton → discardIdeaAction Server Action).
 */
export function BoardClient({ cards }: BoardClientProps): React.JSX.Element {
  // Category filter state — null means "all"
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Intake modal state
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Open card detail slug — null means no card is open
  const [openCardSlug, setOpenCardSlug] = useState<string | null>(null);

  // Derive available categories from the card list (deduplicated, defined only)
  const categories: string[] = Array.from(
    new Set(
      cards
        .map((c) => c.projectType)
        .filter((t): t is string => typeof t === "string" && t.length > 0),
    ),
  );

  // Apply category filter to cards (IdeaBoardView re-reads boardColumn from each card)
  const filteredCards =
    filterCategory === null ? cards : cards.filter((c) => c.projectType === filterCategory);

  // Find the open card data for CardDetail
  const openCard = openCardSlug !== null ? cards.find((c) => c.slug === openCardSlug) : null;

  return (
    <main data-testid="board-page" aria-label="Tablero de ideas Pandacorp">
      <div style={PAGE_STYLE}>
        {/* ---- Page heading — H1 "Tablero" via PageTitle (DR-062) ---- */}
        <PageTitle
          icon="ti-layout-kanban"
          title="Tablero"
          subtitle="El tablero de ideas: cada una recorre las 6 fases del pipeline. Solo-lectura — los skills mueven las tarjetas."
        />

        {/* ---- Intake button → IntakeModal (AC-02-003) ---- */}
        <div style={INTAKE_ROW_STYLE}>
          <button
            type="button"
            data-testid="intake-open-button"
            aria-label="Capturar ideas y oportunidades"
            style={INTAKE_BUTTON_STYLE}
            onClick={() => setIntakeOpen(true)}
          >
            <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: "14px" }} />
            Capturar ideas / oportunidades
          </button>
        </div>

        {/* ---- Category filter chips (AC-02-006) ---- */}
        <div style={FILTER_ROW_STYLE}>
          <CategoryFilter
            categories={categories}
            selected={filterCategory}
            onSelect={setFilterCategory}
          />
        </div>

        {/* ---- Info note (prototype line ~803) ---- */}
        <p style={INFO_STYLE}>
          <i
            className="ti ti-info-circle"
            aria-hidden="true"
            style={{ fontSize: "13px", verticalAlign: "-2px", marginRight: "4px" }}
          />
          Las tarjetas avanzan cuando apruebas el resultado de cada etapa; si no te gusta, re-corres
          el mismo comando y sigues iterando. Aquí solo lees y decides.
        </p>

        {/* ---- Kanban board (AC-02-002) ---- */}
        <IdeaBoardView cards={filteredCards} onCardClick={(slug) => setOpenCardSlug(slug)} />

        {/* ---- Legend (AC-02-008.3) ---- */}
        <div style={LEGEND_SECTION_STYLE}>
          <BoardLegend />
        </div>
      </div>

      {/* ---- Intake modal overlay (AC-02-003) ---- */}
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />

      {/* ---- Card detail slide-in panel (AC-02-004) ---- */}
      {openCard !== null && openCard !== undefined && (
        <div style={CARD_DETAIL_OVERLAY_STYLE} data-testid="card-detail-overlay">
          {/* Backdrop — aria-hidden so a11y tools skip it; click dismisses the panel. */}
          <div
            data-testid="card-detail-backdrop"
            aria-hidden="true"
            style={CARD_DETAIL_BACKDROP_STYLE}
            onClick={() => setOpenCardSlug(null)}
          />
          <aside aria-label={`Detalle de idea: ${openCard.title}`} style={CARD_DETAIL_PANEL_STYLE}>
            {/* Back / close button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                data-testid="card-detail-close"
                aria-label="Volver al tablero"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "var(--color-text2, var(--t2, currentColor))",
                  padding: "5px 0",
                  fontFamily: "inherit",
                }}
                onClick={() => setOpenCardSlug(null)}
              >
                <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: "14px" }} />
                Volver al tablero
              </button>

              {/* Discard button — only for non-discarded cards (AC-02-007) */}
              {openCard.status !== "discarded" && (
                <DiscardButton slug={openCard.slug} discardAction={discardIdeaAction} />
              )}
            </div>

            {/* Card detail — 3-tab Campaña · Documentos · Comandos */}
            <CardDetail
              slug={openCard.slug}
              title={openCard.title}
              status={openCard.status}
              body={openCard.body}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
