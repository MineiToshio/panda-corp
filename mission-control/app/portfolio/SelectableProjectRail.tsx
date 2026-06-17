/**
 * SelectableProjectRail — URL-driven project rail with clickable rows.
 *
 * Wraps each project row in a Next.js <Link href="?project=<name>"> so
 * clicking a row navigates to that project's URL param (Server-rendered,
 * no client selection state, no flash — WO-03-004 design).
 *
 * The currently-selected row is marked with `data-selected="true"`.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels and user-facing copy.
 *   - Indicators are NOT color-only (icon + text label).
 *
 * Traceability:
 *   CMP-03-workspace-slot (selection behaviour) → REQ-03-004, REQ-03-005
 *   CMP-03-rail (rail container) → REQ-03-001
 *   CMP-03-row (row display) → REQ-03-002
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-004
 */

import Link from "next/link";
import type { ProjectListItem } from "@/lib/portfolio";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// ---------------------------------------------------------------------------

const RAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.75)",
};

const LINK_STYLE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  borderRadius: "var(--radius, 0.5rem)",
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
  padding: "calc(var(--space-base, 1rem) * 0.625) calc(var(--space-base, 1rem) * 0.75)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-1, none)",
  minWidth: 0,
};

const ROW_SELECTED_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  background: "var(--color-base, Canvas)",
  borderColor: "var(--color-accent, currentColor)",
  boxShadow: "var(--shadow-2, none)",
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

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  padding: "calc(var(--space-base, 1rem) * 2)",
  textAlign: "center",
  color: "var(--color-text, currentColor)",
  opacity: 0.7,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SelectableProjectRailProps {
  /** Active project list from activeProjects(). */
  items: ProjectListItem[];
  /** The currently-selected project name (from URL param or default-select). */
  selectedSlug: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SelectableProjectRail — vertical rail with URL-driven project selection.
 *
 * Each row is a Link to `?project=<name>`. The selected row gets
 * `data-selected="true"` and a distinct visual treatment.
 */
export function SelectableProjectRail({
  items,
  selectedSlug,
}: SelectableProjectRailProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <div data-testid="selectable-project-rail-empty" style={EMPTY_STYLE} aria-live="polite">
          <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
          <p style={{ margin: 0, fontSize: "0.75rem" }}>
            Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
          </p>
        </div>
      </nav>
    );
  }

  return (
    <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
      {items.map((item) => {
        const isSelected = item.name === selectedSlug;
        const rowStyle = isSelected ? ROW_SELECTED_STYLE : ROW_STYLE;
        const indicatorStyle = item.running === true ? CHIP_BUILDING_STYLE : CHIP_STOPPED_STYLE;
        const indicatorLabel = item.running === true ? "Construyendo" : "Parado";
        const indicatorAriaLabel =
          item.running === true ? "Construcción activa" : "Proceso detenido";

        return (
          <Link
            key={item.name}
            href={`?project=${encodeURIComponent(item.name)}`}
            style={LINK_STYLE}
            aria-label={`Seleccionar proyecto: ${item.name}`}
            aria-current={isSelected ? "page" : undefined}
          >
            <article
              data-testid="selectable-project-row"
              data-selected={String(isSelected)}
              style={rowStyle}
              aria-label={`Proyecto: ${item.name}`}
            >
              <div style={ROW_HEADER_STYLE}>
                {/* Project name */}
                <h3 style={NAME_STYLE}>{item.name}</h3>

                {/* Stage chip (AC-03-002.1) */}
                {item.stage !== undefined && (
                  <span
                    data-testid="selectable-row-stage"
                    style={CHIP_STYLE}
                    title={`Fase: ${item.stage}`}
                  >
                    {item.stage}
                  </span>
                )}

                {/* Running indicator (AC-03-002.1): not color-only — text label always present. */}
                {item.running !== undefined && item.exists && (
                  <span
                    data-testid="selectable-row-indicator"
                    style={indicatorStyle}
                    role="status"
                    aria-label={indicatorAriaLabel}
                  >
                    {indicatorLabel}
                  </span>
                )}
              </div>
            </article>
          </Link>
        );
      })}
    </nav>
  );
}
