/**
 * CMP-18-turn — "Tu turno" human-gate queue component (WO-18-001, FRD-18)
 *
 * Renders the urgency-ordered queue of genuine human gates (from IF-18-turn).
 * Each item shows its label, the exact /pandacorp:* command (copyable via CopyButton),
 * and a link that navigates to the relevant project/idea/board.
 *
 * When the queue is empty, renders a calm al-día badge (no manufactured urgency — REQ-18-003).
 *
 * Uses SectionHead (CMP-13-sectionhead, DR-062) for the section divider — AC-18-001.10.
 * The count/al-día chip is passed from page.tsx via the `turnChip` prop so the
 * Server Component can compose it (no "use client" needed here).
 *
 * Server-renderable: no "use client" needed — CopyButton is already "use client" internally.
 *
 * Traceability:
 *   CMP-18-turn → AC-18-001.5 (human gates only, no routine progress)
 *                 AC-18-001.10 (shared SectionHead)
 *                 REQ-18-010, REQ-18-011, REQ-18-012
 */

import Link from "next/link";
import type { TurnItem } from "@/app/(dashboard)/_lib/turn";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TuTurnoProps {
  /**
   * Urgency-ordered human-gate queue from buildTurnQueue (IF-18-turn).
   * Empty array → al-día state.
   */
  items: TurnItem[];
  /**
   * The count/al-día chip rendered in the SectionHead right slot.
   * Passed from page.tsx (Server Component) so Chip is imported once at the page level.
   * Optional for backward-compat with legacy tests.
   */
  turnChip?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Styles (CSS custom properties only — FRD-13)
// ---------------------------------------------------------------------------

const ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "12px 14px",
  borderRadius: "9px",
  border: "1px solid var(--color-border, var(--bd))",
  background: "var(--color-card, var(--card))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
};

const LINK_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  flex: 1,
  minWidth: 0,
  textDecoration: "none",
  color: "inherit",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--color-text, var(--t1))",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const CMD_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2, var(--t2))",
  fontFamily: "var(--font-mono, monospace)",
};

const EMPTY_PANEL_STYLE: React.CSSProperties = {
  background: "var(--color-panel, var(--panel))",
  border: ".5px solid var(--color-border, var(--bd))",
  borderRadius: "12px",
  padding: "18px",
  color: "var(--color-text3, var(--t3))",
  fontSize: "13px",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TuTurno — the "Tu turno" hero section.
 *
 * Renders the urgency-ordered human-gate decision queue. Each row links to
 * the relevant destination and surfaces the exact /pandacorp:* command via
 * a CopyButton. When the queue is empty, shows a calm "al día" empty state.
 *
 * @param items - Urgency-ordered TurnItem array from buildTurnQueue().
 * @param turnChip - Count/al-día Chip node for SectionHead right slot.
 */
export function TuTurno({ items, turnChip }: TuTurnoProps): React.JSX.Element {
  const isEmpty = items.length === 0;

  return (
    <section aria-labelledby="tu-turno-heading-id">
      {/* SectionHead (CMP-13-sectionhead, DR-062, AC-18-001.10) */}
      <SectionHead
        icon="ti-flag-3"
        label="Tu turno"
        rightHtml={
          turnChip ??
          /* Fallback when not passed (legacy path / tests): use data-testid helpers */
          (isEmpty ? (
            <span
              data-testid="tu-turno-al-dia"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 500,
                background: "var(--color-ok-bg, var(--ok-bg))",
                color: "var(--color-ok, var(--ok))",
              }}
            >
              al día
            </span>
          ) : (
            <span
              data-testid="tu-turno-count"
              role="status"
              aria-label={`${items.length} elemento${items.length === 1 ? "" : "s"} en espera`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 500,
                background: "var(--color-danger-bg, var(--danger-bg))",
                color: "var(--color-danger, var(--danger))",
              }}
            >
              {items.length} esperan por ti
            </span>
          ))
        }
      />

      {/* Hidden heading for aria-labelledby (SectionHead renders a div, not a heading) */}
      <h2
        id="tu-turno-heading-id"
        data-testid="tu-turno-heading"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        Tu turno
      </h2>

      {/* Item list or empty panel */}
      {isEmpty ? (
        <div style={EMPTY_PANEL_STYLE}>
          <i
            className="ti ti-circle-check"
            style={{ fontSize: "20px", color: "var(--color-ok, var(--ok))" }}
            aria-hidden="true"
          />
          <div style={{ marginTop: "6px" }}>
            Nada espera por ti. Buen momento para capturar una idea nueva.
          </div>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {items.map((item) => (
            <li key={`${item.kind}:${item.href}`} data-testid="tu-turno-item" style={ITEM_STYLE}>
              {/* Left: link (navigates to the project/board/proposals) */}
              <Link href={item.href} data-testid="tu-turno-item-link" style={LINK_STYLE}>
                <span style={LABEL_STYLE}>{item.label}</span>
                <span style={CMD_STYLE}>{item.command}</span>
              </Link>

              {/* Right: CopyButton with the /pandacorp:* command */}
              <CopyButton value={item.command} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
