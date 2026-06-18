"use client";

/**
 * WO-07-008 — Decision rules section: list + detail (CMP-07-rules-list, CMP-07-rule-detail)
 *
 * Client Component: owns the selected-rule state and renders:
 *   1. A short intro explaining what a decision rule IS (AC-07-008.1).
 *   2. ALL decision rules with an auto-approves (●) / asks-you (●) indicator paired
 *      with a label (not color alone, FRD-13 a11y) (AC-07-008.2).
 *   3. WHEN the owner clicks a rule, the detail shows the pre-approved default and
 *      how it is applied (escalates to you vs auto-applied + CI/hook) (AC-07-008.3).
 *   4. A "New decision rule" button that copies /pandacorp:learn (reuses CopyButton);
 *      does NOT execute anything (architecture §1) (AC-07-008.4).
 *
 * Props-down pattern: the Server Component (ConfigurationShell / page) passes
 * `rules` as a prop so filesystem reads remain server-side (architecture §3).
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on all interactive and verifiable elements.
 *   - Spanish copy (architecture §7).
 *
 * Traceability:
 *   CMP-07-rules-list, CMP-07-rule-detail → FRD-07
 *   AC-07-008.1, AC-07-008.2, AC-07-008.3, AC-07-008.4
 *   Reuses CopyButton (FRD-02, CMP-02-copy-button).
 */

import { useState } from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { DecisionRule } from "@/lib/registry/registry";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
};

const HEADER_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  flexWrap: "wrap",
};

const INTRO_BLOCK_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flex: 1,
};

const INTRO_TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const INTRO_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text-muted, currentColor)",
  lineHeight: 1.6,
  margin: 0,
  maxWidth: "60ch",
};

const NEW_RULE_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexShrink: 0,
};

const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
  padding: "calc(var(--spacing, 0.25rem) * 4) 0",
};

function ruleItemStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "calc(var(--spacing, 0.25rem) * 2)",
    padding: "calc(var(--spacing, 0.25rem) * 4)",
    borderRadius: "var(--radius, 0.5rem)",
    border: selected
      ? "1px solid var(--color-accent, currentColor)"
      : "1px solid var(--color-border, currentColor)",
    background: selected ? "var(--color-surface-raised, Canvas)" : "var(--color-surface, Canvas)",
    cursor: "pointer",
    transition:
      "border-color var(--duration-fast, 150ms) var(--easing-standard, ease), background var(--duration-fast, 150ms) var(--easing-standard, ease)",
  };
}

const RULE_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const RULE_ID_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  minWidth: "3.5rem",
};

const RULE_PATRON_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  flex: 1,
};

function indicatorStyle(auto: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 1.5)",
    padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
    border: auto
      ? "1px solid var(--color-success, currentColor)"
      : "1px solid var(--color-warning, currentColor)",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: auto ? "var(--color-success, currentColor)" : "var(--color-warning, currentColor)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

const DOT_STYLE: React.CSSProperties = {
  fontSize: "0.6rem",
  lineHeight: 1,
};

// ---------------------------------------------------------------------------
// Detail panel styles
// ---------------------------------------------------------------------------

const DETAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 5)",
  borderRadius: "var(--radius, 0.5rem)",
  border: "1px solid var(--color-accent, currentColor)",
  background: "var(--color-surface-raised, Canvas)",
};

const DETAIL_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "var(--color-text-muted, currentColor)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const DETAIL_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

const DETAIL_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
};

const DETAIL_VALUE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
};

function modeStyle(auto: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 2)",
    padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
    borderRadius: "var(--radius, 0.5rem)",
    border: auto
      ? "1px solid var(--color-success, currentColor)"
      : "1px solid var(--color-warning, currentColor)",
    background: "transparent",
    fontSize: "0.8125rem",
    color: auto ? "var(--color-success, currentColor)" : "var(--color-warning, currentColor)",
  };
}

const NOTA_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
  lineHeight: 1.5,
  borderLeft: "2px solid var(--color-border, currentColor)",
  paddingLeft: "calc(var(--spacing, 0.25rem) * 3)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RuleIndicatorProps {
  ruleId: string;
  auto: boolean;
}

function RuleIndicator({ ruleId, auto }: RuleIndicatorProps): React.JSX.Element {
  // Use role="img" so aria-label is valid on a span (biome a11y: useAriaPropsSupportedByRole)
  return (
    <span
      role="img"
      data-testid={`rule-indicator-${ruleId}`}
      data-indicator={auto ? "auto" : "human"}
      style={indicatorStyle(auto)}
      aria-label={auto ? "Se aprueba automáticamente" : "Requiere tu aprobación"}
    >
      {/* ● dot — shape + color */}
      <span style={DOT_STYLE} aria-hidden="true">
        ●
      </span>
      {/* Label — paired with shape so state is never conveyed by color alone (FRD-13) */}
      <span data-testid={`rule-indicator-label-${ruleId}`}>
        {auto ? "Auto-aprueba" : "Te consulta"}
      </span>
    </span>
  );
}

interface RuleDetailProps {
  rule: DecisionRule;
}

function RuleDetail({ rule }: RuleDetailProps): React.JSX.Element {
  const isAuto = !rule.requiereHumano;

  return (
    <div data-testid="rule-detail" style={DETAIL_STYLE}>
      {/* Header */}
      <div style={DETAIL_SECTION_STYLE}>
        <h3 style={DETAIL_TITLE_STYLE}>{rule.id}</h3>
        <p style={DETAIL_VALUE_STYLE}>{rule.patron}</p>
      </div>

      {/* Pre-approved default (AC-07-008.3) */}
      <div style={DETAIL_SECTION_STYLE}>
        <span style={DETAIL_LABEL_STYLE}>Default pre-aprobado</span>
        <p data-testid="rule-detail-default" style={DETAIL_VALUE_STYLE}>
          {rule.default}
        </p>
      </div>

      {/* How it is applied (AC-07-008.3) */}
      <div style={DETAIL_SECTION_STYLE}>
        <span style={DETAIL_LABEL_STYLE}>Cómo se aplica</span>
        <span
          data-testid="rule-detail-mode"
          data-mode={isAuto ? "auto" : "human"}
          style={modeStyle(isAuto)}
        >
          <span aria-hidden="true">●</span>
          {isAuto
            ? "Se aplica automáticamente — verificado por script/hook/CI"
            : "Escala al owner — requiere aprobación explícita antes de continuar"}
        </span>
      </div>

      {/* Optional nota (shown only when present) */}
      {rule.nota !== undefined && (
        <div style={DETAIL_SECTION_STYLE}>
          <span style={DETAIL_LABEL_STYLE}>Nota</span>
          <p data-testid="rule-detail-nota" style={NOTA_STYLE}>
            {rule.nota}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DecisionRulesSectionProps {
  /** All decision rules from readDecisionRules(). Passed from the Server Component. */
  rules: DecisionRule[];
}

// ---------------------------------------------------------------------------
// DecisionRulesSection — main export (CMP-07-rules-list + CMP-07-rule-detail)
// ---------------------------------------------------------------------------

/**
 * DecisionRulesSection — "use client" component for the Decision rules tab.
 *
 * Owns the selectedRuleId state. Renders intro, list, optional detail, and
 * the "New decision rule" CopyButton.
 */
export function DecisionRulesSection({ rules }: DecisionRulesSectionProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleRuleClick(id: string): void {
    // Toggle: click same rule again → close detail (AC-07-008.3)
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div data-testid="rules-section" style={SECTION_STYLE}>
      {/* Header row: intro + "New decision rule" button */}
      <div style={HEADER_ROW_STYLE}>
        {/* AC-07-008.1 — short intro explaining what a decision rule IS */}
        <div style={INTRO_BLOCK_STYLE}>
          <h2 style={INTRO_TITLE_STYLE}>Reglas de decisión</h2>
          <p data-testid="rules-intro" style={INTRO_TEXT_STYLE}>
            Una <strong>regla de decisión</strong> es una política pre-aprobada de la fábrica:
            define cómo actuar ante una situación recurrente sin tener que preguntarte cada vez. Las
            reglas con indicador <strong>Auto-aprueba</strong> se aplican automáticamente
            (verificadas por script/hook/CI); las que dicen <strong>Te consulta</strong> escalan al
            owner y bloquean hasta que apruebes. Están definidas en{" "}
            <code>factory/decisions/registry.yaml</code> — para cambiarlas, edita el archivo.
          </p>
        </div>

        {/* AC-07-008.4 — "New decision rule" button copies /pandacorp:learn (no exec) */}
        <div data-testid="rules-new-rule-btn" style={NEW_RULE_BTN_STYLE}>
          <CopyButton value="/pandacorp:learn" label="Nueva regla de decisión" />
        </div>
      </div>

      {/* AC-07-008.2 — Rule list */}
      <ul data-testid="rules-list" style={LIST_STYLE}>
        {rules.length === 0 && (
          <li>
            <p data-testid="rules-empty" style={EMPTY_STYLE}>
              No se encontraron reglas de decisión. Verifica que{" "}
              <code>factory/decisions/registry.yaml</code> exista y tenga entradas válidas.
            </p>
          </li>
        )}
        {rules.map((rule) => {
          const isSelected = rule.id === selectedId;
          const isAuto = !rule.requiereHumano;
          return (
            <li key={rule.id}>
              <button
                type="button"
                data-testid={`rule-item-${rule.id}`}
                data-auto={isAuto ? "true" : "false"}
                data-selected={isSelected ? "true" : "false"}
                aria-expanded={isSelected}
                aria-pressed={isSelected}
                style={ruleItemStyle(isSelected)}
                onClick={() => {
                  handleRuleClick(rule.id);
                }}
              >
                <div style={RULE_HEADER_STYLE}>
                  {/* Rule id */}
                  <span style={RULE_ID_STYLE}>{rule.id}</span>

                  {/* Pattern (what situation triggers this rule) */}
                  <span style={RULE_PATRON_STYLE}>{rule.patron}</span>

                  {/* Indicator: auto-approves or asks-you (shape + label, not color alone) */}
                  <RuleIndicator ruleId={rule.id} auto={isAuto} />
                </div>
              </button>

              {/* Detail panel — shown inline below the selected rule */}
              {isSelected && <RuleDetail rule={rule} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
