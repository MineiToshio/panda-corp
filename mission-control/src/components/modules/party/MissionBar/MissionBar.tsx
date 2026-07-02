/**
 * CMP-13-party-mission-bar — Shared pixel-RPG MissionBar (.quest) (WO-13-009, FND-4)
 *
 * The Misión strip: label + FRD pips + global WO counter (tabular-nums) +
 * ⚙️ esfuerzo · <effort> as READ-ONLY DATA (DR-061, REQ-06-012.3).
 *
 * Design contract (party mocks / la-fragua.html .quest):
 *   - flex row, panel bg, bd border, radius 12px, padding 9px 14px
 *   - .qlbl: pixel font 13px, text3 color, margin-right 12px
 *   - .frdpip: mono 12px, border-radius 20px; states: done (ok), cur (accent), default (bd2)
 *   - .frdarrow: text3, mono, opacity .5 separators between pips
 *   - .proj (counter): margin-left auto, mono 11px, text3; b.done = ok color
 *   - .esf (effort): mono 11px, accent-text, left border bd2 separator
 *   - tabular-nums on the WO counter
 *   - effort is a plain text element (never button/input/select) — DR-061
 *
 * Tokens only. Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-012.3 / DR-061
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FrdPipState = "done" | "current" | "pending";

interface FrdPip {
  id: string;
  state: FrdPipState;
}

export interface MissionBarProps {
  /** Plain summary shown after the label when there are no pips (e.g. "18/21 FRDs"). */
  summary?: string;
  /** FRD pipeline pips (done / current / pending). */
  frdPips: readonly FrdPip[];
  /** WOs completed globally (tabular-nums counter). */
  done: number;
  /** Total WOs globally. */
  total: number;
  /**
   * Build effort mode (read-only data per DR-061 — displayed, never selectable).
   * e.g. "pro" | "equilibrado" | "potente" | "profundo"
   */
  effort: string;
}

// ---------------------------------------------------------------------------
// Pip style by state
// ---------------------------------------------------------------------------

function pipStyle(state: FrdPipState): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    padding: "3px 9px",
    borderRadius: "20px",
    border: "1px solid transparent",
  };
  switch (state) {
    case "done":
      return { ...base, color: "var(--color-ok)" };
    case "current":
      return {
        ...base,
        color: "var(--color-accent-text)",
        background: "var(--color-accent-bg)",
        borderColor: "var(--color-accent)",
      };
    default:
      return { ...base, color: "var(--color-text3)" };
  }
}

function dotStyle(state: FrdPipState): CSSProperties {
  const base: CSSProperties = {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    flex: "0 0 auto",
  };
  switch (state) {
    case "done":
      return { ...base, background: "var(--color-ok)", boxShadow: "0 0 6px var(--color-ok)" };
    case "current":
      return {
        ...base,
        background: "var(--color-accent)",
        boxShadow: "0 0 8px var(--color-accent)",
      };
    default:
      return { ...base, background: "var(--color-border-strong)" };
  }
}

// ---------------------------------------------------------------------------
// Static styles
// ---------------------------------------------------------------------------

const ROOT_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  background: "var(--color-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "9px 14px",
  flexWrap: "wrap",
};

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: "13px",
  color: "var(--color-text3)",
  marginRight: "12px",
};

const ARROW_STYLE: CSSProperties = {
  color: "var(--color-text3)",
  fontFamily: "var(--font-mono)",
  margin: "0 3px",
  opacity: 0.5,
};

const COUNTER_STYLE: CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text3)",
};

const EFFORT_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  color: "var(--color-accent-text)",
  marginLeft: "11px",
  paddingLeft: "11px",
  borderLeft: "1px solid var(--color-border-strong)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MissionBar — the Misión quest strip.
 * Shows FRD pipeline pips, global WO counter, and effort as read-only data.
 * DR-061: effort is a text surface, never a control.
 *
 * @param props.frdPips - FRD pipeline pips
 * @param props.done    - completed WO count
 * @param props.total   - total WO count
 * @param props.effort  - build effort label (read-only)
 */
export function MissionBar({
  frdPips,
  done,
  total,
  effort,
  summary,
}: MissionBarProps): React.JSX.Element {
  return (
    <div data-testid="mission-bar-root" style={ROOT_STYLE}>
      {/* Misión label */}
      <span data-testid="mission-bar-label" style={LABEL_STYLE}>
        Misión
      </span>

      {/* Global-wave summary (v2): plain read-only text — the per-FRD detail lives
          in the Campaña strip below (owner, 2026-07-02: the strip looked empty). */}
      {summary !== undefined && frdPips.length === 0 && (
        <span
          data-testid="mission-bar-summary"
          style={{ color: "var(--color-text-muted, currentColor)", fontSize: "12px" }}
        >
          {summary}
        </span>
      )}

      {/* FRD pips with arrow separators */}
      {frdPips.map((pip, i) => (
        <span key={pip.id} style={{ display: "inline-flex", alignItems: "center" }}>
          <span
            data-testid={`mission-bar-pip-${pip.id}`}
            data-state={pip.state}
            style={pipStyle(pip.state)}
          >
            <span aria-hidden="true" style={dotStyle(pip.state)} />
            {pip.id}
          </span>
          {i < frdPips.length - 1 && (
            <span data-testid="mission-bar-arrow" aria-hidden="true" style={ARROW_STYLE}>
              →
            </span>
          )}
        </span>
      ))}

      {/* Global WO counter (tabular-nums) */}
      <span data-testid="mission-bar-counter" style={COUNTER_STYLE}>
        <b style={{ color: "var(--color-ok)" }}>{done}</b>/{total} WO
      </span>

      {/* Effort — read-only data (DR-061) */}
      <span data-testid="mission-bar-effort" style={EFFORT_STYLE}>
        <span aria-hidden="true">⚙</span> esfuerzo · {effort}
      </span>
    </div>
  );
}
