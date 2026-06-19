/**
 * WO-13-001 — Token schema validation + agent-color/state-vocab key maps
 *
 * Re-anchored 2026-06-18 (DR-054 ADOPT-VISUAL): validateTokenSchema now validates the
 * owner-approved prototype contract (docs/design/design-tokens.json) — themes.{dark,light}
 * with surfaces/text/borders/accent/status/categories[9]/tiers[5]/shadows, radii, typography,
 * spacing and motion. This SUPERSEDES the earlier invented cold-blue OKLCH shape
 * (oklch.{base,accent,contrast} + flat themes.{light,dark,highContrast} + flat elevation[3]).
 * The agent-role palette (AGENT_ROLES/AGENT_COLOR) and the state vocabulary are unchanged.
 *
 * Traces:
 *   AC-13-001.1 — Theme derived from few tokens; both theme variants present so a
 *                 high-contrast override can be enabled without a redesign.
 *   AC-13-004.1 — Tokenized radius/shadow scale (radii sm/md/lg/pill; two-layer shadows).
 *   AC-13-005.1 — Restrained motion (transform/opacity, <300ms) — motion.rules contract.
 *   AC-13-007.1 — No state depends on color alone: each state paired with icon + label.
 */

import { describe, expect, it } from "vitest";
import {
  AGENT_COLOR,
  AGENT_ROLES,
  AGENT_STATES,
  type AgentRole,
  type AgentState,
  CATEGORY_KEYS,
  STATE_BADGE,
  THEME_VARIANTS,
  TIER_KEYS,
  type TokenSchema,
  type TokenValidationResult,
  validateTokenSchema,
} from "../tokens";

// ---------------------------------------------------------------------------
// Fixtures — mirrors the prototype contract (docs/design/design-tokens.json).
// Hex literals, dark default + light. Values reflect the real frozen palette.
// ---------------------------------------------------------------------------

/** A complete theme variant matching the prototype's per-theme group shape. */
function makeVariant(): TokenSchema["themes"]["dark"] {
  return {
    surfaces: { canvas: "#0F1517", panel: "#192123", card: "#222A2D", card2: "#2A3336" },
    text: { t1: "#EDEBE7", t2: "#BAB7B0", t3: "#9E9B94" },
    borders: { bd: "#2F373A", bd2: "#4F5A5D" },
    accent: {
      accent: "#33B6D1",
      accentText: "#62CFE8",
      accentBg: "#003542",
      onAccent: "#071318",
    },
    status: {
      ok: "#5EC386",
      okBg: "#163A27",
      warn: "#EBB25F",
      warnBg: "#3A2E18",
      danger: "#F36356",
      dangerBg: "#3A1A17",
      info: "#5EB6E6",
      infoBg: "#14303D",
    },
    categories: {
      cat1: "#60AD64",
      cat2: "#A278E4",
      cat3: "#E9609E",
      cat4: "#3D96EA",
      cat5: "#2CB3B4",
      cat6: "#37B2E8",
      cat7: "#E39849",
      cat8: "#46B68C",
      cat9: "#EC5C50",
    },
    tiers: {
      tier1: "#989FA8",
      tier2: "#53BE70",
      tier3: "#339FEE",
      tier4: "#B474F4",
      tier5: "#F68C36",
    },
    shadows: {
      shadow: "0 1px 2px rgba(0,0,0,.3),0 8px 28px rgba(0,0,0,.35)",
      shadowPop: "0 18px 50px rgba(0,0,0,.5)",
    },
  };
}

/** Minimal valid token shape — matches the prototype contract / DR-054. */
const VALID_TOKENS: TokenSchema = {
  themes: {
    dark: makeVariant(),
    light: makeVariant(),
  },
  radii: { sm: "8px", md: "12px", lg: "16px", pill: "999px" },
  typography: {
    families: {
      pixel: "'Pixelify Sans', ui-monospace, monospace",
      display: "'Space Grotesk', system-ui, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
      body: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
  },
  spacing: { scale_px: [2, 4, 6, 8, 10, 12, 16, 24] },
  motion: {
    rules: "transform/opacity only, <300ms. Respect prefers-reduced-motion.",
    focus: "outline 2px solid {accent.accent}; outline-offset 2px",
  },
};

// ---------------------------------------------------------------------------
// AC-13-001.1 — Token schema: both theme variants present (dark default + light)
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: validateTokenSchema — theme variants", () => {
  it("frd-13: WHEN a valid token file is supplied THEN validation succeeds with no errors", () => {
    const result: TokenValidationResult = validateTokenSchema(VALID_TOKENS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("frd-13: THEME_VARIANTS enumerates exactly the prototype's two themes (dark default + light)", () => {
    expect(THEME_VARIANTS).toEqual(["dark", "light"]);
  });

  it("frd-13: WHEN themes.dark is missing THEN validation fails mentioning the missing theme", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes as Record<string, unknown>).dark;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.light is missing THEN validation fails mentioning the missing theme", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes as Record<string, unknown>).light;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.light/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a theme variant is missing its surfaces group THEN validation fails naming the path", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark as Record<string, unknown>).surfaces;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.surfaces/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.dark.surfaces.canvas is missing THEN validation fails naming the leaf token", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark.surfaces as Record<string, unknown>).canvas;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.surfaces\.canvas/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.light.accent.accent is missing THEN validation fails (the rationed accent must exist per theme)", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.light.accent as Record<string, unknown>).accent;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.light\.accent\.accent/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a theme variant is a primitive THEN validation fails (a variant must be a plain object)", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad.themes as Record<string, unknown>).dark = "oklch(...)";
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-001.1 / AC-13-007.1 — category (9) and tier (5) slots present per theme
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: validateTokenSchema — category and tier completeness", () => {
  it("frd-13: CATEGORY_KEYS enumerates the 9 idea-category slots", () => {
    expect(CATEGORY_KEYS).toHaveLength(9);
  });

  it("frd-13: TIER_KEYS enumerates the 5 rarity tiers (Bronze → Legend)", () => {
    expect(TIER_KEYS).toHaveLength(5);
  });

  it("frd-13: WHEN a category slot is missing from a theme THEN validation fails naming it", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark.categories as Record<string, unknown>).cat5;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.categories\.cat5/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a tier slot is missing from a theme THEN validation fails naming it", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.light.tiers as Record<string, unknown>).tier3;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.light\.tiers\.tier3/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a status background pair is missing THEN validation fails (status colors ship with a -Bg)", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark.status as Record<string, unknown>).dangerBg;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.status\.dangerBg/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-004.1 — Radii scale + two-layer shadows
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-004.1: validateTokenSchema — radii and shadow scale", () => {
  it("frd-13: WHEN radii is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).radii;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /radii/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a radii token is absent THEN validation fails naming the missing step", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.radii as Record<string, unknown>).md;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /radii\.md/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a theme's shadows.shadowPop is absent THEN validation fails (the two-layer scale must be complete)", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark.shadows as Record<string, unknown>).shadowPop;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.shadows\.shadowPop/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a theme's shadows group is empty-string-valued THEN validation fails (no empty shadow literals)", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad.themes.light.shadows as Record<string, unknown>).shadow = "";
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.light\.shadows\.shadow/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-005.1 — Motion contract (transform/opacity, <300ms) + focus ring
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1 / AC-13-008.1: validateTokenSchema — motion and focus", () => {
  it("frd-13: WHEN motion is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).motion;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /motion/.test(e))).toBe(true);
  });

  it("frd-13: WHEN motion.rules is absent THEN validation fails (the transform/opacity <300ms rule is the contract)", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.motion as Record<string, unknown>).rules;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /motion\.rules/.test(e))).toBe(true);
  });

  it("frd-13: WHEN motion.focus is absent THEN validation fails (a focus-ring spec is mandatory, AC-13-008.1)", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.motion as Record<string, unknown>).focus;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /motion\.focus/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// typography & spacing — present and non-empty
// ---------------------------------------------------------------------------

describe("frd-13: validateTokenSchema — typography and spacing presence", () => {
  it("frd-13: WHEN typography is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).typography;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /typography/.test(e))).toBe(true);
  });

  it("frd-13: WHEN spacing is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).spacing;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /spacing/.test(e))).toBe(true);
  });

  it("frd-13: WHEN typography is an empty object THEN validation fails (a token-less typography group is invalid)", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad as Record<string, unknown>).typography = {};
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /typography/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Agent palette — all roles present in AGENT_COLOR
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1 / IF-13-agent-colors: AGENT_COLOR covers all canonical roles", () => {
  it("frd-13: AGENT_ROLES must enumerate all 13 canonical roles (source of truth for AGENT_COLOR and the token palette)", () => {
    // Realignment 2026-06-18 (Party redesign): add implementer/copywriter/analytics/devops,
    // remove the fictitious 'guild' aggregate. Source: prototype/party-redesign-spec.md §2.
    const expected: AgentRole[] = [
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
    ];
    expect(AGENT_ROLES).toEqual(expect.arrayContaining(expected));
    expect(AGENT_ROLES).toHaveLength(expected.length);
  });

  it("frd-13: AGENT_COLOR is defined for every role in AGENT_ROLES", () => {
    for (const role of AGENT_ROLES) {
      expect(AGENT_COLOR[role], `AGENT_COLOR is missing an entry for role "${role}"`).toBeDefined();
    }
  });

  it("frd-13: AGENT_COLOR values are non-empty strings (CSS token key or var reference)", () => {
    for (const role of AGENT_ROLES) {
      const tokenKey = AGENT_COLOR[role];
      expect(typeof tokenKey).toBe("string");
      expect((tokenKey as string).length).toBeGreaterThan(0);
    }
  });

  it("frd-13: AGENT_COLOR contains no extra roles beyond AGENT_ROLES (single source of truth)", () => {
    const keys = Object.keys(AGENT_COLOR) as AgentRole[];
    expect(keys).toHaveLength(AGENT_ROLES.length);
    for (const key of keys) {
      expect(AGENT_ROLES).toContain(key);
    }
  });

  it("frd-13: each role maps to a distinct token key (no two roles share the same color token)", () => {
    const values = Object.values(AGENT_COLOR);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// IF-13-state-vocab — STATE_BADGE key map
// (AC-13-007.1: no state depends on color alone — icon+label required)
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-007.1 / IF-13-state-vocab: STATE_BADGE covers all 6 states", () => {
  it("frd-13: AGENT_STATES must enumerate the 6 canonical states from blueprint IF-13-state-vocab", () => {
    const expected: AgentState[] = [
      "working",
      "idle",
      "failed",
      "completed",
      "blocked",
      "reviewing",
    ];
    expect(AGENT_STATES).toEqual(expect.arrayContaining(expected));
    expect(AGENT_STATES).toHaveLength(expected.length);
  });

  it("frd-13: STATE_BADGE is defined for every state in AGENT_STATES", () => {
    for (const state of AGENT_STATES) {
      expect(
        STATE_BADGE[state],
        `STATE_BADGE is missing an entry for state "${state}"`,
      ).toBeDefined();
    }
  });

  it("frd-13: WHEN state is 'working' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.working;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'idle' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.idle;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'failed' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.failed;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'completed' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.completed;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'blocked' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    // Regression: FRD-13 body lists only 4 states; blueprint IF-13-state-vocab adds 'blocked'
    // and 'reviewing'. Both must be in the vocab or FRD-06/Party will have to hard-code them.
    const badge = STATE_BADGE.blocked;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'reviewing' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    // Regression: same reasoning as 'blocked' above.
    const badge = STATE_BADGE.reviewing;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: every STATE_BADGE entry has both icon AND label — no state is color-only", () => {
    for (const state of AGENT_STATES) {
      const badge = STATE_BADGE[state];
      expect(badge, `STATE_BADGE["${state}"] is undefined`).toBeDefined();
      expect(badge.icon.length, `STATE_BADGE["${state}"].icon must be non-empty`).toBeGreaterThan(
        0,
      );
      expect(badge.label.length, `STATE_BADGE["${state}"].label must be non-empty`).toBeGreaterThan(
        0,
      );
    }
  });

  it("frd-13: STATE_BADGE contains no extra states beyond AGENT_STATES (closed vocabulary)", () => {
    const keys = Object.keys(STATE_BADGE) as AgentState[];
    expect(keys).toHaveLength(AGENT_STATES.length);
    for (const key of keys) {
      expect(AGENT_STATES).toContain(key);
    }
  });

  it("frd-13: all STATE_BADGE labels are distinct (no two states share the same label)", () => {
    const labels = AGENT_STATES.map((s) => STATE_BADGE[s].label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

// ---------------------------------------------------------------------------
// Property-based: validateTokenSchema is stable across token value mutations
// (exercises invariants that enumerated tests don't reach)
// ---------------------------------------------------------------------------

describe("frd-13: validateTokenSchema structural invariants", () => {
  it("frd-13: removing ANY top-level required key always makes validation fail", () => {
    const requiredTopLevel = ["themes", "radii", "typography", "spacing", "motion"] as const;

    for (const key of requiredTopLevel) {
      const bad = structuredClone(VALID_TOKENS);
      delete (bad as Record<string, unknown>)[key];
      const result = validateTokenSchema(bad);
      expect(result.valid, `Removing "${key}" should make schema invalid`).toBe(false);
      expect(
        result.errors.length,
        `Removing "${key}" should produce at least one error`,
      ).toBeGreaterThan(0);
    }
  });

  it("frd-13: validation errors are always strings and never empty strings", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes.dark as Record<string, unknown>).surfaces; // Force failure
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    for (const error of result.errors) {
      expect(typeof error).toBe("string");
      expect(error.length).toBeGreaterThan(0);
    }
  });

  it("frd-13: a valid schema always returns an empty errors array (no silent partial failures)", () => {
    const result = validateTokenSchema(VALID_TOKENS);
    expect(result.errors).toHaveLength(0);
  });

  it("frd-13: WHEN two required keys are missing simultaneously THEN validation accumulates both errors (no short-circuit)", () => {
    // Mutation target: a validator that returns early on first failure would miss subsequent
    // errors and make diagnosis harder for the token author.
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).radii;
    delete (bad as Record<string, unknown>).motion;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /radii/.test(e))).toBe(true);
    expect(result.errors.some((e) => /motion/.test(e))).toBe(true);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Edge-case inputs to validateTokenSchema (non-object, empty, malformed)
// ---------------------------------------------------------------------------

describe("frd-13: validateTokenSchema — degenerate inputs", () => {
  it("frd-13: WHEN called with null THEN validation fails with a clear error (not a runtime throw)", () => {
    const result = validateTokenSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN called with an array THEN validation fails (arrays are not valid token objects)", () => {
    const result = validateTokenSchema([]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN called with a primitive string THEN validation fails without throwing", () => {
    const result = validateTokenSchema("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN called with an empty object THEN validation fails listing all missing required keys", () => {
    const result = validateTokenSchema({});
    expect(result.valid).toBe(false);
    // All 5 required top-level keys must be reported.
    const requiredKeys = ["themes", "radii", "typography", "spacing", "motion"];
    for (const key of requiredKeys) {
      expect(
        result.errors.some((e) => new RegExp(key).test(e)),
        `Expected an error mentioning "${key}" when the whole object is empty`,
      ).toBe(true);
    }
  });

  it("frd-13: WHEN a theme variant is an empty object THEN validation fails listing ALL missing groups", () => {
    // Catches a validator that only checks for the theme key's presence, not for the
    // completeness of its token groups.
    const bad = structuredClone(VALID_TOKENS);
    (bad.themes as Record<string, unknown>).dark = {};
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    for (const group of [
      "surfaces",
      "text",
      "borders",
      "accent",
      "status",
      "categories",
      "tiers",
      "shadows",
    ]) {
      expect(
        result.errors.some((e) => new RegExp(`themes\\.dark\\.${group}`).test(e)),
        `Expected an error for missing group "themes.dark.${group}"`,
      ).toBe(true);
    }
  });

  it("frd-13: WHEN themes is a positional array THEN validation fails (arrays masquerade as objects)", () => {
    // Regression guard: an array passes `typeof value === 'object'` but theme variants are
    // referenced by name (dark/light), not position. The array guard must fire.
    const bad = structuredClone(VALID_TOKENS);
    (bad as Record<string, unknown>).themes = [makeVariant(), makeVariant()];
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a theme's categories group is a positional array THEN validation fails (named slots, not indices)", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad.themes.dark as Record<string, unknown>).categories = ["#60AD64", "#A278E4"];
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.categories/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a token leaf is a number instead of a color string THEN validation fails (no non-string token values)", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad.themes.dark.surfaces as Record<string, unknown>).canvas = 123;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark\.surfaces\.canvas/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IF-13-agent-colors: AGENT_COLOR token-key naming convention
// (downstream contract: globals.css maps --color-agent-<role> via @theme)
// ---------------------------------------------------------------------------

describe("frd-13 IF-13-agent-colors: AGENT_COLOR naming convention", () => {
  it("frd-13: each AGENT_COLOR value follows the '--color-agent-<role>' CSS custom property convention", () => {
    // The convention is the downstream contract: globals.css and FRD-06/FRD-12 resolve
    // `var(--color-agent-<role>)` through Tailwind v4 @theme. A value that breaks this
    // pattern (e.g. a bare hex, a class name, or an old var name) would silently produce
    // invisible agents in the UI.
    const cssVarPattern = /^--[a-z][a-z0-9-]*$/;
    for (const role of AGENT_ROLES) {
      const tokenKey = AGENT_COLOR[role];
      expect(
        cssVarPattern.test(tokenKey),
        `AGENT_COLOR["${role}"] value "${tokenKey}" must be a valid CSS custom property name (--color-agent-*)`,
      ).toBe(true);
    }
  });

  it("frd-13: each AGENT_COLOR value contains the role slug as a substring (traceability to the token palette)", () => {
    // Ensures e.g. AGENT_COLOR['researcher'] → '--color-agent-researcher', not a generic
    // '--color-primary' that loses the per-agent identity required by FRD-06 sprites/DAG.
    for (const role of AGENT_ROLES) {
      const tokenKey = AGENT_COLOR[role];
      expect(
        tokenKey.includes(role),
        `AGENT_COLOR["${role}"] value "${tokenKey}" must contain the role slug "${role}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// IF-13-state-vocab: STATE_BADGE icon format
// (downstream contract: StateBadge resolves icon via lucide-react dynamic import)
// ---------------------------------------------------------------------------

describe("frd-13 IF-13-state-vocab: STATE_BADGE icon identifier format", () => {
  it("frd-13: each STATE_BADGE icon is a kebab-case string (valid Lucide icon identifier)", () => {
    // lucide-react resolves icons by kebab-case name (e.g. 'loader-circle').
    // An icon containing spaces, uppercase letters, or special chars would fail at render time
    // with no TypeScript error — only caught here.
    const kebabPattern = /^[a-z][a-z0-9-]*$/;
    for (const state of AGENT_STATES) {
      const { icon } = STATE_BADGE[state];
      expect(
        kebabPattern.test(icon),
        `STATE_BADGE["${state}"].icon "${icon}" must be a kebab-case Lucide identifier`,
      ).toBe(true);
    }
  });

  it("frd-13: each STATE_BADGE label contains only printable characters (no control chars or lone emoji)", () => {
    // Guards against copy-paste accidents that introduce zero-width spaces or control
    // characters into the Spanish label, which would silently display wrong in aria-label.
    // eslint-disable-next-line no-control-regex
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-character test
    const controlCharPattern = /[\x00-\x1F\x7F]/;
    for (const state of AGENT_STATES) {
      const { label } = STATE_BADGE[state];
      expect(
        controlCharPattern.test(label),
        `STATE_BADGE["${state}"].label "${label}" must not contain control characters`,
      ).toBe(false);
    }
  });
});
