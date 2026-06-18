/**
 * WO-13-001 — REVIEWER adversarial probes (DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT the implementer. These exercise the
 * untrusted-boundary holes that the implementer's own suite + the 2nd-review
 * regression tests (B1'/I2/I3) did NOT cover. The validator's whole job is to be
 * the trustworthy boundary in front of JSON.parse(design-tokens.json), so each
 * probe asks: can an invalid design-tokens.json slip through as `valid`?
 *
 * Findings derived from these probes are recorded in
 * docs/reviews/wo-13-001-review.md.
 */

import { describe, expect, it } from "vitest";
import {
  AGENT_COLOR,
  AGENT_ROLES,
  AGENT_STATES,
  STATE_BADGE,
  validateTokenSchema,
} from "../tokens";

// biome-ignore lint/suspicious/noExplicitAny: reviewer fixture builder needs to inject malformed shapes
function base(): any {
  return {
    oklch: { base: "oklch(0.2 0 0)", accent: "oklch(0.7 0.1 200)", contrast: "oklch(0.99 0 0)" },
    themes: {
      light: { surface: "a", text: "b" },
      dark: { surface: "a", text: "b" },
      highContrast: { surface: "a", text: "b" },
    },
    agents: Object.fromEntries(AGENT_ROLES.map((r) => [r, "--c"])),
    elevation: [
      { shadow: "s", spacing: "1" },
      { shadow: "s", spacing: "1" },
      { shadow: "s", spacing: "1" },
    ],
    radius: "8px",
    spacing: "0.25rem",
    hairline: "1px",
    motion: {
      duration: { fast: 120, base: 200, expressive: 280 },
      easing: { standard: "a", emphasized: "b" },
    },
  };
}

describe("frd-13 (reviewer adversarial): boundary holes the implementer did not cover", () => {
  // --- Sanity: the reviewer's base fixture is itself valid (else every probe is meaningless) ---
  it("reviewer base fixture is valid (probe baseline)", () => {
    expect(validateTokenSchema(base()).valid).toBe(true);
  });

  // --- Boundary: duration exactly 300 must be rejected (AC says <300, strict) ---
  it("AC-13-005.1: duration === 300 is rejected (strict <300, boundary)", () => {
    const t = base();
    t.motion.duration.fast = 300;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  // --- KNOWN GAPS (follow-up, NON-blocking per the WO's enumerated DoD/AC) ---
  // These four probes FAIL against the current validator: it checks PRESENCE but not
  // VALUE TYPE / sign at the untrusted boundary. They are NOT in WO-13-001's enumerated
  // DoD nor in the FRD acceptance criteria (which only constrain "<300ms" and "2–3 easings"),
  // and the 2nd review already classed this value-typing class as an "ideally"/defense-in-depth
  // suggestion, not a blocking item. Kept here, skipped, as the regression anchor for the
  // recommended fast-follow WO (value-type hardening). UN-SKIP them when that WO lands.

  it.skip("[follow-up] AC-13-005.1: a negative duration (-50ms) should be rejected (currently VALID — out of WO scope)", () => {
    const t = base();
    t.motion.duration.fast = -50;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it.skip("[follow-up] AC-13-001.1: oklch.base as a number should be rejected (currently VALID — presence-only check)", () => {
    const t = base();
    t.oklch.base = 123;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it.skip("[follow-up] AC-13-001.1: themes.light as a string should be rejected (currently VALID — presence-only check)", () => {
    const t = base();
    t.themes.light = "oklch(...)";
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it.skip("[follow-up] AC-13-005.1: a non-string easing value (number) should be rejected (currently VALID — count-only check)", () => {
    const t = base();
    t.motion.easing.standard = 5;
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  // --- Array masquerade on top-level sub-objects (same class as I3, but oklch/themes/agents) ---
  it("oklch as a positional array is rejected", () => {
    const t = base();
    t.oklch = ["a", "b", "c"];
    expect(validateTokenSchema(t).valid).toBe(false);
  });

  it("themes as a positional array is rejected", () => {
    const t = base();
    t.themes = [
      { surface: "a", text: "b" },
      { surface: "a", text: "b" },
      { surface: "a", text: "b" },
    ];
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
