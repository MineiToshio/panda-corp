/**
 * WO-13-001 — Token schema validation + agent-color/state-vocab key maps
 *
 * Interfaces:
 *   IF-13-tokens    — TokenSchema + validateTokenSchema (schema contract & validator)
 *   IF-13-agent-colors — AGENT_COLOR: Record<AgentRole, tokenKey>
 *   IF-13-state-vocab  — STATE_BADGE: Record<AgentState, {icon, label}>
 *
 * Traces: REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007
 *
 * Pure module — no side-effects, no I/O. Consumed by:
 *   - FRD-06 sprite/feed/cards (IF-06-agent-color)
 *   - FRD-12 DAG nodes
 *   - CMP-13-state-badge
 */

// ---------------------------------------------------------------------------
// Types — TokenSchema (IF-13-tokens)
// ---------------------------------------------------------------------------

export interface OklchTokens {
  [key: string]: unknown;
  base: string;
  accent: string;
  contrast: string;
}

export interface ThemeVariant {
  surface: string;
  text: string;
}

export interface ThemeTokens {
  [key: string]: unknown;
  light: ThemeVariant;
  dark: ThemeVariant;
  highContrast: ThemeVariant;
}

export interface ElevationLevel {
  shadow: string;
  spacing: string;
}

export interface MotionTokens {
  duration: Record<string, number>;
  easing: Record<string, string>;
}

/** Frozen contract shape for docs/design/design-tokens.json (blueprint §3, IF-13-tokens). */
export interface TokenSchema {
  [key: string]: unknown;
  oklch: OklchTokens;
  themes: ThemeTokens;
  agents: Record<string, string>;
  elevation: ElevationLevel[];
  radius: string;
  spacing: string;
  hairline: string;
  motion: MotionTokens;
}

export interface TokenValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Agent roles — canonical source of truth (IF-13-agent-colors)
// ---------------------------------------------------------------------------

/** All ~10 canonical agent roles. Single source for AGENT_COLOR and the token palette. */
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
  "guild",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

/**
 * Canonical role → CSS token key map (IF-13-agent-colors).
 * Consumed by FRD-06 feed/cards and FRD-12 DAG; must not be duplicated elsewhere.
 * Values are CSS custom property references that resolve via @theme in globals.css.
 */
export const AGENT_COLOR: Record<AgentRole, string> = {
  researcher: "--color-agent-researcher",
  "backend-dev": "--color-agent-backend-dev",
  "frontend-dev": "--color-agent-frontend-dev",
  "test-writer": "--color-agent-test-writer",
  reviewer: "--color-agent-reviewer",
  "security-auditor": "--color-agent-security-auditor",
  architect: "--color-agent-architect",
  "product-manager": "--color-agent-product-manager",
  designer: "--color-agent-designer",
  guild: "--color-agent-guild",
};

// ---------------------------------------------------------------------------
// Agent states — canonical vocabulary (IF-13-state-vocab)
// ---------------------------------------------------------------------------

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
 * Icons use Lucide identifier strings; the StateBadge component resolves them to SVG.
 */
export const STATE_BADGE: Record<AgentState, { icon: string; label: string }> = {
  working: { icon: "loader-circle", label: "Trabajando" },
  idle: { icon: "circle-dashed", label: "En espera" },
  failed: { icon: "circle-x", label: "Fallido" },
  completed: { icon: "circle-check", label: "Completado" },
  blocked: { icon: "ban", label: "Bloqueado" },
  reviewing: { icon: "eye", label: "En revisión" },
};

// ---------------------------------------------------------------------------
// Schema validator — validateTokenSchema (IF-13-tokens)
// ---------------------------------------------------------------------------

/**
 * Validates the shape of a design-tokens.json object against the blueprint §3 contract.
 * Returns actionable errors — each string names the failing path and the constraint.
 *
 * Constraints checked (WO-13-001 Scope):
 *   - oklch.{base,accent,contrast} present
 *   - themes.{light,dark,highContrast} present
 *   - agents contains all ~10 canonical roles
 *   - elevation has exactly 3 levels
 *   - radius, spacing, hairline present
 *   - motion.duration.* all <300ms
 *   - motion.easing has 2–3 entries
 */
/** Internal helper: get a key from an unknown record safely. */
function pick(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

export function validateTokenSchema(tokens: unknown): TokenValidationResult {
  const errors: string[] = [];

  if (tokens === null || typeof tokens !== "object" || Array.isArray(tokens)) {
    return { valid: false, errors: ["Token root must be a plain object"] };
  }

  const t = tokens as Record<string, unknown>;

  // --- oklch ---
  const oklchRaw = pick(t, "oklch");
  if (oklchRaw === undefined || oklchRaw === null) {
    errors.push("oklch: required top-level key is missing");
  } else {
    const oklch = oklchRaw as Record<string, unknown>;
    for (const key of ["base", "accent", "contrast"]) {
      if (!pick(oklch, key)) {
        errors.push(`oklch.${key}: required OKLCH token is missing`);
      }
    }
  }

  // --- themes ---
  const themesRaw = pick(t, "themes");
  if (themesRaw === undefined || themesRaw === null) {
    errors.push("themes: required top-level key is missing");
  } else {
    const themes = themesRaw as Record<string, unknown>;
    for (const theme of ["light", "dark", "highContrast"]) {
      if (!pick(themes, theme)) {
        errors.push(
          `themes.${theme}: required theme variant is missing — high-contrast mode must not require a redesign`,
        );
      }
    }
  }

  // --- agents ---
  const agentsRaw = pick(t, "agents");
  if (agentsRaw === undefined || agentsRaw === null) {
    errors.push("agents: required top-level key is missing");
  } else {
    const agents = agentsRaw as Record<string, unknown>;
    for (const role of AGENT_ROLES) {
      if (!pick(agents, role)) {
        errors.push(
          `agents.${role}: canonical agent role "${role}" is missing from the token palette`,
        );
      }
    }
  }

  // --- elevation ---
  const elevationRaw = pick(t, "elevation");
  if (elevationRaw === undefined || elevationRaw === null) {
    errors.push("elevation: required top-level key is missing");
  } else if (!Array.isArray(elevationRaw)) {
    errors.push("elevation: must be an array of 3 levels (canvas → panel → card/popup)");
  } else {
    if (elevationRaw.length !== 3) {
      errors.push(
        `elevation: must have exactly 3 levels (canvas → panel → card/popup), found ${elevationRaw.length}`,
      );
    }
  }

  // --- radius, spacing, hairline ---
  for (const key of ["radius", "spacing", "hairline"]) {
    const val = pick(t, key);
    if (val === undefined || val === null || val === "") {
      errors.push(`${key}: required spacing-scale token is missing`);
    }
  }

  // --- motion ---
  const motionRaw = pick(t, "motion");
  if (motionRaw === undefined || motionRaw === null) {
    errors.push("motion: required top-level key is missing");
  } else {
    const motion = motionRaw as Record<string, unknown>;

    // duration: all values must be < 300
    const durationRaw = pick(motion, "duration");
    if (durationRaw === undefined || durationRaw === null) {
      errors.push("motion.duration: required key is missing");
    } else {
      const duration = durationRaw as Record<string, unknown>;
      for (const [key, value] of Object.entries(duration)) {
        if (typeof value !== "number") {
          errors.push(
            `motion.duration.${key}: must be a number (ms), got ${typeof value} — non-numeric durations are invalid`,
          );
        } else if (value >= 300) {
          errors.push(
            `motion.duration.${key}: duration ${value}ms violates the <300ms constraint (AC-13-005.1)`,
          );
        }
      }
    }

    // easing: 2–3 entries
    const easingRaw = pick(motion, "easing");
    if (easingRaw === undefined || easingRaw === null) {
      errors.push("motion.easing: required key is missing");
    } else {
      const easingCount = Object.keys(easingRaw as object).length;
      if (easingCount < 2 || easingCount > 3) {
        errors.push(
          `motion.easing: must have 2–3 easing tokens, found ${easingCount} (AC-13-005.1)`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
