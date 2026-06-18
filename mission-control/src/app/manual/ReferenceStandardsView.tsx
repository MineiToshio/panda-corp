"use client";
/**
 * app/manual/ReferenceStandardsView.tsx — WO-08-004 (CMP-08-reference-standards)
 *
 * Reference catalog view for factory standards, derived at render time from
 * readStandards() — never a hand-maintained array (DR-046).
 *
 * Receives the pre-read Standard[] as props (server reads happen in page.tsx;
 * this is a pure presentation component).
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish UI copy and aria-labels.
 *   - data-testid on every structural / badge element.
 *   - domain / severity / enforcement shown as labelled badges (AC-08-004.2).
 *   - structure.md (DR-049) is picked up automatically — no special-casing (AC-08-004.4).
 *
 * Traceability:
 *   CMP-08-reference-standards → AC-08-004.2, AC-08-004.3, AC-08-004.4, AC-08-004.5
 *   DR-046: derived from readStandards(), not hand-copied.
 */

import type React from "react";
import type { Standard } from "@/lib/standards/standards";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceStandardsViewProps {
  /** Standards derived from readStandards(). Never a hand-maintained array. */
  standards: Standard[];
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  width: "100%",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  marginBottom: "var(--space-base, 1rem)",
  color: "var(--color-text, currentColor)",
  borderBottom:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 15%, transparent)",
  paddingBottom: "calc(var(--space-base, 1rem) * 0.5)",
};

const LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
};

const ITEM_STYLE: React.CSSProperties = {
  padding: "calc(var(--space-base, 1rem) * 0.875) var(--space-base, 1rem)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "color-mix(in oklch, var(--color-text, currentColor) 5%, transparent)",
  border:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
};

const ITEM_TITLE_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.9375rem",
  color: "var(--color-accent, currentColor)",
  marginBottom: "calc(var(--space-base, 1rem) * 0.5)",
};

const BADGES_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  marginBottom: "calc(var(--space-base, 1rem) * 0.5)",
};

/** Base badge style — accent-tinted. Override per badge type below. */
const BADGE_BASE_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
};

const BADGE_SEVERITY_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  background: "color-mix(in oklch, var(--color-accent, currentColor) 20%, transparent)",
  color: "var(--color-accent, currentColor)",
};

const BADGE_DOMAIN_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  background: "color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
  color: "var(--color-text, currentColor)",
};

const BADGE_ENFORCEMENT_STYLE: React.CSSProperties = {
  ...BADGE_BASE_STYLE,
  background: "color-mix(in oklch, var(--color-text, currentColor) 8%, transparent)",
  color: "var(--color-text, currentColor)",
};

const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.8,
  margin: 0,
  lineHeight: 1.5,
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  padding: "calc(var(--space-base, 1rem) * 2) 0",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// ReferenceStandardsView
// ---------------------------------------------------------------------------

/**
 * Renders all factory standards as a catalog.
 * Each entry shows: title, domain badge, severity badge, enforcement badge,
 * and the first summary point.
 *
 * AC-08-004.4: structure.md (DR-049) is rendered like any other standard —
 * there is no special-case for any filename. The loop is uniform.
 *
 * DR-046: this component takes its data from readStandards() (via props);
 * there is no hand-maintained standards list here.
 */
export function ReferenceStandardsView({
  standards,
}: ReferenceStandardsViewProps): React.JSX.Element {
  return (
    <div data-testid="reference-standards-view" style={ROOT_STYLE}>
      <h2 style={HEADING_STYLE}>Estándares</h2>

      {standards.length === 0 ? (
        <div data-testid="reference-standards-empty" style={EMPTY_STYLE}>
          No se encontraron estándares en la fábrica.
        </div>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de estándares de la fábrica">
          {standards.map((std) => (
            <li key={std.id} data-testid={`reference-standard-${std.id}`} style={ITEM_STYLE}>
              {/* Title */}
              <div style={ITEM_TITLE_STYLE}>{std.title}</div>

              {/* Badges row: severity + domain + enforcement (AC-08-004.2) */}
              <div style={BADGES_ROW_STYLE}>
                <span
                  data-testid={`standard-severity-${std.id}`}
                  data-severity={std.severity}
                  style={BADGE_SEVERITY_STYLE}
                >
                  {std.severity}
                </span>
                <span
                  data-testid={`standard-domain-${std.id}`}
                  data-domain={std.domain}
                  style={BADGE_DOMAIN_STYLE}
                >
                  {std.domain}
                </span>
                <span
                  data-testid={`standard-enforcement-${std.id}`}
                  data-enforcement={std.enforcement}
                  style={BADGE_ENFORCEMENT_STYLE}
                >
                  {std.enforcement}
                </span>
              </div>

              {/* Summary — first point when available */}
              {std.summary.length > 0 && <p style={SUMMARY_STYLE}>{std.summary[0]}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
