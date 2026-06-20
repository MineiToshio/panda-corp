"use client";
/**
 * WO-07-007 — CMP-07-agent-list
 *
 * Agents section list view: per agent shows a pixel-art avatar, level, title.
 * Clicking a card calls onSelectAgent with the agent id.
 *
 * Consumed by ConfigurationShell as the "agents" section content.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive element.
 *   - Spanish copy.
 *   - Accent used on selection state (data-selected), not color alone.
 *
 * Traceability:
 *   CMP-07-agent-list → FRD-07 → AC-07-007.1, AC-07-007.4
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Panel } from "@/components/core/Panel/Panel";
import type { AgentLevelResult } from "@/lib/gamification/agents";
import type { AgentRef } from "@/lib/reference/reference";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AgentListProps = {
  /** Agents catalog from readAgents(). */
  agents: AgentRef[];
  /**
   * Level result per agent id (from computeAgentLevel).
   * Keys are agent ids; missing agents default to level 1 / 0 XP.
   */
  levels: Record<string, AgentLevelResult>;
  /** Currently selected agent id (null = nothing selected). */
  selectedAgentId: string | null;
  /** Called when the user clicks an agent card. */
  onSelectAgent: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (AC-07-007.4)
// ---------------------------------------------------------------------------

const LIST_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
  gap: "9px",
  padding: "calc(var(--spacing, 0.25rem) * 2) 0",
};

const CARD_BTN_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "inherit",
};

// gxAgentCard layout: horizontal row (avatar left, text column right)
const CARD_INNER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "11px",
};

const LEVEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontFamily: "var(--font-pixel, monospace)",
  fontWeight: 700,
  color: "var(--color-warn, currentColor)",
  letterSpacing: "0.06em",
  lineHeight: 1,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--color-warn, currentColor)",
  lineHeight: 1.25,
};

const MODEL_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "var(--radius-pill, 999px)",
  border: "1px solid var(--color-border-strong, currentColor)",
  background: "var(--color-panel, Canvas)",
  fontSize: "0.6875rem",
  fontFamily: "var(--font-mono, monospace)",
  color: "var(--color-text2, currentColor)",
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Zero-state level (used when levels[id] is absent)
// ---------------------------------------------------------------------------

const ZERO_LEVEL: AgentLevelResult = {
  level: 1,
  title: "Apprentice",
  xp: 0,
  next: 5,
  pctToNext: 0,
};

// ---------------------------------------------------------------------------
// AgentCard — single agent in the list
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: AgentRef;
  level: AgentLevelResult;
  selected: boolean;
  onClick: () => void;
}

function AgentCard({ agent, level, selected, onClick }: AgentCardProps): React.JSX.Element {
  // Resolve agent role for the Avatar — fallback to "backend-dev" for unknown ids.
  const avatarRole = agent.id as AgentRole;

  return (
    <button
      type="button"
      data-testid="agent-card"
      data-agent-id={agent.id}
      data-selected={selected ? "true" : "false"}
      style={CARD_BTN_STYLE}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Ver detalle de ${agent.name ?? agent.id}`}
    >
      {/* Panel provides the RPG embossed skin (prototype .rpgpanel) */}
      <Panel variant="rpgpanel" glow={selected ? "accent" : undefined}>
        {/* gxAgentCard: horizontal row — avatar left, text column right */}
        <div style={CARD_INNER_STYLE}>
          {/* Pixel-art avatar on the left (AC-07-007.1 + AC-09-003.*) */}
          <Avatar agentId={avatarRole} size="md" />

          {/* Text column: id + model chip / display name / level */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: mono id + model chip (gxAgentCard pattern) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--color-text, currentColor)",
                }}
              >
                {agent.id}
              </span>
              {agent.model && (
                <span data-testid="agent-model-chip" style={MODEL_CHIP_STYLE}>
                  {agent.model}
                </span>
              )}
            </div>

            {/* Row 2: display name in text2 (shown as agent-card-name for tests) */}
            <div
              data-testid="agent-card-name"
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text2, currentColor)",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {agent.name ?? agent.id}
            </div>

            {/* Row 3: Nv level · title in warn color (gxAgentCard AGMETA pattern) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <span data-testid="agent-card-level" style={LEVEL_STYLE}>
                Nv {level.level}
              </span>
              <span style={{ color: "var(--color-text3)", fontSize: "0.6875rem" }}>·</span>
              <span data-testid="agent-card-title" style={TITLE_STYLE}>
                {level.title}
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AgentList — main export (CMP-07-agent-list)
// ---------------------------------------------------------------------------

/**
 * CMP-07-agent-list — list of all agents, each with avatar + level + title.
 *
 * "use client" — needs onClick handlers.
 */
export function AgentList({
  agents,
  levels,
  selectedAgentId,
  onSelectAgent,
}: AgentListProps): React.JSX.Element {
  return (
    <div data-testid="agent-list" style={LIST_STYLE}>
      {agents.map((agent) => {
        const level = levels[agent.id] ?? ZERO_LEVEL;
        return (
          <AgentCard
            key={agent.id}
            agent={agent}
            level={level}
            selected={selectedAgentId === agent.id}
            onClick={() => onSelectAgent(agent.id)}
          />
        );
      })}
    </div>
  );
}
