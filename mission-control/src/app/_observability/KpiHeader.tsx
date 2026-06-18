"use client";

/**
 * KpiHeader — CMP-12-kpi-header
 *
 * Renders the ≤5 critical KPIs derived by `deriveKpis` (IF-12-kpis, WO-12-002).
 * Each KPI with a `detail` field gets a collapsible disclosure button.
 * Failed-work-orders with value > 0 are marked with an alert role for a11y.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 *   - data-testid on every interactive / significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *   - Empty / loading / error states implemented.
 *
 * Traceability:
 *   CMP-12-kpi-header → REQ-12-001, REQ-12-004 → AC-12-001.1 → WO-12-002
 */

import { useState } from "react";
import type { Kpi } from "./selectors/kpis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KpiHeaderProps {
  /** The ≤5 KPIs produced by `deriveKpis`. Pass [] while loading. */
  kpis: Kpi[];
  /** When true, render a loading skeleton instead of the KPI grid. */
  isLoading?: boolean;
  /**
   * When provided, render an error state with this message instead of the
   * KPI grid. Ignored when isLoading is true.
   */
  error?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// Variables are wired by the design system (WO-13-002, globals.css).
// The fallback chain uses semantic system values so the component renders
// before design-tokens.json is frozen by the design phase.
// ---------------------------------------------------------------------------

const REGION_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
  alignItems: "flex-start",
};

const KPI_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  minWidth: "7rem",
};

const KPI_ITEM_FAILED_STYLE: React.CSSProperties = {
  ...KPI_ITEM_STYLE,
  borderLeft: "2px solid var(--color-agent-test-writer, var(--color-accent, currentColor))",
  paddingLeft: "calc(var(--spacing, 0.25rem) * 2)",
};

const KPI_VALUE_STYLE: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
  color: "var(--color-text, currentColor)",
};

const KPI_VALUE_FAILED_ACTIVE_STYLE: React.CSSProperties = {
  ...KPI_VALUE_STYLE,
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
};

const KPI_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.7,
};

const TOGGLE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const DETAIL_STYLE: React.CSSProperties = {
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  color: "var(--color-text-muted, currentColor)",
  wordBreak: "break-word",
  background:
    "var(--color-chip-bg, var(--color-surface, color-mix(in oklch, currentColor 8%, transparent)))",
  borderRadius: "var(--radius, 0.375rem)",
  padding: "0.25rem 0.5rem",
  maxWidth: "16rem",
};

const EMPTY_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontSize: "0.85rem",
};

const LOADING_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  minWidth: "7rem",
};

const SKELETON_VALUE_STYLE: React.CSSProperties = {
  height: "1.5rem",
  width: "3rem",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 12%, transparent))",
};

const SKELETON_LABEL_STYLE: React.CSSProperties = {
  height: "0.65rem",
  width: "6rem",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 8%, transparent))",
};

const ERROR_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

// ---------------------------------------------------------------------------
// Sub-component: single KPI tile
// ---------------------------------------------------------------------------

function KpiItem({ kpi }: { kpi: Kpi }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const isFailed = kpi.key === "failed-work-orders";
  const isFailedActive = isFailed && kpi.value > 0;
  const hasDetail = typeof kpi.detail === "string" && kpi.detail.length > 0;

  const itemStyle = isFailed ? KPI_ITEM_FAILED_STYLE : KPI_ITEM_STYLE;
  const valueStyle = isFailedActive ? KPI_VALUE_FAILED_ACTIVE_STYLE : KPI_VALUE_STYLE;

  // a11y: alert role only when there are real failures to surface
  const alertProps = isFailedActive
    ? ({ role: "alert", "aria-live": "polite", "data-alert": "true" } as const)
    : ({} as Record<string, never>);

  return (
    <div
      data-testid={`kpi-item-${kpi.key}`}
      // Shared testid for "all items" queries (test-writer contract)
      data-kpi-item="true"
      style={itemStyle}
      {...alertProps}
    >
      {/* Numeric value — tabular-nums */}
      <span data-testid={`kpi-value-${kpi.key}`} style={valueStyle}>
        {kpi.value}
      </span>

      {/* Human-readable label */}
      <span style={KPI_LABEL_STYLE}>{kpi.label}</span>

      {/* Collapsible detail — only rendered when detail is present */}
      {hasDetail && (
        <>
          <button
            type="button"
            data-testid={`kpi-detail-toggle-${kpi.key}`}
            aria-expanded={open}
            aria-label={`${open ? "Ocultar" : "Ver"} detalle de ${kpi.label}`}
            aria-controls={`kpi-detail-${kpi.key}`}
            onClick={() => setOpen((prev) => !prev)}
            style={TOGGLE_STYLE}
          >
            {open ? "▴ ocultar" : "▾ detalle"}
          </button>

          {open && (
            <section
              id={`kpi-detail-${kpi.key}`}
              data-testid={`kpi-detail-content-${kpi.key}`}
              style={DETAIL_STYLE}
              aria-label={`Detalle de ${kpi.label}`}
            >
              {kpi.detail}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const SKELETON_KEYS = [
  "skeleton-0",
  "skeleton-1",
  "skeleton-2",
  "skeleton-3",
  "skeleton-4",
] as const;

function KpiLoadingSkeleton(): React.JSX.Element {
  return (
    <div
      data-testid="kpi-header-loading"
      role="status"
      aria-busy="true"
      aria-label="Cargando indicadores"
      style={REGION_STYLE}
    >
      {SKELETON_KEYS.map((k) => (
        <div key={k} style={LOADING_ITEM_STYLE} aria-hidden="true">
          <div style={SKELETON_VALUE_STYLE} />
          <div style={SKELETON_LABEL_STYLE} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * KpiHeader — renders the ≤5 critical KPIs in the Mission Control header.
 *
 * Server Component safe when isLoading/error only — the collapsible toggle
 * requires client interactivity, hence "use client" at the top.
 */
export function KpiHeader({ kpis, isLoading = false, error }: KpiHeaderProps): React.JSX.Element {
  // Loading state — skeleton, takes precedence over error and empty
  if (isLoading) {
    return <KpiLoadingSkeleton />;
  }

  // Error state
  if (typeof error === "string") {
    return (
      <div data-testid="kpi-header-error" role="alert" aria-label="Error al cargar indicadores">
        <p style={ERROR_STYLE}>
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      </div>
    );
  }

  // Empty state — no KPIs derived yet
  if (kpis.length === 0) {
    return (
      <div
        data-testid="kpi-header-empty"
        role="status"
        aria-label="Sin indicadores disponibles"
        style={EMPTY_STYLE}
      >
        Sin indicadores disponibles.
      </div>
    );
  }

  // Normal state — render the ≤5 KPI tiles
  return (
    <section data-testid="kpi-header" aria-label="Indicadores principales" style={REGION_STYLE}>
      {kpis.map((kpi) => (
        <KpiItem key={kpi.key} kpi={kpi} />
      ))}
    </section>
  );
}
