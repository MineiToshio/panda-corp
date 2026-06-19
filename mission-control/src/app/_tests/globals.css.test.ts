/**
 * WO-13-002 — globals.css wiring acceptance tests
 *
 * Re-anchored 2026-06-18 (DR-054 ADOPT-VISUAL): globals.css @theme now MIRRORS the
 * owner-approved prototype (docs/design/design-tokens.json) — a warm pixel-RPG / "guild"
 * palette authored in HEX, dark default + light + high-contrast. This SUPERSEDES the earlier
 * invented cold-blue hue-230 OKLCH palette AND its "no hardcoded hex / OKLCH-only" mandate:
 * the prototype is authored in hex, so these tests assert the committed warm hex values are
 * present and correct (the old "must contain NO hex" rule is inverted — see the structural
 * invariants block). The per-agent role colors stay OKLCH for role identity (FRD-06/FRD-12).
 *
 * Traces:
 *   AC-13-001.1 — Theme derived from few tokens; high-contrast mode without redesign.
 *   AC-13-002.1 — A single rationed accent; the rest warm neutrals.
 *   AC-13-004.1 — Tokenized shadow/radius/spacing scale (--shadow-0/1/2; radius 8px,
 *                 base 16px, hairline 1px).
 *   AC-13-005.1 — Animation only transform/opacity, <300ms, 2–3 easing tokens.
 *   AC-13-006.1 — UI honors prefers-reduced-motion: disables ALL Party animation.
 *   AC-13-008.1 — Visible focus ring that respects border-radius.
 *
 * Approach:
 *   CSS cannot be exercised in jsdom by simply injecting globals.css — jsdom has no layout
 *   engine and CSSOM variables are not computed. Instead, the tests parse the CSS source
 *   text and assert the structural/textual contracts that CMP-13-globals must satisfy:
 *     (a) the @theme block declares the required CSS custom properties with the frozen hex;
 *     (b) the three theme modes (light/dark/high-contrast) are wired;
 *     (c) the elevation scale (--shadow-0/1/2) is present (light re-declares 1/2);
 *     (d) animation tokens are declared (durations, easings);
 *     (e) @media (prefers-reduced-motion: reduce) zeroes durations globally;
 *     (f) the focus-ring var is declared.
 *
 *   Token values come from the FROZEN_TOKENS fixture below, which mirrors the committed
 *   docs/design/design-tokens.json (the canonical contract).
 *
 * Real bugs anchored (progress.md):
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
const GLOBALS_CSS_PATH = path.resolve(import.meta.dirname, "..", "globals.css");

// ---------------------------------------------------------------------------
// Frozen token fixture — mirrors docs/design/design-tokens.json (DR-054).
// The warm pixel-RPG palette, authored in HEX, dark default + light. These are the
// EXACT committed values that globals.css @theme must declare (the prototype contract).
// ---------------------------------------------------------------------------

const FROZEN_TOKENS = {
  /** Dark theme (the @theme default) — committed warm hex from the prototype. */
  dark: {
    surfaces: {
      "--color-base": "#0f1517",
      "--color-panel": "#192123",
      "--color-card": "#222a2d",
      "--color-card2": "#2a3336",
    },
    text: {
      "--color-text": "#edebe7",
      "--color-text2": "#bab7b0",
      "--color-text3": "#9e9b94",
    },
    borders: {
      "--color-border": "#2f373a",
      "--color-border-strong": "#4f5a5d",
    },
    accent: {
      "--color-accent": "#33b6d1",
      "--color-accent-text": "#62cfe8",
      "--color-accent-bg": "#003542",
      "--color-on-accent": "#071318",
    },
  },
  /** Light theme — committed warm hex (re-declared under the light selectors). */
  light: {
    "--color-base": "#f8f7f3",
    "--color-card": "#ffffff",
    "--color-text": "#25211b",
    "--color-accent": "#007890",
  },
  /** High-contrast override — pure black/white extreme inversion (hex, AC-13-001.1). */
  highContrast: {
    "--color-base": "#000000",
    "--color-text": "#ffffff",
    "--color-accent": "#ffffff",
  },
  /**
   * Per-agent role colors — UNCHANGED by the re-anchor (role identity, FRD-06/FRD-12).
   * These deliberately stay OKLCH. Matches AGENT_ROLES in app/_design/tokens/tokens.ts.
   * Each key must have a matching --color-agent-<role> in globals.css @theme.
   * Realigned 2026-06-18 (Party redesign): removed 'guild'; added the engine/pipeline roles.
   */
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
    implementer: "oklch(0.65 0.2 160)",
    copywriter: "oklch(0.7 0.18 340)",
    analytics: "oklch(0.68 0.2 100)",
    devops: "oklch(0.6 0.18 200)",
  },
  /** Category (9) + tier (5) slots — committed dark-theme hex. */
  categories: {
    "--color-cat-1": "#60ad64",
    "--color-cat-2": "#a278e4",
    "--color-cat-3": "#e9609e",
    "--color-cat-4": "#3d96ea",
    "--color-cat-5": "#2cb3b4",
    "--color-cat-6": "#37b2e8",
    "--color-cat-7": "#e39849",
    "--color-cat-8": "#46b68c",
    "--color-cat-9": "#ec5c50",
  },
  tiers: {
    "--color-tier-1": "#989fa8",
    "--color-tier-2": "#53be70",
    "--color-tier-3": "#339fee",
    "--color-tier-4": "#b474f4",
    "--color-tier-5": "#f68c36",
  },
  /** Two-layer elevation scale (+ pop). --shadow-0 none, 1 resting, 2 pop. */
  shadows: {
    "--shadow-0": "none",
    "--shadow-1": "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 28px rgba(0, 0, 0, 0.35)",
    "--shadow-2": "0 18px 50px rgba(0, 0, 0, 0.5)",
  },
  radius: "8px",
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

  it("frd-13: WHEN globals.css is wired THEN @theme declares the frozen warm-hex base/accent/contrast (DR-054: prototype is authored in hex)", () => {
    // SUPERSEDES the old "must use oklch()" mandate (AC-13-001.1 originally cited a perceptual
    // OKLCH wiring). DR-054 re-anchored the palette on the owner-approved prototype, which is
    // authored in HEX — so the contract is now that the committed warm hex values are present
    // and correct, not that the values are OKLCH. The values come from FROZEN_TOKENS.dark.
    expect(themeBlock).toMatch(/--color-base\s*:\s*#0f1517/);
    expect(themeBlock).toMatch(/--color-accent\s*:\s*#33b6d1/);
    expect(themeBlock).toMatch(/--color-contrast\s*:\s*#edebe7/);
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares the full frozen warm-surface/text ramp (prototype fidelity)", () => {
    // Pins the exact committed hex for the dark surfaces + text ramp so a future edit cannot
    // silently drift the palette away from the approved prototype (the DR-054 fidelity gate).
    for (const [varName, hex] of [
      ...Object.entries(FROZEN_TOKENS.dark.surfaces),
      ...Object.entries(FROZEN_TOKENS.dark.text),
      ...Object.entries(FROZEN_TOKENS.dark.borders),
      ...Object.entries(FROZEN_TOKENS.dark.accent),
    ]) {
      expect(
        themeBlock,
        `@theme is missing the frozen ${varName}: ${hex} (prototype palette, DR-054)`,
      ).toMatch(new RegExp(`${varName}\\s*:\\s*${hex}`));
    }
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares the 9 category + 5 tier color slots with the frozen hex", () => {
    for (const [varName, hex] of [
      ...Object.entries(FROZEN_TOKENS.categories),
      ...Object.entries(FROZEN_TOKENS.tiers),
    ]) {
      expect(
        themeBlock,
        `@theme is missing the frozen ${varName}: ${hex} (category/tier slot, DR-054)`,
      ).toMatch(new RegExp(`${varName}\\s*:\\s*${hex}`));
    }
  });

  it("frd-13: WHEN globals.css is wired THEN @theme declares per-agent color vars for all 13 canonical roles (IF-13-agent-colors)", () => {
    // Each agent role must have a --color-agent-<role> custom property so FRD-06 and
    // FRD-12 can read var(--color-agent-researcher) etc. without hard-coding.
    // Realigned 2026-06-18: 13 roles (removed guild, added implementer/copywriter/analytics/devops).
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
  it("frd-13: WHEN globals.css is wired THEN it contains a light-theme selector that overrides the surface/text/accent vars with the frozen light hex", () => {
    const css = readCss();
    // The theme is toggled via a data attribute (blueprint §2: color-scheme + data-attr) and
    // also via @media (prefers-color-scheme: light). A light context must exist and re-declare
    // the vars with the FROZEN_TOKENS.light values (the prototype's light inversion).
    expect(css).toMatch(/\[data-theme=['"]light['"]|prefers-color-scheme:\s*light/);
    // Pin the frozen light values so the light inversion can't silently drift from the prototype.
    expect(css).toMatch(new RegExp(`--color-base\\s*:\\s*${FROZEN_TOKENS.light["--color-base"]}`));
    expect(css).toMatch(new RegExp(`--color-text\\s*:\\s*${FROZEN_TOKENS.light["--color-text"]}`));
    expect(css, "light theme must re-declare --color-accent with the frozen light accent").toMatch(
      new RegExp(`--color-accent\\s*:\\s*${FROZEN_TOKENS.light["--color-accent"]}`),
    );
  });

  it("frd-13: WHEN globals.css is wired THEN it contains a dark-theme selector AND the dark surface/text values are the @theme defaults (prototype: dark is the base)", () => {
    const css = readCss();
    // The prototype ships dark as the DEFAULT — its surface/text live in @theme, and the
    // [data-theme="dark"] selector only re-asserts color-scheme (the values are already the
    // defaults). So the contract is: a dark selector exists, AND @theme carries the frozen
    // dark surface (panel) + text. (SUPERSEDES the old "dark block must override the vars"
    // assumption, which only held when light was the base.)
    expect(css).toMatch(
      /(?:\[data-theme=['"]dark['"]|\.dark\b|:root\.dark|prefers-color-scheme:\s*dark)/,
    );
    const themeBlock = extractBlock(css, "@theme");
    // --color-surface is the default elevated surface (panel = #192123 in the prototype).
    expect(themeBlock).toMatch(/--color-surface\s*:\s*#192123/);
    // --color-text is the dark t1 text (#edebe7).
    expect(themeBlock).toMatch(/--color-text\s*:\s*#edebe7/);
  });

  it("frd-13: WHEN globals.css is wired THEN it contains a high-contrast selector with a pure black/white extreme inversion (AC-13-001.1: no redesign required)", () => {
    // High-contrast mode must be a selector override of the same token vars — not a
    // separate stylesheet. If this selector is absent, enabling high-contrast requires a
    // redesign, which violates AC-13-001.1. DR-054: the prototype's high-contrast is hex
    // (#000000 canvas / #ffffff text/accent) — a true extreme inversion, pinned here so it
    // can't degrade into a re-skinned dark theme.
    const css = readCss();
    expect(css).toMatch(/high-contrast|highContrast/i);
    const hcBlock = extractBlock(css.slice(css.search(/\[data-theme=['"]high-contrast['"]/)), "{");
    expect(hcBlock).toMatch(
      new RegExp(`--color-base\\s*:\\s*${FROZEN_TOKENS.highContrast["--color-base"]}`),
    );
    expect(hcBlock).toMatch(
      new RegExp(`--color-text\\s*:\\s*${FROZEN_TOKENS.highContrast["--color-text"]}`),
    );
    expect(hcBlock).toMatch(
      new RegExp(`--color-accent\\s*:\\s*${FROZEN_TOKENS.highContrast["--color-accent"]}`),
    );
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
  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-0 shadow as 'none' (canvas — no elevation)", () => {
    const themeBlock = extractBlock(readCss(), "@theme");
    // Canvas is the lowest elevation: explicit 'none' (FROZEN_TOKENS.shadows["--shadow-0"]).
    expect(themeBlock).toMatch(/--shadow-0\s*:\s*none/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-1 shadow (resting — panel/card)", () => {
    const css = readCss();
    expect(css).toMatch(/--shadow-1\s*:/);
  });

  it("frd-13: WHEN globals.css is wired THEN it declares elevation-level-2 shadow (pop — popup/overlay)", () => {
    const css = readCss();
    expect(css).toMatch(/--shadow-2\s*:/);
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

  it("frd-13: WHEN globals.css is wired THEN the @theme shadow scale matches the frozen prototype values (--shadow-1 resting, --shadow-2 pop)", () => {
    // SUPERSEDES the old "elevation spacing values are 0.25rem multiples" check — the prototype
    // contract is a two-layer shadow scale (resting + pop), not a per-level spacing token. Pin
    // the exact frozen box-shadow strings so the elevation depth can't drift from the prototype.
    const themeBlock = extractBlock(readCss(), "@theme");
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(themeBlock).toMatch(
      new RegExp(`--shadow-1\\s*:\\s*${escapeRe(FROZEN_TOKENS.shadows["--shadow-1"])}`),
    );
    expect(themeBlock).toMatch(
      new RegExp(`--shadow-2\\s*:\\s*${escapeRe(FROZEN_TOKENS.shadows["--shadow-2"])}`),
    );
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
    // NOTE: anchor on the `html {` SELECTOR (with brace), not the bare substring "html" —
    // the DR-054 header comment mentions "prototype/index.html", which would otherwise make
    // extractBlock walk to the @theme block instead of the html rule.
    const htmlBlock = extractBlock(css, "html {");
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

  it("frd-13: globals.css @theme uses the committed warm-HEX palette for the semantic color tokens (DR-054: the prototype is authored in hex — SUPERSEDES the old OKLCH-only / no-hex mandate)", () => {
    // REPLACES the old "must NOT contain hardcoded hex" rule. DR-054 re-anchored the palette
    // on the owner-approved prototype, which is authored in HEX. The contract is now the
    // opposite of the invented one: the @theme semantic surface/text/accent tokens ARE hex.
    // (Per-agent role colors remain OKLCH — those are role identity, not the warm palette.)
    const themeBlock = extractBlock(readCss(), "@theme");
    const semanticHexTokens = [
      "--color-base",
      "--color-panel",
      "--color-card",
      "--color-text",
      "--color-accent",
      "--color-border",
    ];
    for (const token of semanticHexTokens) {
      expect(
        themeBlock,
        `@theme ${token} must be a hex literal (warm prototype palette, DR-054)`,
      ).toMatch(new RegExp(`${token}\\s*:\\s*#[0-9a-fA-F]{3,6}\\b`));
    }
  });

  it("frd-13: globals.css @theme does NOT use hsl() for color tokens (the prototype is hex + rgba shadows + oklch agent identity, never hsl)", () => {
    // The prototype's color space is hex (semantic palette) + rgba() (shadows/backdrop) +
    // oklch() (per-agent identity). hsl() never appears — it would signal a wiring from a
    // non-prototype source. rgba() is intentionally allowed (it is how the prototype authors
    // its two-layer shadows: FROZEN_TOKENS.shadows), so it is NOT forbidden here.
    const withoutComments = readCss().replace(/\/\*[\s\S]*?\*\//g, "");
    const themeBlock = extractBlock(withoutComments, "@theme");
    expect(themeBlock).not.toMatch(/\bhsl\s*\(/);
  });

  it("frd-13: globals.css keeps the per-agent role colors in OKLCH (role identity is unchanged by the re-anchor)", () => {
    // The DR-054 re-anchor changed the warm SEMANTIC palette to hex but deliberately left the
    // 13 agent-role identity colors in OKLCH (FRD-06 La Fragua + FRD-12 dataviz). Pin that so a
    // future edit doesn't accidentally flatten the agent palette into hex and lose the perceptual
    // spacing that keeps the roles distinguishable.
    const themeBlock = extractBlock(readCss(), "@theme");
    for (const role of Object.keys(FROZEN_TOKENS.agents)) {
      expect(
        themeBlock,
        `--color-agent-${role} must stay OKLCH (role identity, unchanged by DR-054)`,
      ).toMatch(new RegExp(`--color-agent-${role}\\s*:\\s*oklch\\(`));
    }
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
    // declare fewer than ~15 vars: the warm surfaces/text/borders/accent/status/cat/tier hex
    // + 13 agents (oklch) + 3 shadows + 3 duration + 2 easing + radii + hairline + focus-ring
    // = far more than 15. 15 is a conservative floor that catches "stub" implementations.
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

  it("frd-13: @theme declares exactly the 3 elevation levels --shadow-0/1/2, and the light theme re-declares --shadow-1/2 (DR-054 prototype scale)", () => {
    // SUPERSEDES the old "exactly 3 --shadow-* anywhere in the file" count. The prototype's
    // elevation is a 3-level scale (0=none, 1=resting, 2=pop) declared in @theme — but the
    // light theme legitimately RE-DECLARES --shadow-1/2 with lighter values (the light
    // box-shadows are softer). So the contract is: @theme has exactly 3 distinct levels, and
    // the light selector overrides 1 and 2. Counting raw occurrences file-wide (which now =5)
    // would be wrong.
    const themeBlock = extractBlock(readCss(), "@theme");
    const themeShadows = new Set([...themeBlock.matchAll(/--shadow-(\d)\s*:/g)].map((m) => m[1]));
    expect(
      themeShadows,
      "@theme must declare exactly the 3 elevation levels --shadow-0, --shadow-1, --shadow-2",
    ).toEqual(new Set(["0", "1", "2"]));

    // The light theme softens the resting + pop shadows (re-declares 1 and 2, never 0).
    const css = readCss();
    const lightStart = css.search(/\[data-theme=['"]light['"]/);
    expect(lightStart, "a [data-theme=light] selector must exist").toBeGreaterThan(-1);
    const lightBlock = extractBlock(css.slice(lightStart), "{");
    expect(lightBlock).toMatch(/--shadow-1\s*:/);
    expect(lightBlock).toMatch(/--shadow-2\s*:/);
  });

  it("frd-13: @theme must NOT declare --color-agent-guild (regression: fictitious aggregate removed 2026-06-18)", () => {
    // 'guild' was removed from AGENT_ROLES in WO-13-001 (Party redesign).
    // WO-13-002 must mirror the removal in globals.css to keep IF-13-agent-colors in sync.
    // Presence of --color-agent-guild would mean the CSS is out of sync with tokens.ts.
    const themeBlock = extractBlock(readCss(), "@theme");
    expect(
      themeBlock,
      "--color-agent-guild must be removed from @theme (fictitious aggregate, Party redesign 2026-06-18)",
    ).not.toMatch(/--color-agent-guild\s*:/);
  });

  it("frd-13: @theme declares all 4 new agent roles added by Party redesign (implementer/copywriter/analytics/devops)", () => {
    // These roles were added in WO-13-001 (AGENT_ROLES realignment). The @theme CSS vars
    // must be present so AGENT_COLOR references resolve to a real CSS custom property.
    const themeBlock = extractBlock(readCss(), "@theme");
    const newRoles = ["implementer", "copywriter", "analytics", "devops"];
    for (const role of newRoles) {
      expect(
        themeBlock,
        `--color-agent-${role} must be present in @theme (added by Party redesign realignment, WO-13-002)`,
      ).toMatch(new RegExp(`--color-agent-${role}\\s*:`));
    }
  });
});
