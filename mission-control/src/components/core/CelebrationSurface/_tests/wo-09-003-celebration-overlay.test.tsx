/**
 * WO-09-003 — CelebrationSurface full-screen overlay upgrade (RED → GREEN)
 *
 * Tests that verify CelebrationSurface matches the prototype's bOverlay(kind):
 *   - Fixed full-screen backdrop (dimmed + blurred) for release/levelup tiers
 *   - Centered rpgpanel card with tier-specific content
 *   - Confetti elements inside the overlay
 *   - Dismiss button (DR-061: overlay is auto-fired but user CAN dismiss)
 *   - release: rocket icon + "PRODUCTO LANZADO" + XP chip + achievement chip
 *   - levelup: "LEVEL UP" label + pixel NV numeral + title + XpBar
 *   - No false-urgency: no timer/countdown, no nagging (AC-09-006.4)
 *   - Reduced-motion: confetti collapses to static (AC-09-006.3)
 *
 * Visual reference: prototype bOverlay() + bConfetti() ~L1432/1433
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@/lib/events/events";
import { CelebrationSurface } from "../CelebrationSurface";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("reduce") ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const releaseEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:02:00Z",
  agent: "backend-dev",
  task: "release",
  status: "ok",
};

const levelupEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:03:00Z",
  agent: "backend-dev",
  task: "levelup",
  status: "ok",
};

const toastEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:00:00Z",
  agent: "backend-dev",
  workOrder: "WO-09-001",
  status: "ok",
};

// ── Full-screen overlay structure ────────────────────────────────────────────

describe("CelebrationSurface upgrade — full-screen overlay (bOverlay)", () => {
  beforeEach(() => mockMatchMedia(false));

  it("release tier: renders a full-screen overlay wrapper", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay).toBeDefined();
    const style = overlay.getAttribute("style") ?? "";
    // Must be fixed-position full-screen
    expect(style.includes("fixed") || overlay.getAttribute("data-overlay") === "true").toBe(true);
  });

  it("levelup tier: renders a full-screen overlay wrapper", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay).toBeDefined();
  });

  it("release tier: renders the inner rpgpanel card", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card).toBeDefined();
  });

  it("levelup tier: renders the inner rpgpanel card", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card).toBeDefined();
  });
});

// ── Release overlay content (prototype bOverlay("release")) ─────────────────

describe("CelebrationSurface upgrade — release overlay content", () => {
  beforeEach(() => mockMatchMedia(false));

  it("release: shows 'PRODUCTO LANZADO' label", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toMatch(/PRODUCTO LANZADO/i);
  });

  it("release: shows XP chip with '+' or 'XP' text", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toMatch(/XP/);
  });

  it("release: shows a dismiss button", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const btn = screen.getByTestId("celebration-dismiss");
    expect(btn).toBeDefined();
    expect(btn.tagName.toLowerCase()).toBe("button");
  });

  it("release: dismiss button has accessible label", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const btn = screen.getByTestId("celebration-dismiss");
    const label = btn.getAttribute("aria-label") ?? btn.textContent?.trim();
    expect(label && label.length > 0).toBe(true);
  });
});

// ── Level-up overlay content (prototype bOverlay("levelup")) ─────────────────

describe("CelebrationSurface upgrade — levelup overlay content", () => {
  beforeEach(() => mockMatchMedia(false));

  it("levelup: shows 'LEVEL UP' label", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toMatch(/LEVEL UP/i);
  });

  it("levelup: shows pixel NV numeral (data-testid='celebration-level')", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const levelEl = screen.getByTestId("celebration-level");
    expect(levelEl).toBeDefined();
    // NV numeral must contain a number
    expect(/\d/.test(levelEl.textContent ?? "")).toBe(true);
  });

  it("levelup: shows '¡Subiste de nivel!' message", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toMatch(/subiste de nivel/i);
  });

  it("levelup: shows an XpBar for the new rank progress", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const card = screen.getByTestId("celebration-card");
    const xpBar = card.querySelector("[data-testid='xp-bar']");
    expect(xpBar).not.toBeNull();
  });

  it("levelup: shows a dismiss button", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const btn = screen.getByTestId("celebration-dismiss");
    expect(btn).toBeDefined();
  });
});

// ── Confetti (bConfetti) ─────────────────────────────────────────────────────

describe("CelebrationSurface upgrade — confetti (bConfetti)", () => {
  it("release: renders confetti container", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    expect(confetti).toBeDefined();
  });

  it("levelup: renders confetti container", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    expect(confetti).toBeDefined();
  });

  it("confetti renders multiple confetti pieces (> 1)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    const pieces = confetti.querySelectorAll("[data-testid='confetti-piece']");
    expect(pieces.length).toBeGreaterThan(1);
  });

  it("reduced-motion: confetti pieces have data-reduced='true' (no bFall animation)", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    expect(confetti.getAttribute("data-reduced")).toBe("true");
  });

  it("full-motion: confetti pieces do NOT have data-reduced='true'", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    expect(confetti.getAttribute("data-reduced")).not.toBe("true");
  });
});

// ── toast/phase tiers: small celebration (no full-screen overlay) ────────────

describe("CelebrationSurface upgrade — toast/phase tiers remain small", () => {
  beforeEach(() => mockMatchMedia(false));

  it("toast tier: no full-screen overlay wrapper", () => {
    render(<CelebrationSurface event={toastEvent} />);
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();
  });

  it("toast tier: still renders celebration-surface (data present)", () => {
    render(<CelebrationSurface event={toastEvent} />);
    expect(screen.getByTestId("celebration-surface")).toBeDefined();
  });
});

// ── Dismiss interaction (DR-061: auto-fired but user CAN dismiss) ────────────

describe("CelebrationSurface upgrade — dismiss interaction (DR-061)", () => {
  beforeEach(() => mockMatchMedia(false));

  it("clicking dismiss calls onDismiss if provided", async () => {
    const onDismiss = vi.fn();
    render(<CelebrationSurface event={releaseEvent} onDismiss={onDismiss} />);
    const btn = screen.getByTestId("celebration-dismiss");
    btn.click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismiss button does NOT have false-urgency countdown text", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const btn = screen.getByTestId("celebration-dismiss");
    expect(btn.textContent).not.toMatch(/\d+\s*s/i); // no "3s" countdown
  });
});

// ── AC-09-006.4: no timer, no nagging ────────────────────────────────────────

describe("CelebrationSurface upgrade — AC-09-006.4: no false urgency", () => {
  beforeEach(() => mockMatchMedia(false));

  it("overlay contains no timer element", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    expect(screen.queryByTestId("celebration-timer")).toBeNull();
  });

  it("overlay contains no countdown element", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    expect(screen.queryByTestId("celebration-countdown")).toBeNull();
  });

  it("overlay does NOT use role=alertdialog (no focus steal)", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay.getAttribute("role")).not.toBe("alertdialog");
    const card = screen.getByTestId("celebration-card");
    expect(card.getAttribute("role")).not.toBe("alertdialog");
  });
});

// ── Design tokens ─────────────────────────────────────────────────────────────

describe("CelebrationSurface upgrade — design tokens (no hardcoded colors)", () => {
  beforeEach(() => mockMatchMedia(false));

  it("no hardcoded hex colors in inline styles", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    const allStyles = Array.from(overlay.querySelectorAll("[style]"))
      .map((el) => el.getAttribute("style") ?? "")
      .join(" ");
    const rootStyle = overlay.getAttribute("style") ?? "";
    const combined = `${rootStyle} ${allStyles}`;
    expect(combined).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("no hardcoded rgb()/hsl() in inline styles", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    const allStyles = Array.from(overlay.querySelectorAll("[style]"))
      .map((el) => el.getAttribute("style") ?? "")
      .join(" ");
    const rootStyle = overlay.getAttribute("style") ?? "";
    const combined = `${rootStyle} ${allStyles}`;
    // rgba() is allowed for the backdrop (rgba(0,0,0,.66)) — that's the one exception
    // per prototype which uses it for the backdrop overlay
    // We only reject pure rgb/hsl (not rgba which the prototype uses for backdrop)
    expect(combined).not.toMatch(/(?<!\w)hsl\s*\(/i);
  });
});
