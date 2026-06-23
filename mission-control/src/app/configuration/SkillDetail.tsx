"use client";
/**
 * SkillDetail (CMP-07-skill-detail) — the curated, "for-dummies" detail for a single skill.
 *
 * Not a raw file dump: a plain-language explainer + an INTERACTIVE step-by-step flow graph (clickable
 * skill/agent nodes navigate to that skill/agent's own doc — a navigable graph, FRD-08) + the full
 * SKILL.md rendered as markdown (not a <pre>). The curated explainer + flow come from the hand-authored
 * lib/manual/skill-flows; if a skill has no authored flow yet, it degrades to the agent mini-flow + the
 * frontmatter description.
 *
 * Design rules (FRD-13): zero hardcoded colors; data-testid on structural elements; Spanish copy.
 * Traceability: CMP-07-skill-detail → FRD-07/FRD-08; AC-07-006.2/.3/.5.
 */

import type React from "react";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Chip } from "@/components/core/Chip/Chip";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { FlowGraph } from "@/components/modules/manual-diagrams/FlowGraph";
import { getSkillFlow } from "@/lib/manual/skill-flows";
import type { RunsIn, SkillRef } from "@/lib/reference/reference";
import { FlowDiagram } from "./FlowDiagram";

const RUNS_IN_LABEL: Record<RunsIn, string> = {
  factory: "En la fábrica",
  project: "En el proyecto",
  unknown: "Contexto no especificado",
};

// ---------------------------------------------------------------------------
// Styles — tokens only
// ---------------------------------------------------------------------------

const DETAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "8px 0",
};

const BACK_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 0",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  color: "var(--color-text3)",
  fontFamily: "inherit",
};

const NAME_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
};

const SKILL_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "1.125rem",
  fontWeight: 700,
  color: "var(--color-accent-text)",
  margin: 0,
};

const EXPLAINER_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--color-text)",
  lineHeight: 1.65,
  margin: 0,
};

const META_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 18px",
  fontSize: "12px",
  color: "var(--color-text2)",
  alignItems: "center",
};

const META_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "3px 9px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "0.5px solid var(--color-border-strong)",
  background: "var(--color-panel)",
  color: "var(--color-text2)",
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--color-accent-text)",
  margin: "0 0 10px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const DIVIDER_STYLE: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--color-border)",
  margin: 0,
};

const RAW_SUMMARY_STYLE: React.CSSProperties = {
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text2)",
  padding: "8px 0",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  userSelect: "none",
};

const PROSE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text2)",
  lineHeight: 1.7,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SkillDetailProps {
  skill: SkillRef;
  onBack: () => void;
  /** Legacy cross-nav for the fallback agent mini-flow (used only when no curated flow exists). */
  onAgentClick?: (role: AgentRole) => void;
}

export function SkillDetail({ skill, onBack, onAgentClick }: SkillDetailProps): React.JSX.Element {
  const skillName = `/pandacorp:${skill.slug}`;
  const flow = getSkillFlow(skill.slug);
  // Curated Spanish explainer wins over the (English) frontmatter description (DR-046 derive note).
  const explainer = flow?.explainer ?? skill.description;
  const runsInLabel = RUNS_IN_LABEL[flow?.runsIn ?? skill.runsIn];

  return (
    <div data-testid="skill-detail" style={DETAIL_STYLE}>
      <div>
        <button
          type="button"
          data-testid="skill-detail-back"
          style={BACK_BTN_STYLE}
          onClick={onBack}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" /> Volver a comandos
        </button>
      </div>

      {/* Header: name + copy + interno */}
      <div style={NAME_ROW_STYLE}>
        <h2 data-testid="skill-detail-name" style={SKILL_NAME_STYLE}>
          {skillName}
        </h2>
        <CopyButton value={skillName} />
        {skill.internal && (
          <span data-testid="skill-detail-internal" title="Skill interno">
            <Chip tone="secondary">interno</Chip>
          </span>
        )}
      </div>

      {/* Curated, for-dummies explainer */}
      <p data-testid="skill-detail-description" style={EXPLAINER_STYLE}>
        {explainer}
      </p>

      {/* Meta: where it runs + what it produces */}
      <div style={META_ROW_STYLE}>
        <span data-testid="skill-detail-runs-in" style={META_BADGE_STYLE}>
          <i className="ti ti-map-pin" aria-hidden="true" style={{ fontSize: "12px" }} />{" "}
          {runsInLabel}
        </span>
        {skill.produces != null && skill.produces.length > 0 && (
          <span data-testid="skill-detail-produces" style={META_BADGE_STYLE}>
            <i className="ti ti-package-export" aria-hidden="true" style={{ fontSize: "12px" }} />{" "}
            Produce: {skill.produces}
          </span>
        )}
      </div>

      <hr style={DIVIDER_STYLE} />

      {/* Interactive flow (curated) OR the legacy agent mini-flow */}
      <div data-testid="skill-detail-flow">
        <p style={SECTION_LABEL_STYLE}>
          <i className="ti ti-route" aria-hidden="true" style={{ fontSize: "13px" }} /> Cómo
          funciona, paso a paso
        </p>
        {flow !== undefined ? (
          <FlowGraph flow={flow} />
        ) : (
          <>
            <p style={{ fontSize: "12px", color: "var(--color-text3)", margin: "0 0 8px" }}>
              Agentes que invoca:
            </p>
            <FlowDiagram body={skill.body} onAgentClick={onAgentClick} />
          </>
        )}
      </div>

      <hr style={DIVIDER_STYLE} />

      {/* Full SKILL.md — rendered markdown, collapsed by default */}
      <details data-testid="skill-detail-body">
        <summary style={RAW_SUMMARY_STYLE}>
          <i className="ti ti-file-text" aria-hidden="true" style={{ fontSize: "13px" }} /> Ver el
          SKILL.md completo
        </summary>
        <div className="doc" style={PROSE_STYLE}>
          <Markdown>{skill.body}</Markdown>
        </div>
      </details>
    </div>
  );
}
