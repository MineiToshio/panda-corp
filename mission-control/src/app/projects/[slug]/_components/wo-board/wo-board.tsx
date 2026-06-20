/**
 * WO-05-003 — WoBoard (CMP-05-board, CMP-05-column, CMP-05-card)
 *
 * Server Component. Five-column read-only kanban for work orders, painted to
 * match the prototype `projWO()` on the frozen design tokens.
 *
 * Columns (AC-05-001.1, prototype WLBL + WORDER):
 *   To do · En progreso · Review / Testing · Falló · Hecho
 *
 * Each column uses the KanbanColumn primitive (WO-13-008, DR-057).
 * FRD chips use the Chip primitive (WO-13-007, DR-057).
 * Fail cards render the danger variant (bg + border + icon + danger title).
 *
 * Traceability:
 *   AC-05-001.1  Five columns in order; equal-width (224px); horizontal scroll
 *   AC-05-001.2  Card text wraps (overflow-wrap:anywhere); no clipping
 *   AC-05-002.1  Each card shows its FRD via a Chip (info tone = accent)
 *   AC-05-005.1  Read-only: no drag handlers, no write path
 *   Fail column  Header in danger color; cards with danger bg + border + alert icon
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Reuses KanbanColumn (WO-13-008) and Chip (WO-13-007) — DR-057.
 *   - data-testid on every interactive/significant element.
 *   - Fail state signalled by icon + label (not color alone) — FRD-13/a11y.
 *   - Spanish copy for all UI-facing text.
 */

import type React from "react";

import { Chip } from "@/components/core/Chip/Chip";
import { KanbanColumn } from "@/components/core/KanbanColumn/KanbanColumn";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Column definitions — five columns in prototype order (AC-05-001.1)
// ---------------------------------------------------------------------------

interface KanbanColDef {
  /** WorkOrderState values routed to this column. */
  states: readonly WorkOrderState[];
  /** Spanish display label (maps to WLBL in the prototype). */
  label: string;
  /** Whether this column receives the danger header treatment. */
  isFail: boolean;
}

/**
 * Five canonical columns matching `projWO()` in the prototype:
 * ["todo","progress","review","fail","done"] with WLBL labels.
 *
 * Note: the lib uses `in_progress` (not `progress`) — we map them here.
 */
const COLUMNS: readonly KanbanColDef[] = [
  { states: ["todo"], label: "To do", isFail: false },
  { states: ["in_progress"], label: "En progreso", isFail: false },
  { states: ["review"], label: "Review / Testing", isFail: false },
  { states: ["fail"], label: "Falló", isFail: true },
  { states: ["done"], label: "Hecho", isFail: false },
] as const;

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

/** Board outer container — horizontal-scroll row of columns */
const BOARD_OUTER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  overflow: "hidden",
};

/** Horizontal-scroll row that holds the five KanbanColumns */
const COLUMNS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "6px",
};

/** Read-only caption (prototype `<p style="font-size:12px;color:var(--text3)...">`) */
const CAPTION_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text2))",
  margin: "0 0 10px",
};

/** Card container */
const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border2, var(--color-border))",
  borderRadius: "9px",
  padding: "10px",
  cursor: "pointer",
  overflowWrap: "anywhere",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
  transition: "border-color .15s, box-shadow .15s",
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

/** Fail card — danger background + danger border (prototype: `danger-bg`, `danger`) */
const CARD_FAIL_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  background: "var(--color-danger-bg)",
  borderColor: "var(--color-danger)",
};

/** Card title — wraps onto several lines (AC-05-001.2: overflow-wrap:anywhere) */
const CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  marginBottom: "6px",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
};

/** Fail card title — danger-colored (prototype: `color:var(--danger)`) */
const CARD_TITLE_FAIL_STYLE: React.CSSProperties = {
  ...CARD_TITLE_STYLE,
  color: "var(--color-danger)",
};

/** Fail indicator — alert icon prefix inside the title row */
const FAIL_ICON_STYLE: React.CSSProperties = {
  fontSize: "12px",
  verticalAlign: "-1px",
  marginRight: "3px",
};

/** Empty-column placeholder ("—" em dash) */
const EMPTY_PLACEHOLDER_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text2))",
  padding: "4px 2px",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface WoCardProps {
  order: WorkOrder;
}

/**
 * WorkOrderCard — CMP-05-card.
 * The `.card` primitive with a `fail` danger variant (DR-057: variant, not a second card).
 *
 * AC-05-003.1: clicking opens the detail view (?tab=work-orders&wo=<id>).
 * Fail variant: danger bg + danger border + alert icon + danger title.
 * Accessibility: icon + label (never color alone) per FRD-13.
 */
function WorkOrderCard({ order }: WoCardProps): React.JSX.Element {
  const isFail = order.state === "fail";
  const cardStyle = isFail ? CARD_FAIL_STYLE : CARD_STYLE;
  const titleStyle = isFail ? CARD_TITLE_FAIL_STYLE : CARD_TITLE_STYLE;

  return (
    <a
      data-testid="wo-card-link"
      href={`?tab=work-orders&wo=${encodeURIComponent(order.id)}`}
      aria-label={`Ver detalle: ${order.title}`}
    >
      <article data-testid="wo-card" aria-label={order.title} style={cardStyle}>
        {/* Title row — fail cards get the alert icon prefix (a11y: icon + label) */}
        <div style={titleStyle}>
          {isFail && (
            <span
              data-testid="wo-fail-indicator"
              aria-label="Falló"
              role="img"
              style={FAIL_ICON_STYLE}
            >
              {/* ti-alert-triangle equivalent — conveyed by icon + label (not color alone) */}
              <span aria-hidden="true">⚠</span>
              <span className="sr-only">Falló: </span>
            </span>
          )}
          {order.title}
        </div>

        {/* FRD chip — Chip primitive (WO-13-007, tone="info" = accent-bg preset) */}
        <span data-testid="wo-frd-chip">
          <Chip tone="info" label={order.frd} />
        </span>
      </article>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Public component — WorkOrderBoard (CMP-05-board)
// ---------------------------------------------------------------------------

export interface WorkOrderBoardProps {
  /** All work orders for the current project (from listWorkOrders). */
  orders: WorkOrder[];
}

/**
 * WorkOrderBoard — five-column read-only kanban (CMP-05-board).
 *
 * Server Component (no "use client"). Distributes WorkOrder[] into the five
 * canonical columns and renders KanbanColumn (WO-13-008) sub-trees.
 *
 * Layout: horizontal-scroll row of 224px KanbanColumns (prototype .col).
 *
 * AC-05-005.1: strictly read-only — no drag handlers, no write path.
 * AC-05-001.1: five columns in order — To do · En progreso · Review / Testing · Falló · Hecho.
 * AC-05-001.2: cards wrap (overflow-wrap:anywhere); columns scroll horizontally.
 * AC-05-002.1: each card shows its FRD via a Chip (tone="info").
 * Fail treatment: danger bg + border + ⚠ icon prefix + danger title; Fail column header
 *   uses danger label override via aria-label (column label "Falló" already conveys it).
 */
export function WorkOrderBoard({ orders }: WorkOrderBoardProps): React.JSX.Element {
  // Bucket orders into columns by state
  const byColumn = new Map<string, WorkOrder[]>();
  for (const col of COLUMNS) {
    byColumn.set(col.label, []);
  }

  for (const order of orders) {
    const col = COLUMNS.find((c) => c.states.includes(order.state));
    const label = col?.label ?? "To do";
    const bucket = byColumn.get(label);
    if (bucket !== undefined) {
      bucket.push(order);
    }
  }

  return (
    <section data-testid="wo-board" aria-label="Tablero de work orders" style={BOARD_OUTER_STYLE}>
      {/* Read-only caption (prototype paragraph) */}
      <p style={CAPTION_STYLE}>
        Estado en vivo de cada work order (lo escriben los agentes). Clic en uno para ver su resumen
        y de qué FRD es. Solo-lectura.
      </p>

      {/* Horizontal-scroll row of five KanbanColumns — labelled by the outer section */}
      <div style={COLUMNS_ROW_STYLE}>
        {COLUMNS.map((col) => {
          const colOrders = byColumn.get(col.label) ?? [];
          return (
            <KanbanColumn
              key={col.label}
              label={col.label}
              count={colOrders.length}
              danger={col.isFail}
            >
              {colOrders.length > 0 ? (
                colOrders.map((order) => <WorkOrderCard key={order.id} order={order} />)
              ) : (
                <div aria-hidden="true" style={EMPTY_PLACEHOLDER_STYLE}>
                  —
                </div>
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </section>
  );
}
