"use client";
/**
 * app/manual/ReferenceAgentsSection.tsx — WO-08-003 (CMP-08-reference-agents)
 *
 * Reference: agents catalog, derived from readAgents() via the FRD-07 reader.
 * DR-046 core: this component accepts `agents` as a prop (server-side reads by
 * page.tsx) — no hand-maintained catalog array exists here or in any Manual file.
 *
 * Each agent row shows:
 *   - name (or id as fallback when name is null)
 *   - description
 *   - model badge (only when model !== "unknown")
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish labels/aria-labels.
 *   - data-testid on the root and on every data element.
 *
 * Traceability:
 *   CMP-08-reference-agents → AC-08-003.2, AC-08-003.4, AC-08-003.5
 *   DR-046 → AC-08-003.3
 */

import type React from "react";
import type { AgentRef } from "@/lib/reference/reference";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceAgentsSectionProps {
  /**
   * Agents catalog derived from readAgents() at render time.
   * Passed down from the Server Component (page.tsx) — no fs access here.
   * DR-046: this prop IS the derivation; no static array allowed.
   */
  agents: AgentRef[];
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-base, 1rem)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  margin: 0,
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
  padding: "calc(var(--space-base, 1rem) * 0.75) var(--space-base, 1rem)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "color-mix(in oklch, var(--color-text, currentColor) 5%, transparent)",
  border:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
};

const NAME_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  flexWrap: "wrap",
};

const NAME_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.9375rem",
  color: "var(--color-accent, currentColor)",
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.8,
  margin: 0,
};

const MODEL_BADGE_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "color-mix(in oklch, var(--color-accent, currentColor) 20%, transparent)",
  color: "var(--color-accent, currentColor)",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  fontStyle: "italic",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferenceAgentsSection({ agents }: ReferenceAgentsSectionProps): React.JSX.Element {
  return (
    <div data-testid="reference-agents-section" style={SECTION_STYLE}>
      <h2 style={HEADING_STYLE}>Agentes (Party)</h2>

      {agents.length === 0 ? (
        <p style={EMPTY_STYLE} data-testid="reference-agents-empty">
          No se encontraron agentes en el plugin.
        </p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de agentes del plugin">
          {agents.map((agent) => {
            const displayName = agent.name ?? agent.id;
            return (
              <li key={agent.id} style={ITEM_STYLE} data-testid={`reference-agent-${agent.id}`}>
                <div style={NAME_ROW_STYLE}>
                  {/* Agent name — from frontmatter `name`, falls back to id (AC-08-003.2) */}
                  <span style={NAME_STYLE}>{displayName}</span>

                  {/* Model badge — only when known (AC-08-003.2) */}
                  {agent.model !== "unknown" && (
                    <span style={MODEL_BADGE_STYLE} data-model={agent.model}>
                      {agent.model}
                    </span>
                  )}
                </div>

                {/* Description — from frontmatter (AC-08-003.2) */}
                {agent.description !== null && <p style={DESC_STYLE}>{agent.description}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
