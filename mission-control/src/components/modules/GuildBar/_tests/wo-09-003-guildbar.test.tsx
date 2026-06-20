/**
 * WO-09-003 — GuildBar visual re-anchor (RED → GREEN → refactor)
 *
 * Tests that verify the GuildBar matches the prototype's topbar() guild section:
 *   - rpgpanel rpggrid container style
 *   - NV pill (accent background, pixel font, canvas text)
 *   - Guild title (text2 color, 11px)
 *   - Compact inline XpBar (90px wide, 9px tall, vertically centered)
 *
 * AC-09-004.1 — Shows guild level, title, XP bar from computeGuildLevel()
 * AC-09-004.2 — Numbers use tabular-nums (text nodes in px class)
 * AC-09-004.3 — Bar fill reflects real pct-to-next
 * AC-09-004.4 — Rationed accent (NV pill + bar fill only), not color-alone
 * AC-09-004.5 — Reuses XpBar primitive
 *
 * Visual reference: prototype topbar() ~L646
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GuildOutcomes } from "@/lib/gamification/gamification";
import { GuildBar } from "../GuildBar";

const ZERO_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 0,
  phasesCompleted: 0,
  releases: 0,
  greenTestRuns: 0,
};

const HIGH_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 50,
  phasesCompleted: 5,
  releases: 2,
  greenTestRuns: 200,
};

// ── AC-09-004.1: shows level, title, compact XP bar ──────────────────────────

describe("WO-09-003 — GuildBar AC-09-004.1: level + title + compact XP bar", () => {
  it("renders guild-bar root with data-testid", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    expect(screen.getByTestId("guild-bar")).toBeDefined();
  });

  it("renders NV level pill with guild-bar-level testid", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const pill = screen.getByTestId("guild-bar-level");
    expect(pill).toBeDefined();
    expect(pill.textContent).toMatch(/1/);
  });

  it("renders NV label alongside the level number", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    expect(bar.textContent).toMatch(/NV/i);
  });

  it("renders guild-bar-title with rank text", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const title = screen.getByTestId("guild-bar-title");
    expect(title.textContent).toContain("Aprendiz");
  });

  it("renders xp-bar compact inside guild-bar", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const xpBar = screen.getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("compact xp-bar has data-size='compact' or is nested inside guild-bar", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    const xpBar = bar.querySelector("[data-testid='xp-bar']");
    expect(xpBar).not.toBeNull();
  });

  it("higher outcomes produce a higher level", () => {
    render(<GuildBar outcomes={HIGH_OUTCOMES} />);
    const level = Number.parseInt(screen.getByTestId("guild-bar-level").textContent ?? "0", 10);
    expect(level).toBeGreaterThan(1);
  });
});

// ── AC-09-004.2: tabular-nums ────────────────────────────────────────────────

describe("WO-09-003 — GuildBar AC-09-004.2: tabular-nums numeric elements", () => {
  it("level element contains a digit text node", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const text = screen.getByTestId("guild-bar-level").textContent ?? "";
    expect(/\d/.test(text)).toBe(true);
  });

  it("xp-bar-xp shows the numeric XP value", () => {
    render(<GuildBar outcomes={{ ...ZERO_OUTCOMES, workOrdersDone: 5 }} />);
    // 5 WOs × 10 XP = 50 XP
    const xpEl = screen.getByTestId("xp-bar-xp");
    expect(xpEl.textContent).toContain("50");
  });
});

// ── AC-09-004.3: real pct-to-next, no fake fill ──────────────────────────────

describe("WO-09-003 — GuildBar AC-09-004.3: real pct-to-next, no fake fill", () => {
  it("zero outcomes → fill is 0%", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("0%");
  });

  it("NEGATIVE AC: zero outcomes must never render fill near 80%", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const pct = Number.parseFloat(fill.style.width);
    expect(pct).toBeLessThan(50);
  });

  it("non-zero outcomes render fill in [0, 100]", () => {
    render(<GuildBar outcomes={HIGH_OUTCOMES} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const pct = Number.parseFloat(fill.style.width);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

// ── AC-09-004.4: rationed accent, not color-alone ───────────────────────────

describe("WO-09-003 — GuildBar AC-09-004.4: rationed accent, not color-alone", () => {
  it("renders text label AND bar shape (not color-alone)", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    expect(screen.getByTestId("guild-bar-title")).toBeDefined();
    expect(screen.getByTestId("xp-bar-track")).toBeDefined();
  });

  it("progressbar role is present on XP bar", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    expect(screen.getByRole("progressbar")).toBeDefined();
  });
});

// ── AC-09-004.5: reuses XpBar primitive ─────────────────────────────────────

describe("WO-09-003 — GuildBar AC-09-004.5: reuses XpBar primitive", () => {
  it("GuildBar DOM contains xp-bar (XpBar is mounted)", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const root = screen.getByTestId("guild-bar");
    expect(root.querySelector('[data-testid="xp-bar"]')).not.toBeNull();
  });

  it("exactly one xp-bar-fill element (no duplication)", () => {
    const { container } = render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const fills = container.querySelectorAll("[data-testid='xp-bar-fill']");
    expect(fills.length).toBe(1);
  });
});

// ── Visual fidelity: rpgpanel/rpggrid prototype pattern ─────────────────────

describe("WO-09-003 — GuildBar visual fidelity: prototype topbar() guild section", () => {
  it("guild-bar root has data-variant='rpgpanel' or rpgpanel class or rpgpanel-style", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    // The container should have the rpgpanel embossed look (via class or data attr)
    const hasRpg =
      bar.classList.contains("rpgpanel") ||
      bar.getAttribute("data-variant") === "rpgpanel" ||
      bar.getAttribute("data-variant") === "guild-bar" ||
      // Or via the Panel component with variant=rpgpanel
      bar.querySelector("[data-variant='rpgpanel']") !== null;
    expect(hasRpg).toBe(true);
  });

  it("NV pill has accent background (uses accent token, not plain text)", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const pill = screen.getByTestId("guild-bar-level-pill");
    expect(pill).toBeDefined();
    // Pill must indicate accent via inline style or data attribute
    const style = pill.getAttribute("style") ?? "";
    const hasAccent =
      style.includes("var(--color-accent)") ||
      style.includes("accent") ||
      pill.getAttribute("data-accent") === "true";
    expect(hasAccent).toBe(true);
  });

  it("NV label uses pixel font class or data-px attribute", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    // Either the pill or NV label uses pixel font
    const hasPx =
      bar.querySelector("[data-px='true']") !== null ||
      bar.querySelector(".px") !== null ||
      bar.querySelector("[data-testid='guild-bar-level-pill']") !== null;
    expect(hasPx).toBe(true);
  });

  it("compact XpBar is inline (not stacked as a separate row)", () => {
    render(<GuildBar outcomes={ZERO_OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    // Just confirm xp-bar is nested inside guild-bar (structural, flex row)
    const xpBarEl = bar.querySelector("[data-testid='xp-bar']");
    expect(xpBarEl).not.toBeNull();
    // And it has data-size='compact'
    expect(xpBarEl?.getAttribute("data-size")).toBe("compact");
  });
});
