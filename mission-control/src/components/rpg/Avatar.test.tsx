/**
 * WO-09-003 — CMP-09-avatar pixel-art agent avatar
 *
 * Tests for the Avatar component. TDD RED → GREEN → refactor.
 *
 * Acceptance criteria:
 *   AC-09-003.1 — SHALL render a pixel-art avatar for a given agent id,
 *                  FF-style, at a tokenized size/radius (FRD-13 tokens).
 *   AC-09-003.2 — WHEN the sprite for an id is missing, the component SHALL
 *                  degrade gracefully (placeholder/removal) and SHALL NOT
 *                  break the layout.
 *   AC-09-003.3 — The avatar SHALL carry an alt/aria-label in Spanish (FRD-13 a11y).
 *   AC-09-003.4 — The component SHALL use only FRD-13 tokens for any chrome
 *                  (border/background), no hardcoded colors.
 *
 * Traceability:
 *   CMP-09-avatar → AC-09-003.1, AC-09-003.2, AC-09-003.3, AC-09-003.4
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, type AvatarSize, SPRITE_MAP } from "./Avatar";

// ---------------------------------------------------------------------------
// AC-09-003.1 — Render pixel-art avatar for a given agent id
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — AC-09-003.1: renders avatar for known agent id", () => {
  it("renders the wrapper element with data-testid='agent-avatar'", () => {
    render(<Avatar agentId="researcher" />);
    expect(screen.getByTestId("agent-avatar")).toBeDefined();
  });

  it("renders the sprite <img> for a known agent id", () => {
    render(<Avatar agentId="backend-dev" />);
    const img = screen.getByTestId("agent-avatar-img");
    expect(img).toBeDefined();
  });

  it("sprite src matches SPRITE_MAP entry for the agent id", () => {
    render(<Avatar agentId="frontend-dev" />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    expect(img.src).toContain(SPRITE_MAP["frontend-dev"]);
  });

  it("sets image-rendering: pixelated (FF-style pixel art)", () => {
    render(<Avatar agentId="test-writer" />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    expect(img.style.imageRendering).toBe("pixelated");
  });

  it("renders at default size (small) using CSS var token", () => {
    render(<Avatar agentId="researcher" />);
    const wrapper = screen.getByTestId("agent-avatar");
    // The wrapper uses CSS custom property for size — not a hardcoded px value
    // We verify the style attribute references CSS vars, not raw pixel values
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).not.toMatch(/width:\s*\d+px/);
    expect(style).not.toMatch(/height:\s*\d+px/);
  });

  it("SPRITE_MAP contains all canonical agent roles", () => {
    const canonicalRoles = [
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
    for (const role of canonicalRoles) {
      expect(SPRITE_MAP).toHaveProperty(role);
    }
  });

  it("renders for every known role in SPRITE_MAP without throwing", () => {
    for (const agentId of Object.keys(SPRITE_MAP)) {
      const { unmount } = render(<Avatar agentId={agentId as keyof typeof SPRITE_MAP} />);
      expect(screen.getByTestId("agent-avatar")).toBeDefined();
      unmount();
    }
  });

  it("applies tokenized border-radius via CSS var (FRD-13 radius token)", () => {
    render(<Avatar agentId="reviewer" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    // border-radius must reference the --radius CSS custom property, not a hardcoded value
    expect(style).toContain("var(--radius");
  });
});

// ---------------------------------------------------------------------------
// AC-09-003.1 — Tokenized size/radius
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — AC-09-003.1: tokenized size variants", () => {
  const sizes: AvatarSize[] = ["sm", "md", "lg"];

  for (const size of sizes) {
    it(`renders size="${size}" without throwing`, () => {
      const { unmount } = render(<Avatar agentId="researcher" size={size} />);
      expect(screen.getByTestId("agent-avatar")).toBeDefined();
      unmount();
    });
  }

  it("uses CSS var for size — no hardcoded pixel width/height in style attribute", () => {
    for (const size of sizes) {
      const { unmount } = render(<Avatar agentId="researcher" size={size} />);
      const wrapper = screen.getByTestId("agent-avatar");
      const style = wrapper.getAttribute("style") ?? "";
      // Must not contain a raw px measurement directly in the style attr
      expect(style).not.toMatch(/width:\s*\d+px/);
      expect(style).not.toMatch(/height:\s*\d+px/);
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-09-003.2 — Graceful fallback when sprite is missing
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — AC-09-003.2: graceful fallback for unknown agent id", () => {
  it("does NOT throw when agentId is unknown", () => {
    // @ts-expect-error intentionally passing unknown id for graceful-fallback test
    expect(() => render(<Avatar agentId="unknown-agent-xyz" />)).not.toThrow();
  });

  it("renders the wrapper element even for unknown agent id (layout not broken)", () => {
    // @ts-expect-error intentionally passing unknown id for graceful-fallback test
    render(<Avatar agentId="unknown-agent-xyz" />);
    expect(screen.getByTestId("agent-avatar")).toBeDefined();
  });

  it("renders a placeholder for unknown agent id (img with fallback src OR placeholder element)", () => {
    // @ts-expect-error intentionally passing unknown id
    render(<Avatar agentId="unknown-agent-xyz" />);
    // Either a placeholder or an img with a fallback src should be present
    const img = screen.queryByTestId("agent-avatar-img");
    const placeholder = screen.queryByTestId("agent-avatar-placeholder");
    // At least one must exist — layout never breaks
    expect(img !== null || placeholder !== null).toBe(true);
  });

  it("when fallback img is rendered, it uses the fallback sprite src", () => {
    // @ts-expect-error intentionally passing unknown id
    render(<Avatar agentId="unknown-agent-xyz" />);
    const img = screen.queryByTestId("agent-avatar-img") as HTMLImageElement | null;
    if (img) {
      // Must use the fallback sprite path, not the unknown agent path
      expect(img.src).toContain(SPRITE_MAP["backend-dev"]);
    }
  });

  it("placeholder element has data-testid='agent-avatar-placeholder' when rendered", () => {
    // @ts-expect-error intentionally passing unknown id
    render(<Avatar agentId="unknown-agent-xyz" />);
    // If no img, there must be a placeholder
    const img = screen.queryByTestId("agent-avatar-img");
    if (!img) {
      expect(screen.getByTestId("agent-avatar-placeholder")).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-09-003.3 — Spanish alt/aria-label (FRD-13 a11y)
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — AC-09-003.3: Spanish alt/aria-label", () => {
  it("sprite img has a non-empty alt attribute in Spanish", () => {
    render(<Avatar agentId="researcher" />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    const alt = img.getAttribute("alt") ?? "";
    expect(alt.length).toBeGreaterThan(0);
    // Spanish — must not be English-only labels
    expect(alt).not.toBe("researcher");
    expect(alt).not.toBe("agent");
  });

  it("alt text contains the agentId so it is informative", () => {
    render(<Avatar agentId="backend-dev" />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    const alt = img.getAttribute("alt") ?? "";
    expect(alt).toContain("backend-dev");
  });

  it("wrapper aria-label is in Spanish and references the role", () => {
    render(<Avatar agentId="frontend-dev" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const label = wrapper.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain("frontend-dev");
  });

  it("placeholder (when shown) has aria-hidden=true OR a descriptive label in Spanish", () => {
    // @ts-expect-error intentionally passing unknown id
    render(<Avatar agentId="unknown-agent-xyz" />);
    const placeholder = screen.queryByTestId("agent-avatar-placeholder");
    if (placeholder) {
      const ariaHidden = placeholder.getAttribute("aria-hidden");
      const ariaLabel = placeholder.getAttribute("aria-label") ?? "";
      // Either aria-hidden (decorative) or a Spanish label
      expect(ariaHidden === "true" || ariaLabel.length > 0).toBe(true);
    }
  });

  it("provides an accessible label at the wrapper level for screen readers", () => {
    render(<Avatar agentId="test-writer" />);
    const wrapper = screen.getByTestId("agent-avatar");
    // The wrapper should have role=img + aria-label OR contain an <img> with alt
    const role = wrapper.getAttribute("role");
    const ariaLabel = wrapper.getAttribute("aria-label");
    const img = wrapper.querySelector("img");
    const imgAlt = img?.getAttribute("alt") ?? "";
    expect((role === "img" && ariaLabel && ariaLabel.length > 0) || imgAlt.length > 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-09-003.4 — Only FRD-13 tokens for chrome (no hardcoded colors)
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — AC-09-003.4: FRD-13 tokens only, no hardcoded colors", () => {
  it("wrapper style does NOT contain a hardcoded hex color", () => {
    render(<Avatar agentId="researcher" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("wrapper style does NOT contain a hardcoded rgb() or rgba() color", () => {
    render(<Avatar agentId="backend-dev" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).not.toMatch(/rgba?\s*\(/i);
  });

  it("wrapper style does NOT contain a hardcoded hsl() color", () => {
    render(<Avatar agentId="frontend-dev" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).not.toMatch(/hsla?\s*\(/i);
  });

  it("wrapper style does NOT contain a hardcoded oklch() color", () => {
    render(<Avatar agentId="reviewer" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).not.toMatch(/oklch\s*\(/i);
  });

  it("border/background chrome uses only CSS custom properties (var(--*))", () => {
    render(<Avatar agentId="architect" />);
    const wrapper = screen.getByTestId("agent-avatar");
    const style = wrapper.getAttribute("style") ?? "";
    // Any border or background values must reference CSS vars
    // We check that if border is set it uses var(--*)
    if (style.includes("border")) {
      expect(style).toContain("var(--");
    }
    if (style.includes("background")) {
      expect(style).toContain("var(--");
    }
  });

  it("img element style does NOT contain hardcoded colors", () => {
    render(<Avatar agentId="designer" />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    const style = img.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(style).not.toMatch(/rgba?\s*\(/i);
    expect(style).not.toMatch(/oklch\s*\(/i);
  });
});

// ---------------------------------------------------------------------------
// Integration: component renders inside a standard parent without layout breaks
// ---------------------------------------------------------------------------

describe("CMP-09-avatar — integration: no layout break", () => {
  it("renders inside a flex container without throwing", () => {
    expect(() =>
      render(
        <div style={{ display: "flex", gap: "8px" }}>
          <Avatar agentId="researcher" />
          <Avatar agentId="backend-dev" />
          <Avatar agentId="frontend-dev" />
        </div>,
      ),
    ).not.toThrow();
  });

  it("multiple avatars render independently with correct data-testid (same id)", () => {
    render(
      <div>
        <Avatar agentId="researcher" />
      </div>,
    );
    // Should only find the one avatar
    const avatars = screen.getAllByTestId("agent-avatar");
    expect(avatars.length).toBe(1);
  });

  it("renders two avatars with different roles, both testids present", () => {
    render(
      <div>
        <Avatar agentId="researcher" data-testid-suffix="-1" />
        <Avatar agentId="backend-dev" data-testid-suffix="-2" />
      </div>,
    );
    // Both wrappers present — relies on data-role attribute
    const avatarResearcher = screen
      .getAllByTestId("agent-avatar")
      .find((el) => el.getAttribute("data-role") === "researcher");
    const avatarBackend = screen
      .getAllByTestId("agent-avatar")
      .find((el) => el.getAttribute("data-role") === "backend-dev");
    expect(avatarResearcher).toBeDefined();
    expect(avatarBackend).toBeDefined();
  });
});
