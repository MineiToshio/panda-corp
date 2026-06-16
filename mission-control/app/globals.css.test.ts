/**
 * WO-13-002 — globals.css wiring acceptance tests (RED phase)
 *
 * Traces:
 *   AC-13-001.1 — Theme derived from few tokens in perceptual space (OKLCH: base, accent,
 *                 contrast); high-contrast mode without redesign.
 *   AC-13-002.1 — A single rationed accent; the rest warm neutrals.
 *   AC-13-004.1 — 3 elevation levels with a tokenized shadow/spacing scale (radius 8px,
 *                 base 16px, hairline 1px, spacing in multiples of 0.25rem).
 *   AC-13-005.1 — Animation only transform/opacity, <300ms, 2–3 easing tokens.
 *   AC-13-006.1 — UI honors prefers-reduced-motion: disables ALL Party animation.
 *   AC-13-008.1 — Visible focus ring that respects border-radius.
 *
 * Approach:
 *   CSS cannot be exercised in jsdom by simply injecting globals.css — jsdom has no layout
 *   engine and CSSOM variables are not computed. Instead, the tests parse the CSS source
 *   text and assert the structural/textual contracts that CMP-13-globals must satisfy:
 *     (a) the @theme block declares the required CSS custom properties;
 *     (b) the three theme modes (light/dark/high-contrast) are wired;
 *     (c) the 3 elevation levels are present;
 *     (d) animation tokens are declared (durations, easings);
 *     (e) @media (prefers-reduced-motion: reduce) zeroes durations globally;
 *     (f) the focus-ring var is declared.
 *
 *   Token values come from the FROZEN_TOKENS fixture defined below.  When
 *   docs/design/design-tokens.json is committed, the implementer must produce a globals.css
 *   that satisfies these structural contracts.  Tests deliberately do NOT check specific
 *   OKLCH value strings — those belong to the design phase, not the CSS wiring gate.
 *
 * Real bugs anchored (progress.md):
 *   - B1'/I2/I3 from WO-13-001 review: fail-open guards for NaN/Infinity/empty/array motion
 *     tokens — the CSS wiring must not emit CSS vars for non-finite or array-valued tokens.
 *   - The layout guard test revealed that a "present but empty" file still passes presence
 *     checks — regression: globals.css must not be empty (zero @theme vars = invalid wiring).
 */

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Absolute path to globals.css — resolved relative to this test file's directory.
 * Using import.meta.dirname (Node 20+ / vitest 4.x) so the path is correct
 * regardless of cwd at test run time (avoids the /app/ jsdom URL truncation).
 */
const GLOBALS_CSS_PATH = path.resolve(import.meta.dirname, "globals.css");

// ---------------------------------------------------------------------------
// Frozen token fixture (mirrors the WO-13-001 VALID_TOKENS shape).
// Used to document what values the implementer must wire into globals.css.
// ---------------------------------------------------------------------------

const FROZEN_TOKENS = {
  oklch: {
    base: "oklch(0.15 0.02 230)",
    accent: "oklch(0.75 0.18 60)",
    contrast: "oklch(0.97 0.01 230)",
  },
  themes: {
    light: { surface: "oklch(0.97 0.005 230)", text: "oklch(0.12 0.02 230)" },
    dark: { surface: "oklch(0.1 0.015 230)", text: "oklch(0.95 0.01 230)" },
    highContrast: { surface: "oklch(0 0 0)", text: "oklch(1 0 0)" },
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
    duration: { fast: 150, base: 200, expressive: 280 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the CSS source and normalise whitespace for pattern matching. */
function readCss(): string {
  return fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
}

/**
 * Extract the content of a named CSS at-rule block.
 * e.g. extractBlock(css, '@theme') returns the text inside `@theme { ... }`.
 * Works for top-level single-opening-brace blocks only.
 */
function extractBlock(css: string, atRule: string): string {
  // Find the position of the at-rule keyword then walk braces.
  const start = css.indexOf(atRule);
  if (start === -1) return "";
  let depth = 0;
  let open = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") {
      if (open === -1) open = i;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0 && open !== -1) return css.slice(open + 1, i);
    }
  }
  return "";
}

/**
 * Extract the body of @media (prefers-reduced-motion: reduce) { ... }.
 * Handles the case where the media query string contains spaces/colons.
 */
function extractReducedMotionBlock(css: string): string {
  // Normalise: remove newlines inside the token for index-search reliability.
  const marker = "prefers-reduced-motion";
  const pos = css.indexOf(marker);
  if (pos === -1) return "";
  // Walk forward to find the opening brace of the media block.
  let depth = 0;
  let open = -1;
  for (let i = pos; i < css.length; i++) {
    if (css[i] === "{") {
      if (open === -1) open = i;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0 && open !== -1) return css.slice(open + 1, i);
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Pre-conditions — globals.css must exist and be non-empty
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: globals.css exists and is non-empty (CMP-13-globals precondition)", () => {
  it("frd-13: globals.css must exist at app/globals.css", () => {
    expect(fs.existsSync(GLOBALS_CSS_PATH)).toBe(true);
  });

  it("frd-13: globals.css must not be empty — an empty file wires zero theme vars (regression: layout guard lesson)", () => {
    // Anchored in layout.guard.test.tsx finding: "present but empty" passes presence checks
    // but is functionally equivalent to absent. Same principle applies to globals.css.
    const content = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("frd-13: globals.css must import tailwindcss (Tailwind v4 CSS-first entry point)", () => {
    const css = readCss();
    expect(css).toMatch(/@import\s+["']tailwindcss["']/);
  });
});

// ---------------------------------------------------------------------------
// AC-13-001.1 — @theme block: OKLCH base/accent/contrast + three theme modes
// (REQ-13-001: theme from few tokens in perceptual space; high-contrast without redesign)
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: @theme block declares required OKLCH custom properties", () => {
  let themeBlock: string;

  beforeAll(() => {
    themeBlock = extractBlock(readCss(), "@theme");
  });

  it("frd-13: @theme block must exist in globals.css (Tailwind v4 CSS-first token wiring)", () => {
    expect(themeBlock.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares --color-base (OKLCH base token)", () => {
    // Mutation target: removing this line would make every component that reads the base
    // color resolve to the browser default instead of the design token.
    expect(themeBlock).toMatch(/--color-base\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares --color-accent (the single rationed accent, AC-13-002.1)", () => {
    expect(themeBlock).toMatch(/--color-accent\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares --color-contrast (OKLCH contrast token)", () => {
    expect(themeBlock).toMatch(/--color-contrast\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme uses oklch() values (perceptual color space mandate)", () => {
    // The blueprint §1 and AC-13-001.1 require OKLCH. RGB/HSL hex values must not appear
    // as the primary theme token values (they indicate a wiring from a non-design-phase source).
    expect(themeBlock).toMatch(/oklch\(/i);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares per-agent color vars for all 10 canonical roles (IF-13-agent-colors)", () => {
    // Each agent role must have a --color-agent-<role> custom property so FRD-06 and
    // FRD-12 can read var(--color-agent-researcher) etc. without hard-coding.
    const agentRoles = Object.keys(FROZEN_TOKENS.agents);
    for (const role of agentRoles) {
      expect(
        themeBlock,
        `@theme is missing --color-agent-${role} (required by AGENT_COLOR contract in IF-13-agent-colors)`,
      ).toMatch(new RegExp(`--color-agent-${role}\\s*:`));
    }
  });
});

// ---------------------------------------------------------------------------
// AC-13-001.1 — Theme mode switching: light / dark / high-contrast
// (EARS: "a high-contrast mode can be enabled without a redesign")
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1: theme modes — light, dark, high-contrast", () => {
  it("frd-13: WHEN globals.css is wired THEN it contains a light-theme selector with surface and text vars", () => {
    const css = readCss();
    // The theme is toggled via a data attribute or class (blueprint §2: color-scheme + data-attr).
    // Accept either [data-theme='light'], .light, or :root.light as selectors.
    // The key contract is that switching the attribute changes resolved vars (DoD).
    expect(css).toMatch(/light/);
    // Must declare surface and text custom properties in the light context.
    expect(css).toMatch(/--color-surface\s*:/);
    expect(css).toMatch(/--color-text\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it contains a dark-theme selector that overrides surface and text vars", () => {
    const css = readCss();
    // Must be a CSS selector containing "dark", not just the word in `color-scheme: light dark`.
    // Acceptable: [data-theme="dark"], .dark, :root.dark, @media (prefers-color-scheme: dark).
    // The regex anchors to a selector-like token: a bracket, dot, colon, or @media context.
    expect(css).toMatch(
      /(?:\[data-theme=['"]dark['"]|\.dark\b|:root\.dark|prefers-color-scheme:\s*dark)/,
    );
    // The dark theme must also override surface and text vars.
    // Extract the dark-mode block(s) to check for var declarations.
    const darkBlockPattern =
      /(?:\[data-theme=['"]dark['"]|\.dark|prefers-color-scheme:\s*dark)[^{]*\{([^}]+)\}/g;
    const darkMatches = [...css.matchAll(darkBlockPattern)];
    const darkBody = darkMatches.map((m) => m[1] ?? "").join("\n");
    expect(darkBody).toMatch(/--color-surface\s*:/);
    expect(darkBody).toMatch(/--color-text\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it contains a high-contrast selector (AC-13-001.1: no redesign required)", () => {
    // High-contrast mode must be a selector override of the same token vars — not a
    // separate stylesheet. If this selector is absent, enabling high-contrast requires a
    // redesign, which violates AC-13-001.1.
    const css = readCss();
    expect(css).toMatch(/high-contrast|highContrast/i);
  });

  it("frd-13: WHEN globals.css is wired THEN color-scheme is set on :root (enables native light/dark affordances)", () => {
    // color-scheme: light dark on :root is required so browser chrome (scrollbars,
    // form controls) follows the theme. Blueprint §2 explicitly lists this.
    const css = readCss();
    expect(css).toMatch(/color-scheme\s*:/);
    expect(css).toMatch(/light\s+dark|dark\s+light/);
  });
});

// ---------------------------------------------------------------------------
// AC-13-004.1 — Elevation: 3 levels with tokenized shadow + spacing scale
// (blueprint: radius 8px, base 16px, hairline 1px, spacing in 0.25rem multiples)
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-004.1: elevation — 3 levels and spacing/radius/hairline scale", () => {
  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-0 shadow (canvas — no elevation)", () => {
    const css = readCss();
    // Canvas is the lowest elevation: no shadow or explicit 'none'.
    expect(css).toMatch(/--shadow-0\s*:|--elevation-0\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-1 shadow (panel)", () => {
    const css = readCss();
    expect(css).toMatch(/--shadow-1\s*:|--elevation-1\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-2 shadow (card/popup)", () => {
    const css = readCss();
    expect(css).toMatch(/--shadow-2\s*:|--elevation-2\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares the base radius token (8px per blueprint)", () => {
    // Radius 8px is a hard spec from AC-13-004.1.
    const css = readCss();
    expect(css).toMatch(/--radius\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN the radius value is 8px (or 0.5rem — blueprint AC-13-004.1)", () => {
    const css = readCss();
    // The spec says radius 8px; 0.5rem equals 8px at the default 16px root.
    expect(css).toMatch(/--radius\s*:\s*(8px|0\.5rem)/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares the base spacing token (16px = 1rem per blueprint)", () => {
    // NOTE: Tailwind v4 reserves --spacing as its spacing-scale multiplier (default 0.25rem).
    // Overriding --spacing in @theme 4x-inflates every p-*/m-*/gap-* utility — a framework
    // regression (adversarial test axis A). The base 16px elevation token is named --space-base
    // to avoid the collision. See globals.css.adversarial.test.ts (B1 fix).
    const css = readCss();
    expect(css).toMatch(/--space-base\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares the hairline token (1px per blueprint)", () => {
    const css = readCss();
    expect(css).toMatch(/--hairline\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN the hairline value is 1px (blueprint AC-13-004.1)", () => {
    const css = readCss();
    expect(css).toMatch(/--hairline\s*:\s*1px/);
  });

  it("frd-13: WHEN globals.css is wired THEN elevation spacing values are multiples of 0.25rem (AC-13-004.1)", () => {
    // FROZEN_TOKENS.elevation has [0, 0.25rem, 0.5rem] spacing.
    // The CSS must reflect 0.25rem multiples — single-precision floating-point.
    const css = readCss();
    // Presence of at least one 0.25rem increment confirms the constraint.
    expect(css).toMatch(/0\.25rem|0\.5rem|0\.75rem|1rem/);
  });
});

// ---------------------------------------------------------------------------
// AC-13-005.1 — Motion tokens: durations <300ms and 2–3 easing tokens
// (blueprint: 2–3 easing tokens, no per-component curves)
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1: motion tokens — durations and easings", () => {
  it("frd-13: WHEN globals.css is wired THEN it declares --duration-fast (or equivalent)", () => {
    const css = readCss();
    expect(css).toMatch(/--duration-fast\s*:|--motion-fast\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares --duration-base (or equivalent)", () => {
    const css = readCss();
    expect(css).toMatch(/--duration-base\s*:|--motion-base\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares --duration-expressive (or equivalent)", () => {
    const css = readCss();
    expect(css).toMatch(/--duration-expressive\s*:|--motion-expressive\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN every motion duration value is strictly less than 300ms", () => {
    // Parse all --duration-* values and verify each is < 300.
    // Regression: NaN/Infinity values from tokens.ts B1' must not produce invalid CSS.
    const css = readCss();
    const durationVarPattern = /--(?:duration|motion)-\w+\s*:\s*(\d+(?:\.\d+)?)ms/g;
    const matches = [...css.matchAll(durationVarPattern)];

    // At least one duration must be declared (empty = wiring failure, mirrors I2 from WO-13-001).
    expect(
      matches.length,
      "globals.css must declare at least one --duration-* CSS variable (empty motion block is invalid, AC-13-005.1)",
    ).toBeGreaterThan(0);

    for (const [, valueStr] of matches) {
      const value = Number.parseFloat(valueStr ?? "9999");
      expect(
        value,
        `Motion duration value ${valueStr}ms violates the <300ms constraint (AC-13-005.1)`,
      ).toBeLessThan(300);
    }
  });

  it("frd-13: WHEN globals.css is wired THEN it declares at least 2 easing tokens", () => {
    const css = readCss();
    const easingVarPattern = /--easing-\w+\s*:|--motion-easing-\w+\s*:/g;
    const matches = [...css.matchAll(easingVarPattern)];
    expect(
      matches.length,
      "globals.css must declare at least 2 easing custom properties (AC-13-005.1, minimum 2)",
    ).toBeGreaterThanOrEqual(2);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares exactly 2–3 easing tokens (AC-13-005.1: minimum 2, maximum 3)", () => {
    // Both bounds in one assertion so the test cannot vacuously pass with 0 easing vars.
    // Vacuous pass risk: toBeLessThanOrEqual(3) passes on the stub because 0 <= 3.
    // The combined check requires the wiring to be present (>=2) AND restrained (<=3).
    const css = readCss();
    const easingVarPattern = /--easing-\w+\s*:|--motion-easing-\w+\s*:/g;
    const matches = [...css.matchAll(easingVarPattern)];
    expect(
      matches.length,
      `globals.css declares ${String(matches.length)} easing token(s); must be 2–3 (AC-13-005.1: no per-component curves, no empty easing map)`,
    ).toBeGreaterThanOrEqual(2);
    expect(
      matches.length,
      `globals.css declares ${String(matches.length)} easing token(s); must be 2–3 (AC-13-005.1)`,
    ).toBeLessThanOrEqual(3);
  });

  it("frd-13: WHEN globals.css is wired THEN easing values use cubic-bezier() (not step() or linear — blueprint mandates named curves)", () => {
    const css = readCss();
    expect(css).toMatch(/cubic-bezier\(/);
  });
});

// ---------------------------------------------------------------------------
// AC-13-006.1 — prefers-reduced-motion: disables ALL Party animation
// (EARS: "The UI SHALL honor prefers-reduced-motion: it disables all Party animation")
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-006.1: prefers-reduced-motion — global zero-duration override", () => {
  let reducedBlock: string;

  beforeAll(() => {
    reducedBlock = extractReducedMotionBlock(readCss());
  });

  it("frd-13: WHEN globals.css is wired THEN it includes @media (prefers-reduced-motion: reduce)", () => {
    // Mutation target: removing this block would cause all Party animations to play
    // even when the user has set 'reduce motion' at the OS level — fatigue in long sessions.
    const css = readCss();
    expect(css).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
  });

  it("frd-13: WHEN prefers-reduced-motion: reduce THEN animation-duration is zeroed globally (kills all keyframe animations)", () => {
    // Blueprint §2: "@media (prefers-reduced-motion: reduce): zero animation durations/transitions globally".
    // The specific rule: `animation-duration: 0ms !important` or `0s !important`.
    expect(reducedBlock).toMatch(/animation-duration\s*:\s*0(?:ms|s)\s*!important/);
  });

  it("frd-13: WHEN prefers-reduced-motion: reduce THEN transition-duration is zeroed globally (kills CSS transitions)", () => {
    // Transitions are a separate CSS mechanism from animations; both must be zeroed
    // or the reduced-motion contract is only half-fulfilled.
    expect(reducedBlock).toMatch(/transition-duration\s*:\s*0(?:ms|s)\s*!important/);
  });

  it("frd-13: WHEN prefers-reduced-motion: reduce THEN the block applies to * (global scope, not individual components)", () => {
    // A component-scoped rule would leave un-styled components animated. The contract
    // requires a global wildcard `*` or `:root` reset so the Party RAF loop (WO-06-011)
    // can read a single computed value to decide whether to run.
    expect(reducedBlock).toMatch(/[*\]:]|\broot\b/);
  });

  it("frd-13: WHEN prefers-reduced-motion: reduce THEN --duration-* CSS vars are also zeroed (defense-in-depth for JS consumers)", () => {
    // The Party engine reads CSS vars to decide animation durations. If only the CSS
    // properties are zeroed but the vars retain their values, JS animators (WAAPI, RAF
    // with explicit duration reads) would still animate. Zeroing the vars is defense-in-depth.
    // Acceptable pattern: either custom-property reset or explicit 0ms on each var.
    const css = readCss();
    // We check this in the global CSS, not just the block, because CSS cascade can propagate it.
    const hasVarReset = reducedBlock.includes("--duration") || reducedBlock.includes("--motion");
    const hasGlobalReset =
      css.match(/prefers-reduced-motion\s*:\s*reduce[\s\S]*?--duration/m) !== null ||
      css.match(/prefers-reduced-motion\s*:\s*reduce[\s\S]*?--motion/m) !== null;
    // Accept either approach.
    expect(
      hasVarReset || hasGlobalReset,
      "The prefers-reduced-motion block should also zero --duration-* / --motion-* CSS custom properties so JS RAF consumers are covered",
    ).toBe(true);
  });

  it("frd-13: WHEN prefers-reduced-motion: reduce THEN animation-iteration-count is zero or animation is 'none' (defensive)", () => {
    // Some Party animations use `animation: name var(--duration-expressive) ...`.
    // Zeroing duration is sufficient if the engine checks duration; but also accepting
    // `animation: none` or `animation-iteration-count: 0` as defensive redundancy.
    // At least one of the three zeroing strategies must be present.
    const hasAnimDuration = /animation-duration\s*:\s*0(?:ms|s)\s*!important/.test(reducedBlock);
    const hasAnimNone = /animation\s*:\s*none\s*!important/.test(reducedBlock);
    const hasIterCount = /animation-iteration-count\s*:\s*0\s*!important/.test(reducedBlock);
    expect(
      hasAnimDuration || hasAnimNone || hasIterCount,
      "The reduced-motion block must disable animations via duration=0, animation=none, or iteration-count=0",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-13-008.1 — Focus ring: visible and respects border-radius
// (EARS: "a visible focus ring that respects the border-radius")
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-008.1: focus ring — visible and radius-aware", () => {
  it("frd-13: WHEN globals.css is wired THEN it declares a --focus-ring CSS custom property (or equivalent)", () => {
    const css = readCss();
    // The blueprint specifies a tokenized focus-ring var so components inherit it
    // consistently rather than each component hard-coding its own outline.
    expect(css).toMatch(/--focus-ring\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN :focus-visible has an explicit outline (keyboard-navigable focus indicator)", () => {
    // :focus-visible (not :focus) is the correct selector to avoid showing the ring
    // on mouse clicks. Absence of this selector means keyboard users see no focus ring.
    const css = readCss();
    expect(css).toMatch(/:focus-visible/);
  });

  it("frd-13: WHEN globals.css is wired THEN the focus outline references the focus-ring var (not hardcoded)", () => {
    // Hardcoded outline colors violate the token contract (AGENTS.md rule 4: no hardcoded colors).
    const css = readCss();
    // Extract the :focus-visible block.
    const focusPos = css.indexOf(":focus-visible");
    if (focusPos === -1) {
      // This test acts as a secondary check; the prior test guards presence.
      expect(css).toMatch(/:focus-visible/);
      return;
    }
    // Find the block body.
    let depth = 0;
    let open = -1;
    let focusBlock = "";
    for (let i = focusPos; i < css.length; i++) {
      if (css[i] === "{") {
        if (open === -1) open = i;
        depth++;
      } else if (css[i] === "}") {
        depth--;
        if (depth === 0 && open !== -1) {
          focusBlock = css.slice(open + 1, i);
          break;
        }
      }
    }
    expect(focusBlock).toMatch(/var\(--focus-ring\)|var\(--color-accent\)/);
  });

  it("frd-13: WHEN globals.css is wired THEN the focus ring uses outline-offset (creates gap between border and ring)", () => {
    // An outline without offset sits flush against the border, making the ring hard
    // to see — particularly on rounded corners. The spec requires radius-respecting rings.
    const css = readCss();
    expect(css).toMatch(/outline-offset\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN border-radius on :focus-visible or globally sets --radius (ring respects radius)", () => {
    // The focus ring must visually follow the border-radius of the focused element.
    // Modern browsers use `outline` which follows `border-radius` natively when
    // `border-radius` is set. The contract requires that the token var is in scope.
    const css = readCss();
    expect(css).toMatch(/border-radius|--radius/);
  });
});

// ---------------------------------------------------------------------------
// AC-13-003.1 (REQ-13-003) — tabular-nums applied globally to html element
// (EARS: "EVERY number SHALL use font-variant-numeric: tabular-nums")
// ---------------------------------------------------------------------------

describe("frd-13 REQ-13-003: tabular-nums applied globally via html selector", () => {
  it("frd-13: WHEN globals.css is wired THEN html element has font-variant-numeric: tabular-nums", () => {
    // All numbers (XP, levels, counts, stats, timestamps) must use tabular figures so
    // they don't shift in width across frames (animation stutter risk).
    const css = readCss();
    expect(css).toMatch(/html\s*\{[^}]*font-variant-numeric\s*:\s*tabular-nums/s);
  });

  it("frd-13: WHEN globals.css is wired THEN tabular-nums is not scoped to a child component (global mandate)", () => {
    // If tabular-nums is set per-component, a developer can accidentally forget it on
    // a new component. The global `html` rule means the property inherits everywhere.
    const css = readCss();
    // A scoped component selector (e.g. '.kpi-value') must not be the ONLY place it appears.
    // Acceptable: html { ... tabular-nums } is present (the prior test already pins this).
    // Mutation: removing the html block leaves only the component-scoped one.
    const htmlBlock = extractBlock(css, "html");
    expect(htmlBlock).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants — CSS source soundness
// ---------------------------------------------------------------------------

describe("frd-13: globals.css structural invariants", () => {
  it("frd-13: globals.css has balanced braces (malformed CSS wires nothing)", () => {
    // A CSS file with unbalanced braces silently stops parsing at the error point.
    // Any vars declared after the mismatch are invisible to the browser.
    const css = readCss();
    let depth = 0;
    for (const ch of css) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    expect(depth).toBe(0);
  });

  it("frd-13: globals.css does not contain hardcoded hex color values (AGENTS.md rule 4: no hardcoded colors)", () => {
    // Hex colors bypass the token system. Any #rrggbb / #rgb in the wiring block means
    // the designer's OKLCH token was not used.
    const css = readCss();
    // Exclude comments (/* ... */) from the check to avoid false positives.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Biome/prettier may auto-format hex; this guard prevents silent regressions.
    const hexPattern = /#[0-9a-fA-F]{3,6}\b/g;
    const hexMatches = [...withoutComments.matchAll(hexPattern)];
    expect(
      hexMatches.length,
      `globals.css must not contain hardcoded hex colors. Found: ${hexMatches.map((m) => m[0]).join(", ")}`,
    ).toBe(0);
  });

  it("frd-13: globals.css does not reference rgb() or hsl() for theme colors (OKLCH is the mandated space)", () => {
    const css = readCss();
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Allow tailwind utility classes to use rgb internally; the check is for author-written values.
    // Any rgb()/hsl() in @theme or within the theme selectors indicates wrong color space.
    const themeBlock = extractBlock(withoutComments, "@theme");
    expect(themeBlock).not.toMatch(/\brgb\s*\(/);
    expect(themeBlock).not.toMatch(/\bhsl\s*\(/);
  });

  it("frd-13: globals.css motion vars do not contain non-numeric values (regression: B1' fail-open from WO-13-001)", () => {
    // If token generation emitted NaN or Infinity into CSS (e.g. var(--duration-fast: NaN)),
    // the CSS var would be invalid. This confirms the CSS output is clean.
    const css = readCss();
    const durationVarPattern = /--(?:duration|motion)-\w+\s*:\s*([^;]+);/g;
    const matches = [...css.matchAll(durationVarPattern)];
    for (const [, value] of matches) {
      const trimmed = (value ?? "").trim();
      expect(trimmed.toLowerCase()).not.toContain("nan");
      expect(trimmed.toLowerCase()).not.toContain("infinity");
    }
  });

  it("frd-13: globals.css @theme does not use positional arrays (regression: I3 fail-open from WO-13-001)", () => {
    // In CSS @theme, token values should be scalar strings, not JSON arrays.
    // An array-valued token (if it leaked from the token generator) would look like:
    //   --easing-standard: [cubic-bezier(...)];  which is invalid CSS.
    const themeBlock = extractBlock(readCss(), "@theme");
    expect(themeBlock).not.toMatch(/\[.*cubic-bezier/);
    expect(themeBlock).not.toMatch(/--[a-z][a-z0-9-]*\s*:\s*\[/);
  });

  it("frd-13: globals.css declares at least 15 CSS custom properties (sanity check against nearly-empty wiring)", () => {
    // A nearly-empty globals.css that passes individual checks but is incomplete would
    // declare fewer than ~15 vars: 3 oklch + 2 surface/text + 10 agents + 3 elevation
    // + 3 spacing + 3 duration + 2 easing + 1 radius + 1 hairline + 1 focus-ring = 29+.
    // 15 is a conservative floor that catches "stub" implementations.
    const themeBlock = extractBlock(readCss(), "@theme");
    const varDeclarations = [...themeBlock.matchAll(/--[a-z][a-z0-9-]*\s*:/g)];
    expect(
      varDeclarations.length,
      `@theme block declares only ${String(varDeclarations.length)} CSS custom properties; expected at least 15 for a complete wiring`,
    ).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// Property-based — round-trip invariants
//
// These tests enumerate the token fixture and verify that every token key that
// MUST appear in globals.css is indeed present. They're not truly property-based
// (no fast-check, because CSS parsing is deterministic) but they enumerate a
// combinatorial space a human wouldn't list by hand.
// ---------------------------------------------------------------------------

describe("frd-13: token-to-CSS property enumeration (round-trip completeness)", () => {
  it("frd-13: every agent role from FROZEN_TOKENS has a matching CSS var in @theme", () => {
    const themeBlock = extractBlock(readCss(), "@theme");
    for (const role of Object.keys(FROZEN_TOKENS.agents)) {
      expect(
        themeBlock,
        `Missing --color-agent-${role} in @theme (required by FROZEN_TOKENS.agents)`,
      ).toMatch(new RegExp(`--color-agent-${role}\\s*:`));
    }
  });

  it("frd-13: every FROZEN_TOKENS.motion.duration key has a matching CSS var in globals.css", () => {
    const css = readCss();
    for (const key of Object.keys(FROZEN_TOKENS.motion.duration)) {
      expect(
        css,
        `Missing --duration-${key} in globals.css (required by FROZEN_TOKENS.motion.duration)`,
      ).toMatch(new RegExp(`--duration-${key}\\s*:|--motion-${key}\\s*:`));
    }
  });

  it("frd-13: every FROZEN_TOKENS.motion.easing key has a matching CSS var in globals.css", () => {
    const css = readCss();
    for (const key of Object.keys(FROZEN_TOKENS.motion.easing)) {
      expect(
        css,
        `Missing --easing-${key} in globals.css (required by FROZEN_TOKENS.motion.easing)`,
      ).toMatch(new RegExp(`--easing-${key}\\s*:|--motion-easing-${key}\\s*:`));
    }
  });

  it("frd-13: FROZEN_TOKENS.elevation has exactly 3 entries and globals.css declares exactly 3 shadow levels", () => {
    // Schema side (already validated by WO-13-001) — pin the count here too so
    // globals.css wiring can't silently omit or add elevation levels.
    expect(FROZEN_TOKENS.elevation).toHaveLength(3);

    const css = readCss();
    const shadowVarPattern = /--shadow-\d\s*:|--elevation-\d\s*:/g;
    const matches = [...css.matchAll(shadowVarPattern)];
    expect(
      matches.length,
      "globals.css must declare exactly 3 shadow/elevation CSS vars (canvas=0, panel=1, card=2)",
    ).toBe(3);
  });
});
