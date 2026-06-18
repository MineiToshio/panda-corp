/**
 * WO-05-003 — Kanban board (CMP-05-board, CMP-05-column, CMP-05-card)
 *
 * Server Component. Consumes WorkOrder[] from lib/work-orders.ts (IF-05-work-orders,
 * WO-05-001) and renders a 4-column read-only kanban.
 *
 * Traceability:
 *   AC-05-001.1  Four columns in order: Pendiente · En progreso · Revisión · Hecho
 *   AC-05-001.2  Equal-width wide columns; horizontal scroll; card text wraps
 *   AC-05-002.1  Each card shows its FRD via a chip
 *   AC-05-005.1  Read-only: no drag handlers, no write path
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive/significant element.
 *   - Spanish copy (UI-facing text).
 *   - fail state signalled by icon + label (not color alone) per FRD-13/a11y.
 */

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Column definitions (AC-05-001.1 — 4 columns in order)
// ---------------------------------------------------------------------------

interface KanbanColumn {
  /** WorkOrderState values that belong to this column */
  states: WorkOrderState[];
  /** Spanish heading label */
  label: string;
  /** Stable key for rendering */
  key: string;
}

const COLUMNS: KanbanColumn[] = [
  { key: "todo", states: ["todo"], label: "Pendiente" },
  { key: "in_progress", states: ["in_progress", "fail"], label: "En progreso" },
  { key: "review", states: ["review"], label: "Revisión" },
  { key: "done", states: ["done"], label: "Hecho" },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const BOARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const SCROLL_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  flex: 1,
  overflowX: "auto",
  overflowY: "hidden",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  minHeight: 0,
};

const COLUMN_STYLE: React.CSSProperties = {
  flex: "0 0 280px",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  minWidth: 0,
};

const COLUMN_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  padding: "calc(var(--spacing, 0.25rem) * 1.5) 0",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  opacity: 0.7,
  marginBottom: "calc(var(--spacing, 0.25rem) * 1)",
};

const CARD_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flex: 1,
  overflowY: "auto",
};

const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card-bg, var(--color-surface-raised, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 6px)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  cursor: "default",
  boxShadow: "var(--elevation-1-shadow, none)",
};

const CARD_FAIL_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  borderColor: "var(--color-fail-border, var(--color-border, currentColor))",
  background: "var(--color-fail-bg, var(--color-surface-raised, Canvas))",
  opacity: 0.85,
};

const CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  fontWeight: 500,
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const FRD_CHIP_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  padding: "1px calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "9999px",
  background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.12))",
  color: "var(--color-accent, var(--color-text-muted, currentColor))",
  border: "var(--hairline, 1px) solid var(--color-accent-border, transparent)",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const FAIL_INDICATOR_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--color-fail-text, var(--color-text-muted, currentColor))",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface WoCardProps {
  order: WorkOrder;
}

// Card link style — wraps the entire card, preserves card visual via display:block
const CARD_LINK_STYLE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  borderRadius: "var(--radius, 6px)",
};

function WoCard({ order }: WoCardProps): React.JSX.Element {
  const isFail = order.state === "fail";
  const cardStyle = isFail ? CARD_FAIL_STYLE : CARD_STYLE;

  return (
    // AC-05-003.1: each card is a link that opens the detail view (?tab=work-orders&wo=<id>)
    <a
      data-testid="wo-card-link"
      href={`?tab=work-orders&wo=${encodeURIComponent(order.id)}`}
      aria-label={`Ver detalle: ${order.title}`}
      style={CARD_LINK_STYLE}
    >
      <article data-testid="wo-card" aria-label={order.title} style={cardStyle}>
        <p style={CARD_TITLE_STYLE}>{order.title}</p>
        <span data-testid="wo-frd-chip" style={FRD_CHIP_STYLE} title={order.frd}>
          {order.frd}
        </span>
        {isFail && (
          <span
            data-testid="wo-fail-indicator"
            aria-label="Bloqueado"
            role="img"
            style={FAIL_INDICATOR_STYLE}
          >
            {/* icon + label (a11y: not color alone, AC-05-001.2 + FRD-13) */}
            <span aria-hidden="true">⚠</span>
            <span>Bloqueado</span>
          </span>
        )}
      </article>
    </a>
  );
}

interface WoColumnProps {
  column: KanbanColumn;
  orders: WorkOrder[];
}

function WoColumn({ column, orders }: WoColumnProps): React.JSX.Element {
  return (
    <section data-testid="wo-column" aria-label={column.label} style={COLUMN_STYLE}>
      <h3 data-testid="wo-column-heading" style={COLUMN_HEADING_STYLE}>
        {column.label}
        <span
          style={{
            marginLeft: "calc(var(--spacing, 0.25rem) * 2)",
            fontVariantNumeric: "tabular-nums",
            opacity: 0.5,
          }}
        >
          {orders.length}
        </span>
      </h3>
      <ul style={CARD_LIST_STYLE} aria-label={`Tarjetas de ${column.label}`}>
        {orders.map((order) => (
          <li key={order.id} style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <WoCard order={order} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public component — WorkOrderBoard (CMP-05-board)
// ---------------------------------------------------------------------------

export interface WorkOrderBoardProps {
  /** All work orders for this project (from listWorkOrders). */
  orders: WorkOrder[];
}

/**
 * WorkOrderBoard — 4-column read-only kanban.
 *
 * Server Component (no "use client"). Distributes WorkOrder[] into the four
 * canonical columns and renders CMP-05-column + CMP-05-card sub-trees.
 *
 * AC-05-005.1: strictly read-only — no drag handlers, no write path.
 */
export function WorkOrderBoard({ orders }: WorkOrderBoardProps): React.JSX.Element {
  // Distribute orders into columns
  const byColumn = new Map<string, WorkOrder[]>();
  for (const col of COLUMNS) {
    byColumn.set(col.key, []);
  }

  for (const order of orders) {
    const col = COLUMNS.find((c) => c.states.includes(order.state));
    const key = col?.key ?? "todo";
    const bucket = byColumn.get(key);
    if (bucket) {
      bucket.push(order);
    }
  }

  return (
    <section data-testid="wo-board" aria-label="Tablero de work orders" style={BOARD_STYLE}>
      <div style={SCROLL_CONTAINER_STYLE}>
        {COLUMNS.map((col) => (
          <WoColumn key={col.key} column={col} orders={byColumn.get(col.key) ?? []} />
        ))}
      </div>
    </section>
  );
}
