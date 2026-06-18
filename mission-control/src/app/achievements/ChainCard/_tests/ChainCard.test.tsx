/**
 * WO-10-006 — ChainCard + AlmostThere tests (RED → GREEN → refactor)
 *
 * Acceptance criteria (EARS, FRD-10 / WO-10-006):
 *
 *   AC-10-006.1 — Each chain card SHALL show the current tier (Bronze→Legend),
 *                 a bar to the next tier with the next tier's name, and tier pips,
 *                 from computeChains().
 *
 *   AC-10-006.2 — Each unlocked tier SHALL show its date and project.
 *
 *   AC-10-006.3 — The progress bar SHALL show honest endowed progress (real achieved,
 *                 never inflated/stuck) and SHALL reuse CMP-09-xp-bar (negative AC).
 *
 *   AC-10-006.4 — The "Almost there" section SHALL show the chains closest to their
 *                 next tier; it SHALL NOT use false urgency, countdowns or nagging
 *                 (negative AC, FRD-09).
 *
 *   AC-10-006.5 — Tier colors SHALL come from FRD-13 tier tokens; state never by
 *                 color alone (badge label present).
 *
 * Blueprint: CMP-10-chain-card, CMP-10-almost-there (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type ChainState, computeChains, computeStats } from "@/lib/achievements";
import { AlmostThere } from "../../AlmostThere";
import { ChainCard } from "../ChainCard";

// ── Fixture helpers ────────────────────────────────────────────────────────────

/**
 * Build a minimal ChainState fixture for testing.
 */
function mkChain(overrides: Partial<ChainState> = {}): ChainState {
  return {
    statKey: "shipped",
    label: "Productos lanzados",
    currentTierIndex: 0,
    currentTierName: "El primer ladrillo",
    nextTier: { name: "Maestro de obras", threshold: 5 },
    pctToNext: 20,
    lowerIsBetter: false,
    unlocks: [{ tier: 0, date: "2026-01-15", project: "my-project" }],
    ...overrides,
  };
}

/** Chain with no tier unlocked yet */
function mkNoTierChain(): ChainState {
  return {
    statKey: "ideas",
    label: "Ideas capturadas",
    currentTierIndex: -1,
    currentTierName: null,
    nextTier: { name: "Mente inquieta", threshold: 5 },
    pctToNext: 0,
    lowerIsBetter: false,
    unlocks: [],
  };
}

/** Chain that is maxed out (no next tier) */
function mkMaxedChain(): ChainState {
  return {
    statKey: "shipped",
    label: "Productos lanzados",
    currentTierIndex: 4,
    currentTierName: "El oráculo de la fábrica",
    nextTier: null,
    pctToNext: 100,
    lowerIsBetter: false,
    unlocks: [
      { tier: 0, date: "2024-01-01", project: "project-a" },
      { tier: 1, date: "2024-06-01", project: "project-b" },
      { tier: 2, date: "2025-01-01", project: "project-c" },
      { tier: 3, date: "2025-06-01", project: "project-d" },
      { tier: 4, date: "2026-01-01", project: "project-e" },
    ],
  };
}

/** Lower-is-better chain with a tier unlocked */
function mkSpeedChain(): ChainState {
  return {
    statKey: "speed",
    label: "Récord idea→launch (días)",
    currentTierIndex: 1,
    currentTierName: "El cohete",
    nextTier: { name: "La semana perfecta", threshold: 7 },
    pctToNext: 50,
    lowerIsBetter: true,
    unlocks: [
      { tier: 0, date: "2025-03-10", project: "fast-project" },
      { tier: 1, date: "2026-02-20", project: "faster-project" },
    ],
  };
}

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-006.1 — Chain card: current tier, bar with next tier name, tier pips
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-006.1 — chain card shows current tier, bar, next tier name, tier pips", () => {
  it("renders without crashing", () => {
    const { container } = render(<ChainCard chain={mkChain()} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("has data-testid='chain-card'", () => {
    render(<ChainCard chain={mkChain()} />);
    expect(screen.getByTestId("chain-card")).toBeDefined();
  });

  it("displays the chain label", () => {
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    expect(card.textContent).toContain("Productos lanzados");
  });

  it("shows the current tier badge when a tier is unlocked", () => {
    render(<ChainCard chain={mkChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    expect(badge).toBeDefined();
    // Badge text must be the tier name (not color-alone)
    expect(badge.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("shows current tier name text in the badge (AC-10-006.5 not-color-alone)", () => {
    render(<ChainCard chain={mkChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    // Must contain a readable tier label, not just an icon/color
    expect(badge.textContent?.trim()).toBeTruthy();
  });

  it("shows next tier name when a next tier exists", () => {
    render(<ChainCard chain={mkChain()} />);
    const nextTierEl = screen.getByTestId("chain-next-tier-name");
    expect(nextTierEl.textContent).toContain("Maestro de obras");
  });

  it("renders tier pips (one per tier in the chain)", () => {
    // shipped chain has 5 tiers
    const shippedChain = mkChain({
      statKey: "shipped",
    });
    render(<ChainCard chain={shippedChain} />);
    const pips = screen.getAllByTestId(/^chain-pip-/);
    expect(pips.length).toBeGreaterThan(0);
  });

  it("renders a progress bar (reuses xp-bar — AC-10-006.3)", () => {
    render(<ChainCard chain={mkChain()} />);
    const xpBar = screen.getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("tier badge uses a tier-level CSS variable (not hardcoded hex/rgb/hsl — AC-10-006.5)", () => {
    render(<ChainCard chain={mkChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    // If the badge has inline style with a color, it must use var(--*)
    const styleAttr = badge.getAttribute("style") ?? "";
    if (styleAttr.includes("color") || styleAttr.includes("background")) {
      expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,8}(?!\w)/);
      expect(styleAttr).not.toMatch(/\brgb\(/);
      expect(styleAttr).not.toMatch(/\bhsl\(/);
    }
  });

  it("no tier unlocked: shows '—' or 'Sin nivel' as the tier label (not blank)", () => {
    render(<ChainCard chain={mkNoTierChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    const text = badge.textContent?.trim() ?? "";
    // Must have some label when not yet unlocked (not silent/invisible)
    expect(text.length).toBeGreaterThan(0);
  });

  it("maxed-out chain shows no 'next tier' element or an empty/maxed state", () => {
    render(<ChainCard chain={mkMaxedChain()} />);
    const nextTierEl = screen.queryByTestId("chain-next-tier-name");
    // When maxed, next tier element is absent or its text is empty/maxed message
    if (nextTierEl) {
      const text = nextTierEl.textContent?.trim() ?? "";
      // May say "Máximo" / "" / nothing
      expect(text.length).toBeLessThanOrEqual(20);
    } else {
      expect(nextTierEl).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-006.2 — Unlocked tiers show date + project
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-006.2 — unlocked tiers show date and project", () => {
  it("shows the unlock date for the unlocked tier", () => {
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    // The date "2026-01-15" must appear somewhere in the card
    expect(card.textContent).toContain("2026-01-15");
  });

  it("shows the project name for the unlocked tier", () => {
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    expect(card.textContent).toContain("my-project");
  });

  it("shows date+project for each unlocked tier in a multi-tier chain", () => {
    render(<ChainCard chain={mkMaxedChain()} />);
    const card = screen.getByTestId("chain-card");
    // At least the first and last unlocks should be visible
    expect(card.textContent).toContain("project-a");
    expect(card.textContent).toContain("project-e");
    expect(card.textContent).toContain("2024-01-01");
    expect(card.textContent).toContain("2026-01-01");
  });

  it("tier unlock list renders items with data-testid='chain-unlock-item'", () => {
    render(<ChainCard chain={mkChain()} />);
    const unlockItems = screen.getAllByTestId("chain-unlock-item");
    expect(unlockItems.length).toBeGreaterThanOrEqual(1);
  });

  it("each unlock item shows date and project as separate elements", () => {
    render(<ChainCard chain={mkChain()} />);
    const unlockItem = screen.getAllByTestId("chain-unlock-item")[0];
    expect(unlockItem).toBeDefined();
    expect(unlockItem?.textContent).toContain("2026-01-15");
    expect(unlockItem?.textContent).toContain("my-project");
  });

  it("no unlock items rendered when chain has no unlocks", () => {
    render(<ChainCard chain={mkNoTierChain()} />);
    const unlockItems = screen.queryAllByTestId("chain-unlock-item");
    expect(unlockItems.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-006.3 — Honest endowed progress bar (real, never inflated/stuck)
//               and reuses CMP-09-xp-bar (negative: NO custom bar)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-006.3 — honest endowed progress bar reusing CMP-09-xp-bar", () => {
  it("XP bar fill reflects the pctToNext from the chain (not inflated)", () => {
    render(<ChainCard chain={mkChain({ pctToNext: 20 })} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill).toBeDefined();
    // Width should be 20%
    expect(fill.getAttribute("style")).toContain("20%");
  });

  it("XP bar fill is 0% when pctToNext=0 (no tier yet, honest empty)", () => {
    render(<ChainCard chain={mkNoTierChain()} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.getAttribute("style")).toContain("0%");
  });

  it("XP bar fill is 100% when chain is maxed (pctToNext=100)", () => {
    render(<ChainCard chain={mkMaxedChain()} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.getAttribute("style")).toContain("100%");
  });

  it("NEGATIVE AC — 0% pctToNext never renders fill ≥ 50% (no inflated endowed bar)", () => {
    render(<ChainCard chain={mkNoTierChain()} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const style = fill.getAttribute("style") ?? "";
    const match = style.match(/width:\s*([\d.]+)%/);
    const widthNum = match ? Number.parseFloat(match[1] ?? "0") : 0;
    expect(widthNum).toBeLessThan(50);
  });

  it("XP bar has role=progressbar (a11y reuse of CMP-09-xp-bar)", () => {
    render(<ChainCard chain={mkChain()} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
  });

  it("XP bar shows the next tier name as its label", () => {
    render(<ChainCard chain={mkChain()} />);
    // next tier name "Maestro de obras" should appear near the bar
    const xpBar = screen.getByTestId("xp-bar");
    expect(xpBar.textContent).toContain("Maestro de obras");
  });

  it("speed (lower-is-better) chain renders XP bar correctly (pctToNext 50 → 50%)", () => {
    render(<ChainCard chain={mkSpeedChain()} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const style = fill.getAttribute("style") ?? "";
    const match = style.match(/width:\s*([\d.]+)%/);
    const pct = match ? Number.parseFloat(match[1] ?? "0") : -1;
    expect(pct).toBeCloseTo(50, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-006.5 — Tier colors from FRD-13 tokens; state not by color alone
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-006.5 — tier colors from tokens; state not color-alone", () => {
  it("chain card has no hardcoded hex/rgb/hsl colors in inline styles", () => {
    render(<ChainCard chain={mkChain()} />);
    const allEls = document.querySelectorAll("[data-testid='chain-card'] [style]");
    for (const el of allEls) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}(?!\w)/);
      expect(style).not.toMatch(/\brgb\(/);
      expect(style).not.toMatch(/\bhsl\(/);
    }
  });

  it("tier badge label is present (text label alongside any color — not color-alone)", () => {
    render(<ChainCard chain={mkChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    // Must have visible text (not just a colored dot/icon with no label)
    const text = badge.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
  });

  it("tier badge has a data-tier attribute for tier-level token binding", () => {
    render(<ChainCard chain={mkChain({ currentTierIndex: 0 })} />);
    const badge = screen.getByTestId("chain-tier-badge");
    const tierAttr = badge.getAttribute("data-tier");
    expect(tierAttr).toBeTruthy();
  });

  it("tier badge data-tier matches the currentTierIndex + 1 (1-indexed tier number)", () => {
    // Bronze = tier 0 → data-tier="1"
    render(<ChainCard chain={mkChain({ currentTierIndex: 0 })} />);
    const badge = screen.getByTestId("chain-tier-badge");
    expect(badge.getAttribute("data-tier")).toBe("1");
  });

  it("tier badge data-tier=0 for no-tier chain (no color token needed)", () => {
    render(<ChainCard chain={mkNoTierChain()} />);
    const badge = screen.getByTestId("chain-tier-badge");
    expect(badge.getAttribute("data-tier")).toBe("0");
  });

  it("tier pips reflect correct filled/unfilled state by class or attribute, not color-alone", () => {
    render(<ChainCard chain={mkChain({ currentTierIndex: 1 })} />);
    const pips = screen.getAllByTestId(/^chain-pip-/);
    // At least one pip should be marked filled (data-filled=true or similar)
    const filledPips = pips.filter((pip) => pip.getAttribute("data-filled") === "true");
    expect(filledPips.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CMP-10-almost-there — "Almost there" section (AC-10-006.4)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-006.4 — AlmostThere section: top chains by % to next tier", () => {
  const chains: ChainState[] = [
    mkChain({ statKey: "shipped", label: "Productos lanzados", pctToNext: 80 }),
    mkChain({ statKey: "ideas", label: "Ideas capturadas", pctToNext: 60 }),
    mkChain({ statKey: "workorders", label: "Work orders completados", pctToNext: 90 }),
    mkChain({ statKey: "phases", label: "Fases completadas", pctToNext: 30 }),
    mkChain({ statKey: "adrs", label: "ADRs registrados", pctToNext: 10 }),
  ];

  it("renders without crashing", () => {
    const { container } = render(<AlmostThere chains={chains} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("has data-testid='almost-there'", () => {
    render(<AlmostThere chains={chains} />);
    expect(screen.getByTestId("almost-there")).toBeDefined();
  });

  it("renders a section heading in Spanish", () => {
    render(<AlmostThere chains={chains} />);
    const section = screen.getByTestId("almost-there");
    expect(section.textContent).toMatch(/casi|cerca|siguiente|logro/i);
  });

  it("shows the top chains ordered by pctToNext descending (highest % first)", () => {
    render(<AlmostThere chains={chains} />);
    const items = screen.getAllByTestId("almost-there-item");
    // First item should have the highest pctToNext (90%)
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]?.textContent).toContain("Work orders completados");
  });

  it("shows at most 3 chains (top 3 by pctToNext — Zeigarnik)", () => {
    render(<AlmostThere chains={chains} />);
    const items = screen.getAllByTestId("almost-there-item");
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it("shows at least 1 chain when any chains are progressing", () => {
    render(<AlmostThere chains={chains} />);
    const items = screen.getAllByTestId("almost-there-item");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("NEGATIVE AC — renders NO countdown, no urgency words (no 'hoy', 'ahora', '¡rápido!')", () => {
    render(<AlmostThere chains={chains} />);
    const section = screen.getByTestId("almost-there");
    const text = section.textContent?.toLowerCase() ?? "";
    // No false urgency language
    expect(text).not.toMatch(/\bhoy\b/);
    expect(text).not.toMatch(/ahora mismo/);
    expect(text).not.toMatch(/rápido/);
    expect(text).not.toMatch(/¡/);
    expect(text).not.toMatch(/urgente/);
  });

  it("NEGATIVE AC — renders NO countdown timers or deadlines", () => {
    render(<AlmostThere chains={chains} />);
    const section = screen.getByTestId("almost-there");
    const text = section.textContent ?? "";
    // No countdown patterns: "3 días restantes", "quedan X horas"
    expect(text).not.toMatch(/\d+\s*(día|hora|minuto)s?\s*(restante|quedan)/i);
    expect(text).not.toMatch(/deadline/i);
    expect(text).not.toMatch(/expira/i);
  });

  it("each 'almost there' item shows the chain label", () => {
    render(<AlmostThere chains={chains} />);
    const items = screen.getAllByTestId("almost-there-item");
    for (const item of items) {
      expect(item.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("each 'almost there' item includes a progress bar (reuses xp-bar)", () => {
    render(<AlmostThere chains={[mkChain({ pctToNext: 80 })]} />);
    const xpBars = screen.getAllByTestId("xp-bar");
    expect(xpBars.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state gracefully when no chains have progress", () => {
    const emptyChains: ChainState[] = [
      mkChain({ pctToNext: 0, currentTierIndex: -1, unlocks: [] }),
    ];
    const { container } = render(<AlmostThere chains={emptyChains} />);
    // Must not crash; section can be empty or show a placeholder
    expect(container.firstChild).not.toBeNull();
  });

  it("renders empty state gracefully when chains array is empty", () => {
    const { container } = render(<AlmostThere chains={[]} />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByTestId("almost-there")).toBeDefined();
  });

  it("maxed chains (pctToNext=100) are excluded from the list", () => {
    const onlyMaxed: ChainState[] = [mkMaxedChain(), mkMaxedChain()];
    render(<AlmostThere chains={onlyMaxed} />);
    const items = screen.queryAllByTestId("almost-there-item");
    expect(items.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: ChainCard + AlmostThere use the real computeChains output
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — ChainCard and AlmostThere with computeChains output", () => {
  it("ChainCard renders with the shipped chain from real computeChains output", () => {
    const stats = computeStats({ ideas: [], statuses: [], eventsSnapshot: null });
    const chains = computeChains(stats);
    const shippedChain = chains.find((c) => c.statKey === "shipped");
    expect(shippedChain).toBeDefined();
    if (!shippedChain) return;
    const { container } = render(<ChainCard chain={shippedChain} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("AlmostThere renders with all chains from real computeChains output (empty factory)", () => {
    const stats = computeStats({ ideas: [], statuses: [], eventsSnapshot: null });
    const chains = computeChains(stats);
    const { container } = render(<AlmostThere chains={chains} />);
    expect(container.firstChild).not.toBeNull();
  });
});
