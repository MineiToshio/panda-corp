/**
 * WO-13-001 — Token schema validation + agent-color/state-vocab key maps
 *
 * RED phase: all tests are expected to fail until the implementation exists.
 *
 * Traces:
 *   AC-13-001.1 — Theme derived from few tokens in perceptual space (OKLCH: base, accent, contrast);
 *                 high-contrast mode without redesign.
 *   AC-13-004.1 — Elevation has 3 levels; radius 8px, base 16px, hairline 1px,
 *                 spacing in 0.25rem multiples.
 *   AC-13-005.1 — Animation duration <300ms; 2–3 easing tokens.
 *   AC-13-007.1 — No state depends on color alone: each state paired with icon + label.
 *
 * Bugs anchored in PARTY.md and design/brief.md:
 *   - All ~10 agent roles must have a color key (brief.md §6, PARTY.md §6 agent list).
 *   - STATE_BADGE must cover both the FRD-13 list (working/idle/failed/completed) AND the
 *     blueprint's extended list (+ blocked/reviewing), because PARTY.md §1 defines 5 visual
 *     states and the blueprint defines 6.
 */

import { describe, expect, it } from "vitest";
import {
  AGENT_COLOR,
  AGENT_ROLES,
  AGENT_STATES,
  type AgentRole,
  type AgentState,
  STATE_BADGE,
  type TokenSchema,
  type TokenValidationResult,
  validateTokenSchema,
} from "./tokens";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid token shape — matches blueprint §3 / WO-13-001 Scope. */
const VALID_TOKENS: TokenSchema = {
  oklch: {
    base: "oklch(0.15 0.02 230)",
    accent: "oklch(0.75 0.18 60)",
    contrast: "oklch(0.97 0.01 230)",
  },
  themes: {
    light: { surface: "oklch(0.97 0.005 230)", text: "oklch(0.12 0.02 230)" },
    dark: { surface: "oklch(0.1 0.015 230)", text: "oklch(0.95 0.01 230)" },
    highContrast: {
      surface: "oklch(0 0 0)",
      text: "oklch(1 0 0)",
    },
  },
  agents: {
    researcher: "oklch(0.65 0.18 45)",
    "backend-dev": "oklch(0.55 0.2 260)",
    "frontend-dev": "oklch(0.65 0.22 200)",
    "test-writer": "oklch(0.7 0.2 130)",
    reviewer: "oklch(0.65 0.2 300)",
    "security-auditor": "oklch(0.6 0.18 20)",
    architect: "oklch(0.6 0.2 240)",
    "product-manager": "oklch(0.7 0.18 85)",
    designer: "oklch(0.7 0.22 330)",
    guild: "oklch(0.75 0.16 60)",
  },
  elevation: [
    { shadow: "none", spacing: "0" },
    { shadow: "0 1px 4px oklch(0 0 0 / 0.15)", spacing: "0.25rem" },
    { shadow: "0 4px 16px oklch(0 0 0 / 0.25)", spacing: "0.5rem" },
  ],
  radius: "0.5rem",
  spacing: "1rem",
  hairline: "1px",
  motion: {
    duration: {
      fast: 150,
      base: 200,
      expressive: 280,
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
    },
  },
};

// ---------------------------------------------------------------------------
// AC-13-001.1 — Token schema: OKLCH perceptual space + theme trio
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: validateTokenSchema — oklch keys", () => {
  it("frd-13: WHEN a valid token file is supplied THEN validation succeeds with no errors", () => {
    const result: TokenValidationResult = validateTokenSchema(VALID_TOKENS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("frd-13: WHEN oklch.base is missing THEN validation fails with an actionable message", () => {
    const bad = structuredClone(VALID_TOKENS);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (bad.oklch as Record<string, unknown>).base;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /oklch\.base/.test(e))).toBe(true);
  });

  it("frd-13: WHEN oklch.accent is missing THEN validation fails with an actionable message", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.oklch as Record<string, unknown>).accent;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /oklch\.accent/.test(e))).toBe(true);
  });

  it("frd-13: WHEN oklch.contrast is missing THEN validation fails with an actionable message", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.oklch as Record<string, unknown>).contrast;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /oklch\.contrast/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.light is missing THEN validation fails mentioning the missing theme", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes as Record<string, unknown>).light;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.light/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.dark is missing THEN validation fails mentioning the missing theme", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes as Record<string, unknown>).dark;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.dark/.test(e))).toBe(true);
  });

  it("frd-13: WHEN themes.highContrast is missing THEN validation fails — high-contrast mode must not require a redesign", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.themes as Record<string, unknown>).highContrast;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /themes\.highContrast/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-004.1 — Elevation: exactly 3 levels + spacing/radius/hairline scale
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-004.1: validateTokenSchema — elevation and spacing scale", () => {
  it("frd-13: WHEN elevation has fewer than 3 levels THEN validation fails mentioning elevation", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.elevation = bad.elevation.slice(0, 2);
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation/.test(e))).toBe(true);
  });

  it("frd-13: WHEN elevation has more than 3 levels THEN validation fails (unbounded levels break the restrained scale)", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.elevation = [
      ...bad.elevation,
      { shadow: "0 8px 32px oklch(0 0 0 / 0.4)", spacing: "1rem" },
    ];
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation/.test(e))).toBe(true);
  });

  // I1 fix coverage: per-entry validation of shadow + spacing (AC-13-004.1)
  it("frd-13: WHEN elevation has 3 empty objects THEN validation fails — empty objects are not a tokenised scale", () => {
    // Regression guard: the pre-fix validator only checked count, not entry shape.
    // [{}, {}, {}] would have silently passed even though no shadow/spacing was provided.
    const bad = structuredClone(VALID_TOKENS);
    (bad as Record<string, unknown>).elevation = [{}, {}, {}];
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation\[/.test(e))).toBe(true);
  });

  it("frd-13: WHEN elevation[1] is missing shadow THEN validation fails naming the index and field", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.elevation[1] as unknown as Record<string, unknown>).shadow;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation\[1\]\.shadow/.test(e))).toBe(true);
  });

  it("frd-13: WHEN elevation[0] has an empty-string shadow THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    (bad.elevation[0] as unknown as Record<string, unknown>).shadow = "";
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation\[0\]\.shadow/.test(e))).toBe(true);
  });

  it("frd-13: WHEN elevation[2] is missing spacing THEN validation fails naming the index and field", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad.elevation[2] as unknown as Record<string, unknown>).spacing;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /elevation\[2\]\.spacing/.test(e))).toBe(true);
  });

  it("frd-13: WHEN elevation entries are all well-formed THEN entry-level validation passes", () => {
    // Guard against the fix accidentally breaking the happy path.
    const result = validateTokenSchema(VALID_TOKENS);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => /elevation\[/.test(e))).toHaveLength(0);
  });

  it("frd-13: WHEN radius token is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).radius;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /radius/.test(e))).toBe(true);
  });

  it("frd-13: WHEN hairline token is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).hairline;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /hairline/.test(e))).toBe(true);
  });

  it("frd-13: WHEN spacing token is absent THEN validation fails", () => {
    const bad = structuredClone(VALID_TOKENS);
    delete (bad as Record<string, unknown>).spacing;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /spacing/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-005.1 — Animation: all durations <300ms, 2–3 easing tokens
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1: validateTokenSchema — motion constraints", () => {
  it("frd-13: WHEN a motion duration equals 300ms THEN validation fails (must be strictly less than 300)", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.motion.duration.base = 300;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /duration|300/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a motion duration exceeds 300ms THEN validation fails with the offending value", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.motion.duration.expressive = 350;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /duration|350/.test(e))).toBe(true);
  });

  it("frd-13: WHEN there is only 1 easing token THEN validation fails (minimum is 2)", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.motion.easing = { standard: "cubic-bezier(0.4, 0, 0.2, 1)" };
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /easing/.test(e))).toBe(true);
  });

  it("frd-13: WHEN there are 4 easing tokens THEN validation fails (maximum is 3)", () => {
    const bad = structuredClone(VALID_TOKENS);
    bad.motion.easing = {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      snap: "cubic-bezier(0.77, 0, 0.18, 1)",
    };
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /easing/.test(e))).toBe(true);
  });

  it("frd-13: WHEN exactly 2 easing tokens are present THEN validation succeeds", () => {
    // Already covered by VALID_TOKENS (2 easings) — explicit assertion for clarity.
    const result = validateTokenSchema(VALID_TOKENS);
    expect(result.valid).toBe(true);
  });

  it("frd-13: WHEN exactly 3 easing tokens are present THEN validation succeeds", () => {
    const good = structuredClone(VALID_TOKENS);
    good.motion.easing = {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      expressive: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
    const result = validateTokenSchema(good);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Agent palette — all roles present in tokens.agents
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: validateTokenSchema — agent palette completeness", () => {
  it("frd-13: WHEN an agent role is missing from tokens.agents THEN validation fails naming the missing role", () => {
    const bad = structuredClone(VALID_TOKENS);
    // Remove one role to trigger failure
    delete (bad.agents as Record<string, unknown>).researcher;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /researcher/.test(e))).toBe(true);
  });

  it("frd-13: WHEN all 10 canonical roles are present in tokens.agents THEN validation succeeds", () => {
    const result = validateTokenSchema(VALID_TOKENS);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IF-13-agent-colors — AGENT_COLOR key map
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1 / IF-13-agent-colors: AGENT_COLOR covers all canonical roles", () => {
  it("frd-13: AGENT_ROLES must enumerate all ~10 canonical roles (source of truth for AGENT_COLOR and the token palette)", () => {
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
      "guild",
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
    const requiredTopLevel = [
      "oklch",
      "themes",
      "agents",
      "elevation",
      "radius",
      "spacing",
      "hairline",
      "motion",
    ] as const;

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
    bad.motion.duration.fast = 500; // Force failure
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
    delete (bad as Record<string, unknown>).radius;
    delete (bad as Record<string, unknown>).hairline;
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /radius/.test(e))).toBe(true);
    expect(result.errors.some((e) => /hairline/.test(e))).toBe(true);
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
    // An empty object has no oklch, themes, agents, elevation, radius, spacing, hairline, motion.
    // The validator must enumerate them all, not just stop at the first.
    const result = validateTokenSchema({});
    expect(result.valid).toBe(false);
    // All 8 required top-level keys must be reported.
    const requiredKeys = [
      "oklch",
      "themes",
      "agents",
      "elevation",
      "radius",
      "spacing",
      "hairline",
      "motion",
    ];
    for (const key of requiredKeys) {
      expect(
        result.errors.some((e) => new RegExp(key).test(e)),
        `Expected an error mentioning "${key}" when the whole object is empty`,
      ).toBe(true);
    }
  });

  it("frd-13: WHEN agents is an empty object THEN validation fails listing ALL missing canonical roles", () => {
    // The single-role removal test (above) only exercises the removal of one role; this exercises
    // the case where the entire agents map is present but empty — catching a validator that
    // only checks for key existence, not for completeness of the role set.
    const bad = structuredClone(VALID_TOKENS);
    (bad as Record<string, unknown>).agents = {};
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    for (const role of AGENT_ROLES) {
      expect(
        result.errors.some((e) => new RegExp(role).test(e)),
        `Expected an error for missing role "${role}"`,
      ).toBe(true);
    }
  });

  it("frd-13: WHEN motion.easing is an empty object THEN validation fails (0 < minimum of 2)", () => {
    // The "1 easing" test above covers count < 2 from the upper side; zero is a distinct
    // degenerate case (an agent might accidentally clear the easing map).
    const bad = structuredClone(VALID_TOKENS);
    bad.motion.easing = {};
    const result = validateTokenSchema(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /easing/.test(e))).toBe(true);
  });

  it("frd-13: WHEN a motion.duration value is a non-number THEN validation does not silently accept it", () => {
    // The validator checks `typeof value === 'number' && value >= 300`. A non-number slips
    // through without a 300ms check. The token JSON schema should reject non-numeric durations.
    const bad = structuredClone(VALID_TOKENS);
    (bad.motion.duration as Record<string, unknown>).fast = "150ms"; // string, not number
    const result = validateTokenSchema(bad);
    // A non-numeric duration is an invalid shape — the validator must flag it.
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /duration/.test(e))).toBe(true);
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
