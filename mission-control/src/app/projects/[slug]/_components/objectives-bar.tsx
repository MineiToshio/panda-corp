/**
 * WO-04-004 — ObjectivesBar (CMP-04-objectives-bar)
 *
 * Server Component: "Mission Objectives" progress bar.
 *   - Shows work_orders_done / work_orders_total and percentage (AC-04-002.2).
 *   - Omitted when total is 0 or absent (AC-04-002.2).
 *   - tabular-nums on counts (FRD-13 / AC-13-003.1).
 *   - Visible regardless of the active tab (AC-04-002.3) — structural
 *     invariant enforced by page.tsx, not this component.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish copy.
 *   - No "use client" — Server Component.
 *
 * Traceability:
 *   CMP-04-objectives-bar → REQ-04-002
 *   AC-04-002.2, AC-04-002.3
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObjectivesBarProps {
  /** work_orders_done from status.yaml. */
  done: number;
  /** work_orders_total from status.yaml; when 0 or undefined the bar is omitted. */
  total: number | undefined;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 6)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
};

const LABEL_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
};

const COUNTS_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  fontVariantNumeric: "tabular-nums",
};

const PCT_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.75,
  fontVariantNumeric: "tabular-nums",
};

const TRACK_STYLE: React.CSSProperties = {
  width: "100%",
  height: "4px",
  borderRadius: "99px",
  background: "var(--color-border, oklch(0.3 0.01 230))",
  overflow: "hidden",
};

// ---------------------------------------------------------------------------
// ObjectivesBar component
// ---------------------------------------------------------------------------

/**
 * CMP-04-objectives-bar — "Mission Objectives" progress bar.
 *
 * Server Component (no "use client"). Rendered above the tab bar on every tab.
 * Omitted entirely when total is 0 or undefined (AC-04-002.2).
 */
export function ObjectivesBar({ done, total }: ObjectivesBarProps): React.JSX.Element | null {
  // AC-04-002.2 — omitted when total is 0 or absent
  if (total === undefined || total === 0) {
    return null;
  }

  const pct = Math.round((done / total) * 100);
  const pctClamped = Math.max(0, Math.min(100, pct));

  const FILL_STYLE: React.CSSProperties = {
    height: "100%",
    width: `${pctClamped}%`,
    borderRadius: "99px",
    background: "var(--color-accent, oklch(0.65 0.18 250))",
    transition: "width var(--duration-base, 200ms) var(--easing-standard, ease)",
  };

  return (
    <section
      data-testid="objectives-bar"
      style={ROOT_STYLE}
      aria-label={`Misión: ${done} de ${total} work orders completadas (${pctClamped}%)`}
    >
      {/* Label row: title + counts + percentage */}
      <div style={LABEL_ROW_STYLE}>
        <span style={LABEL_STYLE}>Objetivos de misión</span>
        <span data-testid="objectives-bar-counts" style={COUNTS_STYLE} aria-hidden="true">
          {done} / {total}
        </span>
        <span data-testid="objectives-bar-pct" style={PCT_STYLE} aria-hidden="true">
          · {pctClamped}%
        </span>
      </div>

      {/* Progress track */}
      <div
        style={TRACK_STYLE}
        role="progressbar"
        aria-valuenow={pctClamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pctClamped}% completado`}
      >
        <div data-testid="objectives-bar-fill" style={FILL_STYLE} />
      </div>
    </section>
  );
}
