/** Canonical agent roster and state vocabulary; visual roles have no assigned hue. */
export const AGENT_ROLES = [
  "researcher",
  "backend-dev",
  "frontend-dev",
  "test-writer",
  "reviewer",
  "security-auditor",
  "architect",
  "product-manager",
  "designer",
  "implementer",
  "copywriter",
  "analytics",
  "devops",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

/** All 6 canonical agent states (blueprint IF-13-state-vocab). */
export const AGENT_STATES = [
  "working",
  "idle",
  "failed",
  "completed",
  "blocked",
  "reviewing",
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

/**
 * Icon + Spanish label per state (IF-13-state-vocab, AC-13-007.1).
 * No state is signalled by color alone — each entry carries an icon shape and a label.
 * Icon identifiers are state vocabulary metadata, independent of visual role colours.
 */
export const STATE_BADGE: Record<AgentState, { icon: string; label: string }> = {
  working: { icon: "loader-circle", label: "Trabajando" },
  idle: { icon: "circle-dashed", label: "En espera" },
  failed: { icon: "circle-x", label: "Fallido" },
  completed: { icon: "circle-check", label: "Completado" },
  blocked: { icon: "ban", label: "Bloqueado" },
  reviewing: { icon: "eye", label: "En revisión" },
};
