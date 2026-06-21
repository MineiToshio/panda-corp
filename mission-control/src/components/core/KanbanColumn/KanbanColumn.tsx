/**
 * CMP-13-kanbancolumn — Fixed-width WO kanban column (WO-13-008, FND-3)
 *
 * Factored out of the inline wo-board.tsx WO kanban.
 * Fixed width 224px (prototype .col), panel background, border, header
 * with label + count, vertical-scroll body for WO cards.
 *
 * Design contract (prototype .col, design-tokens.json):
 *   flex:0 0 auto · width:224px · background:var(--color-panel) ·
 *   border:1px solid var(--color-border) · border-radius:10px · padding:10px
 *   Header: pixel font 11px · color var(--color-text2) · letter-spacing .04em
 *   Count: color var(--color-accent-text), tabular-nums
 *
 * Rules:
 *   - Tokens only — zero hardcoded colors/spacing/radii.
 *   - aria-label in Spanish referencing the column label (REQ-13-008).
 *   - count displayed with tabular-nums (REQ-13-003).
 *   - Column body is vertically scrollable to contain WO cards.
 *
 * Server Component — pure, no "use client".
 *
 * Traceability:
 *   AC-WO-13-008: KanbanColumn · 224px · header+count · tabular-nums · tokens
 *   CMP-13-kanbancolumn → WO-13-008 → FRD-13 REQ-13-002,003,008
 */

import type React from "react";

// ── Props ──────────────────────────────────────────────────────────────────────

export type KanbanColumnProps = {
  /** Column heading label (Spanish, e.g. "Pendiente", "En progreso"). */
  label: string;
  /** Number of items in the column — displayed with tabular-nums. */
  count: number;
  /**
   * Danger variant — renders the column header label in `var(--color-danger)`.
   * Used for the "Falló" column (prototype `.col` danger-color header).
   */
  danger?: boolean;
  /** WO card children to render in the scrollable column body. */
  children?: React.ReactNode;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * KanbanColumn — the shared 224px WO kanban column.
 *
 * Consumed by WoBoard (FRD-05) and any future kanban surface.
 * Server Component: pure, deterministic, no I/O.
 */
export function KanbanColumn({
  label,
  count,
  danger = false,
  children,
}: KanbanColumnProps): React.JSX.Element {
  return (
    <section
      data-testid="kanban-col-root"
      aria-label={`Columna ${label}: ${count} elemento${count !== 1 ? "s" : ""}`}
      style={{
        flex: "0 0 auto",
        width: "224px",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-panel)",
        border: "1px solid var(--color-border)",
        borderRadius: "10px",
        padding: "10px",
        minHeight: 0,
      }}
    >
      {/* Column header: label + count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "9px",
          flexShrink: 0,
        }}
      >
        <span
          data-testid="kanban-col-label"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "11px",
            color: danger ? "var(--color-danger)" : "var(--color-text2)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        <span
          data-testid="kanban-col-count"
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "11px",
            color: "var(--color-accent-text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      </div>

      {/* Scrollable column body — WO cards */}
      <div
        data-testid="kanban-col-body"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </section>
  );
}
