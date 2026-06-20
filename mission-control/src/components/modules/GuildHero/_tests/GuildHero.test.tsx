/**
 * WO-09-003 — GuildHero component tests (RED → GREEN → refactor)
 *
 * GuildHero = the character-sheet hero panel on the Achievements page.
 * Matches prototype logrosHero() (~L413):
 *   - Shield crest (Shield component) with pixel NIVEL numeral
 *   - GREMIO PANDACORP eyebrow in pixel/accent
 *   - Guild title (ttl, 27px display font)
 *   - Feats/trophies/missions summary line
 *   - Full-width XpBar (18px, with "faltan N para Nv X · nextRank")
 *   - Party roster sprites (TU PARTY label + Avatar list)
 *   - Three mini stat badges (Lanzados / Racha / Récord)
 *
 * AC-09-004.1 — shows level/title/XP from computeGuildLevel()
 * AC-09-004.3 — XP bar is honest (no fake fill)
 * AC-09-004.5 — reuses XpBar and Shield primitives
 * AC-09-003.1/.2/.3 — Avatar renders sprites, degrades gracefully, Spanish alt/aria
 *
 * Visual reference: prototype logrosHero() ~L413
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { GuildHero } from "../GuildHero";

afterEach(cleanup);

const DEFAULT_PROPS = {
  level: 3,
  title: "Artesano",
  xp: 350,
  next: 500,
  pctToNext: 70,
  nextTitle: "Oficial",
  featsCount: 5,
  trophiesCount: 2,
  trophiesTotal: 8,
  missionsActive: 3,
  partyRoster: ["researcher", "backend-dev", "frontend-dev"] as AgentRole[],
  statsLanzados: 1,
  statsRacha: 4,
  statsVelocidad: 30,
};

// ── Structure and rendering ──────────────────────────────────────────────────

describe("GuildHero — structure and rendering", () => {
  it("renders without crashing", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("guild-hero")).toBeDefined();
  });

  it("renders the Shield crest with the correct level", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const shield = screen.getByTestId("shield-root");
    expect(shield).toBeDefined();
    expect(shield.getAttribute("aria-label")).toContain("3");
  });

  it("renders GREMIO PANDACORP eyebrow in pixel/accent style", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const hero = screen.getByTestId("guild-hero");
    expect(hero.textContent).toContain("GREMIO PANDACORP");
  });

  it("renders guild title", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("guild-hero-title").textContent).toContain("Artesano");
  });

  it("renders feats/trophies/missions summary line", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const summary = screen.getByTestId("guild-hero-summary");
    expect(summary.textContent).toMatch(/5.*hazañas/i);
    expect(summary.textContent).toMatch(/2.*\/.*8.*trofeos/i);
    expect(summary.textContent).toMatch(/3.*misiones/i);
  });

  it("renders the full XpBar", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const xpBar = screen.getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("XP bar reflects real pct-to-next (no fake fill — AC-09-004.3)", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("70%");
  });

  it("XP bar at zero shows 0% fill (honest zero state)", () => {
    render(<GuildHero {...DEFAULT_PROPS} xp={0} next={100} pctToNext={0} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("0%");
  });
});

// ── Party roster (TU PARTY + avatars) ───────────────────────────────────────

describe("GuildHero — party roster (AC-09-003.1/.2/.3)", () => {
  it("renders 'TU PARTY' label", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const hero = screen.getByTestId("guild-hero");
    expect(hero.textContent).toContain("TU PARTY");
  });

  it("renders the party roster section", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("guild-hero-party")).toBeDefined();
  });

  it("renders avatars for each roster member", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const party = screen.getByTestId("guild-hero-party");
    const avatars = party.querySelectorAll("[data-testid='agent-avatar']");
    expect(avatars.length).toBe(3);
  });

  it("avatars have Spanish aria-label (AC-09-003.3)", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const avatars = screen.getAllByRole("img");
    // At least the avatars should have Spanish labels
    const avatarEls = avatars.filter((el) => el.getAttribute("aria-label")?.includes("agente"));
    expect(avatarEls.length).toBeGreaterThan(0);
  });

  it("empty roster renders gracefully (no crash, no layout break — AC-09-003.2)", () => {
    render(<GuildHero {...DEFAULT_PROPS} partyRoster={[]} />);
    expect(screen.getByTestId("guild-hero")).toBeDefined();
    expect(screen.getByTestId("guild-hero-party")).toBeDefined();
  });
});

// ── Mini stat badges ─────────────────────────────────────────────────────────

describe("GuildHero — mini stat badges", () => {
  it("renders the stats badges section", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("guild-hero-stats")).toBeDefined();
  });

  it("renders Lanzados badge with value", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const stats = screen.getByTestId("guild-hero-stats");
    expect(stats.textContent).toContain("Lanzados");
    expect(stats.textContent).toContain("1");
  });

  it("renders Racha badge with value", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const stats = screen.getByTestId("guild-hero-stats");
    expect(stats.textContent).toContain("Racha");
    expect(stats.textContent).toContain("4");
  });

  it("renders Récord badge with value", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const stats = screen.getByTestId("guild-hero-stats");
    expect(stats.textContent).toContain("Récord");
    expect(stats.textContent).toContain("30");
  });
});

// ── Design tokens compliance ─────────────────────────────────────────────────

describe("GuildHero — design tokens (no hardcoded colors)", () => {
  it("no hardcoded hex/rgb/hsl colors in inline style attributes", () => {
    render(<GuildHero {...DEFAULT_PROPS} />);
    const hero = screen.getByTestId("guild-hero");
    const allStyles = Array.from(hero.querySelectorAll("[style]"))
      .map((el) => el.getAttribute("style") ?? "")
      .join(" ");
    const rootStyle = hero.getAttribute("style") ?? "";
    const combined = `${rootStyle} ${allStyles}`;
    expect(combined).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(combined).not.toMatch(/\brgb\s*\(/i);
    expect(combined).not.toMatch(/\bhsl\s*\(/i);
  });
});
