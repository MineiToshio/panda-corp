/**
 * IdeaBoardView — Presentational board component (CMP-02-board-view).
 *
 * WO-02-005: renders 7 kanban columns from the two-axis column derivation
 * (deriveColumn: card status + project phase → BoardColumn). Cards carry a
 * pre-computed `boardColumn` field set by the Server Component (page.tsx)
 * via readStatus + deriveColumn. If `boardColumn` is absent (legacy callers),
 * the component falls back to status-based routing for backward compatibility.
 *
 * Columns (FRD-02, AC-02-002.2):
 *   discovered → documented → design → architecture → building → shipped → discarded
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Equal-width, wide columns; horizontal scroll (AC-02-002.2).
 *   - Text wraps (no truncation) within columns.
 *   - data-testid on every significant element.
 *   - Spanish labels (single operator, Spanish UI).
 *   - Empty / loading / error states all handled explicitly.
 *   - No drag/move controls (AC-02-002.1).
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005, REQ-02-006
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 *   IF-02-deriveColumn (lib/board.ts, WO-02-001)
 */

import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import { IdeaCard } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn } from "@/lib/board/board";
import type { DocNode } from "@/lib/docs/tree";
import type { DeployTarget, Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Column definitions — the 7 canonical columns (FRD-02, blueprint §2)
// ---------------------------------------------------------------------------

interface ColumnDef {
  id: BoardColumn;
  label: string;
}

// Column labels are aligned to La Campaña's 6 phase names (numbered) so the board and the
// card-detail campaign read the same vocabulary: research→1 Investigación … shipped→6 Release.
// Discarded is terminal (not a pipeline phase) and keeps its own label.
const COLUMNS: ColumnDef[] = [
  { id: "discovered", label: "1 Investigación" },
  { id: "documented", label: "2 Producto" },
  { id: "design", label: "3 Diseño" },
  { id: "architecture", label: "4 Arquitectura" },
  { id: "building", label: "5 Construcción" },
  { id: "shipped", label: "6 Release" },
];
// Discarded ideas are NOT a board column anymore — they live behind the "Ver descartadas"
// button (DiscardedModal). BoardShell filters them out before this view ever sees them.

/**
 * Legacy fallback: derive a BoardColumn from card status when no explicit
 * boardColumn is provided (backwards-compat for pre-WO-02-005 callers).
 * Mirrors the deriveColumn rules for non-in-pipeline statuses only.
 */
function fallbackColumn(status: IdeaCardProps["status"]): BoardColumn {
  switch (status) {
    case "discovered":
    case "recommended":
      return "discovered";
    case "in-pipeline":
      // Without a resolved boardColumn we cannot determine the project phase;
      // fall back to "documented" (the safe default per AC-02-001.6).
      return "documented";
    case "shipped":
      return "shipped";
    case "discarded":
      return "discarded";
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return "discovered";
    }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * A card as returned by the Server Component — IdeaCardProps extended with
 * the pre-computed `boardColumn` (from readStatus + deriveColumn in page.tsx).
 * When absent, the component falls back to status-based routing.
 */
export interface BoardCardEntry extends IdeaCardProps {
  /** Pre-computed two-axis column (set by page.tsx via deriveColumn). */
  boardColumn?: BoardColumn;
  /**
   * The linked project's phase (from readStatus in page.tsx), for in-pipeline cards.
   * Forwarded to CardDetail so the campaign's active phase matches the board column
   * (without it the card detail falls back to research → board/detail desync).
   */
  phase?: Phase;
  /** The linked project's deploy target (DR-085) — shown in the Release ficha. */
  deployTarget?: DeployTarget;
  /** The linked project's web target platform (DR-074) — a "qué es" tag in Propuesta + Spec. */
  targetPlatforms?: string;
  /**
   * Scoped doc STRUCTURE (PRD + research + per-FRD docs) from listProjectDocs in
   * page.tsx, for in-pipeline cards. Forwarded to CardDetail's Documentos tab; the
   * doc body loads lazily on select (the board ships structure only, never bodies).
   */
  docNodes?: DocNode[];
  /**
   * Spanish high-level spec digest (PRD + research + FRDs) from readSpecDigest in page.tsx,
   * for in-pipeline projects past the product phase. Forwarded to CardDetail's Spec tab;
   * absent → the tab is hidden.
   */
  specContent?: string;
  /** `discard_reason` (discarded cards only) — shown in the "Ver descartadas" modal + the detail. */
  discardReason?: string;
}

export interface IdeaBoardViewProps {
  /** Cards with optional pre-computed boardColumn (IF-02-deriveColumn). */
  cards: BoardCardEntry[];
  /** When true, render the loading skeleton instead of cards. */
  isLoading?: boolean;
  /** When set, render the error state with this message. */
  error?: string;
  /**
   * Callback fired when the owner clicks an idea card.
   * When provided, each IdeaCard becomes interactive (role="button", cursor pointer).
   * When absent, cards are read-only (no click affordance, backward compat).
   * AC-02-004: clicking a card opens its detail.
   */
  onCardClick?: (slug: string) => void;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

// Full-width board wrapper — no bespoke padding/minHeight (PageLayout owns the page chrome).
const BOARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const SCROLL_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  // stretch (default): every column grows to the tallest one's height — empty
  // columns are full-height panels, not stubs (prototype: equal-height `.col`s).
  alignItems: "stretch",
  paddingBottom: "8px",
};

/** Prototype `.col`: fixed-width column (224px) with its own panel surface. */
const COLUMN_STYLE: React.CSSProperties = {
  flex: "0 0 auto",
  width: "224px",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  // Each column is its own panel tile (prototype `.col`: bg/border/radius/padding).
  background: "var(--color-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  padding: "10px",
};

const COLUMN_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "9px",
};

/** Prototype column header: pixel font, uppercase, text2, letter-spacing .04em. */
const COLUMN_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel, var(--font-mono, monospace))",
  fontSize: "11px",
  fontWeight: 400,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text2, var(--color-text-muted, currentColor))",
  margin: 0,
  lineHeight: 1,
};

/** Count rendered in accent, tabular-nums (prototype). */
const COLUMN_COUNT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel, var(--font-mono, monospace))",
  fontSize: "11px",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-accent-text, currentColor)",
  lineHeight: 1,
};

const COLUMN_CARDS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flexGrow: 1,
};

const EMPTY_COLUMN_STYLE: React.CSSProperties = {
  padding: "4px 2px",
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
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
// CardSlot — one card in a column. Renders the full IdeaCard, click-wrapped in a
// <button> when onCardClick is provided (AC-02-004). (Discarded ideas never reach
// here — they live in the DiscardedModal.)
// ---------------------------------------------------------------------------

const CARD_BUTTON_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

interface CardSlotProps {
  card: IdeaCardProps & { boardColumn?: BoardColumn };
  onCardClick?: (slug: string) => void;
}

function CardSlot({ card, onCardClick }: CardSlotProps): React.JSX.Element {
  const inner = <IdeaCard {...card} />;

  if (onCardClick == null) return inner;

  /* Click-wrapper: the <article> stays a semantic landmark; the button is the
     interactive affordance (AC-02-004: clicking a card opens its detail). */
  return (
    <button
      type="button"
      style={CARD_BUTTON_STYLE}
      onClick={() => onCardClick(card.slug)}
      aria-label={`Abrir detalle: ${card.title}`}
    >
      {inner}
    </button>
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
  onCardClick,
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
      <div data-testid="board-scroll-container" style={SCROLL_CONTAINER_STYLE}>
        {COLUMNS.map((col) => {
          // Two-axis routing: use boardColumn when present; fall back to status-based routing.
          const colCards = cards.filter((c) => {
            const resolved: BoardColumn =
              "boardColumn" in c && c.boardColumn !== undefined
                ? c.boardColumn
                : fallbackColumn(c.status);
            return resolved === col.id;
          });

          return (
            <section
              key={col.id}
              data-testid={`board-column-${col.id}`}
              style={COLUMN_STYLE}
              aria-label={`Columna: ${col.label}`}
            >
              {/* Column header — pixel label + accent count (prototype .col) */}
              <header style={COLUMN_HEADER_STYLE}>
                <h2 style={COLUMN_TITLE_STYLE}>{col.label}</h2>
                <span style={COLUMN_COUNT_STYLE} title={`${colCards.length} ideas`}>
                  {colCards.length}
                </span>
              </header>

              {/* Cards list — no drag handles, no move controls (AC-02-002.1).
                  data-volatile: the card population is live factory data whose count
                  (and therefore the column/page height) changes as ideas are added,
                  discarded or moved. The visual gate hides it so the baseline asserts
                  the board CHROME (columns + headers), not the data-driven list whose
                  height drifts (DR-088). Card correctness is covered by unit tests. */}
              <div data-volatile style={COLUMN_CARDS_STYLE}>
                {colCards.length === 0 ? (
                  <div style={EMPTY_COLUMN_STYLE} title="Columna vacía">
                    —
                  </div>
                ) : (
                  colCards.map((card) => (
                    <CardSlot key={card.slug} card={card} onCardClick={onCardClick} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
