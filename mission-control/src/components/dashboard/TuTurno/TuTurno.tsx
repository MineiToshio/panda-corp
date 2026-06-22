/**
 * CMP-18-turn — "Tu turno" human-gate queue component (WO-18-001, FRD-18)
 *
 * Renders the urgency-ordered queue of genuine human gates (from IF-18-turn).
 * Each item shows a colored 34px square icon, its label + a descriptive sub
 * line, and the exact /pandacorp:* command in a `.cmd` chip (copyable via
 * CopyButton). A link over the icon+text navigates to the relevant destination.
 *
 * Visual contract — re-anchored to the approved prototype `qrow()`
 * (index.html ~L654-658, DR-054/DR-062):
 *   - Row = `.card` surface (var(--color-card) + var(--color-border) + emboss).
 *   - Left: a 34px SQUARE icon tile tinted by priority (bg/fg color tokens).
 *   - Middle: title (14px) + sub (12px var(--color-text2)).
 *   - Right: the command as a `.cmd` mono chip with a copy button.
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
import type { TurnItem, TurnItemKind } from "@/app/(dashboard)/_lib/turn";
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
// Per-kind visuals (icon + tint + sub line) — prototype `qrow` presets.
// TurnItem carries no icon/sub, so derive them from the gate `kind`.
// ---------------------------------------------------------------------------

interface KindVisual {
  icon: string;
  bg: string;
  fg: string;
  sub: string;
}

const KIND_VISUALS: Record<TurnItemKind, KindVisual> = {
  "pending-decisions": {
    icon: "ti-coin",
    bg: "var(--color-danger-bg)",
    fg: "var(--color-danger)",
    sub: "requiere tu aprobación · gate humano",
  },
  "review-launch": {
    icon: "ti-target-arrow",
    bg: "var(--color-warn-bg)",
    fg: "var(--color-warn)",
    sub: "métricas reales vs hipótesis · kill / hold / double-down",
  },
  "memory-nudge": {
    icon: "ti-brain",
    bg: "var(--color-accent-bg)",
    fg: "var(--color-accent-text)",
    sub: "destila las notas del taller en lecciones reutilizables",
  },
  "undiscovered-ideas": {
    icon: "ti-bulb",
    bg: "var(--color-panel)",
    fg: "var(--color-text2)",
    sub: "pídeme un ranking para decidir cuál construir",
  },
  // Forbidden routine-progress kinds never reach the queue (AC-18-002.2); typed
  // for exhaustiveness with neutral fallbacks.
  "running-build": {
    icon: "ti-loader-2",
    bg: "var(--color-panel)",
    fg: "var(--color-text2)",
    sub: "",
  },
  "advance-pending": {
    icon: "ti-arrow-right",
    bg: "var(--color-panel)",
    fg: "var(--color-text2)",
    sub: "",
  },
  "failed-wo": {
    icon: "ti-alert-triangle",
    bg: "var(--color-panel)",
    fg: "var(--color-text2)",
    sub: "",
  },
};

// ---------------------------------------------------------------------------
// Styles (CSS custom properties only — FRD-13)
// ---------------------------------------------------------------------------

/** Row = `.card` surface (prototype). */
const ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

const ICON_TILE_BASE: React.CSSProperties = {
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const LINK_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flex: 1,
  minWidth: 0,
  textDecoration: "none",
  color: "inherit",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--color-text)",
};

const SUB_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
};

/** `.cmd` mono chip (prototype): inset on base, bd2 hairline, mono + copy. */
const CMD_CHIP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: "0 0 auto",
  background: "var(--color-base)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 6px 4px 10px",
};

const CMD_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-text)",
  fontVariantNumeric: "tabular-nums",
};

const EMPTY_PANEL_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-md)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  padding: "18px",
  color: "var(--color-text3)",
  fontSize: "13px",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// Sub-component — one queue row
// ---------------------------------------------------------------------------

function TurnRow({ item }: { item: TurnItem }): React.JSX.Element {
  const visual = KIND_VISUALS[item.kind];

  return (
    <li data-testid="tu-turno-item" style={ITEM_STYLE}>
      {/* Left + middle: navigable link (icon tile + label + sub) */}
      <Link href={item.href} data-testid="tu-turno-item-link" style={LINK_STYLE}>
        <span style={{ ...ICON_TILE_BASE, background: visual.bg, color: visual.fg }}>
          <i className={`ti ${visual.icon}`} aria-hidden="true" style={{ fontSize: "18px" }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...LABEL_STYLE, display: "block" }}>{item.label}</span>
          {visual.sub && <span style={{ ...SUB_STYLE, display: "block" }}>{visual.sub}</span>}
        </span>
      </Link>

      {/* Right: `.cmd` chip with the command + CopyButton (sibling of the Link) */}
      <span style={CMD_CHIP_STYLE}>
        <span style={CMD_TEXT_STYLE}>{item.command}</span>
        <CopyButton value={item.command} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TuTurno — the "Tu turno" hero section.
 *
 * Renders the urgency-ordered human-gate decision queue. Each row links to
 * the relevant destination and surfaces the exact /pandacorp:* command via
 * a `.cmd` chip with a CopyButton. When the queue is empty, shows a calm
 * "al día" empty state.
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
                borderRadius: "var(--radius-sm)",
                fontSize: "11px",
                fontWeight: 500,
                background: "var(--color-ok-bg)",
                color: "var(--color-ok)",
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
                borderRadius: "var(--radius-sm)",
                fontSize: "11px",
                fontWeight: 500,
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
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
            style={{ fontSize: "20px", color: "var(--color-ok)" }}
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
            gap: "8px",
          }}
        >
          {items.map((item) => (
            <TurnRow key={`${item.kind}:${item.href}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
