/**
 * WO-13-001 — REVIEWER adversarial probes (DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT the implementer. These exercise the
 * untrusted-boundary holes that the implementer's own suite did NOT cover. The
 * validator's whole job is to be the trustworthy boundary in front of
 * JSON.parse(design-tokens.json), so each probe asks: can an invalid
 * design-tokens.json slip through as `valid`?
 *
 * Re-anchored 2026-06-18 (DR-054 ADOPT-VISUAL): the contract is now the prototype's
 * themes.{dark,light} groups (surfaces/text/borders/accent/status/categories/tiers/shadows),
 * radii, typography, spacing, motion — superseding the earlier invented OKLCH/elevation shape.
 * The array-masquerade and map-immutability probes are preserved against the new groups.
 *
 * Findings derived from these probes are recorded in
 * docs/reviews/wo-13-001-review.md.
 */

import { describe, expect, it } from "vitest";
import { AGENT_COLOR, AGENT_STATES, STATE_BADGE, validateTokenSchema } from "../tokens";

/** A complete, valid theme variant (prototype shape) — reused for both dark and light. */
// biome-ignore lint/suspicious/noExplicitAny: reviewer fixture builder needs to inject malformed shapes
function variant(): any {
  return {
    surfaces: { canvas: "#0F1517", panel: "#192123", card: "#222A2D", card2: "#2A3336" },
    text: { t1: "#EDEBE7", t2: "#BAB7B0", t3: "#9E9B94" },
    borders: { bd: "#2F373A", bd2: "#4F5A5D" },
    accent: { accent: "#33B6D1", accentText: "#62CFE8", accentBg: "#003542", onAccent: "#071318" },
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

// biome-ignore lint/suspicious/noExplicitAny: reviewer fixture builder needs to inject malformed shapes
function base(): any {
  return {
    themes: { dark: variant(), light: variant() },
    radii: { sm: "8px", md: "12px", lg: "16px", pill: "999px" },
    typography: { families: { body: "system-ui" } },
    spacing: { scale_px: [4, 8, 16] },
    motion: { rules: "transform/opacity only, <300ms", focus: "outline 2px solid {accent.accent}" },
  };
}

describe("frd-13 (reviewer adversarial): boundary holes the implementer did not cover", () => {
  // --- Sanity: the reviewer's base fixture is itself valid (else every probe is meaningless) ---
  it("reviewer base fixture is valid (probe baseline)", () => {
    expect(validateTokenSchema(base()).valid).toBe(true);
  });

  // --- Array masquerade on top-level sub-objects (same class across themes/radii/groups) ---
  it("themes as a positional array is rejected (variants are named dark/light, not indexed)", () => {
    const t = base();
    t.themes = [variant(), variant()];
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("radii as a positional array is rejected (radius steps are named sm/md/lg/pill)", () => {
    const t = base();
    t.radii = ["8px", "12px", "16px", "999px"];
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("a theme's surfaces group as a positional array is rejected", () => {
    const t = base();
    t.themes.dark.surfaces = ["#0F1517", "#192123", "#222A2D", "#2A3336"];
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("a theme's status group as a positional array is rejected (status colors are named, paired with -Bg)", () => {
    const t = base();
    t.themes.light.status = ["#5EC386", "#163A27"];
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  // --- Value-type holes at the leaf (presence-only checks would miss these) ---
  it("a category color set to a number (not a string) is rejected", () => {
    const t = base();
    t.themes.dark.categories.cat3 = 0xe9609e;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("a surface color set to an empty string is rejected (empty = no color)", () => {
    const t = base();
    t.themes.light.surfaces.canvas = "";
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("a theme variant set to null is rejected (null is not a token group)", () => {
    const t = base();
    t.themes.dark = null;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  // --- Empty-group vacuity: a present-but-empty typography/spacing must not pass ---
  it("an empty typography group is rejected (present key, zero tokens)", () => {
    const t = base();
    t.typography = {};
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("motion present but missing the focus-ring spec is rejected (AC-13-008.1)", () => {
    const t = base();
    const { focus: _focus, ...motionWithoutFocus } = t.motion;
    t.motion = motionWithoutFocus;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  // --- Map immutability: AGENT_COLOR / STATE_BADGE are the single source of truth and must be stable ---
  it("IF-13-agent-colors: every AGENT_COLOR value is unique (no two roles share a color token)", () => {
    const vals = Object.values(AGENT_COLOR);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("IF-13-state-vocab: every STATE_BADGE icon is unique (no state aliases another's shape)", () => {
    const icons = Object.values(STATE_BADGE).map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
    const labels = Object.values(STATE_BADGE).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("IF-13-state-vocab: every STATE_BADGE entry has a non-empty icon AND label (AC-13-007.1, no color-only)", () => {
    for (const state of AGENT_STATES) {
      const badge = STATE_BADGE[state];
      expect(badge.icon.trim().length, `state ${state} icon`).toBeGreaterThan(0);
      expect(badge.label.trim().length, `state ${state} label`).toBeGreaterThan(0);
    }
  });
});
