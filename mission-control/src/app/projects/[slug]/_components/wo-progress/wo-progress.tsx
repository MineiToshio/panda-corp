/**
 * WO-05-006 — WorkOrderProgressBar (CMP-05-progress)
 *
 * Server Component. Displays aggregated work-order progress:
 * done / total and percentage (tabular-nums, tokens only).
 *
 * Traceability:
 *   AC-05-004.1  The view SHALL show aggregated progress done/total and %.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - font-variant-numeric: tabular-nums on all numeric values (FRD-13).
 */

import type { WorkOrderProgress } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface, Canvas)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text, currentColor)",
  whiteSpace: "nowrap",
};

const TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  height: "6px",
  borderRadius: "9999px",
  background: "var(--color-progress-track, var(--color-border, currentColor))",
  overflow: "hidden",
  opacity: 0.4,
};

const PCT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  color: "var(--color-text-muted, currentColor)",
  whiteSpace: "nowrap",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WorkOrderProgressBarProps {
  /** Aggregated progress from aggregateProgress(listWorkOrders(...)). */
  progress: WorkOrderProgress;
}

/**
 * WorkOrderProgressBar — renders done/total and % in a compact bar.
 *
 * Server Component (no "use client"). Tokens only; tabular-nums on counts.
 * AC-05-004.1.
 */
export function WorkOrderProgressBar({ progress }: WorkOrderProgressBarProps): React.JSX.Element {
  const { done, total, pct } = progress;

  const fillStyle: React.CSSProperties = {
    height: "100%",
    width: `${pct}%`,
    background: "var(--color-accent, var(--color-text-muted, currentColor))",
    borderRadius: "9999px",
    transition: "width var(--motion-duration-base, 150ms) var(--motion-easing-default, ease)",
    opacity: 1,
  };

  return (
    <section
      data-testid="wo-progress"
      aria-label={`Progreso: ${done} de ${total} work orders completados (${pct}%)`}
      style={CONTAINER_STYLE}
    >
      <span style={LABEL_STYLE}>
        <span aria-hidden="true">{done}</span>
        <span aria-hidden="true" style={{ opacity: 0.5, margin: "0 2px" }}>
          /
        </span>
        <span aria-hidden="true">{total}</span>
      </span>
      <div
        data-testid="wo-progress-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% completado`}
        style={TRACK_STYLE}
      >
        <div style={fillStyle} />
      </div>
      <span style={PCT_STYLE} aria-hidden="true">
        {pct}%
      </span>
    </section>
  );
}
