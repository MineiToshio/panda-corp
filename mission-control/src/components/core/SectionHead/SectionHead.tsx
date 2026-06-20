/**
 * WO-13-006 — SectionHead (CMP-13-sectionhead, DR-062)
 *
 * THE one section header primitive. Reused on every surface's section dividers.
 * No bespoke per-screen section header — a second secthead is a DR-062 defect.
 *
 * Layout (from prototype `secthead()` function, line ~453):
 *   [optional icon] label [trailing 1px rule] [optional count / rightHtml]
 *
 * Props:
 *   label      — Section heading text (required)
 *   count?     — Optional numeric count shown right of the rule
 *   icon?      — Optional Tabler icon class, e.g. "ti-flame"
 *   rightHtml? — Optional arbitrary React node placed after the rule (overrides count)
 *
 * Tokens: all styling via CSS custom properties — zero hardcoded colors.
 *
 * Traceability:
 *   CMP-13-sectionhead → FRD-13
 *   AC-13-006.8..14
 */

import type React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SectionHeadProps {
  /** Section label text (e.g. "Tu turno", "Pulso de la fábrica"). */
  label: string;
  /** Optional numeric count displayed after the trailing rule. */
  count?: number;
  /** Optional Tabler icon class (e.g. "ti-flame"). Rendered at 15px accent-text. */
  icon?: string;
  /** Optional arbitrary content placed after the trailing rule (overrides count). */
  rightHtml?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (AC-13-006.14)
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--color-text2)",
  margin: "22px 2px 11px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
};

/** The trailing 1px horizontal rule (`.ln` in the prototype). */
const RULE_STYLE: React.CSSProperties = {
  flex: 1,
  height: "1px",
  background: "var(--color-border)",
};

const COUNT_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  fontVariantNumeric: "tabular-nums",
};

const ICON_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--color-accent-text)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SectionHead — THE one section header (DR-062).
 *
 * Render pattern: [icon?] label [trailing rule] [count? | rightHtml?]
 * Matches the prototype's `.secthead` class exactly.
 */
export function SectionHead({
  label,
  count,
  icon,
  rightHtml,
}: SectionHeadProps): React.JSX.Element {
  return (
    <div data-testid="section-head" style={ROOT_STYLE}>
      {/* Optional leading icon (AC-13-006.11) */}
      {icon != null && <i className={`ti ${icon}`} style={ICON_STYLE} aria-hidden="true" />}

      {/* Label text (AC-13-006.8) */}
      <span>{label}</span>

      {/* Trailing 1px rule — the .ln separator (AC-13-006.9) */}
      <span data-testid="section-head-rule" aria-hidden="true" style={RULE_STYLE} />

      {/* Right slot: arbitrary rightHtml OR numeric count (AC-13-006.10 / 13-006.12) */}
      {rightHtml != null ? (
        <span data-testid="section-head-right">{rightHtml}</span>
      ) : count != null ? (
        <span data-testid="section-head-count" style={COUNT_STYLE}>
          {count}
        </span>
      ) : null}
    </div>
  );
}
