/**
 * IdeaCard — Read-only idea card component (CMP-02-card).
 *
 * Consumes the IF-01-readIdeas contract (lib/ideas.ts, docs/api.md WO-01-003).
 * Displays title, score (tabular-nums), category chip (project_type),
 * return chip (return_type), recommended badge, and building indicator.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties
 *     (wired in globals.css when design-tokens.json is frozen by the design phase).
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 *   - No drag handles, no move controls (AC-02-002.1 — read-only).
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *
 * Traceability:
 *   CMP-02-card → REQ-02-005, REQ-02-006, REQ-02-008
 *   IF-01-readIdeas (IdeaCard type, docs/api.md WO-01-003)
 */

import type { IdeaStatus } from "@/lib/ideas/ideas";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IdeaCardProps {
  /** Filename without .md — uniquely identifies the card. */
  slug: string;
  /** Frontmatter `title` field. */
  title: string;
  /** Frontmatter `status` field — validated against the IdeaStatus union. */
  status: IdeaStatus;
  /** Frontmatter `project_type` — shown as the category chip. Optional. */
  projectType?: string;
  /** Frontmatter `return_type` — shown as the return chip. Optional. */
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  /** Frontmatter `score` — shown with tabular-nums. Optional. */
  score?: number;
  /** Frontmatter `project` pointer (when in-pipeline). Not displayed directly. */
  project?: string;
  /** Markdown body (gray-matter .content). Not rendered in the card summary. */
  body: string;
  /**
   * Whether the linked project is actively building (running: true in status.yaml).
   * Set by the board view after reading readStatus. Drives the building indicator (REQ-02-008).
   */
  isRunning?: boolean;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// These variables are wired by the design system (WO-13-002, globals.css).
// The fallback chain uses system semantic values so the component renders
// before the design tokens are frozen.
// ---------------------------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  // Elevation level 1 (panel surface above canvas).
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  padding: "var(--spacing, 0.25rem)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  boxShadow: "var(--shadow-panel, none)",
  fontVariantNumeric: "tabular-nums",
  position: "relative",
  minWidth: 0, // allow text to wrap inside a flex/grid column
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--color-text, currentColor)",
  margin: 0,
  wordBreak: "break-word",
};

const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  alignItems: "center",
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.75rem",
  fontWeight: 500,
  background:
    "var(--color-chip-bg, var(--color-surface, color-mix(in oklch, currentColor 10%, transparent)))",
  color: "var(--color-chip-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const BADGE_RECOMMENDED_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-accent, currentColor)",
  color: "var(--color-on-accent, Canvas)",
  border: "none",
  fontWeight: 700,
};

const BADGE_BUILDING_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-frontend-dev, var(--color-accent, currentColor))",
  color: "var(--color-on-accent, Canvas)",
  border: "none",
  fontWeight: 600,
};

const SCORE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "calc(var(--spacing, 0.25rem) * 2)",
  right: "calc(var(--spacing, 0.25rem) * 2)",
  fontSize: "0.75rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.7,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Read-only presentational card for a single idea.
 * Server Component safe — no hooks, no browser APIs.
 */
export function IdeaCard({
  title,
  status,
  projectType,
  returnType,
  score,
  isRunning,
}: IdeaCardProps): React.JSX.Element {
  const isRecommended = status === "recommended";
  // AC-02-008.2: building indicator ONLY for in-pipeline cards (status guard).
  // A stale isRunning=true on discovered/shipped/discarded cards must not show the badge.
  const showBuildingIndicator = status === "in-pipeline" && isRunning === true;

  return (
    <article data-testid="idea-card" aria-label={`Idea: ${title}`} style={CARD_STYLE}>
      {/* Score — positioned top-right, tabular-nums */}
      {score !== undefined && (
        <span data-testid="idea-card-score" style={SCORE_STYLE} title={`Puntuación: ${score}`}>
          {score}
        </span>
      )}

      {/* Title */}
      <h3 data-testid="idea-card-title" style={TITLE_STYLE}>
        {title}
      </h3>

      {/* Chips row: badges + category + return type */}
      <div style={CHIPS_ROW_STYLE}>
        {/* Recommended badge (AC-02-006.2) */}
        {isRecommended && (
          <span
            data-testid="idea-card-recommended-badge"
            style={BADGE_RECOMMENDED_STYLE}
            role="status"
            aria-label="Recomendada"
          >
            Recomendada
          </span>
        )}

        {/* Building indicator (REQ-02-008) */}
        {showBuildingIndicator && (
          <span
            data-testid="idea-card-building-indicator"
            style={BADGE_BUILDING_STYLE}
            role="status"
            aria-label="En construcción"
          >
            En construcción
          </span>
        )}

        {/* Category chip (project_type, AC-02-005.1) */}
        {projectType !== undefined && (
          <span
            data-testid="idea-card-category"
            style={CHIP_STYLE}
            title={`Categoría: ${projectType}`}
          >
            {projectType}
          </span>
        )}

        {/* Return type chip (return_type, AC-02-005.1) */}
        {returnType !== undefined && (
          <span
            data-testid="idea-card-return-type"
            style={CHIP_STYLE}
            title={`Retorno: ${returnType}`}
          >
            {returnType}
          </span>
        )}
      </div>
    </article>
  );
}
