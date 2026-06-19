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
 * Re-anchored 2026-06-18 (DR-054 ADOPT-VISUAL): the schema validated here MIRRORS the
 * owner-approved prototype contract in docs/design/design-tokens.json — themes.{dark,light}
 * groups (surfaces/text/borders/accent/status/categories/tiers/shadows), radii, typography,
 * spacing and motion. This SUPERSEDES the earlier invented cold-blue OKLCH shape
 * (oklch.{base,accent,contrast} + flat themes.{light,dark,highContrast}); the prototype is
 * authored in hex, dark default. The agent-role palette (AGENT_ROLES/AGENT_COLOR) is
 * unchanged — those vars stay OKLCH for role identity (FRD-06 La Fragua + FRD-12 dataviz).
 *
 * Pure module — no side-effects, no I/O. Consumed by:
 *   - FRD-06 sprite/feed/cards (IF-06-agent-color)
 *   - FRD-12 DAG nodes
 *   - CMP-13-state-badge
 */

// ---------------------------------------------------------------------------
// Types — TokenSchema (IF-13-tokens) — mirrors docs/design/design-tokens.json
// ---------------------------------------------------------------------------

/** Surface ramp (canvas → panel → card → card2). */
export interface SurfaceTokens {
  [key: string]: unknown;
  canvas: string;
  panel: string;
  card: string;
  card2: string;
}

/** Text ramp (t1 high-emphasis → t3 muted). */
export interface TextTokens {
  [key: string]: unknown;
  t1: string;
  t2: string;
  t3: string;
}

/** Border ramp (bd hairline → bd2 strong). */
export interface BorderTokens {
  [key: string]: unknown;
  bd: string;
  bd2: string;
}

/** Rationed accent set. */
export interface AccentTokens {
  [key: string]: unknown;
  accent: string;
  accentText: string;
  accentBg: string;
  onAccent: string;
}

/** Status set (each with a paired -Bg). */
export interface StatusTokens {
  [key: string]: unknown;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
}

/** Two-layer shadow scale (resting + pop). */
export interface ShadowTokens {
  [key: string]: unknown;
  shadow: string;
  shadowPop: string;
}

/** A full theme variant (dark default / light). */
export interface ThemeVariant {
  [key: string]: unknown;
  surfaces: SurfaceTokens;
  text: TextTokens;
  borders: BorderTokens;
  accent: AccentTokens;
  status: StatusTokens;
  categories: Record<string, string>;
  tiers: Record<string, string>;
  shadows: ShadowTokens;
}

export interface ThemeTokens {
  [key: string]: unknown;
  dark: ThemeVariant;
  light: ThemeVariant;
}

export interface RadiiTokens {
  [key: string]: unknown;
  sm: string;
  md: string;
  lg: string;
  pill: string;
}

export interface MotionTokens {
  [key: string]: unknown;
  rules: string;
  focus: string;
}

/** Frozen contract shape for docs/design/design-tokens.json (DR-054, IF-13-tokens). */
export interface TokenSchema {
  [key: string]: unknown;
  themes: ThemeTokens;
  radii: RadiiTokens;
  typography: Record<string, unknown>;
  spacing: Record<string, unknown>;
  motion: MotionTokens;
}

export interface TokenValidationResult {
  valid: boolean;
  errors: string[];
}

/** The two prototype theme variants (dark is the default). */
export const THEME_VARIANTS = ["dark", "light"] as const;
export type ThemeName = (typeof THEME_VARIANTS)[number];

/** The 9 idea-category color slots present in every theme. */
export const CATEGORY_KEYS = [
  "cat1",
  "cat2",
  "cat3",
  "cat4",
  "cat5",
  "cat6",
  "cat7",
  "cat8",
  "cat9",
] as const;

/** The 5 tier/rarity color slots (Bronze → Legend) present in every theme. */
export const TIER_KEYS = ["tier1", "tier2", "tier3", "tier4", "tier5"] as const;

// ---------------------------------------------------------------------------
// Agent roles — canonical source of truth (IF-13-agent-colors)
// ---------------------------------------------------------------------------

/**
 * All 13 canonical agent roles. Single source for AGENT_COLOR and the token palette.
 * Realigned 2026-06-18 (Party redesign): added implementer/copywriter/analytics/devops,
 * removed the fictitious 'guild' aggregate.
 * Source: prototype/party-redesign-spec.md §2; docs/frds/frd-13-.../frd.md.
 */
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
  implementer: "--color-agent-implementer",
  copywriter: "--color-agent-copywriter",
  analytics: "--color-agent-analytics",
  devops: "--color-agent-devops",
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

/** Internal helper: get a key from an unknown record safely. */
function pick(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

/** A plain object is a non-null, non-array object — the only valid token-group shape. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A token value is a non-empty string (a color/length/shadow literal). */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Validate one theme variant (dark / light) against the prototype contract:
 *   surfaces.{canvas,panel,card,card2}, text.{t1,t2,t3}, borders.{bd,bd2},
 *   accent.{accent,accentText,accentBg,onAccent}, status.{ok..info + *Bg},
 *   categories.{cat1..cat9}, tiers.{tier1..tier5}, shadows.{shadow,shadowPop}.
 * Pushes a path-prefixed error per missing/empty/wrong-typed field.
 */
function validateThemeVariant(variantRaw: unknown, themeName: string, errors: string[]): void {
  const prefix = `themes.${themeName}`;
  if (!isPlainObject(variantRaw)) {
    errors.push(`${prefix}: must be a plain object (theme variant), not an array or primitive`);
    return;
  }

  const groupKeys: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["surfaces", ["canvas", "panel", "card", "card2"]],
    ["text", ["t1", "t2", "t3"]],
    ["borders", ["bd", "bd2"]],
    ["accent", ["accent", "accentText", "accentBg", "onAccent"]],
    ["status", ["ok", "okBg", "warn", "warnBg", "danger", "dangerBg", "info", "infoBg"]],
    ["categories", CATEGORY_KEYS],
    ["tiers", TIER_KEYS],
    ["shadows", ["shadow", "shadowPop"]],
  ];

  for (const [group, requiredKeys] of groupKeys) {
    const groupRaw = pick(variantRaw, group);
    if (groupRaw === undefined || groupRaw === null) {
      errors.push(`${prefix}.${group}: required token group is missing`);
      continue;
    }
    if (!isPlainObject(groupRaw)) {
      errors.push(
        `${prefix}.${group}: must be a plain object (named token map), not an array or primitive`,
      );
      continue;
    }
    for (const key of requiredKeys) {
      if (!isNonEmptyString(pick(groupRaw, key))) {
        errors.push(
          `${prefix}.${group}.${key}: required token is missing or not a non-empty string`,
        );
      }
    }
  }
}

/**
 * Validates the shape of a design-tokens.json object against the prototype contract
 * (DR-054, IF-13-tokens). Returns actionable errors — each string names the failing
 * path and the constraint. Mirrors docs/design/design-tokens.json.
 *
 * Constraints checked:
 *   - themes.{dark,light} present, each a full variant (surfaces/text/borders/accent/
 *     status/categories[9]/tiers[5]/shadows) — high-contrast is a globals.css var override,
 *     not a token-file theme, so it is NOT required here (AC-13-001.1: no redesign).
 *   - radii.{sm,md,lg,pill} present
 *   - typography, spacing present (non-empty groups)
 *   - motion present with the focus ring + motion rules
 */
export function validateTokenSchema(tokens: unknown): TokenValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(tokens)) {
    return { valid: false, errors: ["Token root must be a plain object"] };
  }

  // --- themes (dark default + light) ---
  const themesRaw = pick(tokens, "themes");
  if (themesRaw === undefined || themesRaw === null) {
    errors.push("themes: required top-level key is missing");
  } else if (!isPlainObject(themesRaw)) {
    errors.push("themes: must be a plain object with dark and light variants, not an array");
  } else {
    for (const themeName of THEME_VARIANTS) {
      const variantRaw = pick(themesRaw, themeName);
      if (variantRaw === undefined || variantRaw === null) {
        errors.push(
          `themes.${themeName}: required theme variant is missing (dark is the default, light is the inverse)`,
        );
      } else {
        validateThemeVariant(variantRaw, themeName, errors);
      }
    }
  }

  // --- radii ---
  const radiiRaw = pick(tokens, "radii");
  if (radiiRaw === undefined || radiiRaw === null) {
    errors.push("radii: required top-level key is missing");
  } else if (!isPlainObject(radiiRaw)) {
    errors.push("radii: must be a plain object (named radius scale), not an array or primitive");
  } else {
    for (const key of ["sm", "md", "lg", "pill"]) {
      if (!isNonEmptyString(pick(radiiRaw, key))) {
        errors.push(`radii.${key}: required radius token is missing or not a non-empty string`);
      }
    }
  }

  // --- typography & spacing (presence + non-empty plain object) ---
  for (const key of ["typography", "spacing"]) {
    const groupRaw = pick(tokens, key);
    if (groupRaw === undefined || groupRaw === null) {
      errors.push(`${key}: required top-level key is missing`);
    } else if (!isPlainObject(groupRaw)) {
      errors.push(`${key}: must be a plain object, not an array or primitive`);
    } else if (Object.keys(groupRaw).length === 0) {
      errors.push(`${key}: must declare at least one entry (empty group is invalid)`);
    }
  }

  // --- motion (focus ring + motion rules) ---
  const motionRaw = pick(tokens, "motion");
  if (motionRaw === undefined || motionRaw === null) {
    errors.push("motion: required top-level key is missing");
  } else if (!isPlainObject(motionRaw)) {
    errors.push("motion: must be a plain object, not an array or primitive");
  } else {
    if (!isNonEmptyString(pick(motionRaw, "rules"))) {
      errors.push(
        "motion.rules: required motion rule statement is missing (transform/opacity <300ms)",
      );
    }
    if (!isNonEmptyString(pick(motionRaw, "focus"))) {
      errors.push("motion.focus: required focus-ring spec is missing (AC-13-008.1)");
    }
  }

  return { valid: errors.length === 0, errors };
}
