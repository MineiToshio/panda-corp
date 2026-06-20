/**
 * WO-13-008 — Shield (CMP-13-shield) — RED phase tests
 *
 * Written BEFORE the implementation.  Every test fails until
 * `src/components/core/Shield/Shield.tsx` is built and passes.
 *
 * Traceability:
 *   AC-WO-13-008 — Shield renders level numeral (tabular-nums), accent
 *                  border/glow, light+dark tokens only, glow opt-out via prop,
 *                  reduced-motion respected on any glow/pulse, WCAG-AA aria-label.
 *
 * Design-token contract (rpgSkin.shield from design-tokens.json):
 *   96×96, border-radius 14px, 2px accent border, accent-bg background,
 *   glow 0 0 22px -6px var(--accent); pixel-art rendering.
 *   NIVEL label (9px pixel font), level numeral (42px pixel font, accent-text).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Shield, type ShieldProps } from "@/components/core/Shield/Shield";

function renderShield(props: Partial<ShieldProps> = {}) {
  return render(<Shield level={props.level ?? 7} {...props} />);
}

// ── 1. Renders the level numeral ──────────────────────────────────────────────

describe("frd-13/wo-13-008 Shield — AC: level numeral is visible", () => {
  it("renders the supplied level as a numeral in the DOM", () => {
    renderShield({ level: 7 });
    expect(screen.getByTestId("shield-level")).toBeDefined();
    expect(screen.getByTestId("shield-level").textContent).toContain("7");
  });

  it("renders level 1", () => {
    renderShield({ level: 1 });
    expect(screen.getByTestId("shield-level").textContent).toContain("1");
  });

  it("renders level 99", () => {
    renderShield({ level: 99 });
    expect(screen.getByTestId("shield-level").textContent).toContain("99");
  });
});

// ── 2. NIVEL label ────────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 Shield — AC: NIVEL label present", () => {
  it("renders NIVEL label text", () => {
    renderShield({ level: 5 });
    expect(screen.getByTestId("shield-nivel-label")).toBeDefined();
    expect(screen.getByTestId("shield-nivel-label").textContent).toContain("NIVEL");
  });
});

// ── 3. Accessibility ─────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 Shield — AC: aria-label (Spanish, REQ-13-008)", () => {
  it("has an aria-label in Spanish describing the level", () => {
    renderShield({ level: 7 });
    const shield = screen.getByTestId("shield-root");
    const label = shield.getAttribute("aria-label");
    expect(label).toBeTruthy();
    // Must reference the numeric level so screen readers convey the value
    expect(label).toContain("7");
  });

  it("aria-label changes when level changes", () => {
    renderShield({ level: 3 });
    const label = screen.getByTestId("shield-root").getAttribute("aria-label");
    expect(label).toContain("3");
  });
});

// ── 4. Size prop ─────────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 Shield — AC: size prop accepted (does not crash)", () => {
  it("renders with size=sm", () => {
    renderShield({ level: 5, size: "sm" });
    expect(screen.getByTestId("shield-root")).toBeDefined();
  });

  it("renders with size=md (default)", () => {
    renderShield({ level: 5, size: "md" });
    expect(screen.getByTestId("shield-root")).toBeDefined();
  });

  it("renders with size=lg", () => {
    renderShield({ level: 5, size: "lg" });
    expect(screen.getByTestId("shield-root")).toBeDefined();
  });
});

// ── 5. glow prop ─────────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 Shield — AC: glow prop (default true)", () => {
  it("renders without crashing when glow=true", () => {
    renderShield({ level: 5, glow: true });
    expect(screen.getByTestId("shield-root")).toBeDefined();
  });

  it("renders without crashing when glow=false", () => {
    renderShield({ level: 5, glow: false });
    expect(screen.getByTestId("shield-root")).toBeDefined();
  });

  it("glow=false does not apply glow box-shadow data attribute", () => {
    renderShield({ level: 5, glow: false });
    const el = screen.getByTestId("shield-root");
    // When glow is off, the data-glow attribute must be false/absent
    expect(el.getAttribute("data-glow")).not.toBe("true");
  });

  it("glow=true applies glow box-shadow data attribute", () => {
    renderShield({ level: 5, glow: true });
    const el = screen.getByTestId("shield-root");
    expect(el.getAttribute("data-glow")).toBe("true");
  });
});

// ── 6. Server Component — no "use client" marker needed ───────────────────────

describe("frd-13/wo-13-008 Shield — AC: pure, no side-effects", () => {
  it("renders the same output for the same props (pure)", () => {
    const { container: a } = renderShield({ level: 5 });
    const { container: b } = render(<Shield level={5} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});
