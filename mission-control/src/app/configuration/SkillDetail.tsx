"use client";
/**
 * WO-07-006 — SkillDetail (CMP-07-skill-detail)
 *
 * Detail view for a single skill: what it is for, where it runs,
 * what it produces, and the mini-flow diagram of agent chips.
 *
 * AC-07-006.2: shows purpose, where it runs (factory/project), what it produces.
 * AC-07-006.3: embeds FlowDiagram (agent chips colored per FRD-13 tokens).
 * AC-07-006.5: read-only — no edit affordance.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - Zero hardcoded colors — CSS custom properties only.
 *   - data-testid on every structural element.
 *   - Spanish copy.
 *
 * Traceability:
 *   CMP-07-skill-detail → FRD-07
 *   AC-07-006.2, AC-07-006.3, AC-07-006.5
 */

import type React from "react";

import type { RunsIn, SkillRef } from "@/lib/reference";
import { FlowDiagram } from "./FlowDiagram";

// ---------------------------------------------------------------------------
// runsIn → Spanish label
// ---------------------------------------------------------------------------

const RUNS_IN_LABEL: Record<RunsIn, string> = {
  factory: "En la fábrica",
  project: "En el proyecto",
  unknown: "Contexto no especificado",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const DETAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 5)",
  padding: "calc(var(--spacing, 0.25rem) * 2) 0",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const BACK_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 1.5) 0",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  fontFamily: "inherit",
};

const SKILL_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "1.125rem",
  fontWeight: 700,
  color: "var(--color-accent, currentColor)",
  margin: 0,
};

const DESCRIPTION_STYLE: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.6,
  margin: 0,
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  margin: 0,
  marginBottom: "calc(var(--spacing, 0.25rem) * 1)",
};

const RUNS_IN_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2.5)",
  borderRadius: "var(--radius, 0.375rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  background: "var(--color-surface-raised, Canvas)",
};

const BODY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
};

const DIVIDER_STYLE: React.CSSProperties = {
  border: "none",
  borderTop: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  opacity: 0.4,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillDetailProps {
  /** The skill to render. */
  skill: SkillRef;
  /** Called when the user clicks the back button. */
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// SkillDetail component (CMP-07-skill-detail)
// ---------------------------------------------------------------------------

/**
 * Read-only detail view for a single skill.
 *
 * Shows:
 *   - Back button
 *   - Skill name as /pandacorp:<slug>
 *   - Description (what it is for)
 *   - Where it runs (runsIn → Spanish label)
 *   - Mini-flow (FlowDiagram — agent chips colored per FRD-13 tokens)
 *   - Body content (raw markdown text)
 *
 * No edit affordance anywhere (AC-07-006.5).
 */
export function SkillDetail({ skill, onBack }: SkillDetailProps): React.JSX.Element {
  const skillName = `/pandacorp:${skill.slug}`;
  const runsInLabel = RUNS_IN_LABEL[skill.runsIn];

  return (
    <div data-testid="skill-detail" style={DETAIL_STYLE}>
      {/* Back button */}
      <div>
        <button
          type="button"
          data-testid="skill-detail-back"
          style={BACK_BTN_STYLE}
          onClick={onBack}
        >
          ← Volver a habilidades
        </button>
      </div>

      {/* Header: name + description */}
      <div style={HEADER_STYLE}>
        <h2 data-testid="skill-detail-name" style={SKILL_NAME_STYLE}>
          {skillName}
        </h2>
        <p data-testid="skill-detail-description" style={DESCRIPTION_STYLE}>
          {skill.description}
        </p>
      </div>

      <hr style={DIVIDER_STYLE} />

      {/* Where it runs */}
      <div>
        <p style={SECTION_LABEL_STYLE}>Dónde se ejecuta</p>
        <span data-testid="skill-detail-runs-in" style={RUNS_IN_BADGE_STYLE}>
          {runsInLabel}
        </span>
      </div>

      {/* Mini-flow: agent chips */}
      <div data-testid="skill-detail-flow">
        <p style={SECTION_LABEL_STYLE}>Agentes que usa (flujo)</p>
        <FlowDiagram body={skill.body} />
      </div>

      <hr style={DIVIDER_STYLE} />

      {/* Body content */}
      <div data-testid="skill-detail-body">
        <p style={SECTION_LABEL_STYLE}>Descripción completa</p>
        <pre style={BODY_STYLE}>{skill.body}</pre>
      </div>
    </div>
  );
}
