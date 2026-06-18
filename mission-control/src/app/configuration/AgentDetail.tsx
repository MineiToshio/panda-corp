/**
 * WO-07-007 — CMP-07-agent-detail
 *
 * Agent detail panel: shows avatar, name, level, title, XP bar to the next
 * level, and the honest explanation that the agent levels up by completing
 * work orders (each closed work order adds XP).
 *
 * Server Component — all data is passed as props (derived by the parent
 * Server Component). No client state needed here.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish copy (i18n, AC-07-007.2).
 *   - XP bar uses rationed accent (XpBar handles that — AC-07-007.4).
 *   - State NEVER conveyed by color alone.
 *
 * XP honesty contract (AC-07-007.3 / FRD-09):
 *   - level, title, xp, next, pctToNext come exclusively from computeAgentLevel()
 *     which counts only CLOSED WORK ORDERS for that agent.
 *   - pctToNext is in [0, 1] from computeAgentLevel (fraction, not percent).
 *   - XpBar receives pctToNext scaled to [0, 100] to match its API.
 *   - Zero work orders → xp=0, pctToNext=0 → XpBar fill=0% (no fake bar).
 *
 * Traceability:
 *   CMP-07-agent-detail → FRD-07 → AC-07-007.2, AC-07-007.3, AC-07-007.4
 *   IF-09-agent-xp (computeAgentLevel) → lib/gamification.ts
 *   CMP-09-avatar (Avatar) → components/rpg/Avatar.tsx
 *   CMP-09-xp-bar (XpBar) → components/rpg/XpBar.tsx
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { XpBar } from "@/components/core/XpBar/XpBar";
import type { AgentLevelResult } from "@/lib/gamification";
import { AGENT_RANKS } from "@/lib/gamification";
import type { AgentRef } from "@/lib/reference";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AgentDetailProps = {
  /** The agent to display. */
  agent: AgentRef;
  /** The agent's current level/XP result from computeAgentLevel(). */
  level: AgentLevelResult;
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (AC-07-007.4)
// ---------------------------------------------------------------------------

const DETAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
  padding: "calc(var(--spacing, 0.25rem) * 6)",
  background: "var(--color-surface, Canvas)",
  border: `var(--hairline, 1px) solid var(--color-border, currentColor)`,
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-1, none)",
  maxWidth: "calc(var(--spacing, 0.25rem) * 96)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
};

const HEADER_INFO_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  flex: 1,
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
  margin: 0,
  lineHeight: 1.25,
};

const LEVEL_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

const LEVEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--color-accent, currentColor)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text-muted, currentColor)",
};

const DIVIDER_STYLE: React.CSSProperties = {
  border: "none",
  borderTop: `var(--hairline, 1px) solid var(--color-border, currentColor)`,
  margin: 0,
};

const XP_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const XP_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--color-text-muted, currentColor)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const EXPLANATION_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  lineHeight: 1.6,
  margin: 0,
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.6,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the title of the next rank after the current one.
 * At max rank, returns the current title (Architect stays Architect).
 */
function nextRankTitle(currentLevel: number): string {
  // AGENT_RANKS is ["Apprentice", "Engineer", "Senior", "Architect"] (1-based level)
  const nextIndex = currentLevel; // level is 1-based; next rank is at index = level (0-based)
  if (nextIndex < AGENT_RANKS.length) {
    return AGENT_RANKS[nextIndex] ?? AGENT_RANKS[AGENT_RANKS.length - 1] ?? "Architect";
  }
  return AGENT_RANKS[AGENT_RANKS.length - 1] ?? "Architect";
}

// ---------------------------------------------------------------------------
// AgentDetail — main export (CMP-07-agent-detail)
// ---------------------------------------------------------------------------

/**
 * CMP-07-agent-detail — detail panel for a single agent.
 *
 * Server Component: pure rendering, no client interactivity.
 * Consumed by ConfigurationShell when an agent card is selected.
 */
export function AgentDetail({ agent, level }: AgentDetailProps): React.JSX.Element {
  const avatarRole = agent.id as AgentRole;
  const nextTitle = nextRankTitle(level.level);

  // pctToNext from computeAgentLevel is a FRACTION [0, 1].
  // XpBar expects a percentage [0, 100].
  const pctForBar = Math.round(level.pctToNext * 100);

  return (
    <div data-testid="agent-detail" style={DETAIL_STYLE}>
      {/* ── Header: avatar + name + level chip ──────────────────────────── */}
      <div style={HEADER_STYLE}>
        <Avatar agentId={avatarRole} size="lg" />

        <div style={HEADER_INFO_STYLE}>
          <h2 data-testid="agent-detail-name" style={NAME_STYLE}>
            {agent.name ?? agent.id}
          </h2>

          <div style={LEVEL_BADGE_STYLE}>
            <span data-testid="agent-detail-level" style={LEVEL_STYLE}>
              Nv {level.level}
            </span>
            <span data-testid="agent-detail-title" style={TITLE_STYLE}>
              {level.title}
            </span>
          </div>
        </div>
      </div>

      {/* ── Description (from body or description field) ─────────────────── */}
      {agent.description ? (
        <p data-testid="agent-detail-description" style={DESC_STYLE}>
          {agent.description}
        </p>
      ) : null}

      <hr style={DIVIDER_STYLE} />

      {/* ── XP section ───────────────────────────────────────────────────── */}
      <section style={XP_SECTION_STYLE} aria-label="Progresión XP del agente">
        <h3 style={XP_HEADING_STYLE}>Progresión</h3>

        {/* Honest XP bar — driven exclusively by computeAgentLevel (AC-07-007.3) */}
        <XpBar
          xp={level.xp}
          next={level.next}
          pctToNext={pctForBar}
          label={level.title}
          nextTitle={nextTitle}
        />

        {/* Honest explanation: XP comes ONLY from closed work orders (AC-07-007.2) */}
        <p data-testid="agent-detail-xp-explanation" style={EXPLANATION_STYLE}>
          Este agente sube de nivel completando <strong>work orders</strong> (órdenes de trabajo).
          Cada work order cerrada con éxito suma XP. El nivel refleja trabajo real verificable —
          nunca aperturas de la app ni actividad de navegación.
        </p>
      </section>
    </div>
  );
}
