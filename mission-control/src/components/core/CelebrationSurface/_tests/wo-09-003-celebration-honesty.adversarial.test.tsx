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
import { RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
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

    // Rank = the level BAND: level 2 sits in the Humano band (Nv 1–3). The card
    // must name the REAL rank for that level, never a fabricated higher rank.
    const expectedRank = RANKS[rankForLevel(2)]?.title ?? "";
    const card = screen.getByTestId("celebration-card");
    expect(card.textContent).toContain(expectedRank);
    expect(card.textContent).not.toContain("Gran maestro del gremio");
  });

  it("the level numeral reflects the real newLevel passed in", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} newLevel={3} />);
    expect(screen.getByTestId("celebration-level").textContent).toContain("3");
  });

  it("the level-up XpBar reads toward the REAL next-level XP (no invented number)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} newLevel={2} />);

    // A fresh bar at the new level reads toward the next granular level's REAL XP
    // (xpForLevel(3)), never a hardcoded/fabricated number.
    const nextSpan = screen.getByTestId("xp-bar-next");
    expect(nextSpan.textContent).toBe(String(xpForLevel(3)));
  });
});
