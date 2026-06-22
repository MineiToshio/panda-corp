/**
 * manual-diagrams/TeamDiagram.tsx — FRD-08 ("El equipo de agentes")
 *
 * The agent roster grouped by phase: each group is a label + a wrap of role
 * cards (Avatar + role id + role title).
 *
 * Faithful recreation of the prototype `teamDiagram()` (index.html L1063-1065).
 * In the prototype the cards are click-to-navigate to the agent detail; the
 * Manual surfaces that detail via the Referencia → Agentes catalog, so here the
 * cards are presentational (the diagram's APPEARANCE is what we re-anchor).
 *
 * Tokens only · light+dark first-class · Avatar reused (no fork).
 *
 * Traceability: CMP-08-diagrams (team).
 */

import type React from "react";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";

// ---------------------------------------------------------------------------
// Group data — mirrors the prototype `groups` array (label + role ids).
// The role title is the Manual's static label (the prototype reads CONFIG.agents
// `.rol`; the Manual keeps the same human role names here).
// ---------------------------------------------------------------------------

type Member = { readonly id: AgentRole; readonly role: string };
type Group = { readonly label: string; readonly members: readonly Member[] };

const GROUPS: readonly Group[] = [
  {
    label: "Producto",
    members: [
      { id: "researcher", role: "Investigación" },
      { id: "product-manager", role: "Product Manager" },
    ],
  },
  {
    label: "Diseño y contenido",
    members: [
      { id: "designer", role: "Diseño UX/UI" },
      { id: "copywriter", role: "Copy / UX writing" },
    ],
  },
  {
    label: "Arquitectura e infra",
    members: [
      { id: "architect", role: "Arquitecto" },
      { id: "devops", role: "DevOps / Deploy" },
    ],
  },
  {
    label: "Construcción y datos",
    members: [
      { id: "backend-dev", role: "Backend" },
      { id: "frontend-dev", role: "Frontend" },
      { id: "test-writer", role: "Testing (TDD)" },
      { id: "analytics", role: "Analítica" },
    ],
  },
  {
    label: "Calidad",
    members: [
      { id: "reviewer", role: "Revisión" },
      { id: "security-auditor", role: "Seguridad" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-team">
      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-text2)",
              marginBottom: "6px",
            }}
          >
            {group.label}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {group.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md, 12px)",
                  padding: "7px 11px 7px 7px",
                }}
              >
                <Avatar agentId={member.id} size="sm" />
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--color-text)",
                    }}
                  >
                    {member.id}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text2)" }}>{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
