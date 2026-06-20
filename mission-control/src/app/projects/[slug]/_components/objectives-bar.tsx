/**
 * WO-04-004 — ObjectivesBar (CMP-04-objectives-bar)
 *
 * Server Component: "Mission Objectives" progress bar.
 *   - Shows work_orders_done / work_orders_total and percentage (AC-04-002.2).
 *   - Omitted when total is 0 or absent (AC-04-002.2).
 *   - tabular-nums on counts (FRD-13 / AC-13-003.1).
 *   - Visible regardless of the active tab (AC-04-002.3) — structural
 *     invariant enforced by page.tsx, not this component.
 *   - Consumer of the shared ProgressBar primitive (WO-13-007, DR-057).
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

import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";

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
  padding: "8px 14px 10px",
  borderBottom: "0.5px solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
};

const LABEL_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const LABEL_LEFT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "11px",
  color: "var(--color-text2, currentColor)",
};

const COUNTS_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text2, currentColor)",
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------------------------
// ObjectivesBar component
// ---------------------------------------------------------------------------

/**
 * CMP-04-objectives-bar — "Mission Objectives" progress bar.
 *
 * Server Component (no "use client"). Rendered above the tab bar on every tab.
 * Omitted entirely when total is 0 or undefined (AC-04-002.2).
 *
 * Delegates the track rendering to the shared ProgressBar primitive (WO-13-007)
 * and adds the "Objetivos de la misión" label row with icon and counts above it.
 */
export function ObjectivesBar({ done, total }: ObjectivesBarProps): React.JSX.Element | null {
  // AC-04-002.2 — omitted when total is 0 or absent
  if (total === undefined || total === 0) {
    return null;
  }

  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));

  return (
    <section
      data-testid="objectives-bar"
      style={ROOT_STYLE}
      aria-label={`Misión: ${done} de ${total} work orders completadas (${pct}%)`}
    >
      {/* Label row: icon + title + counts + percentage */}
      <div style={LABEL_ROW_STYLE}>
        <span style={LABEL_LEFT_STYLE}>
          <i
            className="ti ti-sword"
            style={{ fontSize: "12px", color: "var(--color-accent-text)" }}
            aria-hidden="true"
          />
          Objetivos de la misión
        </span>
        <span style={COUNTS_STYLE} aria-hidden="true">
          <span data-testid="objectives-bar-counts" style={{ fontVariantNumeric: "tabular-nums" }}>
            {done} / {total}
          </span>{" "}
          <span data-testid="objectives-bar-pct" style={{ fontVariantNumeric: "tabular-nums" }}>
            · {pct}%
          </span>
        </span>
      </div>

      {/* Progress track — shared ProgressBar primitive (WO-13-007, DR-057) */}
      <div data-testid="objectives-bar-fill">
        <ProgressBar done={done} total={total} ariaLabel={`${pct}% de work orders completadas`} />
      </div>
    </section>
  );
}
