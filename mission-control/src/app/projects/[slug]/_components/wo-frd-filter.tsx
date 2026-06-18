"use client";

/**
 * WO-05-004 — WoFrdFilter (CMP-05-frd-filter)
 *
 * Client Component ("use client"). Filter control for the kanban board —
 * lists distinct FRD slugs and calls onSelect when a filter is chosen.
 *
 * Traceability:
 *   AC-05-002.2  The kanban SHALL allow grouping/filtering by FRD.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive element.
 *   - aria-pressed on each toggle button (a11y).
 *   - Spanish copy (UI-facing).
 */

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 4)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  flexShrink: 0,
  marginRight: "calc(var(--spacing, 0.25rem) * 1)",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: "0.75rem",
    fontWeight: active ? 700 : 500,
    padding: "2px calc(var(--spacing, 0.25rem) * 2)",
    borderRadius: "9999px",
    border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
    background: active ? "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.15))" : "transparent",
    color: active
      ? "var(--color-accent, var(--color-text, currentColor))"
      : "var(--color-text-muted, currentColor)",
    cursor: "pointer",
    transition: "background var(--motion-duration-fast, 80ms) var(--motion-easing-default, ease)",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WoFrdFilterProps {
  /** Distinct FRD slugs present in the work orders list. */
  frds: string[];
  /** Currently selected FRD (null = "All"). */
  selected: string | null;
  /** Callback when the selection changes (null = "All"). */
  onSelect: (frd: string | null) => void;
}

/**
 * WoFrdFilter — pill-style FRD filter bar.
 *
 * Client Component (needs click handlers and aria-pressed state).
 * AC-05-002.2.
 */
export function WoFrdFilter({ frds, selected, onSelect }: WoFrdFilterProps): React.JSX.Element {
  const allActive = selected === null;

  return (
    <fieldset
      data-testid="wo-frd-filter"
      aria-label="Filtrar por FRD"
      style={{ ...CONTAINER_STYLE, border: "none", padding: 0, margin: 0 }}
    >
      <legend style={LABEL_STYLE}>Filtrar:</legend>
      <button
        type="button"
        data-testid="wo-frd-filter-all"
        aria-pressed={allActive}
        onClick={() => onSelect(null)}
        style={chipStyle(allActive)}
      >
        Todos
      </button>
      {frds.map((frd) => {
        const active = selected === frd;
        return (
          <button
            key={frd}
            type="button"
            data-testid="wo-frd-filter-option"
            aria-pressed={active}
            aria-label={`Filtrar por ${frd}`}
            onClick={() => onSelect(frd)}
            style={chipStyle(active)}
            title={frd}
          >
            {frd}
          </button>
        );
      })}
    </fieldset>
  );
}
