/**
 * IdeaCard — Read-only idea card component (CMP-02-card).
 *
 * Consumes the IF-01-readIdeas contract (lib/ideas.ts, docs/api.md WO-01-003).
 * Repainted faithful to the prototype `boardView()` card (index.html L797):
 *   - Title 13px (+ a play icon when running).
 *   - A chips row: category chip (Spanish label + icon) + return chip
 *     (Spanish label, coloured tone) — NEVER the raw English enum (BRD-03).
 *   - Score on the right: "Score <N>" (accent number), or "sin score".
 *
 * Spanish labels & tones come from CAT / RETURN_TONE, mirroring the prototype
 * CAT (L185) and RET (L184) maps. The category chip is the neutral `.chip`
 * (secondary tone); the return chip carries its semantic colour via <Chip>.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 *   - No drag handles, no move controls (AC-02-002.1 — read-only).
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *
 * Traceability:
 *   CMP-02-card → REQ-02-005, REQ-02-006, REQ-02-008
 *   IF-01-readIdeas (IdeaCard type, docs/api.md WO-01-003)
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
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
// Spanish label maps (faithful to the prototype CAT / RET maps).
// The category map carries a Spanish label + Tabler icon; unknown categories
// fall back to the raw value (keeps free-form project_type values visible).
// The return map carries a Spanish label + Chip tone (semantic colour).
// ---------------------------------------------------------------------------

/** project_type → [Spanish label, Tabler icon] (prototype CAT, index.html L185). */
export const CATEGORY_LABELS: Record<string, readonly [string, string]> = {
  web: ["web", "ti-world"],
  mobile: ["mobile", "ti-device-mobile"],
  desktop: ["desktop", "ti-device-desktop"],
  ia: ["IA", "ti-sparkles"],
  "claude-code": ["Claude Code", "ti-terminal-2"],
  "prompt-system": ["prompts", "ti-message-code"],
  automatizacion: ["automatización", "ti-robot"],
  cli: ["CLI", "ti-terminal"],
  rework: ["rework", "ti-refresh"],
  otro: ["otro", "ti-box"],
};

/** Web target platform → Spanish label + icon, for the "qué es" tags (DR-074). */
export const PLATFORM_LABELS: Record<string, readonly [string, string]> = {
  desktop: ["Desktop", "ti-device-desktop"],
  mobile: ["Mobile", "ti-device-mobile"],
  responsive: ["Responsive", "ti-devices"],
};

/** A "qué es" meta chip — what kind of app it is (and, for web, its platform). */
export interface MetaChip {
  label: string;
  icon?: string;
}

/**
 * The "qué es" chips for a card/project: its app type (web / mobile / API …) and, when
 * known, its web target platform (desktop / mobile / responsive). Single source reused by
 * both the Propuesta (IdeaPitch) and Spec (SpecDigest) tabs so they never drift.
 */
export function projectMetaChips(projectType?: string, targetPlatforms?: string): MetaChip[] {
  const chips: MetaChip[] = [];
  if (projectType != null && projectType !== "") {
    const entry = CATEGORY_LABELS[projectType];
    chips.push({ label: entry?.[0] ?? projectType, icon: entry?.[1] });
  }
  if (targetPlatforms != null && targetPlatforms !== "") {
    const entry = PLATFORM_LABELS[targetPlatforms];
    chips.push({ label: entry?.[0] ?? targetPlatforms, icon: entry?.[1] });
  }
  return chips;
}

/** return_type values mapped to a Spanish label + a Chip tone. */
export type ReturnTypeKey = NonNullable<IdeaCardProps["returnType"]>;

/** return_type → [Spanish label, Chip tone] (prototype RET, index.html L184). */
export const RETURN_LABELS: Record<ReturnTypeKey, readonly [string, ChipTone]> = {
  monetary: ["monetario", "ok"],
  opportunity: ["oportunidad", "warn"],
  personal: ["personal", "info"],
  mixed: ["mixto", "accent"],
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; mirrors the prototype `.card` + row.
// ---------------------------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  padding: "10px 11px",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  boxShadow: "var(--shadow-1, none)",
  fontVariantNumeric: "tabular-nums",
  minWidth: 0,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.35,
  color: "var(--color-text)",
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "5px",
  wordBreak: "break-word",
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6px",
};

const CHIPS_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "5px",
  flexWrap: "wrap",
  alignItems: "center",
  minWidth: 0,
};

const CATEGORY_CHIP_STYLE: React.CSSProperties = {
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

const CATEGORY_ICON_STYLE: React.CSSProperties = {
  fontSize: "11px",
  verticalAlign: "-1px",
};

const SCORE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const SCORE_VALUE_STYLE: React.CSSProperties = {
  color: "var(--color-accent-text)",
  fontWeight: 500,
};

const PLAY_ICON_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-ok)",
};

const RECOMMENDED_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "11px",
  padding: "2px 8px",
  borderRadius: "var(--radius-sm, 8px)",
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
  background: "var(--color-accent-bg)",
  color: "var(--color-accent-text)",
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
  // A stale isRunning=true on discovered/shipped/discarded cards must not show it.
  const showBuildingIndicator = status === "in-pipeline" && isRunning === true;

  // Category: Spanish label + icon from the map, falling back to the raw value.
  const categoryEntry = projectType !== undefined ? CATEGORY_LABELS[projectType] : undefined;
  const categoryLabel = categoryEntry?.[0] ?? projectType;
  const categoryIcon = categoryEntry?.[1];

  // Return: Spanish label + tone from the map (always mapped — closed union).
  const returnEntry = returnType !== undefined ? RETURN_LABELS[returnType] : undefined;

  return (
    <article data-testid="idea-card" aria-label={`Idea: ${title}`} style={CARD_STYLE}>
      {/* Title — 13px, with a play icon when the project is building */}
      <h3 data-testid="idea-card-title" style={TITLE_STYLE}>
        {title}
        {showBuildingIndicator && (
          <i
            data-testid="idea-card-building-indicator"
            className="ti ti-player-play"
            style={PLAY_ICON_STYLE}
            role="status"
            aria-label="En construcción"
            title="Construyéndose ahora"
          />
        )}
      </h3>

      {/* Chips row + score */}
      <div style={ROW_STYLE}>
        <span style={CHIPS_STYLE}>
          {/* Recommended badge (AC-02-006.2) */}
          {isRecommended && (
            <span
              data-testid="idea-card-recommended-badge"
              style={RECOMMENDED_STYLE}
              role="status"
              aria-label="Recomendada"
            >
              Recomendada
            </span>
          )}

          {/* Category chip — Spanish label + icon (AC-02-005.1, BRD-03) */}
          {categoryLabel !== undefined && (
            <span
              data-testid="idea-card-category"
              style={CATEGORY_CHIP_STYLE}
              title={`Categoría: ${categoryLabel}`}
            >
              {categoryIcon != null && (
                <i
                  className={`ti ${categoryIcon}`}
                  style={CATEGORY_ICON_STYLE}
                  aria-hidden="true"
                />
              )}
              {categoryLabel}
            </span>
          )}

          {/* Return chip — Spanish label + semantic tone (AC-02-005.1, BRD-03).
              inline-flex wrapper so the Chip aligns on the same line as the category
              chip + score (a plain inline span added a stray line-box offset). */}
          {returnEntry != null && (
            <span
              data-testid="idea-card-return-type"
              title={`Retorno: ${returnEntry[0]}`}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <Chip tone={returnEntry[1]}>{returnEntry[0]}</Chip>
            </span>
          )}
        </span>

        {/* Score — right-aligned, "Score <N>" (accent number) or "sin score" */}
        {score !== undefined ? (
          <span data-testid="idea-card-score" style={SCORE_STYLE} title={`Puntuación: ${score}`}>
            Score <b style={SCORE_VALUE_STYLE}>{score}</b>
          </span>
        ) : (
          <span style={SCORE_STYLE}>sin score</span>
        )}
      </div>
    </article>
  );
}
