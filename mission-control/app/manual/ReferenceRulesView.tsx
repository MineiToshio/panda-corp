"use client";
/**
 * app/manual/ReferenceRulesView.tsx — WO-08-004 (CMP-08-reference-rules)
 *
 * Reference catalog view for decision rules, derived at render time from
 * readDecisionRules() — never a hand-maintained array (DR-046).
 *
 * Receives the pre-read DecisionRule[] as props (server reads happen in
 * page.tsx; this is a pure presentation component).
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish UI copy and aria-labels.
 *   - data-testid on every interactive / structural element.
 *   - requiereHumano indicator MUST be a text label, NOT color alone (AC-08-004.1).
 *
 * Traceability:
 *   CMP-08-reference-rules → AC-08-004.1, AC-08-004.3, AC-08-004.5
 *   DR-046: derived from readDecisionRules(), not hand-copied.
 */

import type React from "react";
import type { DecisionRule } from "@/lib/registry";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceRulesViewProps {
  /** Rules derived from readDecisionRules(). Never a hand-maintained array. */
  rules: DecisionRule[];
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

const ITEM_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  marginBottom: "calc(var(--space-base, 1rem) * 0.5)",
  flexWrap: "wrap",
};

const ITEM_ID_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.9375rem",
  color: "var(--color-accent, currentColor)",
};

const INDICATOR_AUTO_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "color-mix(in oklch, var(--color-accent, currentColor) 15%, transparent)",
  color: "var(--color-accent, currentColor)",
};

const INDICATOR_HUMAN_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "color-mix(in oklch, var(--color-text, currentColor) 12%, transparent)",
  color: "var(--color-text, currentColor)",
};

const FIELD_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.85,
  margin: "0 0 calc(var(--space-base, 1rem) * 0.25) 0",
  lineHeight: 1.5,
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 600,
  opacity: 1,
};

const NOTA_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.6,
  fontStyle: "italic",
  marginTop: "calc(var(--space-base, 1rem) * 0.375)",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  padding: "calc(var(--space-base, 1rem) * 2) 0",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// ReferenceRulesView
// ---------------------------------------------------------------------------

/**
 * Renders all decision rules as a catalog. The requiereHumano indicator is
 * ALWAYS a visible text label (plus a data attribute), not color alone — AC-08-004.1.
 *
 * DR-046: this component takes its data from readDecisionRules() (via props);
 * there is no hand-maintained rule list here.
 */
export function ReferenceRulesView({ rules }: ReferenceRulesViewProps): React.JSX.Element {
  return (
    <div data-testid="reference-rules-view" style={ROOT_STYLE}>
      <h2 style={HEADING_STYLE}>Reglas de decisión</h2>

      {rules.length === 0 ? (
        <div data-testid="reference-rules-empty" style={EMPTY_STYLE}>
          No se encontraron reglas en el registro de decisiones.
        </div>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de reglas de decisión">
          {rules.map((rule) => (
            <li key={rule.id} data-testid={`reference-rule-${rule.id}`} style={ITEM_STYLE}>
              {/* Header: id + requiereHumano indicator */}
              <div style={ITEM_HEADER_STYLE}>
                <span style={ITEM_ID_STYLE}>{rule.id}</span>

                {/* AC-08-004.1: text label (not color alone) + data attribute */}
                <span
                  data-testid={`rule-indicator-${rule.id}`}
                  data-requires-human={String(rule.requiereHumano)}
                  style={rule.requiereHumano ? INDICATOR_HUMAN_STYLE : INDICATOR_AUTO_STYLE}
                >
                  {rule.requiereHumano ? "Requiere humano" : "Auto-aprobado"}
                </span>
              </div>

              {/* Patron */}
              <p style={FIELD_STYLE}>
                <span style={FIELD_LABEL_STYLE}>Patrón: </span>
                {rule.patron}
              </p>

              {/* Default */}
              <p style={FIELD_STYLE}>
                <span style={FIELD_LABEL_STYLE}>Por defecto: </span>
                {rule.default}
              </p>

              {/* Nota — only when present */}
              {rule.nota !== undefined && (
                <p data-testid={`rule-nota-${rule.id}`} style={NOTA_STYLE}>
                  {rule.nota}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
