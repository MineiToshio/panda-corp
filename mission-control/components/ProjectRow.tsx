/**
 * ProjectRow — single project row (CMP-03-row).
 *
 * Standalone exported component for one active-project entry in the rail.
 * Displays: project name, stage chip, building/stopped indicator (not color-only),
 * path-not-found badge (REQ-03-006).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - Indicator is not color-only: icon + Spanish text label (architecture §7).
 *   - data-testid on every significant element (WO-03-002 contract).
 *   - Spanish aria-labels and user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-03-row → REQ-03-002, REQ-03-006
 *   AC-03-001.2 — listed in vertical panel
 *   AC-03-002.1 — title, stage, building/stopped indicator (text present, not color-only)
 *   WO-03-002
 */

import type { ProjectListItem } from "@/lib/portfolio";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// ---------------------------------------------------------------------------

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.625) calc(var(--space-base, 1rem) * 0.75)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-1, none)",
  minWidth: 0,
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  flexWrap: "wrap",
  minWidth: 0,
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--color-text, currentColor)",
  margin: 0,
  wordBreak: "break-word",
  flex: 1,
  minWidth: 0,
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const CHIP_BUILDING_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-frontend-dev, currentColor)",
  color: "var(--color-contrast, Canvas)",
  border: "none",
  fontWeight: 600,
};

const CHIP_STOPPED_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  opacity: 0.55,
};

const BADGE_NOT_FOUND_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-security-auditor, currentColor)",
  color: "var(--color-contrast, Canvas)",
  border: "none",
  fontWeight: 700,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ProjectRowProps {
  /** Project data from activeProjects() (IF-03-activeProjects). */
  item: ProjectListItem;
}

/**
 * ProjectRow — one entry in the project rail (CMP-03-row).
 *
 * Renders:
 *   - Project name (data-testid="project-row-name")
 *   - Stage chip   (data-testid="project-row-stage")
 *   - Building/stopped indicator (data-testid="project-row-indicator")
 *     — text label present, NEVER color-only (AC-03-002.1, architecture §7)
 *   - Path-not-found badge (data-testid="project-row-not-found-badge")
 *
 * Root: data-testid="project-row" (WO-03-002 contract).
 */
export function ProjectRow({ item }: ProjectRowProps): React.JSX.Element {
  const { name, stage, running, exists } = item;

  const indicatorStyle = running === true ? CHIP_BUILDING_STYLE : CHIP_STOPPED_STYLE;
  const indicatorLabel = running === true ? "Construyendo" : "Parado";
  const indicatorAriaLabel = running === true ? "Construcción activa" : "Proceso detenido";

  return (
    <article data-testid="project-row" style={ROW_STYLE} aria-label={`Proyecto: ${name}`}>
      <div style={ROW_HEADER_STYLE}>
        {/* Project name */}
        <h3 data-testid="project-row-name" style={NAME_STYLE}>
          {name}
        </h3>

        {/* Path-not-found badge (REQ-03-006) */}
        {!exists && (
          <span
            data-testid="project-row-not-found-badge"
            style={BADGE_NOT_FOUND_STYLE}
            role="status"
            aria-label="Ruta no encontrada en disco"
          >
            ⚠ ruta no encontrada
          </span>
        )}

        {/* Stage chip (AC-03-002.1) */}
        {stage !== undefined && (
          <span data-testid="project-row-stage" style={CHIP_STYLE} title={`Fase: ${stage}`}>
            {stage}
          </span>
        )}

        {/* Running indicator (AC-03-002.1): building / stopped.
            NOT color-only — always includes a Spanish text label.
            Only shown when path exists (missing path suppresses running state). */}
        {running !== undefined && exists && (
          <span
            data-testid="project-row-indicator"
            style={indicatorStyle}
            role="status"
            aria-label={indicatorAriaLabel}
          >
            {indicatorLabel}
          </span>
        )}
      </div>
    </article>
  );
}
