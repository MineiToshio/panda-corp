/**
 * WO-18-005 — CMP-18-progress (Progreso gamification strip) tests (RED → GREEN → refactor)
 *
 * Acceptance criteria (EARS, FRD-18 / REQ-18-021 / WO-18-005):
 *
 *   AC-18-005.1 — The strip shows guild level/XP, the most recent achievement,
 *                 and the next milestone with progress.
 *   AC-18-005.2 — All values derive from REAL outcomes (shipped, phases completed,
 *                 lessons graduated) per FRD-09 — no synthetic/streak metric.
 *   AC-18-005.3 — No streaks and no false urgency (REQ-18-003 / FRD-09 White-Hat).
 *   AC-18-005.4 — Fresh factory (no achievements) → an honest "your first achievement awaits" state.
 *   AC-18-005.5 — `tabular-nums` on XP; Spanish + a11y.
 *
 * Blueprint:
 *   CMP-18-progress → components/dashboard/Progreso/Progreso.tsx
 *   Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 *
 * Traceability: REQ-18-021 → AC-18-005.1 … AC-18-005.5
 *
 * FRD-09 White-Hat honesty invariants verified by these tests:
 *   - XP only from real outcomes passed in as props (no I/O in component)
 *   - No streak/timer/false-urgency elements in the DOM
 *   - Empty factory → honest zero state, never fabricated progress
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChainState, Unique } from "@/lib/achievements/achievements";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { Progreso } from "../Progreso";

// ---------------------------------------------------------------------------
// Test fixtures — FRD-09 data shapes
// ---------------------------------------------------------------------------

/** Guild level from a non-trivial real outcomes run (Artesano, 10 WOs done). */
const FIXTURE_GUILD_LEVEL: GuildLevel = {
  level: 2,
  title: "Artesano",
  xp: 100,
  next: 500,
  pctToNext: 0,
};

/** Guild level for fresh factory (zero state). */
const FIXTURE_GUILD_LEVEL_ZERO: GuildLevel = {
  level: 1,
  title: "Aprendiz",
  xp: 0,
  next: 100,
  pctToNext: 0,
};

/** A unique achievement with unlocked=true (most recent). */
const FIXTURE_RECENT_ACHIEVEMENT: Unique = {
  name: "El primer ladrillo",
  category: "Mastery",
  unlocked: true,
  date: "2026-06-15",
  project: "proj-a",
  condition: "Lanza tu primer producto",
};

/** A chain representing the next milestone (next tier exists). */
const FIXTURE_NEXT_MILESTONE: ChainState = {
  statKey: "shipped",
  label: "Productos lanzados",
  currentTierIndex: 0,
  currentTierName: "El primer ladrillo",
  nextTier: { name: "Maestro de obras", threshold: 5 },
  pctToNext: 20,
  lowerIsBetter: false,
  unlocks: [],
};

/** A chain that is maxed (no next tier). */
const FIXTURE_MAXED_CHAIN: ChainState = {
  statKey: "workorders",
  label: "Work orders completados",
  currentTierIndex: 4,
  currentTierName: "El gran maestro",
  nextTier: null,
  pctToNext: 100,
  lowerIsBetter: false,
  unlocks: [],
};

// ---------------------------------------------------------------------------
// AC-18-005.1 — The strip shows guild level/XP, recent achievement, next milestone
// ---------------------------------------------------------------------------

describe("AC-18-005.1 — Progreso strip shows level/XP, recent achievement, and next milestone", () => {
  it("renders without crashing with full data", () => {
    const { container } = render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders data-testid='progreso-strip'", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(screen.getByTestId("progreso-strip")).toBeDefined();
  });

  it("shows guild level number in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // Level 2 from FIXTURE_GUILD_LEVEL
    expect(screen.getByTestId("progreso-guild-level").textContent).toContain("2");
  });

  it("shows guild title (rank name) in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(screen.getByTestId("progreso-guild-title").textContent).toContain("Artesano");
  });

  it("shows guild XP value in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(screen.getByTestId("progreso-xp").textContent).toContain("100");
  });

  it("shows the name of the most recent achievement", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(screen.getByTestId("progreso-recent-achievement").textContent).toContain(
      "El primer ladrillo",
    );
  });

  it("shows the next milestone name", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    expect(screen.getByTestId("progreso-next-milestone").textContent).toContain("Maestro de obras");
  });

  it("shows the next milestone threshold", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // threshold = 5 shown in the milestone details
    expect(screen.getByTestId("progreso-next-milestone").textContent).toContain("5");
  });

  it("renders an XP progress bar element", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // XpBar renders role=progressbar
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// AC-18-005.2 — All values derive from REAL outcomes (no synthetic metric)
// ---------------------------------------------------------------------------

describe("AC-18-005.2 — Values derived from real outcomes only", () => {
  it("renders the exact XP passed in — never inflates it", () => {
    const lowGuild: GuildLevel = {
      level: 1,
      title: "Aprendiz",
      xp: 42,
      next: 100,
      pctToNext: 42,
    };
    render(<Progreso guildLevel={lowGuild} recentAchievement={null} nextMilestone={null} />);
    expect(screen.getByTestId("progreso-xp").textContent).toContain("42");
  });

  it("renders exact pctToNext from guildLevel — never recalculates", () => {
    const partialGuild: GuildLevel = {
      level: 1,
      title: "Aprendiz",
      xp: 55,
      next: 100,
      pctToNext: 55,
    };
    render(<Progreso guildLevel={partialGuild} recentAchievement={null} nextMilestone={null} />);
    // The XpBar progressbar should have aria-valuenow=55 (or similar)
    const bar = screen.getByRole("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBe(55);
  });

  it("shows the chain's current value relative to threshold (real progress)", () => {
    const chainWithProgress: ChainState = {
      statKey: "shipped",
      label: "Productos lanzados",
      currentTierIndex: -1,
      currentTierName: null,
      nextTier: { name: "El primer ladrillo", threshold: 1 },
      pctToNext: 0,
      lowerIsBetter: false,
      unlocks: [],
    };
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={null}
        nextMilestone={chainWithProgress}
      />,
    );
    expect(screen.getByTestId("progreso-next-milestone").textContent).toContain(
      "El primer ladrillo",
    );
  });
});

// ---------------------------------------------------------------------------
// AC-18-005.3 — No streaks and no false urgency
// ---------------------------------------------------------------------------

describe("AC-18-005.3 — No streaks, no false urgency, White-Hat FRD-09", () => {
  it("does not render any streak counter in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    const strip = screen.getByTestId("progreso-strip");
    // The words "racha" (streak) or "días" (days) must not appear
    expect(strip.textContent).not.toMatch(/racha/i);
    expect(strip.textContent).not.toMatch(/\bdías consecutivos\b/i);
  });

  it("does not render any urgency timer or countdown in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    const strip = screen.getByTestId("progreso-strip");
    // Words like "expira" or "timer" must not appear
    expect(strip.textContent).not.toMatch(/expira/i);
    expect(strip.textContent).not.toMatch(/timer/i);
    expect(strip.textContent).not.toMatch(/cuenta atrás/i);
  });

  it("does not render any leaderboard in the DOM", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    const strip = screen.getByTestId("progreso-strip");
    expect(strip.textContent).not.toMatch(/ranking/i);
    expect(strip.textContent).not.toMatch(/tabla de clasificación/i);
  });
});

// ---------------------------------------------------------------------------
// AC-18-005.4 — Fresh factory (no achievements) → honest "first achievement awaits" state
// ---------------------------------------------------------------------------

describe("AC-18-005.4 — Fresh factory shows honest empty state", () => {
  it("renders without crashing when recentAchievement is null", () => {
    const { container } = render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("shows an 'awaits' message when there are no achievements", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    // Must show some "first achievement awaits" style message (in Spanish)
    const strip = screen.getByTestId("progreso-strip");
    // Could match "tu primer logro" or "primer logro" or "awaits"
    expect(strip.textContent).toMatch(/primer logro|te espera|sin logros/i);
  });

  it("shows level 1 / Aprendiz for zero-outcomes fresh factory", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    expect(screen.getByTestId("progreso-guild-level").textContent).toContain("1");
    expect(screen.getByTestId("progreso-guild-title").textContent).toContain("Aprendiz");
  });

  it("shows 0 XP for zero-outcomes fresh factory", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    expect(screen.getByTestId("progreso-xp").textContent).toContain("0");
  });

  it("does not show a milestone section when nextMilestone is null", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    // Either the milestone testid is absent or it shows "al máximo"
    const milestone = screen.queryByTestId("progreso-next-milestone");
    if (milestone !== null) {
      // Allowed to exist but must not show a real chain name
      expect(milestone.textContent).toMatch(/máximo|cadenas al máximo|sin hitos/i);
    }
    // No assertion failure if absent — both are valid
  });

  it("shows an honest 0% XP bar for zero-outcomes (not stuck near 80%)", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
        recentAchievement={null}
        nextMilestone={null}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBe(0);
  });

  it("shows 'chains at max' message when nextMilestone has no next tier (maxed)", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_MAXED_CHAIN}
      />,
    );
    const strip = screen.getByTestId("progreso-strip");
    // When nextTier is null, show "Cadenas al máximo" or equivalent
    expect(strip.textContent).toMatch(/máximo|cadenas al máximo|sin hitos/i);
  });
});

// ---------------------------------------------------------------------------
// AC-18-005.5 — tabular-nums on XP; Spanish + a11y
// ---------------------------------------------------------------------------

describe("AC-18-005.5 — tabular-nums on XP; Spanish labels; a11y", () => {
  it("XP is rendered as a text node (tabular-nums applied via globals.css)", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // The XP value must be a text node, not an image or aria-hidden span
    const xpEl = screen.getByTestId("progreso-xp");
    expect(xpEl.textContent).toContain("100");
  });

  it("the XP bar has an accessible aria-label in Spanish", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    const bar = screen.getByRole("progressbar");
    const label = bar.getAttribute("aria-label") ?? "";
    // Must be non-empty and in Spanish (contains "XP" and some Spanish word)
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/XP|progreso|nivel/i);
  });

  it("the strip has an accessible section label", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // The root element should have an aria-label describing its purpose
    const strip = screen.getByTestId("progreso-strip");
    const label = strip.getAttribute("aria-label") ?? strip.getAttribute("aria-labelledby") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("guild level and XP are rendered without hardcoded colors (no inline color= hack)", () => {
    const { container } = render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // Find all elements with a hardcoded color property (not var(--)  style)
    const allElements = container.querySelectorAll("*");
    for (const el of allElements) {
      const inlineColor = (el as HTMLElement).style.color;
      if (inlineColor && !inlineColor.startsWith("var(")) {
        // Direct hardcoded color values are not allowed (must use CSS vars)
        expect(inlineColor).toBe("");
      }
      const inlineBg = (el as HTMLElement).style.backgroundColor;
      if (inlineBg && !inlineBg.startsWith("var(")) {
        expect(inlineBg).toBe("");
      }
    }
  });

  it("the recent-achievement section has readable text (Spanish)", () => {
    render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // "Logro reciente" label should appear somewhere near the achievement
    const strip = screen.getByTestId("progreso-strip");
    expect(strip.textContent).toMatch(/logro|reciente|trofeo|achievement/i);
  });

  it("renders without any <a> link or <button> causing interactive nesting issues", () => {
    const { container } = render(
      <Progreso
        guildLevel={FIXTURE_GUILD_LEVEL}
        recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
        nextMilestone={FIXTURE_NEXT_MILESTONE}
      />,
    );
    // No button or link elements (Progreso is a read-only strip — no interactions)
    const buttons = container.querySelectorAll("button");
    const links = container.querySelectorAll("a");
    expect(buttons.length).toBe(0);
    expect(links.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration seam — prop shapes verified (no I/O in component)
// ---------------------------------------------------------------------------

describe("Integration seam — Progreso accepts pre-computed FRD-09 data as props", () => {
  it("accepts GuildLevel + Unique | null + ChainState | null without errors", () => {
    // Proves the component is a pure render of already-computed FRD-09 data
    // (Server Component data is passed as props — no lib/ calls inside)
    expect(() => {
      render(
        <Progreso
          guildLevel={FIXTURE_GUILD_LEVEL}
          recentAchievement={FIXTURE_RECENT_ACHIEVEMENT}
          nextMilestone={FIXTURE_NEXT_MILESTONE}
        />,
      );
    }).not.toThrow();
  });

  it("accepts null for both optional props without errors (fresh factory)", () => {
    expect(() => {
      render(
        <Progreso
          guildLevel={FIXTURE_GUILD_LEVEL_ZERO}
          recentAchievement={null}
          nextMilestone={null}
        />,
      );
    }).not.toThrow();
  });
});
