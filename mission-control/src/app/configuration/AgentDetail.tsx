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
 * Reverse cross-navigation (FRD-07 EARS): when given the skills that use this
 * agent + an onSkillClick handler, it renders clickable skill chips so the owner
 * can jump from an agent's detail to a skill that uses it ("clicking the linked
 * chip opens the other item's detail" — the second clause of the bidirectional
 * Skills↔Agents cross-nav). The skills are derived by the shell by inverting
 * SkillRef.agents.
 *
 * Traceability:
 *   CMP-07-agent-detail → FRD-07 → AC-07-007.2, AC-07-007.3, AC-07-007.4
 *   FRD-07 Skills↔Agents cross-navigation (reverse half, agent → skill)
 *   IF-09-agent-xp (computeAgentLevel) → lib/gamification.ts
 *   CMP-09-avatar (Avatar) → components/rpg/Avatar.tsx
 *   CMP-09-xp-bar (XpBar) → components/rpg/XpBar.tsx
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { XpBar } from "@/components/core/XpBar/XpBar";
import { AGENT_RANKS, type AgentLevelResult } from "@/lib/gamification/agents";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AgentDetailProps = {
  /** The agent to display. */
  agent: AgentRef;
  /** The agent's current level/XP result from computeAgentLevel(). */
  level: AgentLevelResult;
  /**
   * Cross-navigation (FRD-07 EARS, reverse half): the skills that USE this agent
   * (derived by inverting `SkillRef.agents`). Rendered as clickable chips so the
   * owner can jump from an agent's detail to a skill that uses it. Empty/absent →
   * no chip list (honest zero state, e.g. an agent no skill references).
   */
  usingSkills?: readonly SkillRef[];
  /**
   * Called with a skill slug when the owner clicks a using-skill chip, to open
   * that skill's detail ("clicking the linked chip opens the other item's detail").
   * When omitted, no chip list is rendered (nothing to navigate to).
   */
  onSkillClick?: (slug: string) => void;
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

const MODEL_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius-sm, 8px)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.6875rem",
  color: "var(--color-text2, currentColor)",
  background: "var(--color-card2, var(--color-panel))",
};

const MODEL_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
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

const SKILLS_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const SKILLS_CHIPS_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

const SKILL_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2.5)",
  borderRadius: "var(--radius, 0.375rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-card2, var(--color-panel))",
  color: "var(--color-accent, currentColor)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const SKILLS_EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontStyle: "italic",
  margin: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Explain an agent's model assignment (FRD-07 EARS): opus = judgment work
 * (architecture, review, specs — the most capable model); sonnet = mechanical,
 * verifiable work (implementation, search — cheaper and faster). Any other model
 * value gets a neutral, honest line. Derived from the agent's `model` field.
 */
function modelAssignmentExplanation(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("opus")) {
    return (
      "Corre en opus — el modelo más capaz — porque su trabajo es de juicio: " +
      "arquitectura, revisión y especificaciones, donde la calidad del criterio importa más que la velocidad."
    );
  }
  if (m.includes("sonnet")) {
    return (
      "Corre en sonnet — más barato y rápido — porque su trabajo es mecánico y verificable: " +
      "implementación y búsqueda, donde el resultado se comprueba contra tests y criterios objetivos."
    );
  }
  return `Modelo asignado: ${model}. La asignación equilibra trabajo de juicio (opus) frente a trabajo mecánico y verificable (sonnet).`;
}

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
export function AgentDetail({
  agent,
  level,
  usingSkills,
  onSkillClick,
}: AgentDetailProps): React.JSX.Element {
  const avatarRole = agent.id as AgentRole;
  const nextTitle = nextRankTitle(level.level);
  const modelExplanation = modelAssignmentExplanation(agent.model);

  // pctToNext from computeAgentLevel is a FRACTION [0, 1].
  // XpBar expects a percentage [0, 100].
  const pctForBar = Math.round(level.pctToNext * 100);

  // Cross-navigation (reverse half): only render the using-skills section when a
  // navigation handler is wired (nothing to jump to otherwise).
  const showUsingSkills = onSkillClick !== undefined;
  const skillsThatUseAgent = usingSkills ?? [];

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
            {/* Model chip — opus / sonnet (AC-07-007.x) */}
            <span data-testid="agent-detail-model" style={MODEL_CHIP_STYLE}>
              {agent.model}
            </span>
          </div>
        </div>
      </div>

      {/* ── Model assignment: WHY this agent runs on opus or sonnet (EARS) ─── */}
      <section style={MODEL_SECTION_STYLE} aria-label="Asignación de modelo del agente">
        <h3 style={XP_HEADING_STYLE}>Asignación de modelo</h3>
        <p data-testid="agent-detail-model-explanation" style={EXPLANATION_STYLE}>
          {modelExplanation}
        </p>
      </section>

      {/* ── Description (from body or description field) ─────────────────── */}
      {agent.description ? (
        <p data-testid="agent-detail-description" style={DESC_STYLE}>
          {agent.description}
        </p>
      ) : null}

      {/* ── Using-skills: jump back to any skill that uses this agent (EARS
          reverse cross-nav). Each chip opens that skill's detail. ─────────── */}
      {showUsingSkills ? (
        <section
          data-testid="agent-detail-using-skills"
          style={SKILLS_SECTION_STYLE}
          aria-label="Habilidades que usan este agente"
        >
          <h3 style={XP_HEADING_STYLE}>Habilidades que lo usan</h3>
          {skillsThatUseAgent.length > 0 ? (
            <div style={SKILLS_CHIPS_STYLE}>
              {skillsThatUseAgent.map((skill) => (
                <button
                  key={skill.slug}
                  type="button"
                  data-testid={`agent-skill-chip-${skill.slug}`}
                  aria-label={`Ir a la habilidad /pandacorp:${skill.slug}`}
                  onClick={() => onSkillClick?.(skill.slug)}
                  style={SKILL_CHIP_STYLE}
                >
                  /pandacorp:{skill.slug}
                </button>
              ))}
            </div>
          ) : (
            <p data-testid="agent-detail-using-skills-empty" style={SKILLS_EMPTY_STYLE}>
              Ninguna habilidad declara este agente en su flujo.
            </p>
          )}
        </section>
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
