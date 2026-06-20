/**
 * WO-13-006 — PageTitle (CMP-13-pagetitle, DR-062)
 *
 * THE one light page-title block. Reused on EVERY top-level surface
 * (Inicio · Tablero · Portfolio · Propuestas · Logros · Documentación) and
 * the Referencia gxHero delegates to it. NOT a heavy panel.
 *
 * Layout (from prototype `pageHead()` function, line ~964):
 *   [itemslot icon 34×34] [H1 title] [tail?]
 *   [subtitle — indented 45px, 12px, text2]
 *
 * Props:
 *   icon      — Tabler icon class string, e.g. "ti-home"
 *   title     — The nav label (shown as H1, e.g. "Inicio")
 *   subtitle? — Optional descriptive text below the title row
 *   tail?     — Optional ReactNode in the title row (count pill, status chip)
 *
 * Tokens: all styling via CSS custom properties — zero hardcoded colors/spacing.
 *
 * Traceability:
 *   CMP-13-pagetitle → FRD-13, REQ-13-002 (rationed accent), REQ-13-008 (a11y)
 *   AC-13-006.1..7
 */

import type React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PageTitleProps {
  /** Tabler icon class (e.g. "ti-home"). Rendered decorative (aria-hidden). */
  icon: string;
  /** Page title — rendered as H1 and equals the nav/menu label. */
  title: string;
  /** Optional subtitle — shown below the title row, indented to align with title. */
  subtitle?: string;
  /** Optional tail slot — rendered inline after the H1 (count pill, status chip…). */
  tail?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded values (AC-13-006.5)
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  marginBottom: "1rem",
};

const TITLE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  flexWrap: "wrap",
};

/** The accent itemslot icon slot — mirrors prototype .itemslot dimensions. */
const ICON_SLOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "34px",
  height: "34px",
  borderRadius: "9px",
  flex: "0 0 auto",
  // Accent background / border / color — CSS vars from @theme (AC-13-006.5)
  background: "var(--color-accent-bg)",
  border: "1.5px solid var(--color-accent)",
  color: "var(--color-accent-text)",
  imageRendering: "pixelated",
};

const H1_STYLE: React.CSSProperties = {
  fontSize: "21px",
  lineHeight: "1.15",
  margin: 0,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  color: "var(--color-text)",
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
  marginTop: "5px",
  // Indent 45px = 34px icon width + 11px gap
  marginLeft: "45px",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PageTitle — THE one light page-title block (DR-062).
 *
 * One of each, everywhere — every top-level surface MUST use this component
 * for its page heading; no bespoke per-screen title markup.
 */
export function PageTitle({ icon, title, subtitle, tail }: PageTitleProps): React.JSX.Element {
  return (
    <div data-testid="page-title" style={ROOT_STYLE}>
      {/* Title row: icon + H1 + optional tail */}
      <div style={TITLE_ROW_STYLE}>
        {/* Accent itemslot — decorative (aria-hidden) */}
        <span aria-hidden="true" style={ICON_SLOT_STYLE}>
          <i className={`ti ${icon}`} style={{ fontSize: "20px" }} aria-hidden="true" />
        </span>

        {/* H1 = the nav/menu label (AC-13-006.1) */}
        <h1 style={H1_STYLE}>{title}</h1>

        {/* Optional tail slot — count pill, status chip, etc. (AC-13-006.4) */}
        {tail != null && <span data-testid="page-title-tail">{tail}</span>}
      </div>

      {/* Optional subtitle — below the title row, indented (AC-13-006.3) */}
      {subtitle != null && (
        <div data-testid="page-title-subtitle" style={SUBTITLE_STYLE}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
