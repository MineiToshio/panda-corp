/**
 * WO-13-008 — TierBadge (CMP-13-tierbadge) — RED phase tests
 *
 * Written BEFORE the implementation.
 *
 * Traceability:
 *   AC-WO-13-008 — TierBadge conveys tier by text+color (NEVER color alone),
 *                  tier name label always visible, tabular-nums on numerals,
 *                  tokens only, WCAG-AA, light+dark first-class.
 *
 * Design-token contract (rpgSkin.herostat.tierBadge + tiers.*):
 *   9px pixel font, color var(--color-canvas) on tier bg, padding 1px 6px,
 *   radius 4px. tier1=Bronze/Bronce tier2=Silver/Plata tier3=Gold/Oro
 *   tier4=Platinum/Platino tier5=Legend/Leyenda.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierBadge, type TierBadgeProps } from "@/components/core/TierBadge/TierBadge";

function renderBadge(props: TierBadgeProps) {
  return render(<TierBadge {...props} />);
}

// ── 1. Tier name text is always visible (never color-alone) ───────────────────

describe("frd-13/wo-13-008 TierBadge — AC: tier name text always rides with color", () => {
  const tiers: Array<{ tier: 1 | 2 | 3 | 4 | 5; name: string }> = [
    { tier: 1, name: "Bronce" },
    { tier: 2, name: "Plata" },
    { tier: 3, name: "Oro" },
    { tier: 4, name: "Platino" },
    { tier: 5, name: "Leyenda" },
  ];

  for (const { tier, name } of tiers) {
    it(`tier=${tier} renders name "${name}" visibly in the DOM`, () => {
      renderBadge({ tier, name });
      expect(screen.getByTestId("tier-badge-name")).toBeDefined();
      expect(screen.getByTestId("tier-badge-name").textContent).toContain(name);
    });
  }
});

// ── 2. data-tier attribute for non-color state signal ────────────────────────

describe("frd-13/wo-13-008 TierBadge — AC: data-tier attribute (not color-alone)", () => {
  it("sets data-tier=1 for tier 1", () => {
    renderBadge({ tier: 1, name: "Bronce" });
    expect(screen.getByTestId("tier-badge-root").getAttribute("data-tier")).toBe("1");
  });

  it("sets data-tier=5 for tier 5", () => {
    renderBadge({ tier: 5, name: "Leyenda" });
    expect(screen.getByTestId("tier-badge-root").getAttribute("data-tier")).toBe("5");
  });

  for (const tier of [1, 2, 3, 4, 5] as const) {
    it(`data-tier="${tier}" is present`, () => {
      renderBadge({ tier, name: `Tier ${tier}` });
      expect(screen.getByTestId("tier-badge-root").getAttribute("data-tier")).toBe(String(tier));
    });
  }
});

// ── 3. aria-label (accessibility, REQ-13-008) ────────────────────────────────

describe("frd-13/wo-13-008 TierBadge — AC: aria-label in Spanish", () => {
  it("root has an aria-label that includes the tier name", () => {
    renderBadge({ tier: 3, name: "Oro" });
    const label = screen.getByTestId("tier-badge-root").getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toContain("Oro");
  });
});

// ── 4. Accepts all valid tiers without crashing ───────────────────────────────

describe("frd-13/wo-13-008 TierBadge — AC: all valid tiers render", () => {
  for (const tier of [1, 2, 3, 4, 5] as const) {
    it(`tier=${tier} renders without throwing`, () => {
      expect(() => renderBadge({ tier, name: `Nombre ${tier}` })).not.toThrow();
    });
  }
});

// ── 5. Custom name prop is rendered verbatim ──────────────────────────────────

describe("frd-13/wo-13-008 TierBadge — AC: name prop rendered verbatim", () => {
  it("renders a custom chain name alongside the tier", () => {
    renderBadge({ tier: 2, name: "Constructor prolífico" });
    expect(screen.getByTestId("tier-badge-name").textContent).toContain("Constructor prolífico");
  });
});

// ── 6. Pure rendering ─────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 TierBadge — AC: pure (same props = same output)", () => {
  it("is deterministic", () => {
    const { container: a } = renderBadge({ tier: 3, name: "Oro" });
    const { container: b } = render(<TierBadge tier={3} name="Oro" />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});
