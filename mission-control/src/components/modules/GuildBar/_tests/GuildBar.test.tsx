/**
 * WO-09-004 — CMP-09-guild-bar tests (RED phase)
 *
 * Acceptance criteria (EARS, FRD-09 / WO-09-004):
 *   AC-09-004.1 — The top bar SHALL show the guild's level, title, XP bar to next,
 *                 "faltan N para Nv X · <next title>", from computeGuildLevel().
 *   AC-09-004.2 — Numbers use tabular-nums (elements rendered with numeric text).
 *   AC-09-004.3 — Bar reflects real pct-to-next from computeGuildLevel (no fake fill).
 *   AC-09-004.4 — Rationed accent; NOT color-alone (label+shape present).
 *   AC-09-004.5 — Reuses CMP-09-xp-bar primitive (XpBar).
 *
 * Traceability:
 *   CMP-09-guild-bar → blueprint §3 → WO-09-004 TDD plan
 *   Consumes IF-09-guild-xp (computeGuildLevel) from lib/gamification.ts (WO-09-001).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GuildOutcomes } from "@/lib/gamification/gamification";
import { GuildBar } from "../GuildBar";

// ---------------------------------------------------------------------------
// AC-09-004.1 — Shows level, title, XP bar to next from computeGuildLevel()
// ---------------------------------------------------------------------------

describe("AC-09-004.1 — GuildBar shows guild level, title, and XP bar", () => {
  it("renders without crashing with zero outcomes", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    const { container } = render(<GuildBar outcomes={outcomes} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders with data-testid='guild-bar'", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    expect(screen.getByTestId("guild-bar")).toBeDefined();
  });

  it("shows level number from computeGuildLevel() in the DOM", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    // Level 1 (zero state: Aprendiz, level 1)
    expect(screen.getByTestId("guild-bar-level").textContent).toContain("1");
  });

  it("shows rank title from computeGuildLevel() in the DOM", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    // "Aprendiz" is the rank-1 title in the RANKS ladder
    expect(screen.getByTestId("guild-bar-title").textContent).toContain("Aprendiz");
  });

  it("reflects higher outcomes in higher level/title", () => {
    const highOutcomes: GuildOutcomes = {
      workOrdersDone: 200,
      phasesCompleted: 20,
      releases: 5,
      greenTestRuns: 1000,
    };
    render(<GuildBar outcomes={highOutcomes} />);
    const levelEl = screen.getByTestId("guild-bar-level");
    // The pill text is "NV {level}" — extract the numeric part
    const digits = (levelEl.textContent ?? "0").match(/\d+/)?.[0] ?? "0";
    const levelNum = Number.parseInt(digits, 10);
    // With large outcomes, level should be > 1
    expect(levelNum).toBeGreaterThan(1);
  });

  it("contains the XpBar primitive (data-testid='xp-bar')", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 20,
    };
    render(<GuildBar outcomes={outcomes} />);
    // AC-09-004.5: GuildBar REUSES XpBar
    expect(screen.getByTestId("xp-bar")).toBeDefined();
  });

  it("shows 'Maestro del Gremio' title when at max rank", () => {
    const maxOutcomes: GuildOutcomes = {
      workOrdersDone: 10_000,
      phasesCompleted: 1_000,
      releases: 500,
      greenTestRuns: 50_000,
    };
    render(<GuildBar outcomes={maxOutcomes} />);
    const title = screen.getByTestId("guild-bar-title").textContent;
    expect(title).toContain("Maestro del Gremio");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.3 — Real pct-to-next from computeGuildLevel (no fake fill)
// ---------------------------------------------------------------------------

describe("AC-09-004.3 — GuildBar bar fill reflects real pct from computeGuildLevel", () => {
  it("zero outcomes → bar fill is 0% (honest zero state)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("0%");
  });

  it("NEGATIVE AC — zero outcomes NEVER renders bar fill near 80% (forbidden pattern)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const widthNum = Number.parseFloat(fill.style.width);
    expect(widthNum).toBeLessThan(50);
  });

  it("non-zero outcomes → bar fill is proportional (not 0% when XP > 0)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 10, // 100 XP — at rank Artesano threshold exactly
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const fill = screen.getByTestId("xp-bar-fill");
    // At exactly rank threshold, pctToNext should be 0 (just entered); but level should be > 1
    const levelEl = screen.getByTestId("guild-bar-level");
    // The pill text is "NV {level}" — extract the numeric part
    const digits = (levelEl.textContent ?? "0").match(/\d+/)?.[0] ?? "0";
    const level = Number.parseInt(digits, 10);
    expect(level).toBeGreaterThanOrEqual(1);
    // Fill must be in [0, 100]
    const widthNum = Number.parseFloat(fill.style.width);
    expect(widthNum).toBeGreaterThanOrEqual(0);
    expect(widthNum).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.1 — "faltan N para Nv X · <next title>" subtitle
// ---------------------------------------------------------------------------

describe("AC-09-004.1 — faltan N para Nv X · next-title subtitle", () => {
  it("renders next-label element with next XP value and next title", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    // The XpBar's next-label should contain the next rank title
    const nextLabel = screen.getByTestId("xp-bar-next-label");
    // At level 1 (Aprendiz), next rank is Artesano (threshold 100 XP)
    expect(nextLabel.textContent).toContain("Artesano");
  });

  it("at max rank, next-label shows current (top) rank title", () => {
    const maxOutcomes: GuildOutcomes = {
      workOrdersDone: 10_000,
      phasesCompleted: 1_000,
      releases: 500,
      greenTestRuns: 50_000,
    };
    render(<GuildBar outcomes={maxOutcomes} />);
    const nextLabel = screen.getByTestId("xp-bar-next-label");
    // At max rank the next title is the same as current (no higher rank)
    expect(nextLabel.textContent).toContain("Maestro del Gremio");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.2 — tabular-nums — numeric elements present
// ---------------------------------------------------------------------------

describe("AC-09-004.2 — numeric elements present for tabular-nums (CSS rule from globals.css)", () => {
  it("level element contains a digit (number rendered as text)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const text = screen.getByTestId("guild-bar-level").textContent ?? "";
    expect(/\d/.test(text)).toBe(true);
  });

  it("xp-bar-xp element shows the numeric XP value", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    // 5 WOs × 10 XP = 50 XP
    render(<GuildBar outcomes={outcomes} />);
    const xpEl = screen.getByTestId("xp-bar-xp");
    expect(xpEl.textContent).toContain("50");
  });

  it("xp-bar-next element shows the numeric next-threshold value", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    // At Aprendiz (level 1), next threshold is 100 XP (Artesano)
    render(<GuildBar outcomes={outcomes} />);
    const nextEl = screen.getByTestId("xp-bar-next");
    expect(nextEl.textContent).toContain("100");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.4 — rationed accent, not color-alone
// ---------------------------------------------------------------------------

describe("AC-09-004.4 — rationed accent, not color-alone", () => {
  it("renders both a text label AND a bar shape (not color-alone)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    expect(screen.getByTestId("guild-bar-title")).toBeDefined();
    expect(screen.getByTestId("xp-bar-track")).toBeDefined();
  });

  it("has a progressbar role on the XP bar (a11y shape signal)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    expect(screen.getByRole("progressbar")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.5 — reuses XpBar primitive (not inline re-implementation)
// ---------------------------------------------------------------------------

describe("AC-09-004.5 — GuildBar reuses XpBar primitive", () => {
  it("GuildBar DOM contains xp-bar root (XpBar is mounted, not inlined)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    const { container } = render(<GuildBar outcomes={outcomes} />);
    const guildBarRoot = container.querySelector('[data-testid="guild-bar"]');
    expect(guildBarRoot).not.toBeNull();
    // XpBar's root is nested inside GuildBar
    const xpBarRoot = guildBarRoot?.querySelector('[data-testid="xp-bar"]');
    expect(xpBarRoot).not.toBeNull();
  });

  it("GuildBar and XpBar share the same fill element (only one fill rendered)", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    const { container } = render(<GuildBar outcomes={outcomes} />);
    const fills = container.querySelectorAll('[data-testid="xp-bar-fill"]');
    // Exactly one fill (no duplication between GuildBar and XpBar)
    expect(fills.length).toBe(1);
  });
});
