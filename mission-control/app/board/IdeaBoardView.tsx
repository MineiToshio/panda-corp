/**
 * IdeaBoardView — Presentational board component (CMP-02-board-view).
 *
 * Receives already-resolved IdeaCardProps (from readIdeas, IF-01-readIdeas)
 * and renders them in kanban columns bucketed by status.
 *
 * Routing:
 *   - discovered + recommended  → "discovered" column (recommended shows badge inside IdeaCard)
 *   - in-pipeline               → "in-pipeline" column
 *   - shipped                   → "shipped" column
 *   - discarded                 → "discarded" column
 *
 * Note: the full two-axis column derivation (status + project phase → board column)
 * is CMP-02-board-derive (lib/board.ts, WO-02-001). This component receives
 * pre-bucketed cards from the Server Component (app/board/page.tsx) which
 * handles the phase derivation for in-pipeline cards. Here we bucket by
 * IdeaCardProps.status directly for the base four columns.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Equal-width, wide columns; horizontal scroll (AC-02-002.2).
 *   - Text wraps (no truncation) within columns.
 *   - data-testid on every significant element.
 *   - Spanish labels (single operator, Spanish UI).
 *   - Empty / loading / error states all handled explicitly.
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 */

import type { IdeaCardProps } from "@/components/IdeaCard";
import { IdeaCard } from "@/components/IdeaCard";
import type { IdeaStatus } from "@/lib/ideas";

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

interface BoardColumn {
  id: string;
  label: string;
  /** Card statuses that route into this column */
  statuses: IdeaStatus[];
}

const COLUMNS: BoardColumn[] = [
  {
    id: "discovered",
    label: "Descubiertas",
    statuses: ["discovered", "recommended"],
  },
  {
    id: "in-pipeline",
    label: "En progreso",
    statuses: ["in-pipeline"],
  },
  {
    id: "shipped",
    label: "Lanzadas",
    statuses: ["shipped"],
  },
  {
    id: "discarded",
    label: "Descartadas",
    statuses: ["discarded"],
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IdeaBoardViewProps {
  /** Cards returned by readIdeas (IF-01-readIdeas, docs/api.md WO-01-003). */
  cards: IdeaCardProps[];
  /** When true, render the loading skeleton instead of cards. */
  isLoading?: boolean;
  /** When set, render the error state with this message. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

const BOARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  minHeight: "100%",
};

const SCROLL_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  overflowX: "auto",
  // Prevent columns from collapsing below their minimum
  alignItems: "flex-start",
  paddingBottom: "calc(var(--spacing, 0.25rem) * 2)",
};

const COLUMN_STYLE: React.CSSProperties = {
  // Wide, equal-width columns that don't collapse (AC-02-002.2)
  flex: "0 0 clamp(240px, 20vw, 320px)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  minWidth: 0,
};

const COLUMN_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 2)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const COLUMN_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
  margin: 0,
};

const COLUMN_COUNT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
};

const COLUMN_CARDS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexGrow: 1,
};

const EMPTY_COLUMN_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  textAlign: "center",
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.4,
  border: "var(--hairline, 1px) dashed var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const STATE_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  textAlign: "center",
  color: "var(--color-text-muted, currentColor)",
};

const ERROR_BOX_STYLE: React.CSSProperties = {
  ...STATE_BOX_STYLE,
  color: "var(--color-error, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-error, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  opacity: 0.8,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyBoardState(): React.JSX.Element {
  return (
    <div data-testid="board-empty-state" style={STATE_BOX_STYLE} aria-live="polite">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin ideas todavía.</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>
        Ejecuta <code style={{ fontFamily: "monospace" }}>/pandacorp:new-idea</code> para capturar
        la primera.
      </p>
    </div>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <div data-testid="board-loading-state" style={STATE_BOX_STYLE} aria-live="polite" aria-busy>
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Cargando ideas…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div data-testid="board-error-state" style={ERROR_BOX_STYLE} role="alert" aria-live="assertive">
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>Error al cargar las ideas</p>
      <p style={{ margin: 0, fontSize: "0.75rem" }}>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Presentational board view. Accepts pre-resolved cards from the Server Component.
 * Client-safe: no filesystem access, pure props → DOM.
 */
export function IdeaBoardView({
  cards,
  isLoading = false,
  error,
}: IdeaBoardViewProps): React.JSX.Element {
  // Loading state takes priority
  if (isLoading) {
    return (
      <section data-testid="idea-board" style={BOARD_STYLE} aria-label="Tablero de ideas">
        <LoadingState />
      </section>
    );
  }

  // Error state
  if (error !== undefined) {
    return (
      <section data-testid="idea-board" style={BOARD_STYLE} aria-label="Tablero de ideas">
        <ErrorState message={error} />
      </section>
    );
  }

  // Empty state (no cards at all)
  if (cards.length === 0) {
    return (
      <section data-testid="idea-board" style={BOARD_STYLE} aria-label="Tablero de ideas">
        <EmptyBoardState />
      </section>
    );
  }

  return (
    <section data-testid="idea-board" style={BOARD_STYLE} aria-label="Tablero de ideas">
      <div style={SCROLL_CONTAINER_STYLE}>
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => (col.statuses as IdeaStatus[]).includes(c.status));

          return (
            <section
              key={col.id}
              data-testid={`board-column-${col.id}`}
              style={COLUMN_STYLE}
              aria-label={`Columna: ${col.label}`}
            >
              {/* Column header */}
              <header style={COLUMN_HEADER_STYLE}>
                <h2 style={COLUMN_TITLE_STYLE}>{col.label}</h2>
                <span style={COLUMN_COUNT_STYLE} title={`${colCards.length} ideas`}>
                  {colCards.length}
                </span>
              </header>

              {/* Cards list */}
              <div style={COLUMN_CARDS_STYLE}>
                {colCards.length === 0 ? (
                  <div style={EMPTY_COLUMN_STYLE} title="Columna vacía">
                    —
                  </div>
                ) : (
                  colCards.map((card) => <IdeaCard key={card.slug} {...card} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
