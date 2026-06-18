"use client";
/**
 * WO-07-006 — FlowDiagram (CMP-07-flow-diagram)
 *
 * Renders a mini-flow of agent chips with arrows from a skill's body markdown.
 *
 * AC-07-006.3: chips colored per agent (FRD-13 per-agent tokens), connected
 *              with arrows. Colors from AGENT_COLOR, never hardcoded.
 * AC-07-006.4: WHERE a skill has no machine-readable agents section, degrades
 *              to a "no-flow" message — NO invented steps.
 *
 * Agent detection: scans a "## Agents used" section (or "## Agentes usados")
 * in the skill body for bullet list items matching canonical agent roles.
 * Falls back to scanning any bullet containing a known agent role name.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - Zero hardcoded colors — CSS custom properties only via AGENT_COLOR.
 *   - data-testid on every interactive/structural element.
 *   - Spanish copy.
 *
 * Traceability:
 *   CMP-07-flow-diagram → FRD-07
 *   AC-07-006.3, AC-07-006.4
 */

import type React from "react";

import { AGENT_COLOR, AGENT_ROLES, type AgentRole } from "@/app/_design/tokens";

// ---------------------------------------------------------------------------
// Agent extraction from markdown body (AC-07-006.3 / AC-07-006.4)
// ---------------------------------------------------------------------------

/** Known agent role names sorted by length (longest first) to avoid partial matches. */
const SORTED_ROLES: readonly AgentRole[] = [...AGENT_ROLES].sort((a, b) => b.length - a.length);

/**
 * Extract an ordered list of agent roles from a skill's body markdown.
 *
 * Strategy:
 *   1. Find a "## Agents used" or "## Agentes usados" heading block.
 *   2. Within that block, extract bullet items that contain a canonical role name.
 *   3. Fallback: scan ALL bullet items in the body for known role names.
 *   4. No match → [] (degrade, per AC-07-006.4).
 *
 * Returns each matched role in document order, deduplicated.
 */
export function extractAgents(body: string): AgentRole[] {
  const found: AgentRole[] = [];
  const seen = new Set<AgentRole>();

  // Try to extract from a dedicated "Agents used" / "Agentes usados" section first.
  const agentsSectionMatch = body.match(
    /##\s+(?:Agents?\s+used|Agentes?\s+usados?)\b([\s\S]*?)(?=##|$)/i,
  );

  const targetBlock = agentsSectionMatch?.[1] ?? body;

  // Scan the block for bullet items containing a canonical role name.
  const bulletLines = targetBlock.split("\n").filter((line) => /^\s*[-*+]\s+/.test(line));

  for (const line of bulletLines) {
    for (const role of SORTED_ROLES) {
      if (line.toLowerCase().includes(role.toLowerCase()) && !seen.has(role)) {
        found.push(role);
        seen.add(role);
        break; // one role per bullet
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

function chipStyle(tokenKey: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2.5)",
    borderRadius: "var(--radius, 0.375rem)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    // Use the CSS variable as a border color; background is a very low-opacity tint
    // expressed as a CSS variable to avoid hardcoding any color value.
    color: `var(${tokenKey}, currentColor)`,
    border: `1px solid var(${tokenKey}, currentColor)`,
    background: "transparent",
    whiteSpace: "nowrap",
  };
}

const ARROW_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  fontSize: "0.875rem",
  userSelect: "none",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontStyle: "italic",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FlowDiagramProps {
  /** Raw markdown body of the skill (after frontmatter). */
  body: string;
}

// ---------------------------------------------------------------------------
// FlowDiagram component (CMP-07-flow-diagram)
// ---------------------------------------------------------------------------

/**
 * Renders the agent mini-flow chips (colored per FRD-13 tokens) with arrows.
 *
 * Degrades gracefully when no agents can be extracted (AC-07-006.4):
 * shows a "no declared flow" message — never invents steps.
 */
export function FlowDiagram({ body }: FlowDiagramProps): React.JSX.Element {
  const agents = extractAgents(body);

  return (
    <div data-testid="flow-diagram" style={CONTAINER_STYLE}>
      {agents.length === 0 ? (
        <span data-testid="flow-diagram-empty" style={EMPTY_STYLE}>
          Flujo no declarado en este skill
        </span>
      ) : (
        agents.map((role, idx) => {
          const tokenKey = AGENT_COLOR[role];
          return (
            <span
              key={role}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "calc(var(--spacing, 0.25rem) * 1)",
              }}
            >
              <span
                data-testid={`flow-agent-chip-${role}`}
                data-agent-color={tokenKey}
                style={chipStyle(tokenKey)}
              >
                {role}
              </span>
              {idx < agents.length - 1 && (
                <span data-testid={`flow-arrow-${idx}`} style={ARROW_STYLE} aria-hidden="true">
                  →
                </span>
              )}
            </span>
          );
        })
      )}
    </div>
  );
}
