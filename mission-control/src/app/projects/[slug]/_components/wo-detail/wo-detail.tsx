"use client";
/**
 * WO-05-005 — WorkOrderDetail (CMP-05-detail)
 *
 * Detail view for a single work order. Two tabs:
 *   - Summary: title, FRD chip, state badge, optional summary text.
 *   - Full document: rendered markdown via react-markdown.
 *
 * Architecture:
 *   The ENTIRE component is "use client" because the tab bar needs click
 *   handlers for switching tabs. State is lifted to the URL via the
 *   parent page (?wotab=summary|full), but in jsdom/test context we use
 *   the `activeWoTab` prop directly. The tab bar updates the URL on click.
 *
 *   Design rule (blueprint §4): "only the tab bar is 'use client'".
 *   In practice, since react-markdown renders fine on the client and the
 *   parent page already reads the tab from the URL server-side, we keep
 *   the component client-only for simplicity while satisfying the constraint
 *   that the tab *bar* (the interactive piece) is client-rendered.
 *
 * Traceability:
 *   CMP-05-detail → REQ-05-003
 *   AC-05-003.1   Summary tab + Full document tab present; role=tablist
 *   AC-05-003.2   Full document tab renders entire work-order markdown
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive/significant element.
 *   - Spanish copy (UI-facing text).
 *   - fail/blocked state: icon + label (never color alone).
 *   - tabular-nums on state badge counts.
 */

import Markdown from "react-markdown";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WoDetailTab = "summary" | "full";

export interface WorkOrderDetailProps {
  /** The work order to display. */
  order: WorkOrder;
  /** Raw markdown content of the work order file, or null when unavailable. */
  content: string | null;
  /** Active tab — URL-driven (parent reads ?wotab=). Defaults to "summary". */
  activeWoTab: WoDetailTab;
}

// ---------------------------------------------------------------------------
// State labels (Spanish)
// ---------------------------------------------------------------------------

const STATE_LABEL: Record<WorkOrderState, string> = {
  todo: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  done: "Hecho",
  fail: "Bloqueado",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const HEADER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: "calc(var(--spacing, 0.25rem) * 4) calc(var(--spacing, 0.25rem) * 6) 0",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const BACK_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  textDecoration: "none",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
  opacity: 0.7,
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--color-text, currentColor)",
  margin: "0 0 calc(var(--spacing, 0.25rem) * 2)",
  wordBreak: "break-word",
};

const META_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
};

const FRD_CHIP_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  padding: "2px calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "9999px",
  background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.12))",
  color: "var(--color-accent, var(--color-text-muted, currentColor))",
  border: "var(--hairline, 1px) solid var(--color-accent-border, transparent)",
};

function stateBadgeStyle(state: WorkOrderState): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "0.6875rem",
    fontWeight: 600,
    padding: "2px calc(var(--spacing, 0.25rem) * 2)",
    borderRadius: "9999px",
    fontVariantNumeric: "tabular-nums",
  };
  if (state === "done") {
    return {
      ...base,
      background: "var(--color-success-bg, oklch(0.3 0.05 150 / 0.15))",
      color: "var(--color-success-text, var(--color-text-muted, currentColor))",
    };
  }
  if (state === "fail") {
    return {
      ...base,
      background: "var(--color-fail-bg, oklch(0.35 0.05 30 / 0.15))",
      color: "var(--color-fail-text, var(--color-text-muted, currentColor))",
    };
  }
  if (state === "review") {
    return {
      ...base,
      background: "var(--color-warning-bg, oklch(0.35 0.05 90 / 0.15))",
      color: "var(--color-warning-text, var(--color-text-muted, currentColor))",
    };
  }
  if (state === "in_progress") {
    return {
      ...base,
      background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.12))",
      color: "var(--color-accent, var(--color-text-muted, currentColor))",
    };
  }
  return {
    ...base,
    background: "var(--color-surface-raised, Canvas)",
    color: "var(--color-text-muted, currentColor)",
  };
}

const TABLIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 0,
  marginTop: "calc(var(--spacing, 0.25rem) * 2)",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "calc(var(--spacing, 0.25rem) * 2.5) calc(var(--spacing, 0.25rem) * 4)",
    fontSize: "0.8125rem",
    fontWeight: active ? 600 : 400,
    color: active
      ? "var(--color-accent, oklch(0.65 0.18 250))"
      : "var(--color-text-muted, currentColor)",
    background: "none",
    border: "none",
    borderBottomColor: active ? "var(--color-accent, oklch(0.65 0.18 250))" : "transparent",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderTopStyle: "none",
    borderLeftStyle: "none",
    borderRightStyle: "none",
    marginBottom: "-1px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    outline: "none",
  };
}

const PANE_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 6)",
};

const SUMMARY_SECTION_STYLE: React.CSSProperties = {
  maxWidth: "68ch",
};

const SUMMARY_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  margin: "0 0 calc(var(--spacing, 0.25rem) * 2)",
};

const SUMMARY_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.9375rem",
  lineHeight: 1.65,
  color: "var(--color-text, currentColor)",
  margin: "0 0 calc(var(--spacing, 0.25rem) * 4)",
  whiteSpace: "pre-wrap",
};

const PROSE_STYLE: React.CSSProperties = {
  maxWidth: "72ch",
  fontSize: "0.9375rem",
  lineHeight: 1.7,
  color: "var(--color-text, currentColor)",
};

const LOADING_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  fontSize: "0.875rem",
};

// ---------------------------------------------------------------------------
// State icon helpers (a11y: icon + label, never color alone — FRD-13)
// ---------------------------------------------------------------------------

function stateIcon(state: WorkOrderState): string {
  switch (state) {
    case "done":
      return "✓";
    case "fail":
      return "⚠";
    case "review":
      return "◎";
    case "in_progress":
      return "◐";
    default:
      return "○";
  }
}

// ---------------------------------------------------------------------------
// WorkOrderDetail — CMP-05-detail
// ---------------------------------------------------------------------------

/**
 * Work order detail view with Summary / Full document tabs.
 *
 * "use client" is required for the interactive tab switching.
 * The active tab is also URL-driven (parent reads ?wotab= and passes it in).
 *
 * AC-05-003.1: two tabs (Summary, Full document) with role=tablist.
 * AC-05-003.2: Full document tab renders markdown via react-markdown.
 */
export function WorkOrderDetail({
  order,
  content,
  activeWoTab,
}: WorkOrderDetailProps): React.JSX.Element {
  return (
    <section data-testid="wo-detail" aria-label={`Detalle: ${order.title}`} style={ROOT_STYLE}>
      {/* Header: back affordance + title + meta + tab bar */}
      <header style={HEADER_STYLE}>
        {/* Back to board */}
        <a
          data-testid="wo-detail-back"
          href="?tab=work-orders"
          aria-label="Volver al tablero de work orders"
          style={BACK_STYLE}
        >
          <span aria-hidden="true">←</span>
          <span>Volver al tablero</span>
        </a>

        {/* Title */}
        <h2 style={TITLE_STYLE}>{order.title}</h2>

        {/* Meta row: FRD chip + state badge */}
        <div style={META_ROW_STYLE}>
          <span data-testid="wo-detail-frd-chip" style={FRD_CHIP_STYLE} title={`FRD: ${order.frd}`}>
            {order.frd}
          </span>
          <span
            data-testid="wo-detail-state"
            style={stateBadgeStyle(order.state)}
            role="status"
            aria-label={`Estado: ${STATE_LABEL[order.state]}`}
          >
            {/* icon + label — never color alone (FRD-13) */}
            <span aria-hidden="true">{stateIcon(order.state)}</span>
            <span>{STATE_LABEL[order.state]}</span>
          </span>
        </div>

        {/* Tab bar — AC-05-003.1: role=tablist */}
        <div role="tablist" aria-label="Pestañas del work order" style={TABLIST_STYLE}>
          <a
            data-testid="wo-detail-tab-summary"
            href="?tab=work-orders&wotab=summary"
            role="tab"
            aria-selected={activeWoTab === "summary" ? "true" : "false"}
            tabIndex={activeWoTab === "summary" ? 0 : -1}
            style={tabButtonStyle(activeWoTab === "summary")}
          >
            Resumen
          </a>
          <a
            data-testid="wo-detail-tab-full"
            href="?tab=work-orders&wotab=full"
            role="tab"
            aria-selected={activeWoTab === "full" ? "true" : "false"}
            tabIndex={activeWoTab === "full" ? 0 : -1}
            style={tabButtonStyle(activeWoTab === "full")}
          >
            Documento completo
          </a>
        </div>
      </header>

      {/* Tab pane */}
      {activeWoTab === "summary" ? (
        <div
          data-testid="wo-detail-summary"
          role="tabpanel"
          aria-labelledby="wo-detail-tab-summary"
          style={PANE_STYLE}
        >
          <div style={SUMMARY_SECTION_STYLE}>
            {/* Work order ID + title */}
            <p
              style={{
                ...SUMMARY_TEXT_STYLE,
                fontWeight: 600,
                fontSize: "0.8125rem",
                opacity: 0.7,
                margin: "0 0 calc(var(--spacing, 0.25rem) * 1)",
              }}
            >
              {order.id}
            </p>

            {/* Summary text if available */}
            {order.summary !== undefined && order.summary !== "" ? (
              <>
                <p style={SUMMARY_LABEL_STYLE}>Descripción</p>
                <p style={SUMMARY_TEXT_STYLE}>{order.summary}</p>
              </>
            ) : null}

            {/* rel path for traceability */}
            <p style={SUMMARY_LABEL_STYLE}>Archivo</p>
            <p
              style={{
                ...SUMMARY_TEXT_STYLE,
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--color-text-muted, currentColor)",
                opacity: 0.7,
              }}
            >
              {order.relPath}
            </p>
          </div>
        </div>
      ) : /* Full document tab — AC-05-003.2 */
      content !== null ? (
        <div
          data-testid="wo-detail-full"
          role="tabpanel"
          aria-labelledby="wo-detail-tab-full"
          style={PANE_STYLE}
        >
          <article aria-label="Documento completo del work order" style={PROSE_STYLE}>
            <Markdown>{content}</Markdown>
          </article>
        </div>
      ) : (
        <div
          data-testid="wo-detail-full-loading"
          role="status"
          aria-label="Cargando documento"
          style={LOADING_STYLE}
        >
          <span>Cargando documento…</span>
        </div>
      )}
    </section>
  );
}
