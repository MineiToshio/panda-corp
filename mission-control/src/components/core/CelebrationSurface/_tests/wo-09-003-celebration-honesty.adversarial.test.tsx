/**
 * WO-09-003 — Adversarial honesty tests for CelebrationSurface (reviewer / DR-015)
 *
 * Edge cases the implementers did NOT cover, anchored in the FRD-09 honesty AC:
 *   - AC-09-004.3: the XP bar SHALL reflect REAL progress; never fake/stuck.
 *   - FRD-09 core principle: "represent real work"; no fabricated rank/XP.
 *
 * The level-up overlay must announce the ACTUAL new rank for `newLevel`, derived
 * from the same RANKS ladder the engine uses (computeGuildLevel). The shipped
 * implementation hardcodes "Gran maestro del gremio" + an XpBar with next=2000
 * (a threshold that does not exist in RANKS: 0/100/500/1500/4000/10000),
 * regardless of `newLevel` — a dishonest, fabricated rank. These tests pin the
 * correct, honest behavior so the rebuild fixes it.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@/lib/events/events";
import { RANKS } from "@/lib/gamification/gamification";
import { CelebrationSurface } from "../CelebrationSurface";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reduced : false,
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

const levelupEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:03:00Z",
  agent: "backend-dev",
  task: "levelup",
  status: "ok",
};

describe("CelebrationSurface levelup — honest rank (adversarial, AC-09-004.3)", () => {
  it("announces the ACTUAL rank for newLevel=2 (Artesano), not a hardcoded 'Gran Maestro'", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} newLevel={2} />);

    // level 2 → RANKS[1] = "Artesano". The card must name that rank, never a
    // fabricated higher rank. (Hardcoding "Gran maestro" for any newLevel is a lie.)
    const expectedRank = RANKS[1]?.title ?? "";
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toContain(expectedRank);
    expect(card.textContent).not.toContain("Gran maestro del gremio");
  });

  it("the level numeral reflects the real newLevel passed in", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} newLevel={3} />);
    expect(screen.getByTestId("celebration-level").textContent).toContain("3");
  });

  it("the level-up XpBar does not invent an XP threshold absent from RANKS", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} newLevel={2} />);

    // The hardcoded next=2000 is not a real RANKS threshold (100/500/1500/4000/10000).
    // A fresh bar at a new rank should read XP toward a REAL next threshold.
    const realThresholds = new Set(RANKS.map((r) => String(r.threshold)));
    const nextSpan = screen.getByTestId("xp-bar-next");
    expect(realThresholds.has(nextSpan.textContent ?? "")).toBe(true);
  });
});
