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
import type { AgentLevelResult } from "@/lib/gamification/gamification";
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
  gridTemplateColumns: "repeat(auto-fill, minmax(calc(var(--spacing, 0.25rem) * 44), 1fr))",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 2) 0",
};

function cardStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 2)",
    padding: "calc(var(--spacing, 0.25rem) * 4)",
    background: selected
      ? "color-mix(in srgb, var(--color-accent, currentColor) 8%, var(--color-surface, Canvas))"
      : "var(--color-surface, Canvas)",
    border: selected
      ? `var(--hairline, 1px) solid var(--color-accent, currentColor)`
      : `var(--hairline, 1px) solid var(--color-border, currentColor)`,
    borderRadius: "var(--radius, 0.5rem)",
    cursor: "pointer",
    textAlign: "center",
    transition:
      "background var(--duration-fast, 150ms) var(--easing-standard, ease), border-color var(--duration-fast, 150ms) var(--easing-standard, ease)",
    /* Reset button defaults */
    font: "inherit",
    color: "var(--color-text, currentColor)",
    boxShadow: selected ? "var(--shadow-1, none)" : "none",
  };
}

const LEVEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "var(--color-accent, currentColor)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  lineHeight: 1,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  lineHeight: 1.25,
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  lineHeight: 1.25,
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
  // The Avatar component itself also falls back, so this is belt-and-suspenders.
  const avatarRole = agent.id as AgentRole;

  return (
    <button
      type="button"
      data-testid="agent-card"
      data-agent-id={agent.id}
      data-selected={selected ? "true" : "false"}
      style={cardStyle(selected)}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Ver detalle de ${agent.name ?? agent.id}`}
    >
      {/* Pixel-art avatar (AC-07-007.1 + AC-09-003.*) */}
      <Avatar agentId={avatarRole} size="md" />

      {/* Level chip */}
      <span data-testid="agent-card-level" style={LEVEL_STYLE}>
        Nv {level.level}
      </span>

      {/* Rank title */}
      <span data-testid="agent-card-title" style={TITLE_STYLE}>
        {level.title}
      </span>

      {/* Agent name */}
      <span data-testid="agent-card-name" style={NAME_STYLE}>
        {agent.name ?? agent.id}
      </span>
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
